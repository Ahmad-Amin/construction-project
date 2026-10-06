import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getProjectBasic } from "@/lib/projects";
import { buildStatement } from "@/lib/statement";
import { StatementDocument } from "@/lib/statement-pdf";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// A PDF statement of the project as the client sees it. The owner can generate it to send;
// the homeowner can download their own. Site staff can't (it contains payments).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Row-level security means a project you can't see is simply not found.
  const project = await getProjectBasic(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  if (isTeam && viewer?.company?.role !== "owner") {
    return NextResponse.json({ error: "Only the company owner can create statements." }, { status: 403 });
  }

  const supabase = await createClient();
  const data = await buildStatement(supabase, id, {
    name: project.company?.name ?? "",
    logoUrl: project.company?.logo_url ?? null,
  });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const pdf = await renderToBuffer(<StatementDocument data={data} />);

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${slug}-statement-${data.generatedOn}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
