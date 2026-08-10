import { describe, expect, it } from "vitest";
import { resolveEntities } from "@/lib/search/entity-resolution";
import type { NormalizedProviderResult } from "@/lib/providers/types";

function result(overrides: Partial<NormalizedProviderResult>): NormalizedProviderResult {
  return { provider: "Test Provider", status: "ok", ...overrides };
}

describe("resolveEntities", () => {
  it("merges identical values from multiple providers into one high-confidence field", () => {
    const profile = resolveEntities([
      result({ provider: "A", person: { name: "Jordan Chen", phones: ["+14155550134"] } }),
      result({ provider: "B", person: { name: "Jordan Chen", phones: ["(415) 555-0134"] } }),
    ]);

    expect(profile.name?.value).toBe("Jordan Chen");
    expect(profile.name?.confidence).toBe("high");
    expect(profile.name?.sources).toHaveLength(2);
    // Phone formats differ but normalize to the same number → one merged entry.
    expect(profile.phones).toHaveLength(1);
    expect(profile.phones[0]?.sources).toHaveLength(2);
  });

  it("flags conflicting single-valued fields instead of silently merging", () => {
    const profile = resolveEntities([
      result({ provider: "A", person: { name: "Jordan Chen" } }),
      result({ provider: "B", person: { name: "Jordan Chan" } }),
    ]);

    expect(profile.name?.confidence).toBe("conflicting");
    expect(profile.name?.conflicts).toContain("Jordan Chan");
    expect(profile.overallConfidence).toBe("conflicting");
  });

  it("ignores errored and skipped providers", () => {
    const profile = resolveEntities([
      result({ provider: "A", status: "error", error: "timeout" }),
      result({ provider: "B", status: "skipped" }),
      result({ provider: "C", person: { name: "Jordan Chen" } }),
    ]);

    expect(profile.name?.sources).toHaveLength(1);
  });

  it("caps confidence at medium for mock-only data", () => {
    const profile = resolveEntities([
      result({ provider: "Trestle (mock)", status: "mock", person: { name: "Jordan Chen" } }),
    ]);

    expect(profile.name?.confidence).toBe("low");
  });

  it("collects businesses from open-data providers", () => {
    const profile = resolveEntities([
      result({
        provider: "DataSF",
        businesses: [
          { name: "Golden Gate Retail Group LLC", registrationId: "1234567", status: "Registered" },
        ],
      }),
    ]);

    expect(profile.businesses).toHaveLength(1);
    expect(profile.businesses[0]?.name.value).toBe("Golden Gate Retail Group LLC");
  });

  it("rephrases risk signals as potential matches, never accusations", () => {
    const profile = resolveEntities([
      result({ provider: "OpenSanctions", risks: [{ kind: "sanctions", summary: "OFAC SDN list" }] }),
    ]);

    expect(profile.riskSignals[0]?.summary).toMatch(/Potential public-record match/);
  });
});
