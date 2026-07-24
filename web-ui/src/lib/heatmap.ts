export const HEAT_COLORS = [
	"var(--paper)",
	"color-mix(in oklab, var(--moss) 15%, var(--paper-raised))",
	"color-mix(in oklab, var(--moss) 30%, var(--paper-raised))",
	"color-mix(in oklab, var(--moss) 50%, var(--paper-raised))",
	"color-mix(in oklab, var(--moss) 70%, var(--paper-raised))",
] as const;

export function heatLevel(count: number, maximum: number): number {
	if (count === 0 || maximum === 0) return 0;
	return Math.min(4, Math.max(1, Math.ceil((count / maximum) * 4)));
}
