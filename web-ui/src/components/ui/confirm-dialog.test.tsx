import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ConfirmDialog } from "./confirm-dialog.tsx";

test("renders an icon in both confirmation actions", () => {
	const markup = renderToStaticMarkup(
		<ConfirmDialog
			title="Confirm status"
			description="Apply this status now."
			cancelIcon={<span data-icon="cancel" />}
			confirmIcon={<span data-icon="confirm" />}
			confirmLabel="Apply status"
			onCancel={() => {}}
			onConfirm={() => {}}
		/>,
	);
	assert.match(
		markup,
		/<button[^>]*><span data-icon="cancel"><\/span>Cancel<\/button>/,
	);
	assert.match(
		markup,
		/<button[^>]*><span data-icon="confirm"><\/span>Apply status<\/button>/,
	);
});
