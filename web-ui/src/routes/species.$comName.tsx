import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	CalendarDays,
	ChartNoAxesColumnIncreasing,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Gauge,
	Sunrise,
} from "lucide-react";
import { z } from "zod";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { DetectionsByHourCard } from "~/components/detections-by-hour-card.tsx";
import { DetectionsOverTimeCard } from "~/components/detections-over-time-card.tsx";
import type { PageHeaderStat } from "~/components/page-header-card.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesActions } from "~/components/species-actions.tsx";
import {
	HERO_CARD_SHELL,
	SpeciesHeroCard,
} from "~/components/species-hero-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import { HEAT_COLORS, heatLevel } from "~/lib/heatmap.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { pageTitle } from "~/lib/page-title.ts";
import {
	getSpeciesDetail,
	type RecentVisit,
	type SpeciesDetail,
} from "~/lib/species-detail.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import type { TrendPoint } from "~/lib/trend.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useFavicon } from "~/lib/use-favicon.ts";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2000;
const DEFAULT_YEAR = CURRENT_YEAR;

const speciesDetailSearchSchema = z.object({
	year: z.coerce
		.number()
		.int()
		.min(MIN_YEAR)
		.max(CURRENT_YEAR)
		.default(DEFAULT_YEAR)
		.catch(DEFAULT_YEAR),
});

export const Route = createFileRoute("/species/$comName")({
	validateSearch: speciesDetailSearchSchema,
	search: {
		middlewares: [stripSearchParams({ year: DEFAULT_YEAR })],
	},
	loaderDeps: ({ search }) => ({ year: search.year }),
	loader: ({ params, deps }) =>
		getSpeciesDetail({
			data: { comNameSlug: params.comName, year: deps.year },
		}),
	// The bird's own name, once the loader has resolved the slug. Until then --
	// and for a slug that matches nothing -- the section name stands in.
	head: ({ loaderData }) => ({
		meta: [{ title: pageTitle(loaderData?.comName ?? "Species") }],
	}),
	component: BirdPage,
});

type HeatMapWeek = {
	days: { date: Date; point: TrendPoint | null }[];
	monthLabel: string | null;
};

function dateForBucket(bucket: string): Date {
	return new Date(`${bucket.slice(0, 10)}T00:00:00`);
}

function bucketForDate(date: Date): string {
	const pad = (value: number) => value.toString().padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildHeatMap(history: TrendPoint[]): {
	weeks: HeatMapWeek[];
	maximum: number;
} {
	if (history.length === 0) return { weeks: [], maximum: 0 };

	const points = new Map(
		history.map((point) => [point.bucket.slice(0, 10), point]),
	);
	const firstDate = dateForBucket(history[0].bucket);
	const lastDate = dateForBucket(history[history.length - 1].bucket);
	const start = new Date(firstDate);
	start.setDate(start.getDate() - start.getDay());
	// The grid pads leftwards to a Sunday so the weekday rows line up, but it is
	// never padded past the trend's last bucket -- which is today for the current
	// year -- so no square ever stands for a day that hasn't happened.
	const end = lastDate;
	const weeks: HeatMapWeek[] = [];
	const seenMonths = new Set<string>();
	const maximum = Math.max(...history.map((point) => point.count), 0);

	for (
		const weekStart = new Date(start);
		weekStart <= end;
		weekStart.setDate(weekStart.getDate() + 7)
	) {
		const days: { date: Date; point: TrendPoint | null }[] = [];
		let monthLabel: string | null = null;
		for (let day = 0; day < 7; day += 1) {
			const date = new Date(weekStart);
			date.setDate(date.getDate() + day);
			if (date > end) break;
			const key = bucketForDate(date);
			days.push({ date, point: points.get(key) ?? null });
			const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
			if (date.getDate() <= 7 && !seenMonths.has(monthKey)) {
				monthLabel = date.toLocaleDateString([], { month: "short" });
				seenMonths.add(monthKey);
			}
		}
		weeks.push({ days, monthLabel });
	}

	return { weeks, maximum };
}

function BirdPage() {
	const detail = Route.useLoaderData();
	const { year } = Route.useSearch();
	const navigate = Route.useNavigate();
	// Before the early return: hooks cannot sit behind a conditional.
	const offsetMs = useAgeOffset(detail?.generatedAt ?? "");
	// The same flight illustration the hero draws, so the browser serves it from
	// cache rather than pulling a second half-megabyte PNG. The wings lose their
	// detail at 16px, but the silhouette still reads. Species without a bundled
	// illustration keep the nest.
	useFavicon(detail ? illustrationUrlFor(detail.sciName, "flight") : null);

	if (!detail) {
		return (
			<div className="page-wrap pt-4">
				<p className="mt-4 text-muted-foreground">
					No detections recorded for this species.
				</p>
			</div>
		);
	}

	const { weeks, maximum } = buildHeatMap(detail.history);
	const availableYears = [...detail.availableYears].sort((a, b) => a - b);
	const yearIndex = availableYears.indexOf(year);
	const previousYear = yearIndex > 0 ? availableYears[yearIndex - 1] : null;
	const nextYear =
		yearIndex >= 0 && yearIndex < availableYears.length - 1
			? availableYears[yearIndex + 1]
			: null;
	const showYearSelector = availableYears.length > 1;

	return (
		<TooltipProvider>
			<div className="page-wrap">
				<SummaryCard detail={detail} offsetMs={offsetMs} />

				<div className="mt-4">
					<section
						aria-label="Detection history"
						className="feature-card w-full overflow-hidden rounded-md p-4"
					>
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="island-kicker">Detection history</div>
							{showYearSelector ? (
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon-xs"
										disabled={previousYear === null}
										aria-label="Previous year"
										onClick={() =>
											navigate({
												search: (prev) => ({
													...prev,
													year: previousYear ?? year,
												}),
												replace: true,
											})
										}
									>
										<ChevronLeft className="size-3" />
									</Button>
									<div className="tabular-data min-w-12 text-center font-semibold text-sm">
										{year}
									</div>
									<Button
										variant="outline"
										size="icon-xs"
										disabled={nextYear === null}
										aria-label="Next year"
										onClick={() =>
											navigate({
												search: (prev) => ({ ...prev, year: nextYear ?? year }),
												replace: true,
											})
										}
									>
										<ChevronRight className="size-3" />
									</Button>
								</div>
							) : null}
						</div>

						<div className="mt-4 overflow-x-auto pb-1">
							<div className="w-full min-w-max">
								<div className="mb-1 ml-9 flex w-max gap-1">
									{weeks.map((week, index) => (
										<div
											key={`month-${index}`}
											className="w-3 shrink-0 whitespace-nowrap text-[10px] text-muted-foreground"
										>
											{week.monthLabel}
										</div>
									))}
								</div>
								<div className="flex gap-2">
									<div className="flex w-7 flex-col gap-1 text-[9px] text-muted-foreground leading-3">
										<span>Sun</span>
										<span>Mon</span>
										<span>Tue</span>
										<span>Wed</span>
										<span>Thu</span>
										<span>Fri</span>
										<span>Sat</span>
									</div>
									<div className="flex w-max gap-1">
										{weeks.map((week, weekIndex) => (
											<div
												key={`week-${weekIndex}`}
												className="flex shrink-0 flex-col gap-1"
											>
												{week.days.map(({ date, point }) => (
													<HeatMapDay
														key={date.toISOString()}
														date={date}
														point={point}
														maximum={maximum}
													/>
												))}
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
						<div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
							<span>Less</span>
							{HEAT_COLORS.map((color, index) => (
								<span
									key={`legend-${index}`}
									className="size-3 rounded-[3px] border border-[var(--line)]"
									style={{ backgroundColor: color }}
								/>
							))}
							<span>More</span>
						</div>
					</section>
				</div>

				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="order-2 grid gap-4 lg:order-1 lg:grid-rows-2">
						<DetectionsByHourCard
							activity={detail.hourActivity}
							className="lg:min-h-0"
						/>

						<DetectionsOverTimeCard
							trend={detail.detectionTrend}
							className="lg:min-h-0"
						/>
					</div>

					<RecentVisitsCard visits={detail.recentVisits} offsetMs={offsetMs} />
				</div>
			</div>
		</TooltipProvider>
	);
}

const SWATCH =
	"size-3 rounded-[3px] border border-[var(--line)] transition-[outline] hover:z-10 hover:outline hover:outline-2 hover:outline-[var(--hover-line)] hover:outline-offset-1";

/**
 * One square of the contribution grid. Days that actually recorded something
 * are links into that day's review; empty squares stay inert, since there is
 * nothing on the other side of them to read.
 */
function HeatMapDay({
	date,
	point,
	maximum,
}: {
	date: Date;
	point: TrendPoint | null;
	maximum: number;
}) {
	const count = point?.count ?? 0;
	const dateLabel = date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const label = `${dateLabel}: ${count} detections`;
	const fill = { backgroundColor: HEAT_COLORS[heatLevel(count, maximum)] };

	// Inside a link the swatch is decoration: the link already carries the label,
	// and repeating it would have a screen reader read the day twice.
	const swatch =
		count > 0 ? (
			<Link
				to="/day/$date"
				params={{ date: bucketForDate(date) }}
				aria-label={label}
				className="block"
			>
				<div aria-hidden="true" className={SWATCH} style={fill} />
			</Link>
		) : (
			<div role="img" aria-label={label} className={SWATCH} style={fill} />
		);

	return (
		<Tooltip>
			<TooltipTrigger asChild>{swatch}</TooltipTrigger>
			<TooltipContent>
				{dateLabel} — {count}
				{count > 0 ? " · view this day" : null}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * The Today page's hero card with this species' figures in it -- same shell,
 * same portrait column, same lines. Only the data differs: this card's clock
 * runs from the species' last visit rather than from a live poll.
 */
function SummaryCard({
	detail,
	offsetMs,
}: {
	detail: SpeciesDetail;
	offsetMs: number;
}) {
	// The most recent visit is the same detection as `lastDetected`, and it is the
	// only one carrying a server-measured age and a clip, so the relative label
	// and the recording both agree with the visit log instead of drifting.
	const lastVisit = detail.recentVisits[0];

	const stats = [
		{
			label: "Total detections",
			value: detail.totalDetections,
			icon: ChartNoAxesColumnIncreasing,
		},
		{
			label: "Avg. confidence",
			value: formatConfidence(detail.averageConfidence),
			icon: Gauge,
		},
		{
			label: "First heard",
			value: formatHeardDate(detail.firstDetected.date),
			icon: Sunrise,
		},
		{
			label: "Last heard",
			value: formatHeardDate(detail.lastDetected.date),
			icon: CalendarDays,
		},
	] satisfies PageHeaderStat[];

	return (
		<SpeciesHeroCard
			label="Species profile"
			comName={detail.comName}
			sciName={detail.sciName}
			imageUrl={detail.imageUrl}
			relativeTime={
				lastVisit
					? formatTimeAgo(lastVisit.ageMs + offsetMs)
					: formatHeardDate(detail.lastDetected.date)
			}
			clockTime={formatVisitTime(detail.lastDetected.time)}
			confidence={detail.lastDetected.confidence}
			audioUrl={lastVisit?.audioUrl ?? null}
			stats={stats}
			actions={
				<SpeciesActions ebirdUrl={detail.ebirdUrl} comName={detail.comName} />
			}
			className={`${HERO_CARD_SHELL} mt-4`}
		/>
	);
}

function formatHeardDate(date: string): string {
	if (!date) return "—";

	return new Date(`${date}T00:00:00`).toLocaleDateString([], {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatVisitTime(time: string): string {
	return new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

function RecentVisitsCard({
	visits,
	offsetMs,
}: {
	visits: RecentVisit[];
	offsetMs: number;
}) {
	return (
		<section
			aria-label="Visit log"
			className="feature-card order-1 flex min-h-[420px] flex-col rounded-md p-4 lg:order-2"
		>
			<div className="island-kicker">Visit log</div>

			{visits.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">
					No visits recorded yet.
				</p>
			) : (
				<ul className="mt-4 space-y-1">
					{visits.map((visit) => {
						const date = new Date(`${visit.date}T00:00:00`);
						const dateLabel = date.toLocaleDateString([], {
							month: "long",
							day: "numeric",
							year: "numeric",
						});
						const time = formatVisitTime(visit.time);

						return (
							<li
								key={`${visit.date}-${visit.time}`}
								aria-label={`${dateLabel} at ${time}${visit.confidence != null ? `, ${formatConfidence(visit.confidence)} confidence` : ""}`}
								className="flex items-center gap-3 rounded-md px-3 py-2.5 odd:bg-[var(--meadow)] even:bg-transparent"
							>
								<div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
									<Clock3 className="size-3.5 shrink-0 text-[var(--bark)]" />
									<time dateTime={visit.date} className="truncate font-medium">
										{dateLabel}
									</time>
								</div>

								<div className="shrink-0 text-right">
									<div className="tabular-data text-sm">{time}</div>
									<div className="text-muted-foreground text-xs">
										{formatTimeAgo(visit.ageMs + offsetMs)}
									</div>
								</div>

								<ConfidencePill
									confidence={visit.confidence}
									className="shrink-0"
								/>
								<RecordingButton audioUrl={visit.audioUrl ?? null} />
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
