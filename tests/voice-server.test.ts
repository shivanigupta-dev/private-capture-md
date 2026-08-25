import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initialiseRoot, loadConfiguration } from "../src/core/config.ts";
import { startServer } from "../src/server/server.ts";

test("the voice endpoint forwards audio only to its configured local engine", async (t) => {
  let forwardedType = "";
  let forwardedBody = "";
  const speechServer = createHttpServer((request, response) => {
    forwardedType = String(request.headers["content-type"] || "");
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      forwardedBody = Buffer.concat(chunks).toString("utf8");
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ text: "I ran 3.1 miles in 30 minutes." }));
    });
  });
  await new Promise<void>((resolve) => speechServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => speechServer.close(() => resolve())));
  const speechPort = (speechServer.address() as AddressInfo).port;

  const temporary = await mkdtemp(path.join(os.tmpdir(), "private-capture-voice-server-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const vault = path.join(temporary, "Synthetic Vault");
  const configPath = path.join(temporary, "config.json");
  await mkdir(vault);
  await initialiseRoot({ vaultPath: vault, configPath, accessMode: "local" });
  const loaded = await loadConfiguration(configPath);
  const { server } = await startServer(loaded, {
    host: "127.0.0.1",
    port: 0,
    voiceSettings: { url: `http://127.0.0.1:${speechPort}/inference`, language: "en", maxSeconds: 60 },
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;

  const metadata = await fetch(`${origin}/api/v1/voice/meta`);
  assert.deepEqual(await metadata.json(), { configured: true, language: "en", max_seconds: 60, local_only: true, saves_automatically: false });

  const transcription = await fetch(`${origin}/api/v1/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "audio/webm;codecs=opus", Origin: origin },
    body: new TextEncoder().encode("synthetic webm bytes"),
  });
  assert.equal(transcription.status, 200);
  const result = await transcription.json();
  assert.equal(result.transcript, "I ran 3.1 miles in 30 minutes.");
  assert.equal(result.proposal.destination, "workout");
  assert.equal(result.proposal.subtype, "run");
  assert.match(forwardedType, /^multipart\/form-data; boundary=/);
  assert.match(forwardedBody, /name="language"\r\n\r\nen/);
  assert.match(forwardedBody, /name="file"; filename="private-capture-voice\.webm"/);
  assert.match(forwardedBody, /synthetic webm bytes/);
});
