import {
	CalendarDays,
	Clock,
	Infinity as InfinityIcon,
	Repeat2,
} from "lucide-react";
import type { ComponentType, PropsWithChildren } from "react";

import {
	ToggleGroup,
	ToggleGroupItem,
} from "~/components/ui/toggle-group.tsx";
import {
	LEARN_POOL_LABELS,
	LEARN_POOLS,
	type LearnPool,
} from "~/lib/learn-pools.ts";

const POOL_ICONS: Record<
	LearnPool,
	ComponentType<{ className?: string }>
> = {
	today: Clock,
	week: CalendarDays,
	frequent: Repeat2,
	all: InfinityIcon,
};

export function LearnPoolSelector({
	pool,
	onPoolChange,
}: {
	pool: LearnPool;
	onPoolChange: (pool: LearnPool) => void;
}) {
	return (
		<div className="mt-4 flex justify-start overflow-x-auto pb-1">
			<ToggleGroup
				type="single"
				variant="outline"
				value={pool}
				onValueChange={(value) => {
					if (value) onPoolChange(value as LearnPool);
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
	);
}

export function LearnRoundShell({
	isEmpty,
	children,
}: PropsWithChildren<{ isEmpty: boolean }>) {
	return (
		<div className={isEmpty ? "mx-auto mt-4 max-w-3xl" : "mt-4 w-full"}>
			{children}
		</div>
	);
}
