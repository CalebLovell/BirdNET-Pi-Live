import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	Binoculars,
	Bird,
	BookOpen,
	CalendarDays,
	CalendarRange,
	Clock,
	Infinity as InfinityIcon,
	Loader2,
	Pause,
	Play,
} from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { z } from "zod";

import { Button } from "#/components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group.tsx";
import {
	getSpeciesDetail,
	type SpeciesDetail,
	type Visit,
} from "#/lib/species-detail.ts";
import {
	STATS_PERIOD_LABELS,
	STATS_PERIODS,
	type StatsPeriod,
} from "#/lib/stats-periods.ts";
import { usePlayableAudio } from "#/lib/use-playable-audio.ts";

const DEFAULT_PERIOD: StatsPeriod = "week";

const speciesDetailSearchSchema = z.object({
	period: z.enum(STATS_PERIODS).default(DEFAULT_PERIOD).catch(DEFAULT_PERIOD),
});

export const Route = createFileRoute("/species/$sciName")({
	validateSearch: speciesDetailSearchSchema,
	search: {
		middlewares: [stripSearchParams({ period: DEFAULT_PERIOD })],
	},
	loaderDeps: ({ search }) => ({ period: search.period }),
	loader: ({ params, deps }) =>
		getSpeciesDetail({
			data: { sciNameSlug: params.sciName, period: deps.period },
		}),
	component: BirdPage,
});

const PERIOD_ICONS: Record<
	StatsPeriod,
	React.ComponentType<{ className?: string }>
> = {
	day: Clock,
	week: CalendarDays,
	month: CalendarRange,
	all: InfinityIcon,
};

function formatConfidence(confidence: number | null): string {
	return confidence != null ? `${Math.round(confidence * 100)}%` : "—";
}

function hourLabel(hour: number): string {
	if (hour === 0) return "12a";
	if (hour < 12) return `${hour}a`;
	if (hour === 12) return "12p";
	return `${hour - 12}p`;
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
	const { period } = Route.useSearch();
	const navigate = Route.useNavigate();

	if (!detail) {
		return (
			<div className="page-wrap py-4">
				<Link
					to="/species"
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="size-4" />
					Back to Species
				</Link>
				<p className="mt-4 text-muted-foreground">
					No detections found for this species.
				</p>
			</div>
		);
	}

	return (
		<div className="page-wrap py-4">
			<Link
				to="/species"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				Back to Species
			</Link>

			<SummaryCard detail={detail} />

			<div className="mt-4 flex flex-wrap items-center justify-between gap-4">
				<h2 className="display-title text-xl font-semibold">
					Detection history
				</h2>
				<ToggleGroup
					type="single"
					variant="outline"
					value={period}
					onValueChange={(value) => {
						if (!value) return;
						navigate({
							search: (prev) => ({ ...prev, period: value as StatsPeriod }),
						});
					}}
				>
					{STATS_PERIODS.map((p) => {
						const Icon = PERIOD_ICONS[p];
						return (
							<ToggleGroupItem key={p} value={p}>
								<Icon className="size-4" />
								{STATS_PERIOD_LABELS[p]}
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			</div>
			<div className="feature-card mt-4 rounded-md p-4">
				<ResponsiveContainer width="100%" height={260}>
					<AreaChart data={detail.history}>
						<defs>
							<linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--moss)" stopOpacity={0.35} />
								<stop offset="100%" stopColor="var(--moss)" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid stroke="var(--line)" vertical={false} />
						<XAxis
							dataKey="label"
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
						/>
						<YAxis
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
							allowDecimals={false}
							width={32}
						/>
						<Tooltip {...chartTooltipStyle} />
						<Area
							type="monotone"
							dataKey="count"
							name="Detections"
							stroke="var(--moss)"
							strokeWidth={2}
							fill="url(#historyFill)"
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<h2 className="display-title text-xl font-semibold">
						Activity by hour
					</h2>
					<div className="feature-card mt-4 rounded-md p-4">
						<ResponsiveContainer width="100%" height={280}>
							<BarChart data={detail.hourActivity}>
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
								<Tooltip
									{...chartTooltipStyle}
									labelFormatter={(hour: React.ReactNode) => `${hour}:00`}
									cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
								/>
								<Bar
									dataKey="count"
									name="Detections"
									fill="var(--moss)"
									radius={[3, 3, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<div>
						<h2 className="display-title text-xl font-semibold">
							Best recording
						</h2>
						<BestRecordingCard detail={detail} />
					</div>

					<div>
						<h2 className="display-title text-xl font-semibold">
							Recent visits
						</h2>
						<RecentVisitsCard visits={detail.recentVisits} />
					</div>
				</div>
			</div>
		</div>
	);
}

function SummaryCard({ detail }: { detail: SpeciesDetail }) {
	const {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay,
		onPause,
		onEnded,
	} = usePlayableAudio(detail.latestAudioUrl);

	return (
		<div className="feature-card mt-4 flex flex-col gap-4 rounded-md p-4 sm:flex-row sm:items-center">
			<div className="flex h-48 w-full shrink-0 items-center justify-center overflow-hidden sm:w-56">
				{detail.imageUrl ? (
					<img
						src={detail.imageUrl}
						alt={detail.comName}
						className="max-h-full max-w-50 object-contain"
					/>
				) : (
					<Bird className="size-16 text-muted-foreground" />
				)}
			</div>

			<div className="flex-1">
				<h1 className="display-title text-3xl font-bold">{detail.comName}</h1>
				<p className="text-lg text-muted-foreground italic">{detail.sciName}</p>

				<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
					<Stat label="Total detections" value={detail.totalDetections} />
					<Stat label="Days active" value={detail.daysActive} />
					<Stat
						label="Avg. confidence"
						value={formatConfidence(detail.averageConfidence)}
					/>
					<Stat label="First heard" value={detail.firstDetected.date || "—"} />
					<Stat label="Last heard" value={detail.lastDetected.date || "—"} />
				</div>

				<div className="mt-5 flex flex-wrap items-center gap-2">
					<Button
						variant="default"
						size="xs"
						disabled={!detail.latestAudioUrl || isLoading}
						onClick={togglePlay}
						aria-label={
							isPlaying
								? `Pause ${detail.comName} call`
								: `Play ${detail.comName} call`
						}
					>
						{isLoading ? (
							<Loader2 className="size-3 animate-spin" />
						) : isPlaying ? (
							<Pause className="size-3" />
						) : (
							<Play className="size-3" />
						)}
						{isPlaying ? "Pause" : "Play"}
					</Button>
					<Button variant="outline" size="xs" asChild>
						<a
							href={detail.wikipediaUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={`${detail.comName} on Wikipedia`}
						>
							<BookOpen className="size-3" />
							Wiki
						</a>
					</Button>
					<Button variant="outline" size="xs" asChild>
						<a
							href={detail.ebirdUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={`${detail.comName} on eBird`}
						>
							<Binoculars className="size-3" />
							eBird
						</a>
					</Button>
					{detail.latestAudioUrl && (
						<audio
							ref={audioRef}
							preload="none"
							onPlay={onPlay}
							onPause={onPause}
							onEnded={onEnded}
						>
							<track kind="captions" />
						</audio>
					)}
				</div>
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div>
			<div
				className={
					typeof value === "number"
						? "tabular-data font-semibold"
						: "tabular-data truncate font-semibold"
				}
			>
				{value}
			</div>
			<div className="text-xs text-muted-foreground">{label}</div>
		</div>
	);
}

function BestRecordingCard({ detail }: { detail: SpeciesDetail }) {
	const recording = detail.bestRecording;
	const {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay,
		onPause,
		onEnded,
	} = usePlayableAudio(recording?.audioUrl ?? null);

	if (!recording) {
		return (
			<div className="feature-card mt-4 rounded-md p-4 text-sm text-muted-foreground">
				No recordings available.
			</div>
		);
	}

	return (
		<div className="feature-card mt-4 flex items-center gap-4 rounded-md p-4">
			<Button
				variant="default"
				size="sm"
				disabled={!recording.audioUrl || isLoading}
				onClick={togglePlay}
				aria-label={isPlaying ? "Pause best recording" : "Play best recording"}
			>
				{isLoading ? (
					<Loader2 className="size-4 animate-spin" />
				) : isPlaying ? (
					<Pause className="size-4" />
				) : (
					<Play className="size-4" />
				)}
				{isPlaying ? "Pause" : "Play"}
			</Button>
			<div>
				<div className="tabular-data text-xl font-semibold">
					{formatConfidence(recording.confidence)} confidence
				</div>
				<div className="tabular-data text-sm text-muted-foreground">
					{recording.date} {recording.time}
				</div>
			</div>
			{recording.audioUrl && (
				<audio
					ref={audioRef}
					preload="none"
					onPlay={onPlay}
					onPause={onPause}
					onEnded={onEnded}
				>
					<track kind="captions" />
				</audio>
			)}
		</div>
	);
}

function RecentVisitsCard({ visits }: { visits: Visit[] }) {
	if (visits.length === 0) {
		return (
			<div className="feature-card mt-4 rounded-md p-4 text-sm text-muted-foreground">
				No visits recorded yet.
			</div>
		);
	}

	return (
		<div className="feature-card mt-4 rounded-md p-2">
			<ul className="divide-y divide-[var(--line)]">
				{visits.map((v) => (
					<li
						key={`${v.date}-${v.time}`}
						className="flex items-center justify-between gap-4 px-3 py-2"
					>
						<div className="tabular-data text-sm">
							{v.date} {v.time}
						</div>
						{v.confidence != null && (
							<div className="tabular-data text-sm text-muted-foreground">
								{formatConfidence(v.confidence)}
							</div>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}
