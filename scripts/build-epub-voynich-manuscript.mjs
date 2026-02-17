import { EPub } from 'epub-gen-memory';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateCover } from './generate-cover.mjs';
import { polishEpub } from './polish-epub.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IMG_DIR = resolve(ROOT, 'public/cases/images');
const COVER_DIR = resolve(ROOT, 'public/books/covers');

// --- BOOK DATA ---
const book = {
  title: 'The Book of Nowhere',
  subtitle: "The Voynich Manuscript and the Language That Doesn't Exist",
  author: 'HistorIQly',
  series: 'Vol. 10: Archaeological Mysteries',
  slug: 'voynich-manuscript',
  description:
    "A 600-year-old book written in an alphabet no one can read, illustrated with plants no one can identify, and owned by an emperor, a Jesuit polymath, and a revolutionary's husband. The Voynich Manuscript is the most mysterious document in the world.",
};

// --- IMAGE PATHS (file:// URLs for epub-gen-memory) ---
function imgFileUrl(filename) {
  const filepath = resolve(IMG_DIR, filename);
  try {
    readFileSync(filepath); // verify it exists
    return `file://${filepath}`;
  } catch {
    console.warn(`  Warning: image not found: ${filename}`);
    return '';
  }
}

function figureHtml(src, alt, caption) {
  if (!src) return '';
  return `<figure style="margin:2.5em 0;text-align:center;page-break-inside:avoid"><img src="${src}" alt="${alt}" style="max-width:100%;height:auto" /><figcaption style="font-size:0.85em;color:#78716C;margin-top:0.75em;font-style:italic;line-height:1.5">${caption}</figcaption></figure>`;
}

const images = {
  herbal: imgFileUrl('evidence-voynich-herbal-f32.jpg'),
  astronomical: imgFileUrl('evidence-voynich-astronomical-f67.jpg'),
  biological: imgFileUrl('evidence-voynich-biological-f82.jpg'),
  rosette: imgFileUrl('evidence-voynich-rosette-foldout.jpg'),
  rudolfII: imgFileUrl('figure-rudolf-ii-prague.jpg'),
  friedman: imgFileUrl('figure-william-friedman-ncm.jpg'),
  beinecke: imgFileUrl('location-beinecke-library-interior.jpg'),
  mondragone: imgFileUrl('location-villa-mondragone.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Bookworm': figureHtml(
    images.mondragone,
    'Villa Mondragone, Frascati, where Voynich found the manuscript',
    'Villa Mondragone in Frascati, near Rome. In 1912, Wilfrid Voynich purchased the manuscript from the Jesuits here, among a collection of old books being sold to pay for the crumbling building\'s repairs.'
  ),
  "The Emperor's Cabinet": figureHtml(
    images.rudolfII,
    'Emperor Rudolf II of Bohemia',
    'Rudolf II, Holy Roman Emperor, who reportedly purchased the manuscript for 600 gold ducats. His court in Prague was a magnet for astronomers, alchemists, and men of more ambiguous occupations.'
  ),
  'The Alphabet of Nowhere': figureHtml(
    images.herbal,
    'A page from the herbal section of the Voynich Manuscript',
    'A page from the herbal section showing an unidentifiable plant surrounded by text in the Voynich script. The handwriting is fluent and confident — whoever wrote this had written these characters many times before.'
  ),
  'The Garden of Impossible Plants': figureHtml(
    images.biological,
    'The biological/balneological section of the Voynich Manuscript',
    'A page from the biological section showing small nude female figures bathing in pools connected by an elaborate network of pipes. Nothing quite like it exists in any other medieval manuscript.'
  ),
  'The Codebreakers': figureHtml(
    images.friedman,
    'William F. Friedman display at the National Cryptologic Museum',
    'William Friedman, the greatest cryptanalyst of the twentieth century. He broke the Japanese PURPLE cipher in World War II but spent decades working on the Voynich Manuscript without reading a single word.'
  ),
  'A Most Ingenious Paradox': figureHtml(
    images.astronomical,
    'Astronomical/zodiac section of the Voynich Manuscript',
    'A page from the astronomical section showing circular diagrams with what appear to be zodiac symbols. The diagrams look like they should be interpretable — but they resist every attempt at comprehension.'
  ),
  'The Carbon Test': figureHtml(
    images.rosette,
    'The nine-rosette foldout page of the Voynich Manuscript',
    'The famous nine-rosette foldout — the largest page in the manuscript — showing interconnected circular structures that might represent cities, islands, or celestial bodies. It unfolds to nearly six times the size of a standard page.'
  ),
  'MS 408': figureHtml(
    images.beinecke,
    'Interior of the Beinecke Rare Book & Manuscript Library at Yale',
    'The Beinecke Rare Book & Manuscript Library at Yale University, where the Voynich Manuscript has been housed since 1969. Catalogued as MS 408, it is the most famous object in the collection.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/voynich-manuscript.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'([^']*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
const chapters = [];
let match;
while ((match = chapterRegex.exec(raw)) !== null) {
  chapters.push({
    num: match[1],
    title: match[2] || match[3],
    content: match[4],
  });
}

console.log(`Found ${chapters.length} chapters`);

// --- STYLES ---
const css = `
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    line-height: 1.8;
    color: #1C1917;
    margin: 0;
    padding: 0 1em;
  }
  h1 {
    font-size: 2.5em;
    font-weight: 300;
    text-align: center;
    margin: 2em 0 0.25em;
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: 1.6em;
    font-weight: 400;
    text-align: center;
    margin: 2em 0 0.5em;
  }
  .chapter-num {
    display: block;
    text-align: center;
    font-size: 0.75em;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    color: #78716C;
    margin-bottom: 0.5em;
    font-family: sans-serif;
  }
  p {
    margin: 0 0 1em;
    text-align: justify;
    font-size: 1em;
  }
  em { font-style: italic; }
  strong { font-weight: 700; }
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
  }
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
  .epigraph {
    text-align: center;
    font-style: italic;
    color: #57534E;
    max-width: 28em;
    margin: 4em auto 2em;
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
`;

// --- BUILD EPUB CONTENT ---
const titlePage = `
  <div class="title-page">
    <p class="meta" style="margin-bottom:2em">${book.series}</p>
    <h1>${book.title}</h1>
    <p class="subtitle">${book.subtitle}</p>
    <span class="divider"></span>
    <p class="based-on">Based on real events</p>
    <span class="divider"></span>
    <p class="meta" style="margin-top:3em;font-size:1em">${book.author}</p>
  </div>
`;

const epigraphPage = `
  <p class="epigraph">"This book, bequeathed to me by an intimate friend, I destined for you, my dear Athanasius, as soon as it came into my possession, for I was convinced it could be read by no one except yourself."</p>
  <p class="epigraph-attr">— Johannes Marcus Marci to Athanasius Kircher, 1665</p>
`;

const epubChapters = [
  {
    title: book.title,
    content: titlePage,
  },
  {
    title: 'Epigraph',
    content: epigraphPage,
  },
  ...chapters.map((ch) => {
    const img = chapterImages[ch.title] || '';
    return {
      title: ch.title,
      content: `
        <span class="chapter-num">Chapter ${ch.num}</span>
        <h2>${ch.title}</h2>
        ${ch.content}
        ${img}
      `,
    };
  }),
  {
    title: 'Timeline',
    content: `
      <h2>Timeline</h2>
      <p><strong>c. 1404–1438</strong> — The vellum is manufactured. Carbon-14 dating places the parchment's creation in this window with 95% confidence. The manuscript is likely created during this period.</p>
      <p><strong>c. 1580s</strong> — John Dee and Edward Kelley visit the court of Rudolf II in Prague. Either could have brought the manuscript to the emperor, though no direct evidence links them to it.</p>
      <p><strong>c. 1586–1612</strong> — Emperor Rudolf II reportedly purchases the manuscript for 600 gold ducats, on the belief that it was written by Roger Bacon.</p>
      <p><strong>Before 1622</strong> — Jacobus Horcicky de Tepenec (Jacobus Sinapius), Rudolf's personal pharmacist, possesses the manuscript. His faded signature is found on the first folio under ultraviolet light.</p>
      <p><strong>c. 1630s</strong> — Georg Baresch, a Prague alchemist, owns the manuscript. He writes to Athanasius Kircher in Rome describing it as a mysterious book "taking up space uselessly in his library."</p>
      <p><strong>1665/1666</strong> — Johannes Marcus Marci, rector of Prague University, sends the manuscript to Kircher in Rome with a letter describing its provenance.</p>
      <p><strong>c. 1680–1912</strong> — The manuscript resides in Jesuit collections, eventually ending up at Villa Mondragone in Frascati. It remains forgotten for over two centuries.</p>
      <p><strong>1912</strong> — Wilfrid Voynich purchases the manuscript at Villa Mondragone. He spends the rest of his life trying to have it deciphered.</p>
      <p><strong>1921</strong> — William Newbold of the University of Pennsylvania announces a decipherment based on microscopic shorthand. It is debunked by John Manly in 1931.</p>
      <p><strong>1944–1945</strong> — William Friedman's First Study Group — top military cryptanalysts — examines the manuscript without success.</p>
      <p><strong>1969</strong> — Hans P. Kraus donates the manuscript to Yale University's Beinecke Rare Book and Manuscript Library, where it is catalogued as MS 408.</p>
      <p><strong>1976</strong> — Prescott Currier identifies two statistically distinct "languages" (Language A and Language B) within the text.</p>
      <p><strong>1978</strong> — Mary D'Imperio publishes <em>The Voynich Manuscript: An Elegant Enigma</em> for the NSA, the most comprehensive survey of decryption attempts to date.</p>
      <p><strong>2004</strong> — Gordon Rugg proposes the Cardan grille hoax theory, demonstrating that a simple mechanical device could generate Voynich-like text.</p>
      <p><strong>2009</strong> — Radiocarbon dating at the University of Arizona dates the vellum to 1404–1438. The McCrone Research Institute confirms the inks are medieval.</p>
      <p><strong>2011</strong> — Yale digitises the entire manuscript and makes it available online, dramatically expanding the research community.</p>
      <p><strong>2013</strong> — Montemurro and Zanette publish statistical evidence that the text carries semantic content, arguing against the hoax theory.</p>
      <p><strong>Present</strong> — The manuscript remains undeciphered at the Beinecke Library. No proposed solution has gained broad acceptance.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a narrative account of the Voynich Manuscript's history and the attempts to decipher it, based on documented events and published scholarship. The chronology, key figures, and factual framework are grounded in primary sources and historical research.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>D'Imperio, Mary E. — <em>The Voynich Manuscript: An Elegant Enigma</em>, NSA/CSS, 1978</p>
      <p>Kennedy, Gerry & Churchill, Rob — <em>The Voynich Manuscript: The Mysterious Code That Has Defied Interpretation for Centuries</em>, Inner Traditions, 2006</p>
      <p>Rugg, Gordon — "An Elegant Hoax? A Possible Solution to the Voynich Manuscript," <em>Cryptologia</em>, 2004</p>
      <p>Montemurro, Marcelo A. & Zanette, Damián H. — "Keywords and Co-Occurrence Patterns in the Voynich Manuscript," <em>PLOS ONE</em>, 2013</p>
      <p>Beinecke Rare Book & Manuscript Library — "Voynich Manuscript (MS 408)," Yale University Digital Collections</p>
      <p class="separator">***</p>
      <p>This book is part of <strong>${book.series}</strong> in the HistorIQly Books series — real history, told like a thriller.</p>
      <p>Visit <a href="https://books.historiqly.com">books.historiqly.com</a> for more stories.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
];

// --- GENERATE ---
async function build() {
  try {
    // Generate cover
    console.log('Generating cover...');
    mkdirSync(COVER_DIR, { recursive: true });
    const coverPath = resolve(COVER_DIR, `${book.slug}.jpg`);

    if (!existsSync(coverPath)) {
      await generateCover({
        backgroundImage: resolve(IMG_DIR, 'hero-voynich-manuscript-f1r.jpg'),
        title: 'The Book of\nNowhere',
        subtitle: book.subtitle,
        series: book.series,
        author: book.author,
        outputPath: coverPath,
      });
    } else {
      console.log(`  Using existing cover: ${coverPath}`);
    }

    // epub-gen-memory fetches string covers as URLs (which fails for local paths),
    // so we pass a File object with the image data
    const coverBuffer = readFileSync(coverPath);
    const coverFile = new File([coverBuffer], 'cover.jpeg', { type: 'image/jpeg' });

    const options = {
      title: `${book.title}: ${book.subtitle}`,
      author: book.author,
      publisher: 'HistorIQly',
      description: book.description,
      lang: 'en',
      css,
      cover: coverFile,
    };

    console.log('Generating EPUB...');
    const epubBuffer = await new EPub(options, epubChapters).genEpub();

    // Write to public directory so it's served by Astro
    const outDir = resolve(ROOT, 'public/books');
    mkdirSync(outDir, { recursive: true });

    const outPath = resolve(outDir, `${book.slug}.epub`);
    writeFileSync(outPath, epubBuffer);

    const imgCount = Object.values(chapterImages).filter(Boolean).length;
    console.log(`\nRaw EPUB written to: ${outPath}`);
    console.log(`Size: ${(epubBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Chapters: ${chapters.length}`);
    console.log(`Images: ${imgCount} chapters with illustrations`);

    // Post-process: fix structure, add cover page, dark mode, compress images
    console.log('\nPost-processing...');
    await polishEpub(outPath, outPath);

    console.log('\nDone!');
  } catch (err) {
    console.error('Failed to generate EPUB:', err);
    process.exit(1);
  }
}

build();
