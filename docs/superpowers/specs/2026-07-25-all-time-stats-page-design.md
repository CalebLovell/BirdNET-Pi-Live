# All-Time Stats Page Design

## Goal

Refocus the stats page as an all-time overview whose charts and cards reuse the strongest visual and interaction patterns already established on the species-detail and timeline pages.

## Scope

- The stats page has no selectable period and no period search parameter.
- Every value and visualization on the page represents the complete detection history.
- The “Detections over time” chart is removed completely.
- The remaining page contains four summary cards followed by “Top species” and “Activity by hour of day.”
- Existing application colors, typography, card borders, and radii remain in use.
- Layout spacing uses the Tailwind four-step rhythm: `p-4`, `gap-4`, `mt-4`, and intentional multiples such as `mt-8`.

## Data Model

The stats loader accepts no period input and performs all queries without a date filter. Its returned data contains:

- `totalDetections`: total rows in the detections table.
- `uniqueSpecies`: distinct detected common names.
- `topSpecies`: the first entry in the ranked species list, or `null` when empty.
- `busiestHour`: the hour with the greatest all-time count, or `null` when no detections exist. Ties select the earliest hour.
- `topSpeciesList`: up to ten species ranked by descending count. Each item includes common name, scientific name, count, and bird image URL when available.
- `hourActivity`: exactly 24 points from hour 0 through 23, including zero-count hours.

The former trend data, period metadata, and period-dependent filtering are not part of the stats-page loader contract. Trend utilities used by the species-detail page remain unchanged.

Bird images follow the application’s existing resolution order: local illustration first, Wikipedia thumbnail second, Lucide `Bird` icon fallback in the interface.

## Summary Cards

Four equal cards form a responsive two-column grid that becomes four columns on large screens. Each card uses `p-4` and the grid uses `gap-4`.

1. “Total detections” uses a chart or signal icon and treats the count as the dominant content.
2. “Species detected” uses a bird icon and gives the distinct count the same numeric hierarchy.
3. “Top species” includes the leading species image, common name, and detection count. The image is decorative support for the named species rather than a separate large hero.
4. “Busiest hour” uses a clock icon, displays a friendly 12-hour label, and includes the detection count as supporting copy.

Icons sit in restrained moss/sage treatments and do not introduce new colors. Empty states show an em dash and concise supporting text without changing card height.

## Top Species Ranking

The ranking adopts the timeline page’s compact “Total detections” language instead of a Recharts axis chart:

- One row per species with a small bird thumbnail, common name, horizontal bar, and right-aligned tabular count.
- Rows are separated by the existing line color and use a consistent four-based vertical rhythm.
- Bar tracks use the timeline chart’s subtle bark-on-paper mix; fills use the solid moss/bark family and rounded right ends.
- Bar widths are normalized against the highest count, with a small visible minimum for non-zero values.
- Species names and thumbnails link to the species-detail page.
- Tooltips expose the complete species name and exact detection count where truncation or compact presentation might hide detail.
- Missing images render the Lucide `Bird` fallback.
- An empty ranking shows a quiet “No detections recorded yet” message inside the card.

This component remains local to the stats route. The timeline implementation is a visual reference, not a new shared abstraction, because the row data and responsive responsibilities differ.

## Activity by Hour of Day

The hourly chart matches the species-detail page’s “Daily Activity” behavior:

- Recharts `AreaChart` with the same moss gradient area and a two-pixel monotone moss line.
- No dots at rest; a small moss active dot appears on hover.
- Horizontal Cartesian grid only.
- Hour labels use the same compact 12-hour formatter and display every fourth tick through `interval={3}`.
- The Y axis only displays integers.
- Tooltip styling matches the existing raised-paper chart tooltip and formats the selected hour as a friendly 12-hour time.
- The chart is responsive, with a stable height appropriate for both its half-width desktop card and full-width mobile card.

The “Top species” and hourly activity sections form a one-column grid on small screens and a balanced two-column grid on large screens, using `gap-4`.

## Responsive and Accessible Behavior

- Cards and ranking rows preserve readable hierarchy at mobile widths without horizontal page overflow.
- Linked species rows have visible keyboard focus through the application’s existing focus ring behavior.
- Images use meaningful species alt text when informative; icon-only controls or decoration receive appropriate accessible labeling or hiding.
- Tooltip content supplements visible text and is not the only source of essential information.
- Numeric values use tabular figures.
- No new ambient animation is introduced; existing transition and reduced-motion behavior remains intact.

## Testing and Verification

- Add a pure, testable stats-data helper boundary where needed so all-time aggregation behavior can be verified without testing presentation markup alone.
- Verify the loader no longer accepts or applies a period.
- Verify hourly output contains all 24 ordered hours and fills missing hours with zero.
- Verify busiest-hour selection, including the empty state and earliest-hour tie behavior.
- Verify ranked species data includes scientific names and resolved image URLs required by the interface.
- Run the focused tests, full web UI test suite, TypeScript typecheck, and production build.
- Inspect the stats route at desktop and mobile widths to confirm the chart references, spacing rhythm, image fallbacks, empty state, and absence of the period/trend controls.

## Non-Goals

- Redesigning the timeline, detections, or species-detail pages.
- Changing the species-detail page’s own year selector or trend behavior.
- Extracting a general chart component library.
- Adding new dependencies, colors, fonts, filters, or date controls.
