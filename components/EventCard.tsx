import Image from "next/image";
import { sanitizedHtml } from "@/lib/render-html";

interface EventCardProps {
  eventId: string;
  image: string;
  title: string;
  price: string;
  descriptionHtml?: string;
}

export default function EventCard({
  eventId,
  image,
  title,
  price,
  descriptionHtml,
}: EventCardProps) {
  return (
    <div className="group bg-bg-elevated border border-subtle rounded-lg overflow-hidden hover:border-gold-muted/30 transition-colors">
      <div className="aspect-square relative overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="p-6">
        <h3 className="font-serif text-large text-text-primary">{title}</h3>
        <p className="mt-2 text-body text-gold font-semibold">{price}</p>
        {descriptionHtml ? (
          <div
            className="mt-4 text-small text-text-secondary prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={sanitizedHtml(descriptionHtml)}
          />
        ) : null}
        <form
          action="/api/checkout"
          method="POST"
          className="mt-4"
          data-testid={`register-form-${eventId}`}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            className="inline-block px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors cursor-pointer"
          >
            Register Now
          </button>
        </form>
      </div>
    </div>
  );
}
