import type { ComponentType, ReactNode } from "react";

/**
 * How a figure is doing, for the few that describe a state rather than just
 * count something. `ok` is deliberately identical to an untoned figure: a
 * masthead where every healthy reading shouts in green is one nobody scans, so
 * only the readings that want attention look different.
 */
export type StatTone = "ok" | "warn" | "problem" | "unknown";

export type PageHeaderStat = {
	label: string;
	value: string | number;
	detail?: string;
	hint?: string;
	icon: ComponentType<{ className?: string }>;
	/** Replaces the icon disc outright -- for a portrait or other artwork. */
	artwork?: ReactNode;
	/** Omit for a plain figure, which is what most of them are. */
	tone?: StatTone;
};

const TONE_DISC: Record<StatTone, string> = {
	ok: "bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))] text-[var(--moss)]",
	warn: "bg-[color-mix(in_oklab,var(--sand)_35%,var(--paper-raised))] text-[var(--bark)]",
	problem:
		"bg-[color-mix(in_oklab,var(--clay)_25%,var(--paper-raised))] text-destructive",
	unknown: "bg-muted text-muted-foreground",
};

const TONE_VALUE: Record<StatTone, string> = {
	ok: "",
	warn: "text-[var(--bark)]",
	problem: "text-destructive",
	unknown: "text-muted-foreground",
};

/** Spoken in place of the colour, which is the only other thing carrying it. */
const TONE_SPOKEN: Record<StatTone, string> = {
	ok: "healthy",
	warn: "needs attention",
	problem: "problem",
	unknown: "unknown",
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

function Figure({
	label,
	value,
	detail,
	hint,
	icon: Icon,
	artwork,
	tone,
}: PageHeaderStat) {
	return (
		<div className="flex items-center gap-4 overflow-hidden">
			{artwork ?? (
				<div
					className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE_DISC[tone ?? "ok"]}`}
				>
					<Icon aria-hidden="true" className="size-4" />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<dt className="island-kicker" title={hint} aria-description={hint}>
					{label}
					{/* Colour is the only other thing saying this, so it is also said. */}
					{tone ? <span className="sr-only">: {TONE_SPOKEN[tone]}</span> : null}
				</dt>
				{/* Floored at the numeric line box (text-3xl/none) so a figure that
				    falls back to a string -- an em dash on an empty period, say --
				    doesn't shorten the masthead and shift the page's controls up
				    under the cursor. */}
				<div className="mt-2 flex min-h-[1.875rem] min-w-0 items-baseline gap-2">
					<dd
						className={`${
							typeof value === "number"
								? "tabular-data truncate font-semibold text-3xl leading-none"
								: "display-title truncate font-semibold text-xl leading-tight"
						} ${TONE_VALUE[tone ?? "ok"]}`}
					>
						{typeof value === "number" ? value.toLocaleString() : value}
					</dd>
					{detail ? (
						<div className="tabular-data hidden shrink-0 truncate text-[10px] text-muted-foreground sm:block">
							{detail}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
