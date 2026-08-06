import type { SearchInputType } from "@/lib/types";
import type { DataProvider } from "@/lib/providers/types";
import { mockTrestle } from "@/lib/providers/mock/trestle.mock";
import { mockPeopleDataLabs } from "@/lib/providers/mock/pdl.mock";
import { mockRentCast } from "@/lib/providers/mock/rentcast.mock";
import { mockOpenSanctions } from "@/lib/providers/mock/opensanctions.mock";
import { mockCaSos } from "@/lib/providers/mock/ca-sos.mock";
import { dataSf } from "@/lib/providers/datasf";
import { trestle } from "@/lib/providers/trestle";

/**
 * Provider registry — the single place where vendors are wired in.
 *
 * PROVIDER_MODE=mock  → paid vendors are replaced by clearly-labelled mocks.
 * PROVIDER_MODE=live  → only real adapters run, and only those whose API key is
 *                       present. A vendor without a key is simply omitted (its
 *                       data is absent, never mocked). Mock data can never reach
 *                       a live report.
 *
 * DataSF is free/open data and runs live in both modes.
 */

function buildRegistry(): DataProvider[] {
  const mode = process.env.PROVIDER_MODE === "live" ? "live" : "mock";

  // Open data — always live, no key required (DATASF_APP_TOKEN just raises limits).
  const providers: DataProvider[] = [dataSf];

  if (mode === "mock") {
    providers.push(mockTrestle, mockPeopleDataLabs, mockRentCast, mockOpenSanctions, mockCaSos);
    return providers;
  }

  // Live: enable each real adapter only when its key is configured.
  if (process.env.TRESTLE_API_KEY) providers.push(trestle);

  // People Data Labs / RentCast / OpenSanctions / CA SOS live adapters are not
  // wired yet. When their keys and adapters land, register them here. Until
  // then they are absent from live reports — never mocked.

  return providers;
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
