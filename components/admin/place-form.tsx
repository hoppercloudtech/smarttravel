"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, Upload, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_CONFIG } from "@/lib/categories";

export type PlaceFormValues = {
  id?: string;
  name: string;
  category: string;
  countryId: string;
  cityId?: string | null;
  district?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  amenities?: string[];
  description?: string | null;
  status: string;
  featured?: boolean;
};

type MediaItem = { id: string; url: string; isHero: boolean };
type Country = { id: string; name: string };

export function PlaceForm({
  initial,
  countries,
  initialMedia = [],
  initialSummary,
}: {
  initial?: Partial<PlaceFormValues>;
  countries: Country[];
  initialMedia?: MediaItem[];
  initialSummary?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PlaceFormValues>({
    name: initial?.name ?? "",
    category: initial?.category ?? "HOTEL",
    countryId: initial?.countryId ?? countries[0]?.id ?? "",
    cityId: initial?.cityId ?? "",
    district: initial?.district ?? "",
    address: initial?.address ?? "",
    latitude: initial?.latitude ?? undefined,
    longitude: initial?.longitude ?? undefined,
    googleMapsUrl: initial?.googleMapsUrl ?? "",
    website: initial?.website ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    amenities: initial?.amenities ?? [],
    description: initial?.description ?? "",
    status: initial?.status ?? "DRAFT",
    featured: initial?.featured ?? false,
    id: initial?.id,
  });
  const [amenitiesText, setAmenitiesText] = useState((initial?.amenities ?? []).join(", "));
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [deletingPlace, setDeletingPlace] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const isEdit = Boolean(values.id);

  function update<K extends keyof PlaceFormValues>(key: K, val: PlaceFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...values,
        amenities: amenitiesText.split(",").map((a) => a.trim()).filter(Boolean),
      };
      const res = await fetch(isEdit ? `/api/admin/places/${values.id}` : "/api/admin/places", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/admin/places/${data.id}`);
      router.refresh();
    } catch (e) {
      alert("Couldn't save this place. " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);

    if (files.length === 0 || !values.id) {
      if (!values.id) {
        alert("Save the place first, then upload photos.");
      }
      return;
    }

    setUploading(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("placeId", values.id);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = await res.json();

        setMedia((m) => [...m, data.media]);
      }
    } catch (err) {
      alert(
        "One or more uploads failed. " +
        (err instanceof Error ? err.message : "")
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    if (!confirm("Remove this photo? This can't be undone.")) return;
    setDeletingMediaId(mediaId);
    try {
      const res = await fetch(`/api/admin/media/${mediaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setMedia((m) => {
        const remaining = m.filter((item) => item.id !== mediaId);
        // Mirror the server's hero-promotion logic locally so the UI updates
        // instantly without waiting for a full page refresh.
        const removed = m.find((item) => item.id === mediaId);
        if (removed?.isHero && remaining.length > 0 && !remaining.some((r) => r.isHero)) {
          remaining[0] = { ...remaining[0], isHero: true };
        }
        return remaining;
      });
    } catch (err) {
      alert("Couldn't remove that photo. " + (err instanceof Error ? err.message : ""));
    } finally {
      setDeletingMediaId(null);
    }
  }

  async function handleDeletePlace() {
    if (!values.id) return;
    if (!confirm(`Delete "${values.name}" permanently? This removes the place, its photos, and its AI summary. This can't be undone.`)) {
      return;
    }
    setDeletingPlace(true);
    try {
      const res = await fetch(`/api/admin/places/${values.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.push("/admin/places");
      router.refresh();
    } catch (err) {
      alert("Couldn't delete this place. " + (err instanceof Error ? err.message : ""));
      setDeletingPlace(false);
    }
  }

  async function handleGenerateAi() {
    if (!values.id) {
      alert("Save the place first, then generate the AI summary.");
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await fetch("/api/admin/ai/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: values.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSummary(data.content);
    } catch (err) {
      alert("AI generation failed. " + (err instanceof Error ? err.message : ""));
    } finally {
      setGeneratingAi(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Place name</Label>
              <Input id="name" value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="Speke Resort Munyonyo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={values.category} onChange={(e) => update("category", e.target.value)}>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={values.status} onChange={(e) => update("status", e.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Select id="country" value={values.countryId} onChange={(e) => update("countryId", e.target.value)}>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="district">District / area</Label>
              <Input id="district" value={values.district ?? ""} onChange={(e) => update("district", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={values.address ?? ""} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" type="number" step="any" value={values.latitude ?? ""} onChange={(e) => update("latitude", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude</Label>
              <Input id="lng" type="number" step="any" value={values.longitude ?? ""} onChange={(e) => update("longitude", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={values.website ?? ""} onChange={(e) => update("website", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={values.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mapsUrl">Google Maps URL</Label>
              <Input id="mapsUrl" value={values.googleMapsUrl ?? ""} onChange={(e) => update("googleMapsUrl", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="amenities">Amenities (comma separated)</Label>
              <Input id="amenities" value={amenitiesText} onChange={(e) => setAmenitiesText(e.target.value)} placeholder="Free WiFi, Pool, Airport Shuttle" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Source facts / description (used to generate the AI summary — not shown verbatim)</Label>
              <Textarea id="description" value={values.description ?? ""} onChange={(e) => update("description", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Create place"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <h3 className="font-display text-lg">Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <div key={m.id} className="group relative aspect-square rounded-md overflow-hidden bg-surface-raised">
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                  {m.isHero && <Badge tone="gold" className="absolute top-1 left-1 text-[10px]">Hero</Badge>}
                  <button
                    type="button"
                    onClick={() => handleDeleteMedia(m.id)}
                    disabled={deletingMediaId === m.id}
                    aria-label="Remove photo"
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-clay/90"
                  >
                    {deletingMediaId === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-sm text-muted cursor-pointer hover:border-gold/50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload photo"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </label>
            {!isEdit && <p className="text-xs text-muted">Save the place first to enable photo uploads.</p>}
            {media.length > 0 && <p className="text-xs text-muted">Hover a photo to remove it — useful if an upload doesn't actually match the place.</p>}
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">AI summary</h3>
              <Button size="sm" variant="secondary" onClick={handleGenerateAi} disabled={generatingAi}>
                {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {summary ? "Regenerate" : "Generate"}
              </Button>
            </div>
            <p className="text-sm text-muted whitespace-pre-line">
              {summary || "No summary generated yet. Fill in the description and amenities first for the best result."}
            </p>
          </div>
        </div>
      </div>

      {isEdit && (
        <div className="rounded-lg border border-clay/30 bg-clay/5 p-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-clay">Danger zone</h3>
            <p className="text-sm text-muted mt-1">
              Permanently deletes this place, its photos (from Cloudinary too), and its AI summary history.
            </p>
          </div>
          <Button variant="danger" onClick={handleDeletePlace} disabled={deletingPlace}>
            {deletingPlace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete this place
          </Button>
        </div>
      )}
    </div>
  );
}