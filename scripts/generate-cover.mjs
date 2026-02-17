import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── CONFIG ──────────────────────────────────────────────
// Cover dimensions (standard ebook ratio ~2:3)
const WIDTH = 1600;
const HEIGHT = 2400;

// ── REUSABLE COVER GENERATOR ────────────────────────────
export async function generateCover({
  backgroundImage,
  title,
  subtitle,
  series,
  author = 'HistorIQly',
  outputPath,
}) {
  // Escape XML special characters for SVG
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Split title into lines if it contains a newline or is very long
  const titleLines = title.includes('\n') ? title.split('\n') : [title];
  const titleFontSize = titleLines.some((l) => l.length > 16) ? 120 : 140;
  const titleLineHeight = titleFontSize * 1.15;

  const titleSvgLines = titleLines
    .map(
      (line, i) =>
        `<text x="800" y="${1180 + i * titleLineHeight}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${titleFontSize}" font-weight="700" fill="white" letter-spacing="-1">${esc(line.trim())}</text>`
    )
    .join('\n');

  const subtitleY = 1180 + titleLines.length * titleLineHeight + 40;

  // Dark gradient overlay as SVG
  const overlaySvg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Top fade -->
      <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0.7"/>
        <stop offset="30%" stop-color="black" stop-opacity="0.15"/>
        <stop offset="50%" stop-color="black" stop-opacity="0.05"/>
        <stop offset="70%" stop-color="black" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
      </linearGradient>
      <!-- Vignette -->
      <radialGradient id="vignette" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.5"/>
      </radialGradient>
    </defs>

    <!-- Gradient overlay -->
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#topFade)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>

    <!-- Series badge at top -->
    <rect x="560" y="200" width="480" height="50" rx="2" fill="none" stroke="rgba(245,158,11,0.7)" stroke-width="1.5"/>
    <text x="800" y="233" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="500" fill="#F59E0B" letter-spacing="4" text-transform="uppercase">${esc(series.toUpperCase())}</text>

    <!-- Main title -->
    ${titleSvgLines}

    <!-- Subtitle -->
    <text x="800" y="${subtitleY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="42" fill="rgba(255,255,255,0.75)" font-style="italic">${esc(subtitle)}</text>

    <!-- Decorative line -->
    <line x1="650" y1="${subtitleY + 60}" x2="950" y2="${subtitleY + 60}" stroke="#F59E0B" stroke-width="1.5" opacity="0.6"/>

    <!-- "Based on real events" -->
    <text x="800" y="${subtitleY + 110}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.5)" letter-spacing="5">${esc('BASED ON REAL EVENTS')}</text>

    <!-- Author / brand at bottom -->
    <text x="800" y="2220" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.5)" letter-spacing="6">${esc(author.toUpperCase())}</text>

    <!-- Bottom decorative line -->
    <line x1="700" y1="2250" x2="900" y2="2250" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  </svg>`;

  // Process: resize background → desaturate → composite dark overlay + text
  const background = await sharp(backgroundImage)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'center' })
    .modulate({ saturation: 0.3, brightness: 0.7 })
    .toBuffer();

  const overlay = Buffer.from(overlaySvg);

  const cover = await sharp(background)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  if (outputPath) {
    const { writeFileSync, mkdirSync } = await import('fs');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, cover);
    console.log(`Cover written to: ${outputPath}`);
    console.log(`Size: ${(cover.length / 1024).toFixed(0)} KB`);
  }

  return cover;
}

// ── CLI: Generate Piltdown Man cover ────────────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const bgImage = resolve(ROOT, 'public/cases/images/hero-gravel-pit.jpg');
  const outPath = resolve(ROOT, 'public/books/covers/piltdown-man.jpg');

  await generateCover({
    backgroundImage: bgImage,
    title: 'The Piltdown\nMen',
    subtitle: 'The 41-Year Fraud That Fooled Science',
    series: 'Vol. 1: Hoaxes',
    author: 'HistorIQly',
    outputPath: outPath,
  });

  console.log('Done!');
}
