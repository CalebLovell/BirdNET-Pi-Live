import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
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
