import Link from "next/link";
import { listReports } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const reports = listReports();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Search history</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Demo mode: history is stored in memory on this server instance. With Supabase connected,
        history is private per account and deletable at any time.
      </p>

      {reports.length === 0 ? (
        <div className="mt-8 rounded-card border border-neutral-200 bg-white p-8 text-center">
          <p className="text-neutral-600">No searches yet.</p>
          <Link href="/" className="mt-2 inline-block text-sm text-brand hover:underline">
            Run your first search
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/report/${r.id}`}
                className="block rounded-card border border-neutral-200 bg-white p-4 hover:border-brand"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900">
                    {r.profile.name?.value ?? r.input.normalized}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {r.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500 capitalize">
                  {r.input.type} search · {r.totalCredits} credits ·{" "}
                  {r.providerRuns.filter((p) => p.status !== "error").length}/
                  {r.providerRuns.length} sources succeeded
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
