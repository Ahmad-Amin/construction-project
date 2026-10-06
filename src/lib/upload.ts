import type { SupabaseClient } from "@supabase/supabase-js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Weak site connections drop requests, so each file gets a few attempts.
export async function uploadWithRetry(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
  { bucket = "project-media", contentType = "image/jpeg" } = {},
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: false });
    // "Already exists" means an earlier attempt got through and only the reply was lost.
    if (!error || /already exists|duplicate/i.test(error.message)) return true;
    await sleep(800 * attempt);
  }
  return false;
}
