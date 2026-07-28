import {
	createFileRoute,
	stripSearchParams,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { Headphones, ListChecks } from "lucide-react";
import { z } from "zod";

import { LearnGame } from "~/components/learn/learn-game.tsx";
import {
	LEARN_POOL_ICONS,
	LearnPoolSelector,
	LearnRoundShell,
} from "~/components/learn/learn-layout.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { getLearnRound } from "~/lib/learn.ts";
import {
	LEARN_POOL_DESCRIPTIONS,
	LEARN_POOL_LABELS,
	LEARN_POOLS,
	type LearnPool,
} from "~/lib/learn-pools.ts";
import {
	CHOICES_PER_QUESTION,
	QUESTIONS_PER_ROUND,
} from "~/lib/learn-round.ts";
import { pageTitle } from "~/lib/page-title.ts";

const DEFAULT_POOL: LearnPool = "today";

const learnSearchSchema = z.object({
	pool: z.enum(LEARN_POOLS).default(DEFAULT_POOL).catch(DEFAULT_POOL),
});

export const Route = createFileRoute("/learn")({
	head: () => ({ meta: [{ title: pageTitle("Learn") }] }),
	validateSearch: learnSearchSchema,
	search: {
		middlewares: [stripSearchParams({ pool: DEFAULT_POOL })],
	},
	loaderDeps: ({ search }) => ({ pool: search.pool }),
	loader: ({ deps }) => getLearnRound({ data: deps.pool }),
	component: Learn,
});

function Learn() {
	const { round, hasAnyDetections } = Route.useLoaderData();
	const { pool } = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	// The loader hands back a freshly randomized round every time it runs, so
	// "play again" is just an invalidation -- and the new round's id re-keys the
	// game below, which is what clears the finished round's state.
	const isLoading = useRouterState({ select: (state) => state.isLoading });

	return (
		<div className="page-wrap py-4">
			<PageHeaderCard
				title="Learn the calls"
				description="Ear training on the recordings your own station captured."
				// The shape of a round is only worth describing when there is one to
				// play; with nothing recorded these promise a game that cannot start.
				stats={
					hasAnyDetections
						? [
								{
									label: "Recordings",
									value: QUESTIONS_PER_ROUND,
									detail: "per round",
									icon: Headphones,
								},
								{
									label: "Choices",
									value: CHOICES_PER_QUESTION,
									detail: "per question",
									icon: ListChecks,
								},
								{
									label: "Drawing from",
									value: LEARN_POOL_LABELS[pool],
									detail: LEARN_POOL_DESCRIPTIONS[pool],
									icon: LEARN_POOL_ICONS[pool],
								},
							]
						: []
				}
			/>

			{/* Gated on the station, not the pool: an empty pool still needs the
			    switcher to reach a fuller one, which is exactly what the empty card
			    advises. */}
			{hasAnyDetections && (
				<LearnPoolSelector
					pool={pool}
					onPoolChange={(value) => {
						navigate({
							search: (previous) => ({ ...previous, pool: value }),
							replace: true,
						});
					}}
				/>
			)}

			<LearnRoundShell isEmpty={round.questions.length === 0}>
				{round.questions.length === 0 ? (
					<EmptyPool
						speciesInPool={round.speciesInPool}
						hasAnyDetections={hasAnyDetections}
					/>
				) : (
					<LearnGame
						key={round.id}
						round={round}
						onPlayAgain={() => router.invalidate()}
						isLoadingNextRound={isLoading}
					/>
				)}
			</LearnRoundShell>
		</div>
	);
}

function EmptyPool({
	speciesInPool,
	hasAnyDetections,
}: {
	speciesInPool: number;
	hasAnyDetections: boolean;
}) {
	// Pointing at a wider selection is only useful advice when a wider selection
	// could hold something. With nothing recorded anywhere, it would just send
	// someone around a loop of empty pools.
	if (!hasAnyDetections) {
		return (
			<section className="feature-card rounded-md p-4">
				<div className="island-kicker">Learn</div>
				<p className="mt-4 text-muted-foreground text-sm">
					No detections recorded yet.
				</p>
			</section>
		);
	}

	return (
		<section className="feature-card rounded-md p-4">
			<div className="island-kicker">Not enough to go on</div>
			<p className="mt-4 text-muted-foreground text-sm">
				A round needs {CHOICES_PER_QUESTION} species with clear recordings still
				on disk, and this selection has{" "}
				{speciesInPool === 0 ? "none" : speciesInPool}. Try a wider selection —
				All Time always has the most to work with.
			</p>
		</section>
	);
}
