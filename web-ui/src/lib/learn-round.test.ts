import assert from "node:assert/strict";
import test from "node:test";

import {
	buildRound,
	CHOICES_PER_QUESTION,
	type PoolSpecies,
	pointsForAttempt,
	QUESTIONS_PER_ROUND,
	roundVerdict,
	scoreRound,
} from "./learn-round.ts";

function speciesNamed(name: string, clipCount = 3): PoolSpecies {
	return {
		comName: name,
		sciName: `Genus ${name}`,
		speciesSlug: name.toLowerCase(),
		imageUrl: null,
		clips: Array.from({ length: clipCount }, (_, index) => ({
			date: "2026-07-25",
			fileName: `${name}-${index}.mp3`,
			detectedAt: `2026-07-25 06:0${index}:00`,
			confidence: 0.9,
		})),
	};
}

function poolOf(count: number): PoolSpecies[] {
	return Array.from({ length: count }, (_, index) =>
		speciesNamed(`Bird${index}`),
	);
}

// A predictable stand-in for Math.random: always picks the first element of
// whatever it is asked about, which keeps the shuffles a no-op.
const alwaysZero = () => 0;

test("builds a full round of questions from a large enough pool", () => {
	const round = buildRound(poolOf(10), alwaysZero);

	assert.equal(round.questions.length, QUESTIONS_PER_ROUND);
	assert.equal(round.speciesInPool, 10);
});

test("gives every question the right number of distinct choices", () => {
	for (const question of buildRound(poolOf(10)).questions) {
		assert.equal(question.choices.length, CHOICES_PER_QUESTION);
		const names = new Set(question.choices.map((choice) => choice.sciName));
		assert.equal(names.size, CHOICES_PER_QUESTION);
	}
});

test("always includes the answer among the choices", () => {
	for (const question of buildRound(poolOf(6)).questions) {
		assert.ok(
			question.choices.some(
				(choice) => choice.sciName === question.answerSciName,
			),
		);
	}
});

test("returns an empty round when the pool cannot fill the choices", () => {
	const round = buildRound(poolOf(CHOICES_PER_QUESTION - 1));

	assert.deepEqual(round.questions, []);
	assert.equal(round.speciesInPool, CHOICES_PER_QUESTION - 1);
});

test("ignores species that have no playable clips", () => {
	const pool = [...poolOf(4), speciesNamed("Silent", 0)];
	const round = buildRound(pool);

	assert.equal(round.speciesInPool, 4);
	for (const question of round.questions) {
		assert.ok(question.choices.every((choice) => choice.comName !== "Silent"));
	}
});

test("spreads questions across the pool before repeating a species", () => {
	const round = buildRound(poolOf(QUESTIONS_PER_ROUND));
	const answers = round.questions.map((question) => question.answerSciName);

	assert.equal(new Set(answers).size, QUESTIONS_PER_ROUND);
});

test("repeats species when the pool is smaller than the round", () => {
	const round = buildRound(poolOf(4));

	assert.equal(round.questions.length, QUESTIONS_PER_ROUND);
});

test("points fall off with each extra guess", () => {
	assert.equal(pointsForAttempt(1), 3);
	assert.equal(pointsForAttempt(2), 1);
	assert.equal(pointsForAttempt(3), 0);
	assert.equal(pointsForAttempt(9), 0);
});

test("scores a round of clean answers at full marks", () => {
	const score = scoreRound([{ attempts: 1 }, { attempts: 1 }]);

	assert.equal(score.score, 6);
	assert.equal(score.maxScore, 6);
	assert.equal(score.firstTry, 2);
	assert.equal(score.bestStreak, 2);
});

test("tracks the longest first-try streak, not the last one", () => {
	const score = scoreRound([
		{ attempts: 1 },
		{ attempts: 1 },
		{ attempts: 1 },
		{ attempts: 3 },
		{ attempts: 1 },
	]);

	assert.equal(score.bestStreak, 3);
	assert.equal(score.firstTry, 4);
	assert.equal(score.score, 12);
});

test("scores an empty round at zero", () => {
	assert.deepEqual(scoreRound([]), {
		score: 0,
		maxScore: 0,
		firstTry: 0,
		answered: 0,
		bestStreak: 0,
	});
});

test("reads the verdict off first-try accuracy", () => {
	assert.equal(roundVerdict(scoreRound([])), "No birds yet.");
	assert.equal(roundVerdict(scoreRound([{ attempts: 1 }])), "Perfect ear.");
	assert.equal(
		roundVerdict(scoreRound([{ attempts: 1 }, { attempts: 4 }])),
		"Coming along.",
	);
	assert.equal(
		roundVerdict(scoreRound([{ attempts: 2 }, { attempts: 2 }])),
		"Plenty left to learn.",
	);
});
