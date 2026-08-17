import { createApprovedText, listApprovedFiles, readApprovedText, type ApprovedRoot } from "./safe-files.ts";
import { buildCapture, captureFilename, createReview, parseCapture, renderCapture, reviewFilename, type CaptureInput, type ReviewClassification, type ReviewRecord } from "./records.ts";
import { sha256Text } from "./marker.ts";

export class RecordConflictError extends Error {}

export type ListedCapture = NonNullable<ReturnType<typeof parseCapture>> & {
  content_hash: string;
  review: ReviewRecord | null;
};

export class CaptureStore {
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

  async #allCaptures() {
    const paths = await listApprovedFiles(this.#root, "Inbox/Captures", ".md");
    const captures: ListedCapture[] = [];
    for (const relativePath of paths) {
      const text = await readApprovedText(this.#root, relativePath);
      if (text === null) continue;
      const record = parseCapture(text);
      if (record) captures.push({ ...record, content_hash: sha256Text(text), review: null });
    }
    return captures;
  }

  async #latestReviews() {
    const paths = await listApprovedFiles(this.#root, "Inbox/_review", ".json");
    const reviews = new Map<string, ReviewRecord>();
    for (const relativePath of paths) {
      const text = await readApprovedText(this.#root, relativePath);
      if (text === null) continue;
      let review: Partial<ReviewRecord>;
      try {
        review = JSON.parse(text) as Partial<ReviewRecord>;
      } catch {
        continue;
      }
      if (review.type !== "capture-review-proposal" || typeof review.capture_id !== "string" || typeof review.created_at !== "string") continue;
      const current = reviews.get(review.capture_id);
      if (!current || review.created_at > current.created_at) reviews.set(review.capture_id, review as ReviewRecord);
    }
    return reviews;
  }

  async list(filters: { type?: string; query?: string } = {}) {
    const [captures, reviews] = await Promise.all([this.#allCaptures(), this.#latestReviews()]);
    const query = filters.query?.trim().toLocaleLowerCase();
    return captures
      .filter((capture) => !filters.type || capture.capture_type === filters.type)
      .filter((capture) => !query || `${capture.title}\n${capture.body}`.toLocaleLowerCase().includes(query))
      .map((capture) => ({ ...capture, review: reviews.get(capture.id) || null }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  save(input: CaptureInput, idempotencyKey: string) {
    return this.#serial(async () => {
      const record = buildCapture(input, idempotencyKey);
      const markdown = renderCapture(record);
      const existing = (await this.#allCaptures()).find((capture) => capture.id === record.id);
      if (existing) {
        const candidateWithOriginalReceipt = renderCapture({ ...record, saved_at: existing.saved_at });
        const existingMarkdown = renderCapture(existing);
        if (existingMarkdown !== candidateWithOriginalReceipt) throw new RecordConflictError("This save key was already used for different content.");
        const relativePath = `Inbox/Captures/${captureFilename(existing)}`;
        return { created: false, record: existing, receipt: { id: existing.id, relative_path: relativePath, sha256: existing.content_hash, durable_at: existing.saved_at } };
      }
      const relativePath = `Inbox/Captures/${captureFilename(record)}`;
      const created = await createApprovedText(this.#root, relativePath, markdown);
      return { created: true, record, receipt: { id: record.id, relative_path: created.relativePath, sha256: created.sha256, durable_at: record.saved_at } };
    });
  }

  proposeReview(input: { captureId: string; captureHash: string; classification: ReviewClassification }) {
    return this.#serial(async () => {
      const capture = (await this.#allCaptures()).find((item) => item.id === input.captureId);
      if (!capture) throw new Error("The capture no longer exists.");
      if (capture.content_hash !== input.captureHash) throw new RecordConflictError("The capture changed while you were reviewing it. Reload before saving a proposal.");
      const review = createReview(input.captureId, input.captureHash, input.classification);
      const content = `${JSON.stringify(review, null, 2)}\n`;
      const created = await createApprovedText(this.#root, `Inbox/_review/${reviewFilename(review)}`, content);
      return { review, receipt: { relative_path: created.relativePath, sha256: created.sha256, durable_at: new Date().toISOString() } };
    });
  }
}
