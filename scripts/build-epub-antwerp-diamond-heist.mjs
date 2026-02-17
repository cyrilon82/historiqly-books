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
  title: 'The Antwerp Diamond Heist',
  subtitle: 'The Thieves Who Beat Ten Layers of Security',
  author: 'HistorIQly',
  series: 'Vol. 11: Heists',
  slug: 'antwerp-diamond-heist',
  description:
    'In 2003, a team of Italian thieves bypassed ten layers of supposedly impenetrable security to steal over $100 million in diamonds from the Antwerp Diamond Centre. They were undone by a half-eaten sandwich dumped in a forest. This is the true story of the heist of the century.',
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
  hero: imgFileUrl('hero-antwerp-diamond-district.jpg'),
  shops: imgFileUrl('atmosphere-antwerp-diamond-shops.jpg'),
  station: imgFileUrl('atmosphere-antwerp-central-station.jpg'),
  skyline: imgFileUrl('atmosphere-antwerp-skyline.jpg'),
  vault1908: imgFileUrl('evidence-safe-deposit-vault-1908.jpg'),
  vaultDoor: imgFileUrl('evidence-bank-vault-door.png'),
  diamonds: imgFileUrl('evidence-diamond-assortment.jpg'),
  safeDeposit: imgFileUrl('evidence-vault-door-safe-deposit.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Diamond Capital': figureHtml(
    images.shops,
    'Diamond shops in the Antwerp Diamond District',
    'The Antwerp Diamond District, a handful of streets near Centraal Station that processes 85% of the world\'s rough diamonds. The wealth that moves through these blocks is almost entirely invisible.'
  ),
  'The School of Turin': figureHtml(
    images.skyline,
    'Antwerp city skyline',
    'Antwerp\'s skyline. The city has been the centre of the global diamond trade since the fifteenth century, when Flemish craftsmen invented new cutting techniques that attracted European nobility.'
  ),
  'The Surveillance': figureHtml(
    images.station,
    'Antwerp Central Station',
    'Antwerp Centraal Station, the ornate railway terminal adjacent to the Diamond District. Notarbartolo spent 28 months as a tenant in the Diamond Centre, studying every guard rotation, camera angle, and security system from the inside.'
  ),
  'Ten Layers': figureHtml(
    images.vaultDoor,
    'A bank vault door',
    'A steel vault door. The Antwerp Diamond Centre vault was protected by a three-ton door, a combination lock with 100 million possible sequences, and ten overlapping layers of sensors and alarms. The crew defeated them all with hairspray, electrical tape, and patience.'
  ),
  'The Weekend': figureHtml(
    images.diamonds,
    'An assortment of diamonds',
    'The crew broke into 109 of 189 safe deposit boxes, extracting approximately 120,000 carats of loose diamonds along with gold, cash, and jewelry — over $100 million in total.'
  ),
  'The Sandwich': figureHtml(
    images.vault1908,
    'A safe deposit vault',
    'Safe deposit boxes of the type found in the Antwerp Diamond Centre. The crew\'s meticulous two-year plan was undone when a team member dumped garbage bags containing evidence — including a half-eaten sandwich — in a forest near the E19 motorway.'
  ),
  'The Heist of the Century': figureHtml(
    images.hero,
    'The Antwerp Diamond District street view',
    'The diamond district today. More than twenty years after the heist, over $100 million in stolen diamonds remain unrecovered. The King of Keys — the man who duplicated the vault key from video footage — has never been identified.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/antwerp-diamond-heist.ts');
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
  <p class="epigraph">"Every lock is a puzzle. And every puzzle has a solution."</p>
  <p class="epigraph-attr">— Attributed to the School of Turin</p>
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
      <p><strong>15th Century</strong> — Antwerp establishes itself as the centre of the European diamond trade after Flemish craftsman Lodewyk van Berken invents the <em>scaif</em>, a diamond polishing tool.</p>
      <p><strong>Autumn 2000</strong> — Leonardo Notarbartolo, a professional thief from Turin, Italy, rents an office at the Antwerp Diamond Centre at 9/11 Schupstraat under the alias "Leon Rombaldi." He poses as an Italian gem importer, pays $700/month, and opens a safe deposit box in the vault.</p>
      <p><strong>2000–2002</strong> — Over 18 months, Notarbartolo conducts surveillance from inside the building. He hides a camera in a briefcase to film guard routines and security cameras. He installs a wireless camera above the vault door, concealed in a modified fire extinguisher, which records the vault combination being entered.</p>
      <p><strong>~2001</strong> — Notarbartolo recruits a team from the School of Turin criminal network: Elio D'Onorio (electronics/alarms), Ferdinando Finotto (locks/mechanics), Pietro Tavano (logistics/driver), and an unidentified man known as "the King of Keys" (key forging).</p>
      <p><strong>Late 2002</strong> — The team builds a full-scale replica of the Diamond Centre vault and rehearses the heist extensively, timing each movement and developing contingency plans.</p>
      <p><strong>September 2002</strong> — The hidden camera captures the vault combination. The King of Keys duplicates the foot-long vault key from video footage.</p>
      <p><strong>Early February 2003</strong> — Pre-heist sabotage: magnetic lock screws are partially removed during business hours; hairspray is sprayed on the thermal-motion sensor.</p>
      <p><strong>15–16 February 2003</strong> — <strong>THE HEIST.</strong> Over Valentine's Day weekend, the crew enters through a neighbouring building, defeats all ten security layers, and breaks into 109 of 189 safe deposit boxes. They escape with over $100 million in diamonds, gold, cash, and jewelry.</p>
      <p><strong>17 February 2003 (Monday)</strong> — The heist is discovered when the Diamond Centre opens for business. Pietro Tavano dumps garbage bags containing evidence near the E19 motorway. Shopkeeper August Van Camp finds the bags and calls police.</p>
      <p><strong>21 February 2003</strong> — Notarbartolo is arrested by Antwerp's Diamond Detective Squad when he returns to the Diamond Centre. Italian police find 17 polished diamonds in his Turin safe.</p>
      <p><strong>2005</strong> — Trial in Antwerp. Notarbartolo sentenced to 10 years; D'Onorio and Tavano each receive 5 years. All ordered to pay 4.5 million euros in damages.</p>
      <p><strong>2007</strong> — Ferdinando Finotto arrested; later sentenced to 5 years.</p>
      <p><strong>March 2009</strong> — Joshua Davis publishes landmark <em>Wired</em> magazine article based on prison interviews with Notarbartolo. Notarbartolo released on parole.</p>
      <p><strong>2009</strong> — Scott Andrew Selby and Greg Campbell publish <em>Flawless</em>, the definitive book on the heist.</p>
      <p><strong>2013</strong> — Notarbartolo re-arrested at Charles de Gaulle Airport in Paris; returned to prison.</p>
      <p><strong>2017</strong> — Notarbartolo released after completing his sentence.</p>
      <p><strong>2022</strong> — Ferdinando Finotto dies.</p>
      <p><strong>August 2025</strong> — Netflix releases documentary <em>Stolen: Heist of the Century</em>, featuring Notarbartolo on camera for the first time.</p>
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
      <p>Selby, Scott Andrew & Campbell, Greg — <em>Flawless: Inside the Largest Diamond Heist in History</em>, Union Square Press, 2009</p>
      <p>Davis, Joshua — "The Untold Story of the World's Biggest Diamond Heist," <em>Wired</em>, March 2009</p>
      <p>Netflix — <em>Stolen: Heist of the Century</em> (documentary series), August 2025</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-antwerp-diamond-district.jpg'),
        title: 'The Antwerp\nDiamond Heist',
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
