import { prisma } from "@/lib/prisma";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IngestionTrigger } from "@/components/admin/ingestion-trigger";

export default async function IngestionPage() {
  const batches = await prisma.ingestionBatch.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  const statusTone = { SUCCEEDED: "teal", RUNNING: "gold", PARTIAL: "clay", FAILED: "clay" } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Ingestion pipeline</h1>
          <p className="text-sm text-muted mt-1">
            Scheduled batches that discover, normalize, and publish places before anyone searches for them.
          </p>
        </div>
        <IngestionTrigger />
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Batch</Th>
            <Th>Status</Th>
            <Th>Found</Th>
            <Th>Inserted</Th>
            <Th>Updated</Th>
            <Th>Skipped</Th>
            <Th>Failed</Th>
            <Th>Started</Th>
          </tr>
        </Thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <Td className="font-medium">{b.label}</Td>
              <Td><Badge tone={statusTone[b.status]}>{b.status}</Badge></Td>
              <Td>{b.totalFound}</Td>
              <Td>{b.totalInserted}</Td>
              <Td>{b.totalUpdated}</Td>
              <Td>{b.totalSkipped}</Td>
              <Td className={b.totalFailed > 0 ? "text-clay" : undefined}>{b.totalFailed}</Td>
              <Td className="text-muted">{b.startedAt.toLocaleString()}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {batches.length === 0 && (
        <p className="text-sm text-muted">
          No ingestion runs yet. Batches run nightly via Vercel Cron, or trigger one manually above.
        </p>
      )}
    </div>
  );
}
