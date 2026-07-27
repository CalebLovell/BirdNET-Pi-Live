import type { ComponentType, ReactNode } from "react";

export type PageHeaderStat = {
	label: string;
	value: string | number;
	detail?: string;
	hint?: string;
	icon: ComponentType<{ className?: string }>;
	/** Replaces the icon disc outright -- for a portrait or other artwork. */
	artwork?: ReactNode;
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
}: {
	title: string;
	description: string;
	/** Omit for a title-only masthead; otherwise up to four figures. */
	stats?: PageHeaderStat[];
}) {
	const columns = COLUMN_CLASSES[Math.min(stats.length, 4)] ?? "lg:grid-cols-4";

	return (
		<section aria-label={title} className="feature-card rounded-md p-4">
			<h1 className="display-title font-bold text-xl leading-tight">{title}</h1>
			<p className="mt-1 text-muted-foreground text-sm">{description}</p>

			{stats.length > 0 && (
				<dl
					className={`mt-4 grid grid-cols-2 gap-4 border-[var(--line)] border-t pt-4 ${columns}`}
				>
					{stats.map((stat) => (
						<Figure key={stat.label} {...stat} />
					))}
				</dl>
			)}
		</section>
	);
}

function Figure({
	label,
	value,
	detail,
	hint,
	icon: Icon,
	artwork,
}: PageHeaderStat) {
	return (
		<div className="flex items-center gap-4 overflow-hidden">
			{artwork ?? (
				<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sage)_30%,var(--paper-raised))]">
					<Icon aria-hidden="true" className="size-4 text-[var(--moss)]" />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<dt className="island-kicker" title={hint} aria-description={hint}>
					{label}
				</dt>
				<div className="mt-2 flex min-w-0 items-baseline gap-2">
					<dd
						className={
							typeof value === "number"
								? "tabular-data truncate font-semibold text-3xl leading-none"
								: "display-title truncate font-semibold text-xl leading-tight"
						}
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
