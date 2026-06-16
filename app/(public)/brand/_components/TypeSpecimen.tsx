type ScaleStep = {
  name: string;
  className: string;
  px: number;
  family: "serif" | "sans";
  fontClass: string;
};

const TYPE_SCALE: ScaleStep[] = [
  { name: "Display", className: "text-display", px: 80, family: "serif", fontClass: "font-serif" },
  { name: "Hero", className: "text-hero", px: 64, family: "serif", fontClass: "font-serif" },
  { name: "Heading", className: "text-heading", px: 48, family: "serif", fontClass: "font-serif" },
  { name: "Subheading", className: "text-subheading", px: 32, family: "serif", fontClass: "font-serif" },
  { name: "Large", className: "text-large", px: 24, family: "sans", fontClass: "font-sans" },
  { name: "Body", className: "text-body", px: 16, family: "sans", fontClass: "font-sans" },
  { name: "Small", className: "text-small", px: 14, family: "sans", fontClass: "font-sans" },
];

const SAMPLE_TEXT = "SSRG — Exotic Car Lifestyle";

export default function TypeSpecimen() {
  return (
    <section className="py-20 md:py-28" aria-labelledby="type-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="type-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            Typography
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            Two typefaces, a clear hierarchy. Cormorant (serif) carries the
            brand voice at editorial scale; Montserrat (sans-serif) handles body
            copy and UI labels at reading scale.
          </p>
        </div>

        {/* Typeface introductions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {/* Cormorant */}
          <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
            <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-6">
              Display &amp; Headings
            </p>
            <p className="font-serif text-subheading text-text-primary leading-snug mb-4">
              Cormorant
            </p>
            <p className="font-serif text-body text-text-secondary leading-relaxed mb-6">
              A high-contrast editorial serif inspired by 16th-century type.
              Used for all display text, section headings, and pull quotes.
              Loaded via next/font at weights 400–700.
            </p>
            <p className="font-serif text-large text-text-primary italic">
              &ldquo;Drive Extraordinary.&rdquo;
            </p>
          </div>

          {/* Montserrat */}
          <div className="bg-bg-elevated border border-subtle rounded-lg p-8">
            <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-6">
              Body &amp; UI
            </p>
            <p className="font-sans text-subheading font-semibold text-text-primary leading-snug mb-4">
              Montserrat
            </p>
            <p className="font-sans text-body text-text-secondary leading-relaxed mb-6">
              A geometric sans-serif designed for legibility at small sizes.
              Used for body copy, navigation labels, buttons, and captions.
              Loaded via next/font at weights 300–700.
            </p>
            <p className="font-sans text-large font-medium text-text-primary uppercase tracking-widest">
              SSRG Official
            </p>
          </div>
        </div>

        {/* Type scale */}
        <div>
          <h3 className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-8">
            Type Scale
          </h3>

          <div className="space-y-1">
            {TYPE_SCALE.map((step) => (
              <div
                key={step.name}
                className="bg-bg-elevated border border-subtle rounded-lg p-6 overflow-hidden"
              >
                {/* Label row */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-small text-text-secondary font-mono w-24 flex-shrink-0">
                    {step.name}
                  </span>
                  <span className="text-small text-text-muted font-mono">
                    {step.px}px · {step.family}
                  </span>
                </div>
                {/* Specimen line */}
                <p
                  className={`${step.className} ${step.fontClass} text-text-primary leading-none truncate`}
                >
                  {SAMPLE_TEXT}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pairing rules */}
        <div className="mt-10 p-6 bg-bg-surface border border-subtle rounded-lg">
          <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-3">
            Pairing Rules
          </p>
          <ul className="space-y-2 text-body text-text-secondary">
            <li>Serif (Cormorant) for display, hero, heading, and subheading sizes.</li>
            <li>Sans (Montserrat) for large, body, small sizes and all UI elements.</li>
            <li>Never set body copy in Cormorant below 24 px — legibility suffers.</li>
            <li>Track headings at <span className="font-mono text-small">-0.02em</span> (built into the scale tokens).</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
