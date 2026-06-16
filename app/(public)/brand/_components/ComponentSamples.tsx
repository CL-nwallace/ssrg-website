type Sample = {
  label: string;
  usage: string;
  preview: React.ReactNode;
};

export default function ComponentSamples() {
  return (
    <section className="py-20 md:py-28" aria-labelledby="components-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="components-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            UI Components &amp; Applications
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            Live samples rendered exactly as they appear on the site, using the
            same Tailwind classes. These serve as the canonical reference.
          </p>
        </div>

        <div className="space-y-6">
          {/* Primary Button */}
          <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
            <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-2">
              Primary Button
            </p>
            <p className="text-body text-text-muted mb-6">
              Used for: primary CTA (Register, Book Now). Gold fill, near-black text. Hover lightens gold.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <button
                type="button"
                className="inline-block px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none cursor-pointer"
              >
                Register Now
              </button>
              <button
                type="button"
                className="px-8 py-3 border border-gold text-gold font-semibold text-small rounded hover:bg-gold hover:text-bg-deep transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none cursor-pointer"
              >
                View All Members
              </button>
            </div>
            <div className="mt-4 p-4 bg-bg-surface rounded font-mono text-small text-text-muted">
              <p>Gold fill: <span className="text-text-secondary">px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors duration-200</span></p>
              <p className="mt-1">Gold outline: <span className="text-text-secondary">px-8 py-3 border border-gold text-gold font-semibold text-small rounded hover:bg-gold hover:text-bg-deep transition-colors duration-200</span></p>
            </div>
          </div>

          {/* Content Card */}
          <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
            <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-2">
              Content Card
            </p>
            <p className="text-body text-text-muted mb-6">
              Used for: event cards, info panels, form containers. Elevated background with hairline border.
            </p>
            <div className="bg-bg-elevated border border-subtle rounded-lg p-6 max-w-sm">
              <p className="font-serif text-subheading text-text-primary mb-2">
                Malibu Canyon Drive
              </p>
              <p className="text-body text-text-secondary leading-relaxed">
                A curated Saturday morning drive through Malibu&rsquo;s most
                scenic roads. Limited to 12 cars.
              </p>
              <p className="mt-4 text-small text-gold font-semibold">$150 per car</p>
            </div>
            <div className="mt-4 p-4 bg-bg-surface rounded font-mono text-small text-text-muted">
              bg-bg-elevated border border-subtle rounded-lg p-6
            </div>
          </div>

          {/* Gold-line heading accent */}
          <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
            <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-2">
              Gold-line Heading Accent
            </p>
            <p className="text-body text-text-muted mb-6">
              Used for: every section heading across the site. A 60×2 px gold bar sits above the h2.
            </p>
            <div>
              <div className="gold-line mb-4" />
              <h3 className="font-serif font-semibold text-heading text-text-primary">
                Our Story
              </h3>
            </div>
            <div className="mt-6 p-4 bg-bg-surface rounded font-mono text-small text-text-muted">
              .gold-line &#123; width: 60px; height: 2px; background: #c9a84c; &#125;
            </div>
          </div>

          {/* Glass bar */}
          <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
            <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-2">
              Glass Navbar Bar
            </p>
            <p className="text-body text-text-muted mb-6">
              Used for: the sticky top navbar. Semi-transparent bg-deep with backdrop blur and a hairline bottom border.
            </p>
            <div className="rounded overflow-hidden">
              <div
                className="glass px-6 py-4 flex items-center gap-6"
                role="presentation"
              >
                <span className="font-serif text-large font-semibold text-text-primary">
                  SSRG
                </span>
                <span className="text-small text-text-secondary">Events</span>
                <span className="text-small text-text-secondary">Media</span>
              </div>
            </div>
            <div className="mt-4 p-4 bg-bg-surface rounded font-mono text-small text-text-muted">
              .glass &#123; background: rgba(10,10,10,0.7); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.06); &#125;
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
