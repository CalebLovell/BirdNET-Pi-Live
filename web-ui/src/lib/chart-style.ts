/**
 * How long a series takes to redraw, shared by every recharts chart. Well under
 * recharts' 1500ms default: stepping a year selector is a repeated action, and
 * at the default the chart was still settling when you pressed again.
 */
export const CHART_ANIMATION_MS = 500;
