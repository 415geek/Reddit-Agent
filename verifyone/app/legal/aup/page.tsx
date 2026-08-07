export default function AcceptableUsePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral prose-sm">
      <h1 className="text-2xl font-semibold">Acceptable Use Policy</h1>
      <p className="text-xs text-neutral-400">Draft — review with counsel before launch.</p>
      <p>You may use VerifyOne to:</p>
      <ul className="list-disc pl-5">
        <li>Verify the identity of a contact, customer, vendor, or business partner.</li>
        <li>Research property ownership and business registrations.</li>
        <li>Screen counterparties against public sanctions and watchlists.</li>
      </ul>
      <p>You may NOT use VerifyOne to:</p>
      <ul className="list-disc pl-5">
        <li>Make employment, tenant-screening, credit, or insurance decisions (FCRA-governed uses).</li>
        <li>Stalk, harass, threaten, or intimidate any person.</li>
        <li>Locate a person who has a protective order against you.</li>
        <li>Harvest data in bulk or resell raw results.</li>
        <li>Obtain highly sensitive personal information unlawfully.</li>
      </ul>
      <p>
        Each search requires an explicit confirmation of these terms. We log consent, monitor for
        abusive patterns, and suspend violating accounts.
      </p>
    </div>
  );
}
