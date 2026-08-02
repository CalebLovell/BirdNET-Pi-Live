import { createServerFn } from "@tanstack/react-start";

import { loadStationHealth } from "./health.server.ts";

export const getStationHealth = createServerFn({ method: "GET" }).handler(() =>
	loadStationHealth(),
);
