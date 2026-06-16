import Image from "next/image";

const ICON_SIZES = [16, 32, 64] as const;

export default function IconBlock() {
  return (
    <section className="py-20 md:py-28" aria-labelledby="icon-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="icon-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            Favicon &amp; Icon System
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            The favicon is derived from the SSRG wordmark on the brand-dark
            background. It renders at multiple sizes across browsers, OS docks,
            and PWA install prompts.
          </p>
        </div>

        {/* Icon display panel */}
        <div className="bg-bg-elevated border border-subtle rounded-lg p-10 mb-10">
          <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-8">
            Icon at Various Sizes
          </p>
          <div className="flex items-end gap-8 flex-wrap">
            {ICON_SIZES.map((size) => (
              <div key={size} className="flex flex-col items-center gap-3">
                <Image
                  src="/icon.png"
                  alt={`SSRG favicon at ${size}px`}
                  width={size}
                  height={size}
                  className="rounded"
                  unoptimized
                />
                <span className="text-small text-text-muted font-mono">{size}px</span>
              </div>
            ))}
          </div>
        </div>

        {/* File inventory */}
        <div className="bg-bg-elevated border border-subtle rounded-lg p-6 mb-6">
          <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-4">
            Registered Icon Files
          </p>
          <ul className="space-y-2 font-mono text-small text-text-secondary">
            <li>
              <span className="text-text-primary">app/favicon.ico</span>{" "}
              <span className="text-text-muted">— browser tab, 32px fallback</span>
            </li>
            <li>
              <span className="text-text-primary">app/icon.png</span>{" "}
              <span className="text-text-muted">— primary PNG icon (Next.js metadata convention)</span>
            </li>
            <li>
              <span className="text-text-primary">app/apple-icon.png</span>{" "}
              <span className="text-text-muted">— 180×180 iOS home screen icon</span>
            </li>
          </ul>
        </div>

        {/* Notes */}
        <div className="bg-bg-elevated border border-subtle rounded-lg p-6">
          <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-4">
            Design Notes &amp; Future Considerations
          </p>
          <ul className="space-y-3 text-body text-text-secondary">
            <li>
              <span className="text-text-primary font-medium">Small-size legibility:</span>{" "}
              The SSRG wordmark is four characters. At 16–32 px the full wordmark is
              tight but recognizable. Monitor browser tab rendering; if legibility
              degrades on a future design update, consider a simplified monogram
              (&ldquo;S&rdquo; or &ldquo;SS&rdquo;) for small sizes only.
            </li>
            <li>
              <span className="text-text-primary font-medium">Next.js wiring:</span>{" "}
              Icons in <span className="font-mono text-small">app/</span> are picked
              up automatically by the Next.js metadata convention — no manual{" "}
              <span className="font-mono text-small">&lt;link rel=&quot;icon&quot;&gt;</span> needed.
            </li>
            <li>
              <span className="text-text-primary font-medium">Dark background:</span>{" "}
              The icon uses <span className="font-mono text-small">#0a0a0a</span> (bg-deep)
              as the background, matching the site body, so it blends cleanly in
              browser UIs that display the icon with a white surround.
            </li>
            <li>
              <span className="text-text-primary font-medium">Future option:</span>{" "}
              An SVG favicon would scale perfectly at any size and support
              light/dark OS theme switching via{" "}
              <span className="font-mono text-small">prefers-color-scheme</span>.
              Deferred to v2.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
