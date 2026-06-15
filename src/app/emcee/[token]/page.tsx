import { EmceeWorkspace } from "@/components/workspaces/emcee-workspace";

export default async function EmceePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EmceeWorkspace token={token} />;
}
