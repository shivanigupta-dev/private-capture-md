import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const client = await readFile(new URL("../web/voice.js", import.meta.url), "utf8");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function stream() {
  const track = { stops: 0, stop() { this.stops += 1; } };
  return { track, getTracks: () => [track] };
}

function element() {
  return {
    open: false, hidden: false, disabled: false, value: "", textContent: "", className: "",
    childNodes: [{ textContent: "" }],
    children: [] as unknown[],
    classList: { toggle() {} },
    querySelector: () => element(),
    replaceChildren(...children: unknown[]) { this.children = children; },
    append(...children: unknown[]) { this.children.push(...children); },
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
  };
}

async function harness() {
  const elements = new Map<string, ReturnType<typeof element>>();
  const microphoneRequests: ReturnType<typeof deferred<ReturnType<typeof stream>>>[] = [];
  const transcriptions: { options: RequestInit; result: ReturnType<typeof deferred<unknown>> }[] = [];
  const routes: { options: RequestInit; result: ReturnType<typeof deferred<unknown>> }[] = [];
  const handoffs: { destination: string; proposal: unknown }[] = [];
  const windowListeners = new Map<string, () => void>();
  const recorders: Recorder[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 0;

  class Recorder {
    static isTypeSupported() { return true; }
    state = "inactive";
    mimeType: string;
    listeners = new Map<string, (event?: unknown) => unknown>();
    constructor(_stream: unknown, options?: { mimeType: string }) {
      this.mimeType = options?.mimeType || "audio/webm";
      recorders.push(this);
    }
    addEventListener(name: string, listener: (event?: unknown) => unknown) { this.listeners.set(name, listener); }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; }
    emitData() { this.listeners.get("dataavailable")?.({ data: new Blob(["synthetic audio"], { type: this.mimeType }) }); }
    finish() { return this.listeners.get("stop")?.(); }
  }

  const context = vm.createContext({
    document: {
      querySelector(selector: string) {
        if (!elements.has(selector)) elements.set(selector, element());
        return elements.get(selector);
      },
      querySelectorAll: () => [],
      createElement: () => element(),
    },
    window: {
      isSecureContext: true,
      privateCapture: { openVoiceDraft(proposal: unknown) { handoffs.push({ destination: "capture", proposal }); return { ok: true }; } },
      healthJournal: { openVoiceDraft(proposal: unknown) { handoffs.push({ destination: "health", proposal }); return { ok: true }; } },
      carMaintenance: { openVoiceDraft(proposal: unknown) { handoffs.push({ destination: "car", proposal }); return { ok: true }; } },
      workoutTracker: { openVoiceDraft(proposal: unknown) { handoffs.push({ destination: "workout", proposal }); return { ok: true }; } },
      addEventListener(name: string, listener: () => void) { windowListeners.set(name, listener); },
      setInterval(callback: () => void) { timers.set(++nextTimer, callback); return nextTimer; },
      setTimeout(callback: () => void) { timers.set(++nextTimer, callback); return nextTimer; },
      clearInterval(id: number) { timers.delete(id); },
      clearTimeout(id: number) { timers.delete(id); },
    },
    navigator: { mediaDevices: { getUserMedia() {
      const request = deferred<ReturnType<typeof stream>>();
      microphoneRequests.push(request);
      return request.promise;
    } } },
    MediaRecorder: Recorder,
    AbortController,
    Blob,
    fetch(url: string, options: RequestInit) {
      if (url === "/api/v1/voice/meta") return Promise.resolve({ ok: true, json: async () => ({ configured: true, language: "en", max_seconds: 120 }) });
      if (url === "/api/v1/voice/route") {
        const result = deferred<unknown>();
        routes.push({ options, result });
        return result.promise;
      }
      assert.equal(url, "/api/v1/voice/transcribe");
      const result = deferred<unknown>();
      transcriptions.push({ options, result });
      return result.promise;
    },
  });
  vm.runInContext(client, context);
  const run = (source: string) => vm.runInContext(source, context);
  await run("loadMetadata()");
  run("openVoice()");
  const start = async () => {
    const started = run("toggleRecording()");
    const recordingStream = stream();
    microphoneRequests.at(-1)!.resolve(recordingStream);
    await started;
    return { stream: recordingStream, recorder: recorders.at(-1)! };
  };
  return { run, elements, microphoneRequests, transcriptions, routes, handoffs, recorders, windowListeners, timers, start };
}

test("closing while microphone permission is pending stops the eventual stream without recording", async () => {
  const app = await harness();
  const pendingStart = app.run("toggleRecording()");
  app.run("closeVoice()");
  const grantedStream = stream();
  app.microphoneRequests[0].resolve(grantedStream);
  await pendingStart;
  assert.equal(grantedStream.track.stops, 1);
  assert.equal(app.recorders.length, 0);
  assert.equal(app.transcriptions.length, 0);
  assert.equal(app.elements.get("#voice-dialog")!.open, false);
});

test("repeated taps cannot request multiple microphones or restart a recorder before its stop event", async () => {
  const app = await harness();
  const pendingStart = app.run("toggleRecording()");
  await app.run("toggleRecording()");
  assert.equal(app.microphoneRequests.length, 1);
  app.microphoneRequests[0].resolve(stream());
  await pendingStart;
  await app.run("toggleRecording()");
  await app.run("toggleRecording()");
  assert.equal(app.recorders.length, 1);
  assert.equal(app.microphoneRequests.length, 1);
  app.run("closeVoice()");
});

test("a cancelled recorder's delayed stop event cannot stop or upload a new recording", async () => {
  const app = await harness();
  const first = await app.start();
  app.run("closeVoice(); openVoice()");
  const second = await app.start();
  first.recorder.emitData();
  await first.recorder.finish();
  assert.equal(first.stream.track.stops, 1);
  assert.equal(second.stream.track.stops, 0);
  assert.equal(second.recorder.state, "recording");
  assert.equal(app.transcriptions.length, 0);
  app.run("closeVoice()");
});

test("leaving the page releases the microphone and discards the pending recording", async () => {
  const app = await harness();
  const active = await app.start();
  app.windowListeners.get("pagehide")!();
  active.recorder.emitData();
  await active.recorder.finish();
  assert.equal(active.stream.track.stops, 1);
  assert.equal(app.timers.size, 0);
  assert.equal(app.transcriptions.length, 0);
  assert.equal(app.elements.get("#voice-dialog")!.open, false);
});

test("a completed recording uploads once and opens an editable review", async () => {
  const app = await harness();
  const active = await app.start();
  active.recorder.stop();
  active.recorder.emitData();
  const finishing = active.recorder.finish();
  assert.equal(app.transcriptions.length, 1);
  assert.equal(active.stream.track.stops, 1);
  assert.equal(app.timers.size, 0);
  assert.equal((app.transcriptions[0].options.headers as Record<string, string>)["Content-Type"], active.recorder.mimeType);
  assert.equal(await (app.transcriptions[0].options.body as Blob).text(), "synthetic audio");
  app.transcriptions[0].result.resolve({ ok: true, json: async () => ({ proposal: { transcript: "Synthetic voice note.", destination: "capture", fields: {} } }) });
  await finishing;
  assert.equal(app.elements.get("#voice-review-step")!.hidden, false);
  assert.equal(app.elements.get("#voice-transcript")!.value, "Synthetic voice note.");
  app.run("closeVoice()");
});

test("closing aborts transcription and a late result cannot replace a new recording", async () => {
  const app = await harness();
  const first = await app.start();
  first.recorder.stop();
  first.recorder.emitData();
  const finishing = first.recorder.finish();
  assert.equal(app.transcriptions.length, 1);
  app.run("closeVoice(); openVoice()");
  assert.equal(app.transcriptions[0].options.signal!.aborted, true);
  const second = await app.start();
  app.transcriptions[0].result.resolve({ ok: true, json: async () => ({ proposal: { transcript: "stale synthetic transcript", destination: "capture", fields: {} } }) });
  await finishing;
  assert.equal(app.elements.get("#voice-review-step")!.hidden, true);
  assert.equal(app.elements.get("#voice-transcript")!.value, "");
  assert.equal(second.recorder.state, "recording");
  assert.equal(second.stream.track.stops, 0);
  app.run("closeVoice()");
});

test("manual destination changes discard unrelated fields while the suggested destination retains them", async () => {
  const proposal = {
    destination: "workout", subtype: "lift", transcript: "Synthetic squat: three sets of five at 95 pounds.",
    confidence_label: "strong match", reason: "Lift language matched your workout log.",
    fields: { title: "Back squat", exerciseId: "barbell-back-squat", weightUnit: "lb", sets: [{ reps: 5, weight: 95 }] },
  };
  for (const destination of ["health", "workout"]) {
    const app = await harness();
    app.run(`showReview(${JSON.stringify(proposal)})`);
    assert.ok(app.elements.get("#voice-extracted-fields")!.children.length > 0);
    app.run(`selectedDestination = ${JSON.stringify(destination)}; renderDestination()`);
    if (destination === "health") {
      assert.equal(app.elements.get("#voice-proposal-title")!.textContent, "Health");
      assert.equal(app.elements.get("#voice-extracted-fields")!.children.length, 0);
      assert.match(app.elements.get("#voice-proposal-reason")!.textContent, /Choose the details in the Health form/);
    } else {
      assert.equal(app.elements.get("#voice-proposal-title")!.textContent, "Workout · Lift");
      assert.ok(app.elements.get("#voice-extracted-fields")!.children.length > 0);
    }
    const continuing = app.run("continueToDestination()");
    app.routes[0].result.resolve({ ok: true, json: async () => ({ proposal }) });
    await continuing;
    assert.equal(app.handoffs.length, 1);
    assert.equal(app.handoffs[0].destination, destination);
    const handedOff = JSON.parse(JSON.stringify(app.handoffs[0].proposal));
    assert.deepEqual(handedOff, destination === "workout" ? proposal : { destination: "health", transcript: proposal.transcript, fields: {} });
  }
});
