import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type { DataProvider, NormalizedProviderResult } from "@/lib/providers/types";

/**
 * MOCK provider — stands in for OpenSanctions screening.
 * Mock always returns "no match": fabricating risk hits, even fake ones,
 * would train the UI (and users) on alarming data.
 */
export const mockOpenSanctions: DataProvider = {
  name: "OpenSanctions (mock)",
  costCredits: 1,

  supports(inputType: SearchInputType): boolean {
    return inputType === "phone" || inputType === "email" || inputType === "address";
  },

  async search(_input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    return {
      provider: this.name,
      status: "mock",
      lastUpdated: "2026-08-05",
      risks: [],
    };
  },
};
