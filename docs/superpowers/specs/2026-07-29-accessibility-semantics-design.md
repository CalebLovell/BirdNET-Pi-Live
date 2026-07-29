# Accessibility Semantics and Interaction Design

## Goal

Improve Birdbook Pi's semantic HTML, keyboard behavior, screen-reader output, and motion preferences without changing its visual design, responsive layout, or audio-alternative strategy.

The work covers accessible dialogs, nonvisual chart data, heading and section structure, landmark cleanup, definition-list correctness, skip and route-focus behavior, table metadata, reduced motion, and real pagination URLs. Narrow-screen responsiveness and audio alternatives are explicitly deferred.

## Design principles

The rendered document should describe the same information architecture that sighted users infer from cards, charts, and overlays. Native elements carry semantics wherever possible; ARIA connects or supplements those elements rather than replacing them. Layout-only wrappers remain `div` elements, while titled independent content becomes a `section` with a real heading and `aria-labelledby` relationship. Repeatable species result cards use `article` because each remains meaningful outside its surrounding collection.

The existing field-guide visual system remains unchanged. New headings reuse the current `island-kicker` presentation, screen-reader data alternatives use the existing `sr-only` utility, and dialog primitives preserve the current card surface, spacing, and buttons. No responsive redesign is included.

## Dialog behavior

Replace every hand-built modal overlay with shared wrappers around the Radix primitives already available through `radix-ui`.

Use a regular Dialog for:

- Review queue settings.
- Species recategorization.
- Station-location results and errors.

Use an AlertDialog for consequential confirmations:

- Correcting, recategorizing, or deleting a review candidate.
- Deleting selected detections.
- Resetting settings to defaults.

The shared wrappers own the portal, overlay, content surface, accessible title and description wiring, and close controls. Radix owns initial focus containment, Escape handling where dismissal is allowed, background inertness, and focus restoration to the trigger. Pending destructive actions keep their existing disabled states. User-facing error messages inside an open dialog use an assertive live region so failures are announced without moving focus.

## Chart and heatmap alternatives

The visible charts and heatmaps remain visually unchanged. Each visual receives one real section heading, a concise screen-reader-only summary, and a screen-reader-only data table.

For the Recharts cards:

- "Detections by hour" exposes columns for hour and detection count.
- "Detections over time" exposes columns for the displayed period label and detection count.
- The day activity chart uses the same hour/count table contract.
- The visible chart container is hidden from assistive technology so SVG implementation details do not duplicate the table.

For the timeline and day heatmaps:

- The visible grid is hidden from assistive technology instead of exposing every colored cell as an individual image.
- One hidden table uses species as row headers and hours as column headers.
- A caption identifies the active date or period when available.
- Counts are plain numeric cell values, making screen-reader table navigation predictable.

Empty chart states keep their existing visible messages and do not render an empty data table.

## Page headings and semantic cards

Every route has one page-level `h1` describing the page itself.

- Today gains an `h1` containing "Today" with the existing `sr-only` utility so the current visual hierarchy is preserved.
- The latest-bird hero on Today uses `h2`.
- The species-detail hero continues to use `h1`.
- The shared species hero accepts an explicit heading level instead of assuming `h1` in every context.

Promote visible card labels such as "Last 24 hours," "Recent activity," "Top species," "Detection history," "Visit log," and chart titles from styled `div` elements to `h2`. Each titled card uses a stable generated or explicit heading ID and `section aria-labelledby`, avoiding duplicated `aria-label` text.

Convert card shells that currently use layout-only `div` elements to `section` only when they contain independent titled content. Structural grids, flex wrappers, stat groupings, and decorative shells remain `div` elements. Species result cards become `article aria-labelledby` elements because each contains its own `h2`, actions, image, and metadata.

## Landmarks and navigation focus

The root document remains the sole owner of the `main` landmark. Settings success and unavailable states replace their nested `main` elements with neutral route wrappers.

Add a visually hidden "Skip to main content" link as the first focusable element in the body. It becomes visible on focus and targets `#main-content`. The root `main` receives that ID and `tabIndex={-1}` so both the skip link and programmatic route focus work without placing the landmark in the normal tab order.

After a completed client-side pathname change, focus moves to the root `main`. The initial page load and search-parameter-only changes within the current page do not steal focus. This ensures a newly selected page is announced without disrupting filters, sorting, or pagination.

## Definition lists

All definition-list groups place `dt` before their associated `dd`. Summary cards may preserve their current value-first visual layout with CSS ordering, but DOM order remains term then definition. Supplemental detail belongs inside the same group after the definition and does not interrupt the term/definition relationship.

## Detections table

Add a screen-reader-only caption that describes the table as the filtered detections result set. Column headers remain native `th` elements.

Sortable headers expose `aria-sort="ascending"`, `aria-sort="descending"`, or `aria-sort="none"` on the `th`, not on the nested button. The button's accessible name describes the action it will perform, while `aria-sort` describes the current state. The visual arrow remains decorative to assistive technology.

## Pagination

Species pagination uses real TanStack route links whose `href` includes the target page and preserves the current search and sort state. This restores copying, opening in a new tab, browser status previews, and no-JavaScript meaning.

At the first or last page, Previous or Next renders as a non-link disabled control with `aria-disabled="true"` and is excluded from the tab order. Numbered links retain `aria-current="page"` for the current page. Client-side navigation may still use replacement history where that matches the existing filter behavior, but the DOM always contains a real destination URL.

## Reduced motion

Add a `prefers-reduced-motion: reduce` rule that disables the rise-in, flash-in, live pulse, and spinner animations and shortens nonessential transitions to effectively instantaneous. State remains understandable without animation: the Live pill keeps its text, fresh rows keep their final background, and loading controls retain their icon and label.

## Testing

Use test-driven development for each behavior that can be represented in the existing Node test setup.

Server-rendered markup tests cover:

- One root `main` and no nested route `main`.
- The Today page's page heading and hero heading levels.
- Card headings and `section aria-labelledby` relationships.
- Correct `dt` then `dd` ordering.
- Detections table caption and sortable-header metadata.
- Chart captions, row/column headers, data values, and hidden visible graphics.
- Real pagination destinations and disabled boundary controls.
- The skip-link target and root-main focusability.

Shared pure helpers used to build chart-table rows or pagination destinations receive focused unit tests. Dialog behavior is verified through rendered browser interaction because focus trapping, background inertness, Escape handling, and focus restoration are browser behaviors delegated to Radix.

Final verification runs the full web test suite, typecheck, non-writing Biome check, production build, and rendered browser checks across Today, Timeline, Species, Detections, Review, Statistics, Settings, and a day detail route. Browser checks confirm heading structure, landmark counts, hidden chart tables, dialog focus containment and restoration, skip-link behavior, client-side route focus, and pagination URLs.

## Explicitly deferred

- Responsive navigation and narrow-screen row reflow.
- Audio transcripts, caption files, sonograms, call descriptions, and other audio alternatives.
- Visual redesign of cards, charts, heatmaps, navigation, or pagination.
- Unrelated lint, formatting, performance, or data-model changes.
