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
  title: 'Malaysia Airlines Flight 370',
  subtitle: 'The Plane That Vanished from the Digital Age',
  author: 'HistorIQly',
  series: 'Vol. 4: Disappearances',
  slug: 'mh370',
  description:
    'On March 8, 2014, a Boeing 777 carrying 239 people vanished between Kuala Lumpur and Beijing. The most expensive search in aviation history found almost nothing. Satellite handshakes, military radar ghosts, and a flaperon washed ashore on a distant island are the only traces. This is the true story of MH370.',
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
  aircraft: imgFileUrl('hero-mh370-aircraft.jpg'),
  klia: imgFileUrl('mh370-klia-terminal.jpg'),
  satellite: imgFileUrl('mh370-satellite-arc.jpg'),
  navy: imgFileUrl('mh370-navy-search.jpg'),
  searchVessel: imgFileUrl('mh370-search-vessel.jpg'),
  p8: imgFileUrl('mh370-p8-poseidon.jpg'),
  oceanShield: imgFileUrl('mh370-ocean-shield.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Red-Eye to Beijing': figureHtml(
    images.aircraft,
    'Boeing 777-200ER 9M-MRO, the aircraft that became Malaysia Airlines Flight 370',
    'Boeing 777-200ER, registration 9M-MRO, photographed at Paris Charles de Gaulle Airport in 2013 — five months before its disappearance on March 8, 2014. The 404th Boeing 777 ever built, it had accumulated 53,471 flight hours without a serious incident.'
  ),
  'Good Night, Malaysian Three Seven Zero': figureHtml(
    images.klia,
    'Kuala Lumpur International Airport terminal',
    'Kuala Lumpur International Airport, from which Flight MH370 departed at 12:41 a.m. on March 8, 2014. The aircraft was handed off to Ho Chi Minh City air traffic control at 1:19 a.m. — the last voice contact.'
  ),
  'The Handshakes': figureHtml(
    images.satellite,
    'The Inmarsat satellite handshake arcs showing possible positions of MH370',
    'The Seventh Arc: the ring of possible positions calculated from the final Inmarsat satellite handshake at 8:19 a.m. on March 8, 2014. Somewhere along this arc, in water up to six kilometres deep, MH370 met its end.'
  ),
  'The Wrong Ocean': figureHtml(
    images.navy,
    'U.S. Navy assists in the search for Malaysia Airlines Flight MH370',
    'The multinational search operation in the Indian Ocean. Ships and aircraft from more than a dozen nations participated in the largest search effort in aviation history.'
  ),
  'Searching the Abyss': figureHtml(
    images.searchVessel,
    'Fugro Discovery encounters rough conditions in the Southern Indian Ocean during the MH370 search',
    'The survey vessel Fugro Discovery in the Southern Indian Ocean. The search crews endured mountainous swells, howling winds, and near-freezing temperatures while scanning the ocean floor with deep-tow sonar.'
  ),
  'The Flaperon': figureHtml(
    images.p8,
    'U.S. Navy P-8A Poseidon aircraft during MH370 search operations',
    'A U.S. Navy P-8A Poseidon maritime patrol aircraft during the search for MH370. Aircraft from the United States, Australia, Japan, South Korea, China, and New Zealand flew daily missions over the southern Indian Ocean.'
  ),
  'The Legacy': figureHtml(
    images.oceanShield,
    'Search operations for Malaysia Airlines Flight MH370',
    'Ocean search operations continued for years. Over 230,000 square kilometres of ocean floor were scanned — an area larger than the United Kingdom — in the most expensive search in aviation history.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/mh370.ts');
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
  <p class="epigraph">"Good night, Malaysian Three Seven Zero."</p>
  <p class="epigraph-attr">— Last voice transmission from the cockpit of Malaysia Airlines Flight 370, 1:19 a.m. MYT, March 8, 2014</p>
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
      <p><strong>May 14, 2002</strong> — Boeing 777-2H6ER, registration 9M-MRO, makes its first flight. Delivered to Malaysia Airlines on May 31.</p>
      <p><strong>March 7, 2014, afternoon</strong> — A Kuala Lumpur court sentences opposition leader Anwar Ibrahim to five years in prison.</p>
      <p><strong>March 8, 2014, 12:41 a.m.</strong> — Flight MH370 departs Kuala Lumpur International Airport for Beijing with 239 people aboard.</p>
      <p><strong>1:07 a.m.</strong> — Last ACARS data transmission from the aircraft.</p>
      <p><strong>1:19 a.m.</strong> — Last voice transmission: "Good night, Malaysian Three Seven Zero."</p>
      <p><strong>1:21 a.m.</strong> — Transponder is switched off. The aircraft vanishes from civilian radar near the IGARI waypoint.</p>
      <p><strong>1:22 a.m.</strong> — Malaysian military primary radar detects the aircraft turning back across the Malay Peninsula.</p>
      <p><strong>1:52 a.m.</strong> — Military radar tracks the aircraft passing south of Penang Island.</p>
      <p><strong>2:22 a.m.</strong> — Last military radar contact over the Andaman Sea.</p>
      <p><strong>2:25 a.m.</strong> — The satellite data unit reboots and logs onto the Inmarsat-3F1 satellite.</p>
      <p><strong>8:19 a.m.</strong> — Final satellite handshake — two incomplete log-on requests indicating fuel exhaustion and rapid descent. Last electronic trace of MH370.</p>
      <p><strong>March 8–15, 2014</strong> — Initial search focuses on the South China Sea (the wrong ocean).</p>
      <p><strong>March 15, 2014</strong> — PM Najib Razak reveals the aircraft deviated from its route and flew for hours.</p>
      <p><strong>March 24, 2014</strong> — Najib announces that MH370 "ended in the southern Indian Ocean" based on Inmarsat analysis.</p>
      <p><strong>October 2014 – January 2017</strong> — ATSB-led underwater search scans 120,000 km² of seabed. Cost: US$155 million. Nothing found.</p>
      <p><strong>July 29, 2015</strong> — A flaperon from MH370 is found on Réunion Island — the first physical evidence of the crash.</p>
      <p><strong>January–May 2018</strong> — Ocean Infinity searches an additional 112,000 km² on a "no find, no fee" basis. Nothing found.</p>
      <p><strong>July 30, 2018</strong> — Malaysian safety investigation releases its 495-page final report. Cause of disappearance: undetermined.</p>
      <p><strong>2015–2018</strong> — 43 pieces of debris wash ashore across the western Indian Ocean (Madagascar, Mozambique, Tanzania, Réunion, Mauritius, South Africa).</p>
      <p><strong>December 2025</strong> — Beijing court awards 2.9 million yuan each to eight Chinese families — the first MH370 compensation judgement.</p>
      <p><strong>December 2025 – March 2026</strong> — Ocean Infinity conducts a new search in a refined 15,000 km² zone. As of early 2026, no wreckage found.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources, official investigation reports, and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Malaysian Ministry of Transport — <em>Safety Investigation Report MH370/01/2018</em>, July 30, 2018</p>
      <p>Australian Transport Safety Bureau — <em>The Operational Search for MH370</em>, October 3, 2017</p>
      <p>Langewiesche, William — "What Really Happened to Malaysia's Missing Airplane," <em>The Atlantic</em>, June 2019</p>
      <p>Wise, Jeff — <em>The Plane That Wasn't There</em>, 2015</p>
      <p>Higgins, Andrew and Thomas — <em>Goodnight Malaysian 370</em>, 2014</p>
      <p>Inmarsat — <em>MH370 Data Communication Logs</em>, released May 27, 2014</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-mh370-aircraft.jpg'),
        title: 'Malaysia Airlines\nFlight 370',
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
