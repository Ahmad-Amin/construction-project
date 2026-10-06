"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, FileText, Share2 } from "lucide-react";
import { button } from "@/lib/ui";

const noopSubscribe = () => () => {};

// True where the browser can hand a file to other apps (WhatsApp, email...), which is
// most phones. Checked in the browser only, so server and client first render agree.
function canShareFiles() {
  try {
    const probe = new File([""], "statement.pdf", { type: "application/pdf" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function StatementButtons({ projectId, projectName }: { projectId: string; projectName: string }) {
  const shareable = useSyncExternalStore(noopSubscribe, canShareFiles, () => false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/dashboard/projects/${projectId}/statement`;

  // Fetches the PDF and offers it to the phone's share sheet, so it attaches straight to a WhatsApp chat.
  async function share() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const name = `${projectName.replace(/[^\w]+/g, "-").toLowerCase()}-statement.pdf`;
      const file = new File([blob], name, { type: "application/pdf" });
      await navigator.share({
        files: [file],
        title: `${projectName} statement`,
        text: `Project statement for ${projectName}`,
      });
    } catch (e) {
      // Closing the share sheet is not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError("We couldn't share the statement. Try Download instead.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a href={url} download className={button("secondary", "sm")}>
        <Download className="size-4" aria-hidden /> Statement PDF
      </a>
      {shareable && (
        <button type="button" onClick={share} disabled={busy} className={button("secondary", "sm")}>
          {busy ? <FileText className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
          {busy ? "Preparing…" : "Share PDF"}
        </button>
      )}
      {error && (
        <span role="alert" className="basis-full text-sm text-danger">
          {error}
        </span>
      )}
    </>
  );
}
