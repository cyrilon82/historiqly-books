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
  title: 'The Philadelphia Experiment',
  subtitle: 'The Invisible Ship That Never Was',
  author: 'HistorIQly',
  series: 'Vol. 5: Conspiracies',
  slug: 'philadelphia-experiment',
  description:
    'In 1943, the U.S. Navy allegedly rendered a destroyer escort invisible and teleported it two hundred miles — with catastrophic consequences for the crew. The story of the Philadelphia Experiment has captivated conspiracy theorists for decades. But it all traces back to a single man: a troubled merchant mariner with a wild imagination and a taste for the dramatic.',
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
  hero: imgFileUrl('uss-eldridge-at-sea.jpg'),
  eldridge: imgFileUrl('hero-uss-eldridge.jpg'),
  engstrom: imgFileUrl('uss-engstrom-philadelphia.jpg'),
  shipyard: imgFileUrl('philadelphia-naval-shipyard-1943.jpg'),
  einstein: imgFileUrl('albert-einstein-portrait.jpg'),
  transfer: imgFileUrl('uss-eldridge-transfer-greece.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Legend': figureHtml(
    images.hero,
    'USS Eldridge (DE-173) underway at sea, circa 1944',
    'The USS Eldridge (DE-173) underway at sea, circa 1944. This Cannon-class destroyer escort became the most famous ship in conspiracy lore — alleged to have been rendered invisible and teleported two hundred miles in a secret Navy experiment.'
  ),
  'The Ship': figureHtml(
    images.transfer,
    'USS Eldridge being transferred to Greece, January 1951',
    'The USS Eldridge (left) alongside USS Garfield Thomas during their transfer to the Greek Navy, January 15, 1951. The Eldridge served as HS Leon (D-54) in the Hellenic Navy until being scrapped in 1999.'
  ),
  'The Merchant Mariner': figureHtml(
    images.eldridge,
    'USS Eldridge (DE-173) underway, circa 1944',
    'The USS Eldridge underway. Carlos Allende claimed to have witnessed the ship vanish from the deck of the merchant vessel SS Andrew Furuseth — but the Eldridge\'s deck logs show it was never in Philadelphia during the alleged experiment.'
  ),
  'What the Navy Was Really Doing': figureHtml(
    images.engstrom,
    'USS Engstrom (DE-50) at the Philadelphia Naval Shipyard, July 1943',
    'The USS Engstrom (DE-50) underway off the Philadelphia Naval Shipyard, July 2, 1943. Navy veteran Edward Dudgeon, who served aboard the Engstrom, provided one of the most compelling explanations for the Philadelphia Experiment legend: the mundane but classified process of degaussing.'
  ),
  "The Invisible Ship's Legacy": figureHtml(
    images.einstein,
    'Albert Einstein, portrait',
    'Albert Einstein, whose Unified Field Theory was cited as the theoretical basis for the Philadelphia Experiment. Einstein did consult for the Navy during WWII, but on conventional weapons research — not electromagnetic invisibility.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/philadelphia-experiment.ts');
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
  <p class="epigraph">"ONR has never conducted investigations on radar invisibility, either in 1943 or at any other time."</p>
  <p class="epigraph-attr">— Office of Naval Research, official statement, September 1996</p>
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
      <p><strong>August 27, 1943</strong> — USS Eldridge (DE-173) is commissioned at the Federal Shipbuilding and Drydock Company in Newark, New Jersey.</p>
      <p><strong>October 1943</strong> — The alleged Philadelphia Experiment. Navy records show the Eldridge was in Bermuda and then New York during this period — never in Philadelphia.</p>
      <p><strong>1951</strong> — The Eldridge is transferred to Greece under the Mutual Defense Assistance Program and renamed HS Leon (D-54).</p>
      <p><strong>1955</strong> — Morris K. Jessup publishes <em>The Case for the UFO</em>, speculating about electromagnetic propulsion.</p>
      <p><strong>January 1956</strong> — Carlos Allende (Carl Allen) sends his first letter to Jessup, claiming to have witnessed the Philadelphia Experiment from the deck of the SS Andrew Furuseth.</p>
      <p><strong>1957</strong> — An annotated copy of Jessup's book arrives at the Office of Naval Research. ONR officers commission the Varo Manufacturing Company to reproduce it in a limited print run of approximately 127 copies.</p>
      <p><strong>April 20, 1959</strong> — Morris Jessup is found dead in his car in Coral Gables, Florida. Cause of death: carbon monoxide poisoning. Ruled a suicide.</p>
      <p><strong>1969</strong> — Carlos Allende visits the Aerial Phenomena Research Organization (APRO) in Tucson, Arizona, and admits the Philadelphia Experiment was a hoax he fabricated. He later retracts the confession.</p>
      <p><strong>1979</strong> — Charles Berlitz and William Moore publish <em>The Philadelphia Experiment: Project Invisibility</em>, bringing the story to a mass audience for the first time.</p>
      <p><strong>1984</strong> — The feature film <em>The Philadelphia Experiment</em>, directed by Stewart Raffill and produced by John Carpenter, is released. It becomes a cult classic.</p>
      <p><strong>1989</strong> — Al Bielek begins claiming he was a participant in the Philadelphia Experiment and connects it to the Montauk Project.</p>
      <p><strong>1992</strong> — Preston Nichols and Peter Moon publish <em>The Montauk Project: Experiments in Time</em>, linking the Philadelphia Experiment to alleged time travel experiments.</p>
      <p><strong>March 5, 1994</strong> — Carlos Allende dies in a nursing home in Greeley, Colorado, at age sixty-eight.</p>
      <p><strong>September 1996</strong> — The Office of Naval Research issues an official statement categorically denying the Philadelphia Experiment, stating it has "never conducted investigations on radar invisibility, either in 1943 or at any other time."</p>
      <p><strong>1999</strong> — The USS Eldridge (HS Leon) is sold for scrap in Greece. Researchers find no unusual modifications.</p>
      <p><strong>October 10, 2011</strong> — Al Bielek dies at age eighty-four, never having wavered in his claims.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources — including the USS Eldridge's deck logs, the Naval History and Heritage Command's official statements, and the surviving correspondence of Carlos Allende — while some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Berlitz, Charles & Moore, William L. — <em>The Philadelphia Experiment: Project Invisibility</em>, Grosset & Dunlap, 1979</p>
      <p>Jessup, Morris K. — <em>The Case for the UFO</em>, Citadel Press, 1955</p>
      <p>Vallée, Jacques — <em>Revelations: Alien Contact and Human Deception</em>, Ballantine Books, 1991</p>
      <p>Nichols, Preston & Moon, Peter — <em>The Montauk Project: Experiments in Time</em>, Sky Books, 1992</p>
      <p>Naval History and Heritage Command — <em>Philadelphia Experiment</em>, official statement (online)</p>
      <p class="separator">***</p>
      <p>This book is part of <strong>${book.series}</strong> in the HistorIQly Books series — real history, told as a mystery.</p>
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
        backgroundImage: resolve(IMG_DIR, 'uss-eldridge-at-sea.jpg'),
        title: 'The Philadelphia\nExperiment',
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
