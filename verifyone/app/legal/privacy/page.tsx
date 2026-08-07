export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral prose-sm">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-xs text-neutral-400">Draft — review with counsel before launch.</p>
      <p>
        VerifyOne aggregates publicly available and commercially licensed data. We collect only
        the account information you give us and the searches you run.
      </p>
      <h2 className="text-lg font-medium mt-6">Your rights</h2>
      <ul className="list-disc pl-5">
        <li>Delete your search history at any time.</li>
        <li>Permanently delete your account and all associated data.</li>
        <li>
          California residents: submit a “Do Not Sell or Share My Personal Information” request
          from your account settings or by emailing privacy@verifyone.example.
        </li>
        <li>Request removal of your own information from search results (opt-out).</li>
      </ul>
      <h2 className="text-lg font-medium mt-6">What we never do</h2>
      <ul className="list-disc pl-5">
        <li>Sell your searches or account data to third parties.</li>
        <li>Display full SSNs, full dates of birth, or financial account numbers.</li>
        <li>Permit use governed by the Fair Credit Reporting Act.</li>
      </ul>
    </div>
  );
}
