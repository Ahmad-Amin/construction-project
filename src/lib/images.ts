import imageCompression from "browser-image-compression";

// Phone photos are often 4-8 MB. Shrink them before upload so a weak 4G
// connection can still post an update, and so the client's page loads quickly.
const FULL = { maxWidthOrHeight: 1600, maxSizeMB: 0.7, initialQuality: 0.8 };
const THUMB = { maxWidthOrHeight: 480, maxSizeMB: 0.06, initialQuality: 0.7 };

async function shrink(file: File, options: typeof FULL) {
  return imageCompression(file, {
    ...options,
    fileType: "image/jpeg",
    useWebWorker: true,
    // Orientation is applied during compression; dropping the rest of the EXIF
    // data also strips the GPS location phones embed in photos.
    preserveExif: false,
  });
}

// Receipts need to stay readable (small print, stamps), so keep more detail than site photos.
const RECEIPT = { maxWidthOrHeight: 2000, maxSizeMB: 1, initialQuality: 0.85 };

export async function prepareReceipt(file: File) {
  return shrink(file, RECEIPT);
}

export async function prepareImage(file: File) {
  const [full, thumb] = await Promise.all([shrink(file, FULL), shrink(file, THUMB)]);
  return { full, thumb };
}

// Logos keep transparency when they have it (PNG), and stay small: they show up in headers.
export async function prepareLogo(file: File) {
  const png = file.type === "image/png";
  const type = png ? "image/png" : "image/jpeg";
  const blob = await imageCompression(file, {
    maxWidthOrHeight: 512,
    maxSizeMB: 0.3,
    fileType: type,
    useWebWorker: true,
    preserveExif: false,
  });
  return { blob, type, ext: png ? "png" : "jpg" };
}
