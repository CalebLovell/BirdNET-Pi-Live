import type * as React from "react";

import { cn } from "~/lib/utils.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				// 16px only where it buys something: under that, iOS Safari zooms the
				// page on focus. That is a property of the input device, not the
				// window, so it keys off `pointer-coarse` rather than a viewport
				// breakpoint -- a narrow window on a desktop was getting phone-sized
				// text for a zoom that could never happen.
				"h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 pointer-coarse:text-base text-sm transition-colors selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
				// The one place that opts out of the global focus outline: a text
				// field already reads as focused from the border plus its caret, and
				// stacking a detached ring on top of a full-width box was noise. The
				// border takes --focus-ring so it is the same green the rings use.
				"focus-visible:border-[var(--focus-ring)] focus-visible:outline-none",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
