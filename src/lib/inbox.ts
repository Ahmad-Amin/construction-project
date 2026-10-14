import { platformAdminEmails } from "@/lib/admin";

// Where emails meant for the person running the service go: plan requests and feedback. They go to the
// addresses in PLATFORM_ADMIN_EMAILS, the same people who can open the admin pages and get the bell
// notifications. (Only if that is empty do they fall back to the public contact address, so a request
// is never lost.)
export function adminInbox(): string[] {
  const admins = platformAdminEmails();
  if (admins.length > 0) return admins;
  const contact = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim();
  return contact ? [contact] : [];
}
