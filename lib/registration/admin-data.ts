import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type PaidRegistration = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  shirt_size: string | null;
  car_make: string | null;
  car_model: string | null;
  has_passenger: boolean | null;
  passenger_first_name: string | null;
  passenger_last_name: string | null;
  passenger_shirt_size: string | null;
  amount_paid_cents: number | null;
  answers: {
    instagram?: string | null;
    facebook?: string | null;
    passenger_social?: string | null;
    meals?: Record<string, { driver?: string; passenger?: string }>;
    addons?: Record<string, number>;
  } | null;
};

/**
 * Paid registrations for an event, oldest first. Pending rows (abandoned
 * checkouts) are intentionally excluded everywhere admins look.
 * Returns null when the event does not exist.
 */
export async function fetchPaidRegistrations(eventId: string): Promise<{
  event: { id: string; title: string };
  registrations: PaidRegistration[];
} | null> {
  const supabase = createSupabaseServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "paid")
    .order("created_at", { ascending: true });

  return { event, registrations: (data ?? []) as PaidRegistration[] };
}
