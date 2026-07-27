import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "gold" | "teal" | "muted" | "clay";
const tones: Record<Tone, string> = {
  gold: "bg-gold/15 text-gold-soft border-gold/30",
  teal: "bg-teal/15 text-teal border-teal/30",
  muted: "bg-surface-raised text-muted border-border",
  clay: "bg-clay/15 text-clay border-clay/30",
};

export function Badge({ className, tone = "muted", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
