"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signInWithPassword } from "./actions";

export const dynamic = "force-dynamic";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded bg-black px-4 py-3 text-white font-medium disabled:opacity-50"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const [state, formAction] = useFormState(signInWithPassword, null);
  const notAuthorized = searchParams.error === "not_authorized";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form action={formAction} className="max-w-md w-full">
        <h1 className="text-2xl font-serif mb-2">SSRG admin</h1>
        <p className="text-text-secondary mb-6">
          Sign in with the email and password the board has on file.
        </p>

        {notAuthorized && (
          <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
            That email is not on the admin list. Contact the board if this looks
            wrong.
          </p>
        )}

        {state && (
          <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
            {state.error}
          </p>
        )}

        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block mt-4">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <SubmitButton />

        <p className="mt-6 text-xs text-text-muted">
          Forgot your password? Contact Nico to have it reset.
        </p>
      </form>
    </main>
  );
}
