import type { NormalizedProviderResult } from "@/lib/providers/types";

/**
 * Per-provider response cache so repeat searches don't re-charge API fees.
 *
 * Phase 1: in-memory with TTL (resets on deploy — fine for dev/demo).
 * Phase 2+: swap the two functions below for a Supabase/Redis-backed cache;
 * callers don't change.
 */

const TTL_BY_STATUS: Record<string, number> = {
  ok: 7 * 24 * 60 * 60 * 1000, // successful lookups: 7 days
  mock: 60 * 60 * 1000, // mock: 1 hour (keeps dev iteration fresh)
  no_match: 6 * 60 * 60 * 1000, // misses: 6 hours
};

interface CacheEntry {
  value: NormalizedProviderResult;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function cacheGet(key: string): NormalizedProviderResult | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key: string, value: NormalizedProviderResult): void {
  const ttl = TTL_BY_STATUS[value.status] ?? 0;
  if (ttl <= 0) return;
  store.set(key, { value, expiresAt: Date.now() + ttl });
}
