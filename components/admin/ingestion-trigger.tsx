"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, MapPin, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { REGIONS } from "@/lib/regions";
import { cn } from "@/lib/utils";

type Mode = "preset" | "custom";

export function IngestionTrigger() {
  const [mode, setMode] = useState<Mode>("preset");
  const [regionKey, setRegionKey] = useState(REGIONS[0]?.key ?? "kampala");
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("Uganda");
  const [category, setCategory] = useState("HOTEL");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function trigger() {
    if (mode === "custom" && !district.trim()) {
      setError("Enter a district or area name first.");
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const body =
        mode === "preset"
          ? { regionKey, category }
          : { district: district.trim(), country: country.trim(), category };

      const res = await fetch("/api/admin/ingestion/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start the batch.");

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the batch.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 border transition-colors",
            mode === "preset" ? "border-gold bg-gold/10 text-gold-soft" : "border-border text-muted hover:text-foreground"
          )}
        >
          <List className="h-3.5 w-3.5" /> Preset region
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 border transition-colors",
            mode === "custom" ? "border-gold bg-gold/10 text-gold-soft" : "border-border text-muted hover:text-foreground"
          )}
        >
          <MapPin className="h-3.5 w-3.5" /> Any district / area
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "preset" ? (
          <Select value={regionKey} onChange={(e) => setRegionKey(e.target.value)} className="w-40">
            {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        ) : (
          <>
            <Input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="District or area, e.g. Mbale"
              className="w-48"
            />
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              className="w-36"
            />
          </>
        )}

        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
        </Select>

        <Button onClick={trigger} disabled={running} size="sm">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run batch
        </Button>
      </div>

      {mode === "custom" && (
        <p className="text-xs text-muted">
          Looked up automatically via OpenStreetMap's geocoder — works for any real district, town, or
          neighborhood name. If the name is too broad (matches a whole region or country), the batch will
          refuse to run rather than risk the same timeout your original whole-country query hit.
        </p>
      )}

      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}