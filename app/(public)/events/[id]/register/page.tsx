import { notFound } from "next/navigation";
import Hero from "@/components/Hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { effectiveConfig } from "@/lib/registration/config";
import { sanitizedHtml } from "@/lib/render-html";
import RegistrationForm from "./RegistrationForm";

export const dynamic = "force-dynamic";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default async function RegisterPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, event_date, price_cents, description_html, registration_deadline, registration_config",
    )
    .eq("id", params.id)
    .eq("status", "published")
    .maybeSingle();
  if (!event) notFound();

  const closesAt = new Date(event.registration_deadline ?? event.event_date);
  const open = closesAt.getTime() > Date.now();
  const config = effectiveConfig(event.registration_config);

  return (
    <>
      <Hero
        title={event.title}
        subtitle={new Date(event.event_date).toLocaleDateString("en-US", {
          dateStyle: "long",
        })}
        backgroundImage="/images/track-cover.jpg"
        fullHeight={false}
        showLogo={false}
      />

      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <p className="text-body text-gold font-semibold">
              {priceFormatter.format(event.price_cents / 100)} per car
            </p>
            <div
              className="mt-4 text-body text-text-secondary prose prose-invert max-w-none"
              dangerouslySetInnerHTML={sanitizedHtml(event.description_html)}
            />
          </div>

          {open ? (
            <RegistrationForm
              eventId={event.id}
              basePriceCents={event.price_cents}
              config={config}
            />
          ) : (
            <p
              className="font-serif text-subheading text-text-secondary"
              data-testid="registration-closed"
            >
              Registration for this event has closed.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
