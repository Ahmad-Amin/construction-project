import { NextResponse } from "next/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";

// Opens or downloads one document. The link is not a stored URL: each visit checks who is asking
// (a homeowner only gets documents shared with them), then hands the browser a file link that
// expires in a minute. So a copied link stops working for anyone else.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("project_documents")
    .select("file_path, file_name, title")
    .eq("id", documentId)
    .eq("project_id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_path, 60, download ? { download: doc.file_name || doc.title } : undefined);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "We couldn't open that file. Please try again." }, { status: 502 });
  }

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
