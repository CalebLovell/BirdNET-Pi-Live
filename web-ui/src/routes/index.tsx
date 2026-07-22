import { createFileRoute } from "@tanstack/react-router";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { getDetectionStats, getRecentDetections } from "#/lib/detections.ts";

export const Route = createFileRoute("/")({
	component: Home,
	loader: async () => {
		const [stats, recent] = await Promise.all([
			getDetectionStats(),
			getRecentDetections(),
		]);
		return { stats, recent };
	},
});

function Home() {
	const { stats, recent } = Route.useLoaderData();

	return (
		<div className="page-wrap py-8">
			<h1 className="display-title text-3xl font-semibold">
				What's singing right now
			</h1>
			<p className="mt-2 text-muted-foreground">
				Live detections from your BirdNET-Pi station.
			</p>

			<div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<StatCard label="Total detections" value={stats.total} />
				<StatCard label="Today's detections" value={stats.today} />
				<StatCard label="Last hour" value={stats.lastHour} />
				<StatCard label="Today's species" value={stats.speciesToday} />
				<StatCard label="All-time species" value={stats.speciesAllTime} />
			</div>

			<h2 className="display-title mt-10 text-xl font-semibold">
				Recent detections
			</h2>
			<div className="feature-card mt-4 rounded-lg p-2">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Time</TableHead>
							<TableHead>Species</TableHead>
							<TableHead>Scientific name</TableHead>
							<TableHead className="text-right">Confidence</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{recent.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-muted-foreground">
									No detections yet. Once BirdNET-Pi's analysis pipeline writes
									to birds.db, they'll show up here.
								</TableCell>
							</TableRow>
						) : (
							recent.map((detection) => (
								<TableRow
									key={`${detection.Date}-${detection.Time}-${detection.File_Name}`}
								>
									<TableCell className="tabular-data">
										{detection.Date} {detection.Time}
									</TableCell>
									<TableCell>{detection.Com_Name}</TableCell>
									<TableCell className="italic">{detection.Sci_Name}</TableCell>
									<TableCell className="tabular-data text-right">
										{detection.Confidence == null
											? "—"
											: `${Math.round(detection.Confidence * 100)}%`}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<Card className="feature-card">
			<CardHeader>
				<CardTitle className="tabular-data text-3xl font-semibold">
					{value}
				</CardTitle>
			</CardHeader>
			<CardContent className="text-sm text-muted-foreground">
				{label}
			</CardContent>
		</Card>
	);
}
