import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Swingscore</h1>
      <p className="mt-2 text-sm text-gray-600">Live scoring for West Coast Swing contests.</p>
      <Link href="/contests" className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 font-medium text-white">
        Organiser: open contests
      </Link>
    </main>
  );
}
