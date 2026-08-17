const healthCount = document.querySelector("#health-count");
const newEntryButton = document.querySelector("#new-health-entry");
const quickTypes = document.querySelector("#health-quick-types");
const dueList = document.querySelector("#health-due-list");
const dueEmpty = document.querySelector("#health-due-empty");
const totalStat = document.querySelector("#health-total-stat");
const therapyStat = document.querySelector("#health-therapy-stat");
const symptomStat = document.querySelector("#health-symptom-stat");
const monthBars = document.querySelector("#health-month-bars");
const resultsLabel = document.querySelector("#health-results-label");
const upcomingGroup = document.querySelector("#health-upcoming-group");
const upcomingList = document.querySelector("#health-upcoming-list");
const upcomingCount = document.querySelector("#health-upcoming-count");
const historyList = document.querySelector("#health-history-list");
const historyCount = document.querySelector("#health-history-count");
const emptyJournal = document.querySelector("#health-empty");
const categoryFilter = document.querySelector("#health-category-filter");
const searchInput = document.querySelector("#health-search");
const fromInput = document.querySelector("#health-date-from");
const toInput = document.querySelector("#health-date-to");
const pelvicJump = document.querySelector("#health-pelvic-jump");
const eventTemplate = document.querySelector("#health-event-template");
const dialog = document.querySelector("#health-dialog");
const healthForm = document.querySelector("#health-form");
const dialogTitle = document.querySelector("#health-dialog-title");
const editNote = document.querySelector("#health-edit-note");
const closeDialog = document.querySelector("#close-health-dialog");
const cancelEntry = document.querySelector("#cancel-health-entry");
const saveEntry = document.querySelector("#save-health-entry");
const formStatus = document.querySelector("#health-form-status");
const categoryChips = document.querySelector("#health-category-chips");
const customCategoryWrap = document.querySelector("#health-custom-category-wrap");
const customCategory = document.querySelector("#health-custom-category");
const guidedSection = document.querySelector("#health-guided-section");
const guidedFields = document.querySelector("#health-guided-fields");
const carryForward = document.querySelector("#health-carry-forward");
const providerLabel = document.querySelector("#health-provider-label");
const moreDetails = document.querySelector("#health-more-details");
const relatedEventWrap = document.querySelector("#health-related-event-wrap");
const relatedEventSelect = document.querySelector("#health-related-event");

const HEALTH_DRAFT_KEY = "private-capture-health-draft-v1";
const HEALTH_INTENT_KEY = "private-capture-health-save-intent-v1";
const QUICK_CATEGORY_SLUGS = ["pelvic-floor-therapy", "physical-therapy", "symptoms", "dental", "primary-care"];
const EXERCISE_KEYS = ["exercises_assigned", "home_exercises", "sets_reps_duration", "exercises", "sets_reps_resistance", "home_exercise_program"];
const COMMON_LABELS = {
  appointment_type: "Appointment type",
  reason: "Reason for visit",
  symptoms: "Symptoms or concerns",
  questions: "Questions I wanted to ask",
  discussed: "What was discussed",
  treatment: "Treatment performed",
  recommendations: "Recommendations / instructions",
  progress_notes: "Progress notes",
};

let categories = [];
let events = [];
let selectedCategory = "";
let editingEvent = null;
let activeScope = "all";
let writeEnabled = false;
let loaded = false;
let loading = null;
let healthDraftTimer;
let searchTimer;

class HealthApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function healthApi(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new HealthApiError(payload.error?.message || "The health journal could not be updated.", response.status);
  return payload;
}

async function loadJournal(force = false) {
  if (loading && !force) return loading;
  loading = Promise.all([
    healthApi("/api/v1/health-journal/meta"),
    healthApi("/api/v1/health-events"),
  ]).then(([meta, listing]) => {
    categories = meta.categories;
    events = listing.events;
    loaded = true;
    renderCategoryControls();
    renderJournal();
  }).catch((error) => {
    resultsLabel.textContent = error instanceof Error ? error.message : "The health journal could not be loaded.";
  }).finally(() => { loading = null; });
  return loading;
}

function activate() {
  if (!loaded) void loadJournal();
  else renderJournal();
}

window.healthJournal = { activate };

window.addEventListener("private-capture:write-state", (event) => {
  writeEnabled = event.detail?.enabled === true;
  saveEntry.disabled = !writeEnabled;
});

function renderCategoryControls() {
  const currentFilter = categoryFilter.value;
  categoryFilter.replaceChildren(option("", "Every category"));
  categories.forEach((category) => categoryFilter.append(option(category.slug, category.name)));
  categoryFilter.value = categories.some((category) => category.slug === currentFilter) ? currentFilter : "";

  quickTypes.replaceChildren();
  categories.filter((category) => QUICK_CATEGORY_SLUGS.includes(category.slug)).forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `health-quick-type tone-${category.tone}`;
    const mark = document.createElement("span");
    mark.textContent = categoryGlyph(category);
    const label = document.createElement("b");
    label.textContent = shortCategory(category);
    const plus = document.createElement("i");
    plus.textContent = "+";
    button.append(mark, label, plus);
    button.addEventListener("click", () => openEditor(null, category.slug));
    quickTypes.append(button);
  });
  const more = document.createElement("button");
  more.type = "button";
  more.className = "health-quick-type tone-stone";
  const moreMark = document.createElement("span");
  moreMark.textContent = "•••";
  const moreLabel = document.createElement("b");
  moreLabel.textContent = "More types";
  const morePlus = document.createElement("i");
  morePlus.textContent = "+";
  more.append(moreMark, moreLabel, morePlus);
  more.addEventListener("click", () => openEditor());
  quickTypes.append(more);

  renderCategoryChips();
}

function renderCategoryChips() {
  categoryChips.replaceChildren();
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = category.slug === selectedCategory ? `selected tone-${category.tone}` : `tone-${category.tone}`;
    button.dataset.category = category.slug;
    const dot = document.createElement("i");
    const name = document.createElement("span");
    name.textContent = category.name;
    button.append(dot, name);
    if (category.slug === selectedCategory) {
      const check = document.createElement("b");
      check.textContent = "✓";
      button.append(check);
    }
    button.addEventListener("click", () => selectCategory(category.slug));
    categoryChips.append(button);
  });
  const custom = document.createElement("button");
  custom.type = "button";
  custom.className = selectedCategory === "__custom" ? "selected tone-stone" : "tone-stone";
  custom.dataset.category = "__custom";
  const plus = document.createElement("i");
  plus.textContent = "+";
  const label = document.createElement("span");
  label.textContent = "New category";
  custom.append(plus, label);
  custom.addEventListener("click", () => selectCategory("__custom"));
  categoryChips.append(custom);
}

function selectCategory(slug, preserveTitle = false) {
  selectedCategory = slug;
  customCategoryWrap.hidden = slug !== "__custom";
  const category = categoryFor(slug);
  if (!preserveTitle && !editingEvent && category) healthForm.elements.title.value = suggestedTitle(category);
  providerLabel.textContent = slug === "dental" ? "Dentist" : category?.group === "therapy" ? "Therapist" : "Provider or therapist";
  relatedEventWrap.toggleAttribute("hidden", slug !== "symptoms");
  renderCategoryChips();
  renderGuidedFields(category);
}

function renderRelatedEvents(selected = "") {
  relatedEventSelect.replaceChildren(option("", "None"));
  events.filter((event) => event.event_id !== editingEvent?.event_id).forEach((event) => {
    relatedEventSelect.append(option(event.event_id, `${formatDate(event.event_date)} · ${event.title}`));
  });
  relatedEventSelect.value = events.some((event) => event.event_id === selected && event.event_id !== editingEvent?.event_id) ? selected : "";
}

function renderGuidedFields(category, values = {}) {
  guidedFields.replaceChildren();
  const fields = category?.fields || [];
  guidedSection.hidden = fields.length === 0;
  fields.forEach((definition) => {
    const label = document.createElement("label");
    const heading = document.createElement("span");
    heading.textContent = definition.label;
    const input = document.createElement(definition.kind === "textarea" ? "textarea" : "input");
    input.name = `detail_${definition.key}`;
    input.dataset.detailKey = definition.key;
    input.value = values[definition.key] || "";
    if (definition.kind === "textarea") input.rows = 3;
    input.addEventListener("input", scheduleHealthDraft);
    label.append(heading, input);
    guidedFields.append(label);
  });
  const previous = previousTherapy(category?.slug);
  carryForward.hidden = category?.group !== "therapy" || !previous || Boolean(editingEvent);
  carryForward.dataset.sourceEvent = previous?.event_id || "";
}

function renderJournal() {
  healthCount.textContent = String(events.length);
  totalStat.textContent = String(events.length);
  const therapy = events.filter((event) => categoryFor(event.category)?.group === "therapy");
  therapyStat.textContent = String(therapy.length);
  symptomStat.textContent = String(events.filter((event) => event.category === "symptoms").length);
  renderDueItems();
  renderMonthBars();
  renderTimeline();
}

function renderDueItems() {
  const items = [];
  events.forEach((event) => {
    if (event.next_appointment) items.push({ event, date: event.next_appointment.slice(0, 10), label: "Next appointment" });
    if (event.follow_up_date) items.push({ event, date: event.follow_up_date, label: "Follow-up" });
    if (event.next_due_date) items.push({ event, date: event.next_due_date, label: "Due date" });
  });
  const today = localDate();
  const oneYear = new Date(`${today}T12:00:00`);
  oneYear.setFullYear(oneYear.getFullYear() + 1);
  const visible = items.filter((item) => item.date <= localDate(oneYear)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  dueList.replaceChildren();
  dueEmpty.hidden = visible.length > 0;
  visible.forEach((item) => {
    const row = document.createElement("div");
    row.className = `health-due-row tone-${categoryFor(item.event.category)?.tone || "stone"}`;
    const icon = document.createElement("span");
    icon.textContent = "◷";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.event.title;
    const meta = document.createElement("small");
    meta.textContent = `${item.label} · ${item.event.provider || item.event.category_label}`;
    copy.append(title, meta);
    const timing = document.createElement("b");
    const difference = dayDifference(today, item.date);
    timing.textContent = difference < 0 ? `${Math.abs(difference)}d overdue` : difference === 0 ? "Today" : difference <= 30 ? `In ${difference}d` : formatDate(item.date);
    if (difference < 0) timing.className = "overdue";
    row.append(icon, copy, timing);
    dueList.append(row);
  });
}

function renderMonthBars() {
  monthBars.replaceChildren();
  const months = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: date.toLocaleDateString([], { month: "short" }).slice(0, 1),
      full: date.toLocaleDateString([], { month: "long", year: "numeric" }),
      count: events.filter((event) => event.event_date.startsWith(key)).length,
    });
  }
  const maximum = Math.max(...months.map((month) => month.count), 1);
  months.forEach((month) => {
    const column = document.createElement("span");
    column.title = `${month.full}: ${month.count}`;
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(10, (month.count / maximum) * 100)}%`;
    const label = document.createElement("small");
    label.textContent = month.label;
    column.append(bar, label);
    monthBars.append(column);
  });
}

function renderTimeline() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filtered = events.filter((event) => {
    if (categoryFilter.value && event.category !== categoryFilter.value) return false;
    if (fromInput.value && event.event_date < fromInput.value) return false;
    if (toInput.value && event.event_date > toInput.value) return false;
    if (!scopeMatches(event, activeScope)) return false;
    if (!query) return true;
    return [event.title, event.category_label, event.provider, event.facility, event.reason, event.body, event.symptoms, event.questions, event.discussed, event.treatment, event.recommendations, event.progress_notes, ...(event.tags || []), ...Object.values(event.details || {})].join("\n").toLocaleLowerCase().includes(query);
  });
  const today = localDate();
  const upcoming = filtered.filter((event) => event.event_date > today).sort(compareAscending);
  const history = filtered.filter((event) => event.event_date <= today).sort(compareDescending);
  upcomingList.replaceChildren(...upcoming.map(eventCard));
  historyList.replaceChildren(...history.map(eventCard));
  upcomingCount.textContent = String(upcoming.length);
  historyCount.textContent = String(history.length);
  upcomingGroup.hidden = upcoming.length === 0;
  emptyJournal.hidden = filtered.length !== 0;
  resultsLabel.textContent = filtered.length === events.length
    ? `${events.length} ${events.length === 1 ? "entry" : "entries"} in your journal`
    : `${filtered.length} of ${events.length} entries shown`;
}

function eventCard(event) {
  const fragment = eventTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".health-event-card");
  const date = new Date(`${event.event_date}T12:00:00`);
  const tile = card.querySelector(".health-date-tile");
  tile.querySelector("span").textContent = date.toLocaleDateString([], { month: "short" });
  tile.querySelector("strong").textContent = String(date.getDate());
  tile.querySelector("small").textContent = String(date.getFullYear());
  const category = categoryFor(event.category);
  const pill = card.querySelector(".health-category-pill");
  pill.classList.add(`tone-${category?.tone || "stone"}`);
  pill.querySelector("b").textContent = event.category_label;
  const time = card.querySelector("time");
  time.textContent = event.event_time ? formatTime(event.event_time) : "";
  time.hidden = !event.event_time;
  const revision = card.querySelector(".health-revision-badge");
  revision.textContent = event.revision_count > 1 ? `${event.revision_count} revisions` : "";
  revision.hidden = event.revision_count <= 1;
  card.querySelector("h4").textContent = event.title;
  const provider = card.querySelector(".health-event-provider");
  provider.textContent = [event.provider, event.facility].filter(Boolean).join(" · ");
  provider.hidden = !provider.textContent;
  card.querySelector(".health-edit-button").addEventListener("click", () => openEditor(event));
  const summary = event.progress_notes || event.body || event.reason || event.details?.description || event.details?.worked_on || event.details?.session_notes || "";
  const summaryElement = card.querySelector(".health-event-summary");
  summaryElement.textContent = summary;
  summaryElement.hidden = !summary;
  const tags = card.querySelector(".health-tag-list");
  (event.tags || []).forEach((tag) => {
    const item = document.createElement("span");
    item.textContent = `#${tag}`;
    tags.append(item);
  });
  tags.hidden = !event.tags?.length;
  const detailGrid = card.querySelector(".health-detail-grid");
  if (event.body && event.body !== summary) appendDetail(detailGrid, "Notes", event.body);
  Object.entries(COMMON_LABELS).forEach(([key, label]) => appendDetail(detailGrid, label, event[key]));
  Object.entries(event.details || {}).forEach(([key, value]) => appendDetail(detailGrid, detailLabel(event.category, key), value));
  if (event.follow_up_date) appendDetail(detailGrid, "Follow-up date", formatDate(event.follow_up_date));
  if (event.next_appointment) appendDetail(detailGrid, "Next appointment", new Date(event.next_appointment).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }));
  if (event.next_due_date) appendDetail(detailGrid, "Next due", formatDate(event.next_due_date));
  if (event.recurrence_months) appendDetail(detailGrid, "Return interval", `${event.recurrence_months} month${event.recurrence_months === 1 ? "" : "s"}`);
  if (event.related_event_id) appendDetail(detailGrid, "Related health event", events.find((candidate) => candidate.event_id === event.related_event_id)?.title || "Related journal entry");
  card.querySelector(".health-event-details").hidden = detailGrid.childElementCount === 0;
  return card;
}

function appendDetail(parent, label, value) {
  if (!value) return;
  const row = document.createElement("div");
  const heading = document.createElement("span");
  heading.textContent = label;
  const content = document.createElement("p");
  content.textContent = value;
  row.append(heading, content);
  parent.append(row);
}

function openEditor(event = null, requestedCategory = "") {
  editingEvent = event;
  healthForm.reset();
  carryForward.dataset.relatedEvent = "";
  moreDetails.open = Boolean(event);
  formStatus.textContent = "";
  formStatus.className = "health-form-status";
  dialogTitle.textContent = event ? "Edit health entry" : "Add a health entry";
  editNote.hidden = !event;
  saveEntry.textContent = event ? "Save as new revision" : "Add to journal";
  saveEntry.disabled = !writeEnabled;
  customCategory.value = "";
  renderRelatedEvents(event?.related_event_id || "");
  if (event) {
    fillCommonFields(event);
    selectedCategory = event.category;
    selectCategory(event.category, true);
    renderGuidedFields(categoryFor(event.category), event.details || {});
  } else {
    const restored = requestedCategory ? null : restoreHealthDraft();
    const initialCategory = requestedCategory || restored?.category || categories[0]?.slug || "other";
    selectedCategory = initialCategory;
    selectCategory(initialCategory, true);
    if (restored) fillDraft(restored);
    else {
      healthForm.elements.eventDate.value = localDate();
      healthForm.elements.title.value = suggestedTitle(categoryFor(initialCategory));
    }
  }
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function fillCommonFields(event) {
  const map = {
    eventDate: event.event_date,
    eventTime: event.event_time,
    title: event.title,
    provider: event.provider,
    facility: event.facility,
    appointmentType: event.appointment_type,
    reason: event.reason,
    notes: event.body,
    symptoms: event.symptoms,
    questions: event.questions,
    discussed: event.discussed,
    treatment: event.treatment,
    recommendations: event.recommendations,
    progressNotes: event.progress_notes,
    followUpDate: event.follow_up_date,
    nextAppointment: event.next_appointment,
    recurrenceMonths: event.recurrence_months,
    nextDueDate: event.next_due_date,
    tags: (event.tags || []).join(", "),
  };
  Object.entries(map).forEach(([name, value]) => { if (healthForm.elements[name]) healthForm.elements[name].value = value || ""; });
  healthForm.elements.followUpNeeded.checked = event.follow_up_needed === true;
}

function fillDraft(draft) {
  if (draft.category === "__custom") {
    selectedCategory = "__custom";
    customCategory.value = draft.customCategory || "";
    selectCategory("__custom", true);
  }
  Object.entries(draft.values || {}).forEach(([name, value]) => {
    if (!healthForm.elements[name]) return;
    if (healthForm.elements[name].type === "checkbox") healthForm.elements[name].checked = value === true;
    else healthForm.elements[name].value = value || "";
  });
  renderGuidedFields(categoryFor(selectedCategory), draft.details || {});
}

function closeEditor() {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  editingEvent = null;
}

function healthPayload() {
  const data = new FormData(healthForm);
  const custom = selectedCategory === "__custom";
  const customLabel = customCategory.value.trim();
  const category = custom ? slugify(customLabel) : selectedCategory;
  const definition = categoryFor(selectedCategory);
  const details = {};
  guidedFields.querySelectorAll("[data-detail-key]").forEach((input) => {
    if (input.value.trim()) details[input.dataset.detailKey] = input.value;
  });
  return {
    eventDate: data.get("eventDate"),
    eventTime: data.get("eventTime") || undefined,
    category,
    categoryLabel: custom ? customLabel : definition?.name,
    title: data.get("title"),
    provider: data.get("provider") || undefined,
    facility: data.get("facility") || undefined,
    appointmentType: data.get("appointmentType") || undefined,
    reason: data.get("reason") || undefined,
    notes: data.get("notes") || "",
    symptoms: data.get("symptoms") || undefined,
    questions: data.get("questions") || undefined,
    discussed: data.get("discussed") || undefined,
    treatment: data.get("treatment") || undefined,
    recommendations: data.get("recommendations") || undefined,
    progressNotes: data.get("progressNotes") || undefined,
    followUpNeeded: data.get("followUpNeeded") === "on",
    followUpDate: data.get("followUpDate") || undefined,
    nextAppointment: data.get("nextAppointment") || undefined,
    recurrenceMonths: data.get("recurrenceMonths") ? Number(data.get("recurrenceMonths")) : undefined,
    nextDueDate: data.get("nextDueDate") || undefined,
    relatedEventId: data.get("relatedEventId") || carryForward.dataset.relatedEvent || undefined,
    tags: String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    details,
  };
}

function currentHealthIntent(payload) {
  let existing;
  try { existing = JSON.parse(sessionStorage.getItem(HEALTH_INTENT_KEY) || "null"); } catch { existing = null; }
  const signature = JSON.stringify({ eventId: editingEvent?.event_id || "new", payload });
  if (existing?.signature === signature && typeof existing.key === "string" && typeof existing.createdAt === "string") return existing;
  const created = { signature, key: crypto.randomUUID(), createdAt: new Date().toISOString() };
  sessionStorage.setItem(HEALTH_INTENT_KEY, JSON.stringify(created));
  return created;
}

healthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!writeEnabled) return showFormError(new Error("Writes are paused until the private boundary is available."));
  const payload = healthPayload();
  const wasEditing = Boolean(editingEvent);
  if (!payload.category) return showFormError(new Error("Name the custom health category."));
  const intent = currentHealthIntent(payload);
  saveEntry.disabled = true;
  formStatus.className = "health-form-status";
  formStatus.textContent = editingEvent ? "Saving a private revision…" : "Saving as private Markdown…";
  try {
    const path = editingEvent ? `/api/v1/health-events/${editingEvent.event_id}/revisions` : "/api/v1/health-events";
    await healthApi(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key },
      body: JSON.stringify({ ...payload, clientCreatedAt: intent.createdAt, ...(editingEvent ? { currentHash: editingEvent.content_hash } : {}) }),
    });
    clearHealthDraft();
    closeEditor();
    loaded = false;
    await loadJournal(true);
    resultsLabel.textContent = wasEditing ? "Revision saved. Earlier Markdown remains untouched." : "Health entry saved privately.";
  } catch (error) {
    showFormError(error);
  } finally {
    saveEntry.disabled = !writeEnabled;
  }
});

function showFormError(error) {
  formStatus.className = "health-form-status error";
  formStatus.textContent = error instanceof Error ? error.message : "The health entry could not be saved.";
}

function scheduleHealthDraft() {
  if (editingEvent) return;
  window.clearTimeout(healthDraftTimer);
  healthDraftTimer = window.setTimeout(saveHealthDraft, 180);
}

function saveHealthDraft() {
  if (editingEvent) return;
  const values = {};
  new FormData(healthForm).forEach((value, key) => { values[key] = value; });
  values.followUpNeeded = healthForm.elements.followUpNeeded.checked;
  const details = {};
  guidedFields.querySelectorAll("[data-detail-key]").forEach((input) => { details[input.dataset.detailKey] = input.value; });
  try {
    sessionStorage.setItem(HEALTH_DRAFT_KEY, JSON.stringify({ category: selectedCategory, customCategory: customCategory.value, values, details }));
    sessionStorage.removeItem(HEALTH_INTENT_KEY);
  } catch { /* Draft recovery is optional. */ }
}

function restoreHealthDraft() {
  try { return JSON.parse(sessionStorage.getItem(HEALTH_DRAFT_KEY) || "null"); } catch { return null; }
}

function clearHealthDraft() {
  window.clearTimeout(healthDraftTimer);
  try { sessionStorage.removeItem(HEALTH_DRAFT_KEY); sessionStorage.removeItem(HEALTH_INTENT_KEY); } catch { /* Optional recovery. */ }
}

carryForward.addEventListener("click", () => {
  const previous = events.find((event) => event.event_id === carryForward.dataset.sourceEvent);
  if (!previous) return;
  EXERCISE_KEYS.forEach((key) => {
    const input = guidedFields.querySelector(`[data-detail-key="${key}"]`);
    if (input && previous.details?.[key]) input.value = previous.details[key];
  });
  carryForward.dataset.relatedEvent = previous.event_id;
  carryForward.textContent = "✓ Exercises carried forward";
  scheduleHealthDraft();
});

newEntryButton.addEventListener("click", () => openEditor());
emptyJournal.querySelector("button").addEventListener("click", () => openEditor());
closeDialog.addEventListener("click", closeEditor);
cancelEntry.addEventListener("click", closeEditor);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeEditor(); });
healthForm.addEventListener("input", scheduleHealthDraft);
healthForm.addEventListener("change", scheduleHealthDraft);

document.querySelectorAll("[data-health-scope]").forEach((button) => button.addEventListener("click", () => setScope(button.dataset.healthScope)));
document.querySelectorAll("[data-health-scope-jump]").forEach((button) => button.addEventListener("click", () => {
  setScope(button.dataset.healthScopeJump);
  document.querySelector("#health-timeline-heading").scrollIntoView({ behavior: "smooth" });
}));
pelvicJump.addEventListener("click", () => {
  categoryFilter.value = "pelvic-floor-therapy";
  setScope("therapy");
  document.querySelector("#health-timeline-heading").scrollIntoView({ behavior: "smooth" });
});
categoryFilter.addEventListener("change", renderTimeline);
fromInput.addEventListener("change", renderTimeline);
toInput.addEventListener("change", renderTimeline);
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(renderTimeline, 160);
});

function setScope(scope) {
  activeScope = ["all", "therapy", "symptoms", "preventive"].includes(scope) ? scope : "all";
  document.querySelectorAll("[data-health-scope]").forEach((button) => {
    const active = button.dataset.healthScope === activeScope;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (activeScope !== "therapy" || categoryFilter.value !== "pelvic-floor-therapy") categoryFilter.value = "";
  renderTimeline();
}

function scopeMatches(event, scope) {
  const category = categoryFor(event.category);
  if (scope === "therapy") return category?.group === "therapy";
  if (scope === "symptoms") return event.category === "symptoms";
  if (scope === "preventive") return category?.group === "preventive";
  return true;
}

function previousTherapy(slug) {
  if (categoryFor(slug)?.group !== "therapy") return null;
  return events.filter((event) => event.category === slug && event.event_id !== editingEvent?.event_id).sort(compareDescending)[0] || null;
}

function categoryFor(slug) {
  return categories.find((category) => category.slug === slug);
}

function detailLabel(categorySlug, key) {
  return categoryFor(categorySlug)?.fields.find((field) => field.key === key)?.label || key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function categoryGlyph(category) {
  if (category.slug === "symptoms") return "♡";
  if (category.group === "therapy") return "↗";
  if (category.slug === "dental") return "✦";
  return "＋";
}

function shortCategory(category) {
  const labels = { "pelvic-floor-therapy": "Pelvic floor", "physical-therapy": "Physical therapy", symptoms: "Symptom note", dental: "Dental", "primary-care": "Primary care" };
  return labels[category.slug] || category.name;
}

function suggestedTitle(category) {
  const labels = { "pelvic-floor-therapy": "Pelvic floor therapy session", "physical-therapy": "Physical therapy session", symptoms: "Symptom note", dental: "Dental visit", "annual-physical": "Wellness exam", gynecology: "Gynecology visit", vision: "Eye care visit" };
  return labels[category?.slug] || category?.name || "Health note";
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function localDate(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayDifference(from, to) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);
}

function compareAscending(a, b) {
  return `${a.event_date}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date}T${b.event_time || "23:59"}`);
}

function compareDescending(a, b) {
  return compareAscending(b, a);
}

function slugify(value) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
