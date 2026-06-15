import { AdminWorkspace } from "@/components/workspaces/admin-workspace";

export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminWorkspace competitionId={id} />;
}
