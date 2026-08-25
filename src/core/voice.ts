import { EXERCISES } from "./workout.ts";

export type VoiceDestination = "capture" | "health" | "car" | "workout";

export type VoiceRouteProposal = {
  destination: VoiceDestination;
  subtype?: string;
  confidence: number;
  confidence_label: "strong match" | "likely match" | "needs your choice";
  reason: string;
  transcript: string;
  fields: Record<string, unknown>;
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};

const NUMBER_TOKEN = "(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";

function parsedNumber(value?: string) {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replaceAll(",", "");
  const number = NUMBER_WORDS[normalized] ?? Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function matchNumber(text: string, pattern: RegExp) {
  return parsedNumber(text.match(pattern)?.[1]);
}

function sentenceTitle(text: string, fallback: string) {
  const first = text.split(/[.!?\n]/u).map((part) => part.trim()).find(Boolean) || fallback;
  return first.length <= 72 ? first : `${first.slice(0, 69).trimEnd()}…`;
}

function liftFields(text: string, lower: string) {
  const aliases: Array<[RegExp, string]> = [
    [/\b(?:back )?squats?\b/u, "barbell-back-squat"],
    [/\bfront squats?\b/u, "front-squat"],
    [/\bgoblet squats?\b/u, "goblet-squat"],
    [/\bromanian deadlifts?|\brdls?\b/u, "romanian-deadlift"],
    [/\bdeadlifts?\b/u, "deadlift"],
    [/\bbench(?: press(?:es)?)?\b/u, "barbell-bench-press"],
    [/\boverhead press(?:es)?\b/u, "overhead-press"],
    [/\bweighted pull[- ]?ups?\b/u, "weighted-pull-up"],
    [/\bpull[- ]?ups?\b/u, "pull-up"],
    [/\bbarbell rows?\b/u, "barbell-row"],
    [/\bdumbbell rows?\b/u, "dumbbell-row"],
    [/\blat pull[- ]?downs?\b/u, "lat-pulldown"],
    [/\bhip thrusts?\b/u, "hip-thrust"],
    [/\blunges?\b/u, "lunge"],
    [/\bplanks?\b/u, "plank"],
  ];
  const exerciseId = aliases.find(([pattern]) => pattern.test(lower))?.[1];
  const exercise = EXERCISES.find((candidate) => candidate.id === exerciseId);
  const repeated = lower.match(new RegExp(`\\b(${NUMBER_TOKEN})\\s+sets?\\s+(?:of\\s+)?(${NUMBER_TOKEN})(?:\\s+reps?)?(?:\\s+(?:at|with|x|by)\\s+\\$?(${NUMBER_TOKEN}))?(?:\\s*(pounds?|lbs?|lb|kilos?|kilograms?|kgs?|kg))?`, "u"));
  const sets = [];
  if (repeated) {
    const setCount = Math.min(30, parsedNumber(repeated[1]) || 0);
    const reps = parsedNumber(repeated[2]);
    const weight = parsedNumber(repeated[3]);
    for (let index = 0; index < setCount; index += 1) sets.push({ reps, ...(weight !== undefined ? { weight } : {}) });
  }
  const unitMatch = lower.match(/\b(pounds?|lbs?|lb|kilos?|kilograms?|kgs?|kg)\b/u)?.[1];
  const weightUnit = unitMatch && /kg|kilo/u.test(unitMatch) ? "kg" : "lb";
  return {
    ...(exercise ? { exerciseId: exercise.id, exerciseName: exercise.name } : {}),
    weightUnit,
    ...(sets.length ? { sets } : {}),
    title: exercise?.name || "Lift",
    notes: text,
  };
}

function runFields(text: string, lower: string) {
  const distanceMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kilometres?|km)\b/u);
  const distance = parsedNumber(distanceMatch?.[1]);
  const distanceUnit = distanceMatch && /km|kilomet/u.test(distanceMatch[2]) ? "km" : "mi";
  let durationSeconds: number | undefined;
  const clock = lower.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/u);
  if (clock) durationSeconds = clock[3] ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]) : Number(clock[1]) * 60 + Number(clock[2]);
  if (!durationSeconds) {
    const hours = matchNumber(lower, new RegExp(`\\b(${NUMBER_TOKEN})\\s+hours?`, "u")) || 0;
    const minutes = matchNumber(lower, new RegExp(`\\b(${NUMBER_TOKEN})\\s+minutes?`, "u")) || 0;
    const seconds = matchNumber(lower, new RegExp(`\\b(${NUMBER_TOKEN})\\s+seconds?`, "u")) || 0;
    if (hours || minutes || seconds) durationSeconds = hours * 3600 + minutes * 60 + seconds;
  }
  const runType = /\btrail\b/u.test(lower) ? "trail" : /\btempo\b/u.test(lower) ? "tempo" : /\bintervals?|repeats?\b/u.test(lower) ? "intervals" : /\blong run\b/u.test(lower) ? "long" : /\brace|raced\b/u.test(lower) ? "race" : "easy";
  return { ...(distance ? { distance } : {}), distanceUnit, ...(durationSeconds ? { durationSeconds } : {}), runType, title: runType === "easy" ? "Run" : `${runType[0].toUpperCase()}${runType.slice(1)} run`, notes: text };
}

function climbFields(text: string, lower: string) {
  const grade = text.match(/\bV(?:B|\d{1,2})\b/iu)?.[0].toUpperCase() || text.match(/\b5\.\d{1,2}[abcd]?[+-]?\b/iu)?.[0];
  const gradeSystem = grade?.startsWith("V") ? "v-scale" : grade?.startsWith("5.") ? "yds" : "gym-color";
  const climbStyle = /\bboulder|\bproblem|\bV(?:B|\d)/iu.test(text) ? "boulder" : /\blead\b/u.test(lower) ? "lead" : /\btop[ -]?rope\b/u.test(lower) ? "top-rope" : /\btrad\b/u.test(lower) ? "trad" : /\bboard\b/u.test(lower) ? "board" : "sport";
  const climbOutcome = /\bflash(?:ed)?\b/u.test(lower) ? "flash" : /\bproject(?:ing)?\b/u.test(lower) ? "project" : /\battempt(?:ed)?|\btried\b/u.test(lower) && !/\bsent|\bsend\b/u.test(lower) ? "attempt" : "send";
  const attempts = matchNumber(lower, new RegExp(`\\b(${NUMBER_TOKEN})\\s+attempts?`, "u")) || 1;
  return { climbStyle, gradeSystem, ...(grade ? { grade } : {}), climbOutcome, attempts, title: grade ? `${grade} climb` : "Climb", notes: text };
}

function carFields(text: string, lower: string) {
  const category = /\boil|oil filter\b/u.test(lower) ? "oil-filter" : /\btire|tyre|alignment|rotation\b/u.test(lower) ? "tires" : /\bbrake|rotor|caliper\b/u.test(lower) ? "brakes" : /\bbattery|alternator\b/u.test(lower) ? "battery" : /\binspection|registration|emissions\b/u.test(lower) ? "inspection-registration" : /\bcoolant|fluid|air filter|cabin filter\b/u.test(lower) ? "fluids-filters" : "repair-issue";
  const odometerMatch = lower.match(/(?:\bodometer\b|\bat\b)\s*(\d[\d,]{2,})\s*(?:miles?|mi|kilometers?|kilometres?|km)?\b/u);
  const costMatch = lower.match(/(?:\$|\bcost(?: was)?\s+|\bpaid\s+)(\d+(?:\.\d{1,2})?)/u);
  const titles: Record<string, string> = { "oil-filter": "Oil and filter change", tires: "Tire service", brakes: "Brake service", battery: "Battery service", "inspection-registration": "Inspection or registration", "fluids-filters": "Fluid or filter service", "repair-issue": "Repair or issue" };
  return { category, title: titles[category], ...(odometerMatch ? { odometer: Number(odometerMatch[1].replaceAll(",", "")) } : {}), ...(costMatch ? { cost: Number(costMatch[1]) } : {}), notes: text };
}

function healthFields(text: string, lower: string) {
  const category = /\bdentist|dental|tooth|teeth|cavity\b/u.test(lower) ? "dental" : /\bphysical therapy|\bpt session\b/u.test(lower) ? "physical-therapy" : /\bpelvic floor\b/u.test(lower) ? "pelvic-floor-therapy" : /\btherapy|therapist|counsel(?:ing|or)?\b/u.test(lower) ? "mental-wellness" : /\bmedication|medicine|prescription|dose\b/u.test(lower) ? "medication" : /\blab|blood work|test result\b/u.test(lower) ? "lab-work" : /\bvaccine|vaccination|shot\b/u.test(lower) ? "vaccination" : "symptoms";
  const severityMatch = lower.match(new RegExp(`(?:\\bseverity\\b|\\bpain\\b|\\bwas\\b|\\bis\\b)\\s*(?:a\\s*)?(${NUMBER_TOKEN})(?:\\s*(?:out of|/)\\s*10)?`, "u"));
  const severity = parsedNumber(severityMatch?.[1]);
  const title = category === "symptoms" ? sentenceTitle(text, "Symptom update") : sentenceTitle(text, "Health update");
  return { category, title, notes: text, ...(category === "symptoms" ? { symptoms: text } : {}), ...(severity !== undefined && severity <= 10 ? { details: { severity: `${severity}/10` } } : {}) };
}

export function routeVoiceTranscript(input: unknown): VoiceRouteProposal {
  if (typeof input !== "string") throw new Error("A transcript is required.");
  const transcript = input.trim();
  if (!transcript) throw new Error("A transcript is required.");
  if (transcript.length > 20_000) throw new Error("The transcript is too long.");
  const lower = transcript.toLocaleLowerCase();

  const lift = (/\bsets?|\breps?|\bpounds?|\blbs?|\bkilos?|\bkgs?\b/u.test(lower) ? 2 : 0) + (/\bsquat|deadlift|bench|press|pull[- ]?up|row|lunge|plank|lifted|lifting\b/u.test(lower) ? 4 : 0);
  const run = (/\bran|running|run|jog|pace|trail run|tempo run\b/u.test(lower) ? 4 : 0) + (/\b\d+(?:\.\d+)?\s*(?:miles?|mi|kilometers?|km)\b/u.test(lower) ? 3 : 0);
  const climb = (/\bclimb|climbed|boulder|crag|route|problem|send|sent|flash|project\b/u.test(lower) ? 4 : 0) + (/\bV(?:B|\d{1,2})\b|\b5\.\d{1,2}[abcd]?[+-]?\b/iu.test(transcript) ? 4 : 0);
  const workoutScore = Math.max(lift, run, climb);
  const workoutSubtype = workoutScore === climb ? "climb" : workoutScore === run ? "run" : "lift";
  const carScore = (/\bcar|vehicle|odometer|mileage|mechanic|shop|dashboard\b/u.test(lower) ? 3 : 0) + (/\boil change|oil filter|tire|tyre|brake|battery|registration|inspection|coolant|transmission fluid|check engine\b/u.test(lower) ? 5 : 0);
  const healthScore = (/\bhealth|doctor|dentist|therapy|therapist|symptom|pain|headache|migraine|medication|prescription|appointment|clinic|period|mood|anxiety|sleep\b/u.test(lower) ? 5 : 0) + (/\bout of 10|\/10\b/u.test(lower) ? 2 : 0);

  const candidates = [
    { destination: "workout" as const, score: workoutScore, subtype: workoutSubtype },
    { destination: "car" as const, score: carScore },
    { destination: "health" as const, score: healthScore },
  ].sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const destination: VoiceDestination = best.score >= 3 ? best.destination : "capture";
  const gap = best.score - (candidates[1]?.score || 0);
  const confidence = destination === "capture" ? 0.58 : Math.min(0.97, 0.56 + best.score * 0.045 + Math.max(0, gap) * 0.025);
  const confidenceLabel = confidence >= 0.84 ? "strong match" : confidence >= 0.68 ? "likely match" : "needs your choice";
  const subtype = destination === "workout" ? best.subtype : destination === "capture" ? (/\?\s*$/u.test(transcript) ? "question" : /\bremember to|\bneed to|\bto do\b/u.test(lower) ? "task" : "thought") : undefined;
  const fields = destination === "workout" ? (subtype === "run" ? runFields(transcript, lower) : subtype === "climb" ? climbFields(transcript, lower) : liftFields(transcript, lower)) : destination === "car" ? carFields(transcript, lower) : destination === "health" ? healthFields(transcript, lower) : { captureType: subtype, title: sentenceTitle(transcript, "Voice note"), text: transcript };
  const reason = destination === "workout" ? `${subtype === "run" ? "Run" : subtype === "climb" ? "Climb" : "Lift"} language and measurements matched your workout log.` : destination === "car" ? "Vehicle or maintenance details matched your car log." : destination === "health" ? "Health, care, or symptom language matched your health journal." : "No specialist record was a clear match, so Capture is the safest home.";

  return { destination, ...(subtype ? { subtype } : {}), confidence: Number(confidence.toFixed(2)), confidence_label: confidenceLabel, reason, transcript, fields };
}
