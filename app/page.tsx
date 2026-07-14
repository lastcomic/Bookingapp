import BookingApp from "@/components/BookingApp";
import Gate from "@/components/Gate";
import { getConfig } from "@/lib/settings";
import { isSiteAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Front door: when an access code is set in engine settings, buyers land on
// the private-calendar gate until they enter it.
export default async function Page() {
  const cfg = await getConfig();
  const gated = (cfg.accessCode || "").trim() !== "";
  if (gated && !isSiteAuthed()) {
    return <Gate />;
  }
  return <BookingApp />;
}
