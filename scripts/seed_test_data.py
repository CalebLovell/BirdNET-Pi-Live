#!/usr/bin/env python3
"""Seed scripts/birds.db with realistic-looking fake detections for local dev.

Generates ~3-4 weeks of history plus today, with dawn/dusk activity
clustering, a mix of common/rare species, and a handful of detections in
the last hour so "today"/"last hour" stats aren't empty. Matches the exact
schema scripts/createdb.sh creates.

Usage:
    python3 scripts/seed_test_data.py            # wipes and reseeds
    python3 scripts/seed_test_data.py --append    # adds on top of existing rows
    python3 scripts/seed_test_data.py --days 14   # shorter history
"""
import argparse
import os
import random
import sqlite3
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'birds.db')

# (common_name, scientific_name, relative frequency weight)
REGULAR_SPECIES = [
    ('Northern Cardinal', 'Cardinalis cardinalis', 10),
    ('Blue Jay', 'Cyanocitta cristata', 8),
    ('American Robin', 'Turdus migratorius', 10),
    ('Black-capped Chickadee', 'Poecile atricapillus', 9),
    ('American Goldfinch', 'Spinus tristis', 7),
    ('House Finch', 'Haemorhous mexicanus', 7),
    ('Mourning Dove', 'Zenaida macroura', 6),
    ('Downy Woodpecker', 'Dryobates pubescens', 5),
    ('White-breasted Nuthatch', 'Sitta carolinensis', 5),
    ('Song Sparrow', 'Melospiza melodia', 6),
    ('Carolina Wren', 'Thryothorus ludovicianus', 5),
    ('Tufted Titmouse', 'Baeolophus bicolor', 5),
    ('European Starling', 'Sturnus vulgaris', 6),
    ('Red-winged Blackbird', 'Agelaius phoeniceus', 4),
    ('Dark-eyed Junco', 'Junco hyemalis', 4),
    ('American Crow', 'Corvus brachyrhynchos', 5),
    ('House Sparrow', 'Passer domesticus', 6),
    ('Common Grackle', 'Quiscalus quiscula', 4),
    ('Red-breasted Nuthatch', 'Sitta canadensis', 3),
    ('White-throated Sparrow', 'Zonotrichia albicollis', 3),
    ('Common Loon', 'Gavia immer', 1),
]

NOCTURNAL_SPECIES = [
    ('Barred Owl', 'Strix varia', 3),
    ('Great Horned Owl', 'Bubo virginianus', 2),
    ('Eastern Screech-Owl', 'Megascops asio', 1),
]

# Only shows up in the most recent few days, to leave something for
# "new/rare species" features to have real data to test against.
RECENT_RARITIES = [
    ('Ruby-throated Hummingbird', 'Archilochus colubris'),
    ('Cedar Waxwing', 'Bombycilla cedrorum'),
]

# Matches birdnet.conf defaults, so seeded rows look like a real install.
CUTOFF = 0.7
SENS = 1.25
OVERLAP = 0.0
LAT = 0.0
LON = 0.0
AUDIOFMT = 'mp3'


def random_confidence() -> float:
    # Skewed toward high confidence, occasionally near the cutoff.
    return round(min(0.99, max(CUTOFF, random.betavariate(6, 2))), 4)


def random_time_of_day(is_nocturnal: bool) -> tuple[int, int, int]:
    if is_nocturnal:
        hour = random.choice([20, 21, 22, 23, 0, 1, 2, 3, 4])
    else:
        # Bimodal: dawn chorus and evening activity, with a long quiet
        # midday tail and almost nothing overnight.
        peak = random.choices(['dawn', 'day', 'dusk'], weights=[45, 25, 30])[0]
        if peak == 'dawn':
            hour = int(random.gauss(6.5, 1.2)) % 24
        elif peak == 'dusk':
            hour = int(random.gauss(19, 1.5)) % 24
        else:
            hour = random.randint(10, 16)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return hour, minute, second


def build_row(day: datetime, common_name: str, sci_name: str, is_nocturnal: bool, override_time: datetime | None = None):
    if override_time is not None:
        dt = override_time
    else:
        hour, minute, second = random_time_of_day(is_nocturnal)
        dt = day.replace(hour=hour, minute=minute, second=second)

    date_str = dt.strftime('%Y-%m-%d')
    time_str = dt.strftime('%H:%M:%S')
    confidence = random_confidence()
    confidence_pct = round(confidence * 100)
    week = dt.isocalendar()[1]
    common_name_safe = common_name.replace("'", '').replace(' ', '_')
    file_name = f'{common_name_safe}-{confidence_pct}-{date_str}-birdnet-{time_str}.{AUDIOFMT}'

    return (date_str, time_str, sci_name, common_name, confidence, LAT, LON, CUTOFF, week, SENS, OVERLAP, file_name)


def generate_rows(days: int):
    rows = []
    today = datetime.now().replace(microsecond=0)
    day_starts = [today - timedelta(days=offset) for offset in range(days)]

    for day in reversed(day_starts):
        is_today = day.date() == today.date()
        daily_count = random.randint(50, 250)

        for _ in range(daily_count):
            if random.random() < 0.04:
                name, sci = random.choice(NOCTURNAL_SPECIES)[:2]
                rows.append(build_row(day, name, sci, is_nocturnal=True))
            else:
                name, sci, _weight = random.choices(
                    REGULAR_SPECIES,
                    weights=[w for *_, w in REGULAR_SPECIES],
                )[0]
                rows.append(build_row(day, name, sci, is_nocturnal=False))

        # Rare migrants only show up in the last 5 days.
        if (today - day).days < 5 and random.random() < 0.6:
            name, sci = random.choice(RECENT_RARITIES)
            rows.append(build_row(day, name, sci, is_nocturnal=False))

        # Guarantee a few detections in the last hour so "today"/"last hour"
        # stats have something to show right after seeding.
        if is_today:
            for minutes_ago in (5, 18, 34, 52):
                name, sci, _weight = random.choices(
                    REGULAR_SPECIES,
                    weights=[w for *_, w in REGULAR_SPECIES],
                )[0]
                rows.append(
                    build_row(
                        day,
                        name,
                        sci,
                        is_nocturnal=False,
                        override_time=today - timedelta(minutes=minutes_ago),
                    )
                )

    rows.sort(key=lambda r: (r[0], r[1]))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default=DB_PATH, help='Path to birds.db')
    parser.add_argument('--days', type=int, default=28, help='Number of days of history to generate, including today')
    parser.add_argument('--append', action='store_true', help="Don't clear existing rows first")
    parser.add_argument('--seed', type=int, default=None, help='Random seed, for reproducible output')
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    con = sqlite3.connect(args.db)
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS detections (
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
          File_Name VARCHAR(100) NOT NULL)
    """)

    if not args.append:
        cur.execute('DELETE FROM detections')

    rows = generate_rows(args.days)
    cur.executemany(
        'INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        rows,
    )
    con.commit()

    total = cur.execute('SELECT COUNT(*) FROM detections').fetchone()[0]
    species = cur.execute('SELECT COUNT(DISTINCT Com_Name) FROM detections').fetchone()[0]
    con.close()

    print(f'Inserted {len(rows)} detections ({args.days} days).')
    print(f'birds.db now has {total} total rows across {species} species.')


if __name__ == '__main__':
    main()
