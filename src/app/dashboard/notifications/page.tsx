import Link from "next/link";
import { BellOff, Settings } from "lucide-react";
import { NotificationRow } from "@/components/notification-row";
import { fetchNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { markAllNotificationsRead } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const items = await fetchNotifications(supabase, 50);
  const unread = items.filter((n) => !n.read).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button className={button("secondary", "sm")}>Mark all as read</button>
            </form>
          )}
          <Link href="/dashboard/settings" className={button("ghost", "sm")}>
            <Settings className="size-4" aria-hidden /> Email settings
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
            <BellOff className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 font-semibold">Nothing yet</h2>
          <p className="mt-1 max-w-xs text-sm text-muted">
            When a payment needs your confirmation, a site update is posted, or a stage is completed, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationRow item={n} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
