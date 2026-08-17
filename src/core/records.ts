import { randomUUID } from "node:crypto";

export const CAPTURE_TYPES = ["thought", "journal", "project-update", "decision", "question", "link", "task"] as const;
export const REVIEW_CLASSIFICATIONS = ["journal-entry", "project-update", "decision", "question", "task", "reference", "keep-in-inbox"] as const;

export type CaptureType = typeof CAPTURE_TYPES[number];
export type ReviewClassification = typeof REVIEW_CLASSIFICATIONS[number];

export type CaptureInput = {
  captureType: CaptureType;
  text: string;
  title?: string;
  sourceUrl?: string;
  occurredOn?: string;
  clientCreatedAt: string;
};

export type CaptureRecord = {
  type: "capture";
  id: string;
  schema_version: 1;
  created_at: string;
  updated_at: string;
  saved_at: string;
  owner: "private-capture";
  privacy: "private";
  title: string;
  capture_type: CaptureType;
  state: "inbox";
  source_url?: string;
  occurred_on?: string;
  body: string;
};

export type ReviewRecord = {
  type: "capture-review-proposal";
  id: string;
  capture_id: string;
  capture_hash: string;
  proposed_classification: ReviewClassification;
  created_at: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_TIME.test(value) && Number.isFinite(Date.parse(value));
}

export function validateIdempotencyKey(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error("Idempotency-Key must be a version 4 UUID.");
}

export function buildCapture(input: CaptureInput, idempotencyKey: string, savedAt = new Date()): CaptureRecord {
  validateIdempotencyKey(idempotencyKey);
  if (!CAPTURE_TYPES.includes(input.captureType)) throw new Error("Choose a supported capture type.");
  if (typeof input.text !== "string" || !input.text.trim()) throw new Error("Write something before saving.");
  if (input.text.length > 250_000) throw new Error("This capture is too large for the inbox.");
  if (input.title !== undefined && (typeof input.title !== "string" || input.title.length > 240)) throw new Error("The optional title is too long.");
  if (!isIsoTimestamp(input.clientCreatedAt)) throw new Error("The client creation time must be an ISO timestamp with a timezone.");
  if (input.occurredOn && (!DATE_ONLY.test(input.occurredOn) || new Date(`${input.occurredOn}T00:00:00Z`).toISOString().slice(0, 10) !== input.occurredOn)) throw new Error("The optional date must use YYYY-MM-DD.");
  if (input.sourceUrl) {
    let url: URL;
    try {
      url = new URL(input.sourceUrl);
    } catch {
      throw new Error("The source link is not a valid URL.");
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("The source link must use HTTP or HTTPS.");
  }
  const timestamp = new Date(input.clientCreatedAt).toISOString();
  const record: CaptureRecord = {
    type: "capture",
    id: `cap_${idempotencyKey.toLowerCase()}`,
    schema_version: 1,
    created_at: timestamp,
    updated_at: timestamp,
    saved_at: savedAt.toISOString(),
    owner: "private-capture",
    privacy: "private",
    title: input.title?.trim() || "Untitled capture",
    capture_type: input.captureType,
    state: "inbox",
    body: input.text,
  };
  if (input.sourceUrl) record.source_url = input.sourceUrl;
  if (input.occurredOn) record.occurred_on = input.occurredOn;
  return record;
}

function yamlValue(value: unknown) {
  return typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(String(value));
}

const FIELD_ORDER = ["type", "id", "schema_version", "created_at", "updated_at", "saved_at", "owner", "privacy", "title", "capture_type", "state", "source_url", "occurred_on"] as const;

export function renderCapture(record: CaptureRecord) {
  const frontmatter = FIELD_ORDER.flatMap((key) => record[key] === undefined ? [] : [`${key}: ${yamlValue(record[key])}`]);
  return `---\n${frontmatter.join("\n")}\n---\n${record.body}`;
}

function parseYamlValue(value: string): unknown {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function parseCapture(markdown: string): CaptureRecord | null {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  if (!markdown.startsWith(`---${newline}`)) return null;
  const boundary = markdown.indexOf(`${newline}---${newline}`, 4);
  if (boundary < 0) return null;
  const fields: Record<string, unknown> = {};
  for (const line of markdown.slice(4, boundary).split(newline)) {
    const separator = line.indexOf(":");
    if (separator > 0) fields[line.slice(0, separator).trim()] = parseYamlValue(line.slice(separator + 1));
  }
  if (fields.type !== "capture" || typeof fields.id !== "string" || !CAPTURE_TYPES.includes(fields.capture_type as CaptureType)) return null;
  return { ...fields, body: markdown.slice(boundary + `${newline}---${newline}`.length) } as CaptureRecord;
}

export function captureFilename(record: CaptureRecord) {
  const slug = record.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || record.capture_type;
  const shortId = record.id.slice(4, 12);
  return `${record.created_at.slice(0, 10)}--${slug}--${shortId}.md`;
}

export function createReview(captureId: string, captureHash: string, classification: ReviewClassification, now = new Date()): ReviewRecord {
  if (!/^cap_[0-9a-f-]{36}$/i.test(captureId)) throw new Error("The capture identity is invalid.");
  if (!/^[0-9a-f]{64}$/i.test(captureHash)) throw new Error("The capture fingerprint is invalid.");
  if (!REVIEW_CLASSIFICATIONS.includes(classification)) throw new Error("Choose a supported review classification.");
  return {
    type: "capture-review-proposal",
    id: `rev_${randomUUID()}`,
    capture_id: captureId,
    capture_hash: captureHash,
    proposed_classification: classification,
    created_at: now.toISOString(),
  };
}

export function reviewFilename(review: ReviewRecord) {
  const stamp = review.created_at.replace(/[:.]/g, "-");
  return `${review.capture_id}--${stamp}--${review.id.slice(4, 12)}.json`;
}
