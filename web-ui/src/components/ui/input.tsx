import type * as React from "react";

import { cn } from "~/lib/utils.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base transition-colors selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				// The one place that opts out of the global focus outline: a text
				// field already reads as focused from the darkened border plus its
				// caret, and stacking a detached ring on top of a full-width box
				// was noise.
				"focus-visible:border-[var(--hover-line)] focus-visible:outline-none",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
