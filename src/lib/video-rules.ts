// The rules for site videos that both the phone and the server need. (The database has the final say on all of them.)

export const MAX_VIDEOS_PER_UPDATE = 2;

// Cloudflare takes the file in pieces of this size (a multiple of 256 KiB, between 5 and 200 MiB). Smaller pieces lose
// less when a weak connection drops, at the cost of a few more requests.
export const VIDEO_CHUNK_BYTES = 16 * 1024 * 1024;

// Far more than any phone video of a few minutes, even in 4K. Anything bigger is almost certainly the wrong file.
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

// Videos phones and computers record. Some phones don't say the file's type, so the name is checked too.
export function isVideoFile(file: { type: string; name: string }) {
  return file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|3gp|3g2|mkv|avi|mts|m2ts)$/i.test(file.name);
}

// "0:42", "3:00", "1:02:05".
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// "3 minutes", "1 minute 20 seconds", "45 seconds".
export function formatLength(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  const minutes = m === 1 ? "1 minute" : `${m} minutes`;
  const seconds = rest === 1 ? "1 second" : `${rest} seconds`;
  if (m === 0) return seconds;
  return rest === 0 ? minutes : `${minutes} ${seconds}`;
}

// Why a video of this length can't be added (or null when it can). `left` is what remains of the month's minutes
// after the videos already added to this update.
export function videoLengthProblem(duration: number | null, limits: { maxSeconds: number; leftSeconds: number; planName: string }) {
  if (limits.leftSeconds < 1) return "You have used all your video minutes for this month. More becomes available on the 1st.";
  if (duration === null) return null; // the phone couldn't tell; Cloudflare checks it
  // A fraction of a second over is still fine: phones round differently.
  const length = Math.floor(duration);
  if (length > limits.maxSeconds) {
    return `This video is ${formatClock(duration)} long. On ${limits.planName}, videos can be up to ${formatClock(limits.maxSeconds)}. Trim it on your phone and add it again.`;
  }
  if (length > limits.leftSeconds) {
    return `This video is ${formatClock(duration)} long, but you have ${formatLength(limits.leftSeconds)} of video left this month.`;
  }
  return null;
}
