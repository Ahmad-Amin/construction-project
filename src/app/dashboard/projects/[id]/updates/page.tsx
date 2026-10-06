import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Plus } from "lucide-react";
import { UpdateCard } from "@/components/update-card";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { fetchUpdates } from "@/lib/updates";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Updates" };

const PAGE_SIZE = 30;

export default async function UpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";

  const supabase = await createClient();
  const updates = await fetchUpdates(supabase, id, PAGE_SIZE);

  return (
    <div>
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
