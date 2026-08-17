import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LoadedConfiguration } from "../core/config.ts";
import { loadApprovedRoot, verifyApprovedRoot } from "../core/safe-files.ts";
import { CaptureStore, RecordConflictError } from "../core/store.ts";
import { HealthConflictError, HealthStore } from "../core/health-store.ts";
import type { HealthEventInput } from "../core/health.ts";
import type { CaptureInput, ReviewClassification } from "../core/records.ts";
import { SessionAuth } from "./auth.ts";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(moduleDirectory, "../../web");

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/health.js": { file: "health.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/health.css": { file: "health.css", type: "text/css; charset=utf-8" },
  "/manifest.webmanifest": { file: "manifest.webmanifest", type: "application/manifest+json; charset=utf-8" },
  "/service-worker.js": { file: "service-worker.js", type: "text/javascript; charset=utf-8" },
  "/icon-192.png": { file: "icon-192.png", type: "image/png" },
  "/icon-512.png": { file: "icon-512.png", type: "image/png" },
};

const rateWindows = new Map<string, { startedAt: number; count: number }>();

function securityHeaders(isApi = false) {
  return {
    "Cache-Control": isApi ? "no-store" : "no-cache",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
}

function sendJson(response: ServerResponse, status: number, payload: unknown, extraHeaders: Record<string, string> = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...securityHeaders(true), ...extraHeaders });
  response.end(JSON.stringify(payload));
}

function remoteKey(request: IncomingMessage) {
  return request.socket.remoteAddress || "unknown";
}

function withinRateLimit(request: IncomingMessage) {
  const key = remoteKey(request);
  const now = Date.now();
  if (rateWindows.size > 1_000) {
    for (const [candidate, window] of rateWindows) if (now - window.startedAt >= 60_000) rateWindows.delete(candidate);
  }
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 120;
}

function publicProtocol(request: IncomingMessage, tokenMode: boolean) {
  const forwarded = tokenMode ? request.headers["x-forwarded-proto"] : undefined;
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded || "http").split(",")[0].trim();
}

function validLocalHost(request: IncomingMessage) {
  const raw = request.headers.host || "";
  try {
    const hostname = new URL(`http://${raw}`).hostname;
    return ["127.0.0.1", "localhost", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function sameOrigin(request: IncomingMessage, tokenMode: boolean) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  if (!host) return false;
  return origin === `${publicProtocol(request, tokenMode)}://${host}`;
}

async function readJson(request: IncomingMessage) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw Object.assign(new Error("Use Content-Type: application/json."), { statusCode: 415 });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 512_000) throw Object.assign(new Error("The request is too large."), { statusCode: 413 });
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw Object.assign(new Error("The request body is not valid JSON."), { statusCode: 400 });
  }
}

export async function startServer(loaded: LoadedConfiguration, options: { host: string; port: number }) {
  const root = await loadApprovedRoot(loaded.value);
  const store = new CaptureStore(root);
  const healthStore = new HealthStore(root);
  const auth = new SessionAuth(loaded.value);
  let latestWriteAt: string | null = null;

  const server = createServer((request, response) => {
    const route = async () => {
      if (!withinRateLimit(request)) return sendJson(response, 429, { error: { code: "rate_limited", message: "Too many requests. Try again in a minute." } });
      if (loaded.value.access_mode === "local" && !validLocalHost(request)) return sendJson(response, 421, { error: { code: "invalid_host", message: "Local mode only accepts localhost requests." } });
      const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

      if (request.method === "POST" && url.pathname === "/api/v1/session") {
        if (!sameOrigin(request, auth.required)) return sendJson(response, 403, { error: { code: "origin_rejected", message: "The request origin was rejected." } });
        const payload = await readJson(request) as { token?: unknown };
        const session = auth.login(payload.token);
        if (!session) return sendJson(response, 401, { error: { code: "invalid_token", message: "That access token was not accepted." } });
        const secure = publicProtocol(request, true) === "https";
        return sendJson(response, 200, { ok: true }, { "Set-Cookie": auth.cookie(session, secure) });
      }

      if (url.pathname.startsWith("/api/")) {
        if (!auth.authenticated(request)) return sendJson(response, 401, { error: { code: "authentication_required", message: "Unlock Private Capture to continue." } });
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method || "") && !sameOrigin(request, auth.required)) return sendJson(response, 403, { error: { code: "origin_rejected", message: "The request origin was rejected." } });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/health") {
        await verifyApprovedRoot(root);
        return sendJson(response, 200, {
          ok: true,
          marker_valid: true,
          root_label: root.marker.label,
          access_mode: loaded.value.access_mode,
          latest_successful_write_at: latestWriteAt,
        });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/captures") {
        const captures = await store.list();
        return sendJson(response, 200, { captures });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/health-journal/meta") {
        return sendJson(response, 200, { categories: await healthStore.categories() });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/health-events") {
        return sendJson(response, 200, { events: await healthStore.list() });
      }

      if (request.method === "POST" && url.pathname === "/api/v1/health-events") {
        const idempotencyKey = request.headers["idempotency-key"];
        if (Array.isArray(idempotencyKey) || !idempotencyKey) throw Object.assign(new Error("Send one Idempotency-Key header."), { statusCode: 400 });
        const payload = await readJson(request) as HealthEventInput;
        const result = await healthStore.save(payload, idempotencyKey);
        latestWriteAt = result.receipt.durable_at;
        return sendJson(response, result.created ? 201 : 200, { event: result.record, receipt: result.receipt, replayed: !result.created });
      }

      const healthRevisionMatch = url.pathname.match(/^\/api\/v1\/health-events\/(health_[0-9a-f-]{36})\/revisions$/i);
      if (request.method === "POST" && healthRevisionMatch) {
        const idempotencyKey = request.headers["idempotency-key"];
        if (Array.isArray(idempotencyKey) || !idempotencyKey) throw Object.assign(new Error("Send one Idempotency-Key header."), { statusCode: 400 });
        const payload = await readJson(request) as HealthEventInput & { currentHash?: unknown };
        if (typeof payload.currentHash !== "string") throw Object.assign(new Error("Send the current health entry fingerprint."), { statusCode: 400 });
        const result = await healthStore.revise(healthRevisionMatch[1], payload, payload.currentHash, idempotencyKey);
        latestWriteAt = result.receipt.durable_at;
        return sendJson(response, result.created ? 201 : 200, { event: result.record, receipt: result.receipt, replayed: !result.created });
      }

      if (request.method === "POST" && url.pathname === "/api/v1/captures") {
        const idempotencyKey = request.headers["idempotency-key"];
        if (Array.isArray(idempotencyKey) || !idempotencyKey) throw Object.assign(new Error("Send one Idempotency-Key header."), { statusCode: 400 });
        const payload = await readJson(request) as CaptureInput;
        const result = await store.save(payload, idempotencyKey);
        latestWriteAt = result.receipt.durable_at;
        return sendJson(response, result.created ? 201 : 200, { capture: { id: result.record.id, title: result.record.title, created_at: result.record.created_at, state: result.record.state }, receipt: result.receipt, replayed: !result.created });
      }

      if (request.method === "POST" && url.pathname === "/api/v1/reviews") {
        const payload = await readJson(request) as { captureId: string; captureHash: string; classification: ReviewClassification };
        const result = await store.proposeReview(payload);
        latestWriteAt = result.receipt.durable_at;
        return sendJson(response, 201, { review: result.review, receipt: result.receipt });
      }

      const asset = STATIC_FILES[url.pathname];
      if (request.method === "GET" && asset) {
        const content = await readFile(path.join(webDirectory, asset.file));
        response.writeHead(200, { "Content-Type": asset.type, ...securityHeaders(false) });
        return response.end(content);
      }
      return sendJson(response, 404, { error: { code: "not_found", message: "Not found." } });
    };

    route().catch((error: unknown) => {
      const status = error instanceof RecordConflictError || error instanceof HealthConflictError ? 409 : typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 400;
      const message = error instanceof Error ? error.message : "The request could not be completed.";
      sendJson(response, Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500, { error: { code: error instanceof RecordConflictError || error instanceof HealthConflictError ? "record_conflict" : "request_failed", message } });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve());
  });
  return { server, root };
}
