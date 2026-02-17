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
  title: 'Into the Pacific',
  subtitle: 'The Disappearance of Amelia Earhart',
  author: 'HistorIQly',
  series: 'Vol. 4: Disappearances',
  slug: 'amelia-earhart',
  description: 'On July 2, 1937, Amelia Earhart and navigator Fred Noonan vanished over the Pacific during their attempt to fly around the world. The most famous woman in America — gone, without a trace. This is the true story of the pilot, the plane, and the silence that has haunted aviation for nearly ninety years.',
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
  hero: imgFileUrl('hero-earhart-electra.jpg'),
  portraitSmithsonian: imgFileUrl('portrait-earhart-electra-smithsonian.jpg'),
  portraitCockpit: imgFileUrl('portrait-earhart-cockpit-loc.jpg'),
  portraitFace: imgFileUrl('portrait-earhart-face-1928.jpg'),
  portraitTwoPoses: imgFileUrl('portrait-earhart-two-poses-1928.jpg'),
  portraitVega: imgFileUrl('portrait-earhart-vega-cockpit-1932.jpg'),
  noonanNatal: imgFileUrl('evidence-earhart-noonan-natal-1937.jpg'),
  noonanBandoeng: imgFileUrl('evidence-earhart-noonan-bandoeng-last.jpg'),
  putnam: imgFileUrl('figure-george-putnam-earhart-1931.jpg'),
  electra10a: imgFileUrl('evidence-lockheed-electra-10a.jpg'),
  electraCockpit: imgFileUrl('evidence-earhart-electra-cockpit-1937.jpg'),
  electraPurdue: imgFileUrl('evidence-earhart-electra-purdue-1936.jpg'),
  howlandAerial: imgFileUrl('location-howland-island-aerial.jpg'),
  howlandCamp: imgFileUrl('location-howland-island-camp-1937.jpg'),
  nikumaroro: imgFileUrl('location-nikumaroro-satellite-nasa.jpg'),
  itasca: imgFileUrl('evidence-uscgc-itasca.jpg'),
  lexington: imgFileUrl('evidence-uss-lexington-1932.jpg'),
  nacaLangley: imgFileUrl('atmosphere-earhart-naca-langley-1928.jpg'),
  firstPlane: imgFileUrl('atmosphere-earhart-first-plane-1920.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Canary': figureHtml(
    images.firstPlane,
    'Amelia Earhart with her first training plane, 1920',
    'A young Amelia Earhart in 1920, standing beside her first training plane. Within two years she would purchase her own aircraft — a bright yellow Kinner Airster she nicknamed "The Canary."'
  ),
  'Lady Lindy': figureHtml(
    images.portraitTwoPoses,
    'Two poses of Amelia Earhart before the 1928 transatlantic flight',
    'Two poses of Miss Amelia Earhart of Boston, who flew on the first lap of an air trip to England, June 1928. She called herself "just baggage, like a sack of potatoes" — and vowed to cross the Atlantic on her own terms.'
  ),
  'Harbour Grace': figureHtml(
    images.portraitVega,
    'Amelia Earhart in the cockpit of her Lockheed Vega',
    'Earhart in the cockpit of her red Lockheed Vega 5B — the aircraft in which she became the first woman to fly solo across the Atlantic, landing in a cow pasture near Londonderry after nearly fifteen hours of ice, fire, and darkness.'
  ),
  'One More Good Flight': figureHtml(
    images.electraPurdue,
    'Amelia Earhart with the new Lockheed Electra at Purdue University, 1936',
    'Earhart receives her Lockheed Model 10-E Electra at Purdue University on her thirty-ninth birthday, July 24, 1936. The aircraft was funded by the Purdue Research Foundation as a "flying laboratory." Its passenger cabin had been gutted and fitted with six extra fuel tanks.'
  ),
  'Eastward': figureHtml(
    images.noonanNatal,
    'Amelia Earhart and Fred Noonan at Natal, Brazil, June 1937',
    'Earhart and navigator Fred Noonan at Parnamerim airfield, Natal, Brazil, during the world flight. Noonan stands in the background, getting into the Electra. They had already crossed the South Atlantic — 1,900 miles of open ocean — with Noonan\'s celestial navigation proving flawless.'
  ),
  '2,556 Miles': figureHtml(
    images.itasca,
    'USCGC Itasca, the ship that received Earhart\'s last transmissions',
    'The USCGC Itasca, stationed near Howland Island to guide Earhart in by radio. Chief Radioman Leo Bellarts listened as her transmissions grew stronger and more desperate — "We must be on you but cannot see you. But gas is running low." Then silence.'
  ),
  'The Search': figureHtml(
    images.nikumaroro,
    'NASA satellite image of Nikumaroro atoll (formerly Gardner Island)',
    'Nikumaroro atoll, formerly Gardner Island, as seen from NASA\'s Landsat 8 satellite. TIGHAR theorises that Earhart and Noonan landed on this uninhabited coral reef and survived as castaways. In 1940, a partial skeleton, a woman\'s shoe, and a sextant box were found here — then lost.'
  ),
  'Into the Pacific': figureHtml(
    images.howlandAerial,
    'Aerial view of Howland Island',
    'Howland Island — a tiny speck of coral reef, 1.5 miles long, barely 6 feet above sea level, in the middle of the Pacific Ocean. This was the destination Amelia Earhart never reached. The Amelia Earhart Memorial Light, built on the island in 1938, now stands in ruins.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/amelia-earhart.ts');
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
  <p class="epigraph">"Please know I am quite aware of the hazards of the flight. Women must try to do things as men have tried. When they fail, their failure must be but a challenge to others."</p>
  <p class="epigraph-attr">— Amelia Earhart, in a letter to George Putnam, 1937</p>
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
      <p><strong>July 24, 1897</strong> — Born in Atchison, Kansas.</p>
      <p><strong>December 28, 1920</strong> — First airplane ride with Frank Hawks.</p>
      <p><strong>January 3, 1921</strong> — First flying lesson with Neta Snook.</p>
      <p><strong>July 24, 1922</strong> — Purchases "The Canary" (Kinner Airster).</p>
      <p><strong>June 17–18, 1928</strong> — Crosses Atlantic as passenger on <em>Friendship</em>.</p>
      <p><strong>November 2, 1929</strong> — Co-founds the Ninety-Nines.</p>
      <p><strong>February 7, 1931</strong> — Marries George Palmer Putnam.</p>
      <p><strong>May 20–21, 1932</strong> — First woman to fly solo across the Atlantic.</p>
      <p><strong>January 11–12, 1935</strong> — First person to solo Hawaii to California.</p>
      <p><strong>July 24, 1936</strong> — Receives Lockheed Electra from Purdue.</p>
      <p><strong>March 20, 1937</strong> — Luke Field crash, Honolulu.</p>
      <p><strong>June 1, 1937</strong> — Second attempt departs Miami.</p>
      <p><strong>June 29, 1937</strong> — Arrives Lae, New Guinea.</p>
      <p><strong>July 2, 1937 (00:00 GMT)</strong> — Departs Lae for Howland Island.</p>
      <p><strong>July 2, 1937 (08:43 GMT)</strong> — Last confirmed radio transmission.</p>
      <p><strong>July 2–18, 1937</strong> — Massive search operation.</p>
      <p><strong>January 5, 1939</strong> — Declared legally dead.</p>
      <p><strong>1940</strong> — Bones found on Gardner Island (Nikumaroro).</p>
      <p><strong>January 2024</strong> — Deep Sea Vision announces sonar anomaly near Howland.</p>
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
      <p>Lovell, Mary S. — <em>Amelia Earhart: The Sound of Wings</em>, St. Martin's Press, 1989</p>
      <p>Butler, Susan — <em>East to the Dawn: The Life of Amelia Earhart</em>, Da Capo Press, 1997</p>
      <p>Gillespie, Ric — <em>Finding Amelia: The True Story of the Earhart Disappearance</em>, Naval Institute Press, 2006</p>
      <p>Earhart, Amelia — <em>Last Flight</em>, compiled by George Palmer Putnam, Harcourt Brace, 1937</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-earhart-electra.jpg'),
        title: 'Into the\nPacific',
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
