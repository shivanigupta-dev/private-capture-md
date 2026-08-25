const launcher = document.querySelector("#voice-launcher");
const dialog = document.querySelector("#voice-dialog");
const closeButton = document.querySelector("#close-voice-dialog");
const captureStep = document.querySelector("#voice-capture-step");
const reviewStep = document.querySelector("#voice-review-step");
const recordButton = document.querySelector("#voice-record-button");
const recordLabel = document.querySelector("#voice-record-label");
const timerLabel = document.querySelector("#voice-timer");
const engineState = document.querySelector("#voice-engine-state");
const status = document.querySelector("#voice-status");
const fallback = document.querySelector("#voice-text-fallback");
const manualTranscript = document.querySelector("#voice-manual-transcript");
const routeManualButton = document.querySelector("#route-manual-transcript");
const transcriptField = document.querySelector("#voice-transcript");
const destinationButtons = Array.from(document.querySelectorAll("[data-voice-destination]"));
const confidence = document.querySelector("#voice-confidence");
const proposalMark = document.querySelector("#voice-proposal-mark");
const proposalTitle = document.querySelector("#voice-proposal-title");
const proposalReason = document.querySelector("#voice-proposal-reason");
const extractedFields = document.querySelector("#voice-extracted-fields");
const reviewStatus = document.querySelector("#voice-review-status");
const startOverButton = document.querySelector("#voice-start-over");
const continueButton = document.querySelector("#voice-continue");

const DESTINATIONS = {
  capture: { label: "Capture", mark: "✦" },
  health: { label: "Health", mark: "+" },
  car: { label: "Car", mark: "◒" },
  workout: { label: "Workout", mark: "↗" },
};

let metadata = { configured: false, language: "en", max_seconds: 120 };
let metadataLoaded = false;
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recordingStartedAt = 0;
let recordingTimer = null;
let stopTimer = null;
let discardRecording = false;
let currentProposal = null;
let selectedDestination = "capture";
let transcriptionController = null;
let transcribing = false;

class VoiceApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function voiceApi(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new VoiceApiError(payload.error?.message || "Voice capture could not continue.", response.status);
  return payload;
}

async function loadMetadata() {
  if (metadataLoaded) return;
  try {
    metadata = await voiceApi("/api/v1/voice/meta");
    metadataLoaded = true;
    renderEngineState();
  } catch (error) {
    engineState.className = "voice-engine-state offline";
    engineState.querySelector("strong").textContent = "Voice status unavailable";
    engineState.querySelector("span").textContent = error instanceof Error ? error.message : "The server could not be reached.";
  }
}

function microphoneAvailable() {
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

function renderEngineState() {
  if (!metadata.configured) {
    engineState.className = "voice-engine-state offline";
    engineState.querySelector("strong").textContent = "Local transcription is not connected yet";
    engineState.querySelector("span").textContent = "Typed routing works now; connect a free local engine on the Linux host for speech.";
    recordLabel.textContent = "Voice needs setup";
    timerLabel.textContent = "use typed transcript below";
    return;
  }
  if (!microphoneAvailable()) {
    engineState.className = "voice-engine-state offline";
    engineState.querySelector("strong").textContent = "Microphone needs HTTPS";
    engineState.querySelector("span").textContent = "Open this app through its HTTPS address on your private network.";
    recordLabel.textContent = "HTTPS needed";
    timerLabel.textContent = "typed routing still works";
    return;
  }
  engineState.className = "voice-engine-state ready";
  engineState.querySelector("strong").textContent = `Local English transcription ready`;
  engineState.querySelector("span").textContent = `Audio stays on your private path and is discarded after transcription.`;
  recordLabel.textContent = "Tap to talk";
  timerLabel.textContent = `up to ${formatDuration(metadata.max_seconds)}`;
}

function openVoice() {
  resetToCapture(false);
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  void loadMetadata();
}

function closeVoice() {
  discardRecording = true;
  transcriptionController?.abort();
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  releaseMicrophone();
  if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
  resetToCapture(true);
}

function resetToCapture(clearTranscript = true) {
  captureStep.hidden = false;
  reviewStep.hidden = true;
  recordButton.className = "voice-orb";
  status.className = "voice-status";
  status.textContent = "";
  reviewStatus.className = "voice-status";
  reviewStatus.textContent = "";
  currentProposal = null;
  selectedDestination = "capture";
  if (clearTranscript) {
    manualTranscript.value = "";
    transcriptField.value = "";
    fallback.open = false;
  }
  renderEngineState();
}

async function toggleRecording() {
  if (transcribing) return;
  if (mediaRecorder?.state === "recording") return mediaRecorder.stop();
  if (!metadataLoaded) await loadMetadata();
  if (!metadata.configured) {
    status.className = "voice-status error";
    status.textContent = "Connect a local transcription engine on the Linux host first. You can test routing with typed text below.";
    fallback.open = true;
    manualTranscript.focus();
    return;
  }
  if (!microphoneAvailable()) {
    status.className = "voice-status error";
    status.textContent = "Microphone capture requires HTTPS and browser permission.";
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    const preferredTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
    const mimeType = preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
    audioChunks = [];
    discardRecording = false;
    mediaRecorder.addEventListener("dataavailable", (event) => { if (event.data.size) audioChunks.push(event.data); });
    mediaRecorder.addEventListener("stop", finishRecording, { once: true });
    mediaRecorder.start(1000);
    recordingStartedAt = Date.now();
    recordButton.className = "voice-orb recording";
    recordButton.setAttribute("aria-label", "Stop recording");
    recordLabel.textContent = "Listening…";
    status.textContent = "Tap again when you’re finished.";
    recordingTimer = window.setInterval(updateTimer, 250);
    stopTimer = window.setTimeout(() => { if (mediaRecorder?.state === "recording") mediaRecorder.stop(); }, metadata.max_seconds * 1000);
    updateTimer();
  } catch (error) {
    releaseMicrophone();
    status.className = "voice-status error";
    status.textContent = error instanceof Error && error.name === "NotAllowedError" ? "Microphone permission was not granted. Typed routing is still available below." : "The microphone could not start on this device.";
  }
}

function updateTimer() {
  const elapsed = Math.min(metadata.max_seconds, Math.floor((Date.now() - recordingStartedAt) / 1000));
  timerLabel.textContent = `${formatDuration(elapsed)} · ${formatDuration(Math.max(0, metadata.max_seconds - elapsed))} left`;
}

async function finishRecording() {
  window.clearInterval(recordingTimer);
  window.clearTimeout(stopTimer);
  const chunks = audioChunks.slice();
  const type = mediaRecorder?.mimeType || chunks[0]?.type || "audio/webm";
  releaseMicrophone();
  recordButton.setAttribute("aria-label", "Start recording");
  if (discardRecording) return;
  if (!chunks.length) return showCaptureError("The recording was empty. Please try again.");
  const audio = new Blob(chunks, { type });
  recordButton.className = "voice-orb transcribing";
  recordButton.disabled = true;
  recordLabel.textContent = "Transcribing…";
  timerLabel.textContent = "on your local server";
  status.textContent = "Turning your words into an editable draft.";
  transcribing = true;
  transcriptionController = new AbortController();
  try {
    const payload = await voiceApi("/api/v1/voice/transcribe", { method: "POST", headers: { "Content-Type": audio.type }, body: audio, signal: transcriptionController.signal });
    if (dialog.open) showReview(payload.proposal);
  } catch (error) {
    if (dialog.open && !(error instanceof Error && error.name === "AbortError")) showCaptureError(error instanceof Error ? error.message : "The recording could not be transcribed.");
  } finally {
    transcriptionController = null;
    transcribing = false;
    recordButton.disabled = false;
  }
}

function releaseMicrophone() {
  window.clearInterval(recordingTimer);
  window.clearTimeout(stopTimer);
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  mediaRecorder = null;
  audioChunks = [];
}

function showCaptureError(message) {
  recordButton.className = "voice-orb";
  recordLabel.textContent = metadata.configured ? "Tap to try again" : "Voice needs setup";
  timerLabel.textContent = metadata.configured ? `up to ${formatDuration(metadata.max_seconds)}` : "use typed transcript below";
  status.className = "voice-status error";
  status.textContent = message;
}

async function routeTranscript(text) {
  const transcript = text.trim();
  if (!transcript) throw new Error("Add a transcript first.");
  return voiceApi("/api/v1/voice/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }) });
}

async function routeManualTranscript() {
  routeManualButton.disabled = true;
  status.className = "voice-status";
  status.textContent = "Finding the safest home…";
  try {
    const payload = await routeTranscript(manualTranscript.value);
    showReview(payload.proposal);
  } catch (error) {
    showCaptureError(error instanceof Error ? error.message : "The transcript could not be routed.");
  } finally {
    routeManualButton.disabled = false;
  }
}

function showReview(proposal) {
  currentProposal = proposal;
  selectedDestination = proposal.destination;
  transcriptField.value = proposal.transcript;
  captureStep.hidden = true;
  reviewStep.hidden = false;
  confidence.textContent = proposal.confidence_label;
  proposalReason.textContent = proposal.reason;
  renderDestination();
  renderExtracted(proposal.fields);
  transcriptField.focus();
}

function renderDestination() {
  destinationButtons.forEach((button) => {
    const selected = button.dataset.voiceDestination === selectedDestination;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const destination = DESTINATIONS[selectedDestination];
  proposalMark.textContent = destination.mark;
  proposalTitle.textContent = `${destination.label}${currentProposal?.subtype ? ` · ${capitalize(currentProposal.subtype)}` : ""}`;
  continueButton.childNodes[0].textContent = `Continue in ${destination.label} `;
}

function renderExtracted(fields = {}) {
  extractedFields.replaceChildren();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || ["notes", "text", "title"].includes(key)) return;
    const chip = document.createElement("span");
    chip.textContent = `${fieldLabel(key)}: ${fieldValue(key, value)}`;
    extractedFields.append(chip);
  });
}

async function continueToDestination() {
  const transcript = transcriptField.value.trim();
  if (!transcript) {
    reviewStatus.className = "voice-status error";
    reviewStatus.textContent = "Keep at least one word in the transcript.";
    return;
  }
  continueButton.disabled = true;
  reviewStatus.className = "voice-status";
  reviewStatus.textContent = "Preparing an editable draft…";
  try {
    const refreshed = await routeTranscript(transcript);
    const proposal = { ...refreshed.proposal, destination: selectedDestination, transcript };
    const handlers = {
      capture: window.privateCapture?.openVoiceDraft,
      health: window.healthJournal?.openVoiceDraft,
      car: window.carMaintenance?.openVoiceDraft,
      workout: window.workoutTracker?.openVoiceDraft,
    };
    const handler = handlers[selectedDestination];
    if (typeof handler !== "function") throw new Error(`${DESTINATIONS[selectedDestination].label} is not ready yet.`);
    const result = await handler(proposal);
    if (result?.ok === false) throw new Error(result.message || "That destination needs more setup first.");
    closeVoice();
  } catch (error) {
    reviewStatus.className = "voice-status error";
    reviewStatus.textContent = error instanceof Error ? error.message : "The draft could not be prepared.";
  } finally {
    continueButton.disabled = false;
  }
}

function fieldLabel(value) {
  return value.replace(/([a-z])([A-Z])/gu, "$1 $2").replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

function fieldValue(key, value) {
  if (key === "durationSeconds" && typeof value === "number") return formatDuration(value);
  if (key === "sets" && Array.isArray(value)) return `${value.length} sets`;
  if (typeof value === "object") return Object.entries(value).map(([nestedKey, nestedValue]) => `${fieldLabel(nestedKey)} ${nestedValue}`).join(" · ");
  return String(value);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function capitalize(value) { return String(value || "").replace(/-/gu, " ").replace(/^./u, (character) => character.toUpperCase()); }

launcher.addEventListener("click", openVoice);
closeButton.addEventListener("click", closeVoice);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeVoice(); });
dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeVoice(); });
recordButton.addEventListener("click", toggleRecording);
routeManualButton.addEventListener("click", routeManualTranscript);
startOverButton.addEventListener("click", () => resetToCapture(true));
continueButton.addEventListener("click", continueToDestination);
destinationButtons.forEach((button) => button.addEventListener("click", () => { selectedDestination = button.dataset.voiceDestination; renderDestination(); }));

window.voiceCapture = { open: openVoice };
