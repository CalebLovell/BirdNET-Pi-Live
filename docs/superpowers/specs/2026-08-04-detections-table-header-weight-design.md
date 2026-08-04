# Detections Table Header Weight

## Goal

Make the labeled column headers in the **All detections** table slightly easier to distinguish from its body rows.

## Design

Apply the existing `font-semibold` utility locally to the table header cells in `DetectionsTable`. This raises the weight of **Recorded**, **Species**, **Scientific name**, **Confidence**, and **Recording** from medium to semibold. The unlabeled selection column inherits the same cell style but has no visible text.

Do not change the shared `TableHead` component, page or card headings, table body text, spacing, sizing, colors, sorting behavior, or accessibility markup.

## Verification

Run the web UI's relevant automated checks and inspect the diff to confirm the change remains local to the detections table.
