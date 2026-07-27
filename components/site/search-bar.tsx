"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = { id: string; name: string; slug: string; category: string };

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setOpen(true);
      }
    }, 250); // debounce so autocomplete doesn't fire on every keystroke
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        ref={containerRef}
        className={cn(
          "relative flex w-full items-center gap-2 rounded-md border border-border bg-surface px-3",
          compact ? "h-9" : "h-12"
        )}
      >
        <Search className="h-4 w-4 text-muted shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              router.push(`/search?q=${encodeURIComponent(query)}`);
              setOpen(false);
            }
          }}
          placeholder="Search hotels, restaurants, attractions…"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted focus:outline-none"
          aria-label="Search places"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-2 w-full rounded-md border border-border bg-surface-raised shadow-panel overflow-hidden">
          {results.map((r) => (
            <li key={r.id}>
              <a
                href={`/${r.category.toLowerCase().replace("_", "-")}/${r.slug}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-background transition-colors"
              >
                <span>{r.name}</span>
                <span className="text-xs text-muted uppercase">{r.category.replace("_", " ")}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
