import {
	createFileRoute,
	stripSearchParams,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import {
	CalendarDays,
	Clock,
	Infinity as InfinityIcon,
	Repeat2,
} from "lucide-react";
import { z } from "zod";

import { LearnGame } from "~/components/learn/learn-game.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
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

const DEFAULT_POOL: LearnPool = "today";

const learnSearchSchema = z.object({
	pool: z.enum(LEARN_POOLS).default(DEFAULT_POOL).catch(DEFAULT_POOL),
});

export const Route = createFileRoute("/learn")({
	validateSearch: learnSearchSchema,
	search: {
		middlewares: [stripSearchParams({ pool: DEFAULT_POOL })],
	},
	loaderDeps: ({ search }) => ({ pool: search.pool }),
	loader: ({ deps }) => getLearnRound({ data: deps.pool }),
	component: Learn,
});

const POOL_ICONS: Record<
	LearnPool,
	React.ComponentType<{ className?: string }>
> = {
	today: Clock,
	week: CalendarDays,
	frequent: Repeat2,
	all: InfinityIcon,
};

function Learn() {
	const round = Route.useLoaderData();
	const { pool } = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	// The loader hands back a freshly randomized round every time it runs, so
	// "play again" is just an invalidation -- and the new round's id re-keys the
	// game below, which is what clears the finished round's state.
	const isLoading = useRouterState({ select: (state) => state.isLoading });

	return (
		<div className="page-wrap py-4">
			{/* Same summary-card header the day and species pages use: kicker,
			    title, one moss-coloured line. */}
			<section aria-label="Learn" className="feature-card rounded-md p-4">
				<div className="island-kicker">Ear training</div>
				<h1 className="display-title mt-1 font-bold text-2xl">
					Learn the calls
				</h1>
				<p className="mt-0.5 font-semibold text-[var(--moss)] text-sm">
					{QUESTIONS_PER_ROUND} recordings from your own yard ·{" "}
					{LEARN_POOL_DESCRIPTIONS[pool]}
				</p>
			</section>

			{/* Filters sit bare between the header card and the round, the way the
			    species page keeps its search and sort row. */}
			<div className="mt-4 flex justify-end">
				<ToggleGroup
					type="single"
					variant="outline"
					value={pool}
					onValueChange={(value) => {
						if (!value) return;
						navigate({
							search: (previous) => ({ ...previous, pool: value as LearnPool }),
							replace: true,
						});
					}}
				>
					{LEARN_POOLS.map((option) => {
						const Icon = POOL_ICONS[option];
						return (
							<ToggleGroupItem key={option} value={option}>
								<Icon className="size-4" />
								{LEARN_POOL_LABELS[option]}
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			</div>

			<div className="mx-auto mt-4 max-w-3xl">
				{round.questions.length === 0 ? (
					<EmptyPool speciesInPool={round.speciesInPool} />
				) : (
					<LearnGame
						key={round.id}
						round={round}
						onPlayAgain={() => router.invalidate()}
						isLoadingNextRound={isLoading}
					/>
				)}
			</div>
		</div>
	);
}

function EmptyPool({ speciesInPool }: { speciesInPool: number }) {
	return (
		<section className="feature-card rounded-md p-4 text-center">
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
