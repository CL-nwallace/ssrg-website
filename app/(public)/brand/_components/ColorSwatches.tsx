type ColorEntry = {
  name: string;
  token: string;
  hex: string;
  role: string;
  group: string;
};

const COLORS: ColorEntry[] = [
  // Backgrounds
  {
    name: "Deep",
    token: "bg-bg-deep",
    hex: "#0A0A0A",
    role: "Page background — the darkest surface; used for the body, hero overlays, and cards on elevated backgrounds.",
    group: "Backgrounds",
  },
  {
    name: "Elevated",
    token: "bg-bg-elevated",
    hex: "#111111",
    role: "Raised surfaces — cards, panels, the admin sidebar.",
    group: "Backgrounds",
  },
  {
    name: "Surface",
    token: "bg-bg-surface",
    hex: "#1A1A1A",
    role: "Tertiary surface — input fills, info blocks on elevated panels.",
    group: "Backgrounds",
  },
  // Gold
  {
    name: "Gold",
    token: "bg-gold / text-gold",
    hex: "#C9A84C",
    role: "Primary accent — CTAs, the gold-line heading rule, interactive highlights.",
    group: "Gold",
  },
  {
    name: "Gold Light",
    token: "bg-gold-light / text-gold-light",
    hex: "#D4B96A",
    role: "Hover state for gold interactive elements.",
    group: "Gold",
  },
  {
    name: "Gold Muted",
    token: "bg-gold-muted / text-gold-muted",
    hex: "#8A7535",
    role: "Subdued gold — secondary badges, proposed/draft labels.",
    group: "Gold",
  },
  // Text
  {
    name: "Text Primary",
    token: "text-text-primary",
    hex: "#F5F5F5",
    role: "Body copy and headings on dark backgrounds. WCAG: passes AA + AAA on bg-deep.",
    group: "Text",
  },
  {
    name: "Text Secondary",
    token: "text-text-secondary",
    hex: "#A3A3A3",
    role: "Supporting copy, captions, labels.",
    group: "Text",
  },
  {
    name: "Text Muted",
    token: "text-text-muted",
    hex: "#737373",
    role: "Placeholder text, disabled states, fine print.",
    group: "Text",
  },
  // Border
  {
    name: "Border Subtle",
    token: "border-subtle",
    hex: "rgba(255,255,255,0.08)",
    role: "Hairline borders on cards and panels — barely visible, adds depth.",
    group: "Border",
  },
];

function SwatchCard({ color }: { color: ColorEntry }) {
  const isBorder = color.group === "Border";

  return (
    <div className="bg-bg-elevated border border-subtle rounded-lg overflow-hidden">
      {/* Color block */}
      <div
        className="h-24"
        style={{ backgroundColor: isBorder ? "rgba(255,255,255,0.08)" : color.hex }}
        aria-hidden="true"
      />
      {/* Metadata */}
      <div className="p-4 space-y-1">
        <p className="text-small font-semibold text-text-primary">{color.name}</p>
        <p className="text-small text-text-muted font-mono">{color.token}</p>
        <p className="text-small text-text-muted font-mono">{color.hex}</p>
        <p className="text-small text-text-secondary mt-2">{color.role}</p>
      </div>
    </div>
  );
}

export default function ColorSwatches() {
  const groups = ["Backgrounds", "Gold", "Text", "Border"] as const;

  return (
    <section className="py-20 md:py-28 bg-bg-surface" aria-labelledby="color-heading">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="mb-16">
          <div className="gold-line mb-4" />
          <h2
            id="color-heading"
            className="font-serif font-semibold text-heading text-text-primary"
          >
            Color
          </h2>
          <p className="mt-4 text-body text-text-secondary max-w-2xl">
            The SSRG palette is rooted in near-black surfaces and a restrained
            gold accent. Every color token maps directly to a Tailwind utility
            class — use the tokens, never raw hex values.
          </p>
        </div>

        {/* Swatches by group */}
        {groups.map((group) => {
          const groupColors = COLORS.filter((c) => c.group === group);
          return (
            <div key={group} className="mb-12">
              <h3 className="text-small uppercase tracking-widest text-text-secondary font-semibold mb-6">
                {group}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {groupColors.map((color) => (
                  <SwatchCard key={color.name} color={color} />
                ))}
              </div>
            </div>
          );
        })}

        {/* WCAG note */}
        <div className="mt-8 p-6 bg-bg-elevated border border-subtle rounded-lg">
          <p className="text-small text-text-secondary uppercase tracking-widest font-semibold mb-3">
            Accessibility — Contrast Notes
          </p>
          <ul className="space-y-2 text-body text-text-secondary">
            <li>
              <span className="text-text-primary font-medium">text-primary (#F5F5F5) on bg-deep (#0A0A0A):</span>{" "}
              passes WCAG AA and AAA for both normal and large text.
            </li>
            <li>
              <span className="text-text-primary font-medium">Gold (#C9A84C) on bg-deep (#0A0A0A):</span>{" "}
              passes WCAG AA for large text and UI components (contrast ratio ≈ 5.2:1). Not recommended for small body copy.
            </li>
            <li>
              <span className="text-text-primary font-medium">text-secondary (#A3A3A3) on bg-deep:</span>{" "}
              passes AA for normal text.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
