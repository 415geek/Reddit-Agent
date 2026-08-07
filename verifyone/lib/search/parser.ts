import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";

/**
 * Universal input parser: detects whether the user typed a phone number,
 * an email, a US street address, or a person/business name, and normalizes it.
 *
 * Name search is supported but higher-risk for false matches, so the UI
 * encourages adding a city/state and every result carries its confidence.
 */

export interface ParseFailure {
  ok: false;
  reason: "empty" | "invalid_phone" | "invalid_email" | "unrecognized";
  message: string;
}

export interface ParseSuccess {
  ok: true;
  input: NormalizedSearchInput;
}

export type ParseResult = ParseSuccess | ParseFailure;

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Street suffixes that strongly signal an address. */
const STREET_SUFFIX_RE =
  /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|ter|terrace|cir|circle|hwy|highway|pkwy|parkway)\b\.?/i;

export function detectInputType(raw: string): SearchInputType | "name" | null {
  const value = raw.trim();
  if (!value) return null;

  if (EMAIL_RE.test(value)) return "email";

  const digits = value.replace(/[^\d]/g, "");
  const nonDigitChars = value.replace(/[\d\s()+.\-]/g, "");
  if (digits.length >= 7 && nonDigitChars.length === 0) return "phone";

  const startsWithNumber = /^\d+\s+\S/.test(value);
  if (startsWithNumber && (STREET_SUFFIX_RE.test(value) || /\b\d{5}(-\d{4})?\b/.test(value))) {
    return "address";
  }

  // Two-plus capitalized-ish words with no digits looks like a person name.
  if (!/\d/.test(value) && value.split(/\s+/).length >= 2) return "name";

  return null;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return EMAIL_RE.test(value) ? value : null;
}

interface ParsedAddress {
  line: string;
  city?: string;
  state?: string;
  zip?: string;
}

export function normalizeAddress(raw: string): ParsedAddress {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);

  const result: ParsedAddress = { line: cleaned };
  if (parts.length >= 2) {
    result.line = parts[0] ?? cleaned;
    const tail = parts.slice(1).join(" ");
    const zipMatch = tail.match(/\b(\d{5})(-\d{4})?\b/);
    if (zipMatch) result.zip = zipMatch[1];
    const stateMatch = tail.toUpperCase().match(/\b([A-Z]{2})\b/);
    if (stateMatch && US_STATES.has(stateMatch[1] ?? "")) result.state = stateMatch[1];
    const cityPart = parts[1]?.replace(/\b[A-Z]{2}\b/i, "").replace(/\b\d{5}(-\d{4})?\b/, "").trim();
    if (cityPart) result.city = cityPart;
  }
  return result;
}

export function parseSearchInput(raw: string): ParseResult {
  const value = raw.trim();
  if (!value) {
    return { ok: false, reason: "empty", message: "Enter a phone number, email, or US address." };
  }

  const detected = detectInputType(value);

  if (detected === "name") {
    // "Jane Doe", "Jane Doe, San Francisco, CA" — pull optional city/state hints.
    const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
    const details: Record<string, string> = {};
    const tail = parts.slice(1).join(" ");
    const stateCode = tail.toUpperCase().match(/\b([A-Z]{2})\b/)?.[1];
    if (stateCode && US_STATES.has(stateCode)) details.state = stateCode;
    const cityPart = parts[1]
      ?.replace(/\b[A-Z]{2}\b/i, "")
      .replace(/\b\d{5}(-\d{4})?\b/, "")
      .trim();
    if (cityPart) details.city = cityPart;
    const name = (parts[0] ?? value).replace(/\s+/g, " ").trim();
    return { ok: true, input: { type: "name", raw: value, normalized: name, details } };
  }

  if (detected === "phone") {
    const normalized = normalizePhone(value);
    if (!normalized) {
      return {
        ok: false,
        reason: "invalid_phone",
        message: "That looks like a phone number, but not a valid US number (10 digits expected).",
      };
    }
    return {
      ok: true,
      input: { type: "phone", raw: value, normalized, details: { country: "US" } },
    };
  }

  if (detected === "email") {
    const normalized = normalizeEmail(value);
    if (!normalized) {
      return { ok: false, reason: "invalid_email", message: "That email address doesn't look valid." };
    }
    return { ok: true, input: { type: "email", raw: value, normalized, details: {} } };
  }

  if (detected === "address") {
    const parsed = normalizeAddress(value);
    const details: Record<string, string> = {};
    if (parsed.city) details.city = parsed.city;
    if (parsed.state) details.state = parsed.state;
    if (parsed.zip) details.zip = parsed.zip;
    return {
      ok: true,
      input: { type: "address", raw: value, normalized: parsed.line, details },
    };
  }

  return {
    ok: false,
    reason: "unrecognized",
    message:
      "We couldn't recognize that input. Try a phone number (e.g. (415) 555-0100), an email, or a street address.",
  };
}
