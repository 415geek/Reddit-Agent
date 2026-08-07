"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

interface Estimate {
  input: { type: string; normalized: string };
  providers: { name: string; costCredits: number }[];
  estimatedCredits: number;
}

type Stage = "idle" | "estimating" | "confirm" | "searching";

const PROGRESS_STEPS = [
  "Validating input",
  "Finding identity matches",
  "Checking contact information",
  "Enriching professional data",
  "Checking property records",
  "Checking business registrations",
  "Reviewing public risk signals",
  "Building your report",
];

const EXAMPLES = [
  { label: "Phone", value: "(415) 555-0134" },
  { label: "Name", value: "Golden Gate Retail Group" },
  { label: "Address", value: "548 Market St, San Francisco, CA 94104" },
];

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  async function handleEstimate(value?: string) {
    const q = (value ?? query).trim();
    if (!q) return;
    if (value) setQuery(value);
    setError(null);
    setStage("estimating");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, mode: "estimate" }),
      });
      const data = (await res.json()) as Estimate & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStage("idle");
        return;
      }
      setEstimate(data);
      setStage("confirm");
    } catch {
      setError("Network error. Please try again.");
      setStage("idle");
    }
  }

  async function handleExecute() {
    if (!consent) {
      setError("Please confirm the acceptable-use agreement first.");
      return;
    }
    setError(null);
    setStage("searching");
    setProgressStep(0);
    const ticker = setInterval(
      () => setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1)),
      450
    );
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode: "execute", acceptedUsePolicy: true }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Search failed. You were not charged.");
        setStage("confirm");
        return;
      }
      // Persist client-side: Vercel serverless instances don't share memory,
      // so the report page reads from sessionStorage rather than server state.
      try {
        sessionStorage.setItem(`verifyone:report:${data.id}`, JSON.stringify(data));
        const indexRaw = sessionStorage.getItem("verifyone:reports");
        const index = (indexRaw ? JSON.parse(indexRaw) : []) as string[];
        sessionStorage.setItem(
          "verifyone:reports",
          JSON.stringify([data.id, ...index.filter((id) => id !== data.id)].slice(0, 50))
        );
      } catch {
        // sessionStorage unavailable (private mode) — report page will handle it.
      }
      router.push(`/report/${data.id}`);
    } catch {
      setError("Network error. You were not charged.");
      setStage("confirm");
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleEstimate();
        }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a phone number, email, address, or name"
          aria-label="Search by phone number, email, address, or name"
          className="flex-1 h-14 px-5 rounded-card border border-neutral-300 bg-white text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
        />
        <button
          type="submit"
          disabled={stage === "estimating" || stage === "searching"}
          className="h-14 px-8 rounded-card bg-brand text-white font-medium hover:bg-brand-dark disabled:opacity-60 flex items-center justify-center gap-2 min-w-[8rem]"
        >
          {stage === "estimating" ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Search className="h-5 w-5" aria-hidden />
          )}
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => void handleEstimate(ex.value)}
            className="text-xs px-3 py-2 rounded-full border border-neutral-300 bg-white text-neutral-600 hover:border-brand hover:text-brand"
          >
            Try a {ex.label.toLowerCase()}: {ex.value}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-card p-3">
          {error}
        </p>
      )}

      {stage === "confirm" && estimate && (
        <div className="mt-6 rounded-card border border-neutral-200 bg-white p-5 text-left shadow-sm">
          <p className="text-sm text-neutral-600">
            Detected input: <span className="font-medium text-neutral-900 capitalize">{estimate.input.type}</span>{" "}
            <span className="text-neutral-500">({estimate.input.normalized})</span>
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            This search will use approximately{" "}
            <span className="font-semibold text-neutral-900">{estimate.estimatedCredits} credits</span> across{" "}
            {estimate.providers.length} data sources.
          </p>
          <ul className="mt-2 text-xs text-neutral-500 space-y-0.5">
            {estimate.providers.map((p) => (
              <li key={p.name}>
                {p.name} — {p.costCredits === 0 ? "free" : `${p.costCredits} credits`}
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-start gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              I agree not to use this service for employment, housing, credit, insurance,
              stalking, harassment, or any unlawful purpose.
            </span>
          </label>
          <button
            type="button"
            onClick={() => void handleExecute()}
            className="mt-4 w-full sm:w-auto h-11 px-6 rounded-card bg-brand text-white text-sm font-medium hover:bg-brand-dark"
          >
            Run search
          </button>
        </div>
      )}

      {stage === "searching" && (
        <div className="mt-6 rounded-card border border-neutral-200 bg-white p-5 text-left shadow-sm">
          <ul className="space-y-2 text-sm">
            {PROGRESS_STEPS.map((step, i) => (
              <li
                key={step}
                className={
                  i < progressStep
                    ? "text-neutral-400 line-through"
                    : i === progressStep
                      ? "text-neutral-900 font-medium flex items-center gap-2"
                      : "text-neutral-400"
                }
              >
                {i === progressStep && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
