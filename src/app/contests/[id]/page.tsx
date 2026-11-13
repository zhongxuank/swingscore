import { ContestDetail } from "./contest-detail";

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <ContestDetail contestId={id} />
    </main>
  );
}
