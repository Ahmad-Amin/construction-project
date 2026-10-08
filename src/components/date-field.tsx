"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DayPicker } from "@daypicker/react";
import "@daypicker/react/style.css";
import { Calendar, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { inputClass } from "@/lib/ui";

// Calendar days travel as plain "2026-10-08" strings, never as moments in time, so no timezone
// can ever shift a date by one.
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const isIso = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

// A date field with a proper calendar (month and year pickers, today shortcut) in place of the
// browser's own date input. It submits the date as YYYY-MM-DD under `name`, like the native one
// did, so nothing on the server changes. Use it uncontrolled (defaultValue) or controlled
// (value + onValueChange).
export function DateField({
  name,
  defaultValue = "",
  value,
  onValueChange,
  min,
  max,
  today,
  required = false,
  placeholder = "Select a date",
  className = "",
  popoverClassName = "",
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (iso: string) => void;
  // Earliest and latest date that can be picked, as YYYY-MM-DD.
  min?: string;
  max?: string;
  // Today's date as YYYY-MM-DD (the page knows it in Pakistan time); the device's date if omitted.
  today?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
}) {
  const [inner, setInner] = useState(isIso(defaultValue) ? defaultValue : "");
  const current = value !== undefined ? (isIso(value) ? value : "") : inner;
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  const todayIso = isIso(today) ? today : toIso(new Date());
  const selected = current ? fromIso(current) : undefined;
  const thisYear = Number(todayIso.slice(0, 4));
  const startYear = Math.min(isIso(min) ? Number(min.slice(0, 4)) : thisYear - 10, selected?.getFullYear() ?? thisYear);
  const endYear = Math.max(isIso(max) ? Number(max.slice(0, 4)) : thisYear + 10, selected?.getFullYear() ?? thisYear);

  function choose(iso: string) {
    setInner(iso);
    onValueChange?.(iso);
    setOpen(false);
    trigger.current?.focus();
  }

  // Keep the calendar on screen: open it towards the right edge when the field is near it.
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    setAlignRight(rect.left + 330 > window.innerWidth);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const disabled = [
    ...(isIso(min) ? [{ before: fromIso(min) }] : []),
    ...(isIso(max) ? [{ after: fromIso(max) }] : []),
  ];
  const todayOk = (!isIso(min) || todayIso >= min) && (!isIso(max) || todayIso <= max);

  return (
    <div ref={root} className="date-field relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className={`${inputClass} flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${current ? "" : "text-muted/70"}`}>{current ? formatDate(current) : placeholder}</span>
        <Calendar className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {/* Lets the browser enforce "required" and carries the value into the form. */}
      <input
        name={name}
        value={current}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
      />

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose a date"
          className={`absolute z-40 mt-1.5 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-3 shadow-xl shadow-black/20 ${
            alignRight ? "right-0" : "left-0"
          } ${popoverClassName}`}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => date && choose(toIso(date))}
            defaultMonth={selected ?? fromIso(todayIso)}
            today={fromIso(todayIso)}
            weekStartsOn={1}
            captionLayout="dropdown"
            startMonth={new Date(startYear, 0)}
            endMonth={new Date(endYear, 11)}
            disabled={disabled}
            autoFocus
          />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            {todayOk ? (
              <button type="button" onClick={() => choose(todayIso)} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-data-accent hover:bg-surface-2">
                Today
              </button>
            ) : (
              <span />
            )}
            {!required && current && (
              <button
                type="button"
                onClick={() => choose("")}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
