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
  const { server } = await startServer(loaded, { host: "127.0.0.1", port: 0 });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;

  const locked = await fetch(`${origin}/api/v1/health`);
  assert.equal(locked.status, 401);
  const lockedJournal = await fetch(`${origin}/api/v1/health-events`);
  assert.equal(lockedJournal.status, 401);

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
});
