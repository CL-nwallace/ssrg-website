import type { ReactNode } from "react";

/**
 * Admin section uses its own bare layout — no public Navbar/Footer — and
 * forces a light background + dark text so form inputs don't inherit the
 * site's dark-theme white text color (which would make typed text invisible
 * against an input's default white background).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-white text-gray-900">{children}</div>;
}
