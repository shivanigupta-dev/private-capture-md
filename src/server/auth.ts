import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { AppConfiguration } from "../core/config.ts";

const COOKIE_NAME = "pc_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_SESSIONS = 1_024;

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function cookieValue(request: IncomingMessage, name: string) {
  const header = request.headers.cookie || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export class SessionAuth {
  #configuration: AppConfiguration;
  #sessions = new Map<string, number>();

  constructor(configuration: AppConfiguration) {
    this.#configuration = configuration;
  }

  get required() {
    return this.#configuration.access_mode === "token";
  }

  authenticated(request: IncomingMessage) {
    if (!this.required) return true;
    const token = cookieValue(request, COOKIE_NAME);
    if (!token) return false;
    const expiresAt = this.#sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      this.#sessions.delete(token);
      return false;
    }
    return true;
  }

  login(token: unknown) {
    if (!this.required || typeof token !== "string" || !this.#configuration.token_sha256) return null;
    const actual = hash(token);
    const expected = Buffer.from(this.#configuration.token_sha256, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = randomBytes(32).toString("base64url");
    for (const [key, expiresAt] of this.#sessions) if (expiresAt <= Date.now()) this.#sessions.delete(key);
    while (this.#sessions.size >= MAX_SESSIONS) this.#sessions.delete(this.#sessions.keys().next().value as string);
    this.#sessions.set(session, Date.now() + SESSION_TTL_MS);
    return session;
  }

  cookie(session: string, secure: boolean) {
    return `${COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? "; Secure" : ""}`;
  }
}
