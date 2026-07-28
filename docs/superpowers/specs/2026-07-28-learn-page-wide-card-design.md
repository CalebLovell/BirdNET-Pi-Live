# Learn Page Wide Card Design

## Goal

Make the Learn page feel intentionally composed across the available page width. Move the recording-pool selector to the left and let active quiz and results cards span the page, while preserving a compact empty state and a comfortable mobile experience.

## Scope

- Left-align the existing recording-pool toggle beneath the page header.
- Remove the `max-w-3xl` constraint from active quiz and completed-round cards.
- Keep both empty states inside the existing centered `max-w-3xl` wrapper.
- Recompose the active quiz at large breakpoints so the audio prompt occupies a compact left column and the answer choices occupy the larger right area.
- Keep progress and answer feedback/actions spanning the full card width.
- Preserve all quiz behavior, copy, URL search parameters, keyboard shortcuts, and loading behavior.

## Layout

### Active quiz

On small screens, the card keeps its current vertical rhythm: status, progress, audio prompt, choices, then feedback. At the existing small breakpoint, choices may continue to use two columns where space permits.

At a large breakpoint, the card uses a three-column content grid. The audio prompt occupies the first column. The choice grid occupies the remaining two columns, retaining two balanced answer columns. The question status and progress remain above this grid, and the feedback/action area remains below it.

This makes the extra width useful rather than merely stretching the current centered stack.

### Round results

The completed-round card spans the available page width. Its existing score, summary statistics, answer list, and replay action retain their current structure; wider space improves scanability without introducing a separate results design.

### Empty states

The no-detections and insufficient-pool cards remain centered and capped at `max-w-3xl`. Their short messages benefit from the current compact measure and should not stretch across the page.

### Pool selector

The pool selector remains directly between the page header and the quiz area, but its container uses left alignment. Its existing segmented-control styling and behavior remain unchanged.

## Visual Direction

Continue the current BirdNET-Pi visual system: the existing feature-card gradient, fine border, restrained radius, Georgia display accents, muted supporting text, moss/sage status colors, and compact spacing. The signature change is structural—the listening prompt becomes a left-hand rail on wide screens—so no new colors, typefaces, shadows, or decorative elements are introduced.

## Responsive and Accessibility Requirements

- The active card must fill the width of `.page-wrap` at every viewport size.
- The internal wide composition starts only when there is enough room; smaller screens remain stacked without horizontal scrolling.
- Answer buttons retain their current accessible names, focus behavior, disabled states, and number-key shortcuts.
- The selector retains its single-selection semantics and URL-driven state.
- Existing semantic sections and accessible labels remain intact.

## Implementation Boundaries

The change should stay within the Learn route and Learn game presentation. Shared card and toggle primitives should not be changed because their current behavior is used across the application. Data loading, round assembly, scoring, and navigation logic are out of scope.

## Verification

- Add a focused presentation test that distinguishes active/result cards from compact empty states and verifies the selector's left alignment.
- Run the focused test through a red-green cycle before implementation.
- Run the full web UI test suite, typecheck, and build.
- Inspect the Learn page at desktop and mobile widths, confirming no horizontal overflow and balanced wide-screen use of space.
