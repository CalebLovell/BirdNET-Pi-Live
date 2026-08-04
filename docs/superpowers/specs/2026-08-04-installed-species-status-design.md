# Installed Species Status

## Goal

Make Scientific name sortable and replace the Installed species table's separate Custom and Policy controls with one clear, mutually exclusive status.

## Status Model

Each row has exactly one displayed status, resolved in this order: **Never detect**, **Always detect**, **Custom**, then **Automatic**. The persisted BirdNET lists remain unchanged underneath; the UI adapts those lists into one status.

Applying a status produces these states:

- **Automatic:** remove the species from Custom, Never detect, and Always detect.
- **Custom:** add it to Custom and remove it from Never detect and Always detect.
- **Always detect:** add it to Always detect, remove it from Never detect, and add it to Custom only while Custom scope is active so it remains eligible there.
- **Never detect:** add it to Never detect and remove it from Custom and Always detect.

Normal scope offers Automatic, Always detect, and Never detect. Custom scope offers all four statuses. Switching scopes keeps the existing stash-and-restore behavior for the Custom list.

## Table Design

Replace the conditional Custom column and per-row Policy dropdown with one sortable **Status** column in both scopes. Render its value as a compact rounded chip:

- Automatic: neutral muted treatment.
- Custom: sage background with moss text.
- Always detect: sand background with bark text.
- Never detect: clay-tinted background with destructive text.

Status sorts by increasing intervention: Automatic, Custom, Always detect, Never detect. Scientific name becomes a sortable column with natural A–Z order. Species and Scientific name sorting use their respective common and scientific names.

Rows are no longer edited individually. The existing row checkboxes select one or many species, and a single **Set status** select in the bulk-change bar applies a scope-valid status to every selected row. This replaces the current row Policy dropdown and the separate Add to Custom / Automatic / Always detect / Never detect buttons.

## Scope

Modify only Species control UI/state helpers and their tests. Do not modify the detections page, shared table primitives, persistence format, save flow, import/export format, pagination, search, or selection behavior.

## Verification

Use test-first coverage for status resolution and transitions, scientific-name sorting, scope-specific bulk options, chip rendering, and the absence of Custom and Policy columns/dropdowns. Run focused tests, TypeScript checking, formatting/lint, the complete web UI test suite, and responsive browser checks in both scopes. Verify the detections table file hash remains unchanged.
