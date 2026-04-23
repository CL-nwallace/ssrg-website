import Hero from "@/components/Hero";
import EventCard from "@/components/EventCard";
import FadeIn from "@/components/FadeIn";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  price_cents: number;
  description_html: string;
  cover_image_path: string | null;
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function formatPrice(priceCents: number): string {
  return priceFormatter.format(priceCents / 100);
}

function coverUrl(supabaseUrl: string, path: string | null): string {
  if (!path) return "/images/hero.jpg";
  return `${supabaseUrl}/storage/v1/object/public/event-covers/${path}`;
}

export default async function EventsPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, price_cents, description_html, cover_image_path")
    .eq("status", "published")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Failed to load events:", error.message);
  }

  const events: EventRow[] = data ?? [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <>
      <Hero
        title="Upcoming Events"
        subtitle="Join us for unforgettable experiences"
        backgroundImage="/images/track-cover.jpg"
        fullHeight={false}
        showLogo={false}
      />

      <section className="py-24 px-6" data-testid="events-grid">
        <div className="max-w-7xl mx-auto">
          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map((event) => (
                <FadeIn key={event.id}>
                  <EventCard
                    image={coverUrl(supabaseUrl, event.cover_image_path)}
                    title={event.title}
                    price={formatPrice(event.price_cents)}
                    href="#"
                    descriptionHtml={event.description_html}
                  />
                </FadeIn>
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <p className="font-serif text-subheading text-text-secondary">
                No upcoming events at this time
              </p>
              <p className="mt-4 text-body text-text-muted">
                Check back soon or follow us on social media for updates.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
