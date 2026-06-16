import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

type CopyExample = { do: string; dont: string };

const COPY_EXAMPLES: CopyExample[] = [
  {
    do: "Experience the thrill of California's most exclusive driving routes.",
    dont: "HUGE SALE — 50% OFF event tickets this weekend only!!!",
  },
  {
    do: "An invitation-style event for drivers who demand more from every mile.",
    dont: "Anyone can join — the more the merrier, no experience needed!",
  },
  {
    do: "Your next chapter on the open road begins here.",
    dont: "Don't miss out — limited spots going FAST, book NOW or regret it.",
  },
];

type Pillar = { title: string; description: string };

const PILLARS: Pillar[] = [
  {
    title: "Aspirational",
    description:
      "Every touchpoint should inspire members to drive more, explore more, and live more. Speak to the elevated experience they're buying into.",
  },
  {
    title: "Exclusive",
    description:
      "SSRG is a curated community, not a mass event. Language should feel like an invitation, not a billboard.",
  },
  {
    title: "Understated",
    description:
      "Confidence doesn't shout. Let the cars and experiences speak — avoid hype, discounts, and artificial urgency.",
  },
];

export default function VoiceTone() {
  return (
    <section className="py-20 md:py-28 bg-bg-surface" aria-labelledby="voice-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="voice-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            Voice &amp; Tone
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            How SSRG sounds is as important as how it looks. A consistent voice
            builds trust and reinforces the premium identity.
          </p>
        </div>

        {/* Positioning */}
        <div className="mb-12">
          <h3 className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-4">
            Brand Positioning
          </h3>
          <blockquote className="border-l-2 border-gold pl-6">
            <p className="font-serif text-subheading text-text-primary leading-snug">
              &ldquo;Premier exotic car event and lifestyle group in California —
              unforgettable driving experiences and social gatherings.&rdquo;
            </p>
          </blockquote>
        </div>

        {/* Proposed tagline + pillars — clearly flagged */}
        <div className="mb-12 bg-bg-elevated border border-subtle rounded-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 text-small font-semibold uppercase tracking-widest text-gold-muted border border-gold-muted rounded">
              Proposed — pending board approval
            </span>
          </div>

          <div className="mb-8">
            <h3 className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-3">
              Proposed Tagline
            </h3>
            <p className="font-serif text-hero text-text-primary leading-none">
              Drive Extraordinary.
            </p>
            <p className="mt-3 text-body text-text-muted">
              Two words. Imperative voice. Pairs the brand action (driving) with
              the lifestyle promise (extraordinary). Simple enough to live on
              merch; specific enough to be ownable. Pending board sign-off
              before use on any public-facing material.
            </p>
          </div>

          <div>
            <h3 className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-6">
              Proposed Messaging Pillars
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="bg-bg-surface border border-subtle rounded-lg p-5"
                >
                  <p className="font-serif text-large text-gold mb-2">
                    {pillar.title}
                  </p>
                  <p className="text-body text-text-secondary">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Do / Don't copy examples */}
        <div>
          <h3 className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-6">
            Copy Examples
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Do column */}
            <div className="bg-bg-elevated border border-subtle rounded-lg p-6">
              <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-4">
                Do — Aspirational &amp; Understated
              </p>
              <ul className="space-y-4">
                {COPY_EXAMPLES.map((ex) => (
                  <li key={ex.do} className="flex items-start gap-3 text-body text-text-secondary">
                    <CheckIcon
                      className="w-5 h-5 text-gold flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>&ldquo;{ex.do}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Don't column */}
            <div className="bg-bg-elevated border border-subtle rounded-lg p-6">
              <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-4">
                Don&rsquo;t — Hype-driven &amp; Discount-oriented
              </p>
              <ul className="space-y-4">
                {COPY_EXAMPLES.map((ex) => (
                  <li key={ex.dont} className="flex items-start gap-3 text-body text-text-secondary">
                    <XMarkIcon
                      className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>&ldquo;{ex.dont}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
