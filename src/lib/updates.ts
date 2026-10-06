import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/types";

export type UpdatePhoto = { id: string; thumb: string; full: string };

export type UpdateItem = {
  id: string;
  date: string;
  text: string;
  authorId: string;
  authorName: string;
  milestone: string | null;
  photos: UpdatePhoto[];
};

type Row = {
  id: string;
  update_date: string;
  text: string;
  author_id: string;
  author_name: string;
  milestone: { name: string } | { name: string }[] | null;
  project_photos: { id: string; storage_path: string; thumb_path: string | null }[];
};

const SIGNED_URL_SECONDS = 60 * 60;

const UPDATE_SELECT =
  "id, update_date, text, author_id, author_name, milestone:milestones(name), project_photos(id, storage_path, thumb_path)";

// Turns rows into items, swapping photo paths for short-lived signed links.
// Photos are private; storage RLS decides which ones this user may sign.
async function hydrate(supabase: SupabaseClient, rows: Row[]): Promise<UpdateItem[]> {
  const paths = rows.flatMap((r) =>
    r.project_photos.flatMap((p) => (p.thumb_path ? [p.storage_path, p.thumb_path] : [p.storage_path])),
  );
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from("project-media")
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    date: r.update_date,
    text: r.text,
    authorId: r.author_id,
    authorName: r.author_name,
    milestone: one(r.milestone)?.name ?? null,
    photos: r.project_photos.flatMap((p) => {
      const full = signed.get(p.storage_path);
      if (!full) return [];
      return [{ id: p.id, full, thumb: (p.thumb_path && signed.get(p.thumb_path)) || full }];
    }),
  }));
}

// Newest first.
export async function fetchUpdates(
  supabase: SupabaseClient,
  projectId: string,
  limit: number,
): Promise<UpdateItem[]> {
  const { data } = await supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .eq("project_id", projectId)
    .order("update_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "project_photos" })
    .limit(limit);
  return hydrate(supabase, (data ?? []) as Row[]);
}

// Specific updates, for screens (like the timeline) that already know which ones they need.
export async function fetchUpdatesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<UpdateItem[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .in("id", ids)
    .order("created_at", { referencedTable: "project_photos" });
  return hydrate(supabase, (data ?? []) as Row[]);
}

// The newest photos across a project's updates, with signed links for the small and full versions.
export async function fetchProjectPhotos(
  supabase: SupabaseClient,
  projectId: string,
  limit: number,
): Promise<UpdatePhoto[]> {
  const { data } = await supabase
    .from("project_photos")
    .select("id, storage_path, thumb_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as { id: string; storage_path: string; thumb_path: string | null }[];

  const paths = rows.flatMap((r) => (r.thumb_path ? [r.storage_path, r.thumb_path] : [r.storage_path]));
  if (paths.length === 0) return [];
  const { data: urls } = await supabase.storage
    .from("project-media")
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  const signed = new Map<string, string>();
  for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);

  return rows.flatMap((r) => {
    const full = signed.get(r.storage_path);
    if (!full) return [];
    return [{ id: r.id, full, thumb: (r.thumb_path && signed.get(r.thumb_path)) || full }];
  });
}
