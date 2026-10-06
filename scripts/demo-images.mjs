// Placeholder pictures for the demo project: illustrated "site photos" for each build
// stage, and sample receipts. Everything is clearly labelled as a sample.
import sharp from "sharp";

const W = 1200;
const H = 900;
const HORIZON = 560;

const money = new Intl.NumberFormat("en-PK");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------
// Site photos. `stage` picks the scene, `variant` changes the weather and the
// camera position so several photos of one update don't look identical.
// ---------------------------------------------------------------------------
const STAGES = {
  // Marked-out plot with pegs and string lines.
  cleared: () => `
    ${[160, 320, 480, 640, 800, 960].map((x) => `<rect x="${x}" y="500" width="10" height="70" fill="#7a5c3a"/>`).join("")}
    <polyline points="165,515 325,515 485,515 645,515 805,515 965,515" stroke="#d93a2b" stroke-width="4" fill="none"/>
    <polygon points="90,590 210,520 330,590" fill="#d6bf93"/>`,

  // Excavation pit with an excavator.
  excavation: () => `
    <rect x="220" y="590" width="620" height="230" fill="#6f5a40"/>
    <rect x="260" y="615" width="540" height="190" fill="#4d3d2a"/>
    <rect x="870" y="470" width="190" height="90" rx="10" fill="#f2b400"/>
    <rect x="990" y="430" width="60" height="50" fill="#d89c00"/>
    <polyline points="880,490 760,400 690,500" stroke="#f2b400" stroke-width="22" fill="none" stroke-linejoin="round"/>
    <circle cx="905" cy="575" r="26" fill="#2b2b2b"/><circle cx="1010" cy="575" r="26" fill="#2b2b2b"/>`,

  // Poured foundation slab with rebar stubs standing up.
  foundation: () => `
    <rect x="210" y="572" width="780" height="44" fill="#9a9a9a"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${250 + i * 85}" y="470" width="9" height="104" fill="#6b4a36"/>`).join("")}
    <rect x="210" y="616" width="780" height="10" fill="#7e7e7e"/>`,

  // Columns standing on the foundation.
  columns: () => `
    <rect x="210" y="572" width="780" height="40" fill="#9a9a9a"/>
    ${Array.from({ length: 6 }, (_, i) => `
      <rect x="${250 + i * 135}" y="300" width="44" height="274" fill="#a9a9a9"/>
      <rect x="${268 + i * 135}" y="230" width="8" height="74" fill="#6b4a36"/>`).join("")}`,

  // Roof slab being formed: shuttering and props under a fresh slab.
  slab: () => `
    <rect x="210" y="572" width="780" height="40" fill="#9a9a9a"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${250 + i * 135}" y="320" width="44" height="254" fill="#a9a9a9"/>`).join("")}
    <rect x="190" y="282" width="820" height="38" fill="#b6b6b6"/>
    <rect x="190" y="320" width="820" height="16" fill="#a9783f"/>
    ${Array.from({ length: 12 }, (_, i) => `<rect x="${220 + i * 65}" y="336" width="8" height="236" fill="#c79a5b"/>`).join("")}`,

  // Brick walls going up, with window and door openings.
  brickwork: () => `
    <rect x="210" y="572" width="780" height="30" fill="#9a9a9a"/>
    <rect x="230" y="330" width="740" height="242" fill="url(#brick)"/>
    <rect x="210" y="296" width="780" height="34" fill="#b6b6b6"/>
    <rect x="300" y="390" width="120" height="100" fill="#b8d8f0"/>
    <rect x="740" y="390" width="120" height="100" fill="#b8d8f0"/>
    <rect x="530" y="420" width="130" height="152" fill="#4a4036"/>`,

  // Two storeys with bamboo scaffolding.
  floors: () => `
    <rect x="210" y="572" width="780" height="26" fill="#9a9a9a"/>
    <rect x="230" y="420" width="740" height="152" fill="url(#brick)"/>
    <rect x="210" y="392" width="780" height="30" fill="#b6b6b6"/>
    <rect x="230" y="262" width="500" height="130" fill="url(#brick)"/>
    ${Array.from({ length: 7 }, (_, i) => `<line x1="${200 + i * 120}" y1="580" x2="${200 + i * 120}" y2="240" stroke="#8a6a3a" stroke-width="6"/>`).join("")}
    ${[300, 400, 500].map((y) => `<line x1="200" y1="${y}" x2="1000" y2="${y}" stroke="#8a6a3a" stroke-width="5"/>`).join("")}`,

  // Inside a room: yellow conduit running to junction boxes in a brick wall.
  electrical: () => `
    <rect x="-200" width="${W + 400}" height="${H - 70}" fill="url(#brick)"/>
    <rect x="-200" y="760" width="${W + 400}" height="70" fill="#8d8d8d"/>
    <g stroke="#f2c200" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="180,760 180,300 520,300"/><polyline points="520,300 520,150"/>
      <polyline points="520,300 880,300 880,480"/><polyline points="880,300 1020,300"/>
    </g>
    ${[[520, 140], [880, 490], [1030, 300], [180, 440]].map(([x, y]) => `<rect x="${x - 34}" y="${y - 34}" width="68" height="68" rx="6" fill="#f5f5f5" stroke="#9a9a9a" stroke-width="4"/>`).join("")}`,

  // Inside a bathroom: supply pipes and a valve on the wall.
  plumbing: () => `
    <rect x="-200" width="${W + 400}" height="${H - 70}" fill="url(#brick)"/>
    <rect x="-200" y="760" width="${W + 400}" height="70" fill="#8d8d8d"/>
    <g stroke="#3b82c4" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="260,760 260,380 760,380"/><polyline points="760,380 760,220"/>
    </g>
    <g stroke="#8a8f98" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="420,760 420,540 960,540"/><polyline points="960,540 960,300"/>
    </g>
    <circle cx="760" cy="300" r="34" fill="#d93a2b"/><rect x="745" y="250" width="30" height="24" fill="#8a1c12"/>
    <circle cx="960" cy="400" r="30" fill="#d93a2b"/>`,

  // Stacked materials: bricks, sand, cement bags.
  materials: () => `
    ${Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 8 - r }, (_, c) => `<rect x="${130 + c * 62 + r * 31}" y="${470 - r * 30}" width="58" height="26" fill="#b5533c" stroke="#e2c2a8" stroke-width="2"/>`).join("")).join("")}
    <polygon points="620,590 780,430 940,590" fill="#d6bf93"/>
    ${Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 - r }, (_, c) => `<rect x="${960 + c * 70 + r * 35}" y="${560 - r * 46}" width="64" height="42" rx="8" fill="#a3a3a3" stroke="#7d7d7d" stroke-width="3"/>`).join("")).join("")}`,
};

function photoSvg(stage, variant, caption) {
  const skies = [["#8ec5f0", "#eaf4fb"], ["#f6c98a", "#fbeee0"], ["#a9c4e8", "#f1f5fb"], ["#9fd0e6", "#eef8fb"]];
  const [top, bottom] = skies[variant % skies.length];
  const shift = [0, 60, -50, 25][variant % 4];
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <pattern id="brick" width="60" height="30" patternUnits="userSpaceOnUse">
      <rect width="60" height="30" fill="#b5533c"/>
      <path d="M0 0H60M0 15H60M30 0V15M0 15V30M60 15V30" stroke="#e2c2a8" stroke-width="3" fill="none"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${HORIZON}" fill="url(#sky)"/>
  <circle cx="${200 + variant * 170}" cy="120" r="62" fill="#fff6c9" opacity="0.92"/>
  <ellipse cx="${900 - variant * 120}" cy="150" rx="130" ry="34" fill="#fff" opacity="0.8"/>
  <rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="#b89d78"/>
  <rect y="${HORIZON}" width="${W}" height="14" fill="#9c8260"/>
  <g transform="translate(${shift} 0)">${STAGES[stage]()}</g>
  <rect y="${H - 70}" width="${W}" height="70" fill="#000" opacity="0.5"/>
  <text x="32" y="${H - 26}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff">${esc(caption)}</text>
  <text x="${W - 32}" y="${H - 26}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#fff" opacity="0.8">Sample photo</text>
</svg>`;
}

// Returns { full, thumb } as JPEG buffers, shaped like what the app uploads.
export async function sitePhoto({ stage, variant = 0, caption }) {
  const svg = Buffer.from(photoSvg(stage, variant, caption));
  const full = await sharp(svg).resize(1200).jpeg({ quality: 78 }).toBuffer();
  const thumb = await sharp(svg).resize(480).jpeg({ quality: 70 }).toBuffer();
  return { full, thumb };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------
export async function receiptImage({ vendor, address, invoice, date, lines, total }) {
  const rowH = 54;
  const tableTop = 330;
  const height = tableTop + lines.length * rowH + 330;
  const rows = lines
    .map((l, i) => {
      const y = tableTop + 40 + i * rowH;
      return `
      <text x="70" y="${y}" font-size="24" fill="#222">${esc(l.desc)}</text>
      <text x="470" y="${y}" font-size="24" fill="#222" text-anchor="end">${esc(l.qty)}</text>
      <text x="640" y="${y}" font-size="24" fill="#222" text-anchor="end">${money.format(l.rate)}</text>
      <text x="780" y="${y}" font-size="24" fill="#222" text-anchor="end" font-weight="600">${money.format(l.amount)}</text>`;
    })
    .join("");
  const totalY = tableTop + 40 + lines.length * rowH + 60;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="850" height="${height}" viewBox="0 0 850 ${height}" font-family="Helvetica, Arial, sans-serif">
  <rect width="850" height="${height}" fill="#d8d8d8"/>
  <rect x="25" y="25" width="800" height="${height - 50}" fill="#fff" stroke="#bbb"/>
  <text x="425" y="100" text-anchor="middle" font-size="40" font-weight="700" fill="#111">${esc(vendor)}</text>
  <text x="425" y="140" text-anchor="middle" font-size="22" fill="#555">${esc(address)}</text>
  <line x1="70" y1="175" x2="780" y2="175" stroke="#999" stroke-dasharray="6 6"/>
  <text x="70" y="225" font-size="24" fill="#222">Invoice No: ${esc(invoice)}</text>
  <text x="780" y="225" font-size="24" fill="#222" text-anchor="end">Date: ${esc(date)}</text>
  <text x="70" y="270" font-size="22" fill="#555">Customer: Rehman Builders (Ahmed Residence, DHA Lahore)</text>
  <line x1="70" y1="${tableTop - 20}" x2="780" y2="${tableTop - 20}" stroke="#333" stroke-width="2"/>
  <text x="70" y="${tableTop + 6}" font-size="21" font-weight="700" fill="#333">Item</text>
  <text x="470" y="${tableTop + 6}" font-size="21" font-weight="700" fill="#333" text-anchor="end">Qty</text>
  <text x="640" y="${tableTop + 6}" font-size="21" font-weight="700" fill="#333" text-anchor="end">Rate</text>
  <text x="780" y="${tableTop + 6}" font-size="21" font-weight="700" fill="#333" text-anchor="end">Amount</text>
  ${rows}
  <line x1="70" y1="${totalY - 40}" x2="780" y2="${totalY - 40}" stroke="#333" stroke-width="2"/>
  <text x="70" y="${totalY + 10}" font-size="32" font-weight="700" fill="#111">TOTAL (PKR)</text>
  <text x="780" y="${totalY + 10}" font-size="36" font-weight="700" fill="#111" text-anchor="end">${money.format(total)}</text>
  <text x="70" y="${totalY + 90}" font-size="26" font-weight="700" fill="#2e7d32">PAID IN FULL</text>
  <text x="425" y="${totalY + 170}" text-anchor="middle" font-size="20" fill="#777">Thank you for your business</text>
  <g transform="translate(425 ${height / 2}) rotate(-24)">
    <text text-anchor="middle" font-size="96" font-weight="700" fill="#000" opacity="0.07">SAMPLE RECEIPT</text>
  </g>
</svg>`;

  return sharp(Buffer.from(svg)).resize(1000).jpeg({ quality: 82 }).toBuffer();
}
