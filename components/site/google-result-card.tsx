import { ExternalLink } from "lucide-react";

export type GoogleResultData = {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    attribution: { text: string; mapsUri?: string };
};

// Deliberately does NOT link to an internal HorizonSpot page — there isn't
// one yet. Links out to Google Maps directly, per attribution requirements,
// and makes clear this isn't yet a HorizonSpot listing.
export function GoogleResultCard({ place }: { place: GoogleResultData }) {
    return (
        <div className="rounded-lg border border-dashed border-border bg-surface/50 p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted mb-1">Not yet on HorizonSpot</p>
                <h3 className="font-medium text-sm truncate">{place.displayName?.text}</h3>
                {place.formattedAddress && <p className="text-xs text-muted mt-0.5">{place.formattedAddress}</p>}
                {place.rating && (
                    <p className="text-xs text-muted mt-1">
                        {place.rating.toFixed(1)} ★ {place.userRatingCount ? `(${place.userRatingCount})` : ""}
                    </p>
                )}
                <p className="text-[11px] text-muted mt-2">{place.attribution.text}</p>
            </div>
            {place.attribution.mapsUri && (

             <a href   = { place.attribution.mapsUri }
          target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-xs text-gold-soft hover:underline whitespace-nowrap"
        >
            View on Google Maps <ExternalLink className="h-3 w-3" />
        </a>
    )
}
    </div >
  );
}