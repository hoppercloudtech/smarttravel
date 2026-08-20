"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Settings = {
    dailyPostCount: number;
    minHotelPostsPerDay: number;
    autoPublish: boolean;
    approvalRequired: boolean;
    cooldownDays: number;
    postingTimezone: string;
    postingWindows: string[];
    hashtagBaseTags: string[];
    ctaVariants: string[];
};

export function TikTokSettingsForm({ initial }: { initial: Settings }) {
    const [values, setValues] = useState(initial);
    const [windowsText, setWindowsText] = useState(initial.postingWindows.join(", "));
    const [tagsText, setTagsText] = useState(initial.hashtagBaseTags.join(", "));
    const [ctaText, setCtaText] = useState(initial.ctaVariants.join("\n"));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const router = useRouter();

    function update<K extends keyof Settings>(key: K, val: Settings[K]) {
        setValues((v) => ({ ...v, [key]: val }));
    }

    async function save() {
        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                ...values,
                postingWindows: windowsText.split(",").map((s) => s.trim()).filter(Boolean),
                hashtagBaseTags: tagsText.split(",").map((s) => s.trim()).filter(Boolean),
                ctaVariants: ctaText.split("\n").map((s) => s.trim()).filter(Boolean),
            };
            const res = await fetch("/api/admin/tiktok/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Save failed.");
            setMessage("Saved.");
            router.refresh();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <Card>
                <CardHeader><CardTitle>Volume & priority</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="dailyPostCount">Posts per day</Label>
                        <Input id="dailyPostCount" type="number" min={1} value={values.dailyPostCount} onChange={(e) => update("dailyPostCount", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="minHotelPostsPerDay">Minimum hotel/accommodation posts per day</Label>
                        <Input id="minHotelPostsPerDay" type="number" min={0} value={values.minHotelPostsPerDay} onChange={(e) => update("minHotelPostsPerDay", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="cooldownDays">Repost cooldown (days)</Label>
                        <Input id="cooldownDays" type="number" min={0} value={values.cooldownDays} onChange={(e) => update("cooldownDays", Number(e.target.value))} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Publishing mode</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" checked={values.approvalRequired} onChange={(e) => update("approvalRequired", e.target.checked)} className="h-4 w-4" />
                        Require admin approval before a post becomes schedulable
                    </label>
                    <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" checked={values.autoPublish} onChange={(e) => update("autoPublish", e.target.checked)} className="h-4 w-4" />
                        Automatic publishing — scheduled posts publish themselves when due, no manual click needed
                    </label>
                    <p className="text-xs text-muted">
                        With both on: posts need your approval first, then publish automatically once approved and due.
                        With approval off and auto-publish on: the full "Mode A" hands-off flow from the brief. With
                        auto-publish off: posts wait for a manual "Publish now" click regardless of approval status.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="postingTimezone">Timezone (IANA, e.g. UTC, Africa/Kampala, America/New_York)</Label>
                        <Input id="postingTimezone" value={values.postingTimezone} onChange={(e) => update("postingTimezone", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="postingWindows">Posting windows (24h HH:mm, comma separated)</Label>
                        <Input id="postingWindows" value={windowsText} onChange={(e) => setWindowsText(e.target.value)} placeholder="08:00, 11:00, 14:00, 18:00, 21:00" />
                        <p className="text-xs text-muted">If this doesn't match "posts per day", times are spread evenly across the earliest–latest window instead.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Hashtags & calls-to-action</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="tagsText">Base hashtags (comma separated — always considered, not always used)</Label>
                        <Input id="tagsText" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ctaText">CTA variants (one per line — rotated across posts)</Label>
                        <textarea
                            id="ctaText"
                            value={ctaText}
                            onChange={(e) => setCtaText(e.target.value)}
                            rows={4}
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3">
                <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save settings
                </Button>
                {message && <span className="text-sm text-muted">{message}</span>}
            </div>
        </div>
    );
}