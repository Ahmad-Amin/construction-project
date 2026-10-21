"use client";

import { useState } from "react";
import { Download, Plus, X } from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { button, inputClass } from "@/lib/ui";

export type SchedulePreset = { id: string; label: string; stages: { name: string; percent: number }[] };

type Row = { key: number; name: string; percent: string };

const group = (n: number) => Math.round(n).toLocaleString("en-US");
// The columns of a stage line: name, share, amount, remove. On a phone the name spans the first line.
const grid = "grid grid-cols-[5.5rem_1fr_2rem] items-center gap-x-2 gap-y-1.5 sm:grid-cols-[1fr_5.5rem_8rem_2rem]";
const asNumber = (s: string) => Number.parseFloat(s) || 0;
// Percentages are kept to two decimals, so 12.5 + 87.5 is exactly 100.
const hundredths = (n: number) => Math.round(n * 100) / 100;

// A cell for the spreadsheet: quoted when it has to be, and never read as a formula (a stage name that starts
// with "=" stays text).
function cell(value: string | number) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The schedule as a CSV that Excel, Google Sheets and Numbers open. The contract value sits in B2 and each
// amount is a formula on it, so changing the value in the spreadsheet updates every stage. The formulas use
// no argument separators, so they read the same in countries that write numbers differently.
function toCsv(rows: Row[], total: number, currency: string) {
  const first = 5;
  const last = first + rows.length - 1;
  const lines = [
    ["Payment schedule"].map(cell),
    [cell("Contract value"), String(Math.round(total))],
    [],
    ["No.", "Stage (paid when this is complete)", "% of contract", `Amount (${currency})`, "Date paid", `Amount paid (${currency})`, "Reference or receipt"].map(cell),
    ...rows.map((r, i) => [String(i + 1), cell(r.name), String(asNumber(r.percent)), `=$B$2*C${first + i}/100`, "", "", ""]),
    ["", "Total", `=SUM(C${first}:C${last})`, `=SUM(D${first}:D${last})`, "", `=SUM(F${first}:F${last})`, ""],
  ];
  // The byte-order mark makes Excel read the file as UTF-8, so names in any language come through.
  return "﻿" + lines.map((l) => l.join(",")).join("\r\n") + "\r\n";
}

// Splits a contract value into stage payments. Starts from a preset (a new home, a renovation...), and every
// stage name and percentage can be changed, added or removed. Nothing is sent anywhere: the download is made
// in the browser.
export function PaymentScheduleCalculator({
  currency,
  presets,
  defaultValue,
}: {
  currency: string;
  presets: SchedulePreset[];
  defaultValue: number;
}) {
  const rowsFor = (preset: SchedulePreset): Row[] =>
    preset.stages.map((s, i) => ({ key: i, name: s.name, percent: String(s.percent) }));

  const [presetId, setPresetId] = useState(presets[0].id);
  const [value, setValue] = useState(String(defaultValue));
  const [rows, setRows] = useState<Row[]>(() => rowsFor(presets[0]));

  const total = Number(value) || 0;
  const percentSum = hundredths(rows.reduce((sum, r) => sum + asNumber(r.percent), 0));
  const complete = percentSum === 100;
  const amounts = rows.map((r) => Math.round((total * asNumber(r.percent)) / 100));
  // Rounding each stage can leave a unit or two over or under; the last stage takes it, so the stages add up
  // to the contract value exactly.
  if (complete && amounts.length > 0) amounts[amounts.length - 1] += total - amounts.reduce((a, b) => a + b, 0);
  const amountSum = amounts.reduce((a, b) => a + b, 0);

  function choose(preset: SchedulePreset) {
    setPresetId(preset.id);
    setRows(rowsFor(preset));
  }

  function update(key: number, change: Partial<Row>) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  function download() {
    const blob = new Blob([toCsv(rows, total, currency)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payment-schedule.csv";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
      {presets.length > 1 && (
        <div role="group" aria-label="Start from" className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1 text-sm font-medium">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={presetId === p.id}
              onClick={() => choose(p)}
              className={`rounded-full px-4 py-1.5 transition-colors ${presetId === p.id ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <label className="mt-5 block max-w-xs">
        <span className="mb-1.5 block text-sm font-medium">Contract value ({currency})</span>
        <AmountInput value={value} onValueChange={setValue} className="font-semibold" />
      </label>

      {/* One line per stage on a wide screen; on a phone the name gets its own line, with the share and
          amount under it, so long stage names stay readable. */}
      <div className="mt-5 text-sm">
        <div className={`${grid} hidden border-b border-line py-2 text-xs font-semibold uppercase tracking-wide text-muted sm:grid`} aria-hidden>
          <span>Paid when this is complete</span>
          <span className="text-right">%</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ol>
          {rows.map((r, i) => (
            <li key={r.key} data-stage className={`${grid} border-b border-line py-2.5 sm:py-1.5`}>
              <input
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                maxLength={80}
                placeholder="Stage"
                aria-label={`Stage ${i + 1}`}
                className={`${inputClass} col-span-3 py-1.5 sm:col-span-1 sm:py-1.5`}
              />
              <span className="relative">
                <input
                  value={r.percent}
                  onChange={(e) => update(r.key, { percent: e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 6) })}
                  inputMode="decimal"
                  aria-label={`Stage ${i + 1}, percent of the contract`}
                  className={`${inputClass} py-1.5 pr-6 text-right tabular-nums sm:py-1.5`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted" aria-hidden>
                  %
                </span>
              </span>
              <span data-amount className="text-right font-medium tabular-nums">
                {group(amounts[i])}
              </span>
              <button
                type="button"
                onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                disabled={rows.length === 1}
                aria-label={`Remove stage ${i + 1}`}
                className="inline-flex size-8 items-center justify-center justify-self-end rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <p data-total className={`${grid} py-2.5 font-semibold`}>
          <span className="col-span-3 sm:col-span-1">Total</span>
          <span className={`text-right tabular-nums ${complete ? "" : "text-danger"}`}>{percentSum}%</span>
          <span className="text-right tabular-nums">
            {currency} {group(amountSum)}
          </span>
          <span />
        </p>
      </div>

      <p role="status" className={`mt-1 text-sm ${complete ? "sr-only" : "text-danger"}`}>
        {complete
          ? "The stages add up to the whole contract."
          : `The stages add up to ${percentSum}%. Change them to make 100%, so the schedule covers the whole contract.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRows((all) => [...all, { key: Math.max(-1, ...all.map((r) => r.key)) + 1, name: "", percent: "" }])}
          className={button("secondary")}
        >
          <Plus className="size-4" aria-hidden /> Add a stage
        </button>
        <button type="button" onClick={download} className={button("primary")}>
          <Download className="size-4" aria-hidden /> Download the template
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        A spreadsheet (CSV) with your stages and space to record each payment. It opens in Excel, Google Sheets and Numbers.
      </p>
    </div>
  );
}
