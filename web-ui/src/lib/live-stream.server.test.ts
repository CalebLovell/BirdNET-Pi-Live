import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LIVE_STREAM_URL, resolveLiveStreamUrl } from "./live-stream.server.ts";

test("falls back to the localhost Icecast default when unset", () => {
	assert.equal(resolveLiveStreamUrl({}), DEFAULT_LIVE_STREAM_URL);
	assert.equal(DEFAULT_LIVE_STREAM_URL, "http://localhost:8000/stream");
});

test("honors LIVE_STREAM_URL when set", () => {
	assert.equal(
		resolveLiveStreamUrl({ LIVE_STREAM_URL: "http://pi.local:8000/stream" }),
		"http://pi.local:8000/stream",
	);
});

test("treats a blank or whitespace LIVE_STREAM_URL as unset", () => {
	assert.equal(resolveLiveStreamUrl({ LIVE_STREAM_URL: "   " }), DEFAULT_LIVE_STREAM_URL);
	assert.equal(resolveLiveStreamUrl({ LIVE_STREAM_URL: "" }), DEFAULT_LIVE_STREAM_URL);
});
