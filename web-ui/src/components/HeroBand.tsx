// A quiet nod to the field-guide illustrations this app's data comes
// from -- rolling hills, a treeline, one sun. Used once, on the overview
// page, so it reads as a signature rather than decoration.
export function HeroBand() {
	return (
		<svg
			viewBox="0 0 800 140"
			className="h-28 w-full text-[var(--moss)] sm:h-32"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<circle cx="668" cy="46" r="26" fill="var(--sand)" opacity="0.85" />
			<path
				d="M0 96 C 120 60, 220 118, 340 82 S 560 54, 800 96 V140 H0 Z"
				fill="var(--sage)"
				opacity="0.55"
			/>
			<path
				d="M0 118 C 140 96, 260 132, 420 108 S 640 88, 800 120 V140 H0 Z"
				fill="var(--moss)"
				opacity="0.85"
			/>
			{[64, 128, 190, 246, 300].map((x, i) => (
				<path
					key={x}
					d={`M${x} ${132 - (i % 2) * 10} l16 -${34 + (i % 3) * 6} l16 ${34 + (i % 3) * 6} Z`}
					fill="var(--ink)"
					opacity="0.8"
				/>
			))}
		</svg>
	);
}
