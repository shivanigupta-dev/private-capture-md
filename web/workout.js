const workoutView = document.querySelector("#workout-view");
const workoutCount = document.querySelector("#workout-count");
const newEntryButton = document.querySelector("#new-workout-entry");
const modeButtons = Array.from(document.querySelectorAll("[data-workout-mode]"));
const modeGlyph = document.querySelector("#workout-mode-glyph");
const quickTitle = document.querySelector("#workout-quick-title");
const quickHelp = document.querySelector("#workout-quick-help");
const quickButton = document.querySelector("#workout-quick-button");
const statOneLabel = document.querySelector("#workout-stat-one-label");
const statOne = document.querySelector("#workout-stat-one");
const statOneNote = document.querySelector("#workout-stat-one-note");
const statTwoLabel = document.querySelector("#workout-stat-two-label");
const statTwo = document.querySelector("#workout-stat-two");
const statTwoNote = document.querySelector("#workout-stat-two-note");
const statThreeLabel = document.querySelector("#workout-stat-three-label");
const statThree = document.querySelector("#workout-stat-three");
const statThreeNote = document.querySelector("#workout-stat-three-note");
const statFourLabel = document.querySelector("#workout-stat-four-label");
const statFour = document.querySelector("#workout-stat-four");
const statFourNote = document.querySelector("#workout-stat-four-note");
const progressTitle = document.querySelector("#workout-progress-title");
const progressNote = document.querySelector("#workout-progress-note");
const subjectSelect = document.querySelector("#workout-subject");
const rangeSelect = document.querySelector("#workout-range");
const chart = document.querySelector("#workout-chart");
const gridLines = chart.querySelector(".workout-grid-lines");
const chartArea = chart.querySelector(".workout-area");
const chartLine = chart.querySelector(".workout-line");
const chartPoints = chart.querySelector(".workout-points");
const chartEmpty = document.querySelector("#workout-chart-empty");
const chartHigh = document.querySelector("#workout-chart-high");
const chartMid = document.querySelector("#workout-chart-mid");
const chartLow = document.querySelector("#workout-chart-low");
const chartStart = document.querySelector("#workout-chart-start");
const chartEnd = document.querySelector("#workout-chart-end");
const chartSummary = document.querySelector("#workout-chart-summary");
const searchInput = document.querySelector("#workout-search");
const typeFilter = document.querySelector("#workout-type-filter");
const dateFrom = document.querySelector("#workout-date-from");
const dateTo = document.querySelector("#workout-date-to");
const resultsLabel = document.querySelector("#workout-results-label");
const eventList = document.querySelector("#workout-event-list");
const historyEmpty = document.querySelector("#workout-history-empty");
const logAnotherButton = document.querySelector("#workout-log-another");
const eventTemplate = document.querySelector("#workout-event-template");

const dialog = document.querySelector("#workout-dialog");
const form = document.querySelector("#workout-form");
const dialogTitle = document.querySelector("#workout-dialog-title");
const dialogSubtitle = document.querySelector("#workout-dialog-subtitle");
const closeDialogButton = document.querySelector("#close-workout-dialog");
const cancelEntryButton = document.querySelector("#cancel-workout-entry");
const saveEntryButton = document.querySelector("#save-workout-entry");
const formStatus = document.querySelector("#workout-form-status");
const typeChips = Array.from(document.querySelectorAll("[data-workout-entry-type]"));
const liftFields = document.querySelector("#workout-lift-fields");
const climbFields = document.querySelector("#workout-climb-fields");
const runFields = document.querySelector("#workout-run-fields");
const exerciseSelect = document.querySelector("#workout-exercise");
const customExerciseWrap = document.querySelector("#workout-custom-exercise-wrap");
const previousPanel = document.querySelector("#workout-previous");
const previousText = previousPanel.querySelector("p");
const usePreviousButton = previousPanel.querySelector("button");
const setRows = document.querySelector("#workout-set-rows");
const addSetButton = document.querySelector("#workout-add-set");
const volumePreview = document.querySelector("#workout-volume-preview");
const gradeSystemSelect = document.querySelector("#workout-grade-system");
const gradeSelect = document.querySelector("#workout-grade");
const gradeSelectWrap = document.querySelector("#workout-grade-select-wrap");
const customGradeWrap = document.querySelector("#workout-custom-grade-wrap");
const customGradeInput = document.querySelector("#workout-custom-grade");
const outcomeButtons = Array.from(document.querySelectorAll("[data-climb-outcome]"));
const runTypeSelect = document.querySelector("#workout-run-type");
const pacePreview = document.querySelector("#workout-pace-preview");

const WORKOUT_INTENT_KEY = "private-capture-workout-save-intent-v1";
const MODE_COPY = {
  lift: { glyph: "↗", title: "What did you lift?", help: "Choose an exercise, enter the sets, and you’re done.", button: "Log a lift" },
  climb: { glyph: "◇", title: "What did you climb?", help: "Grade, attempts, and outcome—beta can stay in your notes.", button: "Log a climb" },
  run: { glyph: "≈", title: "Where did your feet take you?", help: "Distance and duration are enough; pace is calculated for you.", button: "Log a run" },
};

let metadata = { exercises: [], climb_grade_systems: [], run_types: [] };
let events = [];
let activeMode = "lift";
let entryType = "lift";
let climbOutcome = "send";
let writeEnabled = false;
let loaded = false;
let loading = null;
let searchTimer;
let previousLift = null;

class WorkoutApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function workoutApi(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new WorkoutApiError(payload.error?.message || "The workout tracker could not be updated.", response.status);
  return payload;
}

async function loadWorkouts(force = false) {
  if (loading && !force) return loading;
  loading = Promise.all([workoutApi("/api/v1/workout/meta"), workoutApi("/api/v1/workout-events")]).then(([meta, listing]) => {
    metadata = meta;
    events = listing.events;
    loaded = true;
    renderFormOptions();
    renderWorkout();
  }).catch((error) => {
    resultsLabel.textContent = error instanceof Error ? error.message : "The workout tracker could not be loaded.";
  }).finally(() => { loading = null; });
  return loading;
}

function activate() {
  if (!loaded) void loadWorkouts();
  else renderWorkout();
}

window.workoutTracker = { activate, openVoiceDraft };

window.addEventListener("private-capture:write-state", (event) => {
  writeEnabled = event.detail?.enabled === true;
  [newEntryButton, quickButton, saveEntryButton].forEach((button) => { button.disabled = !writeEnabled; });
});

function renderFormOptions() {
  const currentExercise = exerciseSelect.value;
  exerciseSelect.replaceChildren();
  const groups = [...new Set(metadata.exercises.map((exercise) => exercise.group))];
  groups.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group;
    metadata.exercises.filter((exercise) => exercise.group === group).forEach((exercise) => optgroup.append(option(exercise.id, exercise.name)));
    exerciseSelect.append(optgroup);
  });
  exerciseSelect.value = metadata.exercises.some((exercise) => exercise.id === currentExercise) ? currentExercise : metadata.exercises[0]?.id || "";
  gradeSystemSelect.replaceChildren(...metadata.climb_grade_systems.map((system) => option(system.slug, system.name)));
  runTypeSelect.replaceChildren(...metadata.run_types.map((type) => option(type.value, type.label)));
  renderGrades();
  renderProgressSubjects();
}

function setMode(mode, syncFilter = true) {
  activeMode = ["lift", "climb", "run"].includes(mode) ? mode : "lift";
  workoutView.dataset.mode = activeMode;
  modeButtons.forEach((button) => {
    const selected = button.dataset.workoutMode === activeMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const copy = MODE_COPY[activeMode];
  modeGlyph.textContent = copy.glyph;
  quickTitle.textContent = copy.title;
  quickHelp.textContent = copy.help;
  quickButton.replaceChildren(document.createTextNode(`${copy.button} `), arrow());
  if (syncFilter) typeFilter.value = activeMode;
  renderProgressSubjects();
  renderStats();
  renderChart();
  renderHistory();
}

function renderWorkout() {
  workoutCount.textContent = String(events.length);
  setMode(activeMode, typeFilter.value === "" || typeFilter.value === activeMode);
}

function renderStats() {
  const selected = events.filter((event) => event.activity_type === activeMode);
  const last30 = selected.filter((event) => dayDifference(event.activity_date, localDate()) <= 30 && event.activity_date <= localDate());
  const latest = selected[0];
  if (activeMode === "lift") {
    const latestBest = latest ? bestSet(latest) : null;
    statOneLabel.textContent = "RECENT BEST";
    statOne.textContent = latestBest?.weight !== undefined ? `${formatNumber(latestBest.weight)} ${latest.weight_unit}` : "—";
    statOneNote.textContent = latest?.exercise_name || "No lifts yet";
    statTwoLabel.textContent = "LIFT ENTRIES";
    statTwo.textContent = String(last30.length);
    statTwoNote.textContent = "Last 30 days";
    statThreeLabel.textContent = "LAST LOGGED";
    statThree.textContent = latest ? formatDateShort(latest.activity_date) : "—";
    statThreeNote.textContent = latest?.exercise_name || "Ready when you are";
    statFourLabel.textContent = "EXERCISES TRACKED";
    statFour.textContent = String(new Set(selected.map(exerciseKey)).size);
    statFourNote.textContent = "Across your history";
  } else if (activeMode === "climb") {
    const sends = selected.filter((event) => ["flash", "send"].includes(event.climb_outcome));
    const hardest = sends.filter((event) => Number.isFinite(event.grade_rank)).sort((a, b) => b.grade_rank - a.grade_rank)[0];
    statOneLabel.textContent = "HARDEST SEND";
    statOne.textContent = hardest?.grade || "—";
    statOneNote.textContent = hardest ? gradeSystemName(hardest.grade_system) : "No sends yet";
    statTwoLabel.textContent = "CLIMBS LOGGED";
    statTwo.textContent = String(last30.length);
    statTwoNote.textContent = "Last 30 days";
    statThreeLabel.textContent = "LAST LOGGED";
    statThree.textContent = latest ? formatDateShort(latest.activity_date) : "—";
    statThreeNote.textContent = latest ? [latest.grade, latest.venue].filter(Boolean).join(" · ") : "Ready when you are";
    statFourLabel.textContent = "SEND RATE";
    statFour.textContent = selected.length ? `${Math.round((sends.length / selected.length) * 100)}%` : "—";
    statFourNote.textContent = "Flash + send entries";
  } else {
    const normalized = selected.map((event) => ({ event, pace: pacePerUnit(event, "mi"), miles: distanceIn(event, "mi") }));
    const fastest = normalized.filter((item) => Number.isFinite(item.pace)).sort((a, b) => a.pace - b.pace)[0];
    const longest = normalized.sort((a, b) => b.miles - a.miles)[0];
    statOneLabel.textContent = "FASTEST PACE";
    statOne.textContent = fastest ? `${formatPace(fastest.pace)}/mi` : "—";
    statOneNote.textContent = fastest?.event.title || "No runs yet";
    statTwoLabel.textContent = "DISTANCE";
    statTwo.textContent = `${formatNumber(last30.reduce((sum, event) => sum + distanceIn(event, "mi"), 0))} mi`;
    statTwoNote.textContent = "Last 30 days";
    statThreeLabel.textContent = "LONGEST RUN";
    statThree.textContent = longest ? `${formatNumber(longest.miles)} mi` : "—";
    statThreeNote.textContent = longest?.event.title || "Ready when you are";
    statFourLabel.textContent = "RUNS LOGGED";
    statFour.textContent = String(last30.length);
    statFourNote.textContent = "Last 30 days";
  }
}

function renderProgressSubjects() {
  const previous = subjectSelect.value;
  subjectSelect.replaceChildren();
  if (activeMode === "lift") {
    const lifts = events.filter((event) => event.activity_type === "lift");
    const subjects = new Map();
    lifts.forEach((event) => {
      const key = exerciseKey(event);
      const subject = subjects.get(key) || { name: event.exercise_name, count: 0 };
      subject.count += 1;
      subjects.set(key, subject);
    });
    if (!subjects.size) metadata.exercises.filter((exercise) => exercise.id !== "other").slice(0, 5).forEach((exercise) => subjects.set(exercise.id, exercise.name));
    [...subjects.entries()]
      .sort(([, left], [, right]) => (right.count || 0) - (left.count || 0))
      .forEach(([key, subject]) => subjectSelect.append(option(key, subject.name || subject)));
  } else if (activeMode === "climb") {
    metadata.climb_grade_systems.filter((system) => system.grades.length).forEach((system) => subjectSelect.append(option(system.slug, system.name)));
  } else {
    subjectSelect.append(option("pace", "Average pace"), option("distance", "Run distance"));
  }
  if ([...subjectSelect.options].some((candidate) => candidate.value === previous)) subjectSelect.value = previous;
}

function renderChart() {
  const cutoff = rangeSelect.value === "all" ? "0000-01-01" : localDate(new Date(Date.now() - Number(rangeSelect.value) * 86_400_000));
  let points = [];
  let formatValue = (value) => String(value);
  let higherBetter = true;
  if (activeMode === "lift") {
    const key = subjectSelect.value;
    const matching = events.filter((event) => event.activity_type === "lift" && exerciseKey(event) === key && event.activity_date >= cutoff).sort(compareAscending);
    const displayUnit = matching.at(-1)?.weight_unit || "lb";
    points = dailyBest(matching.map((event) => ({ date: event.activity_date, value: convertWeight(bestSet(event)?.weight, event.weight_unit, displayUnit), label: event.title })).filter((point) => Number.isFinite(point.value)));
    formatValue = (value) => `${formatNumber(value)} ${displayUnit}`;
    progressTitle.textContent = "Best weight over time";
    progressNote.textContent = "Each point is the heaviest set you recorded that day.";
  } else if (activeMode === "climb") {
    const system = metadata.climb_grade_systems.find((candidate) => candidate.slug === subjectSelect.value);
    const matching = events.filter((event) => event.activity_type === "climb" && event.grade_system === subjectSelect.value && ["flash", "send"].includes(event.climb_outcome) && Number.isFinite(event.grade_rank) && event.activity_date >= cutoff).sort(compareAscending);
    points = dailyBest(matching.map((event) => ({ date: event.activity_date, value: event.grade_rank, label: event.grade })));
    formatValue = (value) => system?.grades[Math.round(value)] || "—";
    progressTitle.textContent = "Sent grade over time";
    progressNote.textContent = "Attempts and projects stay in history; this line uses flashes and sends.";
  } else if (subjectSelect.value === "distance") {
    const matching = events.filter((event) => event.activity_type === "run" && event.activity_date >= cutoff).sort(compareAscending);
    points = matching.map((event) => ({ date: event.activity_date, value: distanceIn(event, "mi"), label: event.title }));
    formatValue = (value) => `${formatNumber(value)} mi`;
    progressTitle.textContent = "Run distance over time";
    progressNote.textContent = "Each point is one run, converted to miles for a consistent view.";
  } else {
    const matching = events.filter((event) => event.activity_type === "run" && event.activity_date >= cutoff).sort(compareAscending);
    points = matching.map((event) => ({ date: event.activity_date, value: pacePerUnit(event, "mi"), label: event.title })).filter((point) => Number.isFinite(point.value));
    formatValue = (value) => `${formatPace(value)}/mi`;
    higherBetter = false;
    progressTitle.textContent = "Average pace over time";
    progressNote.textContent = "Lower is faster. Different routes and conditions can change the story.";
  }
  drawChart(points, formatValue, higherBetter);
}

function drawChart(points, formatValue, higherBetter) {
  gridLines.replaceChildren();
  chartPoints.replaceChildren();
  chartLine.setAttribute("d", "");
  chartArea.setAttribute("d", "");
  chartEmpty.hidden = points.length > 0;
  if (!points.length) {
    chartHigh.textContent = chartMid.textContent = chartLow.textContent = "—";
    chartStart.textContent = "Earlier";
    chartEnd.textContent = "Now";
    chartSummary.textContent = "Nothing to compare yet.";
    return;
  }
  const values = points.map((point) => point.value);
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (minimum === maximum) { minimum -= Math.max(1, minimum * .05); maximum += Math.max(1, maximum * .05); }
  const xFor = (index) => points.length === 1 ? 380 : 20 + (index / (points.length - 1)) * 720;
  const yFor = (value) => {
    const ratio = (value - minimum) / (maximum - minimum);
    return 20 + (higherBetter ? 1 - ratio : ratio) * 210;
  };
  [20, 90, 160, 230].forEach((y) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "20"); line.setAttribute("x2", "740"); line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y));
    gridLines.append(line);
  });
  const coordinates = points.map((point, index) => [xFor(index), yFor(point.value)]);
  const linePath = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  chartLine.setAttribute("d", linePath);
  chartArea.setAttribute("d", `${linePath} L${coordinates.at(-1)[0].toFixed(1)},240 L${coordinates[0][0].toFixed(1)},240 Z`);
  coordinates.forEach(([x, y], index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(x)); circle.setAttribute("cy", String(y)); circle.setAttribute("r", "6");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${formatDate(points[index].date)} · ${formatValue(points[index].value)}`;
    circle.append(title); chartPoints.append(circle);
  });
  const topValue = higherBetter ? maximum : minimum;
  const bottomValue = higherBetter ? minimum : maximum;
  chartHigh.textContent = formatValue(topValue);
  chartMid.textContent = formatValue((minimum + maximum) / 2);
  chartLow.textContent = formatValue(bottomValue);
  chartStart.textContent = formatDateShort(points[0].date);
  chartEnd.textContent = formatDateShort(points.at(-1).date);
  const change = points.at(-1).value - points[0].value;
  chartSummary.textContent = points.length === 1 ? "One entry—your baseline is saved." : `${points.length} entries · ${change === 0 ? "steady" : `${formatValue(points[0].value)} → ${formatValue(points.at(-1).value)}`}`;
}

function renderHistory() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filtered = events.filter((event) => {
    if (typeFilter.value && event.activity_type !== typeFilter.value) return false;
    if (dateFrom.value && event.activity_date < dateFrom.value) return false;
    if (dateTo.value && event.activity_date > dateTo.value) return false;
    if (!query) return true;
    return [event.title, event.body, event.exercise_name, event.grade, event.venue, event.route_name, event.run_type, event.wall_angle].filter(Boolean).join("\n").toLocaleLowerCase().includes(query);
  });
  eventList.replaceChildren(...filtered.map(eventCard));
  historyEmpty.hidden = filtered.length !== 0;
  resultsLabel.textContent = filtered.length === events.length ? `${events.length} ${events.length === 1 ? "entry" : "entries"} in your workout history` : `${filtered.length} of ${events.length} entries shown`;
}

function eventCard(event) {
  const fragment = eventTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".workout-event-card");
  card.dataset.type = event.activity_type;
  const date = new Date(`${event.activity_date}T12:00:00`);
  card.querySelector(".workout-date-tile span").textContent = date.toLocaleDateString([], { month: "short" });
  card.querySelector(".workout-date-tile strong").textContent = String(date.getDate());
  card.querySelector(".workout-date-tile small").textContent = String(date.getFullYear());
  card.querySelector(".workout-type-pill b").textContent = event.activity_type;
  const time = card.querySelector("time");
  time.textContent = event.activity_time ? formatTime(event.activity_time) : "";
  time.hidden = !time.textContent;
  const primary = card.querySelector(".workout-event-primary");
  const secondary = card.querySelector(".workout-event-secondary");
  card.querySelector("h4").textContent = event.title;
  if (event.activity_type === "lift") {
    const best = bestSet(event);
    primary.textContent = best?.weight !== undefined ? `${formatNumber(best.weight)} ${event.weight_unit}` : `${best?.reps || 0} reps`;
    secondary.textContent = summarizeSets(event.sets, event.weight_unit);
  } else if (event.activity_type === "climb") {
    primary.textContent = event.grade;
    secondary.textContent = [capitalize(event.climb_outcome), `${event.attempts} ${event.attempts === 1 ? "attempt" : "attempts"}`, event.venue].filter(Boolean).join(" · ");
  } else {
    primary.textContent = `${formatPace(pacePerUnit(event, event.distance_unit))}/${event.distance_unit}`;
    secondary.textContent = `${formatNumber(event.distance)} ${event.distance_unit} · ${formatDuration(event.duration_seconds)} · ${runTypeName(event.run_type)}`;
  }
  const summary = card.querySelector(".workout-event-summary");
  summary.textContent = event.body || "";
  summary.hidden = !summary.textContent;
  const chips = card.querySelector(".workout-event-chips");
  if (event.activity_type === "lift") {
    appendChip(chips, `${event.sets.reduce((sum, set) => sum + set.reps, 0)} total reps`);
    const volume = event.sets.reduce((sum, set) => sum + (set.weight || 0) * set.reps, 0);
    if (volume) appendChip(chips, `${formatNumber(volume)} ${event.weight_unit} volume`);
  } else if (event.activity_type === "climb") {
    appendChip(chips, gradeSystemName(event.grade_system));
    if (event.wall_angle) appendChip(chips, event.wall_angle);
  } else {
    if (event.elevation_gain !== undefined) appendChip(chips, `${formatNumber(event.elevation_gain)} ${event.elevation_unit} gain`);
    if (event.perceived_effort !== undefined) appendChip(chips, `Effort ${event.perceived_effort}/10`);
  }
  chips.hidden = chips.childElementCount === 0;
  const details = card.querySelector(".workout-detail-grid");
  if (event.activity_type === "lift") event.sets.forEach((set, index) => appendDetail(details, `Set ${index + 1}`, `${set.reps} reps${set.weight !== undefined ? ` × ${formatNumber(set.weight)} ${event.weight_unit}` : ""}${set.rpe ? ` · RPE ${set.rpe}` : ""}`));
  if (event.activity_type === "climb") {
    appendDetail(details, "Style", capitalize(event.climb_style?.replace("-", " ")));
    appendDetail(details, "Route / problem", event.route_name);
  }
  if (event.activity_type === "run") {
    appendDetail(details, "Duration", formatDuration(event.duration_seconds));
    appendDetail(details, "Average pace", `${formatPace(pacePerUnit(event, event.distance_unit))}/${event.distance_unit}`);
  }
  card.querySelector(".workout-event-details").hidden = details.childElementCount === 0;
  return card;
}

function openEditor(type = activeMode) {
  form.reset();
  formStatus.textContent = "";
  formStatus.className = "workout-form-status";
  form.elements.activityDate.value = localDate();
  setEntryType(type);
  setRows.replaceChildren();
  addLiftSet(); addLiftSet(); addLiftSet();
  form.elements.weightUnit.value = events.find((event) => event.activity_type === "lift")?.weight_unit || "lb";
  climbOutcome = "send";
  updateOutcomeButtons();
  form.elements.attempts.value = "1";
  renderGrades();
  updatePreviousLift();
  updatePacePreview();
  saveEntryButton.disabled = !writeEnabled;
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
}

async function openVoiceDraft(proposal) {
  if (!loaded) await loadWorkouts();
  if (!loaded) return { ok: false, message: "The Workout tracker could not be loaded." };
  window.privateCapture?.showView("workout");
  const fields = proposal?.fields || {};
  const type = ["lift", "climb", "run"].includes(proposal?.subtype) ? proposal.subtype : "lift";
  openEditor(type);
  form.elements.notes.value = String(proposal?.transcript || "").trim();
  if (typeof fields.title === "string" && fields.title.trim()) form.elements.title.value = fields.title;
  if (type === "lift") {
    const exerciseId = metadata.exercises.some((exercise) => exercise.id === fields.exerciseId) ? fields.exerciseId : "other";
    exerciseSelect.value = exerciseId;
    if (exerciseId === "other" && typeof fields.exerciseName === "string") form.elements.exerciseName.value = fields.exerciseName;
    if (["lb", "kg"].includes(fields.weightUnit)) form.elements.weightUnit.value = fields.weightUnit;
    if (Array.isArray(fields.sets) && fields.sets.length) {
      setRows.replaceChildren();
      fields.sets.forEach((set) => addLiftSet(set));
    }
    updatePreviousLift();
    updateLiftPreview();
  } else if (type === "climb") {
    if (fields.climbStyle) form.elements.climbStyle.value = fields.climbStyle;
    if (metadata.climb_grade_systems.some((system) => system.slug === fields.gradeSystem)) gradeSystemSelect.value = fields.gradeSystem;
    renderGrades();
    if (fields.grade) {
      if (customGradeWrap.hidden) gradeSelect.value = fields.grade;
      else customGradeInput.value = fields.grade;
    }
    if (Number.isFinite(fields.attempts)) form.elements.attempts.value = String(fields.attempts);
    if (["flash", "send", "attempt", "project"].includes(fields.climbOutcome)) climbOutcome = fields.climbOutcome;
    updateOutcomeButtons();
  } else {
    if (Number.isFinite(fields.distance)) form.elements.distance.value = String(fields.distance);
    if (["mi", "km"].includes(fields.distanceUnit)) form.elements.distanceUnit.value = fields.distanceUnit;
    if (Number.isFinite(fields.durationSeconds)) form.elements.runDuration.value = formatDuration(fields.durationSeconds);
    if (metadata.run_types.some((runType) => runType.value === fields.runType)) runTypeSelect.value = fields.runType;
    form.elements.elevationUnit.value = form.elements.distanceUnit.value === "km" ? "m" : "ft";
    updatePacePreview();
  }
  form.elements.notes.focus();
  return { ok: true };
}

function closeEditor() {
  if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
}

function setEntryType(type) {
  entryType = ["lift", "climb", "run"].includes(type) ? type : "lift";
  typeChips.forEach((button) => {
    const selected = button.dataset.workoutEntryType === entryType;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  liftFields.hidden = entryType !== "lift";
  climbFields.hidden = entryType !== "climb";
  runFields.hidden = entryType !== "run";
  dialogTitle.textContent = `Log a ${entryType}`;
  dialogSubtitle.textContent = entryType === "lift" ? "Previous values stay close; everything else stays out of the way." : entryType === "climb" ? "A grade, outcome, and attempts are enough." : "Distance and duration become a pace automatically.";
}

function addLiftSet(values = {}) {
  if (setRows.children.length >= 30) return;
  const row = document.createElement("div");
  row.className = "workout-set-row";
  const index = document.createElement("span");
  const reps = numberInput("Reps", "1", "1000", "1", values.reps);
  reps.dataset.setField = "reps";
  const weight = numberInput("Weight", "0", "100000", "0.5", values.weight);
  weight.dataset.setField = "weight";
  const rpe = numberInput("RPE", "1", "10", "0.5", values.rpe);
  rpe.dataset.setField = "rpe";
  const remove = document.createElement("button");
  remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remove set");
  remove.addEventListener("click", () => { row.remove(); renumberSets(); updateLiftPreview(); });
  [reps, weight, rpe].forEach((input) => input.addEventListener("input", updateLiftPreview));
  row.append(index, reps, weight, rpe, remove);
  setRows.append(row);
  renumberSets(); updateLiftPreview();
}

function renumberSets() {
  Array.from(setRows.children).forEach((row, index) => { row.querySelector("span").textContent = String(index + 1); });
}

function updateLiftPreview() {
  const sets = collectSets(false);
  const reps = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
  const volume = sets.reduce((sum, set) => sum + (set.reps || 0) * (set.weight || 0), 0);
  volumePreview.textContent = volume ? `${reps} reps · ${formatNumber(volume)} ${form.elements.weightUnit.value}` : `${reps} total reps`;
}

function updatePreviousLift() {
  const id = exerciseSelect.value;
  const name = id === "other" ? form.elements.exerciseName.value.trim() : "";
  previousLift = events.find((event) => event.activity_type === "lift" && event.exercise_id === id && (id !== "other" || !name || event.exercise_name.toLocaleLowerCase() === name.toLocaleLowerCase())) || null;
  previousPanel.hidden = !previousLift;
  if (previousLift) previousText.textContent = `${formatDate(previousLift.activity_date)} · ${summarizeSets(previousLift.sets, previousLift.weight_unit)}`;
  customExerciseWrap.hidden = id !== "other";
}

function usePreviousSets() {
  if (!previousLift) return;
  setRows.replaceChildren();
  previousLift.sets.forEach((set) => addLiftSet(set));
  form.elements.weightUnit.value = previousLift.weight_unit;
  updateLiftPreview();
}

function renderGrades() {
  const system = metadata.climb_grade_systems.find((candidate) => candidate.slug === gradeSystemSelect.value) || metadata.climb_grade_systems[0];
  const custom = !system?.grades.length;
  gradeSelectWrap.hidden = custom;
  customGradeWrap.hidden = !custom;
  gradeSelect.replaceChildren(...(system?.grades || []).map((grade) => option(grade, grade)));
}

function updateOutcomeButtons() {
  outcomeButtons.forEach((button) => {
    const selected = button.dataset.climbOutcome === climbOutcome;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function updatePacePreview() {
  const distance = Number(form.elements.distance.value);
  const seconds = parseDuration(form.elements.runDuration.value);
  if (!distance || !seconds) return void (pacePreview.textContent = "Enter distance and time to see pace.");
  pacePreview.textContent = `Average pace: ${formatPace(seconds / distance)} per ${form.elements.distanceUnit.value}`;
}

function workoutPayload() {
  const data = new FormData(form);
  const common = { activityDate: data.get("activityDate"), activityTime: data.get("activityTime") || undefined, activityType: entryType, title: data.get("title") || undefined, notes: data.get("notes") || "" };
  if (entryType === "lift") return { ...common, exerciseId: exerciseSelect.value, exerciseName: data.get("exerciseName") || undefined, weightUnit: data.get("weightUnit"), sets: collectSets(true) };
  if (entryType === "climb") return { ...common, climbStyle: data.get("climbStyle"), gradeSystem: data.get("gradeSystem"), grade: customGradeWrap.hidden ? gradeSelect.value : customGradeInput.value, climbOutcome, attempts: Number(data.get("attempts") || 1), venue: data.get("venue") || undefined, routeName: data.get("routeName") || undefined, wallAngle: data.get("wallAngle") || undefined };
  return { ...common, distance: optionalNumber(data.get("distance")), distanceUnit: data.get("distanceUnit"), durationSeconds: parseDuration(data.get("runDuration")), runType: data.get("runType"), elevationGain: optionalNumber(data.get("elevationGain")), elevationUnit: data.get("elevationUnit"), perceivedEffort: optionalNumber(data.get("perceivedEffort")) };
}

function collectSets(onlyComplete) {
  return Array.from(setRows.children).map((row) => ({ reps: optionalNumber(row.querySelector('[data-set-field="reps"]').value), weight: optionalNumber(row.querySelector('[data-set-field="weight"]').value), rpe: optionalNumber(row.querySelector('[data-set-field="rpe"]').value), setType: "work" })).filter((set) => !onlyComplete || set.reps);
}

function currentIntent(payload) {
  let existing;
  try { existing = JSON.parse(sessionStorage.getItem(WORKOUT_INTENT_KEY) || "null"); } catch { existing = null; }
  const signature = JSON.stringify(payload);
  if (existing?.signature === signature && typeof existing.key === "string" && typeof existing.createdAt === "string") return existing;
  const created = { signature, key: crypto.randomUUID(), createdAt: new Date().toISOString() };
  sessionStorage.setItem(WORKOUT_INTENT_KEY, JSON.stringify(created));
  return created;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!writeEnabled) return showFormError(new Error("Writes are paused until the private boundary is available."));
  const payload = workoutPayload();
  if (entryType === "run" && !payload.durationSeconds) return showFormError(new Error("Enter duration as minutes:seconds or hours:minutes:seconds."));
  const intent = currentIntent(payload);
  saveEntryButton.disabled = true;
  formStatus.className = "workout-form-status";
  formStatus.textContent = "Saving a private workout record…";
  try {
    await workoutApi("/api/v1/workout-events", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key }, body: JSON.stringify({ ...payload, clientCreatedAt: intent.createdAt }) });
    try { sessionStorage.removeItem(WORKOUT_INTENT_KEY); } catch { /* Retry recovery is optional. */ }
    closeEditor();
    activeMode = entryType;
    typeFilter.value = entryType;
    loaded = false;
    await loadWorkouts(true);
    resultsLabel.textContent = `${capitalize(entryType)} saved as private Markdown.`;
  } catch (error) {
    showFormError(error);
  } finally {
    saveEntryButton.disabled = !writeEnabled;
  }
});

function showFormError(error) {
  formStatus.className = "workout-form-status error";
  formStatus.textContent = error instanceof Error ? error.message : "The workout could not be saved.";
}

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.workoutMode)));
[newEntryButton, quickButton, logAnotherButton, historyEmpty.querySelector("button")].forEach((button) => button.addEventListener("click", () => openEditor(activeMode)));
typeChips.forEach((button) => button.addEventListener("click", () => setEntryType(button.dataset.workoutEntryType)));
outcomeButtons.forEach((button) => button.addEventListener("click", () => { climbOutcome = button.dataset.climbOutcome; updateOutcomeButtons(); }));
exerciseSelect.addEventListener("change", updatePreviousLift);
form.elements.exerciseName.addEventListener("input", updatePreviousLift);
form.elements.weightUnit.addEventListener("change", updateLiftPreview);
usePreviousButton.addEventListener("click", usePreviousSets);
addSetButton.addEventListener("click", () => addLiftSet());
gradeSystemSelect.addEventListener("change", renderGrades);
form.elements.climbStyle.addEventListener("change", () => {
  gradeSystemSelect.value = ["boulder", "board"].includes(form.elements.climbStyle.value) ? "v-scale" : "yds";
  renderGrades();
});
[form.elements.distance, form.elements.runDuration].forEach((input) => input.addEventListener("input", updatePacePreview));
form.elements.distanceUnit.addEventListener("change", () => {
  form.elements.elevationUnit.value = form.elements.distanceUnit.value === "mi" ? "ft" : "m";
  updatePacePreview();
});
subjectSelect.addEventListener("change", renderChart);
rangeSelect.addEventListener("change", renderChart);
typeFilter.addEventListener("change", renderHistory);
dateFrom.addEventListener("change", renderHistory);
dateTo.addEventListener("change", renderHistory);
searchInput.addEventListener("input", () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(renderHistory, 160); });
closeDialogButton.addEventListener("click", closeEditor);
cancelEntryButton.addEventListener("click", closeEditor);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeEditor(); });

function bestSet(event) {
  return (event.sets || []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0) || b.reps - a.reps)[0] || null;
}

function exerciseKey(event) {
  return event.exercise_id === "other" ? `other:${event.exercise_name.toLocaleLowerCase()}` : event.exercise_id;
}

function dailyBest(points) {
  const byDate = new Map();
  points.forEach((point) => { const current = byDate.get(point.date); if (!current || point.value > current.value) byDate.set(point.date, point); });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function convertWeight(value, from, to) {
  if (!Number.isFinite(value) || from === to) return value;
  return from === "kg" ? value * 2.2046226218 : value / 2.2046226218;
}

function distanceIn(event, unit) {
  if (event.distance_unit === unit) return event.distance;
  return unit === "mi" ? event.distance / 1.609344 : event.distance * 1.609344;
}

function pacePerUnit(event, unit) {
  const distance = distanceIn(event, unit);
  return distance ? event.duration_seconds / distance : null;
}

function parseDuration(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0) || parts.length < 2 || parts.length > 3) return null;
  if (parts.length === 2 && parts[1] < 60) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return null;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.round(seconds % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatPace(seconds) {
  return Number.isFinite(seconds) ? formatDuration(Math.round(seconds)) : "—";
}

function summarizeSets(sets, unit) {
  if (!sets?.length) return "No sets";
  const groups = [];
  sets.forEach((set) => {
    const label = `${set.reps}${set.weight !== undefined ? ` × ${formatNumber(set.weight)} ${unit}` : " reps"}`;
    const previous = groups.at(-1);
    if (previous?.label === label) previous.count += 1; else groups.push({ label, count: 1 });
  });
  return groups.map((group) => `${group.count > 1 ? `${group.count} sets · ` : ""}${group.label}`).join(" · ");
}

function gradeSystemName(slug) {
  return metadata.climb_grade_systems.find((system) => system.slug === slug)?.name || slug || "";
}

function runTypeName(value) {
  return metadata.run_types.find((type) => type.value === value)?.label || "Run";
}

function appendChip(parent, text) {
  const chip = document.createElement("span"); chip.textContent = text; parent.append(chip);
}

function appendDetail(parent, label, value) {
  if (!value) return;
  const row = document.createElement("div"); const heading = document.createElement("span"); const content = document.createElement("p");
  heading.textContent = label; content.textContent = String(value); row.append(heading, content); parent.append(row);
}

function arrow() {
  const span = document.createElement("span"); span.textContent = "↗"; return span;
}

function option(value, label) {
  const element = document.createElement("option"); element.value = value; element.textContent = label; return element;
}

function numberInput(label, min, max, step, value) {
  const input = document.createElement("input"); input.type = "number"; input.inputMode = "decimal"; input.min = min; input.max = max; input.step = step; input.placeholder = "—"; input.setAttribute("aria-label", label); if (value !== undefined) input.value = value; return input;
}

function optionalNumber(value) {
  return value === "" || value === null || value === undefined ? undefined : Number(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat([], { maximumFractionDigits: 2 }).format(value || 0);
}

function localDate(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayDifference(from, to) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);
}

function compareAscending(a, b) {
  return `${a.activity_date}T${a.activity_time || "23:59"}`.localeCompare(`${b.activity_date}T${b.activity_time || "23:59"}`);
}

function capitalize(value) {
  return value ? value.replace(/^./, (letter) => letter.toUpperCase()) : "";
}
