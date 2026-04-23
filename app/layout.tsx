import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSRG | Exotic Car Lifestyle | California",
  description:
    "SSRG is a premier car event and lifestyle group dedicated to bringing together car enthusiasts for unforgettable driving experiences and social gatherings.",
  icons: {
    icon: "/images/favicon.jpg",
  },
  openGraph: {
    title: "SSRG | Exotic Car Lifestyle | California",
    description:
      "Premier exotic car event and lifestyle group in California.",
    siteName: "SSRG Official",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-bg-deep text-text-primary">
        {children}
      </body>
    </html>
  );
}
