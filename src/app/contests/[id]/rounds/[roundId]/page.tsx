import { RoundSetup } from "./round-setup";

export default async function RoundPage({ params }: { params: Promise<{ id: string; roundId: string }> }) {
  const { id, roundId } = await params;
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <RoundSetup contestId={id} roundId={roundId} />
    </main>
  );
}
