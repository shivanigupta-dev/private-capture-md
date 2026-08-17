import { isIsoTimestamp, validateIdempotencyKey } from "./records.ts";

export type HealthFieldDefinition = {
  key: string;
  label: string;
  kind: "text" | "textarea";
};

export type HealthCategoryDefinition = {
  slug: string;
  name: string;
  group: "therapy" | "preventive" | "symptom" | "care";
  tone: string;
  fields: HealthFieldDefinition[];
};

const field = (key: string, label: string, kind: "text" | "textarea" = "textarea"): HealthFieldDefinition => ({ key, label, kind });

const PREVENTIVE_FIELDS = [
  field("findings", "Findings"),
  field("tests_performed", "Tests performed"),
  field("labs_ordered", "Labs ordered"),
  field("preventive_screenings", "Preventive screenings"),
  field("vaccinations", "Vaccinations discussed or received"),
  field("follow_up_items", "Follow-up items"),
];

export const HEALTH_CATEGORIES: HealthCategoryDefinition[] = [
  {
    slug: "pelvic-floor-therapy",
    name: "Pelvic Floor Therapy",
    group: "therapy",
    tone: "plum",
    fields: [
      field("worked_on", "What we worked on"),
      field("symptoms_before", "Symptoms before the session"),
      field("symptoms_after", "Symptoms after the session"),
      field("pain_discomfort", "Pain or discomfort (optional)", "text"),
      field("exercises_assigned", "Exercises assigned"),
      field("home_exercises", "Home exercises"),
      field("sets_reps_duration", "Sets, reps, or duration", "text"),
      field("techniques_used", "Techniques used"),
      field("progress_since_previous", "Progress since the previous session"),
      field("things_improved", "Things that improved"),
      field("things_worse", "Things that became worse"),
      field("next_session_questions", "Questions for my next session"),
      field("therapist_recommendations", "Therapist recommendations"),
    ],
  },
  {
    slug: "physical-therapy",
    name: "Physical Therapy / PT",
    group: "therapy",
    tone: "teal",
    fields: [
      field("injury_body_area", "Injury or body area", "text"),
      field("session_notes", "Session notes"),
      field("exercises", "Exercises"),
      field("sets_reps_resistance", "Sets, reps, or resistance", "text"),
      field("mobility", "Mobility"),
      field("strength", "Strength"),
      field("pain_discomfort", "Pain or discomfort (optional)", "text"),
      field("home_exercise_program", "Home exercise program"),
      field("restrictions", "Restrictions"),
      field("goals", "Goals"),
    ],
  },
  { slug: "primary-care", name: "Primary Care", group: "care", tone: "sage", fields: [] },
  { slug: "annual-physical", name: "Annual Physical / Wellness Exam", group: "preventive", tone: "sage", fields: PREVENTIVE_FIELDS },
  { slug: "gynecology", name: "OB/GYN / Gynecology", group: "preventive", tone: "rose", fields: PREVENTIVE_FIELDS },
  {
    slug: "dental",
    name: "Dental",
    group: "preventive",
    tone: "sky",
    fields: [
      field("cleaning_exam", "Cleaning, exam, or treatment", "text"),
      field("x_rays", "X-rays", "text"),
      field("cavities_fillings_crowns", "Cavities, fillings, or crowns"),
      field("periodontal_notes", "Gum / periodontal notes"),
      field("tooth_notes", "Tooth-specific notes"),
      field("treatment_plan", "Treatment plan"),
      ...PREVENTIVE_FIELDS,
    ],
  },
  { slug: "vision", name: "Vision / Eye Care", group: "preventive", tone: "violet", fields: PREVENTIVE_FIELDS },
  { slug: "specialist", name: "Specialist Visit", group: "care", tone: "amber", fields: [] },
  { slug: "urgent-care", name: "Urgent Care", group: "care", tone: "coral", fields: [] },
  { slug: "lab-work", name: "Lab Work", group: "care", tone: "slate", fields: [field("tests", "Tests"), field("results_notes", "Results notes")] },
  { slug: "imaging", name: "Imaging", group: "care", tone: "indigo", fields: [field("imaging_type", "Imaging type", "text"), field("results_notes", "Results notes")] },
  { slug: "procedure", name: "Procedure", group: "care", tone: "copper", fields: [field("procedure_name", "Procedure", "text"), field("preparation", "Preparation"), field("recovery_notes", "Recovery notes")] },
  { slug: "medication", name: "Medication", group: "care", tone: "mint", fields: [field("medication_name", "Medication", "text"), field("dose_schedule", "Dose or schedule", "text"), field("response", "Response or notes")] },
  {
    slug: "symptoms",
    name: "Symptoms",
    group: "symptom",
    tone: "peach",
    fields: [
      field("symptom", "Symptom", "text"),
      field("description", "Description"),
      field("severity", "Severity (optional)", "text"),
      field("duration", "Duration", "text"),
      field("location", "Location", "text"),
      field("possible_triggers", "Possible triggers"),
      field("what_helped", "What helped"),
      field("what_worsened", "What made it worse"),
    ],
  },
  { slug: "vaccination", name: "Vaccination", group: "preventive", tone: "teal", fields: PREVENTIVE_FIELDS },
  { slug: "mental-wellness", name: "Mental / Emotional Wellness", group: "care", tone: "lavender", fields: [] },
  { slug: "other", name: "Other", group: "care", tone: "stone", fields: [] },
];

export type HealthEventInput = {
  eventDate: string;
  eventTime?: string;
  category: string;
  categoryLabel?: string;
  title?: string;
  provider?: string;
  facility?: string;
  appointmentType?: string;
  reason?: string;
  notes?: string;
  symptoms?: string;
  questions?: string;
  discussed?: string;
  treatment?: string;
  recommendations?: string;
  progressNotes?: string;
  followUpNeeded?: boolean;
  followUpDate?: string;
  nextAppointment?: string;
  recurrenceMonths?: number;
  nextDueDate?: string;
  relatedEventId?: string;
  tags?: string[];
  details?: Record<string, string>;
  clientCreatedAt: string;
};

export type HealthEventRecord = {
  type: "health-event";
  id: string;
  event_id: string;
  revision: number;
  revises?: string;
  schema_version: 1;
  created_at: string;
  updated_at: string;
  saved_at: string;
  owner: "private-capture";
  privacy: "private";
  state: "active";
  event_date: string;
  event_time?: string;
  category: string;
  category_label: string;
  title: string;
  provider?: string;
  facility?: string;
  appointment_type?: string;
  reason?: string;
  symptoms?: string;
  questions?: string;
  discussed?: string;
  treatment?: string;
  recommendations?: string;
  progress_notes?: string;
  follow_up_needed: boolean;
  follow_up_date?: string;
  next_appointment?: string;
  recurrence_months?: number;
  next_due_date?: string;
  related_event_id?: string;
  tags: string[];
  details: Record<string, string>;
  body: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;
const HEALTH_ID = /^health_[0-9a-f-]{36}$/i;
const HEALTH_RECORD_ID = /^health(?:rev)?_[0-9a-f-]{36}$/i;
const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DETAIL_KEYS = new Set(HEALTH_CATEGORIES.flatMap((category) => category.fields.map((definition) => definition.key)));

export function buildHealthEvent(input: HealthEventInput, idempotencyKey: string, savedAt = new Date()): HealthEventRecord {
  validateIdempotencyKey(idempotencyKey);
  const normalized = validateHealthInput(input);
  const eventId = `health_${idempotencyKey.toLowerCase()}`;
  return {
    type: "health-event",
    id: eventId,
    event_id: eventId,
    revision: 1,
    schema_version: 1,
    created_at: normalized.clientCreatedAt,
    updated_at: normalized.clientCreatedAt,
    saved_at: savedAt.toISOString(),
    owner: "private-capture",
    privacy: "private",
    state: "active",
    ...normalized.record,
  };
}

export function buildHealthRevision(previous: HealthEventRecord, input: HealthEventInput, idempotencyKey: string, savedAt = new Date()): HealthEventRecord {
  validateIdempotencyKey(idempotencyKey);
  const normalized = validateHealthInput(input);
  return {
    type: "health-event",
    id: `healthrev_${idempotencyKey.toLowerCase()}`,
    event_id: previous.event_id,
    revision: previous.revision + 1,
    revises: previous.id,
    schema_version: 1,
    created_at: previous.created_at,
    updated_at: normalized.clientCreatedAt,
    saved_at: savedAt.toISOString(),
    owner: "private-capture",
    privacy: "private",
    state: "active",
    ...normalized.record,
  };
}

function validateHealthInput(input: HealthEventInput) {
  if (!input || typeof input !== "object") throw new Error("The health entry is missing.");
  const eventDate = validDate(input.eventDate, "Choose a valid entry date.", true);
  const eventTime = optionalMatch(input.eventTime, TIME_ONLY, "Use a valid time.");
  const category = requiredText(input.category, 60, "Choose a health category.").toLowerCase();
  if (!CATEGORY_SLUG.test(category)) throw new Error("Choose a valid health category.");
  const definition = HEALTH_CATEGORIES.find((candidate) => candidate.slug === category);
  const categoryLabel = definition?.name || requiredText(input.categoryLabel, 80, "Name the custom health category.");
  const title = optionalText(input.title, 160) || categoryLabel;
  if (!isIsoTimestamp(input.clientCreatedAt)) throw new Error("The client creation time must be an ISO timestamp with a timezone.");
  const recurrenceMonths = input.recurrenceMonths === undefined || input.recurrenceMonths === null
    ? undefined
    : Number(input.recurrenceMonths);
  if (recurrenceMonths !== undefined && (!Number.isInteger(recurrenceMonths) || recurrenceMonths < 1 || recurrenceMonths > 120)) throw new Error("The return interval must be between 1 and 120 months.");
  const details: Record<string, string> = {};
  if (input.details !== undefined) {
    if (!input.details || typeof input.details !== "object" || Array.isArray(input.details)) throw new Error("The guided health details are invalid.");
    for (const [key, value] of Object.entries(input.details)) {
      if (!DETAIL_KEYS.has(key)) throw new Error("A guided health field is not supported.");
      const cleaned = optionalText(value, 12_000);
      if (cleaned) details[key] = cleaned;
    }
  }
  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag) => optionalText(tag, 40)).filter(Boolean).slice(0, 12)
    : [];
  const relatedEventId = optionalText(input.relatedEventId, 44);
  if (relatedEventId && !HEALTH_ID.test(relatedEventId)) throw new Error("The related health entry is invalid.");
  return {
    clientCreatedAt: new Date(input.clientCreatedAt).toISOString(),
    record: {
      event_date: eventDate,
      ...(eventTime ? { event_time: eventTime } : {}),
      category,
      category_label: categoryLabel,
      title,
      ...optionalProperty("provider", input.provider, 160),
      ...optionalProperty("facility", input.facility, 160),
      ...optionalProperty("appointment_type", input.appointmentType, 160),
      ...optionalProperty("reason", input.reason, 12_000),
      ...optionalProperty("symptoms", input.symptoms, 12_000),
      ...optionalProperty("questions", input.questions, 12_000),
      ...optionalProperty("discussed", input.discussed, 12_000),
      ...optionalProperty("treatment", input.treatment, 12_000),
      ...optionalProperty("recommendations", input.recommendations, 12_000),
      ...optionalProperty("progress_notes", input.progressNotes, 12_000),
      follow_up_needed: input.followUpNeeded === true,
      ...(validDate(input.followUpDate, "Choose a valid follow-up date.") ? { follow_up_date: input.followUpDate } : {}),
      ...(optionalMatch(input.nextAppointment, LOCAL_DATE_TIME, "Choose a valid next appointment.") ? { next_appointment: input.nextAppointment } : {}),
      ...(recurrenceMonths ? { recurrence_months: recurrenceMonths } : {}),
      ...(validDate(input.nextDueDate, "Choose a valid due date.") ? { next_due_date: input.nextDueDate } : {}),
      ...(relatedEventId ? { related_event_id: relatedEventId } : {}),
      tags,
      details,
      body: typeof input.notes === "string" ? input.notes.slice(0, 250_000) : "",
    },
  };
}

const FIELD_ORDER: Array<keyof Omit<HealthEventRecord, "body">> = [
  "type", "id", "event_id", "revision", "revises", "schema_version", "created_at", "updated_at", "saved_at",
  "owner", "privacy", "state", "event_date", "event_time", "category", "category_label", "title", "provider",
  "facility", "appointment_type", "reason", "symptoms", "questions", "discussed", "treatment", "recommendations", "progress_notes",
  "follow_up_needed", "follow_up_date", "next_appointment", "recurrence_months", "next_due_date", "related_event_id",
  "tags", "details",
];

export function renderHealthEvent(record: HealthEventRecord) {
  const lines = FIELD_ORDER.flatMap((key) => record[key] === undefined ? [] : [`${key}: ${yamlValue(record[key])}`]);
  return `---\n${lines.join("\n")}\n---\n${record.body}`;
}

export function parseHealthEvent(markdown: string): HealthEventRecord | null {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  if (!markdown.startsWith(`---${newline}`)) return null;
  const boundary = markdown.indexOf(`${newline}---${newline}`, 4);
  if (boundary < 0) return null;
  const fields: Record<string, unknown> = {};
  for (const line of markdown.slice(4, boundary).split(newline)) {
    const separator = line.indexOf(":");
    if (separator > 0) fields[line.slice(0, separator).trim()] = parseYamlValue(line.slice(separator + 1));
  }
  if (fields.type !== "health-event" || fields.schema_version !== 1) return null;
  if (typeof fields.id !== "string" || !HEALTH_RECORD_ID.test(fields.id)) return null;
  if (typeof fields.event_id !== "string" || !HEALTH_ID.test(fields.event_id)) return null;
  if (!Number.isInteger(fields.revision) || Number(fields.revision) < 1) return null;
  if (typeof fields.event_date !== "string" || !isValidDate(fields.event_date)) return null;
  if (typeof fields.category !== "string" || !CATEGORY_SLUG.test(fields.category)) return null;
  if (typeof fields.category_label !== "string" || typeof fields.title !== "string") return null;
  if (fields.owner !== "private-capture" || fields.privacy !== "private" || fields.state !== "active") return null;
  if (!isIsoTimestamp(fields.created_at) || !isIsoTimestamp(fields.updated_at) || !isIsoTimestamp(fields.saved_at)) return null;
  const tags = Array.isArray(fields.tags) ? fields.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const details = fields.details && typeof fields.details === "object" && !Array.isArray(fields.details)
    ? Object.fromEntries(Object.entries(fields.details).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  return { ...fields, tags, details, body: markdown.slice(boundary + `${newline}---${newline}`.length) } as HealthEventRecord;
}

export function healthFilename(record: HealthEventRecord) {
  const slug = record.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || record.category;
  const shortId = record.id.replace(/^health(?:rev)?_/, "").slice(0, 8);
  return `${record.event_date}--health--${slug}--r${record.revision}--${shortId}.md`;
}

function yamlValue(value: unknown) {
  return typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value);
}

function parseYamlValue(value: string): unknown {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
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

function optionalMatch(value: unknown, pattern: RegExp, message: string) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(message);
  return value;
}
