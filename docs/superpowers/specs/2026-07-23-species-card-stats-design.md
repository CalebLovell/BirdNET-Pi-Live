# Species Card Stats Design

## Goal

Improve the visual hierarchy of the Species card statistics using the supplied reference as inspiration. Keep detection counts prominent, place them in a more deliberate layout, and add first- and last-heard timestamps as secondary metadata.

## Approved design

Each card keeps its existing title, scientific name, illustration, audio control, and external links. The current loose pair of `This hour` and `All time` values becomes a compact two-by-two stats grid beneath the illustration:

- `This hour`: the number of detections in the rolling last-hour window.
- `All time`: the total number of detections for the species.
- `First heard`: the earliest available detection date and time for the species.
- `Last heard`: the latest available detection date and time for the species.

The two count values are the primary visual focus, using the existing tabular data styling with stronger emphasis. Timestamp values use smaller, muted styling and compact formatting so the grid remains readable at the card's minimum width. The grid should have consistent spacing, align values and labels, and avoid increasing the card's action area or changing navigation behavior.

## Data flow

Extend `LifeListCard` with `firstDetected` and retain the existing `lastDetected`. In `getLifeListCards`, derive both values from the existing `detections.Date` and `detections.Time` columns, using chronological ordering. Preserve the existing latest-record lookup because it also supplies the playable audio URL. If no timestamp is available, render an em dash rather than an empty label.

## Formatting

Format the stored date and time into a compact local display suitable for a small card. The available date and time are both included when present. The formatter must tolerate the database's existing date/time string format and fall back to the original value if parsing is not possible.

## Verification

Run the web UI typecheck and production build. Confirm the card renders all four stats, that first/last values differ correctly for species with multiple detections, and that the existing card links, audio playback, search, sorting, and pagination remain unchanged.
