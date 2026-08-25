#!/usr/bin/env python3
"""Seed scripts/birds.db with realistic-looking fake detections for local dev.

Generates three years of history plus today, so every time range the web-ui
offers (day, week, month, season, year, all-time) has something real behind
it. The generator models the things that actually make a BirdNET yard-list
look like a yard list:

  * seasonality -- residents sing year-round but peak in spring, summer
    breeders arrive and leave on schedule, winter sparrows replace them,
    and passage migrants show up for a couple of weeks in April/May and
    again in September/October;
  * a daily activity curve tied to sunrise/sunset, which drift by roughly
    two hours between the solstices;
  * daily volume that rises into the dawn-chorus peak and collapses in
    midwinter, plus weather-ish runs of quiet days and the occasional
    recorder outage;
  * year-over-year change -- an irruption winter, a wren population that
    crashes in a hard winter and recovers, a species that colonizes the
    yard partway through, one that disappears, and a slow decline.

Also generates one placeholder audio clip per species (for its most recent
detection) at BirdNET-Pi's real extraction path, so web-ui's play button
has something real to play locally -- the same BIRDNET_EXTRACTED_DIR
default web-ui itself uses.

Usage:
    python3 scripts/seed_test_data.py               # wipes and reseeds 3 years
    python3 scripts/seed_test_data.py --append      # adds on top of existing rows
    python3 scripts/seed_test_data.py --days 14     # shorter history
    python3 scripts/seed_test_data.py --no-audio    # skip placeholder audio clips
"""
import argparse
import math
import os
import random
import sqlite3
import struct
import wave
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'birds.db')

# Mirrors web-ui's default BIRDNET_EXTRACTED_DIR: BirdSongs lives as a
# sibling of the BirdNET-Pi checkout, never inside the repo itself.
DEFAULT_EXTRACTED_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'BirdSongs', 'Extracted')
)

DEFAULT_DAYS = 365 * 3 + 1

# Matches birdnet.conf defaults, so seeded rows look like a real install.
CUTOFF = 0.7
SENS = 1.25
OVERLAP = 0.0
LAT = 0.0
LON = 0.0
AUDIOFMT = 'mp3'


# --------------------------------------------------------------------------
# Seasonality
#
# Each species carries a presence curve: given a day of the year it returns
# a multiplier on that species' base weight. 0 means "not here"; 1 is a
# normal day; residents swing above and below 1 with the singing season.
# --------------------------------------------------------------------------

def _day_of_year(day: datetime) -> int:
    return day.timetuple().tm_yday


def _within(doy: int, start: int, end: int) -> bool:
    """Windows that wrap past New Year (winter visitors) are still one window."""
    if start <= end:
        return start <= doy <= end
    return doy >= start or doy <= end


def window(start: int, end: int, ramp: int = 14, floor: float = 0.0, peak: float = 1.0):
    """Present between two days of the year, fading in and out over `ramp` days.

    `floor` is what's left outside the window -- 0 for a true migrant, a
    small number for a species that mostly leaves but always has a few
    stragglers overwintering."""

    def presence(doy: int) -> float:
        if not _within(doy, start, end):
            return floor
        from_start = (doy - start) % 365
        to_end = (end - doy) % 365
        edge_distance = min(from_start, to_end)
        return floor + (peak - floor) * min(1.0, (edge_distance + 1) / ramp)

    return presence


def year_round(peak_doy: int = 140, amplitude: float = 0.55):
    """Here every day, but far more vocal around `peak_doy` (late spring)."""

    def presence(doy: int) -> float:
        return 1.0 + amplitude * math.cos(2 * math.pi * (doy - peak_doy) / 365)

    return presence


def passage(spring: tuple[int, int], fall: tuple[int, int], fall_scale: float = 0.7):
    """Two short windows a year: north in spring, back through in fall."""
    spring_window = window(*spring, ramp=6)
    fall_window = window(*fall, ramp=8)

    def presence(doy: int) -> float:
        return max(spring_window(doy), fall_scale * fall_window(doy))

    return presence


def constant(level: float = 1.0):
    return lambda doy: level


# --------------------------------------------------------------------------
# Year-over-year change
#
# `years_ago` is 0 for the most recent twelve months, 2 for the oldest, so
# the story stays the same shape no matter what day the seeder is run.
# --------------------------------------------------------------------------

def by_year(*multipliers: float):
    """Multipliers ordered oldest-first: by_year(2y ago, 1y ago, this year)."""

    def factor(years_ago: int) -> float:
        index = len(multipliers) - 1 - min(years_ago, len(multipliers) - 1)
        return multipliers[index]

    return factor


STABLE = by_year(1.0, 1.0, 1.0)


class Species:
    def __init__(self, common, sci, weight, presence, year=STABLE, nocturnal=False, skill=0.86):
        self.common = common
        self.sci = sci
        self.weight = weight
        self.presence = presence
        self.year = year
        self.nocturnal = nocturnal
        # How cleanly BirdNET tends to hear this one -- a cardinal is
        # unmistakable, a distant flyover loon scrapes the cutoff.
        self.skill = skill

    def weight_on(self, doy: int, years_ago: int) -> float:
        return self.weight * self.presence(doy) * self.year(years_ago)


SPECIES = [
    # --- year-round residents -------------------------------------------
    Species('Northern Cardinal', 'Cardinalis cardinalis', 10, year_round(120, 0.5), skill=0.9),
    Species('Blue Jay', 'Cyanocitta cristata', 8, year_round(130, 0.35), skill=0.89),
    Species('Black-capped Chickadee', 'Poecile atricapillus', 9, year_round(100, 0.4), skill=0.88),
    Species('Tufted Titmouse', 'Baeolophus bicolor', 5, year_round(110, 0.5)),
    Species('White-breasted Nuthatch', 'Sitta carolinensis', 5, year_round(95, 0.4)),
    Species('Downy Woodpecker', 'Dryobates pubescens', 5, year_round(105, 0.35), skill=0.83),
    Species('Hairy Woodpecker', 'Dryobates villosus', 2, year_round(105, 0.35), skill=0.79),
    Species('Red-bellied Woodpecker', 'Melanerpes carolinus', 4, year_round(115, 0.45)),
    Species('American Crow', 'Corvus brachyrhynchos', 5, year_round(140, 0.25), skill=0.9),
    Species('Mourning Dove', 'Zenaida macroura', 6, year_round(150, 0.45)),
    Species('European Starling', 'Sturnus vulgaris', 6, year_round(120, 0.3), skill=0.8),
    Species('American Goldfinch', 'Spinus tristis', 7, year_round(180, 0.5)),
    Species('House Finch', 'Haemorhous mexicanus', 7, year_round(130, 0.4)),
    # Small resident wren, badly hit by an ice storm two winters back.
    Species('Carolina Wren', 'Thryothorus ludovicianus', 6, year_round(125, 0.4),
            year=by_year(1.0, 0.25, 0.7)),
    # Slow, undramatic decline -- the kind of trend a 3-year chart should show.
    Species('House Sparrow', 'Passer domesticus', 6, year_round(140, 0.3),
            year=by_year(1.35, 1.05, 0.75), skill=0.82),
    # Colonized the neighbourhood partway through the record.
    Species('Fish Crow', 'Corvus ossifragus', 3, window(60, 300, ramp=25, floor=0.15),
            year=by_year(0.0, 0.35, 1.0), skill=0.78),

    # --- partial migrants: thin in winter, everywhere in summer ---------
    Species('American Robin', 'Turdus migratorius', 11, window(55, 320, ramp=20, floor=0.12), skill=0.89),
    Species('Song Sparrow', 'Melospiza melodia', 6, window(60, 300, ramp=18, floor=0.15)),
    Species('Red-winged Blackbird', 'Agelaius phoeniceus', 5, window(50, 285, ramp=12, floor=0.03)),
    Species('Common Grackle', 'Quiscalus quiscula', 4, window(58, 305, ramp=14, floor=0.05), skill=0.82),
    Species('Eastern Phoebe', 'Sayornis phoebe', 3, window(75, 295, ramp=10)),
    Species('Cedar Waxwing', 'Bombycilla cedrorum', 3, constant(0.6), skill=0.81),

    # --- summer breeders ------------------------------------------------
    Species('Gray Catbird', 'Dumetella carolinensis', 6, window(115, 270, ramp=10)),
    Species('House Wren', 'Troglodytes aedon', 5, window(118, 255, ramp=10)),
    Species('Chipping Sparrow', 'Spizella passerina', 5, window(100, 275, ramp=12)),
    Species('Baltimore Oriole', 'Icterus galbula', 3, window(125, 240, ramp=8)),
    Species('Wood Thrush', 'Hylocichla mustelina', 3, window(125, 250, ramp=10), skill=0.87),
    Species('Common Yellowthroat', 'Geothlypis trichas', 3, window(122, 255, ramp=8)),
    Species('Eastern Wood-Pewee', 'Contopus virens', 3, window(135, 255, ramp=10)),
    Species('Ruby-throated Hummingbird', 'Archilochus colubris', 2, window(122, 265, ramp=10), skill=0.76),
    Species('Barn Swallow', 'Hirundo rustica', 3, window(110, 250, ramp=10)),
    Species('Chimney Swift', 'Chaetura pelagica', 3, window(115, 262, ramp=10), skill=0.8),

    # --- winter visitors ------------------------------------------------
    Species('Dark-eyed Junco', 'Junco hyemalis', 7, window(288, 100, ramp=16), skill=0.84),
    Species('White-throated Sparrow', 'Zonotrichia albicollis', 6, window(275, 125, ramp=14)),
    Species('American Tree Sparrow', 'Spizella arborea', 3, window(310, 70, ramp=14), skill=0.8),
    # Classic irruptives: essentially absent except one big winter.
    Species('Red-breasted Nuthatch', 'Sitta canadensis', 4, window(270, 115, ramp=18),
            year=by_year(0.15, 1.0, 0.2)),
    Species('Pine Siskin', 'Spinus pinus', 4, window(295, 105, ramp=18),
            year=by_year(0.05, 1.0, 0.1), skill=0.79),

    # --- passage migrants: a fortnight in spring, longer in fall --------
    Species('Yellow-rumped Warbler', 'Setophaga coronata', 4, passage((105, 140), (265, 300))),
    Species('White-crowned Sparrow', 'Zonotrichia leucophrys', 3, passage((115, 140), (270, 295))),
    Species('Swainson\'s Thrush', 'Catharus ustulatus', 2, passage((128, 148), (250, 278)), skill=0.82),
    Species('Blackpoll Warbler', 'Setophaga striata', 2, passage((135, 152), (245, 272)), skill=0.78),
    Species('Rose-breasted Grosbeak', 'Pheucticus ludovicianus', 2, passage((125, 150), (250, 272))),

    # --- nocturnal ------------------------------------------------------
    Species('Barred Owl', 'Strix varia', 3, year_round(75, 0.5), nocturnal=True, skill=0.88),
    Species('Great Horned Owl', 'Bubo virginianus', 2, year_round(20, 0.7), nocturnal=True, skill=0.85),
    # Heard for two years, then the pair moved on.
    Species('Eastern Screech-Owl', 'Megascops asio', 2, year_round(60, 0.5),
            year=by_year(1.0, 0.8, 0.05), nocturnal=True, skill=0.8),

    # --- genuine scarcities: a handful of records across three years ----
    Species('Common Loon', 'Gavia immer', 0.4, passage((100, 130), (280, 315)), skill=0.73),
    Species('Pileated Woodpecker', 'Dryocopus pileatus', 0.6, year_round(110, 0.4), skill=0.82),
    Species('Great Blue Heron', 'Ardea herodias', 0.3, window(80, 300, ramp=20), skill=0.74),
    Species('Wild Turkey', 'Meleagris gallopavo', 0.5, year_round(110, 0.6), skill=0.8),
]

# Never recorded before, then turns up in the last couple of weeks -- gives
# "new species" and "first record" features something real to point at.
NEW_ARRIVALS = [
    Species('Painted Bunting', 'Passerina ciris', 1, constant(1.0), skill=0.72),
    Species('Evening Grosbeak', 'Coccothraustes vespertinus', 1, constant(1.0), skill=0.76),
]
NEW_ARRIVAL_WINDOW_DAYS = 16


# --------------------------------------------------------------------------
# Daily rhythm and volume
# --------------------------------------------------------------------------

def sun_times(doy: int) -> tuple[float, float]:
    """Rough sunrise/sunset in decimal hours for a mid-latitude yard.

    Swings from about 05:15/20:30 at the June solstice to 07:40/16:45 in
    late December, which is what pushes the dawn chorus around the clock
    across a three-year chart."""
    seasonal = math.cos(2 * math.pi * (doy - 172) / 365)
    sunrise = 6.45 - 1.25 * seasonal
    sunset = 18.6 + 1.9 * seasonal
    return sunrise, sunset


def _days_from(doy: int, centre: int) -> int:
    """Distance to a day of the year the short way round the calendar."""
    gap = abs(doy - centre) % 365
    return min(gap, 365 - gap)


def seasonal_volume(doy: int) -> float:
    """Detections per day, seasonally: a May peak roughly five times midwinter."""
    spring_peak = math.exp(-(_days_from(doy, 138) / 55) ** 2)
    autumn_bump = 0.35 * math.exp(-(_days_from(doy, 260) / 40) ** 2)
    return 0.18 + 0.82 * spring_peak + autumn_bump


def daily_counts(days: list[datetime]) -> dict:
    """Per-day detection totals, with weather-length runs of quiet and outages.

    Weather doesn't reset at midnight, so the noise term is a random walk
    rather than an independent draw per day -- that's what produces the
    believable three-or-four-day slumps in the charts."""
    counts = {}
    weather = 1.0
    outage_days_left = 0
    for day in days:
        # Pulled back toward normal each day, so spells last a few days
        # rather than wandering far enough to outweigh the season itself.
        weather = min(1.3, max(0.55, 1.0 + (weather - 1.0) * 0.8 + random.gauss(0, 0.09)))
        years_ago = _years_ago(days[-1], day)
        # The recorder and model both got better over the record.
        gear = (0.78, 0.93, 1.0)[2 - min(years_ago, 2)]

        if outage_days_left > 0:
            outage_days_left -= 1
            counts[day.date()] = random.randint(0, 6)
            continue
        if random.random() < 0.012:
            # SD card full, power cut, mic unplugged for a day or three.
            outage_days_left = random.randint(0, 2)
            counts[day.date()] = random.randint(0, 4)
            continue

        base = 32 + 250 * seasonal_volume(_day_of_year(day))
        rain = 0.45 if random.random() < 0.1 else 1.0
        counts[day.date()] = max(3, int(base * weather * gear * rain * random.gauss(1.0, 0.08)))
    return counts


def _years_ago(today: datetime, day: datetime) -> int:
    return max(0, (today.date() - day.date()).days) // 365


def random_confidence(skill: float = 0.86) -> float:
    """Skewed toward high confidence, occasionally near the cutoff.

    `skill` shifts the whole distribution: a loud, distinctive resident sits
    near 0.95, a distant flyover hovers just above the cutoff."""
    raw = random.betavariate(2.6, 2.0)
    reach = 0.85 + (skill - 0.75) * 1.6
    value = CUTOFF + (1 - CUTOFF) * raw * reach
    return round(min(0.99, max(CUTOFF, value)), 4)


def random_time_of_day(species: Species, doy: int) -> tuple[int, int, int]:
    sunrise, sunset = sun_times(doy)
    if species.nocturnal:
        # Owls call around full dark, either side of midnight.
        centre = sunset + 2.5 if random.random() < 0.55 else sunrise - 2.0
        hour_float = random.gauss(centre, 1.6)
    else:
        phase = random.choices(['dawn', 'day', 'dusk'], weights=[46, 25, 29])[0]
        if phase == 'dawn':
            hour_float = random.gauss(sunrise + 0.4, 1.1)
        elif phase == 'dusk':
            hour_float = random.gauss(sunset - 1.0, 1.3)
        else:
            hour_float = random.uniform(sunrise + 3, sunset - 3)

    hour_float %= 24
    hour = int(hour_float)
    minute = int((hour_float - hour) * 60)
    return hour, minute, random.randint(0, 59)


def random_datetime_in_day(day: datetime, species: Species, not_after: datetime | None = None) -> datetime:
    """Picks a time of day for `day`, never later than `not_after`.

    Today's detections can't have happened yet, so the daily activity curve
    is resampled until it lands in the past; if the clamp cuts off the
    species' active hours entirely (owls before dawn on a morning run), it
    falls back to a uniform time in the elapsed part of the day."""
    midnight = day.replace(hour=0, minute=0, second=0, microsecond=0)
    doy = _day_of_year(day)
    for _ in range(20):
        hour, minute, second = random_time_of_day(species, doy)
        dt = midnight.replace(hour=hour, minute=minute, second=second)
        if not_after is None or dt <= not_after:
            return dt

    elapsed = int((not_after - midnight).total_seconds())
    return midnight + timedelta(seconds=random.randint(0, max(0, elapsed)))


def build_row(
    day: datetime,
    species: Species,
    override_time: datetime | None = None,
    not_after: datetime | None = None,
):
    if override_time is not None:
        dt = override_time
    else:
        dt = random_datetime_in_day(day, species, not_after)

    date_str = dt.strftime('%Y-%m-%d')
    time_str = dt.strftime('%H:%M:%S')
    confidence = random_confidence(species.skill)
    confidence_pct = round(confidence * 100)
    week = dt.isocalendar()[1]
    common_name_safe = species.common.replace("'", '').replace(' ', '_')
    file_name = f'{common_name_safe}-{confidence_pct}-{date_str}-birdnet-{time_str}.{AUDIOFMT}'

    return (
        date_str, time_str, species.sci, species.common, confidence,
        LAT, LON, CUTOFF, week, SENS, OVERLAP, file_name,
    )


def generate_rows(days: int):
    rows = []
    today = datetime.now().replace(microsecond=0)
    day_starts = list(reversed([today - timedelta(days=offset) for offset in range(days)]))
    counts = daily_counts(day_starts)

    for day in day_starts:
        is_today = day.date() == today.date()
        # Nothing on today can be in the future.
        not_after = today if is_today else None
        doy = _day_of_year(day)
        years_ago = _years_ago(today, day)

        present = [(s, s.weight_on(doy, years_ago)) for s in SPECIES]
        present = [(s, w) for s, w in present if w > 0.001]
        if not present:
            continue
        pool = [s for s, _ in present]
        weights = [w for _, w in present]

        for species in random.choices(pool, weights=weights, k=counts[day.date()]):
            rows.append(build_row(day, species, not_after=not_after))

        # A vagrant or two in the last fortnight, so "new species" has data.
        if (today - day).days < NEW_ARRIVAL_WINDOW_DAYS and random.random() < 0.22:
            species = random.choice(NEW_ARRIVALS)
            for _ in range(random.randint(1, 3)):
                rows.append(build_row(day, species, not_after=not_after))

        # Guarantee a few detections in the last hour so "today"/"last hour"
        # stats have something to show right after seeding.
        if is_today:
            for minutes_ago in (5, 18, 34, 52):
                species = random.choices(pool, weights=weights)[0]
                rows.append(
                    build_row(day, species, override_time=today - timedelta(minutes=minutes_ago))
                )

    rows.sort(key=lambda r: (r[0], r[1]))
    return rows


def write_placeholder_wav(path: str, seed_text: str, duration: float = 1.2, framerate: int = 22050):
    """Writes a short synthesized tone, distinct per species, so the
    web-ui's play button has something real to play during local dev."""
    freq = 350 + (abs(hash(seed_text)) % 700)
    frame_count = int(duration * framerate)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(framerate)
        frames = bytearray()
        for i in range(frame_count):
            t = i / framerate
            envelope = max(0.0, min(1.0, t * 8, (duration - t) * 8))
            sample = int(32767 * 0.3 * envelope * math.sin(2 * math.pi * freq * t))
            frames += struct.pack('<h', sample)
        wav_file.writeframes(bytes(frames))


def seed_placeholder_audio(con: sqlite3.Connection, extracted_dir: str):
    """Generates one placeholder clip per species (its most recent
    detection) at BirdNET-Pi's real extraction path (By_Date/<date>/
    <species>/<file>), and repoints that one row's File_Name at the
    matching .wav so the DB and the file on disk agree."""
    cur = con.cursor()
    cur.execute("""
        SELECT Com_Name, Date, Time, File_Name FROM detections
        ORDER BY Date DESC, Time DESC
    """)
    seen = set()
    updates = []
    for com_name, date, time, file_name in cur.fetchall():
        if com_name in seen:
            continue
        seen.add(com_name)

        com_name_safe = com_name.replace("'", '').replace(' ', '_')
        # ':' is valid in filenames on the Pi's Linux filesystem (where the
        # real format comes from) but illegal on Windows dev machines, so
        # the placeholder file itself uses a filesystem-safe name.
        stem = os.path.splitext(file_name)[0].replace(':', '-')
        wav_name = f'{stem}.wav'
        full_path = os.path.join(extracted_dir, 'By_Date', date, com_name_safe, wav_name)
        write_placeholder_wav(full_path, com_name)
        updates.append((wav_name, com_name, date, time))

    cur.executemany(
        'UPDATE detections SET File_Name = ? WHERE Com_Name = ? AND Date = ? AND Time = ?',
        updates,
    )
    con.commit()
    print(f'Generated {len(updates)} placeholder audio clips under {extracted_dir}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default=DB_PATH, help='Path to birds.db')
    parser.add_argument(
        '--days',
        type=int,
        default=DEFAULT_DAYS,
        help='Number of days of history to generate, including today (default: three years)',
    )
    parser.add_argument('--append', action='store_true', help="Don't clear existing rows first")
    parser.add_argument('--seed', type=int, default=None, help='Random seed, for reproducible output')
    parser.add_argument(
        '--extracted-dir',
        default=os.environ.get('BIRDNET_EXTRACTED_DIR', DEFAULT_EXTRACTED_DIR),
        help='Directory to write placeholder audio clips into',
    )
    parser.add_argument(
        '--no-audio', action='store_true', help='Skip generating placeholder audio clips'
    )
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
        reviews_table_exists = cur.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'reviews'"
        ).fetchone()
        if reviews_table_exists:
            cur.execute('DELETE FROM reviews')
        cur.execute('DELETE FROM detections')

    rows = generate_rows(args.days)
    cur.executemany(
        'INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        rows,
    )
    con.commit()

    if not args.no_audio:
        seed_placeholder_audio(con, args.extracted_dir)

    total = cur.execute('SELECT COUNT(*) FROM detections').fetchone()[0]
    species = cur.execute('SELECT COUNT(DISTINCT Com_Name) FROM detections').fetchone()[0]
    con.close()

    print(f'Inserted {len(rows)} detections ({args.days} days).')
    print(f'birds.db now has {total} total rows across {species} species.')


if __name__ == '__main__':
    main()
