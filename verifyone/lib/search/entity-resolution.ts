import type {
  Confidence,
  FieldSource,
  ProfileField,
  UnifiedProfile,
} from "@/lib/types";
import type { NormalizedProviderResult } from "@/lib/providers/types";

/**
 * Entity resolution: merges results from multiple providers into one
 * UnifiedProfile. Rules:
 *  - identical normalized values from N providers merge into one field
 *    with N sources (2+ sources → high confidence)
 *  - differing values for a single-valued field (e.g. name) are kept,
 *    flagged "conflicting", and surfaced to the user — never silently merged
 *  - every field carries its sources and query timestamps
 */

interface Candidate {
  normalized: string;
  display: string;
  sources: FieldSource[];
}

/** "+1 (415) 555-0134", "4155550134", "1-415-555-0134" all key to "14155550134". */
function canonicalPhone(v: string): string {
  const digits = v.replace(/[^\d]/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

function makeSource(result: NormalizedProviderResult, rawValue: string): FieldSource {
  return {
    provider: result.provider,
    queriedAt: new Date().toISOString(),
    lastUpdated: result.lastUpdated,
    rawValue,
  };
}

function collect(
  candidates: Map<string, Candidate>,
  result: NormalizedProviderResult,
  value: string | undefined,
  normalize: (v: string) => string = (v) => v.trim().toLowerCase()
): void {
  if (!value || !value.trim()) return;
  const key = normalize(value);
  const existing = candidates.get(key);
  if (existing) {
    existing.sources.push(makeSource(result, value));
  } else {
    candidates.set(key, { normalized: key, display: value.trim(), sources: [makeSource(result, value)] });
  }
}

function confidenceForSources(count: number, status: string): Confidence {
  if (status === "mock") return count >= 2 ? "medium" : "low";
  return count >= 2 ? "high" : "medium";
}

/** Build a multi-valued field list (phones, emails, addresses, …). */
function toFieldList(candidates: Map<string, Candidate>): ProfileField[] {
  return [...candidates.values()].map((c) => ({
    value: c.display,
    confidence: confidenceForSources(
      c.sources.length,
      c.sources.some((s) => !s.provider.includes("mock")) ? "ok" : "mock"
    ),
    sources: c.sources,
  }));
}

/**
 * Build a single-valued field. If providers disagree, the best-supported
 * value wins but the field is marked "conflicting" and lists competitors.
 */
function toSingleField(candidates: Map<string, Candidate>): ProfileField | undefined {
  const all = [...candidates.values()].sort((a, b) => b.sources.length - a.sources.length);
  const best = all[0];
  if (!best) return undefined;
  const conflicts = all.slice(1).map((c) => c.display);
  return {
    value: best.display,
    confidence:
      conflicts.length > 0
        ? "conflicting"
        : confidenceForSources(
            best.sources.length,
            best.sources.some((s) => !s.provider.includes("mock")) ? "ok" : "mock"
          ),
    sources: best.sources,
    ...(conflicts.length > 0 ? { conflicts } : {}),
  };
}

export function resolveEntities(results: NormalizedProviderResult[]): UnifiedProfile {
  const usable = results.filter((r) => r.status === "ok" || r.status === "mock");

  const names = new Map<string, Candidate>();
  const locations = new Map<string, Candidate>();
  const prevLocations = new Map<string, Candidate>();
  const phones = new Map<string, Candidate>();
  const emails = new Map<string, Candidate>();
  const addresses = new Map<string, Candidate>();
  const employers = new Map<string, Candidate>();
  const jobTitles = new Map<string, Candidate>();
  const education = new Map<string, Candidate>();
  const phoneTypes = new Map<string, Candidate>();
  const carriers = new Map<string, Candidate>();

  const profile: UnifiedProfile = {
    aliases: [],
    previousLocations: [],
    phones: [],
    emails: [],
    addresses: [],
    employers: [],
    jobTitles: [],
    education: [],
    properties: [],
    businesses: [],
    riskSignals: [],
    overallConfidence: "low",
  };

  for (const result of usable) {
    const p = result.person;
    if (p) {
      collect(names, result, p.name);
      collect(locations, result, p.location);
      for (const loc of p.previousLocations ?? []) collect(prevLocations, result, loc);
      for (const phone of p.phones ?? []) collect(phones, result, phone, canonicalPhone);
      for (const email of p.emails ?? []) collect(emails, result, email);
      for (const addr of p.addresses ?? []) collect(addresses, result, addr);
      for (const emp of p.employers ?? []) collect(employers, result, emp);
      for (const title of p.jobTitles ?? []) collect(jobTitles, result, title);
      for (const edu of p.education ?? []) collect(education, result, edu);
      collect(phoneTypes, result, p.phoneType);
      collect(carriers, result, p.carrier);
    }

    for (const prop of result.properties ?? []) {
      profile.properties.push({
        address: { value: prop.address, confidence: "medium", sources: [makeSource(result, prop.address)] },
        ...(prop.ownerName
          ? { ownerName: { value: prop.ownerName, confidence: "medium", sources: [makeSource(result, prop.ownerName)] } }
          : {}),
        ...(prop.propertyType
          ? { propertyType: { value: prop.propertyType, confidence: "medium", sources: [makeSource(result, prop.propertyType)] } }
          : {}),
        ...(prop.estimatedValue !== undefined
          ? { estimatedValue: { value: prop.estimatedValue, confidence: "medium", sources: [makeSource(result, String(prop.estimatedValue))] } }
          : {}),
        ...(prop.estimatedRent !== undefined
          ? { estimatedRent: { value: prop.estimatedRent, confidence: "medium", sources: [makeSource(result, String(prop.estimatedRent))] } }
          : {}),
        ...(prop.lastSaleDate
          ? { lastSaleDate: { value: prop.lastSaleDate, confidence: "medium", sources: [makeSource(result, prop.lastSaleDate)] } }
          : {}),
        ...(prop.lastSalePrice !== undefined
          ? { lastSalePrice: { value: prop.lastSalePrice, confidence: "medium", sources: [makeSource(result, String(prop.lastSalePrice))] } }
          : {}),
      });
    }

    for (const biz of result.businesses ?? []) {
      profile.businesses.push({
        name: { value: biz.name, confidence: result.status === "ok" ? "high" : "low", sources: [makeSource(result, biz.name)] },
        ...(biz.registrationId
          ? { registrationId: { value: biz.registrationId, confidence: "high", sources: [makeSource(result, biz.registrationId)] } }
          : {}),
        ...(biz.status
          ? { status: { value: biz.status, confidence: "medium", sources: [makeSource(result, biz.status)] } }
          : {}),
        ...(biz.address
          ? { address: { value: biz.address, confidence: "medium", sources: [makeSource(result, biz.address)] } }
          : {}),
        ...(biz.startDate
          ? { startDate: { value: biz.startDate, confidence: "medium", sources: [makeSource(result, biz.startDate)] } }
          : {}),
        ...(biz.naicsDescription
          ? { naicsDescription: { value: biz.naicsDescription, confidence: "medium", sources: [makeSource(result, biz.naicsDescription)] } }
          : {}),
      });
    }

    for (const risk of result.risks ?? []) {
      profile.riskSignals.push({
        kind: risk.kind,
        // Phrasing rule: potential match requiring verification, never an accusation.
        summary: `Potential public-record match requiring manual verification: ${risk.summary}`,
        provider: result.provider,
        confidence: "low",
      });
    }
  }

  const nameField = toSingleField(names);
  if (nameField) profile.name = nameField;
  const locationField = toSingleField(locations);
  if (locationField) profile.currentLocation = locationField;
  const phoneTypeField = toSingleField(phoneTypes);
  if (phoneTypeField) profile.phoneType = phoneTypeField;
  const carrierField = toSingleField(carriers);
  if (carrierField) profile.carrier = carrierField;

  profile.previousLocations = toFieldList(prevLocations);
  profile.phones = toFieldList(phones);
  profile.emails = toFieldList(emails);
  profile.addresses = toFieldList(addresses);
  profile.employers = toFieldList(employers);
  profile.jobTitles = toFieldList(jobTitles);
  profile.education = toFieldList(education);

  profile.overallConfidence = overallConfidence(profile);
  return profile;
}

function overallConfidence(profile: UnifiedProfile): Confidence {
  const fields = [
    profile.name,
    profile.currentLocation,
    ...profile.phones,
    ...profile.emails,
    ...profile.addresses,
  ].filter((f): f is ProfileField => f !== undefined);

  if (fields.length === 0) return "low";
  if (fields.some((f) => f.confidence === "conflicting")) return "conflicting";
  if (fields.filter((f) => f.confidence === "high").length >= 2) return "high";
  if (fields.some((f) => f.confidence === "high" || f.confidence === "medium")) return "medium";
  return "low";
}
