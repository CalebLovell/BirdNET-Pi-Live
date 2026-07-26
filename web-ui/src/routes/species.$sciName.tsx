import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Bird, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { z } from "zod";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesActions } from "~/components/species-actions.tsx";
import { Button } from "~/components/ui/button.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import { HEAT_COLORS, heatLevel } from "~/lib/heatmap.ts";
import {
	getSpeciesDetail,
	type RecentVisit,
	type SpeciesDetail,
} from "~/lib/species-detail.ts";
import { formatTimeAgo, hourLabel } from "~/lib/time-ago.ts";
import type { TrendPoint } from "~/lib/trend.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";

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

export const Route = createFileRoute("/species/$sciName")({
	validateSearch: speciesDetailSearchSchema,
	search: {
		middlewares: [stripSearchParams({ year: DEFAULT_YEAR })],
	},
	loaderDeps: ({ search }) => ({ year: search.year }),
	loader: ({ params, deps }) =>
		getSpeciesDetail({
			data: { sciNameSlug: params.sciName, year: deps.year },
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
	const end = new Date(lastDate);
	end.setDate(end.getDate() + (6 - end.getDay()));
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

const chartTooltipStyle = {
	contentStyle: {
		background: "var(--paper-raised)",
		border: "1px solid var(--line)",
		borderRadius: "var(--radius-sm)",
		color: "var(--ink)",
		fontSize: 13,
	},
	labelStyle: { color: "var(--ink)", fontWeight: 600 },
};

function BirdPage() {
	const detail = Route.useLoaderData();
	const { year } = Route.useSearch();
	const navigate = Route.useNavigate();
	// Before the early return: hooks cannot sit behind a conditional.
	const offsetMs = useAgeOffset(detail?.generatedAt ?? "");

	if (!detail) {
		return (
			<div className="page-wrap pt-4">
				<p className="mt-4 text-muted-foreground">
					No detections found for this species.
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

				<section
					aria-label="Detection history"
					className="feature-card mt-4 w-full overflow-hidden rounded-md p-3"
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
											{week.days.map(({ date, point }) => {
												const count = point?.count ?? 0;
												const dateLabel = date.toLocaleDateString([], {
													month: "short",
													day: "numeric",
													year: "numeric",
												});
												return (
													<Tooltip key={date.toISOString()}>
														<TooltipTrigger asChild>
															<div
																role="img"
																aria-label={`${dateLabel}: ${count} detections`}
																className="size-3 rounded-[3px] border border-[var(--line)] transition-[outline] hover:z-10 hover:outline hover:outline-2 hover:outline-[var(--hover-line)] hover:outline-offset-1"
																style={{
																	backgroundColor:
																		HEAT_COLORS[heatLevel(count, maximum)],
																}}
															/>
														</TooltipTrigger>
														<TooltipContent>
															{dateLabel} — {count}
														</TooltipContent>
													</Tooltip>
												);
											})}
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

				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<section
						aria-label="Daily activity"
						className="feature-card order-2 flex min-h-[420px] flex-col rounded-md p-3 lg:col-start-2 lg:row-start-1"
					>
						<div className="island-kicker">Daily activity</div>
						<div className="mt-4 min-h-0 flex-1">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={detail.hourActivity}>
									<defs>
										<linearGradient
											id="hourDensityFill"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop
												offset="0%"
												stopColor="var(--moss)"
												stopOpacity={0.2}
											/>
											<stop
												offset="100%"
												stopColor="var(--moss)"
												stopOpacity={0}
											/>
										</linearGradient>
									</defs>
									<CartesianGrid stroke="var(--line)" vertical={false} />
									<XAxis
										dataKey="hour"
										tickFormatter={(hour: number) => hourLabel(hour)}
										stroke="var(--muted-foreground)"
										fontSize={12}
										tickLine={false}
										interval={3}
									/>
									<YAxis
										stroke="var(--muted-foreground)"
										fontSize={12}
										tickLine={false}
										allowDecimals={false}
										width={32}
									/>
									<RechartsTooltip
										{...chartTooltipStyle}
										labelFormatter={(hour: React.ReactNode) =>
											hourLabel(Number(hour))
										}
										cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
									/>
									<Area
										dataKey="count"
										name="Detections"
										stroke="none"
										fill="url(#hourDensityFill)"
									/>
									<Line
										type="monotone"
										dataKey="count"
										name="Detections"
										stroke="var(--moss)"
										strokeWidth={2}
										dot={false}
										activeDot={{ r: 3, fill: "var(--moss)" }}
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</section>

					<RecentVisitsCard visits={detail.recentVisits} offsetMs={offsetMs} />
				</div>
			</div>
		</TooltipProvider>
	);
}

/**
 * Deliberately built on the Today page's hero card: same portrait column, the
 * same top-right actions slot, the same moss "how long ago" line over a metadata
 * row, and the same four-up stat grid. Only the data points differ -- this
 * card's clock runs from the species' last visit rather than from a live poll.
 */
function SummaryCard({
	detail,
	offsetMs,
}: {
	detail: SpeciesDetail;
	offsetMs: number;
}) {
	// The most recent visit is the same detection as `lastDetected`, and it is the
	// only one carrying a server-measured age, so the relative label agrees with
	// the visit log instead of drifting against it.
	const lastVisit = detail.recentVisits[0];

	return (
		<section
			aria-label="Species profile"
			className="feature-card mt-4 grid items-center gap-4 rounded-md p-4 sm:grid-cols-[12rem_minmax(0,1fr)]"
		>
			<div className="flex h-32 w-full shrink-0 items-center justify-center overflow-hidden sm:h-44">
				{detail.imageUrl ? (
					<img
						src={detail.imageUrl}
						alt={detail.comName}
						className="max-h-full max-w-44 object-contain"
					/>
				) : (
					<Bird className="size-16 text-muted-foreground" />
				)}
			</div>

			<div className="flex min-w-0 flex-col gap-2.5">
				{/* Title and actions share a line now that the kicker is gone, so the
				    column starts level with the top of the portrait. */}
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="display-title font-bold text-2xl">
							{detail.comName}
						</h1>
						<p className="text-[var(--bark)] text-xs italic">
							{detail.sciName}
						</p>
					</div>
					<SpeciesActions ebirdUrl={detail.ebirdUrl} comName={detail.comName} />
				</div>

				<div>
					<p className="font-semibold text-[var(--moss)] text-base">
						{lastVisit
							? formatTimeAgo(lastVisit.ageMs + offsetMs)
							: formatHeardDate(detail.lastDetected.date)}
					</p>
					<div className="tabular-data mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
						<span>
							last heard at {formatVisitTime(detail.lastDetected.time)}
						</span>
						<ConfidencePill confidence={detail.lastDetected.confidence} />
					</div>
				</div>

				<dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
					<Stat label="Total detections" value={detail.totalDetections} />
					<Stat
						label="Avg. confidence"
						value={formatConfidence(detail.averageConfidence)}
					/>
					<Stat
						label="First heard"
						value={formatHeardDate(detail.firstDetected.date)}
					/>
					<Stat
						label="Last heard"
						value={formatHeardDate(detail.lastDetected.date)}
					/>
				</dl>

				<BestRecordingFooter recording={detail.bestRecording} />
			</div>
		</section>
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

function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div>
			<dd className="tabular-data truncate font-semibold">{value}</dd>
			<dt className="text-muted-foreground text-xs">{label}</dt>
		</div>
	);
}

/**
 * Sits where the Today hero card keeps its "Updated" line -- a hairline footer
 * closing the card -- and plays through the shared RecordingButton so the
 * control reads the same here as it does in every detection row.
 */
function BestRecordingFooter({
	recording,
}: {
	recording: SpeciesDetail["bestRecording"];
}) {
	if (!recording) {
		return null;
	}

	return (
		<div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-[var(--line)] border-t pt-2">
			<div className="min-w-0">
				<span className="mr-2 font-semibold text-xs">Best recording</span>
				<span className="tabular-data text-[11px] text-muted-foreground">
					{formatHeardDate(recording.date)} · {formatVisitTime(recording.time)}{" "}
					· {formatConfidence(recording.confidence)} confidence
				</span>
			</div>
			<RecordingButton audioUrl={recording.audioUrl} />
		</div>
	);
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
			className="feature-card order-1 flex min-h-[420px] flex-col rounded-md p-4 lg:col-start-1 lg:row-start-1"
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
