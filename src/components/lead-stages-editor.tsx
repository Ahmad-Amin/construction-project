"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { addLeadStage, removeLeadStage, renameLeadStage, reorderLeadStages, setLeadStageColor } from "@/app/dashboard/leads/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { STAGE_COLORS, stageHex, type StageColor } from "@/lib/leads";
import { button, inputClass } from "@/lib/ui";

export type StageRow = { id: string; name: string; leads: number; color: StageColor };

const MAX_STAGES = 12;

// The owner's lead stages: colour, rename, reorder, add, remove. A stage that still has leads asks where they should go
// first. Won and Lost are not stages: they are how a lead ends, so they are always there.
export function LeadStagesEditor({ stages: given }: { stages: StageRow[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [stages, setStages] = useState(given);
  // New stages from the server (after a save) replace what is shown.
  const [from, setFrom] = useState(given);
  if (from !== given) {
    setFrom(given);
    setStages(given);
  }
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  // The stage whose colour is being picked.
  const [coloring, setColoring] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const run = (fn: () => Promise<{ error?: string }>, done?: string, onError?: () => void) =>
    start(async () => {
      const result = await fn();
      if (result.error) {
        toast.error("That didn't save", result.error);
        onError?.();
      } else if (done) toast.success(done);
    });

  function rename(id: string, name: string) {
    const before = given.find((s) => s.id === id)?.name ?? "";
    if (name.trim() === before || !name.trim()) {
      setStages((list) => list.map((s) => (s.id === id ? { ...s, name: before } : s)));
      return;
    }
    run(() => renameLeadStage(id, name), "Stage renamed", () => setStages((list) => list.map((s) => (s.id === id ? { ...s, name: before } : s))));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...stages];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setStages(next);
    run(() => reorderLeadStages(next.map((s) => s.id)), undefined, () => setStages(given));
  }

  function recolor(id: string, color: StageColor) {
    setColoring(null);
    const before = given.find((s) => s.id === id)?.color;
    if (!before || before === color) return;
    setStages((list) => list.map((s) => (s.id === id ? { ...s, color } : s)));
    run(() => setLeadStageColor(id, color), undefined, () => setStages((list) => list.map((s) => (s.id === id ? { ...s, color: before } : s))));
  }

  async function remove(stage: StageRow) {
    if (stage.leads > 0) {
      setRemoving(stage.id);
      setMoveTo(stages.find((s) => s.id !== stage.id)?.id ?? "");
      return;
    }
    if (await confirm({ title: `Remove the stage ${stage.name}?`, confirmLabel: "Remove", tone: "danger" })) {
      run(() => removeLeadStage(stage.id, null), "Stage removed");
    }
  }

  return (
    <div className="space-y-4">
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {stages.map((s, i) => (
          <li key={s.id} className="px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
              <button
                type="button"
                onClick={() => setColoring(coloring === s.id ? null : s.id)}
                aria-expanded={coloring === s.id}
                aria-label={`Colour of ${s.name}: ${STAGE_COLORS.find((c) => c.id === s.color)?.label}. Change it`}
                title="Change the colour"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-2"
              >
                <span className="size-4 rounded-full ring-2 ring-surface ring-offset-1 ring-offset-line" style={{ background: stageHex(s.color) }} aria-hidden />
              </button>
              <input
                value={s.name}
                maxLength={40}
                aria-label={`Name of stage ${i + 1}`}
                onChange={(e) => setStages((list) => list.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                onBlur={(e) => rename(s.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className={`${inputClass} min-w-0 flex-1 py-1.5 sm:py-1.5`}
              />
              <span className="hidden w-16 shrink-0 text-right text-xs text-muted sm:block">{s.leads === 1 ? "1 lead" : `${s.leads} leads`}</span>
              <button type="button" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${s.name} up`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30">
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" disabled={pending || i === stages.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${s.name} down`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30">
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button type="button" disabled={pending || stages.length <= 1} onClick={() => remove(s)} aria-label={`Remove ${s.name}`} className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-30">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            {coloring === s.id && (
              <div role="group" aria-label={`Colours for ${s.name}`} className="mt-2.5 flex flex-wrap gap-2 rounded-lg bg-surface-2 p-3">
                {STAGE_COLORS.map((c) => {
                  const on = c.id === s.color;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => recolor(s.id, c.id)}
                      aria-pressed={on}
                      aria-label={c.label}
                      title={c.label}
                      className={`flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        on ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface-2" : ""
                      }`}
                      style={{ background: c.hex }}
                    >
                      {on && <Check className="size-4 text-white" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            )}
            {removing === s.id && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-3 text-sm">
                <span>
                  Move its {s.leads === 1 ? "lead" : `${s.leads} leads`} to
                </span>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move its leads to" className={`${inputClass} w-auto py-1.5 sm:py-1.5`}>
                  {stages
                    .filter((x) => x.id !== s.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !moveTo}
                  onClick={() => {
                    run(() => removeLeadStage(s.id, moveTo), "Stage removed");
                    setRemoving(null);
                  }}
                  className={button("primary", "sm")}
                >
                  Move and remove
                </button>
                <button type="button" onClick={() => setRemoving(null)} className={button("ghost", "sm")}>
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
        <li className="flex items-center gap-2 bg-surface-2/50 px-3 py-2.5 text-sm text-muted sm:px-4">
          <span className="w-5 shrink-0" />
          <span>
            Then <span className="font-semibold text-foreground">Won</span> or <span className="font-semibold text-foreground">Lost</span>: how every
            lead ends.
          </span>
        </li>
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(() => addLeadStage(newName), "Stage added", undefined);
          setNewName("");
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          disabled={stages.length >= MAX_STAGES}
          aria-label="New stage name"
          placeholder={stages.length >= MAX_STAGES ? "You have the most stages (12)" : "Like 'Rate agreed'"}
          className={`${inputClass} min-w-0 flex-1 sm:max-w-xs`}
        />
        <button type="submit" disabled={pending || !newName.trim() || stages.length >= MAX_STAGES} className={button("secondary")}>
          <Plus className="size-4" aria-hidden /> Add stage
        </button>
      </form>
    </div>
  );
}
