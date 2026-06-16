import Image from "next/image";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

const DO_LIST = [
  "Use the white wordmark on dark (near-black) backgrounds.",
  "Maintain clear space equal to the cap-height of the S on all sides.",
  "Scale proportionally — never distort the aspect ratio.",
  "Use the supplied PNG at 2× or higher for digital; vector for print.",
];

const DONT_LIST = [
  "Do not recolor the wordmark (no gold, no grey, no gradients).",
  "Do not stretch or compress the mark.",
  "Do not rotate or skew.",
  "Do not place on busy, patterned, or low-contrast backgrounds.",
  "Do not add drop shadows, outlines, or other effects.",
];

export default function LogoBlock() {
  return (
    <section className="py-20 md:py-28" aria-labelledby="logo-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="logo-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            Logo
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            The SSRG wordmark is the primary brand identifier. Use it
            consistently to build recognition and trust across all touchpoints.
          </p>
        </div>

        {/* Logo display panel */}
        <div className="bg-bg-elevated border border-subtle rounded-lg p-12 flex items-center justify-center mb-10">
          <Image
            src="/images/ssrg-logo.png"
            alt="SSRG wordmark — white on dark background"
            width={264}
            height={93}
            className="w-full max-w-xs"
            priority
          />
        </div>

        {/* Minimum size + clear space note */}
        <div className="mb-10 p-6 bg-bg-surface border border-subtle rounded-lg">
          <p className="text-small text-text-secondary uppercase tracking-widest mb-3 font-semibold">
            Usage Rules
          </p>
          <ul className="space-y-1 text-body text-text-secondary">
            <li>
              <span className="text-text-primary font-medium">Minimum digital size:</span> 120 px wide
            </li>
            <li>
              <span className="text-text-primary font-medium">Minimum print size:</span> 1.5 in wide
            </li>
            <li>
              <span className="text-text-primary font-medium">Clear space:</span> equal to the cap-height of the &ldquo;S&rdquo; on all four sides
            </li>
            <li>
              <span className="text-text-primary font-medium">Color:</span> white on dark backgrounds only (see Merch section for light-background variant)
            </li>
          </ul>
        </div>

        {/* Do / Don't */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-bg-elevated border border-subtle rounded-lg p-6">
            <p className="text-small text-text-secondary uppercase tracking-widest mb-4 font-semibold">
              Do
            </p>
            <ul className="space-y-3">
              {DO_LIST.map((item) => (
                <li key={item} className="flex items-start gap-3 text-body text-text-secondary">
                  <CheckIcon
                    className="w-5 h-5 text-gold flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-bg-elevated border border-subtle rounded-lg p-6">
            <p className="text-small text-text-secondary uppercase tracking-widest mb-4 font-semibold">
              Don&rsquo;t
            </p>
            <ul className="space-y-3">
              {DONT_LIST.map((item) => (
                <li key={item} className="flex items-start gap-3 text-body text-text-secondary">
                  <XMarkIcon
                    className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
