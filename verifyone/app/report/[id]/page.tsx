import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/store";
import { ReportCard, ReportField, ConfidenceBadge } from "@/components/ReportField";

export const dynamic = "force-dynamic";

export default function ReportPage({ params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) notFound();

  const { profile, input } = report;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      {report.containsMockData && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-card p-3">
          Demo mode: some sources below are clearly-labelled mock providers. Connect real API
          keys and set PROVIDER_MODE=live to use production data.
        </p>
      )}

      <header className="rounded-card border border-neutral-200 bg-white shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-900">
            {profile.name?.value ?? "Unresolved identity"}
          </h1>
          <ConfidenceBadge confidence={profile.overallConfidence} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.currentLocation?.value ?? "Location unknown"} · searched by {input.type}:{" "}
          {input.normalized}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Data retrieved on {report.createdAt.slice(0, 10)} · {report.totalCredits} credits used
        </p>
        {profile.riskSignals.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-card px-3 py-2 inline-block">
            No matches found on sanctions, PEP, or watchlist sources checked.
          </p>
        ) : (
          <p className="mt-3 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-card px-3 py-2 inline-block">
            {profile.riskSignals.length} potential public-record match(es) requiring manual
            verification — see Public Risk Signals below.
          </p>
        )}
      </header>

      <ReportCard title="Identity" empty={!profile.name && !profile.currentLocation}>
        {profile.name && <ReportField label="Full name" field={profile.name} />}
        {profile.currentLocation && (
          <ReportField label="Current location" field={profile.currentLocation} />
        )}
        {profile.previousLocations.map((loc, i) => (
          <ReportField key={i} label="Previous location" field={loc} />
        ))}
      </ReportCard>

      <ReportCard
        title="Contact Information"
        empty={profile.phones.length === 0 && profile.emails.length === 0}
      >
        {profile.phones.map((p, i) => (
          <ReportField key={`p${i}`} label="Phone" field={p} />
        ))}
        {profile.phoneType && <ReportField label="Phone type" field={profile.phoneType} />}
        {profile.carrier && <ReportField label="Carrier" field={profile.carrier} />}
        {profile.emails.map((e, i) => (
          <ReportField key={`e${i}`} label="Email" field={e} />
        ))}
      </ReportCard>

      <ReportCard title="Address History" empty={profile.addresses.length === 0}>
        {profile.addresses.map((a, i) => (
          <ReportField key={i} label={i === 0 ? "Current address" : "Previous address"} field={a} />
        ))}
      </ReportCard>

      <ReportCard
        title="Employment and Education"
        empty={
          profile.employers.length === 0 &&
          profile.jobTitles.length === 0 &&
          profile.education.length === 0
        }
      >
        {profile.employers.map((e, i) => (
          <ReportField key={`emp${i}`} label={i === 0 ? "Employer" : "Past employer"} field={e} />
        ))}
        {profile.jobTitles.map((t, i) => (
          <ReportField key={`t${i}`} label="Job title" field={t} />
        ))}
        {profile.education.map((ed, i) => (
          <ReportField key={`ed${i}`} label="Education" field={ed} />
        ))}
      </ReportCard>

      <ReportCard title="Property" empty={profile.properties.length === 0}>
        {profile.properties.map((prop, i) => (
          <div key={i} className="py-2 space-y-1">
            <ReportField label="Address" field={prop.address} />
            {prop.ownerName && <ReportField label="Owner" field={prop.ownerName} />}
            {prop.propertyType && <ReportField label="Type" field={prop.propertyType} />}
            {prop.estimatedValue && (
              <ReportField label="Est. value ($)" field={prop.estimatedValue} />
            )}
            {prop.estimatedRent && <ReportField label="Est. rent ($/mo)" field={prop.estimatedRent} />}
            {prop.lastSaleDate && <ReportField label="Last sale" field={prop.lastSaleDate} />}
            {prop.lastSalePrice && (
              <ReportField label="Sale price ($)" field={prop.lastSalePrice} />
            )}
          </div>
        ))}
      </ReportCard>

      <ReportCard title="Business Connections" empty={profile.businesses.length === 0}>
        {profile.businesses.map((biz, i) => (
          <div key={i} className="py-2 space-y-1">
            <ReportField label="Business" field={biz.name} />
            {biz.registrationId && (
              <ReportField label="Registration #" field={biz.registrationId} />
            )}
            {biz.status && <ReportField label="Status" field={biz.status} />}
            {biz.address && <ReportField label="Address" field={biz.address} />}
            {biz.startDate && <ReportField label="Started" field={biz.startDate} />}
            {biz.naicsDescription && <ReportField label="Industry" field={biz.naicsDescription} />}
          </div>
        ))}
      </ReportCard>

      <ReportCard title="Public Risk Signals" empty={profile.riskSignals.length === 0}>
        {profile.riskSignals.map((risk, i) => (
          <div key={i} className="py-2">
            <p className="text-sm text-neutral-900">{risk.summary}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {risk.kind} · {risk.provider} · <ConfidenceBadge confidence={risk.confidence} />
            </p>
          </div>
        ))}
      </ReportCard>

      <section className="rounded-card border border-neutral-200 bg-white shadow-sm p-5">
        <h2 className="font-medium text-neutral-900 mb-2">Data sources for this report</h2>
        <ul className="text-xs text-neutral-500 space-y-1">
          {report.providerRuns.map((run) => (
            <li key={run.provider}>
              {run.provider} — {run.status}
              {run.cacheHit ? " (cached, no charge)" : ""} · {run.durationMs}ms ·{" "}
              {run.costCredits === 0 ? "free" : `${run.costCredits} credits`}
              {run.error ? ` · ${run.error}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <div className="text-center pt-2">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← New search
        </Link>
      </div>
    </div>
  );
}
