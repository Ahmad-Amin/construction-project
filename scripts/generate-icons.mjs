// Renders the app icons (a hard hat on amber) used by the install-to-home-screen manifest.
// Run with: npm run icons
import sharp from "sharp";

const amber = "#f59e0b";
const ink = "#1c1917";

// `padding` leaves a safe margin so "maskable" icons survive circular cropping on Android.
const svg = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${amber}"/>
  <g transform="translate(256 256) scale(${1 - padding}) translate(-256 -256)">
    <path d="M136 336 a120 120 0 0 1 240 0 Z" fill="${ink}"/>
    <rect x="236" y="196" width="40" height="84" rx="14" fill="${ink}" stroke="${amber}" stroke-width="10"/>
    <rect x="96" y="336" width="320" height="40" rx="20" fill="${ink}"/>
  </g>
</svg>`;

const outputs = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/icon-maskable-512.png", 512, 0.2],
  ["public/apple-icon.png", 180, 0],
];

for (const [file, size, padding] of outputs) {
  await sharp(Buffer.from(svg(padding))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
