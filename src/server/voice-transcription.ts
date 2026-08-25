const DEFAULT_MAX_SECONDS = 120;
export const MAX_VOICE_BYTES = 15 * 1024 * 1024;

export type VoiceTranscriptionSettings = {
  url: string;
  language: string;
  maxSeconds: number;
};

const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
};

function loopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
}

export function voiceSettingsFromEnvironment(environment: Record<string, string | undefined> = process.env) {
  const rawUrl = environment.PRIVATE_CAPTURE_TRANSCRIBE_URL?.trim();
  if (!rawUrl) return null;
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("PRIVATE_CAPTURE_TRANSCRIBE_URL must be a valid URL."); }
  if (!loopbackHostname(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("The transcription service URL must be an HTTP(S) loopback URL without credentials, query parameters, or fragments.");
  const language = environment.PRIVATE_CAPTURE_TRANSCRIBE_LANGUAGE?.trim().toLowerCase() || "en";
  if (language !== "auto" && !/^[a-z]{2,3}$/u.test(language)) throw new Error("PRIVATE_CAPTURE_TRANSCRIBE_LANGUAGE must be auto or a two- to three-letter language code.");
  const parsedSeconds = Number(environment.PRIVATE_CAPTURE_VOICE_MAX_SECONDS || DEFAULT_MAX_SECONDS);
  if (!Number.isInteger(parsedSeconds) || parsedSeconds < 15 || parsedSeconds > 300) throw new Error("PRIVATE_CAPTURE_VOICE_MAX_SECONDS must be an integer from 15 to 300.");
  return { url: url.toString(), language, maxSeconds: parsedSeconds } satisfies VoiceTranscriptionSettings;
}

export function acceptedAudioType(raw: string) {
  const type = raw.split(";")[0].trim().toLowerCase();
  return AUDIO_TYPES[type] ? { type, extension: AUDIO_TYPES[type] } : null;
}

export async function transcribeVoiceAudio(audio: Uint8Array, rawType: string, settings: VoiceTranscriptionSettings, fetcher: typeof fetch = fetch) {
  if (!audio.byteLength) throw Object.assign(new Error("The recording was empty."), { statusCode: 400 });
  if (audio.byteLength > MAX_VOICE_BYTES) throw Object.assign(new Error("The recording is too large."), { statusCode: 413 });
  const accepted = acceptedAudioType(rawType);
  if (!accepted) throw Object.assign(new Error("Use a WebM, Ogg, M4A, WAV, or MP3 audio recording."), { statusCode: 415 });
  const body = new FormData();
  body.set("file", new Blob([audio], { type: accepted.type }), `private-capture-voice.${accepted.extension}`);
  body.set("response_format", "json");
  body.set("temperature", "0.0");
  if (settings.language !== "auto") body.set("language", settings.language);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  let response: Response;
  try {
    response = await fetcher(settings.url, { method: "POST", body, signal: controller.signal, redirect: "error" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw Object.assign(new Error("Local transcription timed out."), { statusCode: 504 });
    throw Object.assign(new Error("The local transcription service could not be reached."), { statusCode: 503 });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw Object.assign(new Error("The local transcription service rejected the recording."), { statusCode: 502 });
  let payload: unknown;
  try { payload = await response.json(); } catch { throw Object.assign(new Error("The local transcription service returned invalid JSON."), { statusCode: 502 }); }
  const candidate = payload && typeof payload === "object" ? (payload as { text?: unknown; transcription?: unknown }).text ?? (payload as { transcription?: unknown }).transcription : undefined;
  const transcript = typeof candidate === "string" ? candidate.trim() : "";
  if (!transcript) throw Object.assign(new Error("No speech was found in the recording."), { statusCode: 422 });
  if (transcript.length > 20_000) throw Object.assign(new Error("The transcript is too long."), { statusCode: 413 });
  return transcript;
}
