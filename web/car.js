const carCount = document.querySelector("#car-count");
const addVehicleButton = document.querySelector("#add-vehicle");
const newEntryButton = document.querySelector("#new-car-entry");
const garage = document.querySelector("#car-garage");
const vehicleTabs = document.querySelector("#vehicle-tabs");
const manualLink = document.querySelector("#car-manual-link");
const scheduleLink = document.querySelector("#car-schedule-link");
const emptyGarage = document.querySelector("#car-empty");
const dashboard = document.querySelector("#car-dashboard");
const quickTypes = document.querySelector("#car-quick-types");
const mileageStat = document.querySelector("#car-mileage-stat");
const mileageNote = document.querySelector("#car-mileage-note");
const nextStat = document.querySelector("#car-next-stat");
const nextNote = document.querySelector("#car-next-note");
const recordStat = document.querySelector("#car-record-stat");
const spendStat = document.querySelector("#car-spend-stat");
const dueList = document.querySelector("#car-due-list");
const dueEmpty = document.querySelector("#car-due-empty");
const historyList = document.querySelector("#car-event-list");
const historyEmpty = document.querySelector("#car-history-empty");
const resultsLabel = document.querySelector("#car-results-label");
const searchInput = document.querySelector("#car-search");
const categoryFilter = document.querySelector("#car-category-filter");
const yearFilter = document.querySelector("#car-year-filter");
const logAnotherButton = document.querySelector("#car-log-another");
const eventTemplate = document.querySelector("#car-event-template");

const vehicleDialog = document.querySelector("#vehicle-dialog");
const vehicleForm = document.querySelector("#vehicle-form");
const closeVehicleDialog = document.querySelector("#close-vehicle-dialog");
const cancelVehicle = document.querySelector("#cancel-vehicle");
const saveVehicleButton = document.querySelector("#save-vehicle");
const vehicleFormStatus = document.querySelector("#vehicle-form-status");

const carDialog = document.querySelector("#car-dialog");
const carForm = document.querySelector("#car-form");
const closeCarDialog = document.querySelector("#close-car-dialog");
const cancelCarEntry = document.querySelector("#cancel-car-entry");
const saveCarEntry = document.querySelector("#save-car-entry");
const carFormStatus = document.querySelector("#car-form-status");
const formVehicle = document.querySelector("#car-form-vehicle");
const serviceTypeSelect = document.querySelector("#car-service-type");
const categoryChips = document.querySelector("#car-category-chips");
const guidedSection = document.querySelector("#car-guided-section");
const guidedFields = document.querySelector("#car-guided-fields");

const VEHICLE_INTENT_KEY = "private-capture-vehicle-save-intent-v1";
const CAR_INTENT_KEY = "private-capture-car-save-intent-v1";
const DETAIL_LABELS = {
  oil_viscosity: "Oil viscosity",
  oil_type: "Oil type",
  oil_quantity: "Quantity",
  oil_filter: "Filter brand / part number",
  tire_work: "Tire work",
  tire_position: "Position / axle",
  tire_brand_model: "Tire brand / model",
  tire_size: "Tire size",
  tire_pressure: "Cold pressure",
  tread_notes: "Tread notes",
  brake_work: "Brake work",
  brake_axle: "Axle / wheels",
  brake_measurement: "Pad / rotor measurement",
  brake_parts: "Brake parts",
  battery_work: "Battery work",
  battery_brand_model: "Battery brand / model",
  battery_rating: "Rating / test result",
  inspection_type: "Inspection type",
  inspection_result: "Result",
  inspection_items: "Items to address",
  fluid_filter_type: "Fluid / filter",
  fluid_filter_product: "Product / part number",
  fluid_filter_quantity: "Quantity",
  issue_status: "Issue status",
  symptom: "Symptom",
  diagnosis: "Diagnosis",
  parts_used: "Parts used",
  work_performed: "Work performed",
};

let metadata = { presets: [], service_types: [], recall_url: "https://www.nhtsa.gov/recalls" };
let vehicles = [];
let events = [];
let selectedVehicleId = "";
let selectedCategory = "oil-filter";
let writeEnabled = false;
let loaded = false;
let loading = null;
let searchTimer;

class CarApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function carApi(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new CarApiError(payload.error?.message || "The vehicle log could not be updated.", response.status);
  return payload;
}

async function loadCar(force = false) {
  if (loading && !force) return loading;
  loading = Promise.all([
    carApi("/api/v1/car/meta"),
    carApi("/api/v1/vehicles"),
    carApi("/api/v1/vehicle-events"),
  ]).then(([meta, vehicleListing, eventListing]) => {
    metadata = meta;
    vehicles = vehicleListing.vehicles;
    events = eventListing.events;
    if (!vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) selectedVehicleId = vehicles[0]?.id || "";
    loaded = true;
    renderStaticControls();
    renderCar();
  }).catch((error) => {
    resultsLabel.textContent = error instanceof Error ? error.message : "The vehicle log could not be loaded.";
  }).finally(() => { loading = null; });
  return loading;
}

function activate() {
  if (!loaded) void loadCar();
  else renderCar();
}

window.carMaintenance = { activate, openVoiceDraft };

window.addEventListener("private-capture:write-state", (event) => {
  writeEnabled = event.detail?.enabled === true;
  [addVehicleButton, newEntryButton, saveVehicleButton, saveCarEntry].forEach((button) => { button.disabled = !writeEnabled; });
});

function renderStaticControls() {
  quickTypes.replaceChildren();
  categoryChips.replaceChildren();
  categoryFilter.replaceChildren(option("", "Every type"));
  metadata.presets.forEach((preset) => {
    categoryFilter.append(option(preset.slug, preset.name));

    const quick = document.createElement("button");
    quick.type = "button";
    quick.className = `car-quick-type tone-${preset.tone}`;
    const mark = document.createElement("span");
    mark.textContent = preset.glyph;
    const label = document.createElement("b");
    label.textContent = preset.short_name;
    quick.append(mark, label);
    quick.addEventListener("click", () => openCarEditor(preset.slug));
    quickTypes.append(quick);

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `${preset.slug === selectedCategory ? "selected " : ""}tone-${preset.tone}`;
    chip.dataset.category = preset.slug;
    const dot = document.createElement("i");
    const name = document.createElement("span");
    name.textContent = preset.name;
    chip.append(dot, name);
    chip.addEventListener("click", () => selectCategory(preset.slug));
    categoryChips.append(chip);
  });

  serviceTypeSelect.replaceChildren(option("", "Not specified"));
  metadata.service_types.forEach((item) => serviceTypeSelect.append(option(item.value, item.label)));
  scheduleLink.href = metadata.recall_url;
}

function renderCar() {
  carCount.textContent = String(events.length);
  const hasVehicles = vehicles.length > 0;
  garage.hidden = !hasVehicles;
  emptyGarage.hidden = hasVehicles;
  dashboard.hidden = !hasVehicles;
  newEntryButton.hidden = !hasVehicles;
  if (!hasVehicles) return;
  renderGarage();
  renderStats();
  renderDueItems();
  renderFilters();
  renderHistory();
}

function renderGarage() {
  vehicleTabs.replaceChildren();
  vehicles.forEach((vehicle) => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "tab";
    button.className = vehicle.id === selectedVehicleId ? "active" : "";
    button.setAttribute("aria-selected", String(vehicle.id === selectedVehicleId));
    const dot = document.createElement("i");
    const label = document.createElement("span");
    label.textContent = vehicle.display_name;
    button.append(dot, label);
    button.addEventListener("click", () => {
      selectedVehicleId = vehicle.id;
      searchInput.value = "";
      categoryFilter.value = "";
      yearFilter.value = "";
      renderCar();
    });
    vehicleTabs.append(button);
  });
  const vehicle = selectedVehicle();
  manualLink.hidden = !vehicle?.owner_manual_url;
  if (vehicle?.owner_manual_url) manualLink.href = vehicle.owner_manual_url;
}

function renderStats() {
  const vehicle = selectedVehicle();
  const vehicleEvents = eventsForVehicle();
  const latestWithMileage = vehicleEvents.find((event) => Number.isFinite(event.odometer));
  mileageStat.textContent = latestWithMileage ? formatDistance(latestWithMileage.odometer, vehicle) : "—";
  mileageNote.textContent = latestWithMileage ? `Recorded ${formatDate(latestWithMileage.service_date)}` : "Add it when useful";
  recordStat.textContent = String(vehicleEvents.length);
  const currentYear = String(new Date().getFullYear());
  const yearSpend = vehicleEvents.filter((event) => event.service_date.startsWith(currentYear) && Number.isFinite(event.cost)).reduce((sum, event) => sum + event.cost, 0);
  spendStat.textContent = yearSpend ? formatMoney(yearSpend, vehicle.currency) : "—";
  const reminders = reminderItems(vehicleEvents, latestWithMileage?.odometer);
  if (reminders.length) {
    nextStat.textContent = reminders[0].short;
    nextNote.textContent = reminders[0].title;
  } else {
    nextStat.textContent = "Nothing yet";
    nextNote.textContent = "Use your owner’s manual";
  }
}

function renderDueItems() {
  const vehicleEvents = eventsForVehicle();
  const latestMileage = vehicleEvents.find((event) => Number.isFinite(event.odometer))?.odometer;
  const reminders = reminderItems(vehicleEvents, latestMileage).slice(0, 4);
  dueList.replaceChildren();
  dueEmpty.hidden = reminders.length > 0;
  reminders.forEach((item) => {
    const row = document.createElement("div");
    const preset = presetFor(item.event.category);
    row.className = `car-due-row tone-${preset?.tone || "stone"}`;
    const icon = document.createElement("span");
    icon.textContent = preset?.glyph || "◷";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("small");
    meta.textContent = item.meta;
    copy.append(title, meta);
    const timing = document.createElement("b");
    timing.textContent = item.short;
    timing.className = item.overdue ? "overdue" : "";
    row.append(icon, copy, timing);
    dueList.append(row);
  });
}

function reminderItems(vehicleEvents, latestMileage) {
  const today = localDate();
  const vehicle = selectedVehicle();
  const items = [];
  vehicleEvents.forEach((event) => {
    if (event.next_due_date) {
      const days = dayDifference(today, event.next_due_date);
      items.push({
        event,
        title: event.title,
        meta: `Due by ${formatDate(event.next_due_date)}`,
        short: days < 0 ? `${Math.abs(days)}d late` : days === 0 ? "Today" : days <= 60 ? `In ${days}d` : formatDateShort(event.next_due_date),
        overdue: days < 0,
        priority: days,
      });
    }
    if (Number.isFinite(event.next_due_odometer)) {
      const remaining = Number.isFinite(latestMileage) ? event.next_due_odometer - latestMileage : null;
      items.push({
        event,
        title: event.title,
        meta: `Due at ${formatDistance(event.next_due_odometer, vehicle)}`,
        short: remaining === null ? formatDistance(event.next_due_odometer, vehicle) : remaining < 0 ? `${formatCompactDistance(Math.abs(remaining), vehicle)} late` : `${formatCompactDistance(remaining, vehicle)} left`,
        overdue: remaining !== null && remaining < 0,
        priority: remaining === null ? 200_000 + event.next_due_odometer : Math.round(remaining / 10),
      });
    }
  });
  return items.sort((a, b) => a.priority - b.priority);
}

function renderFilters() {
  const current = yearFilter.value;
  const years = [...new Set(eventsForVehicle().map((event) => event.service_date.slice(0, 4)))].sort().reverse();
  yearFilter.replaceChildren(option("", "Every year"));
  years.forEach((year) => yearFilter.append(option(year, year)));
  yearFilter.value = years.includes(current) ? current : "";
}

function renderHistory() {
  const all = eventsForVehicle();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filtered = all.filter((event) => {
    if (categoryFilter.value && event.category !== categoryFilter.value) return false;
    if (yearFilter.value && !event.service_date.startsWith(yearFilter.value)) return false;
    if (!query) return true;
    return [event.title, event.category_label, event.provider, event.service_type, event.body, event.receipt_reference, ...Object.values(event.details || {})].join("\n").toLocaleLowerCase().includes(query);
  });
  historyList.replaceChildren(...filtered.map(eventCard));
  historyEmpty.hidden = filtered.length !== 0;
  resultsLabel.textContent = filtered.length === all.length
    ? `${all.length} ${all.length === 1 ? "record" : "records"} for ${selectedVehicle()?.display_name}`
    : `${filtered.length} of ${all.length} records shown`;
}

function eventCard(event) {
  const fragment = eventTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".car-event-card");
  const date = new Date(`${event.service_date}T12:00:00`);
  card.querySelector(".car-date-tile span").textContent = date.toLocaleDateString([], { month: "short" });
  card.querySelector(".car-date-tile strong").textContent = String(date.getDate());
  card.querySelector(".car-date-tile small").textContent = String(date.getFullYear());
  const preset = presetFor(event.category);
  const pill = card.querySelector(".car-category-pill");
  pill.classList.add(`tone-${preset?.tone || "stone"}`);
  pill.querySelector("b").textContent = event.category_label;
  const odometer = card.querySelector(".car-odometer");
  odometer.textContent = Number.isFinite(event.odometer) ? formatDistance(event.odometer, selectedVehicle()) : "";
  odometer.hidden = !odometer.textContent;
  const cost = card.querySelector(".car-cost");
  cost.textContent = Number.isFinite(event.cost) ? formatMoney(event.cost, selectedVehicle().currency) : "";
  cost.hidden = !cost.textContent;
  card.querySelector("h4").textContent = event.title;
  const provider = card.querySelector(".car-provider");
  provider.textContent = [serviceTypeLabel(event.service_type), event.provider].filter(Boolean).join(" · ");
  provider.hidden = !provider.textContent;
  const summary = card.querySelector(".car-event-summary");
  summary.textContent = event.body || event.details?.work_performed || event.details?.symptom || event.details?.tread_notes || "";
  summary.hidden = !summary.textContent;
  const reminders = card.querySelector(".car-reminder-chips");
  if (event.next_due_date) appendChip(reminders, `Next: ${formatDate(event.next_due_date)}`);
  if (Number.isFinite(event.next_due_odometer)) appendChip(reminders, `Next: ${formatDistance(event.next_due_odometer, selectedVehicle())}`);
  if (event.warranty_until_date) appendChip(reminders, `Warranty: ${formatDate(event.warranty_until_date)}`);
  if (Number.isFinite(event.warranty_until_odometer)) appendChip(reminders, `Warranty: ${formatDistance(event.warranty_until_odometer, selectedVehicle())}`);
  reminders.hidden = reminders.childElementCount === 0;
  const details = card.querySelector(".car-detail-grid");
  Object.entries(event.details || {}).forEach(([key, value]) => appendDetail(details, DETAIL_LABELS[key] || humanize(key), value));
  if (event.body && event.body !== summary.textContent) appendDetail(details, "Notes", event.body);
  if (Number.isFinite(event.parts_cost)) appendDetail(details, "Parts cost", formatMoney(event.parts_cost, selectedVehicle().currency));
  if (Number.isFinite(event.labor_cost)) appendDetail(details, "Labor cost", formatMoney(event.labor_cost, selectedVehicle().currency));
  if (event.receipt_reference) appendDetail(details, "Receipt / work order", event.receipt_reference);
  card.querySelector(".car-event-details").hidden = details.childElementCount === 0;
  return card;
}

function appendChip(parent, text) {
  const chip = document.createElement("span");
  chip.textContent = text;
  parent.append(chip);
}

function appendDetail(parent, label, value) {
  if (!value) return;
  const row = document.createElement("div");
  const heading = document.createElement("span");
  heading.textContent = label;
  const content = document.createElement("p");
  content.textContent = String(value);
  row.append(heading, content);
  parent.append(row);
}

function openVehicleEditor() {
  vehicleForm.reset();
  vehicleFormStatus.textContent = "";
  vehicleFormStatus.className = "car-form-status";
  saveVehicleButton.disabled = !writeEnabled;
  openDialog(vehicleDialog);
  vehicleForm.elements.displayName.focus();
}

function openCarEditor(category = selectedCategory) {
  if (!vehicles.length) return openVehicleEditor();
  carForm.reset();
  carFormStatus.textContent = "";
  carFormStatus.className = "car-form-status";
  formVehicle.replaceChildren(...vehicles.map((vehicle) => option(vehicle.id, vehicleDescription(vehicle))));
  formVehicle.value = selectedVehicleId || vehicles[0].id;
  carForm.elements.serviceDate.value = localDate();
  selectCategory(category || metadata.presets[0]?.slug);
  saveCarEntry.disabled = !writeEnabled;
  openDialog(carDialog);
}

async function openVoiceDraft(proposal) {
  if (!loaded) await loadCar();
  if (!loaded) return { ok: false, message: "The Car log could not be loaded." };
  if (!vehicles.length) return { ok: false, message: "Add a vehicle before routing maintenance into the Car log." };
  window.privateCapture?.showView("car");
  const fields = proposal?.fields || {};
  const category = metadata.presets.some((preset) => preset.slug === fields.category) ? fields.category : "repair-issue";
  openCarEditor(category);
  if (typeof fields.title === "string" && fields.title.trim()) carForm.elements.title.value = fields.title;
  if (Number.isFinite(fields.odometer)) carForm.elements.odometer.value = String(fields.odometer);
  if (Number.isFinite(fields.cost)) {
    carForm.elements.cost.value = String(fields.cost);
    carForm.querySelector(".car-more-details").open = true;
  }
  carForm.elements.notes.value = String(proposal?.transcript || "").trim();
  carForm.elements.notes.focus();
  return { ok: true };
}

function selectCategory(slug) {
  selectedCategory = metadata.presets.some((preset) => preset.slug === slug) ? slug : metadata.presets[0]?.slug;
  categoryChips.querySelectorAll("button").forEach((button) => {
    const selected = button.dataset.category === selectedCategory;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const preset = presetFor(selectedCategory);
  carForm.elements.title.value = preset?.suggested_title || "Vehicle note";
  renderGuidedFields(preset);
}

function renderGuidedFields(preset) {
  guidedFields.replaceChildren();
  const fields = preset?.fields || [];
  guidedSection.hidden = fields.length === 0;
  fields.forEach((definition) => {
    const label = document.createElement("label");
    const heading = document.createElement("span");
    heading.textContent = definition.label;
    let input;
    if (definition.kind === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else if (definition.kind === "select") {
      input = document.createElement("select");
      input.append(option("", "Not specified"));
      definition.options.forEach((value) => input.append(option(value, value)));
    } else {
      input = document.createElement("input");
    }
    input.dataset.detailKey = definition.key;
    label.append(heading, input);
    guidedFields.append(label);
  });
}

vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!writeEnabled) return showVehicleError(new Error("Writes are paused until the private boundary is available."));
  const data = new FormData(vehicleForm);
  const payload = {
    displayName: data.get("displayName"),
    year: optionalNumber(data.get("year")),
    make: data.get("make") || undefined,
    model: data.get("model") || undefined,
    distanceUnit: data.get("distanceUnit"),
    currency: data.get("currency"),
    ownerManualUrl: data.get("ownerManualUrl") || undefined,
    notes: data.get("notes") || "",
  };
  const intent = currentIntent(VEHICLE_INTENT_KEY, payload);
  saveVehicleButton.disabled = true;
  vehicleFormStatus.textContent = "Adding to your garage…";
  try {
    const result = await carApi("/api/v1/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key },
      body: JSON.stringify({ ...payload, clientCreatedAt: intent.createdAt }),
    });
    selectedVehicleId = result.vehicle.id;
    clearIntent(VEHICLE_INTENT_KEY);
    closeDialogElement(vehicleDialog);
    await loadCar(true);
    resultsLabel.textContent = `${result.vehicle.display_name} is ready for maintenance records.`;
  } catch (error) {
    showVehicleError(error);
  } finally {
    saveVehicleButton.disabled = !writeEnabled;
  }
});

carForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!writeEnabled) return showCarError(new Error("Writes are paused until the private boundary is available."));
  const data = new FormData(carForm);
  const details = {};
  guidedFields.querySelectorAll("[data-detail-key]").forEach((input) => {
    if (input.value.trim()) details[input.dataset.detailKey] = input.value;
  });
  const payload = {
    vehicleId: data.get("vehicleId"),
    serviceDate: data.get("serviceDate"),
    category: selectedCategory,
    title: data.get("title"),
    odometer: optionalNumber(data.get("odometer")),
    provider: data.get("provider") || undefined,
    serviceType: data.get("serviceType") || undefined,
    cost: optionalNumber(data.get("cost")),
    partsCost: optionalNumber(data.get("partsCost")),
    laborCost: optionalNumber(data.get("laborCost")),
    nextDueDate: data.get("nextDueDate") || undefined,
    nextDueOdometer: optionalNumber(data.get("nextDueOdometer")),
    warrantyUntilDate: data.get("warrantyUntilDate") || undefined,
    warrantyUntilOdometer: optionalNumber(data.get("warrantyUntilOdometer")),
    receiptReference: data.get("receiptReference") || undefined,
    notes: data.get("notes") || "",
    details,
  };
  const intent = currentIntent(CAR_INTENT_KEY, payload);
  saveCarEntry.disabled = true;
  carFormStatus.textContent = "Saving a private maintenance record…";
  try {
    await carApi("/api/v1/vehicle-events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key },
      body: JSON.stringify({ ...payload, clientCreatedAt: intent.createdAt }),
    });
    selectedVehicleId = String(payload.vehicleId);
    clearIntent(CAR_INTENT_KEY);
    closeDialogElement(carDialog);
    await loadCar(true);
    resultsLabel.textContent = "Maintenance saved as private Markdown.";
  } catch (error) {
    showCarError(error);
  } finally {
    saveCarEntry.disabled = !writeEnabled;
  }
});

function currentIntent(storageKey, payload) {
  let existing;
  try { existing = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { existing = null; }
  const signature = JSON.stringify(payload);
  if (existing?.signature === signature && typeof existing.key === "string" && typeof existing.createdAt === "string") return existing;
  const created = { signature, key: crypto.randomUUID(), createdAt: new Date().toISOString() };
  sessionStorage.setItem(storageKey, JSON.stringify(created));
  return created;
}

function clearIntent(storageKey) {
  try { sessionStorage.removeItem(storageKey); } catch { /* Retry recovery is optional. */ }
}

function showVehicleError(error) {
  vehicleFormStatus.className = "car-form-status error";
  vehicleFormStatus.textContent = error instanceof Error ? error.message : "The vehicle could not be added.";
}

function showCarError(error) {
  carFormStatus.className = "car-form-status error";
  carFormStatus.textContent = error instanceof Error ? error.message : "The maintenance record could not be saved.";
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialogElement(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

addVehicleButton.addEventListener("click", openVehicleEditor);
emptyGarage.querySelector("button").addEventListener("click", openVehicleEditor);
newEntryButton.addEventListener("click", () => openCarEditor());
logAnotherButton.addEventListener("click", () => openCarEditor());
historyEmpty.querySelector("button").addEventListener("click", () => openCarEditor());
closeVehicleDialog.addEventListener("click", () => closeDialogElement(vehicleDialog));
cancelVehicle.addEventListener("click", () => closeDialogElement(vehicleDialog));
closeCarDialog.addEventListener("click", () => closeDialogElement(carDialog));
cancelCarEntry.addEventListener("click", () => closeDialogElement(carDialog));
vehicleDialog.addEventListener("click", (event) => { if (event.target === vehicleDialog) closeDialogElement(vehicleDialog); });
carDialog.addEventListener("click", (event) => { if (event.target === carDialog) closeDialogElement(carDialog); });
categoryFilter.addEventListener("change", renderHistory);
yearFilter.addEventListener("change", renderHistory);
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(renderHistory, 160);
});

function selectedVehicle() {
  return vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0];
}

function eventsForVehicle() {
  return events.filter((event) => event.vehicle_id === selectedVehicleId);
}

function presetFor(slug) {
  return metadata.presets.find((preset) => preset.slug === slug);
}

function serviceTypeLabel(value) {
  return metadata.service_types.find((item) => item.value === value)?.label || "";
}

function vehicleDescription(vehicle) {
  const detail = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return detail ? `${vehicle.display_name} · ${detail}` : vehicle.display_name;
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function optionalNumber(value) {
  return value === "" || value === null ? undefined : Number(value);
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

function dayDifference(from, to) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);
}

function formatDistance(value, vehicle) {
  return `${new Intl.NumberFormat().format(value)} ${vehicle?.distance_unit || "mi"}`;
}

function formatCompactDistance(value, vehicle) {
  return `${new Intl.NumberFormat([], { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value)} ${vehicle?.distance_unit || "mi"}`;
}

function formatMoney(value, currency) {
  try { return new Intl.NumberFormat([], { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value); }
  catch { return `${Number(value).toFixed(2)} ${currency || "USD"}`; }
}

function humanize(value) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
