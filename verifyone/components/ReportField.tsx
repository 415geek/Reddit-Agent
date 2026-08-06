import type { ProfileField } from "@/lib/types";

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-blue-50 text-blue-700 border-blue-200",
  medium: "bg-neutral-100 text-neutral-600 border-neutral-200",
  low: "bg-neutral-100 text-neutral-500 border-neutral-200",
  conflicting: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  conflicting: "Conflicting sources",
};

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <span
      className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLE[confidence] ?? CONFIDENCE_STYLE.medium}`}
    >
      {CONFIDENCE_LABEL[confidence] ?? confidence}
    </span>
  );
}

export function ReportField({
  label,
  field,
}: {
  label: string;
  field: ProfileField<string | number>;
}) {
  return (
    <div className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-500 w-32 shrink-0">{label}</span>
        <span className="text-sm font-medium text-neutral-900">
          {typeof field.value === "number" ? field.value.toLocaleString("en-US") : field.value}
        </span>
        <ConfidenceBadge confidence={field.confidence} />
      </div>
      {field.conflicts && field.conflicts.length > 0 && (
        <p className="mt-1 ml-32 pl-2 text-xs text-yellow-700">
          Multiple sources returned different information: {field.conflicts.join("; ")}
        </p>
      )}
      <details className="ml-32 pl-2 mt-0.5">
        <summary className="text-[11px] text-neutral-400 cursor-pointer hover:text-neutral-600">
          Why am I seeing this?
        </summary>
        <ul className="mt-1 text-[11px] text-neutral-500 space-y-0.5">
          {field.sources.map((s, i) => (
            <li key={i}>
              Source: <span className="font-medium">{s.provider}</span> · queried{" "}
              {s.queriedAt.slice(0, 10)}
              {s.lastUpdated ? ` · provider data as of ${s.lastUpdated}` : ""} · raw value: “
              {s.rawValue}”
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function ReportCard({
  title,
  children,
  empty,
}: {
  title: string;
  children?: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="rounded-card border border-neutral-200 bg-white shadow-sm">
      <details open={!empty}>
        <summary className="px-5 py-3 cursor-pointer select-none font-medium text-neutral-900 border-b border-neutral-100">
          {title}
        </summary>
        <div className="px-5 py-3 divide-y divide-neutral-100">
          {empty ? (
            <p className="text-sm text-neutral-400 py-2">No data found from current sources.</p>
          ) : (
            children
          )}
        </div>
      </details>
    </section>
  );
}
