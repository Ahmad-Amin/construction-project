"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from "lucide-react";
import {
  addMilestone,
  moveMilestone,
  removeMilestone,
  renameMilestone,
  setProgress,
  type ActionResult,
} from "@/app/dashboard/projects/[id]/progress/actions";
import { ProgressBar } from "@/components/project-bits";
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
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
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
          className="mt-5 flex gap-2"
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

  const save = (percent: number) => {
    if (percent === lastSaved.current) return; // release and blur can both fire
    lastSaved.current = percent;
    onProgress(percent);
  };

  // Save when the finger or key is released, not on every tick of the slider.
  const commit = () => save(value);

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        {mode === "owner" ? (
          <input
            defaultValue={m.name}
            aria-label="Milestone name"
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== m.name) onRename(name);
              else e.target.value = m.name;
            }}
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 font-semibold outline-none hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <h3 className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold">
            {m.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />}
            <span className="truncate">{m.name}</span>
          </h3>
        )}
        <span className="shrink-0 text-lg font-bold tabular-nums">{value}%</span>
      </div>

      <p className="mt-0.5 px-1 text-xs text-muted">{milestoneStatusLabel[m.status]}</p>

      {editable ? (
        <div className="mt-3 flex items-center gap-3">
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
            className="h-8 w-full accent-primary"
          />
          {value < 100 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save(100)}
              className={`${button("secondary", "sm")} shrink-0`}
            >
              Done
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <ProgressBar percent={m.progress_percent} />
        </div>
      )}

      {mode === "owner" && (
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-3">
          <IconButton label="Move up" disabled={busy || isFirst} onClick={() => onMove("up")}>
            <ArrowUp className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Move down" disabled={busy || isLast} onClick={() => onMove("down")}>
            <ArrowDown className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={`Delete ${m.name}`} disabled={busy} onClick={onDelete} danger>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      )}
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
      className={`flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 disabled:opacity-40 ${
        danger ? "text-danger" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
