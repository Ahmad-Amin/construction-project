import { cookies } from "next/headers";
import { FLASH_COOKIE } from "@/lib/flash-name";

// A one-shot message for the next page: "Payment recorded". A server action that redirects sets it,
// and the dashboard shows it as a toast and clears it. It lives for 30 seconds at most.

export async function flash(message: string) {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(message.slice(0, 160)), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
  });
}
