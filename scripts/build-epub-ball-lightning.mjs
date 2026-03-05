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
  title: 'Ball Lightning',
  subtitle: 'The Fire That Walks Through Walls',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained',
  slug: 'ball-lightning',
  description:
    'For centuries, glowing orbs have appeared in thunderstorms — floating through walls, killing scientists, and vanishing without a trace. Thousands have seen them. No one can explain them. This is the true story of science\'s most elusive phenomenon.',
};

// --- IMAGE PATHS (file:// URLs for epub-gen-memory) ---
function imgFileUrl(filename) {
  const filepath = resolve(IMG_DIR, filename);
  try {
    readFileSync(filepath);
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
  hero: imgFileUrl('hero-ball-lightning-1886.jpg'),
  widecombe: imgFileUrl('widecombe-thunderstorm-1638-woodcut.gif'),
  church: imgFileUrl('widecombe-church-st-pancras.jpg'),
  richmann: imgFileUrl('richmann-death-1753.jpg'),
  richmannEngraving: imgFileUrl('richmann-death-engraving.png'),
  arago: imgFileUrl('suspect-francois-arago.jpg'),
  tesla: imgFileUrl('tesla-colorado-springs-sparks.jpg'),
  teslaLab: imgFileUrl('tesla-colorado-springs-lab.jpg'),
  kapitsa: imgFileUrl('suspect-pyotr-kapitsa.jpg'),
  maastricht: imgFileUrl('ball-lightning-maastricht-2011.jpg'),
  engraving: imgFileUrl('ball-lightning-engraving-19th.png'),
  goldenTemple: imgFileUrl('golden-temple-amritsar-historical.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Devil in the Church': figureHtml(
    images.widecombe,
    'Woodcut depicting the Great Thunderstorm at Widecombe, 1638',
    'A contemporary woodcut of the Great Thunderstorm at Widecombe-in-the-Moor, 1638. The Devil is shown perched on the church tower — the only explanation the seventeenth century could offer for a ball of fire that killed four people and injured sixty.'
  ),
  'The Martyr of St Petersburg': figureHtml(
    images.richmann,
    'Engraving of the death of Georg Wilhelm Richmann, 1753',
    'The death of Georg Wilhelm Richmann on 6 August 1753 — the first scientist killed during an electrical experiment. A ball of lightning struck him in the forehead while he was measuring atmospheric electricity during a thunderstorm.'
  ),
  'The Cataloguers': figureHtml(
    images.arago,
    'Portrait of François Arago',
    'François Arago (1786–1853), French astronomer and physicist, who compiled the first systematic scientific catalogue of ball lightning reports. His 1855 book Meteorological Essays described thirty instances and established ball lightning as a legitimate subject of scientific inquiry.'
  ),
  'The Wizard of Colorado Springs': figureHtml(
    images.tesla,
    'Nikola Tesla in his Colorado Springs laboratory, 1899',
    'Nikola Tesla amid the artificial lightning of his Colorado Springs laboratory, 1899. During his experiments with the magnifying transmitter, Tesla accidentally produced small fireballs that persisted even after the apparatus was turned off — the first credible laboratory production of ball lightning.'
  ),
  'The Witnesses': figureHtml(
    images.goldenTemple,
    'Historical photograph of the Golden Temple at Amritsar',
    'The Golden Temple at Amritsar, India, where in 1877 a ball of lightning entered through the main entrance, crossed the interior, and exited through a side door. The incident is commemorated in an inscription on the temple wall.'
  ),
  'The Nobel Laureate': figureHtml(
    images.kapitsa,
    'Pyotr Kapitsa, Soviet physicist, 1964',
    'Pyotr Leonidovich Kapitsa (1894–1984), Nobel laureate in physics, who in 1955 proposed the most famous theory of ball lightning: that it is caused by standing waves of electromagnetic radiation between the earth and the storm cloud.'
  ),
  'The Spectrum': figureHtml(
    images.maastricht,
    'Possible ball lightning photographed in Maastricht, 2011',
    'A possible ball lightning event photographed in Maastricht, Netherlands, in 2011. The 2012 observation on the Qinghai Plateau in China was the first to capture ball lightning with scientific spectrometers, revealing silicon, iron, and calcium — elements found in soil, not air.'
  ),
  'The Enduring Mystery': figureHtml(
    images.hero,
    'Globe of Fire Descending into a Room, 1886 engraving',
    'An 1886 engraving from The Aerial World by Dr G. Hartwig depicting ball lightning entering a room — an image that captures the phenomenon as it has appeared to witnesses for centuries: luminous, inexplicable, and utterly indifferent to the walls meant to keep it out.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/ball-lightning.ts');
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
  <p class="epigraph">"There are literally dozens of ball lightning theories because it's an unconstrained situation. Since there are virtually no data, anybody can come up with a theory, and you can't prove them wrong."</p>
  <p class="epigraph-attr">— Karl Stephan, physicist</p>
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
      <p><strong>1195</strong> — Gervase of Canterbury records the earliest known description of ball lightning in England — a "fiery globe" that descended near London.</p>
      <p><strong>1638 (October 21)</strong> — The Great Thunderstorm at Widecombe-in-the-Moor, Devon. A ball of fire enters the Church of St Pancras during a Sunday service, killing four and injuring sixty among the 300 worshippers.</p>
      <p><strong>1726</strong> — Sailors aboard the sloop <em>Catherine and Mary</em> in the Gulf of Florida witness a "large ball of fire" drop from a storm cloud, destroying the mast and killing one crewman.</p>
      <p><strong>1753 (August 6)</strong> — Georg Wilhelm Richmann is killed in St Petersburg by ball lightning while measuring atmospheric electricity — the first scientist to die during an electrical experiment.</p>
      <p><strong>1809</strong> — Three fireballs strike HMS <em>Warren Hastings</em>, killing two crewmen and setting the mast ablaze. Reported in the <em>Times</em> of London.</p>
      <p><strong>1843</strong> — William Snow Harris publishes the first English-language scientific survey of ball lightning reports.</p>
      <p><strong>1852 (July 5)</strong> — A Parisian tailor watches a ball of fire the size of a human head emerge from his fireplace, drift across his shop, and explode in the chimney. Sworn statements filed with the French Academy of Sciences.</p>
      <p><strong>1855</strong> — François Arago publishes <em>Meteorological Essays</em>, describing thirty instances of ball lightning — the first systematic scientific catalogue.</p>
      <p><strong>1877 (April 30)</strong> — Ball lightning enters the Golden Temple at Amritsar, India, and exits through a side door. The incident is commemorated in an inscription on the temple wall.</p>
      <p><strong>1899</strong> — Nikola Tesla produces small fireballs in his Colorado Springs laboratory while experimenting with his magnifying transmitter.</p>
      <p><strong>1955</strong> — Nobel laureate Pyotr Kapitsa publishes his electromagnetic standing wave theory of ball lightning.</p>
      <p><strong>1960</strong> — A survey at Oak Ridge National Laboratory finds that 5.6% of scientific staff have personally witnessed ball lightning.</p>
      <p><strong>1963</strong> — Professor Roger Jennison observes a 20-centimetre blue-white sphere floating down the aisle of a commercial aircraft during a thunderstorm. The account is published in <em>Nature</em>.</p>
      <p><strong>2000</strong> — John Abrahamson and James Dinniss publish the silicon vaporization theory in <em>Nature</em>: lightning striking silicon-rich soil produces burning nanoparticles that form luminous balls.</p>
      <p><strong>2006</strong> — Eli Jerby and Vladimir Dikhtyar at Tel Aviv University create levitating fireballs by irradiating solid materials with high-power microwaves.</p>
      <p><strong>2012 (July 20)</strong> — Jianyong Cen and colleagues at Northwest Normal University capture the first-ever video and emission spectrum of natural ball lightning on the Qinghai Plateau, China. The spectrum shows silicon, iron, and calcium — elements from vaporized soil.</p>
      <p><strong>2014 (January)</strong> — The Qinghai results are published in <em>Physical Review Letters</em>, providing the strongest evidence yet for the silicon vaporization theory.</p>
      <p><strong>2020</strong> — A 3.5-metre ball lightning event is documented over Vienna, Austria, following a 170.4 kA lightning stroke — one of the most precisely characterized events ever recorded.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and scientific scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Stenhoff, Mark — <em>Ball Lightning: An Unsolved Problem in Atmospheric Physics</em>, Kluwer Academic/Plenum, 1999</p>
      <p>Cen, Jianyong; Yuan, Ping; Xue, Simin — "Observation of the Optical and Spectral Characteristics of Ball Lightning," <em>Physical Review Letters</em>, 2014</p>
      <p>Abrahamson, John; Dinniss, James — "Ball lightning caused by oxidation of nanoparticle networks from normal lightning strikes on soil," <em>Nature</em>, 2000</p>
      <p>Kapitsa, P.L. — "On the Nature of Ball Lightning," <em>Doklady Akademii Nauk SSSR</em>, 1955</p>
      <p>Keul, Alexander G.; Diendorfer, Gerhard — "A brief history of ball lightning observations by scientists and trained professionals," <em>History of Geo- and Space Sciences</em>, 2021</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-ball-lightning-1886.jpg'),
        title: 'Ball\nLightning',
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
