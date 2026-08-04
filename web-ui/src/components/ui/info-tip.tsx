import { Info } from "lucide-react";
import type { ReactNode } from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";

/**
 * An explanation a reader can ask for, so a control can stay uncluttered
 * without going unexplained. Carries its own provider, since the pages that
 * want one are not otherwise tooltip pages. The click is swallowed because the
 * trigger sometimes sits inside a field's label, which would otherwise pull
 * focus into the control it labels.
 */
export function InfoTip({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						aria-label={`About ${label}`}
						className="inline-flex items-center text-muted-foreground transition-colors hover:text-[var(--moss)]"
						onClick={(event) => event.preventDefault()}
					>
						<Info className="size-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent className="max-w-80 space-y-2 leading-relaxed">
					{children}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
