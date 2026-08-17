import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { initialiseRoot, loadConfiguration } from "../src/core/config.ts";
import { MARKER_FILE, parseApprovalMarker } from "../src/core/marker.ts";
import { listApprovedFiles, loadApprovedRoot, readApprovedText } from "../src/core/safe-files.ts";
import { CaptureStore, RecordConflictError } from "../src/core/store.ts";
import { HealthStore } from "../src/core/health-store.ts";
import { HEALTH_CATEGORIES, parseHealthEvent, renderHealthEvent } from "../src/core/health.ts";

const createdAt = "2026-07-21T18:42:03.000Z";
const idempotencyKey = "4dd4a1f2-9cf3-44cb-a473-3c083b78cf8a";

async function fixture(t: TestContext) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "private-capture-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const vault = path.join(temporary, "Synthetic Vault");
  const configPath = path.join(temporary, "config", "config.json");
  await mkdir(vault, { mode: 0o700 });
  const initialized = await initialiseRoot({ vaultPath: vault, configPath });
  const loaded = await loadConfiguration(configPath);
  const root = await loadApprovedRoot(loaded.value);
  return { temporary, vault, configPath, initialized, loaded, root, store: new CaptureStore(root) };
}

test("init creates only the bounded append-only root", async (t) => {
  const { vault, initialized } = await fixture(t);
  const marker = parseApprovalMarker(JSON.parse(await readFile(path.join(initialized.rootPath, MARKER_FILE), "utf8")));
  assert.equal(marker.authorized_application, "private-capture");
  assert.deepEqual(marker.capabilities, [
    { path: "Inbox/Captures", operations: ["read", "create"] },
    { path: "Inbox/_review", operations: ["read", "create"] },
  ]);
  assert.equal((await lstat(path.join(vault, ".obsidian")).catch(() => null)), null);
  assert.equal((await lstat(path.join(initialized.rootPath, "Inbox", "Captures"))).isDirectory(), true);
  assert.equal((await lstat(path.join(initialized.rootPath, "Inbox", "_review"))).isDirectory(), true);
});

test("capture body is byte-for-byte stable and retries are idempotent", async (t) => {
  const { store, root } = await fixture(t);
  const text = "First line\n\nUnicode: café, नमस्ते, 🎨\n[[Synthetic note]]";
  const input = { captureType: "thought" as const, text, title: "Synthetic thought", clientCreatedAt: createdAt };
  const first = await store.save(input, idempotencyKey);
  const second = await store.save(input, idempotencyKey);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.deepEqual(second.receipt, first.receipt);
  const file = await readApprovedText(root, first.receipt.relative_path);
  assert.ok(file);
  assert.equal(file.slice(file.indexOf("\n---\n") + 5), text);
  assert.equal((await store.list()).length, 1);
});

test("reusing an idempotency key for different content is a conflict", async (t) => {
  const { store } = await fixture(t);
  await store.save({ captureType: "thought", text: "Version one", clientCreatedAt: createdAt }, idempotencyKey);
  await assert.rejects(
    () => store.save({ captureType: "thought", text: "Different words", clientCreatedAt: createdAt }, idempotencyKey),
    RecordConflictError,
  );
});

test("simultaneous retries create one capture", async (t) => {
  const { store } = await fixture(t);
  const input = { captureType: "question" as const, text: "A synthetic question?", clientCreatedAt: createdAt };
  const results = await Promise.all(Array.from({ length: 8 }, () => store.save(input, idempotencyKey)));
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal((await store.list()).length, 1);
});

test("review proposals never modify the original capture", async (t) => {
  const { store, root } = await fixture(t);
  const saved = await store.save({ captureType: "decision", text: "Keep the original words.", clientCreatedAt: createdAt }, idempotencyKey);
  const before = await readApprovedText(root, saved.receipt.relative_path);
  await store.proposeReview({ captureId: saved.record.id, captureHash: saved.receipt.sha256, classification: "decision" });
  await store.proposeReview({ captureId: saved.record.id, captureHash: saved.receipt.sha256, classification: "keep-in-inbox" });
  const after = await readApprovedText(root, saved.receipt.relative_path);
  assert.equal(after, before);
  assert.equal((await store.list())[0].review?.proposed_classification, "keep-in-inbox");
});

test("missing, invalid, changed, and replaced markers fail closed", async (t) => {
  const { initialized, root, loaded } = await fixture(t);
  const markerPath = path.join(initialized.rootPath, MARKER_FILE);
  const valid = await readFile(markerPath, "utf8");

  await rm(markerPath);
  await assert.rejects(() => readApprovedText(root, "Inbox/Captures/example.md"), /marker/i);

  await writeFile(markerPath, "{ invalid", { mode: 0o600 });
  await assert.rejects(() => loadApprovedRoot(loaded.value), /valid JSON/i);

  await writeFile(markerPath, valid.replace("Bounded, append-only", "Changed"), { mode: 0o600 });
  await assert.rejects(() => loadApprovedRoot(loaded.value), /changed or replaced/i);

  const replacement = path.join(initialized.rootPath, ".replacement-marker");
  await writeFile(replacement, valid, { mode: 0o600 });
  await rename(replacement, markerPath);
  await assert.rejects(() => readApprovedText(root, "Inbox/Captures/example.md"), /replaced/i);
});

test("a symlink cannot redirect an approved directory", async (t) => {
  const { initialized, loaded, temporary } = await fixture(t);
  const captures = path.join(initialized.rootPath, "Inbox", "Captures");
  const moved = path.join(initialized.rootPath, "Inbox", "Captures-real");
  const outside = path.join(temporary, "outside");
  await mkdir(outside);
  await rename(captures, moved);
  await symlink(outside, captures);
  const root = await loadApprovedRoot(loaded.value);
  const store = new CaptureStore(root);
  await assert.rejects(
    () => store.save({ captureType: "thought", text: "Blocked", clientCreatedAt: createdAt }, idempotencyKey),
    /unsafe|missing directory/i,
  );
});

test("health entries and edits remain append-only Markdown revisions", async (t) => {
  const { root } = await fixture(t);
  const healthStore = new HealthStore(root);
  const input = {
    eventDate: "2026-07-20",
    eventTime: "09:30",
    category: "pelvic-floor-therapy",
    title: "Synthetic therapy session",
    provider: "Test therapist",
    notes: "Original health note used only in a temporary test vault.",
    details: {
      worked_on: "Synthetic breathing exercise",
      pain_discomfort: "Optional natural-language note",
      exercises_assigned: "Synthetic exercise, 2 sets",
    },
    tags: ["synthetic", "therapy"],
    followUpNeeded: true,
    followUpDate: "2026-07-27",
    clientCreatedAt: createdAt,
  };
  const first = await healthStore.save(input, idempotencyKey);
  const replay = await healthStore.save(input, idempotencyKey);
  assert.equal(first.created, true);
  assert.equal(replay.created, false);
  assert.equal(first.record.event_id, first.record.id);
  const firstMarkdown = await readApprovedText(root, first.receipt.relative_path);
  assert.ok(firstMarkdown);
  assert.deepEqual(parseHealthEvent(renderHealthEvent(first.record)), first.record);

  const revised = await healthStore.revise(
    first.record.event_id,
    { ...input, notes: "Revised synthetic note.", details: { ...input.details, exercises_assigned: "Synthetic exercise, 3 sets" }, clientCreatedAt: "2026-07-21T18:42:03.000Z" },
    first.receipt.sha256,
    "d355577a-13b5-43fa-8e60-e6c96de4c3ce",
  );
  assert.equal(revised.record.revision, 2);
  assert.equal(revised.record.revises, first.record.id);
  assert.equal(await readApprovedText(root, first.receipt.relative_path), firstMarkdown);
  const listed = await healthStore.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].body, "Revised synthetic note.");
  assert.equal(listed[0].revision_count, 2);
  assert.equal(listed[0].details.exercises_assigned, "Synthetic exercise, 3 sets");
  assert.equal((await listApprovedFiles(root, "Inbox/Captures", ".md")).length, 2);
});

test("health categories are centralized, extensible, and measurements stay optional", async (t) => {
  assert.equal(HEALTH_CATEGORIES.length, 17);
  assert.equal(new Set(HEALTH_CATEGORIES.map((category) => category.slug)).size, 17);
  assert.ok(HEALTH_CATEGORIES.find((category) => category.slug === "symptoms")?.fields.some((field) => field.key === "severity"));
  const { root } = await fixture(t);
  const healthStore = new HealthStore(root);
  await healthStore.save({
    eventDate: "2026-07-20",
    category: "nutrition",
    categoryLabel: "Nutrition",
    title: "Synthetic custom category",
    notes: "No measurement is required.",
    clientCreatedAt: createdAt,
  }, idempotencyKey);
  const categories = await healthStore.categories();
  assert.equal(categories.find((category) => category.slug === "nutrition")?.name, "Nutrition");
});

test("related health entries preserve referential integrity", async (t) => {
  const { root } = await fixture(t);
  const healthStore = new HealthStore(root);
  const therapy = await healthStore.save({
    eventDate: "2026-07-20",
    category: "pelvic-floor-therapy",
    title: "Synthetic therapy event",
    notes: "Relationship target.",
    clientCreatedAt: createdAt,
  }, idempotencyKey);
  const symptomKey = "e2199524-e678-4857-8c2e-a22f4ab7d454";
  const symptom = await healthStore.save({
    eventDate: "2026-07-21",
    category: "symptoms",
    title: "Synthetic related symptom",
    appointmentType: "Personal journal note",
    relatedEventId: therapy.record.event_id,
    clientCreatedAt: createdAt,
  }, symptomKey);
  assert.equal(symptom.record.related_event_id, therapy.record.event_id);
  assert.equal(symptom.record.appointment_type, "Personal journal note");
  await assert.rejects(() => healthStore.save({
    eventDate: "2026-07-22",
    category: "symptoms",
    title: "Broken relationship",
    relatedEventId: "health_d355577a-13b5-43fa-8e60-e6c96de4c3ce",
    clientCreatedAt: createdAt,
  }, "effc7ef8-17e4-4221-9ee5-c6ab2e044369"), /related health entry/i);
});
