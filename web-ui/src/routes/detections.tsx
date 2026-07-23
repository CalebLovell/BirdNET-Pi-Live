import { createFileRoute } from "@tanstack/react-router";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table.tsx";
import { getDetections } from "~/lib/detections.ts";

export const Route = createFileRoute("/detections")({
	component: Detections,
	loader: () => getDetections(),
});

function Detections() {
	const detections = Route.useLoaderData();

	return (
		<div className="page-wrap pt-4">
			<h1 className="display-title text-3xl font-semibold">Detections</h1>
			<p className="mt-2 text-muted-foreground">
				The last {detections.length} detections, most recent first.
			</p>

			<div className="feature-card mt-6 rounded-md p-2">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Date</TableHead>
							<TableHead>Time</TableHead>
							<TableHead>Species</TableHead>
							<TableHead>Scientific name</TableHead>
							<TableHead className="text-right">Confidence</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{detections.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-muted-foreground">
									No detections yet.
								</TableCell>
							</TableRow>
						) : (
							detections.map((detection) => (
								<TableRow
									key={`${detection.Date}-${detection.Time}-${detection.File_Name}`}
								>
									<TableCell className="tabular-data">
										{detection.Date}
									</TableCell>
									<TableCell className="tabular-data">
										{detection.Time}
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
