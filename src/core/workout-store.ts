import { createApprovedText, listApprovedFiles, readApprovedText, type ApprovedRoot } from "./safe-files.ts";
import { CLIMB_GRADE_SYSTEMS, EXERCISES, RUN_TYPES, buildWorkout, parseWorkout, renderWorkout, workoutFilename, type WorkoutInput, type WorkoutRecord } from "./workout.ts";
import { sha256Text } from "./marker.ts";

export class WorkoutConflictError extends Error {}

type StoredWorkout = WorkoutRecord & { content_hash: string };

export class WorkoutStore {
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
    const records: StoredWorkout[] = [];
    for (const relativePath of paths) {
      const text = await readApprovedText(this.#root, relativePath);
      if (text === null) continue;
      const record = parseWorkout(text);
      if (record) records.push({ ...record, content_hash: sha256Text(text) });
    }
    return records;
  }

  async list() {
    return (await this.#allRecords()).sort((a, b) => `${b.activity_date}T${b.activity_time || "23:59"}`.localeCompare(`${a.activity_date}T${a.activity_time || "23:59"}`));
  }

  metadata() {
    return { exercises: EXERCISES, climb_grade_systems: CLIMB_GRADE_SYSTEMS, run_types: RUN_TYPES };
  }

  save(input: WorkoutInput, idempotencyKey: string) {
    return this.#serial(async () => {
      const record = buildWorkout(input, idempotencyKey);
      const records = await this.#allRecords();
      const existing = records.find((candidate) => candidate.id === record.id);
      if (existing) {
        const candidate = renderWorkout({ ...record, saved_at: existing.saved_at });
        if (renderWorkout(existing) !== candidate) throw new WorkoutConflictError("This save key was already used for different workout information.");
        return { created: false, record: existing, receipt: this.#receipt(existing) };
      }
      const markdown = renderWorkout(record);
      const created = await createApprovedText(this.#root, `Inbox/Captures/${workoutFilename(record)}`, markdown);
      return {
        created: true,
        record,
        receipt: { id: record.id, relative_path: created.relativePath, sha256: created.sha256, durable_at: record.saved_at },
      };
    });
  }

  #receipt(record: StoredWorkout) {
    return { id: record.id, relative_path: `Inbox/Captures/${workoutFilename(record)}`, sha256: record.content_hash, durable_at: record.saved_at };
  }
}
