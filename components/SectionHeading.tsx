import FadeIn from "./FadeIn";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export default function SectionHeading({
  title,
  subtitle,
  align = "center",
}: SectionHeadingProps) {
  return (
    <FadeIn className={`mb-16 ${align === "center" ? "text-center" : ""}`}>
      <div
        className={`gold-line mb-4 ${align === "center" ? "mx-auto" : ""}`}
      />
      <h2 className="font-serif font-semibold text-heading text-text-primary">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-body text-text-secondary max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </FadeIn>
  );
}
