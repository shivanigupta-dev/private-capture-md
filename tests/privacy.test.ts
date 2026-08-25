import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Health Journal keeps private filters local and API data out of the shell cache", async () => {
  const captureClient = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const client = await readFile(new URL("../web/health.js", import.meta.url), "utf8");
  const carClient = await readFile(new URL("../web/car.js", import.meta.url), "utf8");
  const workoutClient = await readFile(new URL("../web/workout.js", import.meta.url), "utf8");
  const voiceClient = await readFile(new URL("../web/voice.js", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../web/service-worker.js", import.meta.url), "utf8");

  assert.doesNotMatch(captureClient, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry/i);
  assert.match(captureClient, /searchFilter\.value/);
  assert.doesNotMatch(client, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry/i);
  assert.match(client, /searchInput\.value/);
  assert.doesNotMatch(carClient, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry/i);
  assert.match(carClient, /searchInput\.value/);
  assert.doesNotMatch(carClient, /\bvin\b|license\s*plate/i);
  assert.doesNotMatch(workoutClient, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry/i);
  assert.match(workoutClient, /searchInput\.value/);
  assert.doesNotMatch(voiceClient, /URLSearchParams|console\.(?:log|info|debug)|analytics|telemetry|localStorage/i);
  assert.match(voiceClient, /Nothing is filed until you review it|Preparing an editable draft/);
  assert.match(voiceClient, /transcriptionController\?\.abort\(\)/);
  assert.match(voiceClient, /addEventListener\("cancel"/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /voice\.js/);
});
