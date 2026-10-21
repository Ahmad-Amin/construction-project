import { guideAt } from "@/lib/guides";
import { guideImage, OG_SIZE } from "@/lib/og-image";

// The picture shown when this guide is shared.
const guide = guideAt("/pk/guides/construction-payment-schedule");

export const alt = guide.title;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return guideImage(guide);
}
