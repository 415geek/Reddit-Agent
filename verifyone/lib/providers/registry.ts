import type { SearchInputType } from "@/lib/types";
import type { DataProvider } from "@/lib/providers/types";
import { mockTrestle } from "@/lib/providers/mock/trestle.mock";
import { mockPeopleDataLabs } from "@/lib/providers/mock/pdl.mock";
import { mockRentCast } from "@/lib/providers/mock/rentcast.mock";
import { mockOpenSanctions } from "@/lib/providers/mock/opensanctions.mock";
import { mockCaSos } from "@/lib/providers/mock/ca-sos.mock";
import { dataSf } from "@/lib/providers/datasf";

/**
 * Provider registry — the single place where vendors are wired in.
 *
 * PROVIDER_MODE=mock  → paid vendors are replaced by clearly-labelled mocks.
 * PROVIDER_MODE=live  → real adapters (Phase 2+) are loaded instead; a live
 *                       adapter missing its API key must fail fast at startup,
 *                       never silently fall back to mock data.
 *
 * DataSF is free/open data and runs live in both modes.
 */

function buildRegistry(): DataProvider[] {
  const mode = process.env.PROVIDER_MODE === "live" ? "live" : "mock";

  if (mode === "live") {
    // Phase 2+: import real adapters here (trestle.ts, pdl.ts, rentcast.ts,
    // opensanctions.ts, ca-sos vendor). Fail fast so mock data can never
    // reach production users.
    throw new Error(
      "PROVIDER_MODE=live but no live provider adapters are implemented yet (Phase 2)."
    );
  }

  return [mockTrestle, mockPeopleDataLabs, mockRentCast, mockOpenSanctions, mockCaSos, dataSf];
}

let registry: DataProvider[] | null = null;

export function getProviders(): DataProvider[] {
  if (!registry) registry = buildRegistry();
  return registry;
}

export function providersFor(inputType: SearchInputType): DataProvider[] {
  return getProviders().filter((p) => p.supports(inputType));
}

export function estimateCredits(inputType: SearchInputType): number {
  return providersFor(inputType).reduce((sum, p) => sum + p.costCredits, 0);
}
