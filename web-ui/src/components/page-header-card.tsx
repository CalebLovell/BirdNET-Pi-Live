export type PageHeaderStat = {
	label: string;
	value: string | number;
	detail?: string;
	hint?: string;
};

/**
 * Compact page masthead: what the page is, plus the figures that describe
 * whatever it's currently showing. Deliberately lighter than the Today
 * summary strip so the page's own controls stay near the top.
 */
export function PageHeaderCard({
	title,
	description,
	stats,
}: {
	title: string;
	description: string;
	stats: PageHeaderStat[];
}) {
	return (
		<section
			aria-label={title}
			className="feature-card flex flex-col gap-4 rounded-md p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
		>
			<div className="min-w-0">
				<h1 className="display-title font-bold text-xl leading-tight">
					{title}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">{description}</p>
			</div>

			<dl className="flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8 lg:shrink-0 lg:justify-end">
				{stats.map((stat) => (
					<Figure key={stat.label} {...stat} />
				))}
			</dl>
		</section>
	);
}

function Figure({ label, value, detail, hint }: PageHeaderStat) {
	return (
		<div className="min-w-0">
			<dd className="tabular-data display-title font-semibold text-xl leading-none">
				{typeof value === "number" ? value.toLocaleString() : value}
			</dd>
			<dt
				className="mt-1.5 text-muted-foreground text-xs"
				title={hint}
				aria-description={hint}
			>
				{label}
			</dt>
			{detail && (
				<div className="tabular-data text-[10px] text-muted-foreground/70">
					{detail}
				</div>
			)}
		</div>
	);
}
