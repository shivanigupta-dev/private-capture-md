import { createApprovedText, listApprovedFiles, readApprovedText, type ApprovedRoot } from "./safe-files.ts";
import {
  CAR_PRESETS,
  buildVehicleEvent,
  buildVehicleProfile,
  parseVehicleEvent,
  parseVehicleProfile,
  renderVehicleEvent,
  renderVehicleProfile,
  vehicleEventFilename,
  vehicleFilename,
  type VehicleEventInput,
  type VehicleEventRecord,
  type VehicleProfileInput,
  type VehicleProfileRecord,
} from "./car.ts";
import { sha256Text } from "./marker.ts";

export class CarConflictError extends Error {}

type StoredVehicle = VehicleProfileRecord & { content_hash: string };
type StoredVehicleEvent = VehicleEventRecord & { content_hash: string };

export class CarStore {
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
    const vehicles: StoredVehicle[] = [];
    const events: StoredVehicleEvent[] = [];
    for (const relativePath of paths) {
      const text = await readApprovedText(this.#root, relativePath);
      if (text === null) continue;
      const content_hash = sha256Text(text);
      const vehicle = parseVehicleProfile(text);
      if (vehicle) vehicles.push({ ...vehicle, content_hash });
      const event = parseVehicleEvent(text);
      if (event) events.push({ ...event, content_hash });
    }
    return { vehicles, events };
  }

  async vehicles() {
    const { vehicles } = await this.#allRecords();
    return vehicles.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async events() {
    const { events } = await this.#allRecords();
    return events.sort((a, b) => `${b.service_date}T${b.created_at}`.localeCompare(`${a.service_date}T${a.created_at}`));
  }

  metadata() {
    return {
      presets: CAR_PRESETS,
      service_types: [
        { value: "shop", label: "Independent shop" },
        { value: "dealer", label: "Dealer" },
        { value: "diy", label: "DIY" },
        { value: "roadside", label: "Roadside" },
        { value: "inspection", label: "Inspection station" },
        { value: "other", label: "Other" },
      ],
      recall_url: "https://www.nhtsa.gov/recalls",
    };
  }

  saveVehicle(input: VehicleProfileInput, idempotencyKey: string) {
    return this.#serial(async () => {
      const record = buildVehicleProfile(input, idempotencyKey);
      const { vehicles } = await this.#allRecords();
      const existing = vehicles.find((candidate) => candidate.id === record.id);
      if (existing) {
        const candidate = renderVehicleProfile({ ...record, saved_at: existing.saved_at });
        if (renderVehicleProfile(existing) !== candidate) throw new CarConflictError("This save key was already used for a different vehicle.");
        return { created: false, record: existing, receipt: this.#vehicleReceipt(existing) };
      }
      const markdown = renderVehicleProfile(record);
      const created = await createApprovedText(this.#root, `Inbox/Captures/${vehicleFilename(record)}`, markdown);
      return {
        created: true,
        record,
        receipt: { id: record.id, relative_path: created.relativePath, sha256: created.sha256, durable_at: record.saved_at },
      };
    });
  }

  saveEvent(input: VehicleEventInput, idempotencyKey: string) {
    return this.#serial(async () => {
      const record = buildVehicleEvent(input, idempotencyKey);
      const { vehicles, events } = await this.#allRecords();
      const existing = events.find((candidate) => candidate.id === record.id);
      if (existing) {
        const candidate = renderVehicleEvent({ ...record, saved_at: existing.saved_at });
        if (renderVehicleEvent(existing) !== candidate) throw new CarConflictError("This save key was already used for different maintenance information.");
        return { created: false, record: existing, receipt: this.#eventReceipt(existing) };
      }
      if (!vehicles.some((vehicle) => vehicle.id === record.vehicle_id)) throw new Error("That vehicle is no longer available.");
      const markdown = renderVehicleEvent(record);
      const created = await createApprovedText(this.#root, `Inbox/Captures/${vehicleEventFilename(record)}`, markdown);
      return {
        created: true,
        record,
        receipt: { id: record.id, vehicle_id: record.vehicle_id, relative_path: created.relativePath, sha256: created.sha256, durable_at: record.saved_at },
      };
    });
  }

  #vehicleReceipt(record: StoredVehicle) {
    return { id: record.id, relative_path: `Inbox/Captures/${vehicleFilename(record)}`, sha256: record.content_hash, durable_at: record.saved_at };
  }

  #eventReceipt(record: StoredVehicleEvent) {
    return { id: record.id, vehicle_id: record.vehicle_id, relative_path: `Inbox/Captures/${vehicleEventFilename(record)}`, sha256: record.content_hash, durable_at: record.saved_at };
  }
}
