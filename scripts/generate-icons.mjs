// Renders every icon from the BuildPeek house mark (public/brand/buildpeek-mark*.png):
//   src/app/favicon.ico             browser tab, transparent, 16/32/48 px, with the light-lettered mark
//                                   (the navy parts turned light) so it reads on a dark tab bar
//   public/icons/icon-192/512.png   install-to-home-screen icons, on a light square
//   public/icons/icon-maskable-512  same with a wide safe margin, for Android's round/squircle crop
//   public/apple-icon.png           iPhone home-screen icon
// Run with: npm run icons
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const mark = "public/brand/buildpeek-mark.png";
const markDark = "public/brand/buildpeek-mark-dark.png";
const paper = "#fafaf9";

// The mark centred on a square, `padding` being the share of each side left empty.
async function square(size, { padding = 0.08, background = null, file = mark } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const picture = await sharp(file).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: picture, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// An .ico file that holds several PNG pictures.
function ico(pictures) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pictures.length, 4);
  const entries = Buffer.alloc(16 * pictures.length);
  let offset = 6 + entries.length;
  pictures.forEach(({ size, data }, i) => {
    const at = i * 16;
    entries[at] = size === 256 ? 0 : size;
    entries[at + 1] = size === 256 ? 0 : size;
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(data.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, entries, ...pictures.map((p) => p.data)]);
}

const sizes = [16, 32, 48];
const pictures = [];
for (const size of sizes) pictures.push({ size, data: await square(size, { padding: 0.04, file: markDark }) });
writeFileSync("src/app/favicon.ico", ico(pictures));
console.log("wrote src/app/favicon.ico");

writeFileSync("public/icons/icon-192.png", await square(192, { padding: 0.14, background: paper }));
writeFileSync("public/icons/icon-512.png", await square(512, { padding: 0.14, background: paper }));
writeFileSync("public/icons/icon-maskable-512.png", await square(512, { padding: 0.26, background: paper }));
writeFileSync("public/apple-icon.png", await square(180, { padding: 0.14, background: paper }));
console.log("wrote public/icons/* and public/apple-icon.png");
