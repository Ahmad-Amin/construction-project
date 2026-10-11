"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import {
  addMilestone,
  moveMilestone,
  removeMilestone,
  renameMilestone,
  setProgress,
  type ActionResult,
} from "@/app/dashboard/projects/[id]/progress/actions";
import { ProgressBar } from "@/components/project-bits";
import { ProgressRing } from "@/components/viz";
import { milestoneStatusLabel } from "@/lib/project";
import type { Milestone } from "@/lib/types";
import { button, inputClass } from "@/lib/ui";

// owner: everything. staff: progress only. readonly: homeowners.
export type EditorMode = "owner" | "staff" | "readonly";

export function MilestoneEditor({
  projectId,
  milestones,
  mode,
}: {
  projectId: string;
  milestones: Milestone[];
  mode: EditorMode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  function run(task: () => Promise<ActionResult>, onDone?: () => void) {
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (result.error) setError(result.error);
      else onDone?.();
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {milestones.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No milestones yet.{mode === "owner" && " Add the first one below."}
        </p>
      )}

      <ul className="space-y-3">
        {milestones.map((m, i) => (
          // Remount when saved progress changes so the slider matches the server.
          <MilestoneRow
            key={`${m.id}-${m.progress_percent}`}
            milestone={m}
            mode={mode}
            busy={pending}
            index={i}
            isFirst={i === 0}
            isLast={i === milestones.length - 1}
            onProgress={(percent) => run(() => setProgress(projectId, m.id, percent))}
            onRename={(name) => run(() => renameMilestone(projectId, m.id, name))}
            onMove={(dir) => run(() => moveMilestone(projectId, m.id, dir))}
            onDelete={() => {
              if (window.confirm(`Delete "${m.name}"? This can't be undone.`)) {
                run(() => removeMilestone(projectId, m.id));
              }
            }}
          />
        ))}
      </ul>

      {mode === "owner" && (
        <form
          className="mt-5 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (name) run(() => addMilestone(projectId, name), () => setNewName(""));
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New milestone, e.g. Tiling"
            aria-label="New milestone name"
            className={inputClass}
          />
          <button type="submit" disabled={pending || !newName.trim()} className={`${button("primary")} shrink-0`}>
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </form>
      )}
    </div>
  );
}

function MilestoneRow({
  milestone: m,
  mode,
  busy,
  index,
  isFirst,
  isLast,
  onProgress,
  onRename,
  onMove,
  onDelete,
}: {
  milestone: Milestone;
  mode: EditorMode;
  busy: boolean;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onProgress: (percent: number) => void;
  onRename: (name: string) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(m.progress_percent);
  const lastSaved = useRef(m.progress_percent);
  const editable = mode !== "readonly";
  const done = m.status === "done";

  const save = (percent: number) => {
    if (percent === lastSaved.current) return; // release and blur can both fire
    lastSaved.current = percent;
    onProgress(percent);
  };

  // Save when the finger or key is released, not on every tick of the slider.
  const commit = () => save(value);

  // One row per milestone. On a wide screen it reads left to right: the stage, its slider, the
  // number and the actions, in columns that line up from row to row. On a phone it stacks.
  return (
    <li className="rounded-2xl border border-line bg-surface p-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-x-6">
      <div className="flex items-center gap-3">
        <ProgressRing percent={value} size={44} stroke={4} tone={done ? "success" : "accent"} label={`${m.name} complete`}>
          {done ? (
            <Check className="size-5 text-success" aria-hidden />
          ) : (
            <span className="text-sm font-bold tabular-nums text-muted">{index + 1}</span>
          )}
        </ProgressRing>

        <div className="min-w-0 flex-1">
          {mode === "owner" ? (
            <input
              defaultValue={m.name}
              aria-label="Milestone name"
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== m.name) onRename(name);
                else e.target.value = m.name;
              }}
              className="-ml-1 w-full min-w-0 rounded-md bg-transparent px-1 py-0.5 font-semibold outline-none hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-primary/30"
            />
          ) : (
            <h3 className="truncate font-semibold">{m.name}</h3>
          )}
          <p
            className={`text-xs ${
              done ? "font-medium text-success" : m.status === "in_progress" ? "font-medium text-primary-hover" : "text-muted"
            }`}
          >
            {milestoneStatusLabel[m.status]}
          </p>
        </div>

        <span className="shrink-0 text-xl font-bold tabular-nums lg:hidden">{value}%</span>
      </div>

      <div className="mt-3 flex items-center gap-3 lg:mt-0">
        {editable ? (
          <>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={value}
              disabled={busy}
              aria-label={`${m.name} progress`}
              onChange={(e) => setValue(Number(e.target.value))}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              className="h-6 min-w-0 flex-1 accent-primary"
            />
            {value < 100 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => save(100)}
                className={`${button("secondary", "sm")} w-[5.25rem] shrink-0`}
              >
                <Check className="size-4" aria-hidden /> Done
              </button>
            ) : (
              <span aria-hidden className="hidden w-[5.25rem] shrink-0 lg:block" />
            )}
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <ProgressBar percent={m.progress_percent} />
          </div>
        )}
      </div>

      <div
        className={`mt-3 flex items-center justify-end gap-1 lg:mt-0 lg:min-w-[12rem] ${
          mode === "owner" ? "border-t border-line pt-2 lg:border-0 lg:pt-0" : "hidden lg:flex"
        }`}
      >
        <span className="mr-auto hidden w-16 text-right text-xl font-bold tabular-nums lg:mr-2 lg:block">{value}%</span>
        {mode === "owner" && (
          <>
            <IconButton label="Move up" disabled={busy || isFirst} onClick={() => onMove("up")}>
              <ArrowUp className="size-4" aria-hidden />
            </IconButton>
            <IconButton label="Move down" disabled={busy || isLast} onClick={() => onMove("down")}>
              <ArrowDown className="size-4" aria-hidden />
            </IconButton>
            <IconButton label={`Delete ${m.name}`} disabled={busy} onClick={onDelete} danger>
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 disabled:opacity-40 ${
        danger ? "text-danger" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
