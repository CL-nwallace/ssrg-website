"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-serif mb-2">Something went wrong</h1>
        <p className="text-text-secondary mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="rounded bg-black px-4 py-2 text-white font-medium"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
