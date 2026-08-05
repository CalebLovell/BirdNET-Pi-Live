import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "~/components/ui/button.tsx";

export function SpeciesControlTools({
	onImport,
	onExport,
	onReset,
}: {
	onImport: (text: string) => void;
	onExport: () => void;
	onReset: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="flex shrink-0 flex-wrap justify-end gap-2 lg:ml-auto">
			<input
				ref={inputRef}
				className="sr-only"
				type="file"
				accept=".txt,.json,text/plain,application/json"
				onChange={async (event) => {
					const file = event.target.files?.[0];
					if (file) onImport(await file.text());
					event.target.value = "";
				}}
			/>
			<Button
				className="h-9"
				size="default"
				variant="outline"
				onClick={() => inputRef.current?.click()}
			>
				<Upload />
				Import lists
			</Button>
			<Button
				className="h-9"
				size="default"
				variant="outline"
				onClick={onExport}
			>
				<Download />
				Export lists
			</Button>
			<Button
				className="h-9"
				size="default"
				variant="outline"
				onClick={onReset}
			>
				<RotateCcw />
				Reset lists
			</Button>
		</div>
	);
}
