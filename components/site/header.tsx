import Link from "next/link";
import { SearchBar } from "@/components/site/search-bar";

const CATEGORY_LINKS = [
  { href: "/hotel", label: "Hotels" },
  { href: "/restaurant", label: "Restaurants" },
  { href: "/airbnb", label: "Airbnbs" },
  { href: "/attraction", label: "Attractions" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-display text-xl tracking-tight shrink-0">
          Horizon<span className="text-gold">Spot</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
          {CATEGORY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 max-w-sm hidden sm:block">
          <SearchBar compact />
        </div>
      </div>
    </header>
  );
}
