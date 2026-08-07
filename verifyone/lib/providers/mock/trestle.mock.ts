import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type { DataProvider, NormalizedProviderResult } from "@/lib/providers/types";

/**
 * MOCK provider — stands in for Trestle (reverse phone / phone validation /
 * reverse address / email lookup). Returns deterministic fake data derived
 * from the input so the full pipeline can be exercised without an API key.
 *
 * NEVER enable in production: the registry only loads this when
 * PROVIDER_MODE=mock.
 */
export const mockTrestle: DataProvider = {
  name: "Trestle (mock)",
  costCredits: 2,

  supports(inputType: SearchInputType): boolean {
    return (
      inputType === "phone" ||
      inputType === "email" ||
      inputType === "address" ||
      inputType === "name"
    );
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    const seed = hashCode(input.normalized);
    const first = FIRST_NAMES[seed % FIRST_NAMES.length]!;
    const last = LAST_NAMES[(seed >> 3) % LAST_NAMES.length]!;
    // For a name search, echo what the user typed instead of a synthetic name.
    const name = input.type === "name" ? input.normalized : `${first} ${last}`;
    const phone = input.type === "phone" ? input.normalized : `+1415555${String(1000 + (seed % 9000))}`;
    const email =
      input.type === "email"
        ? input.normalized
        : `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;
    const address =
      input.type === "address"
        ? input.normalized
        : `${100 + (seed % 899)} Valencia St, San Francisco, CA 94110`;

    return {
      provider: this.name,
      status: "mock",
      lastUpdated: "2026-07-01",
      person: {
        name,
        location: "San Francisco, CA",
        phones: [phone],
        phoneType: seed % 3 === 0 ? "VoIP" : "Mobile",
        carrier: seed % 3 === 0 ? "Twilio" : "T-Mobile",
        emails: [email],
        addresses: [address],
        previousLocations: ["Oakland, CA"],
      },
    };
  },
};

const FIRST_NAMES = ["Jordan", "Casey", "Morgan", "Taylor", "Riley", "Avery"];
const LAST_NAMES = ["Nguyen", "Garcia", "Chen", "Patel", "Kim", "Johnson"];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
