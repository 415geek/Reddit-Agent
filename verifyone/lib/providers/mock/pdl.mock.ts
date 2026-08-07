import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type { DataProvider, NormalizedProviderResult } from "@/lib/providers/types";

/** MOCK provider — stands in for People Data Labs person enrichment. */
export const mockPeopleDataLabs: DataProvider = {
  name: "People Data Labs (mock)",
  costCredits: 3,

  supports(inputType: SearchInputType): boolean {
    return inputType === "phone" || inputType === "email" || inputType === "name";
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    return {
      provider: this.name,
      status: "mock",
      lastUpdated: "2026-06-15",
      person: {
        employers: ["Acme Analytics", "Golden Gate Retail Group"],
        jobTitles: ["Operations Manager"],
        education: ["San Francisco State University — B.S. Business Administration"],
        location: "San Francisco, CA",
        emails: input.type === "email" ? [input.normalized] : [],
      },
    };
  },
};
