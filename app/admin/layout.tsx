import type { ReactNode } from "react";

/**
 * Admin section uses its own bare layout — no public Navbar/Footer.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
