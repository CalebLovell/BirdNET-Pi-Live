import type { ComponentType, ReactNode } from "react";

/**
 * One figure in a masthead: an icon, a label, and a single value. That is the
 * whole vocabulary -- no subtitle, no unit line, no state colour. Every figure
 * across the app reads the same size, in the same face, so a row of them scans
 * as one instrument rather than a set of differently-styled readouts.
 */
export type PageHeaderStat = {
	label: string;
	value: string | number;
	icon: ComponentType<{ className?: string }>;
};

/** Literal strings so Tailwind keeps every column count it might be asked for. */
const COLUMN_CLASSES: Record<number, string> = {
	1: "lg:grid-cols-1",
	2: "lg:grid-cols-2",
	3: "lg:grid-cols-3",
	4: "lg:grid-cols-4",
};

/**
 * Page masthead: what the page is, and beneath a hairline, the figures that
 * describe whatever it's currently showing. One card rather than a title card
 * over a row of tiles, so the page's own controls stay near the top.
 */
export function PageHeaderCard({
	title,
	description,
	stats = [],
	action,
	children,
}: {
	title: string;
	description: string;
	/** Omit for a title-only masthead; otherwise up to four figures. */
	stats?: PageHeaderStat[];
	/** A control for the page as a whole, set against the title. */
	action?: ReactNode;
	/** Unfolds beneath the figures -- what `action` opens, if anything. */
	children?: ReactNode;
}) {
	return (
		<section aria-label={title} className="feature-card rounded-md p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h1 className="display-title font-bold text-xl leading-tight">
						{title}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				</div>
				{action}
			</div>

			{stats.length > 0 && <PageHeaderStats stats={stats} />}
			{children}
		</section>
	);
}

/**
 * The masthead's figure row on its own, for cards that build their own heading
 * -- a species portrait, say -- but should still read as the same page header.
 */
export function PageHeaderStats({
	stats,
	className = "",
}: {
	stats: PageHeaderStat[];
	className?: string;
}) {
	const columns = COLUMN_CLASSES[Math.min(stats.length, 4)] ?? "lg:grid-cols-4";

	return (
		<dl
			className={`mt-4 grid grid-cols-2 gap-4 border-[var(--line)] border-t pt-4 ${columns} ${className}`}
		>
			{stats.map((stat) => (
				<Figure key={stat.label} {...stat} />
			))}
		</dl>
	);
}

function Figure({ label, value, icon: Icon }: PageHeaderStat) {
	return (
		<div className="flex items-center gap-4 overflow-hidden">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))] text-[var(--moss)]">
				<Icon aria-hidden="true" className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<dt className="island-kicker">{label}</dt>
				{/* One treatment for every value, number or string alike: sans,
				    tabular, text-xl. Floored at that line box so a figure that falls
				    back to a string -- an em dash on an empty period, say -- keeps the
				    masthead height stable and doesn't shift the page's controls up
				    under the cursor. */}
				<dd className="tabular-data mt-2 min-h-[1.75rem] truncate font-semibold text-xl leading-tight">
					{typeof value === "number" ? value.toLocaleString() : value}
				</dd>
			</div>
		</div>
	);
}
