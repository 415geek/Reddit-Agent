import { SearchBox } from "@/components/SearchBox";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24 text-center">
      <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-neutral-900">
        Verify people, contacts, properties, and businesses
        <br className="hidden sm:block" /> from one simple search.
      </h1>
      <p className="mt-4 text-neutral-600 max-w-xl mx-auto">
        Search trusted public and commercial data sources without switching between multiple
        platforms.
      </p>

      <div className="mt-10">
        <SearchBox />
      </div>

      <p className="mt-8 text-xs text-neutral-500 max-w-md mx-auto">
        Every result shows its source and confidence level. Your searches are private, and you
        can delete your history at any time.
      </p>
    </div>
  );
}
