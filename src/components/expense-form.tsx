"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Images, Receipt, X } from "lucide-react";
import {
  createExpense,
  updateExpense,
} from "@/app/dashboard/projects/[id]/expenses/actions";
import { AmountInput } from "@/components/amount-input";
import { DateField } from "@/components/date-field";
import { EXPENSE_CATEGORIES, expenseCategoryLabel, type ExpenseCategory } from "@/lib/expenses";
import { parseAmount } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { IMAGE_TOO_BIG, imageTooBig, prepareReceipt } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { CancelLink, useSheetBusy } from "@/components/sheet-lock";
import { button, inputClass } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";
import { useToast } from "@/components/toast";

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
  currency,
  expenseId,
  initial,
  today,
  isOwner,
  sheet = false,
}: {
  projectId: string;
  currency: string;
  // Present when editing an existing expense.
  expenseId?: string;
  initial: ExpenseFormValues;
  today: string;
  isOwner: boolean;
  // Shown in the slide-over panel: the buttons stay in view along the bottom while the form scrolls.
  sheet?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
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
  useSheetBusy(busy);

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
    if (!picked) return;
    if (!picked.type.startsWith("image/")) return setError("Please choose a photo of the receipt.");
    if (imageTooBig(picked)) return setError(IMAGE_TOO_BIG);
    setError(null);
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

      toast.success(editing ? "Expense updated" : "Expense added");
      router.push(`/dashboard/projects/${projectId}/expenses`);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className={sheet ? "flex flex-1 flex-col gap-4" : "space-y-4"}>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Amount ({currency})</span>
            <AmountInput
              value={amount}
              onValueChange={setAmount}
              required
              placeholder="250,000"
              className="font-semibold"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Date</span>
            <DateField value={date} onValueChange={setDate} max={today} today={today} required />
          </label>
        </div>

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
          <span className="mb-1.5 block text-sm font-medium">Vendor or note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Steel, City Steel Supply"
            className={inputClass}
          />
        </label>

        <div className="border-t border-line pt-4">
          <p className="text-sm font-medium">Receipt</p>
          <p className="mt-0.5 text-xs text-muted">Optional, but a photo of the receipt builds trust.</p>

          {shownReceipt && (
            <div className="relative mt-3 w-32 overflow-hidden rounded-lg bg-surface-2">
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

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraInput.current?.click()}
              className={button("secondary", "sm")}
            >
              <Camera className="size-4" aria-hidden /> {shownReceipt ? "Retake" : "Take photo"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => galleryInput.current?.click()}
              className={button("secondary", "sm")}
            >
              <Images className="size-4" aria-hidden /> Choose from gallery
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
        </div>

        <div className="border-t border-line pt-4">
          {isOwner ? (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={clientVisible}
                onChange={(e) => setClientVisible(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-sm">
                <span className="font-medium">Show this expense to the client</span>
                <span className="block text-xs text-muted">
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
        </div>
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

      <div
        className={`flex justify-end gap-2 ${
          sheet
            ? "sticky bottom-0 z-10 -mx-5 mt-auto border-t border-line bg-background/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-8 sm:px-8"
            : "pt-1"
        }`}
      >
        <CancelLink href={`/dashboard/projects/${projectId}/expenses`} busy={busy} />
        <button type="submit" disabled={busy} className={button("primary")}>
          {busy ? "Please wait…" : editing ? "Save changes" : "Save expense"}
        </button>
      </div>
    </form>
  );
}
