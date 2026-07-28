# Learn Page Wide Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Left-align the Learn page pool selector and make active quiz/results cards use the full page width with a purposeful wide-screen composition, while keeping empty states compact.

**Architecture:** Extract the pool selector and round-width wrapper into a small presentational Learn layout component so their responsive contracts can be rendered and tested without router context. Keep quiz state and behavior in `LearnGame`, changing only its internal responsive grid.

**Tech Stack:** React 19, TypeScript 6, TanStack Router, Radix Toggle Group, Tailwind CSS 4, Node test runner, React DOM server rendering.

## Global Constraints

- Preserve all quiz behavior, copy, URL search parameters, keyboard shortcuts, and loading behavior.
- Keep both empty states centered at `max-w-3xl`.
- Do not modify shared card or toggle primitives.
- Do not add dependencies, colors, typefaces, shadows, or decorative elements.
- Smaller screens must remain stacked without horizontal scrolling.
- Existing semantic sections, accessible labels, focus behavior, disabled states, and selector semantics must remain intact.

---

### Task 1: Learn page outer layout

**Files:**
- Create: `web-ui/src/components/learn/learn-layout.tsx`
- Create: `web-ui/src/components/learn/learn-layout.test.tsx`
- Modify: `web-ui/src/routes/learn.tsx:103-151`

**Interfaces:**
- Consumes: `LearnPool`, `LEARN_POOLS`, `LEARN_POOL_LABELS`, and the existing pool icon map moved from the route.
- Produces: `LearnPoolSelector({ pool, onPoolChange })` and `LearnRoundShell({ isEmpty, children })`.

- [ ] **Step 1: Write the failing presentation tests**

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { LearnPoolSelector, LearnRoundShell } from "./learn-layout.tsx";

test("left-aligns the recording-pool selector", () => {
	const markup = renderToStaticMarkup(
		<LearnPoolSelector pool="today" onPoolChange={() => {}} />,
	);
	assert.match(markup, /class="[^"]*justify-start/);
});

test("uses full width for rounds and a compact width for empty states", () => {
	const active = renderToStaticMarkup(
		<LearnRoundShell isEmpty={false}>Round</LearnRoundShell>,
	);
	const empty = renderToStaticMarkup(
		<LearnRoundShell isEmpty>Empty</LearnRoundShell>,
	);
	assert.match(active, /class="[^"]*w-full/);
	assert.doesNotMatch(active, /max-w-3xl/);
	assert.match(empty, /class="[^"]*max-w-3xl/);
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `cd web-ui && npm test -- src/components/learn/learn-layout.test.tsx`

Expected: FAIL because `learn-layout.tsx` does not exist.

- [ ] **Step 3: Add the minimal presentational layout components**

Create `learn-layout.tsx` with the icon mapping and toggle markup extracted from the route:

```tsx
import { CalendarDays, Clock, Infinity as InfinityIcon, Repeat2 } from "lucide-react";
import type { PropsWithChildren } from "react";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { LEARN_POOL_LABELS, LEARN_POOLS, type LearnPool } from "~/lib/learn-pools.ts";

const POOL_ICONS: Record<LearnPool, React.ComponentType<{ className?: string }>> = {
	today: Clock,
	week: CalendarDays,
	frequent: Repeat2,
	all: InfinityIcon,
};

export function LearnPoolSelector({ pool, onPoolChange }: {
	pool: LearnPool;
	onPoolChange: (pool: LearnPool) => void;
}) {
	return (
		<div className="mt-4 flex justify-start overflow-x-auto pb-1">
			<ToggleGroup
				type="single"
				variant="outline"
				value={pool}
				onValueChange={(value) => {
					if (value) onPoolChange(value as LearnPool);
				}}
			>
				{LEARN_POOLS.map((option) => {
					const Icon = POOL_ICONS[option];
					return (
						<ToggleGroupItem key={option} value={option}>
							<Icon className="size-4" />
							{LEARN_POOL_LABELS[option]}
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>
		</div>
	);
}
```

Implement the state-aware shell as:

```tsx
export function LearnRoundShell({ isEmpty, children }: PropsWithChildren<{ isEmpty: boolean }>) {
	return (
		<div className={isEmpty ? "mx-auto mt-4 max-w-3xl" : "mt-4 w-full"}>
			{children}
		</div>
	);
}
```

Update `learn.tsx` to render `LearnPoolSelector` and pass its value back through the existing `navigate` call. Wrap either `EmptyPool` or `LearnGame` in `LearnRoundShell`, using `isEmpty={round.questions.length === 0}`. Remove the route-local icons and direct toggle imports.

- [ ] **Step 4: Run the focused test and verify the green state**

Run: `cd web-ui && npm test -- src/components/learn/learn-layout.test.tsx`

Expected: 2 tests pass.

- [ ] **Step 5: Commit the outer layout change**

```bash
git add web-ui/src/components/learn/learn-layout.tsx web-ui/src/components/learn/learn-layout.test.tsx web-ui/src/routes/learn.tsx
git commit -m "refactor: widen Learn round layout"
```

### Task 2: Responsive active-quiz composition

**Files:**
- Create: `web-ui/src/components/learn/learn-game.test.tsx`
- Modify: `web-ui/src/components/learn/learn-game.tsx:93-123`

**Interfaces:**
- Consumes: the existing `LearnGame` props and `LearnRound` data shape without changes.
- Produces: the same `LearnGame` component with a wide-screen prompt-and-answers grid.

- [ ] **Step 1: Write the failing active-quiz layout test**

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { LearnRound } from "~/lib/learn-round.ts";
import { LearnGame } from "./learn-game.tsx";

const round: LearnRound = {
	id: "round-1",
	speciesInPool: 4,
	questions: [{
		id: "question-1",
		audioUrl: "/audio/test.wav",
		detectedAt: "2026-07-28 08:00:00",
		confidence: 0.9,
		answerSciName: "Cardinalis cardinalis",
		choices: [
			{ comName: "Northern Cardinal", sciName: "Cardinalis cardinalis", speciesSlug: "Northern_Cardinal", imageUrl: null },
			{ comName: "Blue Jay", sciName: "Cyanocitta cristata", speciesSlug: "Blue_Jay", imageUrl: null },
			{ comName: "American Robin", sciName: "Turdus migratorius", speciesSlug: "American_Robin", imageUrl: null },
			{ comName: "House Finch", sciName: "Haemorhous mexicanus", speciesSlug: "House_Finch", imageUrl: null },
		],
	}],
};

test("uses a listening rail beside the choices on wide screens", () => {
	const markup = renderToStaticMarkup(
		<LearnGame round={round} onPlayAgain={() => {}} isLoadingNextRound={false} />,
	);
	assert.match(markup, /lg:grid-cols-\[minmax\(12rem,1fr\)_minmax\(0,2fr\)\]/);
	assert.match(markup, /data-learn-prompt=""/);
	assert.match(markup, /data-learn-choices=""/);
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `cd web-ui && npm test -- src/components/learn/learn-game.test.tsx`

Expected: FAIL because the wide grid and its prompt/choice regions are absent.

- [ ] **Step 3: Implement the wide-screen internal grid**

Replace the separate prompt and choice blocks with one responsive grid:

```tsx
<div className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)] lg:items-center">
	<div data-learn-prompt className="flex flex-col items-center gap-2 lg:border-[var(--line)] lg:border-r lg:pr-4">
		<ClipPlayer key={question.id} audioUrl={question.audioUrl} />
		<div className="tabular-data text-muted-foreground text-xs">
			Recorded {formatClockTime(question.detectedAt)} · {question.detectedAt.slice(0, 10)}
		</div>
	</div>
	<div data-learn-choices className="grid gap-2 sm:grid-cols-2">
		{question.choices.map((choice, choiceIndex) => (
			<ChoiceButton
				key={choice.sciName}
				choice={choice}
				shortcut={choiceIndex + 1}
				state={
					isSolved && choice.sciName === question.answerSciName
						? "correct"
						: wrongGuesses.includes(choice.sciName)
							? "wrong"
							: isSolved
								? "muted"
								: "open"
				}
				onSelect={() => guess(choice)}
			/>
		))}
	</div>
</div>
```

Keep the question header, progress track, feedback area, choice state calculation, and handlers unchanged.

- [ ] **Step 4: Run the focused test and verify the green state**

Run: `cd web-ui && npm test -- src/components/learn/learn-game.test.tsx`

Expected: 1 test passes.

- [ ] **Step 5: Run both Learn presentation tests**

Run: `cd web-ui && npm test -- src/components/learn/learn-layout.test.tsx src/components/learn/learn-game.test.tsx`

Expected: 3 tests pass.

- [ ] **Step 6: Commit the responsive quiz composition**

```bash
git add web-ui/src/components/learn/learn-game.tsx web-ui/src/components/learn/learn-game.test.tsx
git commit -m "refactor: compose wide Learn quiz"
```

### Task 3: Full verification

**Files:**
- Verify only; do not modify generated route files.

**Interfaces:**
- Consumes: the completed Learn layout and quiz presentation.
- Produces: fresh automated and visual verification evidence.

- [ ] **Step 1: Run the full automated test suite**

Run: `cd web-ui && npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run static validation**

Run: `cd web-ui && npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run: `cd web-ui && npm run build`

Expected: exit code 0.

- [ ] **Step 4: Inspect the page at desktop and mobile widths**

Start the existing development server with `cd web-ui && npm run dev`. Inspect `/learn` at approximately 1440 px and 390 px widths. Confirm the selector is left-aligned, the active card fills `.page-wrap`, the large layout uses a left listening rail and right answer grid, the empty state remains centered and capped, and neither viewport has horizontal overflow.

- [ ] **Step 5: Review the final diff**

Run: `git diff HEAD~2 --check && git diff HEAD~2 -- web-ui/src/components/learn web-ui/src/routes/learn.tsx`

Expected: no whitespace errors and only the scoped Learn presentation/test changes.
