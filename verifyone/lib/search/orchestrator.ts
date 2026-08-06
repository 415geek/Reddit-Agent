import { randomUUID } from "crypto";
import type {
  NormalizedSearchInput,
  ProviderRunSummary,
  SearchReport,
} from "@/lib/types";
import type { NormalizedProviderResult } from "@/lib/providers/types";
import { providersFor } from "@/lib/providers/registry";
import { resolveEntities } from "@/lib/search/entity-resolution";
import { cacheGet, cacheSet } from "@/lib/search/cache";

/**
 * Query orchestrator: given a normalized input, fans out to every provider
 * that supports the input type, in parallel, with per-provider timeouts.
 * A failed provider never fails the whole search — its error is recorded
 * and the report is built from whatever succeeded. Failed providers charge
 * zero credits.
 */

const PROVIDER_TIMEOUT_MS = 10_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Provider timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runSearch(input: NormalizedSearchInput): Promise<SearchReport> {
  const providers = providersFor(input.type);

  const runs: ProviderRunSummary[] = [];
  const results: NormalizedProviderResult[] = [];

  await Promise.all(
    providers.map(async (provider) => {
      const started = Date.now();
      const cacheKey = `${provider.name}:${input.type}:${input.normalized}`;
      const cached = cacheGet(cacheKey);

      if (cached) {
        results.push(cached);
        runs.push({
          provider: provider.name,
          status: cached.status,
          costCredits: 0,
          durationMs: Date.now() - started,
          cacheHit: true,
        });
        return;
      }

      try {
        const result = await withTimeout(provider.search(input), PROVIDER_TIMEOUT_MS);
        results.push(result);
        if (result.status === "ok" || result.status === "mock" || result.status === "no_match") {
          cacheSet(cacheKey, result);
        }
        runs.push({
          provider: provider.name,
          status: result.status,
          // Users are only charged for calls that succeeded.
          costCredits: result.status === "error" ? 0 : provider.costCredits,
          durationMs: Date.now() - started,
          cacheHit: false,
          ...(result.error ? { error: result.error } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown provider error";
        results.push({ provider: provider.name, status: "error", error: message });
        runs.push({
          provider: provider.name,
          status: "error",
          costCredits: 0,
          durationMs: Date.now() - started,
          cacheHit: false,
          error: message,
        });
      }
    })
  );

  const profile = resolveEntities(results);

  return {
    id: randomUUID(),
    input,
    profile,
    providerRuns: runs.sort((a, b) => a.provider.localeCompare(b.provider)),
    totalCredits: runs.reduce((sum, r) => sum + r.costCredits, 0),
    createdAt: new Date().toISOString(),
    containsMockData: results.some((r) => r.status === "mock"),
  };
}
