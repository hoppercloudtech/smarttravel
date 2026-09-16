import { prisma } from "@/lib/prisma";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { LandmarkForm } from "@/components/admin/landmark-form";
import { DeleteLandmarkButton } from "@/components/admin/delete-landmark-button";

export default async function LandmarksAdmin() {
    const [landmarks, countries] = await Promise.all([
        prisma.landmark.findMany({ include: { country: true, city: true }, orderBy: { name: "asc" } }),
        prisma.country.findMany({ orderBy: { name: "asc" } }),
    ]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-display text-2xl">Landmarks</h1>
                <p className="text-sm text-muted mt-1">Airports, attractions, and other reference points that power "near X" discovery pages.</p>
            </div>
            <LandmarkForm countries={countries} />
            <Table>
                <Thead><tr><Th>Name</Th><Th>Type</Th><Th>Location</Th><Th>Radius</Th><Th>Action</Th></tr></Thead>
                <tbody>
                    {landmarks.map((l) => (
                        <tr key={l.id}>
                            <Td>{l.name}</Td>
                            <Td>{l.type}</Td>
                            <Td>{[l.city?.name, l.country.name].filter(Boolean).join(", ")}</Td>
                            <Td>{l.radiusKm} km</Td>
                            <Td>
                                <DeleteLandmarkButton id={l.id} />
                            </Td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
}