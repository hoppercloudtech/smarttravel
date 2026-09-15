import { prisma } from "@/lib/prisma";
import { GoogleCandidateCard } from "@/components/admin/google-candidate-card";
import { GoogleDiscoveryTrigger } from "@/components/admin/google-discovery-trigger";

export default async function GoogleDiscoveryPage() {
    const [candidates, countries] = await Promise.all([
        prisma.googlePlaceCandidate.findMany({
            where: { status: "NEW" },
            orderBy: { discoveredAt: "desc" },
            take: 100,
        }),
        prisma.country.findMany({ orderBy: { name: "asc" } }),
    ]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-display text-2xl">Google Places Discovery</h1>
                <p className="text-sm text-muted mt-1">
                    Places Google found that aren't on HorizonSpot yet. Nothing here is published automatically — review
                    and confirm each one before it becomes a real listing.
                </p>
            </div>
            <div className="rounded-md border border-border bg-surface-raised px-4 py-3 text-xs text-muted">
                Primary provider: <strong className="text-foreground">Google Places</strong> · Fallback: <strong className="text-foreground">Geoapify</strong> (used automatically when Google fails or returns nothing)
            </div>

            <div className="rounded-md border border-border bg-surface p-4">
                <GoogleDiscoveryTrigger />
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
                    Pending review ({candidates.length})
                </h2>
                {candidates.length === 0 && (
                    <p className="text-sm text-muted">Nothing waiting right now — run a discovery batch above, or wait for the scheduled sweep.</p>
                )}
                <div className="space-y-3">
                    {candidates.map((c) => (
                        <GoogleCandidateCard
                            key={c.id}
                            candidate={{
                                id: c.id,
                                displayNameRaw: c.displayNameRaw,
                                categoryGuess: c.categoryGuess,
                                latitude: c.latitude,
                                longitude: c.longitude,
                                source: c.source,
                                regionKey: c.regionKey,
                                provider: c.provider,
                                discoveredAt: c.discoveredAt.toISOString(),
                            }}
                            countries={countries}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}