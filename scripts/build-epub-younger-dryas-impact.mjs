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
  title: 'The Younger Dryas Impact',
  subtitle: 'Did a Comet Reset Civilization?',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'younger-dryas-impact',
  description:
    'Around 12,800 years ago, temperatures plunged, megafauna vanished, and an entire human culture disappeared from the archaeological record. Was it a comet? We examine the controversial evidence for the Younger Dryas Impact Hypothesis — from nanodiamonds in the black mat to the mysterious carvings of Göbekli Tepe.',
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
  fireball: imgFileUrl('hero-cosmic-fireball-alma.jpg'),
  fauna: imgFileUrl('hero-ice-age-fauna.jpg'),
  blackMat: imgFileUrl('evidence-black-mat-layer.jpg'),
  spherules: imgFileUrl('evidence-impact-spherules.png'),
  clovis: imgFileUrl('evidence-clovis-point.jpg'),
  scablands: imgFileUrl('location-channeled-scablands.jpg'),
  dryFalls: imgFileUrl('location-dry-falls-washington.jpg'),
  gobekliTepe: imgFileUrl('location-gobekli-tepe-excavation.jpg'),
  vultureStone: imgFileUrl('evidence-vulture-stone-pillar43.jpg'),
  mammoth: imgFileUrl('evidence-mammoth-la-brea.jpg'),
  smilodon: imgFileUrl('evidence-smilodon-fatalis.jpg'),
  carolinaBays: imgFileUrl('evidence-carolina-bays-lidar.jpg'),
  meltglass: imgFileUrl('evidence-abu-hureyra-meltglass.png'),
  tunguska: imgFileUrl('atmosphere-tunguska-devastation.jpg'),
  sl9: imgFileUrl('evidence-sl9-fragment-train.png'),
  iceCore: imgFileUrl('evidence-eastgrip-ice-core.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Freeze': figureHtml(
    images.fauna,
    'Ice age fauna of northern Spain — mammoths, rhinoceroses, cave lions',
    'Late Pleistocene megafauna of northern Spain: woolly mammoths, equids, a woolly rhinoceros, and European cave lions with a reindeer carcass. Thirty-five genera of large animals like these vanished from North America during the Younger Dryas. Painting by Mauricio Antón.'
  ),
  'The Black Mat': figureHtml(
    images.blackMat,
    'The black mat layer at Murray Springs Clovis site, Arizona',
    'The "black mat" — a thin, dark, organic-rich stratum at the Murray Springs Clovis site in Arizona. Below it: Clovis artifacts and mammoth bones. Above it: silence. This boundary layer, found at Clovis sites across North America, contains the microscopic evidence at the heart of the impact debate.'
  ),
  'The Firestone Hypothesis': figureHtml(
    images.sl9,
    'Comet Shoemaker-Levy 9 fragment train photographed by the Hubble Space Telescope',
    'The "string of pearls" — Comet Shoemaker-Levy 9, broken into twenty-one fragments by Jupiter\'s gravity, photographed by the Hubble Space Telescope in May 1994. Two months later, the fragments struck Jupiter with a combined energy exceeding six hundred times the world\'s nuclear arsenal. The Younger Dryas Impact Hypothesis proposes a similar fragmented comet struck Earth 12,800 years ago.'
  ),
  'The Kill Zone': figureHtml(
    images.mammoth,
    'Columbian mammoth skeleton at the La Brea Tar Pits, Los Angeles',
    'Columbian mammoth skeleton at the Page Museum, La Brea Tar Pits, Los Angeles. Larger than their woolly cousins, Columbian mammoths stood thirteen feet at the shoulder and roamed North America for millions of years before vanishing at the onset of the Younger Dryas.'
  ),
  'The Scablands': figureHtml(
    images.dryFalls,
    'Dry Falls, Washington — once the largest waterfall in the world',
    'Dry Falls in Washington State — three and a half miles wide and four hundred feet tall, ten times the width of Niagara. During the Pleistocene, catastrophic floods carved these channels in days, not millennia. J Harlen Bretz spent forty years fighting for the reality of this catastrophe before the geological establishment accepted he was right.'
  ),
  'The Temple Before History': figureHtml(
    images.vultureStone,
    'The Vulture Stone (Pillar 43) at Göbekli Tepe',
    'The Vulture Stone — Pillar 43 at Göbekli Tepe, built during the Younger Dryas around 9600 BCE. Some researchers argue its carvings depict constellations and record the cosmic impact event. Others see symbolic art unrelated to astronomy. The debate, like the excavation, is far from over.'
  ),
  'The Skeptics': figureHtml(
    images.spherules,
    'SEM images of high-temperature impact spherules from the Younger Dryas boundary',
    'Scanning electron microscope images of iron-rich impact spherules from the Younger Dryas boundary at Pilauco, Chile. The dendritic surface textures indicate rapid quenching from melt temperatures above 1,450°C — conditions consistent with cosmic impact but not with ordinary geological processes.'
  ),
  'Fire and Ice': figureHtml(
    images.meltglass,
    'Meltglass spheroid from Abu Hureyra, Syria',
    'Meltglass from Abu Hureyra, Syria — a 2.5-mm-wide spheroid of fused silica heated to temperatures exceeding 2,200°C at the precise stratigraphic level of the Younger Dryas boundary. Published in Nature Scientific Reports (2020), this evidence expanded the case for a cosmic impact to the Middle East.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/younger-dryas-impact.ts');
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
  <p class="epigraph">"There have been, and will be again, many destructions of mankind arising out of many causes; the greatest have been brought about by fire and water."</p>
  <p class="epigraph-attr">— Plato, <em>Timaeus</em>, c. 360 BCE</p>
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
      <p><strong>c. 14,500 BCE</strong> — The last glacial maximum ends. Ice sheets begin retreating. Global temperatures rise. Megafauna thrive across North America, South America, Europe, and Australia.</p>
      <p><strong>c. 13,500 BCE</strong> — The Clovis culture emerges in North America. Their distinctive fluted stone points appear at sites from coast to coast. They hunt mammoths, mastodons, and other large game.</p>
      <p><strong>c. 12,800 BCE</strong> — The Younger Dryas begins. Temperatures in the Northern Hemisphere plunge by up to 14°F in a single decade. A thin dark layer — the "black mat" — is deposited at sites across North America, containing nanodiamonds, microspherules, and elevated platinum concentrations.</p>
      <p><strong>c. 12,800–11,700 BCE</strong> — The Younger Dryas cold period. Thirty-five genera of North American megafauna go extinct. The Clovis culture vanishes from the archaeological record. Glaciers advance. The world enters a millennium of renewed cold.</p>
      <p><strong>c. 9600 BCE</strong> — Construction begins at Göbekli Tepe in southeastern Turkey — the world's oldest known monumental architecture, built by hunter-gatherers during the final centuries of the Younger Dryas.</p>
      <p><strong>c. 11,700 BCE</strong> — The Younger Dryas ends as abruptly as it began. Temperatures surge. The Holocene epoch begins — the warm, stable period in which all subsequent human civilizations develop.</p>
      <p><strong>1923</strong> — Geologist J Harlen Bretz publishes his first paper on the Channeled Scablands, proposing a catastrophic megaflood. The geological establishment rejects his hypothesis for decades.</p>
      <p><strong>1966</strong> — Archaeologist C. Vance Haynes Jr. identifies the "black mat" at Murray Springs, Arizona, documenting the consistent stratigraphic boundary between Clovis occupation and post-Clovis silence.</p>
      <p><strong>1994</strong> — Klaus Schmidt begins excavation at Göbekli Tepe. Comet Shoemaker-Levy 9 strikes Jupiter in a dramatic demonstration of fragmented-comet impacts.</p>
      <p><strong>2007</strong> — Richard Firestone, Allen West, James Kennett, and 23 co-authors publish "Evidence for an extraterrestrial impact and major wildfires at the Younger Dryas boundary" in PNAS, launching the Younger Dryas Impact Hypothesis.</p>
      <p><strong>2010</strong> — Todd Surovell publishes replication failure. Nicholas Pinter challenges nanodiamond identifications. The hypothesis faces intense criticism.</p>
      <p><strong>2014</strong> — Kennett and colleagues confirm nanodiamonds at 32 sites across four continents using improved analytical techniques.</p>
      <p><strong>2017</strong> — Sweatman and Tsikritsis propose that Pillar 43 at Göbekli Tepe records the impact event through astronomical symbolism.</p>
      <p><strong>2018</strong> — Hiawatha Crater discovered beneath the Greenland ice sheet. Initially linked to the YDIH, later dated to 58 million years ago.</p>
      <p><strong>2019</strong> — Impact proxies identified at Pilauco, Chile — the first Southern Hemisphere evidence. Platinum anomalies confirmed globally.</p>
      <p><strong>2020</strong> — Andrew Moore publishes meltglass evidence from Abu Hureyra, Syria, showing temperatures exceeding 2,200°C at the Younger Dryas boundary.</p>
      <p><strong>2024</strong> — Impact proxies now documented at 50+ sites on four continents. The hypothesis remains debated but has survived every attempt at definitive refutation.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a narrative exploration of one of the most controversial hypotheses in modern earth science. The scientific evidence, key figures, and chronology are grounded in published research and primary sources; narrative framing and some scene detail are reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Firestone, R. B. et al. — "Evidence for an extraterrestrial impact and major wildfires at the Younger Dryas boundary (ca. 12.9 ka)," <em>Proceedings of the National Academy of Sciences</em>, 2007</p>
      <p>Kennett, J. P. et al. — "Nanodiamonds in the Younger Dryas Boundary Sediment Layer," <em>Science</em>, 2009</p>
      <p>Moore, A. M. T. et al. — "Evidence of Cosmic Impact at Abu Hureyra, Syria at the Younger Dryas Onset (~12.8 ka)," <em>Nature Scientific Reports</em>, 2020</p>
      <p>Pino, M. et al. — "Sedimentary record from Patagonia, southern Chile supports cosmic-impact triggering of biomass burning, climate change, and megafaunal extinctions," <em>Nature Scientific Reports</em>, 2019</p>
      <p>Hancock, Graham — <em>Magicians of the Gods</em>, Coronet, 2015</p>
      <p>Schmidt, Klaus — <em>Göbekli Tepe: A Stone Age Sanctuary in South-Eastern Anatolia</em>, ex oriente, 2012</p>
      <p>Bretz, J Harlen — "The Channeled Scablands of the Columbia Plateau," <em>Journal of Geology</em>, 1923</p>
      <p class="separator">***</p>
      <p>This book is part of <strong>${book.series}</strong> in the HistorIQly Books series — real history, told like a thriller.</p>
      <p>Visit <a href="https://historiqly.com/books">books.historiqly.com</a> for more stories.</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-cosmic-fireball-alma.jpg'),
        title: 'The Younger\nDryas Impact',
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
