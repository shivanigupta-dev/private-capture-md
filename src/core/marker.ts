import { createHash, randomUUID } from "node:crypto";

export const MARKER_FILE = ".private-capture-root.json";
export const MARKER_KIND = "private-capture-root";
export const MARKER_VERSION = 2;
export const APPLICATION_ID = "private-capture";
export const OWNERSHIP_BOUNDARY = "Everything outside this root is non-application-owned and must not be modified by Private Capture.";

export type CapabilityOperation = "read" | "create";

export type RootCapability = {
  path: "Inbox/Captures" | "Inbox/_review";
  operations: CapabilityOperation[];
};

export type ApprovalMarker = {
  kind: typeof MARKER_KIND;
  approved: true;
  root_id: string;
  schema_version: typeof MARKER_VERSION;
  created_at: string;
  purpose: string;
  authorized_application: typeof APPLICATION_ID;
  capabilities: RootCapability[];
  ownership_boundary: typeof OWNERSHIP_BOUNDARY;
  root_name: string;
  label: string;
};

const EXPECTED_CAPABILITIES: RootCapability[] = [
  { path: "Inbox/Captures", operations: ["read", "create"] },
  { path: "Inbox/_review", operations: ["read", "create"] },
];

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function capabilitiesAreExact(value: unknown): value is RootCapability[] {
  if (!Array.isArray(value) || value.length !== EXPECTED_CAPABILITIES.length) return false;
  return EXPECTED_CAPABILITIES.every((expected) => {
    const actual = value.find((item) => item && typeof item === "object" && "path" in item && item.path === expected.path) as Partial<RootCapability> | undefined;
    return actual !== undefined
      && Array.isArray(actual.operations)
      && actual.operations.length === expected.operations.length
      && expected.operations.every((operation) => actual.operations?.includes(operation));
  });
}

export function parseApprovalMarker(value: unknown): ApprovalMarker {
  if (!value || typeof value !== "object") throw new Error("The approval marker is not an object.");
  const marker = value as Partial<ApprovalMarker>;
  if (marker.kind !== MARKER_KIND || marker.approved !== true) throw new Error("This folder is not approved for Private Capture.");
  if (marker.schema_version !== MARKER_VERSION) throw new Error("The approval marker uses an unsupported schema version.");
  if (typeof marker.root_id !== "string" || !/^pcr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(marker.root_id)) throw new Error("The approval marker has an invalid root identity.");
  if (!isIsoTimestamp(marker.created_at)) throw new Error("The approval marker has an invalid creation timestamp.");
  if (typeof marker.purpose !== "string" || !marker.purpose.trim()) throw new Error("The approval marker has no purpose.");
  if (marker.authorized_application !== APPLICATION_ID) throw new Error("Private Capture is not authorized for this root.");
  if (!capabilitiesAreExact(marker.capabilities)) throw new Error("The approval marker grants unexpected or incomplete capabilities.");
  if (marker.ownership_boundary !== OWNERSHIP_BOUNDARY) throw new Error("The approval marker has an inconsistent ownership boundary.");
  if (typeof marker.root_name !== "string" || !marker.root_name.trim() || marker.root_name.toLowerCase() === ".obsidian") throw new Error("The approval marker has an invalid root name.");
  if (typeof marker.label !== "string" || !marker.label.trim()) throw new Error("The approval marker has no display label.");
  return marker as ApprovalMarker;
}

export function createApprovalMarker(rootName: string, now = new Date()): ApprovalMarker {
  return {
    kind: MARKER_KIND,
    approved: true,
    root_id: `pcr_${randomUUID()}`,
    schema_version: MARKER_VERSION,
    created_at: now.toISOString(),
    purpose: "Bounded, append-only Markdown capture, health journaling, and separate review proposals.",
    authorized_application: APPLICATION_ID,
    capabilities: EXPECTED_CAPABILITIES.map((capability) => ({ ...capability, operations: [...capability.operations] })),
    ownership_boundary: OWNERSHIP_BOUNDARY,
    root_name: rootName,
    label: rootName,
  };
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function markerText(marker: ApprovalMarker) {
  return `${JSON.stringify(marker, null, 2)}\n`;
}
