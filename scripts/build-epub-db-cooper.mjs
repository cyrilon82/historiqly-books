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
  title: 'D.B. Cooper',
  subtitle: 'The Man Who Fell Off the Earth',
  author: 'HistorIQly',
  series: 'Vol. 4: Disappearances',
  slug: 'db-cooper',
  description:
    'On the night before Thanksgiving 1971, a man in a dark suit hijacked a Boeing 727, collected $200,000 in ransom, and parachuted into the rain-soaked darkness over the Pacific Northwest. He was never seen again. This is the true story of America\'s only unsolved skyjacking.',
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
  hero: imgFileUrl('hero-cooper-fbi-sketches.jpg'),
  boeing: imgFileUrl('hero-boeing-727-northwest-orient.jpg'),
  compositeA: imgFileUrl('evidence-fbi-composite-a-1971.jpg'),
  compositeB: imgFileUrl('evidence-fbi-composite-b-original.jpg'),
  wanted: imgFileUrl('evidence-fbi-wanted-poster-1971.jpg'),
  money: imgFileUrl('evidence-ransom-money-tena-bar-1980.jpg'),
  ticket: imgFileUrl('evidence-plane-ticket-dan-cooper.jpg'),
  map: imgFileUrl('map-fbi-flight-path-drop-zone.png'),
  rackstraw: imgFileUrl('suspect-robert-rackstraw-1970.jpg'),
  cooperVane: imgFileUrl('evidence-cooper-vane-device.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Ticket': figureHtml(
    images.ticket,
    'D.B. Cooper\'s plane ticket — one-way Portland to Seattle',
    'The ticket purchased by "Dan Cooper" at Portland International Airport. One-way to Seattle. Eighteen dollars. Cash. No ID required. The name was likely borrowed from a French-language comic book about a parachuting test pilot.'
  ),
  'The Demands': figureHtml(
    images.boeing,
    'Boeing 727-51 N467US — the actual aircraft hijacked by D.B. Cooper',
    'Northwest Orient Airlines Boeing 727-51, registration N467US — the actual aircraft Cooper hijacked on November 24, 1971. The 727\'s rear ventral airstair, designed for smaller airports, became the most important engineering detail in the history of American crime.'
  ),
  'The Jump': figureHtml(
    images.compositeA,
    'FBI Composite Sketch A of D.B. Cooper, 1971',
    'FBI Composite Sketch A, completed days after the hijacking. The witnesses could not agree on Cooper\'s appearance — the sunglasses had hidden too much. This sketch was considered the less accurate of the two primary composites.'
  ),
  'The Hunt': figureHtml(
    images.wanted,
    'FBI wanted poster for D.B. Cooper',
    'The FBI\'s wanted bulletin for the unknown hijacker of Northwest Orient Flight 305. The NORJAK investigation — Northwest Hijacking — became the most expensive and most exhaustive manhunt in Bureau history.'
  ),
  'The Money': figureHtml(
    images.money,
    'Deteriorated ransom money found at Tena Bar on the Columbia River, 1980',
    'Three packets of twenty-dollar bills from Cooper\'s ransom, found by eight-year-old Brian Ingram at Tena Bar on the Columbia River in February 1980. The bills were deteriorated, blackened, and shrunken — but the serial numbers matched the FBI\'s list. The other $194,200 has never surfaced.'
  ),
  'The Suspects': figureHtml(
    images.rackstraw,
    'Robert Rackstraw — 1970 U.S. Army military ID photo',
    'Robert Wesley Rackstraw, photographed for his 1970 U.S. Army military ID. Vietnam veteran, helicopter pilot, paratrooper, and demolitions expert. A forensic artist found "nine points of match" between this photo and FBI Composite B. Rackstraw denied being Cooper until his death in 2019.'
  ),
  'The Legend': figureHtml(
    images.cooperVane,
    'The Cooper vane device installed on Boeing 727 aircraft',
    'The Cooper vane — a mechanical wedge installed on every Boeing 727 after the hijacking to prevent the rear airstair from being lowered in flight. Named directly after D.B. Cooper, it remains a permanent reminder of the man who found the design flaw and exploited it.'
  ),
  'Into the Dark': figureHtml(
    images.map,
    'FBI map showing the flight path and suspected drop zone',
    'The FBI\'s map of Flight 305\'s path from Seattle to Portland and the suspected drop zone over southwest Washington. The search area covered thousands of acres of dense Pacific Northwest forest. Eighteen days of searching found nothing — no parachute, no body, no money, no trace.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/db-cooper.ts');
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
  <p class="epigraph">"We do have a hijacking."</p>
  <p class="epigraph-attr">— Captain William Scott, Northwest Orient Flight 305, November 24, 1971</p>
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
      <p><strong>November 24, 1971 — 2:50 p.m.</strong> — A man identifying himself as Dan Cooper boards Northwest Orient Flight 305 at Portland International Airport. He buys a one-way ticket to Seattle for $18.52, pays in cash, and takes seat 18-E in the rear of the cabin.</p>
      <p><strong>November 24, 1971 — ~3:00 p.m.</strong> — Cooper passes a note to flight attendant Florence Schaffner claiming he has a bomb. He opens his briefcase to show red cylinders, wires, and a battery. He demands $200,000 in used twenties, four parachutes, and a fuel truck.</p>
      <p><strong>November 24, 1971 — 5:24 p.m.</strong> — Flight 305 lands at Seattle-Tacoma International Airport. Ransom money (10,000 recorded-serial-number twenties) and four parachutes are delivered. All 36 passengers are released unharmed.</p>
      <p><strong>November 24, 1971 — 7:36 p.m.</strong> — The aircraft takes off from Seattle heading south toward Reno, with Cooper specifying flaps at 15°, landing gear down, altitude at 10,000 feet, airspeed no more than 200 knots, and cabin unpressurised.</p>
      <p><strong>November 24, 1971 — 8:13 p.m.</strong> — The flight crew feels a sudden upward lurch. The aft airstair warning light illuminates. Cooper has jumped from the rear of the aircraft into freezing rain and total darkness somewhere over southwest Washington.</p>
      <p><strong>November 24, 1971 — 11:02 p.m.</strong> — Flight 305 lands in Reno, Nevada. The cabin is empty. The rear airstair is open. Cooper's clip-on tie, two unused parachutes, and eight cigarette butts are the only traces left behind.</p>
      <p><strong>November 25, 1971</strong> — Thanksgiving Day. The FBI launches the NORJAK investigation. Hundreds of agents, soldiers, and volunteers search thousands of acres of forest in southwest Washington. The search lasts 18 days and finds nothing.</p>
      <p><strong>April 7, 1972</strong> — Richard Floyd McCoy Jr. hijacks a United Airlines 727 out of Denver using Cooper's exact method — rear airstair parachute jump with $500,000 in ransom. He is arrested two days later. The FBI considers and rejects him as Cooper.</p>
      <p><strong>1972–1980</strong> — The FBI investigates over 1,000 suspects. No fingerprint match, no DNA match, no credible identification. Not a single ransom bill surfaces anywhere in the world.</p>
      <p><strong>February 10, 1980</strong> — Eight-year-old Brian Ingram finds $5,800 in deteriorated twenty-dollar bills at Tena Bar on the Columbia River. Every serial number matches the ransom list. No other money has ever been found.</p>
      <p><strong>2011</strong> — Marla Cooper tells the FBI her uncle, Lynn Doyle Cooper, arrived bloody on Thanksgiving 1971 and said he had "hijacked an airplane." The FBI investigates but cannot confirm or eliminate him.</p>
      <p><strong>2016</strong> — Tom Colbert publicly names Robert Rackstraw as Cooper, citing forensic matches and coded letters. Rackstraw denies the allegation. The FBI is not persuaded.</p>
      <p><strong>July 8, 2016</strong> — The FBI formally suspends active investigation of the D.B. Cooper case after 45 years, citing "other investigative priorities." The case remains open but inactive — the only unsolved air piracy in American history.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Himmelsbach, Ralph P. & Worcester, Thomas K. — <em>NORJAK!: The Investigation of D.B. Cooper</em>, West Linn, Oregon, 1986</p>
      <p>Gray, Geoffrey — <em>Skyjack: The Hunt for D.B. Cooper</em>, Crown, 2011</p>
      <p>Forman, Bruce A. Smith — <em>DB Cooper and the FBI: A Case Study of America's Only Unsolved Skyjacking</em>, 2016</p>
      <p>FBI Vault — "D.B. Cooper," vault.fbi.gov/D-B-Cooper (66 volumes, 22,277 pages)</p>
      <p>Citizen Sleuths — citizensleuths.com (independent forensic analysis of physical evidence)</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-cooper-fbi-sketches.jpg'),
        title: 'D.B.\nCooper',
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
