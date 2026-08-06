import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type { DataProvider, NormalizedProviderResult } from "@/lib/providers/types";

/**
 * MOCK provider — California Secretary of State business registrations.
 *
 * The CA SOS "bizfile Online" search has no official public API. Live
 * options (Phase 3+): a licensed data vendor (e.g. Middesk, Cobalt
 * Intelligence) or the SOS bulk-data subscription. Until then this adapter
 * returns clearly-labelled mock records so the Business Connections card
 * and entity-resolution path are fully exercised.
 */
export const mockCaSos: DataProvider = {
  name: "CA Secretary of State (mock)",
  costCredits: 1,

  supports(inputType: SearchInputType): boolean {
    return inputType === "address" || inputType === "phone" || inputType === "email";
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    const inCalifornia = input.type !== "address" || (input.details.state ?? "CA") === "CA";
    if (!inCalifornia) return { provider: this.name, status: "no_match" };

    return {
      provider: this.name,
      status: "mock",
      lastUpdated: "2026-07-28",
      businesses: [
        {
          name: "Golden Gate Retail Group LLC",
          registrationId: "202299910001",
          status: "Active",
          address: "548 Market St, San Francisco, CA 94104",
          startDate: "2022-03-11",
        },
      ],
    };
  },
};
