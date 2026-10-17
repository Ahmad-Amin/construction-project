"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { button, inputClass } from "@/lib/ui";

// The app's own "Are you sure?" box, in place of the browser's alert. Any component asks with
//   if (await confirm({ title: "Delete this update?", confirmLabel: "Delete", tone: "danger" })) { ... }
// and, when it needs a few words from the person (a reason), with
//   const reason = await ask({ title: "Cancel this invoice?", input: { label: "Reason" } }); // null when they back out

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // "danger" for deleting and cancelling: a red button and a warning icon.
  tone?: "danger" | "primary";
};

export type AskOptions = ConfirmOptions & {
  input: { label: string; placeholder?: string; maxLength?: number; optional?: boolean };
};

type Request = (AskOptions | ConfirmOptions) & { resolve: (value: string | null) => void };

type Api = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  ask: (o: AskOptions) => Promise<string | null>;
};

// Outside the provider (a page that doesn't have it), fall back to the browser's own boxes so nothing breaks.
const fallback: Api = {
  confirm: async (o) => window.confirm([o.title, o.message].filter(Boolean).join("\n\n")),
  ask: async (o) => window.prompt([o.title, o.message, o.input.label].filter(Boolean).join("\n\n"), ""),
};

const ConfirmContext = createContext<Api>(fallback);

export const useConfirm = () => useContext(ConfirmContext).confirm;
export const useAsk = () => useContext(ConfirmContext).ask;

const subscribe = () => () => {};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...o, resolve: (v) => resolve(v !== null) })),
    [],
  );
  const ask = useCallback((o: AskOptions) => new Promise<string | null>((resolve) => setRequest({ ...o, resolve })), []);

  // Stable, so the open dialog doesn't reset itself when the page around it re-renders.
  const close = useCallback((value: string | null) => {
    setRequest((current) => {
      if (current) queueMicrotask(() => current.resolve(value));
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, ask }}>
      {children}
      {mounted && request && createPortal(<Dialog request={request} onClose={close} />, document.body)}
    </ConfirmContext.Provider>
  );
}

function Dialog({ request: r, onClose }: { request: Request; onClose: (value: string | null) => void }) {
  const input = "input" in r ? r.input : null;
  const [text, setText] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const danger = r.tone === "danger";
  const Icon = danger ? AlertTriangle : HelpCircle;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The safe choice is focused first for anything destructive, so a stray Enter doesn't delete.
    (input ? fieldRef.current : danger ? cancelRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
  }, [danger, input, onClose]);

  const canConfirm = !input || input.optional || text.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={() => onClose(null)} className="animate-fade absolute inset-0 bg-black/55" />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={r.message ? "confirm-message" : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) onClose(input ? text.trim() : "");
        }}
        className="animate-rise relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"}`}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-1.5">
            <h2 id="confirm-title" className="text-base font-semibold leading-snug">
              {r.title}
            </h2>
            {r.message && (
              <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-muted">
                {r.message}
              </p>
            )}
          </div>
        </div>

        {input && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium">
              {input.label}
              {input.optional && <span className="font-normal text-muted"> (optional)</span>}
            </span>
            <textarea
              ref={fieldRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={input.maxLength ?? 300}
              placeholder={input.placeholder}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </label>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={() => onClose(null)} className={button("secondary")}>
            {r.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            disabled={!canConfirm}
            className={button(danger ? "danger" : "primary")}
          >
            {r.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
