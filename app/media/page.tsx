import Hero from "@/components/Hero";
import MediaCategory from "@/components/MediaCategory";
import FadeIn from "@/components/FadeIn";

const categories = [
  {
    image: "/images/media-rallies.jpg",
    title: "Drives / Rallies",
    description:
      "Explore the excitement and adventure of SSRG rallies through our photo albums. Scenic drives, breathtaking landscapes, and unforgettable journeys.",
    href: "#",
  },
  {
    image: "/images/track-cover.jpg",
    title: "Track Events",
    description:
      "Experience the thrill of speed and precision. Our albums capture the intensity and excitement of racing circuits.",
    href: "#",
  },
  {
    image: "/images/media-private.jpg",
    title: "Private Parties",
    description:
      "Browse through the spontaneity and diversity of SSRG Private Events. Unique locations and vibrant community spirit.",
    href: "#",
  },
  {
    image: "/images/media-coffee.jpg",
    title: "Coffee Runs",
    description:
      "Dive into the relaxed atmosphere of SSRG Coffee Runs. Early morning drives to lively coffee gatherings.",
    href: "#",
  },
];

export default function MediaPage() {
  return (
    <>
      <Hero
        title="Media"
        subtitle="Capturing the moments that define us"
        backgroundImage="/images/passion.jpg"
        fullHeight={false}
        showLogo={false}
      />

      <section className="py-24 px-6" data-testid="media-grid">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {categories.map((category, index) => (
            <FadeIn key={category.title} delay={index * 0.1}>
              <MediaCategory {...category} />
            </FadeIn>
          ))}
        </div>
      </section>
    </>
  );
}
