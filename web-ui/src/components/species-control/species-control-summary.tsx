import {
	Ban,
	CircleAlert,
	ListChecks,
	MapPinned,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

type Summary = {
	label: string;
	value: number;
	detail: string;
	tone?: "quiet" | "warn";
	icon: typeof ListChecks;
};

export function SpeciesControlSummary({
	custom,
	excluded,
	whitelisted,
	eligible,
	unresolved,
	pending,
}: {
	custom: number;
	excluded: number;
	whitelisted: number;
	eligible: number;
	unresolved: number;
	pending: number;
}) {
	const items: Summary[] = [
		{
			label: "Custom",
			value: custom,
			detail: "restricted scope",
			icon: ListChecks,
		},
		{ label: "Excluded", value: excluded, detail: "never detect", icon: Ban },
		{
			label: "Always detect",
			value: whitelisted,
			detail: "ignore range",
			icon: ShieldCheck,
		},
		{
			label: "Eligible now",
			value: eligible,
			detail: "after range check",
			icon: MapPinned,
		},
		{
			label: "Needs attention",
			value: unresolved,
			detail: "unmatched entries",
			tone: unresolved ? "warn" : "quiet",
			icon: CircleAlert,
		},
		{
			label: "Pending changes",
			value: pending,
			detail: "not saved",
			tone: pending ? "warn" : "quiet",
			icon: Sparkles,
		},
	];
	return (
		<dl className="grid grid-cols-2 overflow-hidden rounded-md border border-[var(--line)] bg-card md:grid-cols-3 xl:grid-cols-6">
			{items.map(({ label, value, detail, tone, icon: Icon }) => (
				<div
					key={label}
					className="border-[var(--line)] border-b p-3 last:border-b-0 md:border-r xl:border-b-0"
				>
					<div className="flex items-center justify-between gap-2">
						<dt className="island-kicker">{label}</dt>
						<Icon
							aria-hidden="true"
							className={`size-4 ${tone === "warn" ? "text-[var(--clay)]" : "text-[var(--moss)]"}`}
						/>
					</div>
					<dd className="tabular-data mt-2 font-semibold text-2xl leading-none">
						{value}
					</dd>
					<p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
				</div>
			))}
		</dl>
	);
}
