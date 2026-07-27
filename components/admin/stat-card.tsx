import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label, value, icon: Icon, tone = "gold",
}: { label: string; value: string | number; icon: LucideIcon; tone?: "gold" | "teal" | "clay" }) {
  const toneClass = { gold: "text-gold", teal: "text-teal", clay: "text-clay" }[tone];
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-1">{label}</div>
          <div className="font-display text-2xl">{value}</div>
        </div>
        <Icon className={cn("h-6 w-6", toneClass)} />
      </CardContent>
    </Card>
  );
}
