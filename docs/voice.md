# Local voice capture

Voice capture is an optional inbox for speaking a note instead of typing it. The recording is transcribed on the machine running Private Capture, then the app proposes Capture, Health, Car, or Workout. You can edit the transcript, change the destination, inspect the extracted fields, and continue in the normal form. Nothing is saved automatically.

```text
iPhone or Mac browser
  → private VPN + trusted HTTPS
  → Private Capture on Linux
  → local speech engine on loopback
  → editable transcript and routing proposal
  → ordinary destination form
  → explicit Save by the owner
```

## Recommended engine

Start with [`whisper.cpp`](https://github.com/ggml-org/whisper.cpp). It is free, runs locally, supports quantized English models on CPU, and includes a small HTTP server whose multipart response fits Private Capture's adapter. It is the most practical first deployment for a general-purpose Linux home server.

`small.en` is a reasonable quality-first starting model for English. Try `base.en` if transcription is too slow on your machine. Test both with the same 30–60 second synthetic recording; hardware and speaking conditions matter more than a generic benchmark.

Other credible local options remain useful:

| Engine | Best fit | Trade-off |
| --- | --- | --- |
| [`whisper.cpp`](https://github.com/ggml-org/whisper.cpp) | Recommended default; simple C/C++ deployment and built-in HTTP server | Whisper-style batch transcription is not the lowest-latency streaming design |
| [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper) | NVIDIA GPU hosts or Python/CTranslate2 deployments | More runtime machinery than the default path |
| [`Moonshine`](https://github.com/moonshine-ai/moonshine) | English-first, low-latency or future live-streaming experiments | Newer integration surface; needs a compatible local HTTP adapter |
| [Vosk](https://alphacephei.com/vosk/) | Very small offline models and streaming on modest hardware | Usually a quality trade-off for conversational notes |
| [`sherpa-onnx`](https://github.com/k2-fsa/sherpa-onnx) | Broad cross-platform streaming and non-streaming model support | Check the license for each model, not only the runtime |

The app's contract is intentionally engine-neutral, so choosing `whisper.cpp` now does not lock the project to it.

## Run `whisper.cpp`

Install `ffmpeg`, build the project on the Linux host, and download one English model. Browsers normally record WebM/Opus or M4A, while the inference example expects WAV; `--convert` lets the server perform that local conversion.

```bash
sudo apt install ffmpeg
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release -j
sh ./models/download-ggml-model.sh small.en
./build/bin/whisper-server \
  --host 127.0.0.1 \
  --port 8080 \
  --convert \
  -m models/ggml-small.en.bin
```

Keep the speech server on loopback. Do not expose port `8080` to the LAN, VPN, or internet. Run it as an unprivileged service with a restrictive sandbox: its own documentation warns that accepting uploaded files and invoking `ffmpeg` increases the importance of input validation and isolation. Private Capture limits accepted request types and bytes, but that does not replace process sandboxing.

Configure Private Capture in the same shell or in its service definition:

```bash
export PRIVATE_CAPTURE_TRANSCRIBE_URL=http://127.0.0.1:8080/inference
export PRIVATE_CAPTURE_TRANSCRIBE_LANGUAGE=en
export PRIVATE_CAPTURE_VOICE_MAX_SECONDS=120
node src/cli/main.ts serve
```

For systemd, put the same values in the unit's service section:

```ini
Environment=PRIVATE_CAPTURE_TRANSCRIBE_URL=http://127.0.0.1:8080/inference
Environment=PRIVATE_CAPTURE_TRANSCRIBE_LANGUAGE=en
Environment=PRIVATE_CAPTURE_VOICE_MAX_SECONDS=120
```

Restart both services after changing the configuration. Open the voice sheet and check that it says **Local transcription ready** before recording.

## Endpoint contract

Private Capture accepts only an `http://` or `https://` URL whose hostname is loopback (`127.0.0.1`, `::1`, or `localhost`), rejects credentials and query strings in that URL, and refuses redirects. It sends a multipart request containing:

- `file`: the completed browser recording;
- `language`: `en` by default;
- `response_format`: `json`;
- `temperature`: `0.0`.

The engine or adapter must return JSON with a non-empty `text` or `transcription` string. This small contract is enough to place another local engine behind the same interface without changing the browser.

## Mobile requirements

Your Mac is not in the path. The iPhone connects through the VPN to the HTTPS reverse proxy on the Linux host; Linux serves the app, transcribes the clip, and writes the approved Markdown folder.

OpenVPN protects reachability, but the browser still requires a trusted HTTPS origin for microphone access. Install or trust the reverse proxy's certificate authority on each client, or use a publicly trusted certificate with private DNS. Plain `http://10.8.0.1` is not enough.

## Privacy and failure behavior

- The browser asks for microphone access only after you press Record.
- Private Capture does not persist the audio clip or put it in the approved root.
- The local engine may create temporary files while decoding audio; check its configuration and logs.
- A failed or unavailable engine leaves typed/pasted transcript entry available.
- Routing is deterministic and local. Low-confidence suggestions are shown as such.
- The transcript and extracted fields remain editable.
- No capture, health entry, vehicle record, or workout is written until you press that form's Save button.

Treat recordings and transcripts as private data when filing bugs. Use synthetic examples only.
