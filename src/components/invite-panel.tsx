"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { whatsappNumber } from "@/lib/format";
import { button } from "@/lib/ui";

export function InvitePanel({
  link,
  clientName,
  clientPhone,
  companyName,
  projectName,
}: {
  link: string;
  clientName: string;
  clientPhone: string | null;
  companyName: string;
  projectName: string;
}) {
  const [copied, setCopied] = useState(false);

  const message =
    `Assalam o Alaikum ${clientName}, ${companyName} has set up a project page for ${projectName}. ` +
    `Open this link to follow progress, payments and updates: ${link}`;
  const phone = whatsappNumber(clientPhone);
  const whatsappHref = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is selectable in the box below.
    }
  }

  return (
    <div className="space-y-3">
      <input
        readOnly
        value={link}
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={whatsappHref} target="_blank" rel="noreferrer" className={button("primary", "sm")}>
          <MessageCircle className="size-4" aria-hidden /> Send on WhatsApp
        </a>
        <button type="button" onClick={copy} className={button("secondary", "sm")}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
