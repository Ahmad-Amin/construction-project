"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Bug, Check, Lightbulb, MessageSquarePlus, HelpCircle, X, type LucideIcon } from "lucide-react";
import { sendFeedback } from "@/app/dashboard/feedback-actions";
import { Spinner } from "@/components/spinner";
import { button, inputClass } from "@/lib/ui";

const subscribe = () => () => {};
type Category = "problem" | "idea" | "question";

const OPTIONS: { id: Category; label: string; hint: string; icon: LucideIcon; placeholder: string }[] = [
  { id: "problem", label: "Something's wrong", hint: "A problem", icon: Bug, placeholder: "What happened, and what did you expect? Which page were you on?" },
  { id: "idea", label: "I have an idea", hint: "An idea", icon: Lightbulb, placeholder: "What would make this better for you?" },
  { id: "question", label: "I have a question", hint: "A question", icon: HelpCircle, placeholder: "What would you like to know?" },
];

const MAX = 2000;

function Dialog({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [category, setCategory] = useState<Category>("problem");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const current = OPTIONS.find((o) => o.id === category)!;

  useEffect(() => {
    box.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function send() {
    setError(null);
    if (message.trim().length < 3) return setError("Please write a few words.");
    // What helps us look into a problem: where they were, and what they were using.
    const browser = `${navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}`;
    startTransition(async () => {
      const result = await sendFeedback(category, message, pathname, browser);
      if (!result.ok) return setError(result.message);
      setSent(true);
    });
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="animate-rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="feedback-title" className="text-lg font-bold tracking-tight">
              {sent ? "Message sent" : "Send feedback"}
            </h2>
            {!sent && <p className="mt-0.5 text-sm text-muted">Tell us what&apos;s working and what isn&apos;t. A real person reads it.</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {sent ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <Check className="size-6" aria-hidden />
            </span>
            <p className="mt-4 font-semibold">Thank you. We read every message.</p>
            <p className="mt-1 max-w-xs text-sm text-muted">If you asked a question or reported a problem, we&apos;ll reply to the email on your account.</p>
            <button type="button" onClick={onClose} className={`${button("primary")} mt-6`}>
              Done
            </button>
          </div>
        ) : (
          <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div role="radiogroup" aria-label="What kind of message" className="grid grid-cols-3 gap-2">
              {OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={category === id}
                  onClick={() => setCategory(id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium transition-colors sm:text-sm ${
                    category === id ? "border-primary bg-primary-soft text-foreground" : "border-line bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`size-5 ${category === id ? "text-data-accent" : ""}`} aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
                Your message
                <span className={`text-xs font-normal tabular-nums ${message.length > MAX - 100 ? "text-danger" : "text-muted"}`}>
                  {message.length}/{MAX}
                </span>
              </span>
              <textarea
                ref={box}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                rows={6}
                placeholder={current.placeholder}
                className={`${inputClass} resize-y`}
              />
            </label>
            <p className="text-xs leading-relaxed text-muted">
              We also see which page you&apos;re on and the device you&apos;re using, to help us find problems. Please don&apos;t write passwords here.
            </p>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}

        {!sent && (
          <footer className="flex justify-end gap-2 border-t border-line bg-background/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <button type="button" onClick={onClose} disabled={pending} className={button("secondary")}>
              Cancel
            </button>
            <button type="button" onClick={send} disabled={pending} className={button("primary")}>
              {pending && <Spinner className="size-4" />} {pending ? "Sending…" : "Send"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// "Send feedback" in the sidebar, for everyone who is signed in. It opens a short form over the page.
export function FeedbackButton({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? "Send feedback" : undefined}
        aria-haspopup="dialog"
        className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground ${
          collapsed ? "justify-center px-0" : "px-3"
        }`}
      >
        <MessageSquarePlus className="size-[18px] shrink-0" aria-hidden />
        {collapsed ? <span className="sr-only">Send feedback</span> : "Send feedback"}
      </button>
      {mounted && open && createPortal(
        <Dialog
          onClose={() => {
            setOpen(false);
            // On a phone the side menu is open behind this: closing the form closes the menu too.
            onNavigate?.();
          }}
        />,
        document.body,
      )}
    </>
  );
}
