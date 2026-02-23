/**
 * Validation utilities for assistant tool endpoints.
 * Enforces required params, safe defaults, paging limits.
 */

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const DEFAULT_DAYS_BACK = 7;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function clampLimit(limit: unknown): number {
  const n = typeof limit === "string" ? parseInt(limit, 10) : Number(limit);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export function clampOffset(offset: unknown): number {
  const n = typeof offset === "string" ? parseInt(offset, 10) : Number(offset);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function parseDateRange(
  startDate: unknown,
  endDate: unknown
): { start: string; end: string } | { error: string } {
  const end = typeof endDate === "string" && endDate ? endDate : new Date().toISOString().slice(0, 10);
  const start = typeof startDate === "string" && startDate ? startDate : defaultStartDate();
  if (!DATE_REGEX.test(start)) return { error: "start_date must be YYYY-MM-DD" };
  if (!DATE_REGEX.test(end)) return { error: "end_date must be YYYY-MM-DD" };
  if (start > end) return { error: "start_date must be <= end_date" };
  return { start, end };
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_DAYS_BACK);
  return d.toISOString().slice(0, 10);
}

export function requireParam(
  value: unknown,
  paramName: string
): { value: string } | { error: string } {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return { error: `Required query param: ${paramName}` };
  return { value: s };
}

export function parseGuidanceStatus(
  status: unknown
): "pending" | "executed" | "failed" | "rejected" {
  const s = String(status ?? "pending").toLowerCase();
  if (["pending", "executed", "failed", "rejected"].includes(s)) {
    return s as "pending" | "executed" | "failed" | "rejected";
  }
  return "pending";
}
