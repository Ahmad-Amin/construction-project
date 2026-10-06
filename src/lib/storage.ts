import type { SupabaseClient } from "@supabase/supabase-js";

// Deletes every photo and receipt file of a project, however deeply they are nested
// (<project>/updates/<update>/..., <project>/receipts/<expense>/...). Run it as the owner
// BEFORE the project row is deleted: the storage rules need the project to still exist.
export async function removeProjectFiles(supabase: SupabaseClient, projectId: string) {
  const bucket = supabase.storage.from("project-media");

  async function walk(prefix: string): Promise<string[]> {
    const { data } = await bucket.list(prefix, { limit: 1000 });
    const files: string[] = [];
    for (const entry of data ?? []) {
      // Folders come back without an id.
      if (entry.id === null) files.push(...(await walk(`${prefix}/${entry.name}`)));
      else files.push(`${prefix}/${entry.name}`);
    }
    return files;
  }

  const files = await walk(projectId);
  for (let i = 0; i < files.length; i += 100) {
    await bucket.remove(files.slice(i, i + 100));
  }
  return files.length;
}
