import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireAdmin();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-gray-200 p-6 flex flex-col">
        <h1 className="text-lg font-serif mb-6">SSRG admin</h1>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/admin/events" className="hover:underline">Events</Link>
          <Link href="/admin/media" className="hover:underline">Media</Link>
          <Link href="/admin/audit" className="hover:underline">Audit log</Link>
        </nav>
        <div className="mt-auto text-sm">
          <p className="text-text-secondary mb-2">{email}</p>
          <form action="/admin/logout" method="post">
            <button type="submit" className="text-red-700 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
