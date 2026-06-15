import { ChiefWorkspace } from "@/components/workspaces/chief-workspace";

export default async function ChiefPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ChiefWorkspace token={token} />;
}
