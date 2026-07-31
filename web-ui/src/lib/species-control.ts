import { createServerFn } from "@tanstack/react-start";
import {
	deleteSpeciesHistory,
	loadSpeciesControlPage,
	previewSpeciesHistoryDeletion,
	previewSpeciesRange,
	saveSpeciesControlLists,
} from "./species-control.server.ts";
import {
	speciesControlDeletePreviewSchema,
	speciesControlDeleteSchema,
	speciesControlSaveSchema,
} from "./species-control-data.ts";

export const getSpeciesControlPage = createServerFn({ method: "GET" }).handler(
	() => loadSpeciesControlPage(),
);

export const saveSpeciesControl = createServerFn({ method: "POST" })
	.validator(speciesControlSaveSchema)
	.handler(({ data }) => saveSpeciesControlLists(data));

export const getSpeciesRangePreview = createServerFn({ method: "GET" }).handler(
	() => previewSpeciesRange(),
);

export const getSpeciesHistoryDeletePreview = createServerFn({ method: "POST" })
	.validator(speciesControlDeletePreviewSchema)
	.handler(({ data }) => previewSpeciesHistoryDeletion(data.sciName));

export const deleteSpeciesHistoryFn = createServerFn({ method: "POST" })
	.validator(speciesControlDeleteSchema)
	.handler(({ data }) => deleteSpeciesHistory(data));
