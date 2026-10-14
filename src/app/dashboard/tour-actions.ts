"use server";

import type { TourId } from "@/lib/tours";
import { createClient } from "@/lib/supabase/server";

// Remembers, on the person's account, that a tour was shown to them. Best effort: if it can't be saved, the
// worst case is that the tour is offered again next time.
export async function markTourSeen(tour: TourId): Promise<void> {
  if (tour !== "dashboard" && tour !== "project") return;
  const supabase = await createClient();
  await supabase.rpc("mark_tour_seen", { p_tour: tour });
}
