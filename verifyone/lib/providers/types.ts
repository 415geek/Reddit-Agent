import type {
  NormalizedSearchInput,
  SearchInputType,
  ProviderStatus,
} from "@/lib/types";

/**
 * Every data vendor (paid or open-data) implements this interface.
 * Adding a vendor = adding one adapter file + registering it; nothing
 * else in the system changes.
 */

export interface ProviderPerson {
  name?: string;
  aliases?: string[];
  ageRange?: string;
  location?: string;
  previousLocations?: string[];
  phones?: string[];
  phoneType?: string;
  carrier?: string;
  emails?: string[];
  addresses?: string[];
  employers?: string[];
  jobTitles?: string[];
  education?: string[];
}

export interface ProviderProperty {
  address: string;
  ownerName?: string;
  propertyType?: string;
  estimatedValue?: number;
  estimatedRent?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
}

export interface ProviderBusiness {
  name: string;
  registrationId?: string;
  status?: string;
  address?: string;
  startDate?: string;
  naicsDescription?: string;
}

export interface ProviderRisk {
  kind: string;
  summary: string;
}

export interface NormalizedProviderResult {
  provider: string;
  status: ProviderStatus;
  /** Provider-reported freshness, ISO date, if available. */
  lastUpdated?: string;
  person?: ProviderPerson;
  properties?: ProviderProperty[];
  businesses?: ProviderBusiness[];
  risks?: ProviderRisk[];
  error?: string;
}

export interface DataProvider {
  name: string;
  /** Credits charged to the user for one call to this provider. */
  costCredits: number;
  supports(inputType: SearchInputType): boolean;
  search(input: NormalizedSearchInput): Promise<NormalizedProviderResult>;
}

export function emptyResult(provider: string, status: ProviderStatus): NormalizedProviderResult {
  return { provider, status };
}
