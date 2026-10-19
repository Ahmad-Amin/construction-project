// In the browser: a video's length and a small preview picture, read from the file on the phone before anything is
// uploaded, so a video that is too long is caught without spending any data. The browser reads both when it can play
// the file. When it can't (an iPhone .mov in Chrome, for example), the length is read straight from the file's header
// instead. The preview picture can then be missing, which is fine; the length is what matters, and Cloudflare checks
// it again anyway.

export type VideoProbe = { duration: number | null; poster: string | null };

const wait = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export async function probeVideo(file: File): Promise<VideoProbe> {
  const played = await probeWithBrowser(file);
  if (played.duration !== null) return played;
  const duration = await containerDuration(file).catch(() => null);
  return { duration, poster: played.poster };
}

// ---------------------------------------------------------------------------
// The length from an MP4 / MOV / M4V / 3GP file's header, without decoding any video. These files are a series of
// boxes; the "moov" box (at the start, or after the video data at the end) holds "mvhd", which says how long the
// video is. Only a few small pieces of the file are read, so it is quick even for a file of several GB.
// ---------------------------------------------------------------------------
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

type Blobby = { size: number; slice(start?: number, end?: number): { arrayBuffer(): Promise<ArrayBuffer> } };

const fourcc = (view: DataView, at: number) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

// A box's size and type at `at`. Size 1 means the real size follows as 64 bits; size 0 means "to the end".
function boxAt(view: DataView, at: number, end: number) {
  if (at + 8 > end) return null;
  let size = view.getUint32(at);
  let header = 8;
  if (size === 1) {
    if (at + 16 > end) return null;
    size = Number(view.getBigUint64(at + 8));
    header = 16;
  } else if (size === 0) {
    size = end - at;
  }
  if (size < header) return null;
  return { size, header, type: fourcc(view, at + 4) };
}

export async function containerDuration(file: Blobby): Promise<number | null> {
  const read = async (start: number, end: number) => new DataView(await file.slice(start, end).arrayBuffer());
  let offset = 0;
  // Top-level boxes: ftyp, wide, mdat (the video itself, skipped over), moov...
  for (let i = 0; i < 100 && offset + 8 <= file.size; i++) {
    const head = await read(offset, Math.min(offset + 16, file.size));
    const box = boxAt(head, 0, head.byteLength);
    if (!box) return null;
    if (box.type === "moov") {
      const moov = await read(offset + box.header, Math.min(offset + box.size, offset + MAX_MOOV_BYTES, file.size));
      return movieLength(moov);
    }
    offset += box.size;
  }
  return null;
}

function movieLength(moov: DataView): number | null {
  for (let at = 0; at + 8 <= moov.byteLength; ) {
    const box = boxAt(moov, at, moov.byteLength);
    if (!box) return null;
    if (box.type === "mvhd") {
      const start = at + box.header;
      const version = moov.getUint8(start);
      const fields = start + 4; // after the version and flags
      const timescale = version === 1 ? moov.getUint32(fields + 16) : moov.getUint32(fields + 8);
      const duration = version === 1 ? Number(moov.getBigUint64(fields + 20)) : moov.getUint32(fields + 12);
      // All ones means "unknown" (a recording still being written, or a streaming file).
      if (!timescale || !duration || duration === 0xffffffff) return null;
      return duration / timescale;
    }
    at += box.size;
  }
  return null;
}

// What the browser can tell by opening the file as a video: the length and a picture from it.
async function probeWithBrowser(file: File): Promise<VideoProbe> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;
  try {
    let duration = await Promise.race([
      new Promise<number | null>((resolve) => {
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => resolve(null);
      }),
      wait(10_000, null),
    ]);
    // Videos recorded in a browser (WebM) often don't say how long they are until asked to jump to the end.
    if (duration === Infinity) {
      duration = await Promise.race([
        new Promise<number | null>((resolve) => {
          video.ondurationchange = () => {
            if (Number.isFinite(video.duration)) resolve(video.duration);
          };
          video.currentTime = Number.MAX_SAFE_INTEGER;
        }),
        wait(5_000, null),
      ]);
    }
    if (duration === null || !Number.isFinite(duration) || duration <= 0) return { duration: null, poster: null };

    const poster = await Promise.race([
      new Promise<string | null>((resolve) => {
        video.onseeked = () => {
          try {
            const scale = Math.min(1, 360 / Math.max(video.videoWidth, video.videoHeight, 1));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(video.videoWidth ? canvas.toDataURL("image/jpeg", 0.72) : null);
          } catch {
            resolve(null);
          }
        };
        video.preload = "auto";
        video.currentTime = Math.min(1, duration / 3);
      }),
      wait(6_000, null),
    ]);
    return { duration, poster };
  } finally {
    video.onloadedmetadata = video.onerror = video.ondurationchange = video.onseeked = null;
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
