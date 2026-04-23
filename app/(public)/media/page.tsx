import Hero from "@/components/Hero";
import MediaCategory from "@/components/MediaCategory";
import FadeIn from "@/components/FadeIn";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MediaRow = {
  category: string;
  storage_path: string;
  created_at: string;
};

// Category metadata is fixed per admin scope (admins don't create categories),
// so title/description/fallback live in code. Cover image is the most recent
// photo in that category from Supabase Storage, with a fallback if none exists.
const CATEGORIES = [
  {
    slug: "drives_rallies",
    title: "Drives / Rallies",
    description:
      "Explore the excitement and adventure of SSRG rallies through our photo albums. Scenic drives, breathtaking landscapes, and unforgettable journeys.",
    fallbackImage: "/images/media-rallies.jpg",
  },
  {
    slug: "track",
    title: "Track Events",
    description:
      "Experience the thrill of speed and precision. Our albums capture the intensity and excitement of racing circuits.",
    fallbackImage: "/images/track-cover.jpg",
  },
  {
    slug: "private_parties",
    title: "Private Parties",
    description:
      "Browse through the spontaneity and diversity of SSRG Private Events. Unique locations and vibrant community spirit.",
    fallbackImage: "/images/media-private.jpg",
  },
  {
    slug: "coffee_runs",
    title: "Coffee Runs",
    description:
      "Dive into the relaxed atmosphere of SSRG Coffee Runs. Early morning drives to lively coffee gatherings.",
    fallbackImage: "/images/media-coffee.jpg",
  },
] as const;

function mediaUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/media/${path}`;
}

export default async function MediaPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media")
    .select("category, storage_path, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load media:", error.message);
  }

  const rows: MediaRow[] = data ?? [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const latestByCategory = new Map<string, string>();
  for (const row of rows) {
    if (!latestByCategory.has(row.category)) {
      latestByCategory.set(row.category, row.storage_path);
    }
  }

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
          {CATEGORIES.map((category, index) => {
            const latestPath = latestByCategory.get(category.slug);
            const image = latestPath
              ? mediaUrl(supabaseUrl, latestPath)
              : category.fallbackImage;
            return (
              <FadeIn key={category.slug} delay={index * 0.1}>
                <MediaCategory
                  image={image}
                  title={category.title}
                  description={category.description}
                  href="#"
                />
              </FadeIn>
            );
          })}
        </div>
      </section>
    </>
  );
}
