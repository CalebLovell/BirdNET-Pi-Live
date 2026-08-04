import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, type LucideIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "~/lib/utils.ts";

/**
 * The station's one button. `xs` is the Today page's Bird Call control, measured
 * off the card it lives in, and it is the default size -- a bare `<Button>` is
 * already the right button. The larger steps exist so the scale stays coherent,
 * not because anything currently uses them.
 *
 * Note the absence of shadcn's `has-[>svg]:px-*` rule, which trims horizontal
 * padding whenever a button contains an icon. Padding that depends on the
 * children is padding every call site has to think about, and thinking about it
 * is how the two Bird Call buttons ended up 2px apart. The `icon` prop puts the
 * glyph in a fixed slot instead, so the padding is simply constant.
 */
const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-destructive",
				outline: "border bg-card hover:bg-accent hover:text-accent-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				xs: "h-6 gap-1.5 px-2.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
				sm: "h-7 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				default:
					"h-8 gap-2 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
				lg: "h-9 gap-2 px-5 text-sm [&_svg:not([class*='size-'])]:size-4",
				// The square sizes still carry a font size: pagination puts a page
				// number in one, and without it the digit inherits the page's 16px
				// and overflows a 24px box.
				"icon-xs": "size-6 text-[11px] [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-7 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				icon: "size-8 text-sm [&_svg:not([class*='size-'])]:size-4",
				"icon-lg": "size-9 text-sm [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "xs",
		},
	},
);

type ButtonProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		/** Leading glyph. Sized by the size variant -- never set `size-*` on it. */
		icon?: LucideIcon;
		iconPosition?: "start" | "end";
		/** Replaces the icon with a spinner and takes the button out of service. */
		loading?: boolean;
	};

function Button({
	className,
	variant = "default",
	size = "xs",
	asChild = false,
	icon: Icon,
	iconPosition = "start",
	loading = false,
	disabled,
	children,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot.Root : "button";

	const glyph = loading ? (
		<Loader2 aria-hidden="true" className="animate-spin" />
	) : Icon ? (
		<Icon aria-hidden="true" />
	) : null;

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			// An anchor has no `disabled`, and Slot would forward it to the DOM.
			// `asChild` call sites that need to be unavailable render something
			// else instead -- see the day pager.
			disabled={asChild ? undefined : disabled || loading}
			{...props}
		>
			{asChild
				? withGlyph(children, glyph, iconPosition)
				: order(children, glyph, iconPosition)}
		</Comp>
	);
}

function order(
	children: React.ReactNode,
	glyph: React.ReactNode,
	iconPosition: "start" | "end",
) {
	if (!glyph) return children;
	return iconPosition === "end" ? (
		<>
			{children}
			{glyph}
		</>
	) : (
		<>
			{glyph}
			{children}
		</>
	);
}

/**
 * `asChild` hands Slot a single element to merge into, so the glyph cannot sit
 * beside it -- it has to go inside. Cloning the child keeps `icon` meaning the
 * same thing on a link as it does on a button.
 */
function withGlyph(
	children: React.ReactNode,
	glyph: React.ReactNode,
	iconPosition: "start" | "end",
) {
	if (!glyph) return children;

	const child = React.Children.only(children) as React.ReactElement<{
		children?: React.ReactNode;
	}>;

	return React.cloneElement(
		child,
		undefined,
		order(child.props.children, glyph, iconPosition),
	);
}

export { Button, buttonVariants };
