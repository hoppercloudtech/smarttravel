import type { PlaceCategory } from "@prisma/client";

import type { RawPlaceCandidate, PlaceSourceAdapter } from "../ingest";
import { discoverPlaces } from "@/lib/overpass";

export const overpassAdapter: PlaceSourceAdapter = {
    name: "overpass",

    async discover(opts): Promise<RawPlaceCandidate[]> {
        const { region, category, limit } = opts;

        // Call your lib/overpass.ts helper
        const osmResults = await discoverPlaces(region, category, limit);

        // Map OSM results into RawPlaceCandidate objects
        return osmResults.map((osm: any) => {
            return {
                name: osm.tags?.name ?? "Unnamed",
                category,
                countryName: region.country,
                cityName: osm.tags?.["addr:city"],
                district: osm.tags?.["addr:district"],
                address: osm.tags?.["addr:street"],
                latitude: osm.lat,
                longitude: osm.lon,
                website: osm.tags?.website,
                phone: osm.tags?.phone,
                email: osm.tags?.email,
                amenities: osm.tags?.amenities
                    ? osm.tags.amenities.split(",")
                    : [],
                description: osm.tags?.description,
                sourceRef: `osm-${osm.id}`,
                imageUrls: [],
            } 
        });
    },
};