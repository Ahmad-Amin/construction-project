"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, FileUp, Info, Upload, X } from "lucide-react";
import {
  createDocument,
  updateDocument,
} from "@/app/dashboard/projects/[id]/documents/actions";
import { useToast } from "@/components/toast";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentCategoryLabel,
  documentMimeOf,
  formatFileSize,
  type DocumentCategory,
} from "@/lib/documents";
import { newId } from "@/lib/ids";
import { createClient } from "@/lib/supabase/client";
import { button, inputClass } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";

export type DocumentFormValues = {
  title: string;
  category: DocumentCategory;
  clientVisible: boolean;
};

// "Site_Plan-v3.pdf" -> "Site Plan v3"
function titleFromFile(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

// A first guess at the type from the file's name; the person can change it.
function guessCategory(name: string): DocumentCategory | null {
  const n = name.toLowerCase();
  if (/contract|agreement/.test(n)) return "contract";
  if (/drawing|plan|layout|elevation|section|dwg/.test(n)) return "drawing";
  if (/permit|noc|approval|sanction/.test(n)) return "permit";
  if (/quot|estimate|boq/.test(n)) return "quotation";
  if (/invoice|bill|receipt/.test(n)) return "invoice";
  return null;
}

export function DocumentForm({
  projectId,
  documentId,
  initial,
  existingFile,
  isOwner,
  sheet = false,
}: {
  projectId: string;
  // Present when editing: the file can't be swapped, only its details.
  documentId?: string;
  initial: DocumentFormValues;
  existingFile?: { name: string; size: number };
  isOwner: boolean;
  // Shown in the slide-over panel: the buttons stay in view along the bottom while the form scrolls.
  sheet?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!documentId;
  // One id per draft. Retrying a failed save re-uses it, so it can never add the document twice.
  const draftId = useRef(documentId ?? newId());
  const uploadedPath = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState<DocumentCategory>(initial.category);
  const [clientVisible, setClientVisible] = useState(initial.clientVisible);
  // Whether the person has typed their own name / chosen their own type, so picking a file
  // never overwrites that.
  const [titleTouched, setTitleTouched] = useState(editing);
  const [categoryTouched, setCategoryTouched] = useState(editing);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null;
  const input = useRef<HTMLInputElement>(null);

  function pick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!documentMimeOf(picked)) {
      setError("That kind of file can't be added. Use a PDF, Word, Excel or image file.");
      return;
    }
    if (picked.size > MAX_DOCUMENT_BYTES) {
      setError(`That file is ${formatFileSize(picked.size)}. Files can be up to 20 MB.`);
      return;
    }
    if (picked.size === 0) {
      setError("That file is empty.");
      return;
    }
    setError(null);
    setFile(picked);
    uploadedPath.current = null; // a new file replaces any earlier upload attempt
    if (!titleTouched) setTitle(titleFromFile(picked.name));
    if (!categoryTouched) {
      const guess = guessCategory(picked.name);
      if (guess) setCategory(guess);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return setError("Please give the document a name.");
    if (!editing && !file) return setError("Please choose a file.");
    setError(null);

    try {
      if (editing) {
        setStatus("Saving…");
        const result = await updateDocument(projectId, draftId.current, { title, category, clientVisible });
        if (result.error) return setError(result.error);
        toast.success("Document updated");
        router.push(`/dashboard/projects/${projectId}/documents`);
        return;
      }

      const mime = documentMimeOf(file!)!;
      if (!uploadedPath.current) {
        setStatus("Uploading file…");
        const path = `${projectId}/${draftId.current}/${newId()}.${DOCUMENT_TYPES[mime].ext}`;
        const ok = await uploadWithRetry(createClient(), path, file!, { bucket: DOCUMENTS_BUCKET, contentType: mime });
        if (!ok) {
          return setError("The file didn't upload. Check your connection and tap Add document again. Your details are kept.");
        }
        uploadedPath.current = path;
      }

      setStatus("Saving…");
      const result = await createDocument(projectId, draftId.current, {
        title,
        category,
        clientVisible,
        filePath: uploadedPath.current,
        fileName: file!.name,
        fileSize: file!.size,
        mimeType: mime,
      });
      if (result.error) return setError(result.error);
      toast.success("Document added");
      router.push(`/dashboard/projects/${projectId}/documents`);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  const shown = file ? { name: file.name, size: file.size } : existingFile;

  return (
    <form onSubmit={onSubmit} className={sheet ? "flex flex-1 flex-col gap-4" : "space-y-4"}>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div>
          <p className="mb-1.5 text-sm font-medium">File</p>
          {shown ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{shown.name}</p>
                <p className="text-xs text-muted">{formatFileSize(shown.size)}</p>
              </div>
              {!editing && !busy && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    uploadedPath.current = null;
                  }}
                  aria-label="Remove file"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/40 px-4 py-8 text-center transition-colors hover:bg-surface-2"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Upload className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold">Choose a file</span>
              <span className="text-xs text-muted">PDF, Word, Excel or an image, up to 20 MB</span>
            </button>
          )}
          {editing && (
            <p className="mt-1.5 text-xs text-muted">The file can&apos;t be changed. To replace it, add a new document.</p>
          )}
          {!editing && shown && !busy && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-hover hover:underline"
            >
              <FileUp className="size-4" aria-hidden /> Choose a different file
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept={DOCUMENT_ACCEPT}
            hidden
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            maxLength={120}
            required
            placeholder="Signed contract"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Type</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as DocumentCategory);
              setCategoryTouched(true);
            }}
            className={inputClass}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {documentCategoryLabel[c]}
              </option>
            ))}
          </select>
        </label>

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
                <span className="font-medium">Share this document with the client</span>
                <span className="block text-xs text-muted">
                  They are told, and can open or download it from their Documents tab. Leave it off for anything internal,
                  like supplier quotes.
                </span>
              </span>
            </label>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              The owner decides which documents the client can see.
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
        <Link href={`/dashboard/projects/${projectId}/documents`} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={busy} className={button("primary")}>
          {busy ? "Please wait…" : editing ? "Save changes" : "Add document"}
        </button>
      </div>
    </form>
  );
}
