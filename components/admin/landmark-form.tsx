"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LandmarkForm({ countries }: { countries: { id: string; name: string }[] }) {
    const [name, setName] = useState("");
    const [type, setType] = useState("airport");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [countryId, setCountryId] = useState(countries[0]?.id ?? "");
    const [radiusKm, setRadiusKm] = useState("10");
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    async function save() {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/landmarks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, type, latitude: Number(latitude), longitude: Number(longitude), countryId, radiusKm: Number(radiusKm) }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Save failed.");
            setName(""); setLatitude(""); setLongitude("");
            router.refresh();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rounded-md border border-border bg-surface p-4 grid sm:grid-cols-5 gap-3 items-end">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Entebbe Airport" /></div>
            <div className="space-y-1"><Label>Type</Label><Select value={type} onChange={(e) => setType(e.target.value)}><option value="airport">Airport</option><option value="attraction">Attraction</option><option value="transit_hub">Transit hub</option><option value="other">Other</option></Select></div>
            <div className="space-y-1"><Label>Latitude</Label><Input value={latitude} onChange={(e) => setLatitude(e.target.value)} /></div>
            <div className="space-y-1"><Label>Longitude</Label><Input value={longitude} onChange={(e) => setLongitude(e.target.value)} /></div>
            <div className="space-y-1"><Label>Country</Label><Select value={countryId} onChange={(e) => setCountryId(e.target.value)}>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
            <div className="sm:col-span-5"><Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add landmark</Button></div>
        </div>
    );
}