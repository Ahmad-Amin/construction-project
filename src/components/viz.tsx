import type { LucideIcon } from "lucide-react";
import { formatPKR } from "@/lib/format";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

// ---------------------------------------------------------------------------
// Progress ring: one ratio against 100%. Thin stroke, rounded cap, and the
// unfilled track is a lighter step of the same amber.
// ---------------------------------------------------------------------------
export function ProgressRing({
  percent,
  size = 72,
  stroke = 7,
  children,
  label = "complete",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const value = clamp(percent);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);

  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value}% ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--data-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="animate-ring"
          style={{ "--ring-circ": circ, "--ring-offset": offset } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline: the shape of a number over time. The current (last) point gets a
// marker with a surface ring so it stays legible.
// ---------------------------------------------------------------------------
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 104;
  const h = 34;
  const pad = 5;
  const n = values.length;
  const max = Math.max(...values, 0);

  if (n < 2) return null;

  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (n - 1);
    const y = max === 0 ? h - pad : h - pad - (v / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const [lx, ly] = pts[n - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="overflow-visible">
      <path d={area} fill="var(--data-accent)" opacity="0.1" />
      <path d={line} fill="none" stroke="var(--data-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="4" fill="var(--data-accent)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stat tile: label, value, optional context line and trend.
// ---------------------------------------------------------------------------
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  spark,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  spark?: { values: number[]; label: string };
  delay?: number;
}) {
  return (
    <div
      className="animate-rise relative overflow-hidden rounded-2xl border border-line bg-surface p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-data-accent">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {spark && (
          <div className="hidden sm:block">
            <Sparkline values={spark.values} label={spark.label} />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Budget, received and spent on one shared scale. Each row is labelled directly,
// and the amber and neutral bars are told apart by label as well as colour.
// ---------------------------------------------------------------------------
export function MoneyBars({
  budget,
  received,
  spent,
  receivedLabel = "Received",
  spentLabel = "Spent",
}: {
  budget: number | null;
  received: number | null;
  spent: number;
  receivedLabel?: string;
  spentLabel?: string;
}) {
  const scale = Math.max(budget ?? 0, received ?? 0, spent, 1);
  const rows = [
    ...(budget !== null ? [{ key: "budget", label: "Budget", value: budget, fill: "bg-line" }] : []),
    ...(received !== null
      ? [{ key: "received", label: receivedLabel, value: received, fill: "bg-data-accent" }]
      : []),
    { key: "spent", label: spentLabel, value: spent, fill: "bg-data-neutral" },
  ];

  return (
    <ul className="space-y-4">
      {rows.map((row, i) => {
        const pct = clamp((row.value / scale) * 100);
        const ofBudget =
          budget && row.key !== "budget" ? `${Math.round((row.value / budget) * 100)}% of budget` : null;
        return (
          <li key={row.key}>
            <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-right tabular-nums">
                <span className="block font-semibold">{formatPKR(row.value)}</span>
                {ofBudget && <span className="block text-xs text-muted">{ofBudget}</span>}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="presentation">
              <div
                className={`animate-grow h-full rounded-full ${row.fill}`}
                style={{ width: `${pct}%`, animationDelay: `${200 + i * 120}ms` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
