import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Bird,
	ChevronLeft,
	ChevronRight,
	Sparkles,
	Sunrise,
	Sunset,
} from "lucide-react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { DetectionsByHourCard } from "~/components/detections-by-hour-card.tsx";
import { EmptyState } from "~/components/empty-state.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesByHourCard } from "~/components/species-by-hour-card.tsx";
import { LIST_ROW, SpeciesThumbnail } from "~/components/species-row.tsx";
import { StatusPage } from "~/components/status-page.tsx";
import { Button } from "~/components/ui/button.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { useShareCard } from "~/components/use-share-card.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import {
	DAY_PATTERN,
	type DayMoment,
	type DayReview,
	type DaySpeciesRow,
	type DayStanding,
	getDayPage,
} from "~/lib/day.ts";
import { getDayShareCard } from "~/lib/day-share.ts";
import { ordinal } from "~/lib/number-format.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import { rankingBarPercent } from "~/lib/stats-data.ts";
import { hourLabel } from "~/lib/time-ago.ts";

export const Route = createFileRoute("/day/$date")({
	loader: ({ params }) => getDayPage({ data: params.date }),
	// Reads off the param rather than the loader so the tab is right before the
	// day's data lands. A parameter that is not even shaped like a date falls
	// back to the section name, matching what the page itself will show.
	head: ({ params }) => ({
		meta: [
			{
				title: pageTitle(
					DAY_PATTERN.test(params.date) ? formatDayTitle(params.date) : "Day",
				),
			},
		],
	}),
	component: DayPage,
});

function formatDayTitle(date: string): string {
	return new Date(`${date}T00:00:00`).toLocaleDateString([], {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function formatTime(time: string): string {
	return new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

const DAY_SECTION = "Day in review";
const DAY_SECTION_DESCRIPTION = "One day at this station, hour by hour.";

function DayPage() {
	const result = Route.useLoaderData();
	const { date } = Route.useParams();

	switch (result.status) {
		case "malformed":
			return (
				<StatusPage
					section={DAY_SECTION}
					sectionDescription={DAY_SECTION_DESCRIPTION}
					tone="missing"
					title="That isn't a date"
				>
					“{date}” isn’t a valid date. Dates look like 2025-04-19.
				</StatusPage>
			);
		case "future":
			return (
				<StatusPage
					section={DAY_SECTION}
					sectionDescription={DAY_SECTION_DESCRIPTION}
					tone="missing"
					title="That day hasn't happened yet"
				>
					{formatDayTitle(date)} is still ahead. There is nothing to review
					until the station has heard it.
				</StatusPage>
			);
		case "before-station":
			return (
				<StatusPage
					section={DAY_SECTION}
					sectionDescription={DAY_SECTION_DESCRIPTION}
					tone="missing"
					title="Before this station started listening"
				>
					{formatDayTitle(date)} predates the first recording. This station has
					been listening since {formatDayTitle(result.firstRecorded)}.
				</StatusPage>
			);
	}

	const day = result.day;

	return (
		<TooltipProvider>
			<div className="page-wrap py-4">
				<DayHeader day={day} />

				{day.summary.detections === 0 ? (
					<QuietDay day={day} />
				) : (
					<>
						<DaySummaryStrip day={day} />

						{/* The species list runs as long as the day was varied, so the
						    right column is pinned rather than stretched: the chart keeps
						    its own proportions and stays in view while the list scrolls
						    past it. */}
						<div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
							<SpeciesHeardCard species={day.species} />
							<div className="grid gap-4 lg:sticky lg:top-4">
								<DetectionsByHourCard activity={day.hourActivity} />
								<BookendsCard summary={day.summary} />
							</div>
						</div>

						<SpeciesByHourCard
							rows={day.species.map((row) => ({
								comName: row.comName,
								imageUrl: row.imageUrl,
								hourCounts: row.hourCounts,
								totalDetections: row.count,
								isNew: row.isFirstEver,
							}))}
							newLabel={formatDayTitle(day.date)}
							emptyMessage="No species heard on this day."
							className="mt-4"
						/>

						<BestRecordingsCard recordings={day.bestRecordings} />
					</>
				)}
			</div>
		</TooltipProvider>
	);
}

/**
 * Built like the species page's summary card: the title block on the left, the
 * paging controls where that page keeps its year stepper, and the moss-coloured
 * line carrying the one sentence that places the day among all the others.
 */
function DayHeader({ day }: { day: DayReview }) {
	return (
		<section
			aria-label="Day"
			className="feature-card flex flex-wrap items-center justify-between gap-4 rounded-md p-4"
		>
			<div className="min-w-0">
				<div className="island-kicker">Day in review</div>
				<h1 className="display-title mt-1 font-bold text-2xl">
					{formatDayTitle(day.date)}
				</h1>
				<p className="mt-0.5 font-semibold text-[var(--moss)] text-sm">
					{day.relativeLabel}
					{day.standing ? ` · ${standingLabel(day.standing, day)}` : null}
				</p>
			</div>

			<div className="flex items-center gap-2">
				<DayStepButton
					date={day.previousDate}
					label="Previous day with detections"
				>
					<ChevronLeft />
				</DayStepButton>
				<DayStepButton date={day.nextDate} label="Next day with detections">
					<ChevronRight />
				</DayStepButton>
			</div>
		</section>
	);
}

function DayStepButton({
	date,
	label,
	children,
}: {
	date: string | null;
	label: string;
	children: React.ReactNode;
}) {
	if (!date) {
		return (
			<Button variant="outline" size="icon-xs" disabled aria-label={label}>
				{children}
			</Button>
		);
	}

	return (
		<Button variant="outline" size="icon-xs" asChild aria-label={label}>
			<Link to="/day/$date" params={{ date }} aria-label={label}>
				{children}
			</Link>
		</Button>
	);
}

/**
 * "2nd busiest day on record" when the day stands out, otherwise how it
 * measured against a typical day here -- the comparison a person actually
 * wants when they land on a single date out of a year of them.
 */
function standingLabel(standing: DayStanding, day: DayReview): string {
	if (standing.rank === 1) return "busiest day on record";
	if (standing.rank <= 5) {
		return `${ordinal(standing.rank)} busiest of ${standing.daysRecorded.toLocaleString()} days`;
	}

	const average = standing.averageDetections;
	if (average <= 0) return `${ordinal(standing.rank)} busiest day on record`;

	const delta = Math.round(
		((day.summary.detections - average) / average) * 100,
	);
	if (Math.abs(delta) < 10) return "about as busy as a typical day";
	return delta > 0
		? `${delta}% busier than a typical day`
		: `${Math.abs(delta)}% quieter than a typical day`;
}

function QuietDay({ day }: { day: DayReview }) {
	return (
		<EmptyState icon={Bird} title="No detections recorded on this day.">
			{day.previousDate
				? "Step back to the last day with detections."
				: "There are no earlier recordings either."}
		</EmptyState>
	);
}

function DaySummaryStrip({ day }: { day: DayReview }) {
	const { summary, standing } = day;
	// Named by date so paging to another day replaces the summary it holds
	// instead of leaving yesterday's card behind the button.
	const share = useShareCard({
		subject: day.date,
		load: () => getDayShareCard({ data: day.date }).then(formatShareCard),
	});

	return (
		<section
			aria-label="Day totals"
			className="feature-card mt-4 rounded-md p-4"
		>
			<div className="flex items-center justify-between gap-3">
				<div className="island-kicker">The day in numbers</div>
				{share.trigger}
			</div>
			<dl className="mt-4 grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-[var(--line)]">
				<Figure
					value={summary.species}
					label="Species"
					detail={
						standing
							? `typical day: ${Math.round(standing.averageSpecies)}`
							: undefined
					}
				/>
				<Figure
					value={summary.detections}
					label="Detections"
					detail={
						standing
							? `typical day: ${Math.round(standing.averageDetections).toLocaleString()}`
							: undefined
					}
				/>
				<Figure
					value={summary.visits}
					label="Visits"
					hint="Detection runs separated by 15+ minutes of silence"
				/>
				<Figure
					value={
						summary.busiestHour ? hourLabel(summary.busiestHour.hour) : "—"
					}
					label="Busiest hour"
					detail={
						summary.busiestHour
							? `${summary.busiestHour.count.toLocaleString()} detections`
							: undefined
					}
				/>
			</dl>

			{share.summary}
		</section>
	);
}

function Figure({
	value,
	label,
	detail,
	hint,
}: {
	value: string | number;
	label: string;
	detail?: string;
	hint?: string;
}) {
	return (
		<div className="sm:px-6 sm:last:pr-0 sm:first:pl-0">
			<dd className="tabular-data display-title font-semibold text-3xl sm:text-4xl">
				{typeof value === "number" ? value.toLocaleString() : value}
			</dd>
			<dt
				className="mt-1 text-muted-foreground text-sm"
				title={hint}
				aria-description={hint}
			>
				{label}
			</dt>
			{detail && (
				<div className="tabular-data text-muted-foreground text-xs">
					{detail}
				</div>
			)}
		</div>
	);
}

/**
 * The ranked list of everything heard, scaled against the day's leader the same
 * way SpeciesList scales its bars -- but carrying the per-day detail (first
 * and last heard, visits, a "new species" flag) that only makes sense here.
 */
function SpeciesHeardCard({ species }: { species: DaySpeciesRow[] }) {
	const leader = species[0]?.count ?? 0;

	return (
		<section
			aria-label="Species heard"
			className="feature-card flex flex-col rounded-md p-4"
		>
			<div className="flex items-baseline justify-between gap-2">
				<div className="island-kicker">Species heard</div>
				<span className="tabular-data text-muted-foreground text-xs">
					{species.length}
				</span>
			</div>

			<ol className="mt-4 space-y-1">
				{species.map((row) => (
					<li key={row.comName} className={LIST_ROW}>
						<SpeciesThumbnail imageUrl={row.imageUrl} comName={row.comName} />

						<div className="min-w-0 flex-1">
							<div className="flex items-baseline justify-between gap-2">
								<div className="flex min-w-0 items-baseline gap-2">
									<Link
										to="/species/$comName"
										params={{ comName: row.speciesSlug }}
										className="truncate font-medium no-underline hover:underline"
									>
										{row.comName}
									</Link>
									<FirstHeardBadge row={row} />
								</div>
								<span className="tabular-data shrink-0 font-semibold text-sm">
									{row.count.toLocaleString()}
								</span>
							</div>
							<div className="tabular-data truncate text-muted-foreground text-xs">
								{formatTime(row.firstTime)} – {formatTime(row.lastTime)} ·{" "}
								{row.visits} {row.visits === 1 ? "visit" : "visits"} ·{" "}
								{formatConfidence(row.averageConfidence)} avg
							</div>
							<div
								className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--track)]"
								role="img"
								aria-label={`${row.count} detections`}
							>
								<div
									className="h-full rounded-full"
									style={{
										width: `${rankingBarPercent(row.count, leader)}%`,
										backgroundColor: "var(--moss)",
										opacity: 0.75,
									}}
								/>
							</div>
						</div>

						<RecordingButton audioUrl={row.bestRecording.audioUrl} iconOnly />
					</li>
				))}
			</ol>
		</section>
	);
}

function FirstHeardBadge({ row }: { row: DaySpeciesRow }) {
	if (!row.isFirstEver && !row.isFirstThisYear) return null;

	const label = row.isFirstEver ? "First ever" : "First this year";

	return (
		<span
			className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
			style={{
				backgroundColor:
					"color-mix(in oklab, var(--sand) 22%, var(--paper-raised))",
				color: "var(--bark)",
			}}
		>
			<Sparkles className="size-2.5" />
			{label}
		</span>
	);
}

/** How the day opened and how it closed -- the two moments a log can't show. */
function BookendsCard({ summary }: { summary: DayReview["summary"] }) {
	return (
		<section
			aria-label="First and last bird"
			className="feature-card rounded-md p-4"
		>
			<div className="island-kicker">First and last</div>
			<div className="mt-4 grid gap-1 sm:grid-cols-2">
				<Bookend icon={Sunrise} label="First bird" moment={summary.firstBird} />
				<Bookend icon={Sunset} label="Last bird" moment={summary.lastBird} />
			</div>
		</section>
	);
}

function Bookend({
	icon: Icon,
	label,
	moment,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	moment: DayMoment | null;
}) {
	if (!moment) {
		return (
			<div className="rounded-md px-3 py-2 text-muted-foreground text-sm">
				{label}: —
			</div>
		);
	}

	return (
		<div className="flex items-center gap-3 rounded-md bg-[var(--meadow)] px-3 py-2">
			<SpeciesThumbnail imageUrl={moment.imageUrl} comName={moment.comName} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
					<Icon className="size-3 text-[var(--bark)]" />
					{label}
				</div>
				<Link
					to="/species/$comName"
					params={{ comName: moment.speciesSlug }}
					className="block truncate font-medium no-underline hover:underline"
				>
					{moment.comName}
				</Link>
				<div className="tabular-data text-muted-foreground text-xs">
					{formatTime(moment.time)}
				</div>
			</div>
			<RecordingButton audioUrl={moment.audioUrl} iconOnly />
		</div>
	);
}

function BestRecordingsCard({
	recordings,
}: {
	recordings: DayReview["bestRecordings"];
}) {
	if (recordings.length === 0) return null;

	return (
		<section
			aria-label="Best recordings"
			className="feature-card mt-4 rounded-md p-4"
		>
			<div className="island-kicker">Best recordings</div>

			<ul className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{recordings.map((recording) => (
					<li
						key={`${recording.comName}-${recording.time}`}
						// min-w-0: grid items default to min-width:auto, which would stop
						// the name column shrinking and push the row past the card edge.
						className="flex min-h-16 min-w-0 items-center gap-3 rounded-md bg-[var(--meadow)] px-3 py-2"
					>
						<SpeciesThumbnail
							imageUrl={recording.imageUrl}
							comName={recording.comName}
						/>
						<div className="min-w-0 flex-1">
							<Link
								to="/species/$comName"
								params={{ comName: recording.speciesSlug }}
								className="block truncate font-medium no-underline hover:underline"
							>
								{recording.comName}
							</Link>
							<div className="tabular-data text-muted-foreground text-xs">
								{formatTime(recording.time)}
							</div>
						</div>
						<ConfidencePill
							confidence={recording.confidence}
							className="shrink-0"
						/>
						<RecordingButton audioUrl={recording.audioUrl} iconOnly />
					</li>
				))}
			</ul>
		</section>
	);
}
