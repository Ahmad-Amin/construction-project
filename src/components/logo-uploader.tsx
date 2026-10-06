"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { setCompanyLogo } from "@/app/dashboard/settings/actions";
import { CompanyBadge } from "@/components/company-badge";
import { newId } from "@/lib/ids";
import { prepareLogo } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { button } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";

export function LogoUploader({
  companyId,
  companyName,
  logoUrl,
}: {
  companyId: string;
  companyName: string;
  logoUrl: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      return setError("Please choose a PNG, JPG or WebP image.");
    }
    setBusy(true);
    setError(null);
    try {
      const { blob, type, ext } = await prepareLogo(file);
      const path = `${companyId}/${newId()}.${ext}`;
      const ok = await uploadWithRetry(createClient(), path, blob, {
        bucket: "company-logos",
        contentType: type,
      });
      if (!ok) return setError("The logo didn't upload. Check your connection and try again.");
      const result = await setCompanyLogo(path);
      if (result.error) setError(result.error);
    } catch {
      setError("That image couldn't be read. Please try another one.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    const result = await setCompanyLogo(null);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <CompanyBadge name={companyName} logoUrl={logoUrl} size="lg" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={button("secondary", "sm")}>
            <ImagePlus className="size-4" aria-hidden /> {busy ? "Working…" : logoUrl ? "Change logo" : "Upload logo"}
          </button>
          {logoUrl && (
            <button type="button" disabled={busy} onClick={onRemove} className={button("ghost", "sm")}>
              <Trash2 className="size-4" aria-hidden /> Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-muted">Optional. Your clients see it on their project page.</p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
