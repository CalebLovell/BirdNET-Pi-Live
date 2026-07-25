# All-Time Detections Chart Design

## Goal

Add an all-time detections line chart to the stats page while preserving the page's compact visual hierarchy. On large screens, the two charts share the height of the adjacent Top Species card; on small screens, all three cards stack naturally.

## Layout

The analytics section becomes a two-column grid at the large breakpoint:

```text
+---------------------------+---------------------------+
| Activity by hour of day   |                           |
|                           | Top species               |
+---------------------------+                           |
| Detections over time      |                           |
|                           |                           |
+---------------------------+---------------------------+
```

- The left column contains two equal-height chart cards separated by a spacing-4 gap.
- The right column contains Top Species and spans the full combined height.
- The existing Top Species minimum height remains the desktop floor. The left column stretches to the card's actual rendered height, and each chart receives half of the remaining height after the gap.
- On narrower screens, the order is Activity by hour of day, Detections over time, then Top Species.
- Card padding, inter-card gaps, and internal section spacing continue to use the existing spacing-4 rhythm.

## Chart Design

The new card is titled **Detections over time** and follows the existing Activity by hour of day chart:

- moss line with a subtle vertical area fade;
- horizontal grid lines only;
- integer y-axis values;
- sparse, readable x-axis labels;
- the shared raised-paper tooltip treatment;
- no dots except the active point;
- a clear empty state when there are no detections.

The tooltip displays the exact bucket label and detection count. The x-axis uses abbreviated labels appropriate to the selected bucket size.

## Adaptive All-Time Aggregation

The server determines the full inclusive date range from the earliest through latest detection. It selects one bucket size based on that span:

- 120 days or fewer: calendar-day buckets;
- 121 through 730 inclusive days: calendar-week buckets beginning Monday;
- more than 730 days: calendar-month buckets.

Every database detection contributes to exactly one bucket. Missing buckets inside the observed date range are returned with a count of zero so the line accurately shows quiet periods. The previous 365-day all-time cap is not used.

The stats loader returns the resulting trend points with a stable bucket key, display label, and count. Aggregation occurs in the database and the server fills only missing buckets, keeping the client payload bounded for long-running installations.

## Components and Data Flow

1. A pure stats-data helper selects the adaptive granularity and builds the complete ordered bucket sequence.
2. The stats server query reads the earliest/latest dates, groups detections using the selected SQLite bucket expression, and merges counts into the complete sequence.
3. `StatsData` exposes the trend series to the stats route.
4. `DetectionsOverTimeCard` renders the series and shares tooltip and chart styling with `HourlyActivityCard`.
5. The stats route arranges the two chart cards beside the spanning Top Species card.

## Edge Cases

- No detections: return an empty trend and render the empty state.
- One detection day: use daily aggregation and one point.
- Missing days, weeks, or months: include zero-count buckets.
- Year boundaries and leap years: calendar bucket generation remains ordered and inclusive.
- Malformed or absent date bounds: treat the trend as empty rather than producing invalid chart data.

## Testing and Verification

- Unit tests cover daily, weekly, and monthly threshold selection.
- Unit tests cover ordered inclusive bucket generation and zero-filled gaps.
- Existing stats-data tests continue to pass.
- Type checking and formatting checks pass.
- Browser verification covers desktop equal-height layout, mobile stacking, populated tooltips, empty state, and overflow.

## Out of Scope

- Period selectors or a Last Year option.
- Species-specific filtering.
- Zooming, brushing, or client-side aggregation controls.
- Changes to the summary cards or Top Species row design.
