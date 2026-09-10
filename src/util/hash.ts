/**
 * hash.js — stable JSON digest for input/output tracing (brief §16).
 */

import { createHash } from "node:crypto";

export function hashJSON(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return createHash("sha256").update(str).digest("hex");
}