import assert from "node:assert/strict";
import test from "node:test";
import { routeVoiceTranscript } from "../src/core/voice.ts";
import { transcribeVoiceAudio, voiceSettingsFromEnvironment } from "../src/server/voice-transcription.ts";

test("voice routing proposes editable specialist drafts without saving anything", () => {
  const car = routeVoiceTranscript("I got an oil change today at 66,200 miles and paid $84.");
  assert.equal(car.destination, "car");
  assert.equal(car.fields.category, "oil-filter");
  assert.equal(car.fields.odometer, 66_200);
  assert.equal(car.fields.cost, 84);

  const lift = routeVoiceTranscript("Squats, three sets of five at 105 pounds.");
  assert.equal(lift.destination, "workout");
  assert.equal(lift.subtype, "lift");
  assert.equal(lift.fields.exerciseId, "barbell-back-squat");
  assert.equal((lift.fields.sets as unknown[]).length, 3);

  const run = routeVoiceTranscript("I ran 3.2 miles in 31 minutes, easy effort.");
  assert.equal(run.destination, "workout");
  assert.equal(run.subtype, "run");
  assert.equal(run.fields.distance, 3.2);
  assert.equal(run.fields.durationSeconds, 1_860);

  const climb = routeVoiceTranscript("Climbed a V5 in three attempts at the gym.");
  assert.equal(climb.destination, "workout");
  assert.equal(climb.subtype, "climb");
  assert.equal(climb.fields.grade, "V5");
  assert.equal(climb.fields.attempts, 3);

  const health = routeVoiceTranscript("My headache was a seven today and sleep made it worse.");
  assert.equal(health.destination, "health");
  assert.equal(health.fields.category, "symptoms");
  assert.deepEqual(health.fields.details, { severity: "7/10" });

  const capture = routeVoiceTranscript("Remember to look into the library opening hours.");
  assert.equal(capture.destination, "capture");
  assert.equal(capture.subtype, "task");
});

test("local transcription configuration is loopback-only and provider-neutral", async () => {
  assert.equal(voiceSettingsFromEnvironment({}), null);
  assert.throws(() => voiceSettingsFromEnvironment({ PRIVATE_CAPTURE_TRANSCRIBE_URL: "https://speech.example.com/inference" }), /loopback/i);
  const settings = voiceSettingsFromEnvironment({
    PRIVATE_CAPTURE_TRANSCRIBE_URL: "http://127.0.0.1:8080/inference",
    PRIVATE_CAPTURE_TRANSCRIBE_LANGUAGE: "en",
    PRIVATE_CAPTURE_VOICE_MAX_SECONDS: "90",
  });
  assert.deepEqual(settings, { url: "http://127.0.0.1:8080/inference", language: "en", maxSeconds: 90 });
  assert.ok(settings);

  let requestBody: FormData | null = null;
  const transcript = await transcribeVoiceAudio(new TextEncoder().encode("synthetic audio"), "audio/webm;codecs=opus", settings, async (url, init) => {
    assert.equal(url, settings.url);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    requestBody = init?.body as FormData;
    return new Response(JSON.stringify({ text: "  Synthetic private transcript.  " }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.equal(transcript, "Synthetic private transcript.");
  assert.equal(requestBody?.get("language"), "en");
  assert.equal(requestBody?.get("response_format"), "json");
  assert.ok(voiceSettingsFromEnvironment({ PRIVATE_CAPTURE_TRANSCRIBE_URL: "http://[::1]:8080/inference" }));
  await assert.rejects(() => transcribeVoiceAudio(new Uint8Array([1]), "application/octet-stream", settings, fetch), /WebM, Ogg, M4A, WAV, or MP3/i);
});
