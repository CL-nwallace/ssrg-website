import Image from "next/image";

export default function MerchBlock() {
  return (
    <section className="py-20 md:py-28 bg-bg-surface" aria-labelledby="merch-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="merch-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            Merch &amp; Apparel
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            Apparel is the most public expression of the SSRG identity. Treat
            every garment as a brand ambassador.
          </p>
        </div>

        {/* Garment chips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Dark garment */}
          <div className="bg-bg-elevated border border-subtle rounded-lg overflow-hidden">
            <div
              className="bg-bg-deep flex items-center justify-center p-12"
              role="img"
              aria-label="White SSRG wordmark on dark garment simulation"
            >
              <Image
                src="/images/ssrg-logo.png"
                alt="SSRG white wordmark on dark garment"
                width={200}
                height={71}
                className="opacity-100"
              />
            </div>
            <div className="p-6">
              <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-2">
                Dark Garment
              </p>
              <p className="text-body text-text-secondary">
                White wordmark on black or charcoal fabric. The standard and
                preferred treatment. Works on all dark garments regardless of
                exact shade.
              </p>
            </div>
          </div>

          {/* Light garment */}
          <div className="bg-bg-elevated border border-subtle rounded-lg overflow-hidden">
            <div
              className="bg-text-primary flex items-center justify-center p-12"
              role="img"
              aria-label="Dark SSRG wordmark on light garment simulation"
            >
              <Image
                src="/images/ssrg-logo.png"
                alt="SSRG dark wordmark on light garment"
                width={200}
                height={71}
                className="invert opacity-80"
              />
            </div>
            <div className="p-6">
              <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-2">
                Light Garment
              </p>
              <p className="text-body text-text-secondary">
                Dark (near-black) or gold-tinted wordmark on white or cream
                fabric. Use when a light colorway is required. Confirm ink
                contrast with the printer before production.
              </p>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-bg-elevated border border-subtle rounded-lg p-6">
          <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-4">
            Application Rules
          </p>
          <ul className="space-y-3 text-body text-text-secondary">
            <li>
              <span className="text-text-primary font-medium">Minimum size on fabric:</span>{" "}
              2.5 in wide (embroidery) / 3 in wide (screen print). Smaller sizes lose wordmark legibility.
            </li>
            <li>
              <span className="text-text-primary font-medium">Clear space on fabric:</span>{" "}
              0.5 in on all sides of the wordmark, or the cap-height of the S — whichever is larger.
            </li>
            <li>
              <span className="text-text-primary font-medium">Preferred placement:</span>{" "}
              Left chest for polos/jackets; center chest for tees; back center for hoodies.
            </li>
            <li>
              <span className="text-text-primary font-medium">No distressed or grunge treatments.</span>{" "}
              The wordmark must be crisp and clean.
            </li>
            <li>
              <span className="text-text-primary font-medium">Garment colors:</span>{" "}
              Black, charcoal, or white are preferred. Avoid saturated colors that compete with the gold identity.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
