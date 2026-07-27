"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CATEGORY_CONFIG } from "@/lib/categories";

const COUNTRIES = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Burundi", "South Sudan"];

export function IngestionTrigger() {
  const [country, setCountry] = useState("Uganda");
  const [category, setCategory] = useState("HOTEL");
  const [running, setRunning] = useState(false);
  const router = useRouter();

  async function trigger() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/ingestion/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, category }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert("Couldn't start the batch. " + (e instanceof Error ? e.message : ""));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={country} onChange={(e) => setCountry(e.target.value)} className="w-36">
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
      </Select>
      <Button onClick={trigger} disabled={running} size="sm">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run batch
      </Button>
    </div>
  );
}
