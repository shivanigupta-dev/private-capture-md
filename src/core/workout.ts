import { isIsoTimestamp, validateIdempotencyKey } from "./records.ts";

export type ExerciseDefinition = {
  id: string;
  name: string;
  group: "Lower body" | "Push" | "Pull" | "Full body" | "Core";
};

export const EXERCISES: ExerciseDefinition[] = [
  { id: "barbell-back-squat", name: "Barbell back squat", group: "Lower body" },
  { id: "front-squat", name: "Front squat", group: "Lower body" },
  { id: "goblet-squat", name: "Goblet squat", group: "Lower body" },
  { id: "romanian-deadlift", name: "Romanian deadlift", group: "Lower body" },
  { id: "hip-thrust", name: "Hip thrust", group: "Lower body" },
  { id: "leg-press", name: "Leg press", group: "Lower body" },
  { id: "lunge", name: "Lunge", group: "Lower body" },
  { id: "split-squat", name: "Bulgarian split squat", group: "Lower body" },
  { id: "calf-raise", name: "Calf raise", group: "Lower body" },
  { id: "barbell-bench-press", name: "Barbell bench press", group: "Push" },
  { id: "dumbbell-bench-press", name: "Dumbbell bench press", group: "Push" },
  { id: "incline-bench-press", name: "Incline bench press", group: "Push" },
  { id: "overhead-press", name: "Overhead press", group: "Push" },
  { id: "push-up", name: "Push-up", group: "Push" },
  { id: "dip", name: "Dip", group: "Push" },
  { id: "deadlift", name: "Deadlift", group: "Pull" },
  { id: "barbell-row", name: "Barbell row", group: "Pull" },
  { id: "dumbbell-row", name: "Dumbbell row", group: "Pull" },
  { id: "pull-up", name: "Pull-up", group: "Pull" },
  { id: "weighted-pull-up", name: "Weighted pull-up", group: "Pull" },
  { id: "lat-pulldown", name: "Lat pulldown", group: "Pull" },
  { id: "cable-row", name: "Seated cable row", group: "Pull" },
  { id: "power-clean", name: "Power clean", group: "Full body" },
  { id: "kettlebell-swing", name: "Kettlebell swing", group: "Full body" },
  { id: "farmers-carry", name: "Farmer's carry", group: "Full body" },
  { id: "plank", name: "Plank", group: "Core" },
  { id: "hanging-knee-raise", name: "Hanging knee raise", group: "Core" },
  { id: "other", name: "Custom exercise", group: "Full body" },
];

export type ClimbGradeSystem = {
  slug: string;
  name: string;
  grades: string[];
};

const ydsGrades = ["5.5", "5.6", "5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c", "5.11d", "5.12a", "5.12b", "5.12c", "5.12d", "5.13a", "5.13b", "5.13c", "5.13d", "5.14a", "5.14b", "5.14c", "5.14d", "5.15a", "5.15b", "5.15c", "5.15d"];

export const CLIMB_GRADE_SYSTEMS: ClimbGradeSystem[] = [
  { slug: "v-scale", name: "V-scale · bouldering", grades: ["VB", ...Array.from({ length: 18 }, (_, index) => `V${index}`)] },
  { slug: "yds", name: "YDS · roped", grades: ydsGrades },
  { slug: "font", name: "Font · bouldering", grades: ["3", "4", "4+", "5", "5+", "6A", "6A+", "6B", "6B+", "6C", "6C+", "7A", "7A+", "7B", "7B+", "7C", "7C+", "8A", "8A+", "8B", "8B+", "8C", "8C+", "9A"] },
  { slug: "french", name: "French · roped", grades: ["3", "4", "5a", "5b", "5c", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "8c", "8c+", "9a", "9a+"] },
  { slug: "gym-color", name: "Gym color / custom", grades: [] },
];

export const RUN_TYPES = [
  { value: "easy", label: "Easy" },
  { value: "long", label: "Long run" },
  { value: "tempo", label: "Tempo" },
  { value: "intervals", label: "Intervals" },
  { value: "trail", label: "Trail" },
  { value: "race", label: "Race" },
  { value: "other", label: "Other" },
];

export type LiftSet = {
  reps: number;
  weight?: number;
  rpe?: number;
  set_type?: "work" | "warm-up" | "drop" | "failure";
};

export type WorkoutInput = {
  activityDate: string;
  activityTime?: string;
  activityType: "lift" | "climb" | "run";
  title?: string;
  notes?: string;
  clientCreatedAt: string;
  exerciseId?: string;
  exerciseName?: string;
  weightUnit?: "lb" | "kg";
  sets?: Array<{ reps?: number; weight?: number; rpe?: number; setType?: string }>;
  climbStyle?: string;
  gradeSystem?: string;
  grade?: string;
  climbOutcome?: string;
  attempts?: number;
  venue?: string;
  routeName?: string;
  wallAngle?: string;
  distance?: number;
  distanceUnit?: "mi" | "km";
  durationSeconds?: number;
  runType?: string;
  elevationGain?: number;
  elevationUnit?: "ft" | "m";
  perceivedEffort?: number;
};

export type WorkoutRecord = {
  type: "workout-entry";
  id: string;
  schema_version: 1;
  created_at: string;
  saved_at: string;
  owner: "private-capture";
  privacy: "private";
  state: "completed";
  activity_date: string;
  activity_time?: string;
  activity_type: "lift" | "climb" | "run";
  title: string;
  exercise_id?: string;
  exercise_name?: string;
  weight_unit?: "lb" | "kg";
  sets?: LiftSet[];
  climb_style?: string;
  grade_system?: string;
  grade?: string;
  grade_rank?: number;
  climb_outcome?: "flash" | "send" | "attempt" | "project";
  attempts?: number;
  venue?: string;
  route_name?: string;
  wall_angle?: string;
  distance?: number;
  distance_unit?: "mi" | "km";
  duration_seconds?: number;
  run_type?: string;
  elevation_gain?: number;
  elevation_unit?: "ft" | "m";
  perceived_effort?: number;
  body: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WORKOUT_ID = /^workout_[0-9a-f-]{36}$/i;
const CLIMB_STYLES = new Set(["boulder", "top-rope", "lead", "sport", "trad", "board"]);
const CLIMB_OUTCOMES = new Set(["flash", "send", "attempt", "project"]);
const SET_TYPES = new Set(["work", "warm-up", "drop", "failure"]);

export function buildWorkout(input: WorkoutInput, idempotencyKey: string, savedAt = new Date()): WorkoutRecord {
  validateIdempotencyKey(idempotencyKey);
  if (!input || typeof input !== "object") throw new Error("The workout entry is missing.");
  if (!isIsoTimestamp(input.clientCreatedAt)) throw new Error("The client creation time must be an ISO timestamp with a timezone.");
  const activityDate = validDate(input.activityDate, "Choose a valid workout date.", true);
  const activityTime = optionalMatch(input.activityTime, TIME_ONLY, "Choose a valid workout time.");
  if (!["lift", "climb", "run"].includes(input.activityType)) throw new Error("Choose lift, climb, or run.");
  const common = {
    type: "workout-entry" as const,
    id: `workout_${idempotencyKey.toLowerCase()}`,
    schema_version: 1 as const,
    created_at: new Date(input.clientCreatedAt).toISOString(),
    saved_at: savedAt.toISOString(),
    owner: "private-capture" as const,
    privacy: "private" as const,
    state: "completed" as const,
    activity_date: activityDate,
    ...(activityTime ? { activity_time: activityTime } : {}),
    activity_type: input.activityType,
    body: typeof input.notes === "string" ? input.notes.slice(0, 250_000) : "",
  };
  if (input.activityType === "lift") return { ...common, ...validateLift(input) };
  if (input.activityType === "climb") return { ...common, ...validateClimb(input) };
  return { ...common, ...validateRun(input) };
}

function validateLift(input: WorkoutInput) {
  const exerciseId = requiredText(input.exerciseId, 80, "Choose an exercise.").toLowerCase();
  const definition = EXERCISES.find((exercise) => exercise.id === exerciseId);
  if (!definition) throw new Error("Choose a supported exercise.");
  const exerciseName = exerciseId === "other" ? requiredText(input.exerciseName, 120, "Name the custom exercise.") : definition.name;
  const weightUnit = input.weightUnit || "lb";
  if (!["lb", "kg"].includes(weightUnit)) throw new Error("Choose pounds or kilograms.");
  if (!Array.isArray(input.sets) || input.sets.length < 1 || input.sets.length > 30) throw new Error("Add at least one set.");
  const sets: LiftSet[] = input.sets.map((set) => {
    if (!set || typeof set !== "object") throw new Error("A lift set is invalid.");
    const reps = wholeNumber(set.reps, 1, 1_000, "Enter valid reps for every set.");
    const weight = optionalNumber(set.weight, 0, 100_000, "Enter a valid set weight.", 2);
    const rpe = optionalNumber(set.rpe, 1, 10, "RPE must be between 1 and 10.", 1);
    const setType = optionalText(set.setType, 20) || "work";
    if (!SET_TYPES.has(setType)) throw new Error("Choose a valid set type.");
    return { reps, ...(weight !== undefined ? { weight } : {}), ...(rpe !== undefined ? { rpe } : {}), set_type: setType as LiftSet["set_type"] };
  });
  return {
    title: optionalText(input.title, 160) || exerciseName,
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    weight_unit: weightUnit,
    sets,
  };
}

function validateClimb(input: WorkoutInput) {
  const climbStyle = requiredText(input.climbStyle, 30, "Choose a climb style.").toLowerCase();
  if (!CLIMB_STYLES.has(climbStyle)) throw new Error("Choose a valid climb style.");
  const gradeSystem = requiredText(input.gradeSystem, 30, "Choose a grade system.").toLowerCase();
  const system = CLIMB_GRADE_SYSTEMS.find((candidate) => candidate.slug === gradeSystem);
  if (!system) throw new Error("Choose a valid grade system.");
  const grade = requiredText(input.grade, 30, "Choose or enter a grade.");
  const gradeRank = system.grades.findIndex((candidate) => candidate.toLowerCase() === grade.toLowerCase());
  if (system.grades.length && gradeRank < 0) throw new Error("Choose a grade from the selected system.");
  const outcome = requiredText(input.climbOutcome, 20, "Choose the climb outcome.").toLowerCase();
  if (!CLIMB_OUTCOMES.has(outcome)) throw new Error("Choose flash, send, attempt, or project.");
  const attempts = wholeNumber(input.attempts ?? 1, 1, 10_000, "Enter a valid number of attempts.");
  const routeName = optionalText(input.routeName, 160);
  return {
    title: optionalText(input.title, 160) || routeName || `${grade} ${climbStyle.replace("-", " ")}`,
    climb_style: climbStyle,
    grade_system: gradeSystem,
    grade,
    ...(gradeRank >= 0 ? { grade_rank: gradeRank } : {}),
    climb_outcome: outcome as WorkoutRecord["climb_outcome"],
    attempts,
    ...optionalProperty("venue", input.venue, 160),
    ...(routeName ? { route_name: routeName } : {}),
    ...optionalProperty("wall_angle", input.wallAngle, 60),
  };
}

function validateRun(input: WorkoutInput) {
  const distance = optionalNumber(input.distance, 0.01, 10_000, "Enter a valid run distance.", 3);
  if (distance === undefined) throw new Error("Enter the run distance.");
  const distanceUnit = input.distanceUnit || "mi";
  if (!["mi", "km"].includes(distanceUnit)) throw new Error("Choose miles or kilometers.");
  const durationSeconds = wholeNumber(input.durationSeconds, 1, 7 * 24 * 60 * 60, "Enter a valid run duration.");
  const runType = optionalText(input.runType, 30) || "easy";
  if (!RUN_TYPES.some((candidate) => candidate.value === runType)) throw new Error("Choose a valid run type.");
  const elevationGain = optionalNumber(input.elevationGain, 0, 100_000, "Enter a valid elevation gain.", 1);
  const elevationUnit = input.elevationUnit || (distanceUnit === "mi" ? "ft" : "m");
  if (!["ft", "m"].includes(elevationUnit)) throw new Error("Choose feet or meters for elevation.");
  const perceivedEffort = optionalNumber(input.perceivedEffort, 1, 10, "Effort must be between 1 and 10.", 1);
  const typeLabel = RUN_TYPES.find((candidate) => candidate.value === runType)?.label || "Run";
  return {
    title: optionalText(input.title, 160) || `${typeLabel} run`,
    distance,
    distance_unit: distanceUnit,
    duration_seconds: durationSeconds,
    run_type: runType,
    ...(elevationGain !== undefined ? { elevation_gain: elevationGain, elevation_unit: elevationUnit as "ft" | "m" } : {}),
    ...(perceivedEffort !== undefined ? { perceived_effort: perceivedEffort } : {}),
  };
}

const FIELD_ORDER: Array<keyof Omit<WorkoutRecord, "body">> = [
  "type", "id", "schema_version", "created_at", "saved_at", "owner", "privacy", "state", "activity_date", "activity_time", "activity_type", "title",
  "exercise_id", "exercise_name", "weight_unit", "sets", "climb_style", "grade_system", "grade", "grade_rank", "climb_outcome", "attempts", "venue", "route_name", "wall_angle",
  "distance", "distance_unit", "duration_seconds", "run_type", "elevation_gain", "elevation_unit", "perceived_effort",
];

export function renderWorkout(record: WorkoutRecord) {
  const lines = FIELD_ORDER.flatMap((key) => record[key] === undefined ? [] : [`${key}: ${yamlValue(record[key])}`]);
  return `---\n${lines.join("\n")}\n---\n${record.body}`;
}

export function parseWorkout(markdown: string): WorkoutRecord | null {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  if (!markdown.startsWith(`---${newline}`)) return null;
  const boundary = markdown.indexOf(`${newline}---${newline}`, 4);
  if (boundary < 0) return null;
  const fields: Record<string, unknown> = {};
  for (const line of markdown.slice(4, boundary).split(newline)) {
    const separator = line.indexOf(":");
    if (separator > 0) fields[line.slice(0, separator).trim()] = parseYamlValue(line.slice(separator + 1));
  }
  if (fields.type !== "workout-entry" || fields.schema_version !== 1) return null;
  if (typeof fields.id !== "string" || !WORKOUT_ID.test(fields.id)) return null;
  if (fields.owner !== "private-capture" || fields.privacy !== "private" || fields.state !== "completed") return null;
  if (!isIsoTimestamp(fields.created_at) || !isIsoTimestamp(fields.saved_at)) return null;
  if (typeof fields.activity_date !== "string" || !isValidDate(fields.activity_date)) return null;
  if (!["lift", "climb", "run"].includes(String(fields.activity_type)) || typeof fields.title !== "string") return null;
  if (fields.activity_type === "lift" && (!Array.isArray(fields.sets) || typeof fields.exercise_name !== "string")) return null;
  return { ...fields, body: markdown.slice(boundary + `${newline}---${newline}`.length) } as WorkoutRecord;
}

export function workoutFilename(record: WorkoutRecord) {
  const slug = record.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || record.activity_type;
  return `${record.activity_date}--workout--${slug}--${record.id.slice("workout_".length, "workout_".length + 8)}.md`;
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

function optionalNumber(value: unknown, minimum: number, maximum: number, message: string, decimalPlaces = 2) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(message);
  return Number(number.toFixed(decimalPlaces));
}

function wholeNumber(value: unknown, minimum: number, maximum: number, message: string) {
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

function optionalMatch(value: unknown, pattern: RegExp, message: string) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(message);
  return value;
}
