import { safeNextPath } from "@/lib/safe-next";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Organiser sign-in</h1>
      <p className="mt-2 text-sm text-gray-600">
        Enter your email and we will send you a sign-in link. Open it on this device, in this browser.
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          That sign-in link did not work. It may have expired or been opened in another browser. Ask for a new one.
        </p>
      ) : null}
      <SignInForm next={safeNextPath(next)} />
    </main>
  );
}
