import { z } from "zod";
import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type {
  DataProvider,
  NormalizedProviderResult,
  ProviderPerson,
} from "@/lib/providers/types";

/**
 * People Data Labs — live adapter (Person Enrichment API v5).
 *
 * Overridable via env:
 *   PEOPLE_DATA_LABS_API_KEY   (required in live mode)
 *   PDL_BASE_URL               default https://api.peopledatalabs.com/v5/person/enrich
 *   PDL_AUTH_HEADER            default X-Api-Key
 *   PDL_MIN_LIKELIHOOD         default 4  (raise to cut false matches on names)
 *
 * Enrichment identifiers: email / phone / name (+ optional city, state).
 * PDL returns a single best match with a likelihood score; a name alone with
 * no location often returns 404 (no confident match), which we surface as
 * "no match" rather than a fabricated result.
 */

const TIMEOUT_MS = 10_000;

function cfg() {
  const apiKey = process.env.PEOPLE_DATA_LABS_API_KEY;
  if (!apiKey) throw new Error("PEOPLE_DATA_LABS_API_KEY is not set but PROVIDER_MODE=live");
  return {
    apiKey,
    base: process.env.PDL_BASE_URL ?? "https://api.peopledatalabs.com/v5/person/enrich",
    authHeader: process.env.PDL_AUTH_HEADER ?? "X-Api-Key",
    minLikelihood: process.env.PDL_MIN_LIKELIHOOD ?? "4",
  };
}

const dataSchema = z
  .object({
    full_name: z.string().nullish(),
    birth_year: z.number().nullish(),
    job_title: z.string().nullish(),
    job_company_name: z.string().nullish(),
    location_name: z.string().nullish(),
    emails: z
      .array(z.object({ address: z.string().nullish() }).passthrough())
      .nullish(),
    phone_numbers: z.array(z.string()).nullish(),
    experience: z
      .array(
        z
          .object({
            company: z.object({ name: z.string().nullish() }).passthrough().nullish(),
            title: z.object({ name: z.string().nullish() }).passthrough().nullish(),
          })
          .passthrough()
      )
      .nullish(),
    education: z
      .array(
        z
          .object({
            school: z.object({ name: z.string().nullish() }).passthrough().nullish(),
            degrees: z.array(z.string()).nullish(),
          })
          .passthrough()
      )
      .nullish(),
  })
  .passthrough();

const responseSchema = z
  .object({ status: z.number().nullish(), data: dataSchema.nullish() })
  .passthrough();

function uniq(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))];
}

export const peopleDataLabs: DataProvider = {
  name: "People Data Labs",
  costCredits: 3,

  supports(inputType: SearchInputType): boolean {
    return inputType === "phone" || inputType === "email" || inputType === "name";
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    const { apiKey, base, authHeader, minLikelihood } = cfg();

    const params = new URLSearchParams({ min_likelihood: minLikelihood });
    if (input.type === "email") params.set("email", input.normalized);
    else if (input.type === "phone") params.set("phone", input.normalized);
    else {
      params.set("name", input.normalized);
      if (input.details.city) params.set("locality", input.details.city);
      if (input.details.state) params.set("region", input.details.state);
    }

    try {
      const res = await fetch(`${base}?${params.toString()}`, {
        headers: { [authHeader]: apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });

      if (res.status === 404) return { provider: this.name, status: "no_match" };
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          provider: this.name,
          status: "error",
          error: `PDL HTTP ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
        };
      }

      const parsed = responseSchema.parse(await res.json());
      const d = parsed.data;
      if (!d) return { provider: this.name, status: "no_match" };

      const employers = uniq([
        d.job_company_name,
        ...(d.experience ?? []).map((e) => e.company?.name),
      ]);
      const jobTitles = uniq([d.job_title, ...(d.experience ?? []).map((e) => e.title?.name)]);
      const education = uniq(
        (d.education ?? []).map((e) => {
          const school = e.school?.name;
          if (!school) return undefined;
          const degree = e.degrees?.[0];
          return degree ? `${school} — ${degree}` : school;
        })
      );

      const person: ProviderPerson = {
        ...(d.full_name ? { name: d.full_name } : {}),
        ...(d.birth_year ? { ageRange: `Born ${d.birth_year}` } : {}),
        ...(d.location_name ? { location: d.location_name } : {}),
        ...(d.emails?.length ? { emails: uniq(d.emails.map((e) => e.address)) } : {}),
        ...(d.phone_numbers?.length ? { phones: uniq(d.phone_numbers) } : {}),
        ...(employers.length ? { employers } : {}),
        ...(jobTitles.length ? { jobTitles } : {}),
        ...(education.length ? { education } : {}),
      };

      const hasData = Object.keys(person).length > 0;
      return { provider: this.name, status: hasData ? "ok" : "no_match", person };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown PDL error";
      return { provider: this.name, status: "error", error: message };
    }
  },
};
