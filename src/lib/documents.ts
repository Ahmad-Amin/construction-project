import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENTS_BUCKET = "project-documents";

export const DOCUMENT_CATEGORIES = ["contract", "drawing", "permit", "quotation", "invoice", "other"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const documentCategoryLabel: Record<DocumentCategory, string> = {
  contract: "Contract",
  drawing: "Drawing",
  permit: "Permit",
  quotation: "Quotation",
  invoice: "Invoice",
  other: "Other",
};

// The headings the list is grouped under.
export const documentCategoryHeading: Record<DocumentCategory, string> = {
  contract: "Contracts",
  drawing: "Drawings",
  permit: "Permits",
  quotation: "Quotations",
  invoice: "Invoices",
  other: "Other documents",
};

// What can be added: the kinds of file a contractor and a homeowner actually exchange, and nothing
// a browser could run. The database bucket enforces the same list.
export const DOCUMENT_TYPES = {
  "application/pdf": { ext: "pdf", kind: "pdf" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "application/msword": { ext: "doc", kind: "word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", kind: "word" },
  "application/vnd.ms-excel": { ext: "xls", kind: "excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", kind: "excel" },
} as const satisfies Record<string, { ext: string; kind: "pdf" | "image" | "word" | "excel" }>;

export type DocumentMime = keyof typeof DOCUMENT_TYPES;
export type DocumentKind = (typeof DOCUMENT_TYPES)[DocumentMime]["kind"];

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

// For the file picker. Extensions as well as types, because some phones label Office files oddly.
export const DOCUMENT_ACCEPT = [...Object.keys(DOCUMENT_TYPES), ...Object.values(DOCUMENT_TYPES).map((t) => `.${t.ext}`), ".jpeg"].join(",");

export function isDocumentMime(mime: unknown): mime is DocumentMime {
  return typeof mime === "string" && mime in DOCUMENT_TYPES;
}

// The supported type of a picked file, going by its extension when the browser doesn't say.
export function documentMimeOf(file: { name: string; type: string }): DocumentMime | null {
  if (isDocumentMime(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (ext === "jpeg") return "image/jpeg";
  const found = (Object.entries(DOCUMENT_TYPES) as [DocumentMime, { ext: string }][]).find(([, t]) => t.ext === ext);
  return found ? found[0] : null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toString().replace(/\.0$/, "")} MB`;
}

// A file name that is safe to hand to the browser as a download name.
export function safeFileName(name: string) {
  const cleaned = name.replace(/[\\/\u0000-\u001f"<>:*?|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
  return cleaned || "document";
}

export type DocumentItem = {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  fileSize: number;
  mime: DocumentMime;
  clientVisible: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

type Row = {
  id: string;
  title: string;
  category: DocumentCategory;
  file_name: string;
  file_size: number;
  mime_type: string;
  client_visible: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
};

export const DOCUMENT_COLUMNS =
  "id, title, category, file_name, file_size, mime_type, client_visible, created_by, created_by_name, created_at";

export function toDocumentItem(r: Row): DocumentItem {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    fileName: r.file_name,
    fileSize: Number(r.file_size),
    // The database only ever stores a supported type; fall back to PDF rather than crash.
    mime: isDocumentMime(r.mime_type) ? r.mime_type : "application/pdf",
    clientVisible: r.client_visible,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

const LIMIT = 300;

// Row-level security decides what this person gets back: the team sees everything, a homeowner
// only what was shared with them.
export async function fetchDocuments(supabase: SupabaseClient, projectId: string): Promise<DocumentItem[]> {
  const { data } = await supabase
    .from("project_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  return ((data ?? []) as Row[]).map(toDocumentItem);
}
