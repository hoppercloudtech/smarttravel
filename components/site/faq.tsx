"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqSection({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="faq-heading" className="space-y-3">
      <h2 id="faq-heading" className="font-display text-2xl">Frequently asked questions</h2>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface">
        {items.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={i}>
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium"
                aria-expanded={open}
              >
                {item.question}
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
              </button>
              {open && <p className="px-5 pb-4 text-sm text-muted">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
