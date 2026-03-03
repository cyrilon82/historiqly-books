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
  title: 'The Bermuda Triangle',
  subtitle: 'Ships, Planes, and the Sea That Swallows Them',
  author: 'HistorIQly',
  series: 'Vol. 4: Disappearances',
  slug: 'bermuda-triangle',
  description:
    'Ships vanish without distress calls. Planes disappear from radar mid-sentence. For over a century, the stretch of Atlantic between Miami, Bermuda, and Puerto Rico has swallowed vessels and their crews without explanation — or has it? The true story of the world\'s most famous maritime mystery.',
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
  cyclops: imgFileUrl('hero-bermuda-triangle-cyclops.jpg'),
  avenger: imgFileUrl('bermuda-triangle-tbm-avenger.jpg'),
  tudor: imgFileUrl('bermuda-triangle-avro-tudor.jpg'),
  berlitz: imgFileUrl('bermuda-triangle-charles-berlitz.png'),
  gyre: imgFileUrl('bermuda-triangle-atlantic-gyre.png'),
  article: imgFileUrl('bermuda-triangle-1950-article.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  "The Devil's Sea": figureHtml(
    images.gyre,
    'Map of the North Atlantic Gyre and Gulf Stream currents',
    'The North Atlantic Gyre, showing the Gulf Stream flowing through the Bermuda Triangle region. This powerful current can disperse wreckage over hundreds of miles within days.'
  ),
  'The Cyclops': figureHtml(
    images.cyclops,
    'USS Cyclops (AC-4) — the Navy collier that vanished in March 1918',
    'USS Cyclops (AC-4), photographed between 1910 and 1918. The 542-foot collier disappeared with 306 crew and passengers in March 1918 — the largest non-combat loss of life in U.S. Navy history.'
  ),
  'The Lost Patrol': figureHtml(
    images.avenger,
    'A TBM Avenger torpedo bomber — the type flown by Flight 19',
    'A Grumman TBM Avenger torpedo bomber, the aircraft type flown by the five planes of Flight 19. Each carried a crew of three and enough fuel for approximately five and a half hours of flight.'
  ),
  'The Tudor Vanishings': figureHtml(
    images.tudor,
    'An Avro Tudor aircraft during the Berlin Airlift, 1948–1949',
    'An Avro Tudor — the aircraft type operated by British South American Airways. Star Tiger and Star Ariel, both Tudor Mark IVs, vanished in the Bermuda Triangle region within twelve months of each other.'
  ),
  'Naming the Monster': figureHtml(
    images.berlitz,
    'Charles Berlitz, author of The Bermuda Triangle',
    'Charles Berlitz (1914–2003), whose 1974 bestseller The Bermuda Triangle sold nearly twenty million copies worldwide and cemented the legend in popular culture.'
  ),
  'The Debunker': figureHtml(
    images.article,
    'A 1950 newspaper article about mysterious disappearances in the Atlantic',
    'One of the earliest newspaper articles drawing attention to disappearances in the western Atlantic. This 1950 Associated Press piece helped spark the investigation that would eventually become the Bermuda Triangle legend.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/bermuda-triangle.ts');
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
  <p class="epigraph">"The Legend of the Bermuda Triangle is a manufactured mystery… perpetuated by writers who either purposely or unknowingly made use of misconceptions, faulty reasoning, and sensationalism."</p>
  <p class="epigraph-attr">— Larry Kusche, <em>The Bermuda Triangle Mystery — Solved</em> (1975)</p>
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
      <p><strong>1492</strong> — Christopher Columbus records compass anomalies and strange lights while sailing through what is now the Sargasso Sea during his first voyage to the New World.</p>
      <p><strong>March 4, 1918</strong> — USS Cyclops (AC-4) departs Barbados with 306 crew and passengers and approximately 10,800 tons of manganese ore. She is never seen again — the largest non-combat loss of life in U.S. Navy history.</p>
      <p><strong>December 5, 1945</strong> — Flight 19, five TBM Avenger torpedo bombers carrying 14 men, disappears during a training exercise from Fort Lauderdale. A PBM Mariner rescue plane with 13 crew also vanishes. Total lost: 27 men.</p>
      <p><strong>January 30, 1948</strong> — Star Tiger, a BSAA Avro Tudor IV with 31 aboard (including Air Marshal Sir Arthur Coningham), vanishes on approach to Bermuda.</p>
      <p><strong>January 17, 1949</strong> — Star Ariel, sister aircraft to Star Tiger, disappears between Bermuda and Jamaica with 20 aboard. BSAA is subsequently dissolved.</p>
      <p><strong>September 17, 1950</strong> — Journalist Edward Van Winkle Jones publishes the first article identifying a pattern of disappearances in the western Atlantic.</p>
      <p><strong>February 4, 1963</strong> — SS Marine Sulphur Queen, carrying 39 crew and 15,260 tons of molten sulfur, vanishes in the Straits of Florida.</p>
      <p><strong>February 1964</strong> — Vincent Gaddis coins the term "Bermuda Triangle" in an article for Argosy magazine.</p>
      <p><strong>December 22, 1967</strong> — The cabin cruiser Witchcraft vanishes one mile off Miami Beach, 19 minutes before the Coast Guard arrives at its reported position.</p>
      <p><strong>1974</strong> — Charles Berlitz publishes <em>The Bermuda Triangle</em>, which sells nearly 20 million copies worldwide.</p>
      <p><strong>1975</strong> — Larry Kusche publishes <em>The Bermuda Triangle Mystery — Solved</em>, systematically debunking the legend through primary-source research.</p>
      <p><strong>1977</strong> — Steven Spielberg's <em>Close Encounters of the Third Kind</em> features Flight 19's aircraft returned by aliens, cementing the legend in popular culture.</p>
      <p><strong>October 1, 2015</strong> — SS El Faro sinks in Hurricane Joaquin near the Bahamas with all 33 crew. Voyage data recorder recovered in 2016 from 15,000 feet.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Kusche, Larry — <em>The Bermuda Triangle Mystery — Solved</em>, Prometheus Books, 1975</p>
      <p>Berlitz, Charles — <em>The Bermuda Triangle</em>, Doubleday, 1974</p>
      <p>Gaddis, Vincent — <em>Invisible Horizons: True Mysteries of the Sea</em>, Chilton Books, 1965</p>
      <p>U.S. Navy Board of Inquiry — Flight 19 Investigation Report, 1945</p>
      <p>U.S. Coast Guard — Marine Board of Investigation: SS Marine Sulphur Queen, 1964</p>
      <p>British Ministry of Civil Aviation — Report on Star Tiger (G-AHNP) and Star Ariel (G-AGRE)</p>
      <p>NTSB — Marine Accident Report: Sinking of US Cargo Vessel SS El Faro, 2017</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-bermuda-triangle-cyclops.jpg'),
        title: 'The Bermuda\nTriangle',
        subtitle: book.subtitle,
        series: book.series,
        author: book.author,
        outputPath: coverPath,
      });
    } else {
      console.log(`  Using existing cover: ${coverPath}`);
    }

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

    // Write to public directory
    const outDir = resolve(ROOT, 'public/books');
    mkdirSync(outDir, { recursive: true });

    const outPath = resolve(outDir, `${book.slug}.epub`);
    writeFileSync(outPath, epubBuffer);

    const imgCount = Object.values(chapterImages).filter(Boolean).length;
    console.log(`\nRaw EPUB written to: ${outPath}`);
    console.log(`Size: ${(epubBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Chapters: ${chapters.length}`);
    console.log(`Images: ${imgCount} chapters with illustrations`);

    // Post-process
    console.log('\nPost-processing...');
    await polishEpub(outPath, outPath);

    console.log('\nDone!');
  } catch (err) {
    console.error('Failed to generate EPUB:', err);
    process.exit(1);
  }
}

build();
