import { createServerFn } from "@tanstack/react-start";
import { requireUnlocked } from "./auth.ts";
import {
	loadSpeciesControlPage,
	saveSpeciesControlLists,
} from "./species-control.server.ts";
import { speciesControlSaveSchema } from "./species-control-data.ts";

export const getSpeciesControlPage = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadSpeciesControlPage());

export const saveSpeciesControl = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(speciesControlSaveSchema)
	.handler(({ data }) => saveSpeciesControlLists(data));
