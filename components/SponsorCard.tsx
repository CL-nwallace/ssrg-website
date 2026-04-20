import Image from "next/image";

interface SponsorCardProps {
  logo: string;
  name: string;
  services: string[];
  perks: string[];
  href: string;
  invertLogo?: boolean;
}

export default function SponsorCard({
  logo,
  name,
  services,
  perks,
  href,
  invertLogo = false,
}: SponsorCardProps) {
  return (
    <div className="bg-bg-elevated border border-subtle rounded-lg p-8 hover:border-gold-muted/30 transition-colors">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block mb-6"
      >
        <div className="relative h-16 w-full">
          <Image
            src={logo}
            alt={name}
            fill
            className={`object-contain ${invertLogo ? "invert" : ""}`}
            sizes="200px"
          />
        </div>
      </a>

      <h4 className="font-serif text-lg text-text-primary mb-4">
        Services Offered
      </h4>
      <ul className="space-y-1 mb-6">
        {services.map((service) => (
          <li key={service} className="text-small text-text-secondary flex items-start gap-2">
            <span className="text-gold mt-1 shrink-0">&#8226;</span>
            {service}
          </li>
        ))}
      </ul>

      <h4 className="font-serif text-lg text-gold mb-3">
        SSRG Member Perks
      </h4>
      <ul className="space-y-1">
        {perks.map((perk) => (
          <li key={perk} className="text-small text-text-secondary flex items-start gap-2">
            <span className="text-gold mt-1 shrink-0">&#8226;</span>
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}
