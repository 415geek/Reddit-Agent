export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral prose-sm">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-xs text-neutral-400">Draft — review with counsel before launch.</p>
      <p>
        VerifyOne is not a consumer reporting agency and does not provide “consumer reports” as
        defined by the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681 et seq. You may not use
        this service to determine eligibility for employment, housing, credit, insurance, or any
        other purpose governed by the FCRA.
      </p>
      <p>
        Data is aggregated from third-party sources and provided “as is.” Accuracy is not
        guaranteed; every field displays its source and confidence level, and conflicting data is
        flagged rather than hidden. Verify independently before acting on any result.
      </p>
      <p>
        We may suspend accounts that violate the Acceptable Use Policy, exceed rate limits, or
        show patterns consistent with harassment or bulk data harvesting.
      </p>
    </div>
  );
}
