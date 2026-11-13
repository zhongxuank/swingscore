import Link from "next/link";

export function OrganiserHeader({ email }: { email: string | undefined }) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 text-sm">
      <Link href="/contests" className="font-semibold">
        Swingscore
      </Link>
      <form action="/auth/sign-out" method="post" className="flex items-center gap-3">
        {email ? <span className="hidden text-gray-600 sm:inline">{email}</span> : null}
        <button type="submit" className="rounded border border-gray-300 px-3 py-1">
          Sign out
        </button>
      </form>
    </header>
  );
}
