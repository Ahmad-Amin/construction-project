import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, CheckCircle2, Plus } from "lucide-react";
import { UpdateCard } from "@/components/update-card";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getOrigin } from "@/lib/origin";
import { overallProgress } from "@/lib/project";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { one } from "@/lib/types";
import { fetchUpdates } from "@/lib/updates";
import { getViewer } from "@/lib/viewer";
import { updateMessage, whatsappHref } from "@/lib/whatsapp";

export const metadata = { title: "Updates" };

const PAGE_SIZE = 30;

export default async function UpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string }>;
}) {
  const { id } = await params;
  const { posted } = await searchParams;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";

  const supabase = await createClient();
  const updates = await fetchUpdates(supabase, id, PAGE_SIZE);

  // For the team: a one-tap way to tell the client about an update on WhatsApp.
  let shareFor: (u: (typeof updates)[number]) => string | null = () => null;
  let clientName = "";
  if (isTeam) {
    const { data: info } = await supabase
      .from("projects")
      .select("client:clients(name, phone), milestones(progress_percent)")
      .eq("id", id)
      .maybeSingle();
    const client = one(info?.client as { name: string; phone: string | null } | { name: string; phone: string | null }[] | null);
    if (client) {
      clientName = client.name;
      const progress = overallProgress((info?.milestones ?? []) as { progress_percent: number }[]);
      const link = `${await getOrigin()}/dashboard/projects/${id}/updates`;
      shareFor = (u) =>
        whatsappHref(
          client.phone,
          updateMessage({
            clientName: client.name,
            companyName: viewer?.company?.name ?? "",
            projectName: project.name,
            text: u.text,
            photoCount: u.photos.length,
            progress,
            link,
          }),
        );
    }
  }
  const justPosted = isTeam && posted ? updates.find((u) => u.id === posted) : undefined;
  const justPostedHref = justPosted ? shareFor(justPosted) : null;

  return (
    <div>
      {justPosted && (
        <div role="status" className="animate-rise mb-5 flex flex-col gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden /> Update posted. Your client can see it now.
          </p>
          {justPostedHref && (
            <WhatsAppButton href={justPostedHref} variant="primary">
              Tell {clientName || "your client"} on WhatsApp
            </WhatsAppButton>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Site updates</h2>
        {isTeam && (
          <Link href={`/dashboard/projects/${id}/updates/new`} className={button("primary", "sm")}>
            <Plus className="size-4" aria-hidden /> Add update
          </Link>
        )}
      </div>

      {updates.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Camera className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold">No updates yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {isTeam
              ? "Post a note and photos from site. Your client sees it straight away."
              : "Progress updates and photos from site will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <UpdateCard
              key={u.id}
              update={u}
              projectId={id}
              canDelete={isOwner || (isTeam && u.authorId === viewer?.userId)}
              shareHref={shareFor(u)}
            />
          ))}
          {updates.length === PAGE_SIZE && (
            <p className="text-center text-sm text-muted">Showing the latest {PAGE_SIZE} updates.</p>
          )}
        </div>
      )}
    </div>
  );
}
