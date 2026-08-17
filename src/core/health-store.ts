import { createApprovedText, listApprovedFiles, readApprovedText, type ApprovedRoot } from "./safe-files.ts";
import {
  HEALTH_CATEGORIES,
  buildHealthEvent,
  buildHealthRevision,
  healthFilename,
  parseHealthEvent,
  renderHealthEvent,
  type HealthEventInput,
  type HealthEventRecord,
} from "./health.ts";
import { sha256Text } from "./marker.ts";
import { validateIdempotencyKey } from "./records.ts";

export class HealthConflictError extends Error {}

export type ListedHealthEvent = HealthEventRecord & {
  content_hash: string;
  revision_count: number;
};

type StoredHealthEvent = HealthEventRecord & { content_hash: string };

export class HealthStore {
  #root: ApprovedRoot;
  #writeTail: Promise<unknown> = Promise.resolve();

  constructor(root: ApprovedRoot) {
    this.#root = root;
  }

  #serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#writeTail.then(work, work);
    this.#writeTail = result.catch(() => undefined);
    return result;
  }

  async #allRecords() {
    const paths = await listApprovedFiles(this.#root, "Inbox/Captures", ".md");
    const records: StoredHealthEvent[] = [];
    for (const relativePath of paths) {
      const text = await readApprovedText(this.#root, relativePath);
      if (text === null) continue;
      const record = parseHealthEvent(text);
      if (record) records.push({ ...record, content_hash: sha256Text(text) });
    }
    return records;
  }

  async list(): Promise<ListedHealthEvent[]> {
    const records = await this.#allRecords();
    const current = new Map<string, StoredHealthEvent>();
    const revisionCounts = new Map<string, number>();
    for (const record of records) {
      revisionCounts.set(record.event_id, (revisionCounts.get(record.event_id) || 0) + 1);
      const existing = current.get(record.event_id);
      if (!existing || record.revision > existing.revision || (record.revision === existing.revision && record.updated_at > existing.updated_at)) current.set(record.event_id, record);
    }
    return [...current.values()]
      .map((record) => ({ ...record, revision_count: revisionCounts.get(record.event_id) || 1 }))
      .sort((a, b) => `${b.event_date}T${b.event_time || "23:59"}`.localeCompare(`${a.event_date}T${a.event_time || "23:59"}`));
  }

  async categories() {
    const custom = new Map<string, string>();
    for (const event of await this.list()) {
      if (!HEALTH_CATEGORIES.some((category) => category.slug === event.category)) custom.set(event.category, event.category_label);
    }
    return [
      ...HEALTH_CATEGORIES,
      ...[...custom].map(([slug, name]) => ({ slug, name, group: "care" as const, tone: "stone", fields: [] })),
    ];
  }

  save(input: HealthEventInput, idempotencyKey: string) {
    return this.#serial(async () => {
      const record = buildHealthEvent(input, idempotencyKey);
      const records = await this.#allRecords();
      const existing = records.find((candidate) => candidate.id === record.id);
      if (existing) {
        const candidateWithOriginalReceipt = renderHealthEvent({ ...record, saved_at: existing.saved_at });
        if (renderHealthEvent(existing) !== candidateWithOriginalReceipt) throw new HealthConflictError("This save key was already used for different health information.");
        return { created: false, record: existing, receipt: this.#existingReceipt(existing) };
      }
      this.#validateRelationship(records, record);
      return this.#create(record);
    });
  }

  revise(eventId: string, input: HealthEventInput, currentHash: string, idempotencyKey: string) {
    return this.#serial(async () => {
      validateIdempotencyKey(idempotencyKey);
      if (!/^health_[0-9a-f-]{36}$/i.test(eventId)) throw new Error("The health entry identity is invalid.");
      if (!/^[0-9a-f]{64}$/i.test(currentHash)) throw new Error("The health entry fingerprint is invalid.");
      const records = await this.#allRecords();
      const existingRevision = records.find((candidate) => candidate.id === `healthrev_${idempotencyKey.toLowerCase()}`);
      if (existingRevision) {
        const previous = records.find((candidate) => candidate.id === existingRevision.revises);
        if (!previous) throw new HealthConflictError("The previous health revision is no longer available.");
        const candidate = buildHealthRevision(previous, input, idempotencyKey, new Date(existingRevision.saved_at));
        if (renderHealthEvent(existingRevision) !== renderHealthEvent(candidate)) throw new HealthConflictError("This save key was already used for a different revision.");
        return { created: false, record: existingRevision, receipt: this.#existingReceipt(existingRevision) };
      }
      const versions = records.filter((candidate) => candidate.event_id === eventId);
      const current = versions.sort((a, b) => b.revision - a.revision || b.updated_at.localeCompare(a.updated_at))[0];
      if (!current) throw new Error("The health entry no longer exists.");
      if (current.content_hash !== currentHash) throw new HealthConflictError("This entry changed while you were editing it. Reload before saving a new revision.");
      const revision = buildHealthRevision(current, input, idempotencyKey);
      this.#validateRelationship(records, revision);
      return this.#create(revision);
    });
  }

  #validateRelationship(records: StoredHealthEvent[], record: HealthEventRecord) {
    if (!record.related_event_id) return;
    if (record.related_event_id === record.event_id) throw new Error("A health entry cannot relate to itself.");
    if (!records.some((candidate) => candidate.event_id === record.related_event_id)) throw new Error("The related health entry no longer exists.");
  }

  async #create(record: HealthEventRecord) {
    const markdown = renderHealthEvent(record);
    const relativePath = `Inbox/Captures/${healthFilename(record)}`;
    const created = await createApprovedText(this.#root, relativePath, markdown);
    return {
      created: true,
      record,
      receipt: { id: record.id, event_id: record.event_id, relative_path: created.relativePath, sha256: created.sha256, durable_at: record.saved_at },
    };
  }

  #existingReceipt(record: StoredHealthEvent) {
    return {
      id: record.id,
      event_id: record.event_id,
      relative_path: `Inbox/Captures/${healthFilename(record)}`,
      sha256: record.content_hash,
      durable_at: record.saved_at,
    };
  }
}
