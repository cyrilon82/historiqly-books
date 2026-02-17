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
  title: 'The Mary Celeste',
  subtitle: 'The Ghost Ship That Haunted the Atlantic',
  author: 'HistorIQly',
  series: 'Vol. 4: Disappearances',
  slug: 'mary-celeste',
  description:
    'In 1872, a brigantine was found drifting in the mid-Atlantic — seaworthy, fully provisioned, cargo intact — but every soul aboard had vanished. No bodies. No struggle. No explanation. This is the true story of the most famous ghost ship in maritime history.',
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
  hero: imgFileUrl('hero-mary-celeste.jpg'),
  amazon: imgFileUrl('mary-celeste-as-amazon.jpg'),
  briggs: imgFileUrl('figure-captain-briggs.jpg'),
  sarah: imgFileUrl('figure-sarah-briggs.jpg'),
  sophia: imgFileUrl('figure-sophia-briggs.jpg'),
  richardson: imgFileUrl('figure-albert-richardson.jpg'),
  conanDoyle: imgFileUrl('suspect-conan-doyle.jpg'),
  gibraltarWharf: imgFileUrl('gibraltar-waterport-wharf-1878.jpg'),
  gibraltarHarbor: imgFileUrl('gibraltar-harbor-aivazovsky.jpg'),
  nytimes: imgFileUrl('nytimes-1873-mary-celeste.jpg'),
  chart: imgFileUrl('nautical-chart-north-atlantic-1870.jpg'),
  atmosphere: imgFileUrl('atmosphere-sailing-ship-sea.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Amazon': figureHtml(
    images.amazon,
    'The Mary Celeste as Amazon, entering Marseilles in 1861',
    'The ship as she was first known — the <em>Amazon</em>, painted entering Marseilles in November 1861. She was built at Spencer\'s Island, Nova Scotia, and would be renamed <em>Mary Celeste</em> after being wrecked and rebuilt in 1868.'
  ),
  'The Captain': figureHtml(
    images.briggs,
    'Captain Benjamin Spooner Briggs',
    'Captain Benjamin Spooner Briggs (1835–1872). A devout, teetotalling Massachusetts captain from a prominent seafaring family. He invested his savings in the <em>Mary Celeste</em> and brought his wife and infant daughter aboard for the voyage.'
  ),
  'Pier 50': figureHtml(
    images.chart,
    'Admiralty Chart of the North Atlantic Ocean, 1870',
    'An Admiralty chart of the North Atlantic from 1870, showing the shipping lanes between New York and the Mediterranean. The <em>Mary Celeste</em> departed Pier 50 on November 7, 1872, bound for Genoa with 1,701 barrels of denatured alcohol.'
  ),
  'The Derelict': figureHtml(
    images.atmosphere,
    'Sailing ships at sea — period painting',
    'Two sailing vessels in the Atlantic, painted by William Ayerst Ingram. On December 4, 1872, the <em>Dei Gratia</em> spotted the <em>Mary Celeste</em> drifting erratically with no one at the helm. First Mate Oliver Deveau climbed aboard and found the ship deserted.'
  ),
  'The Rock': figureHtml(
    images.gibraltarHarbor,
    'American Shipping off the Rock of Gibraltar, by Aivazovsky, 1873',
    'Ships near Gibraltar, painted by Ivan Aivazovsky in 1873 — the same year the Vice Admiralty Court hearings dragged on for three months. Attorney General Solly-Flood saw conspiracy where there was only rust.'
  ),
  'The Mythmaker': figureHtml(
    images.conanDoyle,
    'Arthur Conan Doyle, c. 1890',
    'Arthur Conan Doyle, three years before creating Sherlock Holmes. His 1884 story "J. Habakuk Jephson\'s Statement" introduced the misspelling "Marie Celeste" and the fictional details — warm tea, half-eaten meals — that replaced the real facts in public memory.'
  ),
  'The Truth': figureHtml(
    images.hero,
    'Engraving of the Mary Celeste',
    'A contemporary engraving of the <em>Mary Celeste</em>. In 2006, a UCL chemist demonstrated that leaking alcohol vapour could produce a massive flash explosion — terrifying but leaving no fire damage — the most likely cause of the crew\'s fatal decision to abandon ship.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/mary-celeste.ts');
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
  <p class="epigraph">"The sea has never been friendly to man. At most it has been the accomplice of human restlessness."</p>
  <p class="epigraph-attr">— Joseph Conrad</p>
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
      <p><strong>1861 (May 18)</strong> — The brigantine <em>Amazon</em> is launched at Spencer's Island, Nova Scotia. Her first captain, Robert McLellan, dies of pneumonia on her maiden voyage.</p>
      <p><strong>1862–1867</strong> — Under subsequent captains, the <em>Amazon</em> suffers multiple collisions, a fire, and a grounding on Cape Breton Island. Her owners abandon her as a total loss.</p>
      <p><strong>1868</strong> — American mariner Richard W. Haines purchases the wreck for $1,750, rebuilds her, and registers her under a new name: <em>Mary Celeste</em>.</p>
      <p><strong>1872 (Early)</strong> — Major refit costing $10,000 enlarges the ship to 282 tons. Captain Benjamin Spooner Briggs purchases four of twelve shares and is appointed captain.</p>
      <p><strong>1872 (November 7)</strong> — The <em>Mary Celeste</em> departs New York, Pier 50, bound for Genoa with 1,701 barrels of denatured alcohol. Aboard: Captain Briggs (37), his wife Sarah (30), daughter Sophia (2), and seven crew.</p>
      <p><strong>1872 (November 15)</strong> — The <em>Dei Gratia</em>, under Captain David Morehouse, departs New York on a similar route, eight days behind.</p>
      <p><strong>1872 (November 25)</strong> — Last entry in the <em>Mary Celeste</em>'s log: position six miles northeast of Santa Maria Island, Azores. After this, silence.</p>
      <p><strong>1872 (December 4)</strong> — The <em>Dei Gratia</em> spots the <em>Mary Celeste</em> drifting erratically in the mid-Atlantic, 600 miles from Portugal. First Mate Oliver Deveau boards and finds the ship deserted. Lifeboat, navigation instruments, and ship's register are missing. Cargo intact. No signs of violence.</p>
      <p><strong>1872 (December 13)</strong> — The <em>Mary Celeste</em> arrives in Gibraltar under a salvage crew. She is immediately impounded by the Vice Admiralty Court.</p>
      <p><strong>1872–1873</strong> — Attorney General Frederick Solly-Flood conducts a three-month investigation, alleging conspiracy and murder. "Blood" stains are tested and found to be rust. No evidence of foul play is found.</p>
      <p><strong>1873 (April 8)</strong> — Salvage award of £1,700 — roughly one-fifth of total value — is granted to the <em>Dei Gratia</em>'s crew. The low award reflects lingering suspicion.</p>
      <p><strong>1884 (January)</strong> — Arthur Conan Doyle publishes "J. Habakuk Jephson's Statement" anonymously in <em>The Cornhill Magazine</em>. The story misspells the name as "Marie Celeste" and introduces fictional details (warm meals, burning cigars) that enter popular mythology.</p>
      <p><strong>1885 (January 3)</strong> — Captain Gilman Parker deliberately wrecks the <em>Mary Celeste</em> on the Rochelois Bank off Haiti in an insurance fraud scheme. He is charged with barratry (death penalty) but the jury cannot convict. He dies in poverty three months later.</p>
      <p><strong>2001</strong> — Clive Cussler's NUMA expedition announces discovery of the wreck off Haiti, though dendrochronological analysis later disputes the identification.</p>
      <p><strong>2006</strong> — Dr. Andrea Sella of University College London demonstrates that alcohol vapour can produce a massive flash explosion leaving no fire damage — the most widely accepted explanation for the crew's abandonment.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; dialogue and some scene detail are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Hicks, Brian — <em>Ghost Ship: The Mysterious True Story of the Mary Celeste and Her Missing Crew</em>, Ballantine Books, 2004</p>
      <p>Begg, Paul — <em>Mary Celeste: The Greatest Mystery of the Sea</em>, Routledge, 2005</p>
      <p>Fay, Charles Edey — <em>The Story of the Mary Celeste</em>, Dover, 1942</p>
      <p>Sella, Andrea — "Solved: The Mystery of the Mary Celeste," UCL News, May 2006</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-mary-celeste.jpg'),
        title: 'The Mary\nCeleste',
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
