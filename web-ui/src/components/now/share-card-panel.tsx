import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { formatShareCard } from "~/lib/share-card.ts";
import { getShareCard } from "~/lib/share-card-data.ts";

const COPIED_FEEDBACK_MS = 2_000;

/**
 * The Pi is usually reached over a bare LAN address, which is not a secure
 * context, so navigator.clipboard is genuinely undefined there. The deprecated
 * execCommand path is the only thing that works on those origins.
 */
async function copyText(text: string): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to the legacy path.
		}
	}

	const field = document.createElement("textarea");
	field.value = text;
	field.setAttribute("readonly", "");
	field.style.position = "fixed";
	field.style.opacity = "0";
	document.body.append(field);
	field.select();
	const copied = document.execCommand("copy");
	field.remove();
	return copied;
}

export function ShareCardPanel() {
	const [text, setText] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [justCopied, setJustCopied] = useState(false);

	// Fetched on first open rather than with the page: the card needs two
	// all-time queries that nobody should pay for unless they want to share.
	async function toggle() {
		if (isOpen) {
			setIsOpen(false);
			return;
		}

		setIsOpen(true);
		if (text !== null || isLoading) return;

		setIsLoading(true);
		setError(null);
		try {
			setText(formatShareCard(await getShareCard()));
		} catch {
			setError("Could not build the summary. Try again in a moment.");
		} finally {
			setIsLoading(false);
		}
	}

	async function copy() {
		if (text === null) return;

		setError(null);
		if (!(await copyText(text))) {
			setError("Copying was blocked. Select the text above to copy it.");
			return;
		}

		setJustCopied(true);
		setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
	}

	return (
		<section aria-label="Share today" className="mt-4">
			<Button
				variant="outline"
				size="sm"
				onClick={toggle}
				aria-expanded={isOpen}
			>
				<Share2 />
				{isOpen ? "Hide summary" : "Share today"}
			</Button>

			{isOpen && (
				<div className="feature-card mt-3 rounded-md p-4 sm:p-6">
					<div className="island-kicker">Last 24 hours, in brief</div>

					{isLoading && (
						<p className="mt-4 text-muted-foreground text-sm">
							Building your summary…
						</p>
					)}

					{text !== null && (
						<>
							<pre className="mt-4 overflow-x-auto whitespace-pre font-mono text-sm leading-relaxed">
								{text}
							</pre>

							<div className="mt-4 flex items-center gap-3">
								<Button size="sm" onClick={copy}>
									{justCopied ? <Check /> : <Copy />}
									{justCopied ? "Copied!" : "Copy text"}
								</Button>
								<span className="text-muted-foreground text-xs">
									Paste it anywhere — it's just text and emoji.
								</span>
							</div>
						</>
					)}

					{error && (
						<p className="mt-4 text-destructive text-sm" role="alert">
							{error}
						</p>
					)}
				</div>
			)}
		</section>
	);
}
