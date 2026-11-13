"use client";

import { useState, type FormEvent } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setState({ kind: "sending" });
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error } = await browserSupabase().auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: callback.toString() }
    });
    setState(error ? { kind: "error", message: error.message } : { kind: "sent", email: address });
  }

  if (state.kind === "sent") {
    return (
      <p role="status" className="mt-6 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
        Check {state.email} for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2"
      />
      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="w-full rounded bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {state.kind === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
