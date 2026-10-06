"use client";

import { useCallback, useState } from "react";
import { Receipt } from "lucide-react";
import { Lightbox } from "@/components/lightbox";

export function ReceiptButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const noStep = useCallback(() => {}, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
      >
        <Receipt className="size-3.5" aria-hidden /> Receipt
      </button>
      {open && <Lightbox images={[url]} index={0} onClose={close} onStep={noStep} label="Receipt" />}
    </>
  );
}
