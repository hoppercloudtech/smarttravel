"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_CONFIG } from "@/lib/categories";

export type Candidate = {
    id: string;
    displayNameRaw: string;
    categoryGuess: string | null;
    latitude: number;
    longitude: number;
    source: string;
    provider: string;
    regionKey: string | null;
    discoveredAt: string;
};

export function GoogleCandidateCard({ candidate, countries }: { candidate: Candidate; countries: { id: string; name: string }[] }) {
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState(candidate.displayNameRaw);
    const [category, setCategory] = useState(candidate.categoryGuess ?? "HOTEL");
    const [countryId, setCountryId] = useState(countries[0]?.id ?? "");
    const [district, setDistrict] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const router = useRouter();

    async function promote() {
        setBusy("promote");
        try {
            const res = await fetch(`/api/admin/google-candidates/${candidate.id}/promote`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, category, countryId, district: district || undefined }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Promote failed.");
            router.refresh();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Promote failed.");
        } finally {
            setBusy(null);
        }
    }

    async function reject() {
        setBusy("reject");
        try {
            const res = await fetch(`/api/admin/google-candidates/${candidate.id}/reject`, { method: "POST" });
            if (!res.ok) throw new Error((await res.json()).error || "Reject failed.");
            router.refresh();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Reject failed.");
        } finally {
            setBusy(null);
        }
    }

    return (
        <Card>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-medium text-sm">{candidate.displayNameRaw}</div>
                        <div className="text-xs text-muted mt-0.5">
                            {candidate.latitude.toFixed(4)}, {candidate.longitude.toFixed(4)} · {candidate.source}
                            {candidate.regionKey && ` · ${candidate.regionKey}`}
                        </div>
                    </div>
                              {/* <div className="flex gap-1.5">
                      <Badge tone={candidate.provider === "geoapify" ? "teal" : "gold"}>{candidate.provider}</Badge> </div> */}
                        <div className="flex gap-1.5">
                            <Badge tone={candidate.provider === "geoapify" ? "teal" : "gold"}>{candidate.provider}</Badge>
                            {candidate.categoryGuess && <Badge tone="gold">{CATEGORY_CONFIG[candidate.categoryGuess as keyof typeof CATEGORY_CONFIG]?.label ?? candidate.categoryGuess}</Badge>}
                        </div>
                    </div>

                {!expanded ? (
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setExpanded(true)}>
                            <Check className="h-3.5 w-3.5" /> Review & promote
                        </Button>
                        <Button size="sm" variant="outline" onClick={reject} disabled={!!busy}>
                            {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Reject
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3 border-t border-border pt-3">
                        <p className="text-xs text-muted">
                            Confirm or correct these details before publishing — this becomes HorizonSpot's own listing, not a copy of Google's data.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1 sm:col-span-2">
                                <Label htmlFor={`name-${candidate.id}`}>Name</Label>
                                <Input id={`name-${candidate.id}`} value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`category-${candidate.id}`}>Category</Label>
                                <Select id={`category-${candidate.id}`} value={category} onChange={(e) => setCategory(e.target.value)}>
                                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`country-${candidate.id}`}>Country</Label>
                                <Select id={`country-${candidate.id}`} value={countryId} onChange={(e) => setCountryId(e.target.value)}>
                                    {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                                <Label htmlFor={`district-${candidate.id}`}>District / area (optional)</Label>
                                <Input id={`district-${candidate.id}`} value={district} onChange={(e) => setDistrict(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={promote} disabled={!!busy}>
                                {busy === "promote" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Create as draft place
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>Cancel</Button>
                        </div>
                        <p className="text-xs text-muted">
                            Creates a <strong>draft</strong> — you'll still add photos, amenities, and generate an AI summary
                            in the normal place editor before publishing it.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}