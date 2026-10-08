"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/dashboard/notifications/actions";
import { NotificationRow } from "@/components/notification-row";
import { Spinner } from "@/components/spinner";
import type { NotificationItem } from "@/lib/notifications";

// The bell in the top bar: an unread count, and a dropdown of the latest notifications.
export function NotificationBell({ unread, pathname }: { unread: number; pathname: string }) {
  // Tied to the page it was opened on, so navigating closes it by itself.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [, startTransition] = useTransition();
  // Everything was just marked read: the badge clears at once, while the server catches up.
  const [clearing, startClearing] = useTransition();
  const [clearedFor, setClearedFor] = useState<number | null>(null);
  // Only counts while the server still reports the same number, so a new notification brings the badge back.
  const cleared = clearedFor !== null && unread === clearedFor;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    if (open) return setOpenOn(null);
    setOpenOn(pathname);
    startTransition(async () => setItems(await listNotifications()));
  }

  function openItem(id: string) {
    setItems((list) => list?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? null);
    startTransition(() => markNotificationRead(id));
  }

  function markAll() {
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    setClearedFor(unread);
    startClearing(async () => {
      await markAllNotificationsRead();
    });
  }

  const shownUnread = cleared ? 0 : unread;
  const hasUnread = !cleared && (unread > 0 || (items?.some((n) => !n.read) ?? false));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={shownUnread > 0 ? `Notifications, ${shownUnread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <Bell className="size-5" aria-hidden />
        {shownUnread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
            {shownUnread > 99 ? "99+" : shownUnread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpenOn(null)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Notifications"
            className="animate-rise fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-semibold">Notifications</h2>
              {hasUnread ? (
                <button
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
                >
                  <CheckCheck className="size-4" aria-hidden /> Mark all read
                </button>
              ) : cleared ? (
                <span role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
                  {clearing ? <Spinner /> : <Check className="size-4" aria-hidden />}
                  {clearing ? "Marking…" : "All read"}
                </span>
              ) : null}
            </div>

            <div className="max-h-[min(26rem,65vh)] overflow-y-auto">
              {items === null ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  You&apos;re all caught up. New payments, updates and milestones will show up here.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((n) => (
                    <li key={n.id}>
                      <NotificationRow item={n} onOpen={() => openItem(n.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line px-4 py-2.5 text-center">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpenOn(null)}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                See all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
