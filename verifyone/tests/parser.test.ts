import { describe, expect, it } from "vitest";
import {
  detectInputType,
  normalizeAddress,
  normalizeEmail,
  normalizePhone,
  parseSearchInput,
} from "@/lib/search/parser";

describe("detectInputType", () => {
  it("detects phone numbers in common formats", () => {
    expect(detectInputType("(415) 555-0134")).toBe("phone");
    expect(detectInputType("415-555-0134")).toBe("phone");
    expect(detectInputType("+1 415 555 0134")).toBe("phone");
    expect(detectInputType("4155550134")).toBe("phone");
  });

  it("detects emails", () => {
    expect(detectInputType("a.b@example.com")).toBe("email");
    expect(detectInputType("USER@DOMAIN.CO")).toBe("email");
  });

  it("detects US street addresses", () => {
    expect(detectInputType("548 Market St, San Francisco, CA 94104")).toBe("address");
    expect(detectInputType("123 Main Street")).toBe("address");
    expect(detectInputType("1 Hacker Way, Menlo Park, CA 94025")).toBe("address");
  });

  it("flags person names as unsupported", () => {
    expect(detectInputType("John Smith")).toBe("name");
  });

  it("returns null for empty and garbage input", () => {
    expect(detectInputType("")).toBeNull();
    expect(detectInputType("x")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("normalizes 10-digit US numbers to E.164", () => {
    expect(normalizePhone("(415) 555-0134")).toBe("+14155550134");
    expect(normalizePhone("1-415-555-0134")).toBe("+14155550134");
  });

  it("rejects invalid lengths", () => {
    expect(normalizePhone("555-0134")).toBeNull();
    expect(normalizePhone("123456789012")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("rejects invalid emails", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});

describe("normalizeAddress", () => {
  it("extracts city, state, and zip", () => {
    const parsed = normalizeAddress("548 Market St, San Francisco, CA 94104");
    expect(parsed.line).toBe("548 Market St");
    expect(parsed.city).toBe("San Francisco");
    expect(parsed.state).toBe("CA");
    expect(parsed.zip).toBe("94104");
  });
});

describe("parseSearchInput", () => {
  it("rejects name searches with a helpful message", () => {
    const result = parseSearchInput("Jane Doe");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsupported_name_search");
  });

  it("normalizes a phone search", () => {
    const result = parseSearchInput("(415) 555-0134");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.type).toBe("phone");
      expect(result.input.normalized).toBe("+14155550134");
    }
  });

  it("rejects phone-looking input with wrong digit count", () => {
    const result = parseSearchInput("415-555-01");
    expect(result.ok).toBe(false);
  });
});
