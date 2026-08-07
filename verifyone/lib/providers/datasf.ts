import { z } from "zod";
import type { NormalizedSearchInput, SearchInputType } from "@/lib/types";
import type {
  DataProvider,
  NormalizedProviderResult,
  ProviderBusiness,
} from "@/lib/providers/types";

/**
 * DataSF — Registered Business Locations (San Francisco open data, Socrata).
 * Dataset: https://data.sfgov.org/resource/g8m3-pdis
 *
 * This is a real, free API (no key required; DATASF_APP_TOKEN raises rate
 * limits), so it runs live even in mock mode. Only useful for SF addresses,
 * so it activates when the query is an address in San Francisco / CA-with-SF-zip.
 */

const DATASET_URL = "https://data.sfgov.org/resource/g8m3-pdis.json";
const TIMEOUT_MS = 8000;

const rowSchema = z.object({
  dba_name: z.string().optional(),
  ownership_name: z.string().optional(),
  full_business_address: z.string().optional(),
  certificate_number: z.string().optional(),
  dba_start_date: z.string().optional(),
  administratively_closed: z.string().optional(),
  naic_code_description: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  business_zip: z.string().optional(),
});

function looksLikeSanFrancisco(input: NormalizedSearchInput): boolean {
  const city = (input.details.city ?? "").toLowerCase();
  const zip = input.details.zip ?? "";
  const raw = input.raw.toLowerCase();
  return (
    city.includes("san francisco") ||
    raw.includes("san francisco") ||
    /^941\d{2}$/.test(zip)
  );
}

export const dataSf: DataProvider = {
  name: "DataSF",
  costCredits: 0,

  supports(inputType: SearchInputType): boolean {
    // Address: match by business address. Name: match by DBA / owner name.
    return inputType === "address" || inputType === "name";
  },

  async search(input: NormalizedSearchInput): Promise<NormalizedProviderResult> {
    // For addresses, only bother when the address looks like SF (this is an SF
    // dataset). Name searches always run — the full-text index covers owner
    // and DBA names.
    if (input.type === "address" && !looksLikeSanFrancisco(input)) {
      return { provider: this.name, status: "skipped" };
    }

    const params = new URLSearchParams({
      $q: input.normalized,
      $limit: "10",
      $order: "dba_start_date DESC",
    });
    const headers: Record<string, string> = {};
    const token = process.env.DATASF_APP_TOKEN;
    if (token) headers["X-App-Token"] = token;

    try {
      const res = await fetch(`${DATASET_URL}?${params}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) {
        return { provider: this.name, status: "error", error: `HTTP ${res.status}` };
      }
      const rows = z.array(rowSchema).parse(await res.json());
      if (rows.length === 0) return { provider: this.name, status: "no_match" };

      const businesses: ProviderBusiness[] = rows.map((row) => ({
        name: row.dba_name ?? row.ownership_name ?? "Unknown business",
        registrationId: row.certificate_number,
        status: row.administratively_closed ? "Closed" : "Registered",
        address: row.full_business_address
          ? `${row.full_business_address}, ${row.city ?? "San Francisco"}, ${row.state ?? "CA"} ${row.business_zip ?? ""}`.trim()
          : undefined,
        startDate: row.dba_start_date?.slice(0, 10),
        naicsDescription: row.naic_code_description,
      }));

      return { provider: this.name, status: "ok", businesses };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { provider: this.name, status: "error", error: message };
    }
  },
};
