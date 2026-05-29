import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-lg text-center">
        <h1 className="font-serif text-4xl mb-4">Thanks for registering</h1>
        <p className="text-text-secondary mb-8">
          A receipt from Stripe is on its way to your inbox. If you need to update your
          car or contact info, reply to that email and we&apos;ll sort it out.
        </p>
        {sessionId ? (
          <p className="text-xs text-text-muted mb-8">Reference: {sessionId}</p>
        ) : null}
        <Link
          href="/events"
          className="inline-block rounded bg-black text-white px-6 py-3 font-medium"
        >
          Back to events
        </Link>
      </div>
    </main>
  );
}
