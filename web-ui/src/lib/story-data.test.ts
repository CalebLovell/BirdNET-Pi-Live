import assert from "node:assert/strict";
import test from "node:test";

import {
	buildStory,
	RARE_LIFETIME_MAX,
	RETURN_AFTER_DAYS,
	STORY_SPECIES_LIMIT,
	type StoryFacts,
	VOLUME_BASELINE_MIN,
} from "./story-data.ts";

function species(comName: string) {
	return {
		comName,
		sciName: `Sci ${comName}`,
		speciesSlug: comName.toLowerCase(),
		imageUrl: null,
	};
}

/** A day with nothing to say, over a station with plenty of history. */
function quietFacts(overrides: Partial<StoryFacts> = {}): StoryFacts {
	return {
		newSpecies: [],
		returning: [],
		rare: [],
		breakingRoutine: [],
		windowCount: 100,
		baseline: 100,
		...overrides,
	};
}

const tones = (facts: StoryFacts) => buildStory(facts).map((line) => line.tone);

test("says nothing notable happened rather than nothing at all", () => {
	const [line, ...rest] = buildStory(quietFacts());
	assert.equal(line.tone, "calm");
	assert.deepEqual(rest, []);
});

test("admits it has no baseline yet instead of calling the day typical", () => {
	const [line] = buildStory(quietFacts({ windowCount: 3, baseline: 1 }));
	assert.equal(line.tone, "learning");
});

test("names a single new species in the singular", () => {
	const [line] = buildStory(quietFacts({ newSpecies: [species("Merlin")] }));
	assert.equal(line.tone, "new");
	assert.equal(line.headline, "A brand new species for your station");
	assert.deepEqual(
		line.species.map((row) => row.comName),
		["Merlin"],
	);
});

test("counts new species in the headline when there are several", () => {
	const [line] = buildStory(
		quietFacts({ newSpecies: [species("Merlin"), species("Dunnock")] }),
	);
	assert.equal(line.headline, "2 new species for your station");
});

test("lists only the first few birds and counts the rest", () => {
	const many = Array.from({ length: STORY_SPECIES_LIMIT + 4 }, (_, index) =>
		species(`Bird ${index}`),
	);
	const [line] = buildStory(quietFacts({ newSpecies: many }));

	assert.equal(line.species.length, STORY_SPECIES_LIMIT);
	assert.equal(line.moreCount, 4);
});

test("says how long a returning bird was away", () => {
	const [line] = buildStory(
		quietFacts({
			returning: [{ ...species("Redwing"), daysAway: RETURN_AFTER_DAYS + 9 }],
		}),
	);
	assert.equal(line.tone, "return");
	assert.equal(line.species[0].note, `${RETURN_AFTER_DAYS + 9} days away`);
});

test("says how few records a rare visitor has, in the singular at one", () => {
	const [line] = buildStory(
		quietFacts({ rare: [{ ...species("Wryneck"), lifetimeCount: 1 }] }),
	);
	assert.equal(line.tone, "rare");
	assert.equal(line.headline, "Rare visitor");
	assert.equal(line.species[0].note, "1 record ever");
});

test("pluralises the rare headline and its counts together", () => {
	const [line] = buildStory(
		quietFacts({
			rare: [
				{ ...species("Wryneck"), lifetimeCount: 2 },
				{ ...species("Hoopoe"), lifetimeCount: RARE_LIFETIME_MAX },
			],
		}),
	);
	assert.equal(line.headline, "Rare visitors");
	assert.equal(line.species[0].note, "2 records ever");
});

test("reports a regular that has fallen silent", () => {
	const [line] = buildStory(
		quietFacts({
			breakingRoutine: [{ ...species("Robin"), daysSilent: 3 }],
		}),
	);
	assert.equal(line.tone, "routine");
	assert.equal(line.species[0].note, "silent 3 days");
});

test("calls out a day well above the station's own average", () => {
	const [line] = buildStory(
		quietFacts({ baseline: VOLUME_BASELINE_MIN, windowCount: 40 }),
	);
	assert.equal(line.tone, "busy");
	assert.equal(line.detail, "Activity is 100% above your two-week average.");
});

test("calls out a day well below it", () => {
	const [line] = buildStory(quietFacts({ baseline: 100, windowCount: 40 }));
	assert.equal(line.tone, "quiet");
	assert.equal(line.detail, "Activity is 60% below your two-week average.");
});

test("stays quiet about volume swings on a station too small to judge", () => {
	// Four times the average, but the average is a handful of detections --
	// exactly the noise the gate exists to keep out of the story.
	assert.deepEqual(
		tones(quietFacts({ baseline: VOLUME_BASELINE_MIN - 1, windowCount: 76 })),
		["calm"],
	);
});

test("stays quiet about volume when the day is close to normal", () => {
	assert.deepEqual(tones(quietFacts({ baseline: 100, windowCount: 115 })), [
		"calm",
	]);
});

test("orders arrivals before absences before volume", () => {
	assert.deepEqual(
		tones(
			quietFacts({
				newSpecies: [species("Merlin")],
				returning: [{ ...species("Redwing"), daysAway: 20 }],
				rare: [{ ...species("Wryneck"), lifetimeCount: 2 }],
				breakingRoutine: [{ ...species("Robin"), daysSilent: 3 }],
				baseline: 100,
				windowCount: 200,
			}),
		),
		["new", "return", "rare", "routine", "busy"],
	);
});

test("drops the closing line as soon as any rule fires", () => {
	const result = tones(quietFacts({ newSpecies: [species("Merlin")] }));
	assert.deepEqual(result, ["new"]);
});
