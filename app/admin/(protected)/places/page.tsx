import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_CONFIG } from "@/lib/categories";

export default async function AdminPlacesListPage() {
  const places = await prisma.place.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { country: true, city: true },
  });

  const statusTone = { PUBLISHED: "teal", DRAFT: "muted", NEEDS_REVIEW: "clay", ARCHIVED: "muted" } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Places</h1>
          <p className="text-sm text-muted mt-1">{places.length} total</p>
        </div>
        <Link href="/admin/places/new">
          <Button><Plus className="h-4 w-4" /> Add place</Button>
        </Link>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Category</Th>
            <Th>Location</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
          </tr>
        </Thead>
        <tbody>
          {places.map((p) => (
            <tr key={p.id} className="hover:bg-surface-raised/50">
              <Td>
                <Link href={`/admin/places/${p.id}`} className="hover:text-gold-soft font-medium">{p.name}</Link>
              </Td>
              <Td>{CATEGORY_CONFIG[p.category].label}</Td>
              <Td className="text-muted">{[p.city?.name, p.country.name].filter(Boolean).join(", ")}</Td>
              <Td><Badge tone={statusTone[p.status]}>{p.status.replace("_", " ")}</Badge></Td>
              <Td className="text-muted">{p.updatedAt.toLocaleDateString()}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {places.length === 0 && <p className="text-sm text-muted">No places yet — add your first one to get started.</p>}
    </div>
  );
}
