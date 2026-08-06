import { z } from "zod";
import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type {
  DataProvider,
  NormalizedProviderResult,
  ProviderPerson,
} from "@/lib/providers/types";

/**
 * Trestle (trestleiq.com) — live adapter.
 *
 * Endpoints and auth header are overridable via env so the integration can be
 * tuned without a code change if Trestle bumps a version:
 *   TRESTLE_BASE_URL           default https://api.trestleiq.com
 *   TRESTLE_PHONE_PATH         default /3.2/phone      (Reverse Phone)
 *   TRESTLE_LOCATION_PATH      default /3.1/location   (Reverse Address)
 *   TRESTLE_AUTH_HEADER        default x-api-key
 *
 * Auth: TRESTLE_API_KEY (server-side only). Trestle has no email lookup, so
 * this adapter only supports phone and address inputs.
 */

const TIMEOUT_MS = 10_000;

function cfg() {
  const apiKey = process.env.TRESTLE_API_KEY;
  if (!apiKey) throw new Error("TRESTLE_API_KEY is not set but PROVIDER_MODE=live");
  return {
    apiKey,
    base: process.env.TRESTLE_BASE_URL ?? "https://api.trestleiq.com",
    phonePath: process.env.TRESTLE_PHONE_PATH ?? "/3.2/phone",
    locationPath: process.env.TRESTLE_LOCATION_PATH ?? "/3.1/location",
    authHeader: process.env.TRESTLE_AUTH_HEADER ?? "x-api-key",
  };
}

// Loose schemas: Trestle returns rich objects; we only pull what we display and
// tolerate unknown/extra fields so a schema drift never hard-fails the search.
const addressSchema = z
  .object({
    street_line_1: z.string().nullish(),
    street_line_2: z.string().nullish(),
    city: z.string().nullish(),
    state_code: z.string().nullish(),
    postal_code: z.string().nullish(),
  })
  .passthrough();

const ownerSchema = z
  .object({
    name: z.string().nullish(),
    alternate_names: z.array(z.string()).nullish(),
    age_range: z.string().nullish(),
    current_addresses: z.array(addressSchema).nullish(),
  })
  .passthrough();

const phoneResponseSchema = z
  .object({
    is_valid: z.boolean().nullish(),
    line_type: z.string().nullish(),
    carrier: z.string().nullish(),
    owners: z.array(ownerSchema).nullish(),
    current_addresses: z.array(addressSchema).nullish(),
  })
  .passthrough();

const locationResponseSchema = z
  .object({
    is_valid: z.boolean().nullish(),
    current_residents: z.array(ownerSchema).nullish(),
  })
  .passthrough();

function formatAddress(a: z.infer<typeof addressSchema>): string | null {
  const parts = [
    a.street_line_1,
    a.street_line_2,
    a.city,
    [a.state_code, a.postal_code].filter(Boolean).join(" "),
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(", ") : null;
}

async function call(url: string, headerName: string, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { [headerName]: apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Trestle HTTP ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  return res.json();
}

export const trestle: DataProvider = {
  name: "Trestle",
  costCredits: 2,

  supports(inputType: SearchInputType): boolean {
    return inputType === "phone" || inputType === "address";
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    const { apiKey, base, phonePath, locationPath, authHeader } = cfg();

    try {
      if (input.type === "phone") {
        const phoneDigits = input.normalized.replace(/^\+/, "");
        const url = `${base}${phonePath}?phone=${encodeURIComponent(phoneDigits)}&phone.country_hint=US`;
        const parsed = phoneResponseSchema.parse(await call(url, authHeader, apiKey));

        const owner = parsed.owners?.[0];
        const addresses = [
          ...(owner?.current_addresses ?? []),
          ...(parsed.current_addresses ?? []),
        ]
          .map(formatAddress)
          .filter((a): a is string => Boolean(a));

        const person: ProviderPerson = {
          ...(owner?.name ? { name: owner.name } : {}),
          ...(owner?.alternate_names?.length ? { aliases: owner.alternate_names } : {}),
          ...(owner?.age_range ? { ageRange: owner.age_range } : {}),
          phones: [input.normalized],
          ...(parsed.line_type ? { phoneType: parsed.line_type } : {}),
          ...(parsed.carrier ? { carrier: parsed.carrier } : {}),
          ...(addresses.length ? { addresses } : {}),
        };

        const hasData = owner?.name || addresses.length > 0;
        return { provider: this.name, status: hasData ? "ok" : "no_match", person };
      }

      // address
      const params = new URLSearchParams();
      params.set("street_line_1", input.normalized);
      if (input.details.city) params.set("city", input.details.city);
      if (input.details.state) params.set("state_code", input.details.state);
      if (input.details.zip) params.set("postal_code", input.details.zip);
      params.set("country_code", "US");

      const url = `${base}${locationPath}?${params.toString()}`;
      const parsed = locationResponseSchema.parse(await call(url, authHeader, apiKey));

      const resident = parsed.current_residents?.[0];
      if (!resident?.name) return { provider: this.name, status: "no_match" };

      const person: ProviderPerson = {
        name: resident.name,
        ...(resident.alternate_names?.length ? { aliases: resident.alternate_names } : {}),
        ...(resident.age_range ? { ageRange: resident.age_range } : {}),
        addresses: [input.raw],
      };
      return { provider: this.name, status: "ok", person };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Trestle error";
      return { provider: this.name, status: "error", error: message };
    }
  },
};
