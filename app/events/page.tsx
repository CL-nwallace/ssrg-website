import Hero from "@/components/Hero";
import EventCard from "@/components/EventCard";
import FadeIn from "@/components/FadeIn";

const events = [
  {
    image: "/images/event-vegas.jpg",
    title: "LA to Las Vegas",
    price: "$3,000.00",
    href: "#",
  },
];

export default function EventsPage() {
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
                <FadeIn key={event.title}>
                  <EventCard {...event} />
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
