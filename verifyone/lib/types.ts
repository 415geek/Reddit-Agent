/**
 * Core domain types for VerifyOne.
 *
 * V1 deliberately supports only phone / email / address searches.
 * Name-only search is excluded to avoid false matches (see docs/PRD.md).
 */

export type SearchInputType = "phone" | "email" | "address" | "name";

export interface NormalizedSearchInput {
  type: SearchInputType;
  /** Raw value exactly as the user typed it. */
  raw: string;
  /** Canonical value: E.164 phone, lower-cased email, or normalized address line. */
  normalized: string;
  /** Extra parsed detail, e.g. { state: "CA", zip: "94110" } for addresses. */
  details: Record<string, string>;
}

export type Confidence = "high" | "medium" | "low" | "conflicting";

export interface FieldSource {
  provider: string;
  /** ISO timestamp of when we queried the provider. */
  queriedAt: string;
  /** Provider-reported last update, if any. */
  lastUpdated?: string;
  rawValue: string;
}

export interface ProfileField<T = string> {
  value: T;
  confidence: Confidence;
  sources: FieldSource[];
  /** Set when sources disagree; each entry is a competing value. */
  conflicts?: string[];
}

export interface RiskSignal {
  /** e.g. "sanctions", "pep", "watchlist" */
  kind: string;
  /** Always phrased as a potential match, never an accusation. */
  summary: string;
  provider: string;
  confidence: Confidence;
}

export interface BusinessRecord {
  name: ProfileField;
  /** e.g. "DataSF", "CA SOS" registration numbers */
  registrationId?: ProfileField;
  status?: ProfileField;
  address?: ProfileField;
  startDate?: ProfileField;
  naicsDescription?: ProfileField;
}

export interface PropertyRecord {
  address: ProfileField;
  ownerName?: ProfileField;
  propertyType?: ProfileField;
  estimatedValue?: ProfileField<number>;
  estimatedRent?: ProfileField<number>;
  lastSaleDate?: ProfileField;
  lastSalePrice?: ProfileField<number>;
}

export interface UnifiedProfile {
  /** Best display name, if any provider resolved one. */
  name?: ProfileField;
  aliases: ProfileField[];
  ageRange?: ProfileField;
  currentLocation?: ProfileField;
  previousLocations: ProfileField[];
  phones: ProfileField[];
  phoneType?: ProfileField;
  carrier?: ProfileField;
  emails: ProfileField[];
  addresses: ProfileField[];
  employers: ProfileField[];
  jobTitles: ProfileField[];
  education: ProfileField[];
  properties: PropertyRecord[];
  businesses: BusinessRecord[];
  riskSignals: RiskSignal[];
  /** Overall match confidence for the whole profile. */
  overallConfidence: Confidence;
}

export type ProviderStatus = "ok" | "no_match" | "error" | "skipped" | "mock";

export interface ProviderRunSummary {
  provider: string;
  status: ProviderStatus;
  costCredits: number;
  durationMs: number;
  cacheHit: boolean;
  error?: string;
}

export interface SearchReport {
  id: string;
  input: NormalizedSearchInput;
  profile: UnifiedProfile;
  providerRuns: ProviderRunSummary[];
  totalCredits: number;
  createdAt: string;
  /** True when any provider ran in mock mode; surfaced prominently in the UI. */
  containsMockData: boolean;
}
