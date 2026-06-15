import { ExportWorkspace } from "@/components/workspaces/export-workspace";

export default async function ExportPage({ params }: { params: Promise<{ competitionId: string }> }) {
  const { competitionId } = await params;
  return <ExportWorkspace competitionId={competitionId} />;
}
