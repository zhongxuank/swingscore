import { ContestList } from "./contest-list";

export default function ContestsPage() {
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Contests</h1>
      <ContestList />
    </main>
  );
}
