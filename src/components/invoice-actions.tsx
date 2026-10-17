"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Download, ExternalLink, Pencil, Send, Trash2 } from "lucide-react";
import { cancelInvoice, deleteInvoiceDraft, sendInvoice } from "@/app/dashboard/projects/[id]/invoices/actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { invoiceNumber, type InvoiceStatus } from "@/lib/invoices";
import { button } from "@/lib/ui";
import { useAsk, useConfirm } from "@/components/confirm-dialog";

// What can be done with an invoice from its page. The owner: send, edit or delete a draft; download, share or cancel a
// sent one. The homeowner: download it.
export function InvoiceActions({
  projectId,
  invoiceId,
  status,
  isOwner,
  clientName,
  clientJoined,
  whatsappHref,
}: {
  projectId: string;
  invoiceId: string;
  status: InvoiceStatus;
  isOwner: boolean;
  clientName: string;
  clientJoined: boolean;
  whatsappHref: string | null;
}) {
  const confirm = useConfirm();
  const ask = useAsk();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pdf = `/dashboard/projects/${projectId}/invoices/${invoiceId}/pdf`;
  const first = clientName.trim().split(/\s+/)[0] || "your client";

  const run = (task: () => Promise<{ error?: string; number?: number }>, done: (n?: number) => string, after?: () => void) =>
    startTransition(async () => {
      const result = await task();
      if (result.error) return setError(result.error);
      setError(null);
      toast.success(done(result.number));
      if (after) after();
      else router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {isOwner && status === "draft" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (
                  await confirm({
                    title: `Send this invoice to ${clientName || "your client"}?`,
                    message: clientJoined
                      ? "It gets its number and can't be changed afterwards. They get an email and see it in BuildPeek."
                      : "It gets its number and can't be changed afterwards. They haven't joined yet, so it will be waiting for them when they do.",
                    confirmLabel: "Send invoice",
                  })
                ) {
                  run(() => sendInvoice(projectId, invoiceId), (n) => `Invoice ${invoiceNumber(n ?? null)} sent to ${first}`);
                }
              }}
              className={button("primary")}
            >
              {pending ? <Spinner /> : <Send className="size-4" aria-hidden />} Send to {first}
            </button>
            <Link href={`/dashboard/projects/${projectId}/invoices/${invoiceId}/edit`} className={button("secondary")}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
            <a href={pdf} target="_blank" rel="noopener noreferrer" className={button("secondary")}>
              <ExternalLink className="size-4" aria-hidden /> Preview PDF
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (await confirm({ title: "Delete this draft?", message: "This can't be undone.", confirmLabel: "Delete draft", tone: "danger" })) {
                  run(() => deleteInvoiceDraft(projectId, invoiceId), () => "Draft deleted", () => router.push(`/dashboard/projects/${projectId}/payments`));
                }
              }}
              className={`${button("secondary")} text-danger`}
            >
              <Trash2 className="size-4" aria-hidden /> Delete draft
            </button>
          </>
        )}

        {status !== "draft" && (
          <a href={`${pdf}?download=1`} className={button(isOwner ? "secondary" : "primary")}>
            <Download className="size-4" aria-hidden /> Download PDF
          </a>
        )}
        {isOwner && status === "sent" && whatsappHref && <WhatsAppButton href={whatsappHref}>Share on WhatsApp</WhatsAppButton>}
        {isOwner && status === "sent" && (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              const reason = await ask({
                title: "Cancel this invoice?",
                message: `It keeps its number and stays on record. ${first === "your client" ? "Your client" : first} is told it was cancelled.`,
                input: { label: "Reason", placeholder: "Wrong amount", maxLength: 300, optional: true },
                confirmLabel: "Cancel invoice",
                cancelLabel: "Keep it",
                tone: "danger",
              });
              if (reason !== null) run(() => cancelInvoice(projectId, invoiceId, reason), () => "Invoice cancelled");
            }}
            className={`${button("secondary")} text-danger`}
          >
            <Ban className="size-4" aria-hidden /> Cancel invoice
          </button>
        )}
      </div>
      {isOwner && status === "draft" && !clientJoined && (
        <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-hover">
          {clientName || "Your client"} hasn&apos;t joined yet, so they won&apos;t get an email. The invoice will be waiting for them
          when they do, and you can also share it on WhatsApp once it&apos;s sent.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
