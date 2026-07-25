# Compact Stats Summary Cards Design

## Goal

Replace the vertically distributed stats summary cards with dense horizontal metric cards that preserve visual identity while eliminating unused space.

## Card Structure

Each card is a single horizontal row with `p-4`:

- A 32px icon or bird image occupies the left column.
- A flexible text column occupies the right side.
- The uppercase kicker sits above the primary value with an 8px gap.
- The card has no forced minimum height and does not distribute content with `justify-between`.
- Card height is content-driven, targeting approximately 88–96px on desktop.

The four cards remain in a two-column grid by default and a four-column grid on large screens. Grid spacing remains `gap-4`.

## Content

- “Total detections” shows only the icon, label, and all-time total.
- “Species detected” shows only the icon, label, and unique-species count.
- “Top species” shows the bird image or `Bird` fallback, label, common name, and detection count inline after the name.
- “Busiest hour” shows the clock icon, label, formatted hour, and detection count inline after the hour.
- The redundant “All recorded visits” and “Unique species” supporting labels are removed.
- Empty top-species and busiest-hour states show an em dash without a detection-count suffix.

## Visual System

- Existing paper, moss, sage, ink, border, radius, and typography tokens remain unchanged.
- Standard icons retain the restrained sage circular treatment.
- The top-species bird image is displayed without a decorative circle so its silhouette remains the distinguishing element.
- Primary numbers use tabular figures and existing hierarchy; species names retain display typography.
- Spacing uses four-pixel multiples: 16px outer padding, 16px icon-to-copy gap, and 8px label-to-value gap.

## Responsive and Accessibility

- Cards align to equal heights within each grid row without fixed height declarations.
- Long species names truncate on narrow cards while the full value remains available in the existing top-species ranking below.
- Informative bird imagery keeps species alt text; Lucide icons are decorative and hidden from assistive technology.
- The layout must not create horizontal overflow at mobile widths.

## Verification

- Visually inspect the populated stats page at desktop and mobile widths.
- Confirm desktop card height is no more than 96px unless user font settings require additional space.
- Confirm all four cards align and contain no large blank region between label and value.
- Run Biome on `stats.tsx`, the full test suite, and TypeScript typechecking.

## Non-Goals

- Changing the lower ranking or hourly-activity cards.
- Changing stats queries or values.
- Introducing shared card abstractions or new dependencies.
