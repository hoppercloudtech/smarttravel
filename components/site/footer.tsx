import Link from "next/link";

const COUNTRIES = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Burundi", "South Sudan"];

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="container py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <div className="font-display text-lg mb-3">
            Smart<span className="text-gold">Travel</span>
          </div>
          <p className="text-sm text-muted max-w-xs">
            An independent guide to hotels, restaurants, stays and attractions across East Africa —
            built from original research, not reviews.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-3">Countries</div>
          <ul className="space-y-2 text-sm">
            {COUNTRIES.map((c) => (
              <li key={c}>
                <Link href={`/country/${c.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-gold transition-colors">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-3">Categories</div>
          <ul className="space-y-2 text-sm">
            <li><Link href="/hotel" className="hover:text-gold transition-colors">Hotels</Link></li>
            <li><Link href="/restaurant" className="hover:text-gold transition-colors">Restaurants</Link></li>
            <li><Link href="/attraction" className="hover:text-gold transition-colors">Attractions</Link></li>
          </ul>
        </div>
      </div>
      <div className="route-divider container" />
      <div className="container py-6 text-xs text-muted flex justify-between">
        <span>© {new Date().getFullYear()} SmartTravel</span>
        <span>Made for East Africa</span>
      </div>
    </footer>
  );
}
