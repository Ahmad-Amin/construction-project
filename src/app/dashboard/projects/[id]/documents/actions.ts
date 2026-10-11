"use server";

import { revalidatePath } from "next/cache";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  isDocumentMime,
  safeFileName,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const GENERIC = "Something went wrong saving this document. Please try again.";

// Our database triggers raise plain-English messages (error code P0001); show those as-is.
const friendly = (error: { code?: string; message: string }) =>
  error.code === "P0001" ? error.message : GENERIC;

function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
}

type Details = { title: string; category: string; clientVisible: boolean };

function validate(input: Details): string | null {
  const title = input.title.trim();
  if (!title) return "Please give the document a name.";
  if (title.length > 120) return "Please keep the name under 120 characters.";
  if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(input.category)) return "Please choose a type.";
  return null;
}

type NewDocument = Details & {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export async function createDocument(projectId: string, id: string, input: NewDocument): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };
  if (!isDocumentMime(input.mimeType)) return { error: "That kind of file can't be added. Use a PDF, Word, Excel or image file." };
  if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > MAX_DOCUMENT_BYTES) {
    return { error: "Files can be up to 20 MB." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_documents").insert({
    id,
    project_id: projectId,
    title: input.title.trim(),
    category: input.category,
    file_path: input.filePath,
    file_name: safeFileName(input.fileName),
    file_size: input.fileSize,
    mime_type: input.mimeType,
    client_visible: input.clientVisible,
  });

  // The same draft id arriving twice (double tap, retry after a lost reply) is fine.
  if (error && error.code !== "23505") {
    return { error: error.code === "42501" ? "You can't add documents to this project." : friendly(error) };
  }

  refresh(projectId);
  return {};
}

export async function updateDocument(projectId: string, id: string, input: Details): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_documents")
    .update({ title: input.title.trim(), category: input.category, client_visible: input.clientVisible })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "You can only edit documents you added, unless you're the owner." };

  refresh(projectId);
  return {};
}

export async function setDocumentVisibility(projectId: string, id: string, visible: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_documents")
    .update({ client_visible: visible })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "Only the company owner can change what the client sees." };

  refresh(projectId);
  return {};
}

export async function deleteDocument(projectId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("project_documents")
    .select("file_path")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();

  // RLS only lets the owner (or whoever added it) delete; a blocked delete returns no row.
  const { data, error } = await supabase
    .from("project_documents")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: "We couldn't delete that document. Please try again." };
  if (!data?.length) return { error: "Only the owner, or whoever added it, can delete a document." };

  if (existing?.file_path) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([existing.file_path]);
  }

  refresh(projectId);
  return {};
}
