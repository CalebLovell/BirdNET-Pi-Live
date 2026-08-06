import type * as React from "react";

import { cn } from "~/lib/utils.ts";

/**
 * The selection column, pinned to the same width on every table that has one so
 * the rows start on the same line across pages. 2.5rem is the 14px checkbox in
 * the cell's 16px padding, rounded up to the grid.
 *
 * It is the only column that is pinned by width. The tables use auto layout, so
 * everything between this and the trailing column divides up the full width of
 * the table in proportion to what it holds -- no column is left carrying the
 * slack as a gutter.
 *
 * The `min-w` is what makes it a pin rather than a preference: auto layout
 * treats a plain width as a hint and squeezes past it once the table is over
 * its container and scrolling anyway.
 *
 * Spelled out in full rather than composed, because Tailwind scans for literal
 * class strings.
 */
const SELECT_COLUMN_WIDTH = "w-10 min-w-10";

function Table({
	className,
	containerClassName,
	...props
}: React.ComponentProps<"table"> & {
	/** Styles the scrollport, not the table -- e.g. to give it a bounded height. */
	containerClassName?: string;
}) {
	// -mx-1/px-1 cancel out, but the padding keeps the first and last columns'
	// focus rings from being clipped by the scrollport they sit flush against.
	// Width is left to auto so the negative margins widen the box by exactly the
	// padding; `w-full` would pin it and shift the table left instead.
	return (
		<div
			data-slot="table-container"
			className={cn("relative -mx-1 overflow-x-auto px-1", containerClassName)}
		>
			<table
				data-slot="table"
				className={cn("w-full caption-bottom text-sm", className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn("[&_tr]:border-b", className)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child]:border-0", className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				// A floor, not a cap -- a `tr` grows past its height for taller content.
				// The detections row is the default the others match: its xs Button (24px)
				// inside the cell's 8px padding makes a 40px content box, and border-box
				// sizing means the row's own 1px rule has to be added on top or a row
				// carrying only text or a badge lands a pixel short of one with a control.
				"h-[calc(2.5rem+1px)] border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
				className,
			)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"whitespace-nowrap p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("mt-4 text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	SELECT_COLUMN_WIDTH,
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
};
