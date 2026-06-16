import type { Metadata } from "next";
import { Cormorant, Montserrat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SSRG | Exotic Car Lifestyle | California",
  description:
    "SSRG is a premier car event and lifestyle group dedicated to bringing together car enthusiasts for unforgettable driving experiences and social gatherings.",
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
    <html lang="en" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="font-sans antialiased bg-bg-deep text-text-primary">
        {children}
      </body>
    </html>
  );
}
