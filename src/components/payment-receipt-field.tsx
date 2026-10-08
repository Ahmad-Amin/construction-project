"use client";

import { useRef, useState } from "react";
import { Camera, Images, X } from "lucide-react";
import { newId } from "@/lib/ids";
import { prepareReceipt } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { button } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";

// Optional proof of payment inside the payment form. The photo is shrunk and uploaded as soon as
// it is chosen, and the form only carries its storage path (`receipt_path`) when it is saved.
// While a photo is uploading it tells the form, so Save waits.
export function PaymentReceiptField({
  projectId,
  paymentId,
  initialPath,
  initialUrl,
  onBusyChange,
}: {
  projectId: string;
  paymentId: string;
  initialPath: string | null;
  initialUrl: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const [path, setPath] = useState<string>(initialPath ?? "");
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  // Files uploaded during this visit that are not (or no longer) attached: tidied away.
  const uploadedHere = useRef<string | null>(null);

  async function discardUpload() {
    const old = uploadedHere.current;
    uploadedHere.current = null;
    if (old) await createClient().storage.from("project-media").remove([old]);
  }

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo.");
      return;
    }
    setError(null);
    setBusy(true);
    onBusyChange(true);
    try {
      const blob = await prepareReceipt(file);
      const next = `${projectId}/payments/${paymentId}/${newId()}.jpg`;
      const ok = await uploadWithRetry(createClient(), next, blob);
      if (!ok) {
        setError("The receipt didn't upload. Check your connection and try again.");
        return;
      }
      await discardUpload();
      uploadedHere.current = next;
      setPath(next);
      setPreview((old) => {
        if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch {
      setError("We couldn't read that photo. Please try another one.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function remove() {
    setError(null);
    await discardUpload();
    setPath("");
    setPreview(null);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-semibold">Receipt</h2>
      <p className="mt-0.5 text-sm text-muted">
        Optional. A photo of the bank transfer, cheque or receipt helps the other side confirm quickly.
      </p>

      <input type="hidden" name="receipt_path" value={path} />

      {preview && (
        <div className="relative mt-4 w-40 overflow-hidden rounded-lg bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed or local preview URL */}
          <img src={preview} alt="Receipt preview" className="aspect-[3/4] w-full object-cover" />
          {!busy && (
            <button
              type="button"
              onClick={remove}
              aria-label="Remove receipt"
              className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/65 text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy} onClick={() => cameraInput.current?.click()} className={button("secondary")}>
          <Camera className="size-5" aria-hidden /> {preview ? "Retake" : "Take photo"}
        </button>
        <button type="button" disabled={busy} onClick={() => galleryInput.current?.click()} className={button("secondary")}>
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
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />

      {busy && (
        <p role="status" className="mt-3 text-sm text-muted">
          Uploading receipt…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
