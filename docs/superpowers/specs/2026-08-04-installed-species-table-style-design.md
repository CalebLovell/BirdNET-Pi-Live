# Installed Species Table Style

## Goal

Make the Installed species table on Species control visually consistent with the approved All detections table without changing the detections page.

## Design

Refactor only `SpeciesControlTable` from hand-written table elements to the existing shared table primitives used by `DetectionsTable`: `Table`, `TableHeader`, `TableHead`, `TableRow`, `TableBody`, and `TableCell`.

The Installed species table will inherit the reference table's foreground semibold column headers, 40-pixel header height, eight-pixel cell padding, fixed column layout, row dividers, muted row-hover treatment, and persistent low-contrast sort indicators. Its current minimum width and controls remain specific to Species control. The stacked name cell becomes separate **Species** and **Scientific name** columns, matching the reference table: common names remain medium weight, scientific names remain italic and bark-colored, counts remain right-aligned tabular data, selection and Custom checkboxes remain centered, and Policy remains right-aligned.

Sorting, selection, Custom membership, policy editing, pagination, empty state, responsive horizontal scrolling, data flow, and accessibility semantics remain unchanged. The detections table and shared table primitives are not modified.

## Verification

Add a rendered-component regression test for the shared table slots and local semibold headers. Run the focused test, Species control component tests, TypeScript checking, and the complete web UI test suite. Compare the detections table file hash before and after implementation to prove it was not edited.
