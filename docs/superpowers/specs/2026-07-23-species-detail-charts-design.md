# Species Detail Charts Design

## Goal

Refresh the Species detail visualizations so detection history communicates daily activity over a year like a GitHub contribution heat map, while hourly activity communicates density and trend through a line chart.

## Approved design

The detection-history period selector offers only `Last year` and `All time`. The existing `Day` and `Week` options are removed, and the six-month option is not added.

Detection history becomes a daily heat map:

- Render one cell per day, including zero-detection days.
- Arrange the cells in week columns with weekday context and month labels.
- Use progressively stronger shades of the existing green for higher counts.
- Keep the existing raised card surface and softened border used across the Species page.
- Provide a tooltip containing the date and detection count.

Activity by hour becomes a smooth density-style line chart:

- Keep 24 hourly points for the species.
- Use a smooth line as the primary mark with a restrained area fill.
- Format x-axis labels in AM/PM style, showing a readable subset of hour labels.
- Keep the y-axis count and tooltip styling consistent with the heat map card.

## Data flow

Extend the stats-period model and trend query to support `year` as a rolling 365-day window and `all` as the existing capped all-time range. Daily trend points must remain zero-filled for the full selected range. Hourly activity remains a 24-point zero-filled series.

## Shared visual language

Use the existing CSS variables for `--paper-raised`, `--line`, `--moss`, `--meadow`, `--muted-foreground`, and `--hover-line`. Do not introduce a second card, border, tooltip, or chart palette. Chart containers continue to use the shared `feature-card` treatment.

## Verification

Confirm the period selector only shows `Last year` and `All time`, heat-map cells cover the requested daily range including empty days, hourly labels use AM/PM formatting, and both visualizations build without TypeScript or production-build errors.
