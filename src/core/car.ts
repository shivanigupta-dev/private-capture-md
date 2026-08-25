import { isIsoTimestamp, validateIdempotencyKey } from "./records.ts";

export type CarFieldDefinition = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "select";
  options?: string[];
};

export type CarPresetDefinition = {
  slug: string;
  name: string;
  short_name: string;
  tone: string;
  glyph: string;
  suggested_title: string;
  fields: CarFieldDefinition[];
};

const field = (key: string, label: string, kind: CarFieldDefinition["kind"] = "text", options?: string[]): CarFieldDefinition => ({ key, label, kind, ...(options ? { options } : {}) });

export const CAR_PRESETS: CarPresetDefinition[] = [
  {
    slug: "oil-filter",
    name: "Oil & filter",
    short_name: "Oil",
    tone: "orange",
    glyph: "◒",
    suggested_title: "Oil and filter change",
    fields: [
      field("oil_viscosity", "Oil viscosity", "text"),
      field("oil_type", "Oil type", "select", ["Full synthetic", "Synthetic blend", "Conventional", "High mileage", "Other"]),
      field("oil_quantity", "Quantity", "text"),
      field("oil_filter", "Filter brand / part number", "text"),
    ],
  },
  {
    slug: "tires",
    name: "Tires",
    short_name: "Tires",
    tone: "lavender",
    glyph: "◎",
    suggested_title: "Tire service",
    fields: [
      field("tire_work", "Work", "select", ["Rotation", "Replacement", "Repair", "Balance", "Alignment", "Pressure check", "Inspection"]),
      field("tire_position", "Position / axle", "text"),
      field("tire_brand_model", "Brand / model", "text"),
      field("tire_size", "Tire size", "text"),
      field("tire_pressure", "Cold pressure", "text"),
      field("tread_notes", "Tread notes", "textarea"),
    ],
  },
  {
    slug: "brakes",
    name: "Brakes",
    short_name: "Brakes",
    tone: "coral",
    glyph: "◉",
    suggested_title: "Brake service",
    fields: [
      field("brake_work", "Work", "select", ["Inspection", "Pads", "Rotors", "Fluid", "Caliper", "Other"]),
      field("brake_axle", "Axle / wheels", "select", ["Front", "Rear", "All", "Other"]),
      field("brake_measurement", "Pad / rotor measurement", "text"),
      field("brake_parts", "Parts used", "textarea"),
    ],
  },
  {
    slug: "battery",
    name: "Battery",
    short_name: "Battery",
    tone: "peacock",
    glyph: "⚡",
    suggested_title: "Battery service",
    fields: [
      field("battery_work", "Work", "select", ["Test", "Replacement", "Charge", "Terminal cleaning", "Other"]),
      field("battery_brand_model", "Brand / model", "text"),
      field("battery_rating", "Rating / test result", "text"),
    ],
  },
  {
    slug: "inspection-registration",
    name: "Inspection & registration",
    short_name: "Inspection",
    tone: "purple",
    glyph: "◇",
    suggested_title: "Inspection or registration",
    fields: [
      field("inspection_type", "Type", "select", ["Safety inspection", "Emissions", "Registration", "Recall check", "Pre-purchase inspection", "Other"]),
      field("inspection_result", "Result", "text"),
      field("inspection_items", "Items to address", "textarea"),
    ],
  },
  {
    slug: "fluids-filters",
    name: "Fluids & filters",
    short_name: "Fluids",
    tone: "sky",
    glyph: "≈",
    suggested_title: "Fluid or filter service",
    fields: [
      field("fluid_filter_type", "Fluid / filter", "select", ["Coolant", "Transmission fluid", "Brake fluid", "Power steering fluid", "Cabin air filter", "Engine air filter", "Wiper fluid", "Other"]),
      field("fluid_filter_product", "Product / part number", "text"),
      field("fluid_filter_quantity", "Quantity", "text"),
    ],
  },
  {
    slug: "repair-issue",
    name: "Repair / issue",
    short_name: "Repair",
    tone: "rose",
    glyph: "✦",
    suggested_title: "Repair or issue",
    fields: [
      field("issue_status", "Status", "select", ["Noticed", "Diagnosed", "Monitoring", "Repaired", "Could not reproduce"]),
      field("symptom", "Symptom", "textarea"),
      field("diagnosis", "Diagnosis", "textarea"),
      field("parts_used", "Parts used", "textarea"),
    ],
  },
  {
    slug: "other",
    name: "Other",
    short_name: "Other",
    tone: "stone",
    glyph: "+",
    suggested_title: "Vehicle note",
    fields: [field("work_performed", "Work performed", "textarea")],
  },
];

export type VehicleProfileInput = {
  displayName: string;
  year?: number;
  make?: string;
  model?: string;
  distanceUnit?: "mi" | "km";
  currency?: string;
  ownerManualUrl?: string;
  notes?: string;
  clientCreatedAt: string;
};

export type VehicleProfileRecord = {
  type: "vehicle-profile";
  id: string;
  schema_version: 1;
  created_at: string;
  saved_at: string;
  owner: "private-capture";
  privacy: "private";
  state: "active";
  display_name: string;
  year?: number;
  make?: string;
  model?: string;
  distance_unit: "mi" | "km";
  currency: string;
  owner_manual_url?: string;
  body: string;
};

export type VehicleEventInput = {
  vehicleId: string;
  serviceDate: string;
  category: string;
  title?: string;
  odometer?: number;
  provider?: string;
  serviceType?: string;
  cost?: number;
  partsCost?: number;
  laborCost?: number;
  nextDueDate?: string;
  nextDueOdometer?: number;
  warrantyUntilDate?: string;
  warrantyUntilOdometer?: number;
  receiptReference?: string;
  notes?: string;
  details?: Record<string, string>;
  clientCreatedAt: string;
};

export type VehicleEventRecord = {
  type: "vehicle-maintenance";
  id: string;
  schema_version: 1;
  created_at: string;
  saved_at: string;
  owner: "private-capture";
  privacy: "private";
  state: "completed";
  vehicle_id: string;
  service_date: string;
  category: string;
  category_label: string;
  title: string;
  odometer?: number;
  provider?: string;
  service_type?: string;
  cost?: number;
  parts_cost?: number;
  labor_cost?: number;
  next_due_date?: string;
  next_due_odometer?: number;
  warranty_until_date?: string;
  warranty_until_odometer?: number;
  receipt_reference?: string;
  details: Record<string, string>;
  body: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VEHICLE_ID = /^vehicle_[0-9a-f-]{36}$/i;
const EVENT_ID = /^car_[0-9a-f-]{36}$/i;
const SERVICE_TYPES = new Set(["shop", "diy", "dealer", "roadside", "inspection", "other"]);
const DETAIL_KEYS = new Set(CAR_PRESETS.flatMap((preset) => preset.fields.map((definition) => definition.key)));

export function buildVehicleProfile(input: VehicleProfileInput, idempotencyKey: string, savedAt = new Date()): VehicleProfileRecord {
  validateIdempotencyKey(idempotencyKey);
  if (!input || typeof input !== "object") throw new Error("The vehicle profile is missing.");
  if (!isIsoTimestamp(input.clientCreatedAt)) throw new Error("The client creation time must be an ISO timestamp with a timezone.");
  const year = optionalWholeNumber(input.year, 1886, 2200, "Choose a valid model year.");
  const distanceUnit = input.distanceUnit || "mi";
  if (!["mi", "km"].includes(distanceUnit)) throw new Error("Choose miles or kilometers.");
  const currency = optionalText(input.currency, 3).toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Use a three-letter currency code.");
  const ownerManualUrl = optionalHttpsUrl(input.ownerManualUrl, "Use an https owner-manual link.");
  return {
    type: "vehicle-profile",
    id: `vehicle_${idempotencyKey.toLowerCase()}`,
    schema_version: 1,
    created_at: new Date(input.clientCreatedAt).toISOString(),
    saved_at: savedAt.toISOString(),
    owner: "private-capture",
    privacy: "private",
    state: "active",
    display_name: requiredText(input.displayName, 100, "Give the vehicle a name."),
    ...(year !== undefined ? { year } : {}),
    ...optionalProperty("make", input.make, 80),
    ...optionalProperty("model", input.model, 100),
    distance_unit: distanceUnit,
    currency,
    ...(ownerManualUrl ? { owner_manual_url: ownerManualUrl } : {}),
    body: typeof input.notes === "string" ? input.notes.slice(0, 50_000) : "",
  };
}

export function buildVehicleEvent(input: VehicleEventInput, idempotencyKey: string, savedAt = new Date()): VehicleEventRecord {
  validateIdempotencyKey(idempotencyKey);
  if (!input || typeof input !== "object") throw new Error("The maintenance entry is missing.");
  if (!isIsoTimestamp(input.clientCreatedAt)) throw new Error("The client creation time must be an ISO timestamp with a timezone.");
  const vehicleId = requiredText(input.vehicleId, 45, "Choose a vehicle.");
  if (!VEHICLE_ID.test(vehicleId)) throw new Error("Choose a valid vehicle.");
  const category = requiredText(input.category, 60, "Choose a maintenance type.").toLowerCase();
  if (!SLUG.test(category)) throw new Error("Choose a valid maintenance type.");
  const preset = CAR_PRESETS.find((candidate) => candidate.slug === category);
  if (!preset) throw new Error("Choose a supported maintenance type.");
  const serviceType = optionalText(input.serviceType, 20).toLowerCase();
  if (serviceType && !SERVICE_TYPES.has(serviceType)) throw new Error("Choose a valid service source.");
  const details: Record<string, string> = {};
  if (input.details !== undefined) {
    if (!input.details || typeof input.details !== "object" || Array.isArray(input.details)) throw new Error("The maintenance details are invalid.");
    for (const [key, value] of Object.entries(input.details)) {
      if (!DETAIL_KEYS.has(key)) throw new Error("A maintenance detail is not supported.");
      const cleaned = optionalText(value, 12_000);
      if (cleaned) details[key] = cleaned;
    }
  }
  return {
    type: "vehicle-maintenance",
    id: `car_${idempotencyKey.toLowerCase()}`,
    schema_version: 1,
    created_at: new Date(input.clientCreatedAt).toISOString(),
    saved_at: savedAt.toISOString(),
    owner: "private-capture",
    privacy: "private",
    state: "completed",
    vehicle_id: vehicleId,
    service_date: validDate(input.serviceDate, "Choose a valid service date.", true),
    category,
    category_label: preset.name,
    title: optionalText(input.title, 160) || preset.suggested_title,
    ...optionalNumberProperty("odometer", input.odometer, 0, 10_000_000, "Enter a valid odometer reading."),
    ...optionalProperty("provider", input.provider, 160),
    ...(serviceType ? { service_type: serviceType } : {}),
    ...optionalNumberProperty("cost", input.cost, 0, 10_000_000, "Enter a valid total cost.", 2),
    ...optionalNumberProperty("parts_cost", input.partsCost, 0, 10_000_000, "Enter a valid parts cost.", 2),
    ...optionalNumberProperty("labor_cost", input.laborCost, 0, 10_000_000, "Enter a valid labor cost.", 2),
    ...(validDate(input.nextDueDate, "Choose a valid next-due date.") ? { next_due_date: input.nextDueDate } : {}),
    ...optionalNumberProperty("next_due_odometer", input.nextDueOdometer, 0, 10_000_000, "Enter a valid next-due odometer."),
    ...(validDate(input.warrantyUntilDate, "Choose a valid warranty date.") ? { warranty_until_date: input.warrantyUntilDate } : {}),
    ...optionalNumberProperty("warranty_until_odometer", input.warrantyUntilOdometer, 0, 10_000_000, "Enter a valid warranty odometer."),
    ...optionalProperty("receipt_reference", input.receiptReference, 500),
    details,
    body: typeof input.notes === "string" ? input.notes.slice(0, 250_000) : "",
  };
}

const PROFILE_ORDER: Array<keyof Omit<VehicleProfileRecord, "body">> = [
  "type", "id", "schema_version", "created_at", "saved_at", "owner", "privacy", "state", "display_name", "year", "make", "model", "distance_unit", "currency", "owner_manual_url",
];
const EVENT_ORDER: Array<keyof Omit<VehicleEventRecord, "body">> = [
  "type", "id", "schema_version", "created_at", "saved_at", "owner", "privacy", "state", "vehicle_id", "service_date", "category", "category_label", "title", "odometer", "provider", "service_type", "cost", "parts_cost", "labor_cost", "next_due_date", "next_due_odometer", "warranty_until_date", "warranty_until_odometer", "receipt_reference", "details",
];

export function renderVehicleProfile(record: VehicleProfileRecord) {
  return renderRecord(record, PROFILE_ORDER);
}

export function renderVehicleEvent(record: VehicleEventRecord) {
  return renderRecord(record, EVENT_ORDER);
}

export function parseVehicleProfile(markdown: string): VehicleProfileRecord | null {
  const parsed = parseRecord(markdown);
  if (!parsed || parsed.fields.type !== "vehicle-profile" || parsed.fields.schema_version !== 1) return null;
  const fields = parsed.fields;
  if (typeof fields.id !== "string" || !VEHICLE_ID.test(fields.id)) return null;
  if (fields.owner !== "private-capture" || fields.privacy !== "private" || fields.state !== "active") return null;
  if (!isIsoTimestamp(fields.created_at) || !isIsoTimestamp(fields.saved_at)) return null;
  if (typeof fields.display_name !== "string" || !fields.display_name) return null;
  if (!["mi", "km"].includes(String(fields.distance_unit)) || typeof fields.currency !== "string") return null;
  return { ...fields, body: parsed.body } as VehicleProfileRecord;
}

export function parseVehicleEvent(markdown: string): VehicleEventRecord | null {
  const parsed = parseRecord(markdown);
  if (!parsed || parsed.fields.type !== "vehicle-maintenance" || parsed.fields.schema_version !== 1) return null;
  const fields = parsed.fields;
  if (typeof fields.id !== "string" || !EVENT_ID.test(fields.id)) return null;
  if (typeof fields.vehicle_id !== "string" || !VEHICLE_ID.test(fields.vehicle_id)) return null;
  if (typeof fields.service_date !== "string" || !isValidDate(fields.service_date)) return null;
  if (typeof fields.category !== "string" || !CAR_PRESETS.some((preset) => preset.slug === fields.category)) return null;
  if (typeof fields.category_label !== "string" || typeof fields.title !== "string") return null;
  if (fields.owner !== "private-capture" || fields.privacy !== "private" || fields.state !== "completed") return null;
  if (!isIsoTimestamp(fields.created_at) || !isIsoTimestamp(fields.saved_at)) return null;
  const details = fields.details && typeof fields.details === "object" && !Array.isArray(fields.details)
    ? Object.fromEntries(Object.entries(fields.details).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  return { ...fields, details, body: parsed.body } as VehicleEventRecord;
}

export function vehicleFilename(record: VehicleProfileRecord) {
  const shortId = record.id.slice("vehicle_".length, "vehicle_".length + 8);
  return `${record.created_at.slice(0, 10)}--vehicle--${slugify(record.display_name)}--${shortId}.md`;
}

export function vehicleEventFilename(record: VehicleEventRecord) {
  const shortId = record.id.slice("car_".length, "car_".length + 8);
  return `${record.service_date}--car--${slugify(record.title)}--${shortId}.md`;
}

function renderRecord(record: VehicleProfileRecord | VehicleEventRecord, order: string[]) {
  const source = record as unknown as Record<string, unknown>;
  const lines = order.flatMap((key) => source[key] === undefined ? [] : [`${key}: ${yamlValue(source[key])}`]);
  return `---\n${lines.join("\n")}\n---\n${record.body}`;
}

function parseRecord(markdown: string) {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  if (!markdown.startsWith(`---${newline}`)) return null;
  const boundary = markdown.indexOf(`${newline}---${newline}`, 4);
  if (boundary < 0) return null;
  const fields: Record<string, unknown> = {};
  for (const line of markdown.slice(4, boundary).split(newline)) {
    const separator = line.indexOf(":");
    if (separator > 0) fields[line.slice(0, separator).trim()] = parseYamlValue(line.slice(separator + 1));
  }
  return { fields, body: markdown.slice(boundary + `${newline}---${newline}`.length) };
}

function yamlValue(value: unknown) {
  return typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value);
}

function parseYamlValue(value: string): unknown {
  const trimmed = value.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

function optionalText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requiredText(value: unknown, max: number, message: string) {
  const cleaned = optionalText(value, max);
  if (!cleaned) throw new Error(message);
  return cleaned;
}

function optionalProperty(key: string, value: unknown, max: number) {
  const cleaned = optionalText(value, max);
  return cleaned ? { [key]: cleaned } : {};
}

function optionalNumberProperty(key: string, value: unknown, minimum: number, maximum: number, message: string, decimalPlaces?: number) {
  if (value === undefined || value === null || value === "") return {};
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(message);
  const normalized = decimalPlaces === undefined ? Math.round(number) : Number(number.toFixed(decimalPlaces));
  return { [key]: normalized };
}

function optionalWholeNumber(value: unknown, minimum: number, maximum: number, message: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(message);
  return number;
}

function validDate(value: unknown, message: string, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(message);
    return "";
  }
  if (typeof value !== "string" || !isValidDate(value)) throw new Error(message);
  return value;
}

function isValidDate(value: string) {
  return DATE_ONLY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function optionalHttpsUrl(value: unknown, message: string) {
  const cleaned = optionalText(value, 2_000);
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:") throw new Error(message);
    return parsed.toString();
  } catch {
    throw new Error(message);
  }
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "vehicle";
}
