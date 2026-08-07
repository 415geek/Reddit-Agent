import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "VerifyOne — Verify people, properties, and businesses",
  description:
    "Verify people, contacts, properties, and businesses from one simple search across trusted public and commercial data sources.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              Verify<span className="text-brand">One</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-600">
              <Link href="/history" className="hover:text-neutral-900">
                History
              </Link>
              <Link href="/legal/privacy" className="hover:text-neutral-900">
                Privacy
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-neutral-500 space-y-2">
            <p>
              VerifyOne is not a consumer reporting agency and may not be used for purposes
              governed by the Fair Credit Reporting Act, including employment, housing, credit,
              or insurance decisions.
            </p>
            <div className="flex gap-4">
              <Link href="/legal/privacy" className="hover:text-neutral-700">Privacy Policy</Link>
              <Link href="/legal/terms" className="hover:text-neutral-700">Terms of Service</Link>
              <Link href="/legal/aup" className="hover:text-neutral-700">Acceptable Use</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
