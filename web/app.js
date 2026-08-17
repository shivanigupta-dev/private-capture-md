const form = document.querySelector("#capture-form");
const textArea = document.querySelector("#capture-text");
const saveButton = form.querySelector("button[type=submit]");
const downloadButton = document.querySelector("#download-button");
const saveStatus = document.querySelector("#save-status");
const draftStatus = document.querySelector("#draft-status");
const wordCount = document.querySelector("#word-count");
const formatButtons = Array.from(document.querySelectorAll(".format-button"));
const editorModeButtons = Array.from(document.querySelectorAll("[data-editor-mode]"));
const capturePreview = document.querySelector("#capture-preview");
const shortcutLabel = document.querySelector("#shortcut-label");
const list = document.querySelector("#capture-list");
const emptyState = document.querySelector("#empty-state");
const template = document.querySelector("#capture-template");
const inboxCount = document.querySelector("#inbox-count");
const reviewResultCount = document.querySelector("#review-result-count");
const typeFilter = document.querySelector("#filter-type");
const searchFilter = document.querySelector("#filter-search");
const connectionStatus = document.querySelector("#connection-status");
const systemState = document.querySelector("#system-state");
const rootLabel = document.querySelector("#root-label");
const markerStatus = document.querySelector("#marker-status");
const modeStatus = document.querySelector("#mode-status");
const writeStatus = document.querySelector("#write-status");
const todayLabel = document.querySelector("#today-label");
const unlockPanel = document.querySelector("#unlock-panel");
const unlockForm = document.querySelector("#unlock-form");
const unlockStatus = document.querySelector("#unlock-status");
const installButton = document.querySelector("#install-button");

const DRAFT_KEY = "private-capture-session-draft-v2";
const SAVE_INTENT_KEY = "private-capture-save-intent-v1";
const TEXT_SIZE_KEY = "private-capture-text-size-v1";
let searchTimer;
let draftTimer;
let writesEnabled = false;
let editorMode = "write";
let deferredInstallPrompt = null;

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new ApiError(payload.error?.message || "Something went wrong.", response.status, payload.error?.code);
  return payload;
}

function showView(name) {
  document.body.dataset.activeView = name;
  document.querySelectorAll(".nav-button").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}-view`));
  window.history.replaceState(null, "", `#${name}`);
  if (name === "review") loadCaptures().catch(showPageError);
  else if (name === "health") window.healthJournal?.activate();
  else textArea.focus();
}

document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));

function readableTimestamp(value, fallback) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : fallback;
}

function showPageError(error) {
  saveStatus.className = "status error";
  saveStatus.textContent = error instanceof Error ? error.message : "The page could not be updated.";
}

function showLocked() {
  writesEnabled = false;
  saveButton.disabled = true;
  unlockPanel.hidden = false;
  connectionStatus.className = "system-panel blocked";
  systemState.textContent = "Unlock this device to continue";
  rootLabel.textContent = "Protected";
  markerStatus.textContent = "Not checked while locked";
  modeStatus.textContent = "Token protected";
  window.dispatchEvent(new CustomEvent("private-capture:write-state", { detail: { enabled: false } }));
}

async function refreshHealth() {
  try {
    const health = await api("/api/v1/health");
    writesEnabled = health.marker_valid === true;
    unlockPanel.hidden = true;
    connectionStatus.className = `system-panel ${writesEnabled ? "valid" : "blocked"}`;
    systemState.textContent = writesEnabled ? "Ready for private capture" : "Writes are safely paused";
    rootLabel.textContent = health.root_label;
    markerStatus.textContent = writesEnabled ? "Valid · writes enabled" : "Invalid · writes blocked";
    modeStatus.textContent = health.access_mode === "local" ? "This computer only" : "Private network session";
    writeStatus.textContent = readableTimestamp(health.latest_successful_write_at, "None this session");
    saveButton.disabled = !writesEnabled;
    window.dispatchEvent(new CustomEvent("private-capture:write-state", { detail: { enabled: writesEnabled } }));
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showLocked();
      return false;
    }
    writesEnabled = false;
    saveButton.disabled = true;
    connectionStatus.className = "system-panel blocked";
    systemState.textContent = "Writes are safely paused";
    rootLabel.textContent = "Unavailable";
    markerStatus.textContent = "Unavailable · writes blocked";
    modeStatus.textContent = "Unavailable";
    window.dispatchEvent(new CustomEvent("private-capture:write-state", { detail: { enabled: false } }));
    return false;
  }
}

function draftPayload() {
  const data = new FormData(form);
  return {
    captureType: data.get("captureType"),
    text: String(data.get("text") || ""),
    title: String(data.get("title") || ""),
    sourceUrl: String(data.get("sourceUrl") || ""),
    occurredOn: String(data.get("occurredOn") || ""),
  };
}

function updateWritingStats() {
  const text = textArea.value;
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"} · ${text.length} ${text.length === 1 ? "character" : "characters"}`;
}

function appendInlineMarkdown(parent, text) {
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/gu;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else if (token.startsWith("*")) {
      const emphasis = document.createElement("em");
      emphasis.textContent = token.slice(1, -1);
      parent.append(emphasis);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/u);
      if (linkMatch) {
        const anchor = document.createElement("a");
        anchor.textContent = linkMatch[1];
        anchor.href = linkMatch[2];
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        parent.append(anchor);
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function renderMarkdownPreview() {
  capturePreview.replaceChildren();
  const source = textArea.value.trimEnd();
  if (!source.trim()) {
    const empty = document.createElement("p");
    empty.className = "preview-empty";
    empty.textContent = "Your formatted preview will appear here.";
    capturePreview.append(empty);
    return;
  }
  let activeList = null;
  for (const line of source.split("\n")) {
    if (!line.trim()) { activeList = null; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/u);
    const quote = line.match(/^>\s?(.*)$/u);
    const listItem = line.match(/^[-*]\s+(.+)$/u);
    if (heading) {
      activeList = null;
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2]);
      capturePreview.append(element);
    } else if (quote) {
      activeList = null;
      const element = document.createElement("blockquote");
      appendInlineMarkdown(element, quote[1]);
      capturePreview.append(element);
    } else if (listItem) {
      if (!activeList) { activeList = document.createElement("ul"); capturePreview.append(activeList); }
      const item = document.createElement("li");
      appendInlineMarkdown(item, listItem[1]);
      activeList.append(item);
    } else {
      activeList = null;
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, line);
      capturePreview.append(paragraph);
    }
  }
}

function setEditorMode(mode) {
  editorMode = mode === "preview" ? "preview" : "write";
  const previewing = editorMode === "preview";
  textArea.hidden = previewing;
  capturePreview.hidden = !previewing;
  formatButtons.forEach((button) => { button.disabled = previewing; });
  editorModeButtons.forEach((button) => {
    const active = button.dataset.editorMode === editorMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (previewing) renderMarkdownPreview(); else textArea.focus();
}

function replaceSelection(before, after, placeholder) {
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const content = textArea.value.slice(start, end) || placeholder;
  textArea.setRangeText(`${before}${content}${after}`, start, end, "end");
  textArea.focus();
  textArea.setSelectionRange(start + before.length, start + before.length + content.length);
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
}

function prefixSelectedLines(prefix, placeholder, removePattern) {
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const lineStart = textArea.value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const followingBreak = textArea.value.indexOf("\n", end);
  const lineEnd = followingBreak === -1 ? textArea.value.length : followingBreak;
  const selectedLines = textArea.value.slice(lineStart, lineEnd) || placeholder;
  const replacement = selectedLines.split("\n").map((line) => `${prefix}${line.replace(removePattern, "")}`).join("\n");
  textArea.setRangeText(replacement, lineStart, lineEnd, "select");
  textArea.focus();
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertLink() {
  const start = textArea.selectionStart;
  const end = textArea.selectionEnd;
  const selected = textArea.value.slice(start, end);
  const label = selected && !/^https?:\/\//u.test(selected) ? selected : "link text";
  const url = /^https?:\/\//u.test(selected) ? selected : "https://";
  const replacement = `[${label}](${url})`;
  textArea.setRangeText(replacement, start, end, "end");
  textArea.focus();
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyFormat(format) {
  if (editorMode === "preview") setEditorMode("write");
  if (format === "bold") replaceSelection("**", "**", "bold text");
  else if (format === "italic") replaceSelection("*", "*", "italic text");
  else if (format === "heading") prefixSelectedLines("# ", "Heading", /^#{1,3}\s+/u);
  else if (format === "link") insertLink();
  else if (format === "list") prefixSelectedLines("- ", "List item", /^[-*]\s+/u);
  else if (format === "quote") prefixSelectedLines("> ", "Quote", /^>\s?/u);
}

function saveDraft() {
  window.clearTimeout(draftTimer);
  const draft = draftPayload();
  try {
    if (Object.values(draft).some((value) => value && value !== "thought")) {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      draftStatus.className = "draft-status has-draft";
      draftStatus.textContent = "Draft held in this tab.";
    } else {
      window.sessionStorage.removeItem(DRAFT_KEY);
      draftStatus.className = "draft-status";
      draftStatus.textContent = "Nothing leaves this device.";
    }
  } catch {
    draftStatus.textContent = "Draft recovery unavailable; save when ready.";
  }
}

function scheduleDraft() {
  updateWritingStats();
  draftStatus.className = "draft-status has-draft";
  draftStatus.textContent = "Holding this draft in your tab…";
  window.clearTimeout(draftTimer);
  window.sessionStorage.removeItem(SAVE_INTENT_KEY);
  draftTimer = window.setTimeout(saveDraft, 180);
}

function restoreDraft() {
  let draft;
  try { draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "null"); } catch { draft = null; }
  if (!draft || typeof draft !== "object") return updateWritingStats();
  const type = form.querySelector(`input[name="captureType"][value="${CSS.escape(String(draft.captureType || "thought"))}"]`);
  if (type) type.checked = true;
  textArea.value = typeof draft.text === "string" ? draft.text : "";
  form.elements.title.value = typeof draft.title === "string" ? draft.title : "";
  form.elements.sourceUrl.value = typeof draft.sourceUrl === "string" ? draft.sourceUrl : "";
  form.elements.occurredOn.value = typeof draft.occurredOn === "string" ? draft.occurredOn : "";
  draftStatus.className = "draft-status has-draft";
  draftStatus.textContent = "Recovered your unsaved draft from this tab.";
  updateWritingStats();
}

function clearDraft() {
  window.clearTimeout(draftTimer);
  try { window.sessionStorage.removeItem(DRAFT_KEY); window.sessionStorage.removeItem(SAVE_INTENT_KEY); } catch { /* Optional recovery. */ }
  draftStatus.className = "draft-status";
  draftStatus.textContent = "Nothing leaves this device.";
  updateWritingStats();
}

function currentSaveIntent(payload) {
  let existing;
  try { existing = JSON.parse(window.sessionStorage.getItem(SAVE_INTENT_KEY) || "null"); } catch { existing = null; }
  const signature = JSON.stringify(payload);
  if (existing?.signature === signature && typeof existing.key === "string" && typeof existing.createdAt === "string") return existing;
  const created = { signature, key: crypto.randomUUID(), createdAt: new Date().toISOString() };
  window.sessionStorage.setItem(SAVE_INTENT_KEY, JSON.stringify(created));
  return created;
}

formatButtons.forEach((button) => button.addEventListener("click", () => applyFormat(button.dataset.format)));
editorModeButtons.forEach((button) => button.addEventListener("click", () => setEditorMode(button.dataset.editorMode)));
textArea.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  const format = { b: "bold", i: "italic", k: "link" }[event.key.toLowerCase()];
  if (format) { event.preventDefault(); applyFormat(format); }
});
form.addEventListener("input", scheduleDraft);
form.addEventListener("change", scheduleDraft);
form.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    if (!saveButton.disabled && textArea.value.trim()) form.requestSubmit();
  }
});
window.addEventListener("pagehide", saveDraft);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!writesEnabled) return showPageError(new Error("Writes are paused until the connection and approval marker are valid."));
  saveStatus.className = "status";
  saveStatus.textContent = "Saving your exact words…";
  saveButton.disabled = true;
  const data = new FormData(form);
  const basePayload = {
    captureType: data.get("captureType"),
    text: data.get("text"),
    title: data.get("title") || undefined,
    sourceUrl: data.get("sourceUrl") || undefined,
    occurredOn: data.get("occurredOn") || undefined,
  };
  const intent = currentSaveIntent(basePayload);
  try {
    await api("/api/v1/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key },
      body: JSON.stringify({ ...basePayload, clientCreatedAt: intent.createdAt }),
    });
    const selectedType = data.get("captureType");
    form.reset();
    form.querySelector(`input[value="${CSS.escape(String(selectedType))}"]`).checked = true;
    form.querySelector(".optional-details").open = false;
    setEditorMode("write");
    clearDraft();
    saveStatus.textContent = "Saved privately. Your mind can let this one go.";
    await Promise.all([refreshCount(), refreshHealth()]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) showLocked();
    saveStatus.className = "status error";
    saveStatus.textContent = error.message;
    saveDraft();
  } finally {
    saveButton.disabled = !writesEnabled;
  }
});

async function saveProposal(capture, select, status) {
  if (!select.value) return;
  status.className = "review-status";
  status.textContent = "Saving suggestion…";
  try {
    await api("/api/v1/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captureId: capture.id, captureHash: capture.content_hash, classification: select.value }),
    });
    status.textContent = "Suggestion saved separately. Your original words are untouched.";
    await Promise.all([loadCaptures(), refreshHealth()]);
  } catch (error) {
    status.className = "review-status error";
    status.textContent = error.message;
  }
}

async function loadCaptures() {
  const payload = await api("/api/v1/captures");
  const query = searchFilter.value.trim().toLocaleLowerCase();
  const captures = payload.captures.filter((capture) => {
    if (typeFilter.value && capture.capture_type !== typeFilter.value) return false;
    return !query || `${capture.title}\n${capture.body}`.toLocaleLowerCase().includes(query);
  });
  list.replaceChildren();
  const count = captures.length;
  emptyState.hidden = count !== 0;
  reviewResultCount.textContent = count === 0 ? "No captures in this view" : `${count} ${count === 1 ? "capture" : "captures"} in this view`;
  captures.forEach((capture, index) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".review-card-index").textContent = String(index + 1).padStart(2, "0");
    fragment.querySelector(".type-pill").textContent = capture.capture_type.replace("-", " ");
    fragment.querySelector("time").textContent = new Date(capture.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    fragment.querySelector("h3").textContent = capture.title;
    fragment.querySelector(".capture-body").textContent = capture.body;
    fragment.querySelector(".related-project").hidden = true;
    const select = fragment.querySelector(".proposal select");
    select.value = capture.review?.proposed_classification || "";
    const status = fragment.querySelector(".review-status");
    if (capture.review) status.textContent = "Latest suggestion shown. Your original words are untouched.";
    select.addEventListener("change", () => saveProposal(capture, select, status));
    list.append(fragment);
  });
}

async function refreshCount() {
  const payload = await api("/api/v1/captures");
  inboxCount.textContent = payload.captures.length;
}

typeFilter.addEventListener("change", () => loadCaptures().catch(showPageError));
searchFilter.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => loadCaptures().catch(showPageError), 180);
});

unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  unlockStatus.textContent = "Unlocking…";
  const token = new FormData(unlockForm).get("token");
  try {
    await api("/api/v1/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    unlockForm.reset();
    unlockStatus.textContent = "";
    if (await refreshHealth()) await refreshCount();
    textArea.focus();
  } catch (error) {
    unlockStatus.textContent = error.message;
  }
});

function markdownDownload() {
  const draft = draftPayload();
  if (!draft.text.trim()) return showPageError(new Error("Write something before downloading."));
  const createdAt = new Date().toISOString();
  const id = `cap_${crypto.randomUUID()}`;
  const title = draft.title.trim() || "Untitled capture";
  const optional = [draft.sourceUrl ? `source_url: ${JSON.stringify(draft.sourceUrl)}` : "", draft.occurredOn ? `occurred_on: ${JSON.stringify(draft.occurredOn)}` : ""].filter(Boolean);
  const markdown = `---\ntype: "capture"\nid: ${JSON.stringify(id)}\nschema_version: 1\ncreated_at: ${JSON.stringify(createdAt)}\nupdated_at: ${JSON.stringify(createdAt)}\nsaved_at: ${JSON.stringify(createdAt)}\nowner: "private-capture"\nprivacy: "private"\ntitle: ${JSON.stringify(title)}\ncapture_type: ${JSON.stringify(draft.captureType)}\nstate: "inbox"\n${optional.length ? `${optional.join("\n")}\n` : ""}---\n${draft.text}`;
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || draft.captureType;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  link.download = `${createdAt.slice(0, 10)}--${slug}--${id.slice(4, 12)}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  saveStatus.className = "status";
  saveStatus.textContent = "Downloaded as Markdown. Move the file wherever you keep notes.";
}

downloadButton.addEventListener("click", markdownDownload);

function setTextSize(size) {
  const accepted = ["small", "medium", "large"].includes(size) ? size : "medium";
  document.documentElement.dataset.textSize = accepted;
  document.querySelectorAll("[data-text-size]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.textSize === accepted)));
  try { localStorage.setItem(TEXT_SIZE_KEY, accepted); } catch { /* Preference storage is optional. */ }
}

document.querySelectorAll("[data-text-size]").forEach((button) => button.addEventListener("click", () => setTextSize(button.dataset.textSize)));
let savedSize = "medium";
try { savedSize = localStorage.getItem(TEXT_SIZE_KEY) || "medium"; } catch { /* Use default. */ }
setTextSize(savedSize);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

shortcutLabel.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ ↵" : "Ctrl ↵";
todayLabel.textContent = new Intl.DateTimeFormat([], { month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
restoreDraft();
try {
  if (localStorage.getItem("private-capture-visited")) document.body.classList.add("returning");
  localStorage.setItem("private-capture-visited", "true");
} catch { /* First-visit polish is optional. */ }

async function boot() {
  if (await refreshHealth()) {
    await refreshCount();
    if (["#review", "#health"].includes(window.location.hash)) showView(window.location.hash.slice(1));
  }
}

boot().catch(showPageError);
window.setInterval(refreshHealth, 15_000);
if ("serviceWorker" in navigator && (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1")) navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
