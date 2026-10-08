"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Images, Receipt, X } from "lucide-react";
import {
  createExpense,
  updateExpense,
} from "@/app/dashboard/projects/[id]/expenses/actions";
import { AmountInput } from "@/components/amount-input";
import { EXPENSE_CATEGORIES, expenseCategoryLabel, type ExpenseCategory } from "@/lib/expenses";
import { parseAmount } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { prepareReceipt } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { button, inputClass } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";

export type ExpenseFormValues = {
  amount: string;
  date: string;
  category: ExpenseCategory;
  note: string;
  clientVisible: boolean;
  receiptPath: string | null;
  receiptUrl: string | null;
};

export function ExpenseForm({
  projectId,
  expenseId,
  initial,
  today,
  isOwner,
}: {
  projectId: string;
  // Present when editing an existing expense.
  expenseId?: string;
  initial: ExpenseFormValues;
  today: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const editing = !!expenseId;
  // One id per draft. Retrying a failed save re-uses it, so it can never save twice.
  const draftId = useRef(expenseId ?? newId());
  const uploadedPath = useRef<string | null>(null);

  const [amount, setAmount] = useState(initial.amount);
  const [date, setDate] = useState(initial.date);
  const [category, setCategory] = useState<ExpenseCategory>(initial.category);
  const [note, setNote] = useState(initial.note);
  const [clientVisible, setClientVisible] = useState(initial.clientVisible);
  const [file, setFile] = useState<{ file: File; preview: string } | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null;

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const preview = useRef<string | null>(null);
  useEffect(() => {
    preview.current = file?.preview ?? null;
  });
  useEffect(() => () => {
    if (preview.current) URL.revokeObjectURL(preview.current);
  }, []);

  function pick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked || !picked.type.startsWith("image/")) return;
    setFile((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return { file: picked, preview: URL.createObjectURL(picked) };
    });
    uploadedPath.current = null; // a new file replaces any earlier upload attempt
    setRemoveReceipt(false);
  }

  function clearFile() {
    setFile((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return null;
    });
    uploadedPath.current = null;
  }

  const shownReceipt = file?.preview ?? (!removeReceipt ? initial.receiptUrl : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const parsed = parseAmount(amount, "the amount");
    if (parsed.error) return setError(parsed.error);
    if (!parsed.value) return setError("Please enter the amount.");
    setError(null);

    try {
      // Which receipt file ends up attached, and which old one (if any) to tidy away.
      let receiptPath = removeReceipt ? null : initial.receiptPath;
      let replaced: string | null = removeReceipt || file ? initial.receiptPath : null;

      if (file) {
        if (!uploadedPath.current) {
          setStatus("Uploading receipt…");
          let blob: Blob;
          try {
            blob = await prepareReceipt(file.file);
          } catch {
            return setError("That photo couldn't be read. Please choose another.");
          }
          const path = `${projectId}/receipts/${draftId.current}/${newId()}.jpg`;
          const ok = await uploadWithRetry(createClient(), path, blob);
          if (!ok) {
            return setError(
              "The receipt didn't upload. Check your connection and tap Save again. Your details are kept.",
            );
          }
          uploadedPath.current = path;
        }
        receiptPath = uploadedPath.current;
      }
      if (replaced === receiptPath) replaced = null;

      setStatus("Saving…");
      const input = {
        amount: parsed.value,
        date,
        category,
        note: note.trim(),
        receiptPath,
        clientVisible,
      };
      const result = editing
        ? await updateExpense(projectId, draftId.current, input, replaced)
        : await createExpense(projectId, draftId.current, input);
      if (result.error) return setError(result.error);

      router.push(`/dashboard/projects/${projectId}/expenses`);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Amount (PKR)</span>
          <AmountInput
            value={amount}
            onValueChange={setAmount}
            required
            placeholder="250,000"
            className="text-lg font-semibold"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className={inputClass}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {expenseCategoryLabel[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Date</span>
            <input
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Vendor or note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Steel, Ittefaq Steel Lahore"
            className={inputClass}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-semibold">Receipt</h2>
        <p className="mt-0.5 text-sm text-muted">Optional, but a photo of the receipt builds trust.</p>

        {shownReceipt && (
          <div className="relative mt-4 w-40 overflow-hidden rounded-lg bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed or local preview URL */}
            <img src={shownReceipt} alt="Receipt preview" className="aspect-[3/4] w-full object-cover" />
            {!busy && (
              <button
                type="button"
                onClick={() => {
                  if (file) clearFile();
                  else setRemoveReceipt(true);
                }}
                aria-label="Remove receipt"
                className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/65 text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraInput.current?.click()}
            className={button("secondary")}
          >
            <Camera className="size-5" aria-hidden /> {shownReceipt ? "Retake" : "Take photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => galleryInput.current?.click()}
            className={button("secondary")}
          >
            <Images className="size-5" aria-hidden /> Choose from gallery
          </button>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        {isOwner ? (
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={clientVisible}
              onChange={(e) => setClientVisible(e.target.checked)}
              className="mt-0.5 size-5 accent-primary"
            />
            <span className="text-sm">
              <span className="font-medium">Show this expense to the client</span>
              <span className="block text-muted">
                Off by default. The client sees it, and its receipt, only when this is on.
              </span>
            </span>
          </label>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted">
            <Receipt className="mt-0.5 size-4 shrink-0" aria-hidden />
            The owner decides which expenses the client can see.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
          {status}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/dashboard/projects/${projectId}/expenses`} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={busy} className={button("primary")}>
          {busy ? "Please wait…" : editing ? "Save changes" : "Save expense"}
        </button>
      </div>
    </form>
  );
}
