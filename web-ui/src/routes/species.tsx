import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "#/components/ui/badge.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { getSpecies } from "#/lib/detections.ts";

export const Route = createFileRoute("/species")({
	component: Species,
	loader: () => getSpecies(),
});

function Species() {
	const species = Route.useLoaderData();

	return (
		<div className="page-wrap py-8">
			<h1 className="display-title text-3xl font-semibold">Species</h1>
			<p className="mt-2 text-muted-foreground">
				{species.length} species detected so far.
			</p>

			<div className="feature-card mt-6 rounded-xl p-2">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Species</TableHead>
							<TableHead>Scientific name</TableHead>
							<TableHead>Last detected</TableHead>
							<TableHead className="text-right">Detections</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{species.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-muted-foreground">
									No species detected yet.
								</TableCell>
							</TableRow>
						) : (
							species.map((s) => (
								<TableRow key={s.comName}>
									<TableCell>{s.comName}</TableCell>
									<TableCell className="italic">{s.sciName}</TableCell>
									<TableCell className="tabular-data">
										{s.lastDetected}
									</TableCell>
									<TableCell className="text-right">
										<Badge variant="secondary" className="tabular-data">
											{s.count}
										</Badge>
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
