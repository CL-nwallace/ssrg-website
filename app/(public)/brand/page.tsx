import type { Metadata } from "next";
import LogoBlock from "./_components/LogoBlock";
import ColorSwatches from "./_components/ColorSwatches";
import TypeSpecimen from "./_components/TypeSpecimen";
import VoiceTone from "./_components/VoiceTone";
import ComponentSamples from "./_components/ComponentSamples";
import MerchBlock from "./_components/MerchBlock";
import IconBlock from "./_components/IconBlock";

export const metadata: Metadata = {
  title: "SSRG Brand Guide",
  robots: { index: false, follow: false },
};

export default function BrandPage() {
  return (
    <>
      {/* Page header */}
      <header className="py-20 md:py-28 border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6">
          <div className="gold-line mb-6" />
          <h1 className="font-serif font-semibold text-hero text-text-primary">
            SSRG Brand Guide
          </h1>
          <p className="mt-4 text-large text-text-secondary max-w-2xl">
            A living reference for the SSRG visual identity — colors, type,
            voice, and components, sourced directly from the design tokens in
            the codebase.
          </p>
        </div>
      </header>

      {/* Sections */}
      <LogoBlock />
      <ColorSwatches />
      <TypeSpecimen />
      <VoiceTone />
      <ComponentSamples />
      <MerchBlock />
      <IconBlock />
    </>
  );
}
