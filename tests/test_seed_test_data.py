import importlib.util
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SEED_SCRIPT = REPO_ROOT / "scripts" / "seed_test_data.py"

CREATE_DETECTIONS = """
CREATE TABLE detections (
  Date DATE,
  Time TIME,
  Sci_Name VARCHAR(100) NOT NULL,
  Com_Name VARCHAR(100) NOT NULL,
  Confidence FLOAT,
  Lat FLOAT,
  Lon FLOAT,
  Cutoff FLOAT,
  Week INT,
  Sens FLOAT,
  Overlap FLOAT,
  File_Name VARCHAR(100) NOT NULL
)
"""

OLD_DETECTION = (
    "2000-01-01",
    "00:00:00",
    "Oldus birdus",
    "Old Bird",
    0.5,
    0.0,
    0.0,
    0.7,
    1,
    1.25,
    0.0,
    "old.mp3",
)


def load_seeder():
    """Imports the seeder as a module so the generator can be tested without a database."""
    spec = importlib.util.spec_from_file_location("seed_test_data", SEED_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


seeder = load_seeder()


class SeasonalityTests(unittest.TestCase):
    """The generated history is the only sample data the UI's long time ranges have.

    These lock in the shape a year of birding actually has, so a change that
    flattens it (every species present every day, one flat activity curve)
    fails here rather than quietly making the charts meaningless."""

    JANUARY = 15
    JUNE = 166

    def species(self, common_name):
        for candidate in seeder.SPECIES:
            if candidate.common == common_name:
                return candidate
        self.fail(f"{common_name} is no longer in the species list")

    def test_default_history_spans_three_years(self):
        self.assertGreaterEqual(seeder.DEFAULT_DAYS, 365 * 3)

    def test_summer_breeders_and_winter_visitors_do_not_overlap(self):
        """Catches a presence curve that makes every species a year-round resident."""
        oriole = self.species("Baltimore Oriole")
        junco = self.species("Dark-eyed Junco")

        self.assertGreater(oriole.presence(self.JUNE), 0.5)
        self.assertEqual(oriole.presence(self.JANUARY), 0)
        self.assertGreater(junco.presence(self.JANUARY), 0.5)
        self.assertEqual(junco.presence(self.JUNE), 0)

    def test_passage_migrants_appear_only_on_migration(self):
        """Catches a migrant that lingers through the breeding season."""
        blackpoll = self.species("Blackpoll Warbler")

        self.assertGreater(blackpoll.presence(143), 0.5)   # late May
        self.assertGreater(blackpoll.presence(260), 0.2)   # mid September
        self.assertEqual(blackpoll.presence(200), 0)       # mid July
        self.assertEqual(blackpoll.presence(self.JANUARY), 0)

    def test_irruptive_species_favours_a_single_winter(self):
        """Catches year factors collapsing into three identical years."""
        siskin = self.species("Pine Siskin")
        weights = [siskin.weight_on(self.JANUARY, years_ago) for years_ago in (0, 1, 2)]

        self.assertGreater(max(weights), 5 * min(weights))

    def test_dawn_chorus_follows_the_sunrise_through_the_year(self):
        """Catches a fixed clock-time activity curve that ignores the season."""
        june_sunrise, june_sunset = seeder.sun_times(self.JUNE)
        january_sunrise, january_sunset = seeder.sun_times(self.JANUARY)

        self.assertLess(june_sunrise, january_sunrise - 1)
        self.assertGreater(june_sunset, january_sunset + 1)

    def test_generated_rows_cover_every_month_with_a_spring_peak(self):
        """Catches a generator that produces three years of undifferentiated noise."""
        seeder.random.seed(3)
        rows = seeder.generate_rows(seeder.DEFAULT_DAYS)

        by_month = Counter(row[0][5:7] for row in rows)
        self.assertEqual(len(by_month), 12)

        spring = sum(by_month[month] for month in ("04", "05", "06"))
        winter = sum(by_month[month] for month in ("12", "01", "02"))
        self.assertGreater(spring, 2 * winter)

    def test_generated_rows_end_today_and_start_three_years_back(self):
        """Catches an off-by-a-year history, which the UI's year ranges depend on."""
        seeder.random.seed(3)
        rows = seeder.generate_rows(seeder.DEFAULT_DAYS)

        first = datetime.strptime(rows[0][0], "%Y-%m-%d").date()
        last = datetime.strptime(rows[-1][0], "%Y-%m-%d").date()
        self.assertEqual(last, date.today())
        self.assertLessEqual(first, date.today() - timedelta(days=365 * 3 - 1))


class SeedTestDataTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.db_path = Path(self.temp_dir.name) / "birds.db"

    def run_seeder(self, *extra_args):
        return subprocess.run(
            [
                sys.executable,
                str(SEED_SCRIPT),
                "--db",
                str(self.db_path),
                "--days",
                "1",
                "--seed",
                "1",
                "--no-audio",
                *extra_args,
            ],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )

    def create_existing_database(self, include_reviews=True):
        with closing(sqlite3.connect(self.db_path)) as con:
            con.execute(CREATE_DETECTIONS)
            con.execute(
                "INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                OLD_DETECTION,
            )
            if include_reviews:
                con.execute("CREATE TABLE reviews (marker TEXT NOT NULL)")
                con.execute("INSERT INTO reviews VALUES ('old review')")
            con.execute("CREATE TABLE sentinel (marker TEXT NOT NULL)")
            con.execute("INSERT INTO sentinel VALUES ('keep me')")
            con.commit()

    def test_reset_replaces_detections_and_clears_reviews_only(self):
        """Catches a reset that leaves application review state behind or drops unrelated data."""
        self.create_existing_database()

        self.run_seeder()

        with closing(sqlite3.connect(self.db_path)) as con:
            old_rows = con.execute(
                "SELECT COUNT(*) FROM detections WHERE File_Name = 'old.mp3'"
            ).fetchone()[0]
            detection_count = con.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
            review_count = con.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
            sentinel = con.execute("SELECT marker FROM sentinel").fetchone()[0]
        self.assertEqual(old_rows, 0)
        self.assertGreater(detection_count, 0)
        self.assertEqual(review_count, 0)
        self.assertEqual(sentinel, "keep me")

    def test_reset_succeeds_before_reviews_table_exists(self):
        """Catches an unconditional DELETE that breaks fresh databases."""
        self.create_existing_database(include_reviews=False)

        self.run_seeder()

        with closing(sqlite3.connect(self.db_path)) as con:
            detection_count = con.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
        self.assertGreater(detection_count, 0)

    def test_append_preserves_existing_detections_and_reviews(self):
        """Catches reset behavior leaking into the explicitly non-destructive append path."""
        self.create_existing_database()

        self.run_seeder("--append")

        with closing(sqlite3.connect(self.db_path)) as con:
            old_rows = con.execute(
                "SELECT COUNT(*) FROM detections WHERE File_Name = 'old.mp3'"
            ).fetchone()[0]
            detection_count = con.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
            review_count = con.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
        self.assertEqual(old_rows, 1)
        self.assertGreater(detection_count, 1)
        self.assertEqual(review_count, 1)


if __name__ == "__main__":
    unittest.main()
