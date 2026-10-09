"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";
import { NotificationIcon } from "@/components/notification-row";
import { FLASH_COOKIE } from "@/lib/flash-name";
import type { NotificationItem } from "@/lib/notifications";

type Tone = "success" | "error" | "info";
type ToastInput = { title: string; body?: string; href?: string; tone?: Tone; kind?: NotificationItem["kind"]; seconds?: number };
type ToastItem = ToastInput & { id: number };

type Api = {
  show: (t: ToastInput) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
};

// Outside the provider (a page that has no toasts) every call quietly does nothing.
const noop: Api = { show: () => {}, success: () => {}, error: () => {} };
const Ctx = createContext<Api>(noop);
export const useToast = () => useContext(Ctx);

const MAX_VISIBLE = 3;
const POLL_MS = 20_000;

const tones: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  error: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-data-accent",
};

// Small messages in the bottom corner: "Payment recorded", and a heads-up when something new
// arrives for you. They go away by themselves, stay while you point at them, and can be closed.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((t: ToastInput) => {
    const id = next.current++;
    setToasts((list) => [...list.filter((x) => !(x.title === t.title && x.body === t.body)), { ...t, id }].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo<Api>(
    () => ({
      show,
      success: (title, body) => show({ title, body, tone: "success" }),
      error: (title, body) => show({ title, body, tone: "error", seconds: 8 }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <FlashReader />
      <NotificationWatcher />
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const tone = toast.tone ?? "info";

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, (toast.seconds ?? (toast.href ? 8 : 5)) * 1000);
    return () => clearTimeout(timer);
  }, [paused, onDismiss, toast.seconds, toast.href]);

  const icon = toast.kind ? (
    <NotificationIcon kind={toast.kind} className="size-9 rounded-lg" />
  ) : (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
      {tone === "success" ? (
        <CheckCircle2 className="size-[18px]" aria-hidden />
      ) : tone === "error" ? (
        <AlertTriangle className="size-[18px]" aria-hidden />
      ) : (
        <Bell className="size-[18px]" aria-hidden />
      )}
    </span>
  );

  const text = (
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm font-semibold">{toast.title}</span>
      {toast.body && <span className="mt-0.5 line-clamp-3 break-words text-sm text-muted">{toast.body}</span>}
    </span>
  );

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-lg shadow-black/10"
    >
      {toast.href ? (
        <Link href={toast.href} onClick={onDismiss} className="-m-1 flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 hover:bg-surface-2">
          {icon}
          {text}
        </Link>
      ) : (
        <>
          {icon}
          {text}
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

// Shows the one-shot message a server action left for this page, then clears it.
function FlashReader() {
  const toast = useToast();
  const pathname = usePathname();

  useEffect(() => {
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
    if (!match) return;
    document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0`;
    try {
      const message = decodeURIComponent(match.slice(FLASH_COOKIE.length + 1));
      if (message) toast.success(message);
    } catch {
      // A garbled cookie is just ignored.
    }
  }, [pathname, toast]);

  return null;
}

// While the dashboard is open, checks every so often for new notifications and pops a toast for
// each. It also refreshes the page's data, so the bell count (and the page you're on) stay current.
function NotificationWatcher() {
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    let since: string | null = null;
    let busy = false;
    let stopped = false;

    async function poll() {
      if (busy || stopped || document.hidden) return;
      busy = true;
      try {
        const response = await fetch(since ? `/api/notifications/poll?since=${encodeURIComponent(since)}` : "/api/notifications/poll", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { latest: string; items: NotificationItem[] };
        if (since === null) {
          since = data.latest;
          return;
        }
        since = data.latest;
        for (const n of data.items) {
          toast.show({ title: n.title, body: n.body, href: n.link, kind: n.kind, tone: "info" });
        }
        if (data.items.length > 0) router.refresh();
      } catch {
        // Offline or asleep: try again next time.
      } finally {
        busy = false;
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [toast, router]);

  return null;
}
