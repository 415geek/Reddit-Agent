import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type { DataProvider, NormalizedProviderResult } from "@/lib/providers/types";

/** MOCK provider — stands in for RentCast property records & valuations. */
export const mockRentCast: DataProvider = {
  name: "RentCast (mock)",
  costCredits: 2,

  supports(inputType: SearchInputType): boolean {
    return inputType === "address";
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    return {
      provider: this.name,
      status: "mock",
      lastUpdated: "2026-07-20",
      properties: [
        {
          address: input.normalized,
          ownerName: "Morgan Chen",
          propertyType: "Single Family",
          estimatedValue: 1250000,
          estimatedRent: 4200,
          lastSaleDate: "2019-05-14",
          lastSalePrice: 980000,
        },
      ],
    };
  },
};
