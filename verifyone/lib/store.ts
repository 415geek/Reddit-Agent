import type { SearchReport } from "@/lib/types";

/**
 * Report store.
 *
 * Phase 1 (demo mode, no Supabase keys): in-memory, capped, per-instance.
 * Phase 2+: persist to Supabase `searches` / `entities` tables with RLS so
 * users only ever see their own reports (see supabase/migrations/0001_init.sql).
 */

const MAX_REPORTS = 200;

const reports = new Map<string, SearchReport>();

export function saveReport(report: SearchReport): void {
  if (reports.size >= MAX_REPORTS) {
    const oldest = reports.keys().next().value;
    if (oldest) reports.delete(oldest);
  }
  reports.set(report.id, report);
}

export function getReport(id: string): SearchReport | null {
  return reports.get(id) ?? null;
}

export function listReports(): SearchReport[] {
  return [...reports.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
