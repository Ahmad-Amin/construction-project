"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { inputClass } from "@/lib/ui";

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const onlyDigits = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 15);

// A money field that puts the commas in as you type (35000000 becomes 35,000,000) and keeps the
// cursor where you were. It submits plain digits under `name`, so the server never sees commas.
// Use it uncontrolled (defaultValue) in forms, or controlled (value + onValueChange).
export function AmountInput({
  name,
  defaultValue = "",
  value,
  onValueChange,
  className = "",
  ...rest
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (digits: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "name" | "type">) {
  const [inner, setInner] = useState(() => onlyDigits(defaultValue));
  const digits = value !== undefined ? onlyDigits(value) : inner;
  const ref = useRef<HTMLInputElement>(null);
  // Where the cursor should go after the next render, counted in digits to its left.
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const wanted = caretDigits.current;
    if (!el || wanted === null || document.activeElement !== el) return;
    caretDigits.current = null;
    let seen = 0;
    let pos = 0;
    while (pos < el.value.length && seen < wanted) {
      if (/\d/.test(el.value[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    caretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
    const next = onlyDigits(raw);
    setInner(next);
    onValueChange?.(next);
  }

  return (
    <>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={group(digits)}
        onChange={handleChange}
        className={`${inputClass} ${className}`}
        {...rest}
      />
      {name && <input type="hidden" name={name} value={digits} />}
    </>
  );
}
