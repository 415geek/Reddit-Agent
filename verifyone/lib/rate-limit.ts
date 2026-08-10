/**
 * Minimal fixed-window rate limiter, keyed by IP.
 * Phase 1: in-memory per instance. Phase 5: replace with Upstash/Redis or
 * Vercel Firewall rules for multi-instance correctness.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SEARCHES_PER_WINDOW = 20;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const win = windows.get(key);
  if (!win || now > win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_SEARCHES_PER_WINDOW - 1 };
  }
  if (win.count >= MAX_SEARCHES_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  win.count += 1;
  return { allowed: true, remaining: MAX_SEARCHES_PER_WINDOW - win.count };
}
