import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Health Journal keeps private filters local and API data out of the shell cache", async () => {
  const captureClient = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const client = await readFile(new URL("../web/health.js", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../web/service-worker.js", import.meta.url), "utf8");

  assert.doesNotMatch(captureClient, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry/i);
  assert.match(captureClient, /searchFilter\.value/);
  assert.doesNotMatch(client, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry/i);
  assert.match(client, /searchInput\.value/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
});
