import { X } from "lucide-react";
import type * as React from "react";

import { Input } from "~/components/ui/input.tsx";
import { cn } from "~/lib/utils.ts";

type SearchInputProps = Omit<React.ComponentProps<"input">, "value"> & {
	value: string;
	onClear: () => void;
};

// Shared search field so every list page gets the same width and the same
// clear affordance (the X only appears once there is something to clear).
function SearchInput({
	className,
	value,
	onClear,
	...props
}: SearchInputProps) {
	return (
		<div className={cn("relative w-80 max-w-full", className)}>
			<Input type="text" value={value} className="pr-9" {...props} />
			{value ? (
				<button
					type="button"
					aria-label="Clear search"
					onClick={onClear}
					className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			) : null}
		</div>
	);
}

export { SearchInput };
