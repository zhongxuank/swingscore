import { JudgeWorkspace } from "@/components/workspaces/judge-workspace";

export default async function JudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JudgeWorkspace token={token} />;
}
