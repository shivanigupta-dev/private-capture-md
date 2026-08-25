import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initialiseRoot, loadConfiguration } from "../src/core/config.ts";
import { startServer } from "../src/server/server.ts";

test("network mode authenticates, checks origin, and replays duplicate saves", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "private-capture-server-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const vault = path.join(temporary, "Synthetic Vault");
  const configPath = path.join(temporary, "config.json");
  await mkdir(vault);
  const initialized = await initialiseRoot({ vaultPath: vault, configPath, accessMode: "token" });
  assert.ok(initialized.token);
  const loaded = await loadConfiguration(configPath);
  const { server } = await startServer(loaded, { host: "127.0.0.1", port: 0, voiceSettings: null });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;

  const locked = await fetch(`${origin}/api/v1/health`);
  assert.equal(locked.status, 401);
  const lockedJournal = await fetch(`${origin}/api/v1/health-events`);
  assert.equal(lockedJournal.status, 401);
  const lockedVehicles = await fetch(`${origin}/api/v1/vehicles`);
  assert.equal(lockedVehicles.status, 401);
  const lockedWorkouts = await fetch(`${origin}/api/v1/workout-events`);
  assert.equal(lockedWorkouts.status, 401);
  const lockedVoice = await fetch(`${origin}/api/v1/voice/meta`);
  assert.equal(lockedVoice.status, 401);

  const rejectedOrigin = await fetch(`${origin}/api/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://example.invalid" },
    body: JSON.stringify({ token: initialized.token }),
  });
  assert.equal(rejectedOrigin.status, 403);

  const login = await fetch(`${origin}/api/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ token: initialized.token }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.ok(setCookie);
  const cookie = setCookie.split(";", 1)[0];
  assert.ok(cookie.startsWith("pc_session="));

  const voiceMeta = await fetch(`${origin}/api/v1/voice/meta`, { headers: { Cookie: cookie } });
  assert.equal(voiceMeta.status, 200);
  assert.deepEqual(await voiceMeta.json(), { configured: false, language: "en", max_seconds: 120, local_only: true, saves_automatically: false });
  const voiceRoute = await fetch(`${origin}/api/v1/voice/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
    body: JSON.stringify({ transcript: "I ran 3.1 miles in 30 minutes." }),
  });
  assert.equal(voiceRoute.status, 200);
  const routedVoice = await voiceRoute.json();
  assert.equal(routedVoice.proposal.destination, "workout");
  assert.equal(routedVoice.proposal.subtype, "run");
  const unavailableVoice = await fetch(`${origin}/api/v1/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "audio/webm", Origin: origin, Cookie: cookie },
    body: new Uint8Array([1, 2, 3]),
  });
  assert.equal(unavailableVoice.status, 503);

  const key = "d355577a-13b5-43fa-8e60-e6c96de4c3ce";
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key, Origin: origin, Cookie: cookie },
    body: JSON.stringify({ captureType: "thought", text: "Synthetic server capture", clientCreatedAt: "2026-07-21T20:00:00.000Z" }),
  };
  const first = await fetch(`${origin}/api/v1/captures`, request);
  assert.equal(first.status, 201);
  assert.equal((await first.json()).replayed, false);

  const replay = await fetch(`${origin}/api/v1/captures`, request);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).replayed, true);

  const list = await fetch(`${origin}/api/v1/captures`, { headers: { Cookie: cookie } });
  const listed = await list.json();
  assert.equal(listed.captures.length, 1);
  assert.equal(listed.captures[0].body, "Synthetic server capture");

  const metadata = await fetch(`${origin}/api/v1/health-journal/meta`, { headers: { Cookie: cookie } });
  assert.equal(metadata.status, 200);
  assert.equal((await metadata.json()).categories.length, 17);

  const healthKey = "e2199524-e678-4857-8c2e-a22f4ab7d454";
  const healthRequest = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": healthKey, Origin: origin, Cookie: cookie },
    body: JSON.stringify({
      eventDate: "2026-07-20",
      category: "symptoms",
      title: "Synthetic symptom note",
      notes: "A natural-language test note without a severity score.",
      details: { symptom: "Synthetic symptom" },
      clientCreatedAt: "2026-07-21T20:01:00.000Z",
    }),
  };
  const healthSave = await fetch(`${origin}/api/v1/health-events`, healthRequest);
  assert.equal(healthSave.status, 201);
  const savedHealth = await healthSave.json();
  const healthReplay = await fetch(`${origin}/api/v1/health-events`, healthRequest);
  assert.equal(healthReplay.status, 200);
  assert.equal((await healthReplay.json()).replayed, true);

  const healthList = await fetch(`${origin}/api/v1/health-events`, { headers: { Cookie: cookie } });
  assert.equal(healthList.status, 200);
  assert.equal(healthList.headers.get("cache-control"), "no-store");
  const listedHealth = await healthList.json();
  assert.equal(listedHealth.events.length, 1);
  assert.equal(listedHealth.events[0].body, "A natural-language test note without a severity score.");

  const revision = await fetch(`${origin}/api/v1/health-events/${savedHealth.event.event_id}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "effc7ef8-17e4-4221-9ee5-c6ab2e044369", Origin: origin, Cookie: cookie },
    body: JSON.stringify({
      eventDate: "2026-07-20",
      category: "symptoms",
      title: "Updated synthetic symptom note",
      notes: "Updated without replacing the first file.",
      details: { symptom: "Synthetic symptom" },
      clientCreatedAt: "2026-07-21T20:02:00.000Z",
      currentHash: listedHealth.events[0].content_hash,
    }),
  });
  assert.equal(revision.status, 201);
  const afterRevision = await fetch(`${origin}/api/v1/health-events`, { headers: { Cookie: cookie } });
  const revisedList = await afterRevision.json();
  assert.equal(revisedList.events.length, 1);
  assert.equal(revisedList.events[0].revision_count, 2);
  assert.equal(revisedList.events[0].body, "Updated without replacing the first file.");

  const carMetadata = await fetch(`${origin}/api/v1/car/meta`, { headers: { Cookie: cookie } });
  assert.equal(carMetadata.status, 200);
  assert.equal((await carMetadata.json()).presets.length, 8);

  const vehicleKey = "451d3478-5583-4d45-927b-c0fde69d7c5d";
  const vehicleRequest = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": vehicleKey, Origin: origin, Cookie: cookie },
    body: JSON.stringify({ displayName: "Synthetic Server Car", year: 2022, distanceUnit: "mi", currency: "USD", clientCreatedAt: "2026-07-21T20:03:00.000Z" }),
  };
  const vehicleSave = await fetch(`${origin}/api/v1/vehicles`, vehicleRequest);
  assert.equal(vehicleSave.status, 201);
  const savedVehicle = await vehicleSave.json();
  const vehicleReplay = await fetch(`${origin}/api/v1/vehicles`, vehicleRequest);
  assert.equal(vehicleReplay.status, 200);
  assert.equal((await vehicleReplay.json()).replayed, true);

  const carKey = "8d268fb5-c07a-4bc2-af10-2012c1e08f76";
  const carRequest = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": carKey, Origin: origin, Cookie: cookie },
    body: JSON.stringify({
      vehicleId: savedVehicle.vehicle.id,
      serviceDate: "2026-07-20",
      category: "tires",
      title: "Synthetic tire rotation",
      odometer: 31_500,
      nextDueOdometer: 36_500,
      details: { tire_work: "Rotation" },
      clientCreatedAt: "2026-07-21T20:04:00.000Z",
    }),
  };
  const carSave = await fetch(`${origin}/api/v1/vehicle-events`, carRequest);
  assert.equal(carSave.status, 201);
  const carReplay = await fetch(`${origin}/api/v1/vehicle-events`, carRequest);
  assert.equal(carReplay.status, 200);
  assert.equal((await carReplay.json()).replayed, true);

  const vehicleList = await fetch(`${origin}/api/v1/vehicles`, { headers: { Cookie: cookie } });
  assert.equal(vehicleList.headers.get("cache-control"), "no-store");
  assert.equal((await vehicleList.json()).vehicles.length, 1);
  const carList = await fetch(`${origin}/api/v1/vehicle-events`, { headers: { Cookie: cookie } });
  assert.equal(carList.headers.get("cache-control"), "no-store");
  const listedCar = await carList.json();
  assert.equal(listedCar.events.length, 1);
  assert.equal(listedCar.events[0].details.tire_work, "Rotation");

  const workoutMetadata = await fetch(`${origin}/api/v1/workout/meta`, { headers: { Cookie: cookie } });
  assert.equal(workoutMetadata.status, 200);
  const workoutMeta = await workoutMetadata.json();
  assert.ok(workoutMeta.exercises.length >= 25);
  assert.equal(workoutMeta.climb_grade_systems.length, 5);

  const workoutKey = "98c13252-b1b9-4d79-acd4-2930c76ed7ab";
  const workoutRequest = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": workoutKey, Origin: origin, Cookie: cookie },
    body: JSON.stringify({
      activityDate: "2026-07-23",
      activityType: "lift",
      exerciseId: "deadlift",
      weightUnit: "lb",
      sets: [{ reps: 5, weight: 135 }, { reps: 3, weight: 155, rpe: 8 }],
      notes: "Synthetic server lift.",
      clientCreatedAt: "2026-07-23T20:04:00.000Z",
    }),
  };
  const workoutSave = await fetch(`${origin}/api/v1/workout-events`, workoutRequest);
  assert.equal(workoutSave.status, 201);
  const workoutReplay = await fetch(`${origin}/api/v1/workout-events`, workoutRequest);
  assert.equal(workoutReplay.status, 200);
  assert.equal((await workoutReplay.json()).replayed, true);
  const workoutList = await fetch(`${origin}/api/v1/workout-events`, { headers: { Cookie: cookie } });
  assert.equal(workoutList.headers.get("cache-control"), "no-store");
  const listedWorkouts = await workoutList.json();
  assert.equal(listedWorkouts.events.length, 1);
  assert.equal(listedWorkouts.events[0].sets[1].weight, 155);
});
