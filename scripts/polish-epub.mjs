/**
 * EPUB Post-Processor
 * Fixes structural issues in epub-gen-memory output:
 *  - Adds cover.xhtml
 *  - Fixes spine order (ToC non-linear, cover first)
 *  - Renames UUID images to semantic filenames (from alt text)
 *  - Removes duplicate h1 headings
 *  - Adds epub:type semantic attributes (body, figure, figcaption)
 *  - Adds landmarks navigation
 *  - Improves CSS (dark mode, typography)
 *  - Compresses oversized images (targeted PNG→JPEG media-type fix)
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// We'll use Node's built-in zip support via the 'archiver' style approach
// Actually, let's use JSZip-like approach with the zip already available
// We'll work with the epub-gen-memory buffer directly

const IMPROVED_CSS = `
/* ── Base Typography ─────────────────────────────── */
body {
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.8;
  color: #1C1917;
  margin: 0;
  padding: 0 1em;
  -webkit-hyphens: auto;
  hyphens: auto;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  body { color: #E7E5E4; background: #0C0A09; }
  .chapter-num { color: #A8A29E; }
  .subtitle, figcaption, .meta, .epigraph-attr { color: #A8A29E; }
  .epigraph { color: #D6D3D1; }
  .title-page .divider { background: #44403C; }
  .based-on { color: #A8A29E; }
  .separator, .end-mark { color: #78716C; }
}

/* Night mode class (for readers that use classes) */
.night-mode body,
body.night-mode {
  color: #E7E5E4;
  background: #0C0A09;
}

/* ── Headings ────────────────────────────────────── */
h1 {
  font-size: 2.2em;
  font-weight: 400;
  text-align: center;
  margin: 1.5em 0 0.5em;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

h2 {
  font-size: 1.6em;
  font-weight: 400;
  text-align: center;
  margin: 2em 0 0.5em;
}

/* ── Chapter Number ──────────────────────────────── */
.chapter-num {
  display: block;
  text-align: center;
  font-size: 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  color: #78716C;
  margin-top: 3em;
  margin-bottom: 0.25em;
  font-family: sans-serif;
}

/* ── Body Text ───────────────────────────────────── */
p {
  margin: 0 0 1em;
  text-align: justify;
  font-size: 1em;
  orphans: 2;
  widows: 2;
}

em { font-style: italic; }
strong { font-weight: 700; }

/* ── Figures ─────────────────────────────────────── */
figure {
  margin: 2.5em 0;
  padding: 0;
  text-align: center;
  page-break-inside: avoid;
}

figure img {
  max-width: 100%;
  height: auto;
}

figcaption {
  font-size: 0.85em;
  color: #78716C;
  margin-top: 0.75em;
  font-style: italic;
  line-height: 1.5;
  text-align: center;
}

/* ── Title Page ──────────────────────────────────── */
.title-page {
  text-align: center;
  padding-top: 6em;
}

.title-page h1 {
  font-size: 2.8em;
  font-weight: 300;
  margin: 0 0 0.15em;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.title-page .subtitle {
  font-size: 1.15em;
  margin: 0.5em 0 2em;
}

.title-page .divider {
  display: block;
  width: 60px;
  height: 1px;
  background: #D4D0CC;
  margin: 2em auto;
}

.title-page .based-on {
  font-family: sans-serif;
  font-size: 0.7em;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: #A8A29E;
}

/* ── Meta / UI Text ──────────────────────────────── */
.subtitle {
  text-align: center;
  font-style: italic;
  color: #78716C;
  font-size: 1.2em;
  margin: 0 0 1em;
}

.meta {
  text-align: center;
  font-size: 0.85em;
  color: #A8A29E;
  margin: 0.5em 0;
  font-family: sans-serif;
}

/* ── Epigraph ────────────────────────────────────── */
.epigraph {
  text-align: center;
  font-style: italic;
  color: #57534E;
  max-width: 28em;
  margin: 6em auto 2em;
  line-height: 1.7;
  font-size: 1.05em;
}

.epigraph-attr {
  text-align: center;
  font-size: 0.85em;
  color: #A8A29E;
  font-style: normal;
  margin-top: 1em;
}

/* ── Separators ──────────────────────────────────── */
.separator {
  text-align: center;
  margin: 2em 0;
  color: #A8A29E;
  letter-spacing: 0.5em;
}

.end-mark {
  text-align: center;
  margin: 3em 0;
  color: #78716C;
  letter-spacing: 0.5em;
}

/* ── Cover Page ──────────────────────────────────── */
.cover-page {
  text-align: center;
  padding: 0;
  margin: 0;
}

.cover-page img {
  max-width: 100%;
  max-height: 100%;
  height: auto;
}
`;

function makeCoverXhtml(bookTitle) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body epub:type="cover">
  <div class="cover-page">
    <img src="cover.jpg" alt="${esc(bookTitle)} — Book Cover" />
  </div>
</body>
</html>`;
}

// Map chapter filenames to their epub:type
function getEpubType(filename, html) {
  // Detect title page by content (class="title-page") or being the first file (0_)
  if (html && html.includes('class="title-page"')) return 'titlepage';
  if (/^0_/.test(filename)) return 'titlepage';
  if (filename.includes('Epigraph')) return 'epigraph';
  if (filename.includes('Timeline')) return 'backmatter';
  if (filename.includes('About-This-Book')) return 'backmatter';
  return 'chapter';
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function imageSlugFromAlt(altText) {
  const cleaned = decodeHtmlEntities(altText || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '');

  return cleaned
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'image';
}

function checkMimetypeCompliance(epubPath, AdmZip) {
  const checkZip = new AdmZip(epubPath);
  const entries = checkZip.getEntries();
  const mimetype = checkZip.getEntry('mimetype');

  if (!entries.length || !mimetype) {
    return { ok: false, reason: 'missing mimetype entry' };
  }

  const isFirst = entries[0].entryName === 'mimetype';
  const isStored = mimetype.header.method === 0;
  const payload = mimetype.getData().toString('utf-8');
  const isValidPayload = payload === 'application/epub+zip';

  return {
    ok: isFirst && isStored && isValidPayload,
    isFirst,
    isStored,
    isValidPayload,
  };
}

export async function polishEpub(inputPath, outputPath) {
  // Dynamic import of jszip-like functionality
  // We'll use adm-zip which is simpler for read/modify/write
  const AdmZip = (await import('adm-zip')).default;

  const zip = new AdmZip(inputPath);

  console.log('  Polishing EPUB...');

  // ── 0. Extract book title from OPF metadata ──
  const opfRaw = zip.getEntry('OEBPS/content.opf')?.getData().toString('utf-8') || '';
  const titleMatch = opfRaw.match(/<dc:title>([^<]+)<\/dc:title>/);
  const bookTitle = titleMatch
    ? decodeHtmlEntities(titleMatch[1]).replace(/:.+$/, '').trim()  // Use short title (before colon)
    : 'Book';

  // ── 1. Replace CSS ──
  zip.updateFile('OEBPS/style.css', Buffer.from(IMPROVED_CSS, 'utf-8'));
  console.log('    ✓ Updated CSS (dark mode, typography, figure styles)');

  // ── 2. Add cover.xhtml ──
  zip.addFile('OEBPS/cover.xhtml', Buffer.from(makeCoverXhtml(bookTitle), 'utf-8'));
  console.log('    ✓ Added cover.xhtml');

  // ── 2.1 Normalize cover image filename for broader thumbnail compatibility ──
  const coverJpegEntry = zip.getEntry('OEBPS/cover.jpeg');
  const coverJpgEntry = zip.getEntry('OEBPS/cover.jpg');
  if (coverJpegEntry && !coverJpgEntry) {
    zip.addFile('OEBPS/cover.jpg', coverJpegEntry.getData());
    zip.deleteFile('OEBPS/cover.jpeg');

    for (const entry of zip.getEntries()) {
      if (!entry.entryName.endsWith('.xhtml') && !entry.entryName.endsWith('.opf') && !entry.entryName.endsWith('.ncx')) continue;
      let content = entry.getData().toString('utf-8');
      if (content.includes('cover.jpeg')) {
        content = content.replace(/cover\.jpeg/g, 'cover.jpg');
        zip.updateFile(entry.entryName, Buffer.from(content, 'utf-8'));
      }
    }
    console.log('    ✓ Normalized cover image filename to cover.jpg');
  }

  // ── 3. Rename images from UUIDs to semantic names ──
  const imageRenames = new Map(); // old filename → new filename
  // First pass: collect alt text from xhtml files to build a rename map
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith('OEBPS/') || !entry.entryName.endsWith('.xhtml')) continue;
    const html = entry.getData().toString('utf-8');
    const imgRegex = /<img[^>]*src="images\/([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const [, oldFilename, altText] = imgMatch;
      if (!imageRenames.has(oldFilename) && altText) {
        const ext = extname(oldFilename);
        const slug = imageSlugFromAlt(altText);
        const newFilename = `${slug}${ext}`;
        // Avoid collisions
        if (![...imageRenames.values()].includes(newFilename)) {
          imageRenames.set(oldFilename, newFilename);
        }
      }
    }
  }

  // Apply renames
  for (const [oldName, newName] of imageRenames) {
    const oldPath = `OEBPS/images/${oldName}`;
    const imgEntry = zip.getEntry(oldPath);
    if (!imgEntry) continue;

    const data = imgEntry.getData();
    zip.deleteFile(oldPath);
    zip.addFile(`OEBPS/images/${newName}`, data);

    // Update all references in content files and OPF
    for (const e of zip.getEntries()) {
      if (e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.opf')) {
        let content = e.getData().toString('utf-8');
        if (content.includes(oldName)) {
          content = content.replaceAll(oldName, newName);
          zip.updateFile(e.entryName, Buffer.from(content, 'utf-8'));
        }
      }
    }
  }
  if (imageRenames.size) {
    console.log(`    ✓ Renamed ${imageRenames.size} images to semantic filenames`);
  }

  // ── 4. Process chapter files ──
  let chapterCount = 0;
  let firstChapterHref = '';
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith('OEBPS/') || !entry.entryName.endsWith('.xhtml')) continue;
    if (entry.entryName.includes('toc.xhtml') || entry.entryName.includes('cover.xhtml')) continue;

    let html = entry.getData().toString('utf-8');
    const filename = entry.entryName.split('/').pop();
    const epubType = getEpubType(filename, html);
    if (!firstChapterHref && epubType === 'chapter') {
      firstChapterHref = filename;
    }

    // Remove the auto-generated h1 that epub-gen adds (it's the first h1 in body, before our content)
    html = html.replace(
      /(<body[^>]*>)\s*\n\s*<h1>[^<]*<\/h1>\s*\n\s*\n\s*/,
      `$1\n`
    );

    // Add epub:type to body
    html = html.replace(
      /<body>/,
      `<body epub:type="${epubType}">`
    );
    // Handle case where body already has attributes
    html = html.replace(
      /<body([^>]*)(?<!epub:type="[^"]*")>/,
      `<body$1 epub:type="${epubType}">`
    );

    // Remove inline styles from figures (our CSS handles it now)
    html = html.replace(
      /<figure style="[^"]*">/g,
      '<figure>'
    );
    html = html.replace(
      /<img ([^>]*)style="[^"]*"([^>]*?)\s*\/?>/g,
      '<img $1$2 />'
    );
    html = html.replace(
      /<figcaption style="[^"]*">/g,
      '<figcaption>'
    );

    // Add epub:type semantic attributes to figures and figcaptions
    html = html.replace(/<figure>/g, '<figure epub:type="z3998:figure">');
    html = html.replace(/<figcaption>/g, '<figcaption epub:type="z3998:caption">');
    if (!html.includes('epub:prefix=')) {
      html = html.replace(
        /<html([^>]*?)>/,
        '<html$1 epub:prefix="z3998: http://www.daisy.org/z3998/2012/vocab/structure/#">'
      );
    }

    // Clean up double spaces from attribute removal
    html = html.replace(/  +/g, ' ');
    html = html.replace(/ >/g, '>');
    html = html.replace(/ \/>/g, ' />');

    zip.updateFile(entry.entryName, Buffer.from(html, 'utf-8'));
    chapterCount++;
  }
  console.log(`    ✓ Processed ${chapterCount} content files (semantic markup, removed duplicate headings)`);
  const startReadingHref = firstChapterHref || '0_' + bookTitle.replace(/[^a-zA-Z0-9]+/g, '-') + '.xhtml';

  // ── 5. Update toc.xhtml with landmarks ──
  const tocEntry = zip.getEntry('OEBPS/toc.xhtml');
  if (tocEntry) {
    let tocHtml = tocEntry.getData().toString('utf-8');

    // Add landmarks nav before </body>
    const landmarks = `
    <nav epub:type="landmarks" hidden="hidden">
      <h2>Guide</h2>
      <ol>
        <li><a epub:type="cover" href="cover.xhtml">Cover</a></li>
        <li><a epub:type="toc" href="toc.xhtml">Table of Contents</a></li>
        <li><a epub:type="bodymatter" href="${startReadingHref}">Start Reading</a></li>
      </ol>
    </nav>`;

    tocHtml = tocHtml.replace('</body>', `${landmarks}\n</body>`);
    zip.updateFile('OEBPS/toc.xhtml', Buffer.from(tocHtml, 'utf-8'));
    console.log('    ✓ Added landmarks navigation');
  }

  // ── 6. Update content.opf ──
  const opfEntry = zip.getEntry('OEBPS/content.opf');
  if (opfEntry) {
    let opf = opfEntry.getData().toString('utf-8');

    // Normalize cover manifest entry and force EPUB3 cover-image property.
    opf = opf.replace(
      /<item id="[^"]*cover[^"]*" href="cover\.(?:jpeg|jpg)" media-type="image\/jpeg"(?: properties="[^"]*")?\s*\/>/,
      '<item id="image_cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image" />'
    );
    if (!opf.includes('id="image_cover"')) {
      opf = opf.replace(
        '<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />',
        '<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />\n        <item id="image_cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image" />'
      );
    }

    // EPUB2 fallback: many file managers/readers still use this tag for thumbnails.
    if (opf.includes('<meta name="cover"')) {
      opf = opf.replace(
        /<meta name="cover" content="[^"]*"\s*\/>/,
        '<meta name="cover" content="image_cover"/>'
      );
    } else {
      opf = opf.replace(
        '</metadata>',
        '        <meta name="cover" content="image_cover"/>\n    </metadata>'
      );
    }

    // Add cover.xhtml to manifest (before first content item)
    if (!opf.includes('id="cover_page"')) {
      opf = opf.replace(
        /<item id="content_0_item_0"/,
        '<item id="cover_page" href="cover.xhtml" media-type="application/xhtml+xml"/>\n        \n        <item id="content_0_item_0"'
      );
    }

    // Fix spine: keep cover as the first readable document; keep ToC non-linear.
    opf = opf.replace(
      /<itemref idref="cover_page"[^>]*\/>/,
      '<itemref idref="cover_page"/>'
    );
    opf = opf.replace(
      /<itemref idref="toc"[^>]*\/>/,
      '<itemref idref="toc" linear="no"/>'
    );
    if (!/<itemref idref="cover_page"[^>]*\/>/.test(opf)) {
      opf = opf.replace(
        '<itemref idref="toc" linear="no"/>',
        '<itemref idref="cover_page"/>\n        <itemref idref="toc" linear="no"/>'
      );
    }

    // Update guide with both EPUB2 and Microsoft cover fallbacks.
    opf = opf.replace(
      /<guide>[\s\S]*?<\/guide>/,
      `<guide>
        <reference type="cover" title="Cover" href="cover.jpg"/>
        <reference type="other.ms-coverimage-standard" title="Cover Image" href="cover.jpg"/>
        <reference type="toc" title="Table of Contents" href="toc.xhtml"/>
        <reference type="text" title="Start Reading" href="${startReadingHref}"/>
    </guide>`
    );
    if (!opf.includes('<guide>')) {
      opf = opf.replace(
        '</package>',
        `    <guide>
        <reference type="cover" title="Cover" href="cover.jpg"/>
        <reference type="other.ms-coverimage-standard" title="Cover Image" href="cover.jpg"/>
        <reference type="toc" title="Table of Contents" href="toc.xhtml"/>
        <reference type="text" title="Start Reading" href="${startReadingHref}"/>
    </guide>
</package>`
      );
    }

    // Add series metadata (EPUB 3 collection) if not already present
    if (!opf.includes('belongs-to-collection')) {
      opf = opf.replace(
        '</metadata>',
        `    <meta property="belongs-to-collection" id="series">HistorIQly Books</meta>
        <meta refines="#series" property="collection-type">series</meta>
    </metadata>`
      );
    }

    zip.updateFile('OEBPS/content.opf', Buffer.from(opf, 'utf-8'));
    console.log('    ✓ Fixed spine order, added cover page, updated guide & metadata');
  }

  // ── 7. Compress oversized images ──
  let compressed = 0;
  const MAX_IMAGE_BYTES = 500_000; // 500KB max per image

  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith('OEBPS/images/')) continue;
    const ext = extname(entry.entryName).toLowerCase();
    const size = entry.header.size;

    if (size > MAX_IMAGE_BYTES && (ext === '.png' || ext === '.jpeg' || ext === '.jpg')) {
      try {
        const buffer = entry.getData();
        const compressed_buf = await sharp(buffer)
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();

        // Update the file in the zip
        const newName = entry.entryName.replace(/\.png$/, '.jpeg');
        if (newName !== entry.entryName) {
          // PNG → JPEG: need to update references
          zip.deleteFile(entry.entryName);
          zip.addFile(newName, compressed_buf);

          // Update all references in content files
          const oldFilename = entry.entryName.split('/').pop();
          const newFilename = newName.split('/').pop();
          const escapedOld = oldFilename.replace(/\./g, '\\.');
          for (const e of zip.getEntries()) {
            if (e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.opf')) {
              let content = e.getData().toString('utf-8');
              if (content.includes(oldFilename)) {
                content = content.replace(new RegExp(escapedOld, 'g'), newFilename);
                // Only fix media-type for this specific image's manifest entry
                const escapedNew = newFilename.replace(/\./g, '\\.');
                content = content.replace(
                  new RegExp(`(href="[^"]*${escapedNew}"[^>]*)media-type="image/png"`),
                  '$1media-type="image/jpeg"'
                );
                zip.updateFile(e.entryName, Buffer.from(content, 'utf-8'));
              }
            }
          }
        } else {
          zip.updateFile(entry.entryName, compressed_buf);
        }

        const savings = ((size - compressed_buf.length) / size * 100).toFixed(0);
        console.log(`    ✓ Compressed ${entry.entryName.split('/').pop()}: ${(size/1024).toFixed(0)}KB → ${(compressed_buf.length/1024).toFixed(0)}KB (-${savings}%)`);
        compressed++;
      } catch (err) {
        console.warn(`    ⚠ Failed to compress ${entry.entryName}: ${err.message}`);
      }
    }
  }
  if (compressed) console.log(`    ✓ Compressed ${compressed} oversized images`);

  // ── 8. Write a compliant ZIP container (mimetype first + stored) ──
  const JSZip = (await import('jszip')).default;
  const finalPath = outputPath || inputPath;
  const compliantZip = new JSZip();

  // OCF 3.3 requirement: mimetype must be the first entry and uncompressed.
  compliantZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  for (const entry of zip.getEntries()) {
    if (entry.entryName === 'mimetype' || entry.isDirectory) continue;
    compliantZip.file(entry.entryName, entry.getData(), { compression: 'DEFLATE' });
  }

  const finalBuffer = await compliantZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });
  writeFileSync(finalPath, finalBuffer);

  const compliance = checkMimetypeCompliance(finalPath, AdmZip);
  if (compliance.ok) {
    console.log('    ✓ Verified mimetype ordering (OCF 3.3 compliant)');
  } else {
    console.warn(
      `    ⚠ mimetype entry may be non-compliant (first=${compliance.isFirst ?? 'n/a'}, stored=${compliance.isStored ?? 'n/a'}, payload=${compliance.isValidPayload ?? 'n/a'})`
    );
  }

  const finalSize = readFileSync(finalPath).length;
  console.log(`  Done! Final size: ${(finalSize / 1024 / 1024).toFixed(1)} MB`);
}

// CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const input = process.argv[2] || resolve(ROOT, 'public/books/piltdown-man.epub');
  const output = process.argv[3] || input;
  await polishEpub(input, output);
}
