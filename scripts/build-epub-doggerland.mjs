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
  title: 'Doggerland',
  subtitle: "Europe's Real Sunken Land",
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'doggerland',
  description:
    'Beneath the grey waves of the North Sea lies the remains of a lost world — a vast landmass that once connected Britain to Europe, home to Mesolithic hunters, woolly mammoths, and thriving communities. Drowned by rising seas and shattered by a catastrophic tsunami, Doggerland vanished beneath the waves eight thousand years ago.',
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
  hero: imgFileUrl('hero-doggerbank-chart.jpg'),
  mapProgression: imgFileUrl('doggerland-map-progression.png'),
  map10000bp: imgFileUrl('doggerland-10000bp-map.jpg'),
  palaeolandscape: imgFileUrl('doggerland-palaeolandscape-map.png'),
  clementReid: imgFileUrl('clement-reid-doggerbank-map.jpg'),
  historicalMap: imgFileUrl('doggerbank-historical-map.jpg'),
  storegga: imgFileUrl('storegga-tsunami-deposits.jpg'),
  mammoth: imgFileUrl('woolly-mammoth-skeleton.jpg'),
  krijn: imgFileUrl('krijn-neanderthal-skull-fragment.jpg'),
  submergedForests: imgFileUrl('submerged-forests-1913-illustration.png'),
  antlerHeaddress: imgFileUrl('star-carr-antler-headdress.jpg'),
  spearTips: imgFileUrl('star-carr-spear-tips.jpg'),
  hunterCamp: imgFileUrl('mesolithic-hunter-camp-reconstruction.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  "The Trawler's Net": figureHtml(
    images.historicalMap,
    'Historical map of the Dogger Bank, 1867',
    'An 1867 map of the Dogger Bank — the great shallow ridge in the middle of the North Sea that was once the highest point of Doggerland.'
  ),
  'The Land Between': figureHtml(
    images.map10000bp,
    'Map of Doggerland at 10,000 BP',
    'Doggerland at roughly 10,000 years before present, when it still connected Britain to mainland Europe. The Dogger Bank rises at the centre of this vast landscape.'
  ),
  'Giants of the Ice': figureHtml(
    images.mammoth,
    'Woolly mammoth skeleton at the Field Museum',
    'A woolly mammoth skeleton — the most iconic inhabitant of Ice Age Doggerland. Mammoth bones are among the most common finds hauled up by North Sea fishing trawlers.'
  ),
  'The People of Doggerland': figureHtml(
    images.antlerHeaddress,
    'Mesolithic antler headdress from Star Carr, British Museum',
    'A Mesolithic red deer antler headdress from Star Carr, Yorkshire — the oldest known ritual costume in Europe. Similar objects were almost certainly used by the people of Doggerland.'
  ),
  'The Waters Rise': figureHtml(
    images.mapProgression,
    'Three-panel map showing the progressive flooding of Doggerland',
    'The drowning of Doggerland in three stages: 10,000 BP (left), 8,000 BP (centre), and 6,000 BP (right). Over four millennia, the vast landscape shrank to a cluster of islands and then vanished entirely.'
  ),
  'The Great Wave': figureHtml(
    images.storegga,
    'Storegga tsunami deposits at Montrose basin, Scotland',
    'Storegga tsunami deposits preserved in the sediment at Montrose, Scotland. The clean layer of marine sand, sandwiched between layers of terrestrial peat, is evidence of the catastrophic wave that struck around 6,200 BCE.'
  ),
  'Voices from the Deep': figureHtml(
    images.krijn,
    'Neanderthal skull fragment of Krijn at Leiden museum',
    'The skull fragment of "Krijn" — a Neanderthal who lived in Doggerland more than 50,000 years ago. Dredged from the seabed off the Netherlands in 2001, it is one of the most remarkable finds from the submerged landscape.'
  ),
  'Mapping the Invisible': figureHtml(
    images.palaeolandscape,
    'Early Holocene landscape features mapped by the North Sea Palaeolandscapes Project',
    'Landscape features of Early Holocene Doggerland mapped using oil company seismic data. Rivers, lakes, and coastlines emerge from the data — the topography of a world unseen for eight thousand years.'
  ),
  'Echoes of Doggerland': figureHtml(
    images.clementReid,
    "Clement Reid's map of the Dogger Bank from Submerged Forests (1913)",
    "Clement Reid's map of the Dogger Bank from his 1913 book <em>Submerged Forests</em> — the first scientific attempt to chart the drowned landscape of the North Sea."
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/doggerland.ts');
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
  <p class="epigraph">"The area of the present North Sea has been land in the past, and land that people knew."</p>
  <p class="epigraph-attr">— Bryony Coles, "Doggerland: a Speculative Survey," 1998</p>
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
      <p><strong>~20,000 BCE</strong> — Last Glacial Maximum. Ice sheets cover much of northern Europe; sea levels are 120 metres lower than today. The North Sea does not exist — Doggerland connects Britain to the European mainland.</p>
      <p><strong>~18,000 BCE</strong> — Ice begins to retreat. Doggerland emerges as habitable tundra steppe, home to woolly mammoths, rhinoceroses, cave lions, and herds of reindeer and wild horses.</p>
      <p><strong>~11,700 BCE</strong> — The Holocene begins. Rapid warming transforms Doggerland from tundra to temperate forest. Birch, pine, then oak and hazel spread across the landscape.</p>
      <p><strong>~10,000 BCE</strong> — Sea levels begin rising at 1–2 metres per century. Mesolithic hunter-gatherers inhabit Doggerland — fishing, hunting, and gathering across a landscape of rivers, marshes, and dense woodland.</p>
      <p><strong>~9,000 BCE</strong> — Rising seas reduce Doggerland to low-lying islands and peninsulas. The English Channel floods, separating southern Doggerland from France.</p>
      <p><strong>~8,200 BCE</strong> — Lake Agassiz in North America drains catastrophically, raising global sea levels by perhaps a metre in decades. Doggerland's remaining lowlands flood rapidly.</p>
      <p><strong>~6,500 BCE</strong> — Britain is fully separated from Europe. Doggerland is gone except for the Dogger Bank, which persists as an island or archipelago.</p>
      <p><strong>~6,200 BCE</strong> — The Storegga Slide: a massive submarine landslide off Norway (3,500 km³ of debris) triggers a tsunami with waves up to 25 metres high. The wave devastates the Doggerland remnants and the coasts of Scotland, Orkney, and Shetland. Up to a quarter of Britain's Mesolithic population may have perished.</p>
      <p><strong>~5,000 BCE</strong> — The Dogger Bank itself submerges completely. Doggerland ceases to exist.</p>
      <p><strong>1913</strong> — Geologist Clement Reid publishes <em>Submerged Forests</em>, documenting botanical remains from the Dogger Bank and speculating about drowned landscapes beneath the North Sea.</p>
      <p><strong>1931</strong> — The trawler <em>Colinda</em>, skippered by Pilgrim Lockwood, hauls up a barbed antler harpoon, roughly 12,000 years old, from the Ower Bank. Grahame Clark and the Godwins analyse it as evidence of Mesolithic habitation on the submerged landscape.</p>
      <p><strong>1998</strong> — Bryony Coles publishes "Doggerland: a Speculative Survey," giving the drowned landscape its name and reframing it as a homeland, not a land bridge.</p>
      <p><strong>2001</strong> — A 50,000–70,000-year-old Neanderthal skull fragment ("Krijn") is recovered from the seabed off the Netherlands. Vincent Gaffney and Simon Fitch begin using oil company seismic data to map Doggerland.</p>
      <p><strong>2012</strong> — Major Doggerland research presented at the Royal Society in London.</p>
      <p><strong>2015</strong> — Europe's Lost Frontiers project launched at the University of Bradford (ERC Advanced Grant).</p>
      <p><strong>2019</strong> — First artefact directly prospected from the North Sea floor: a hammerstone fragment from the ancient Southern River area.</p>
      <p><strong>2020</strong> — Ancient sedimentary DNA breakthrough: 574 plant taxa identified from Doggerland sediment cores.</p>
      <p><strong>2024</strong> — Over 2,000 objects recovered from Doggerland. SUBNORDICA project (€13 million EU grant) launched to study submerged landscapes across the North Sea and Baltic.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a narrative non-fiction account of the drowned landscape beneath the North Sea. The geological history, archaeological discoveries, and scientific research described are based on published scholarship and primary sources; some scene-setting and atmospheric detail is imaginatively reconstructed.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Coles, Bryony — "Doggerland: a Speculative Survey," <em>Proceedings of the Prehistoric Society</em>, 1998</p>
      <p>Gaffney, Vincent, Simon Fitch & David Smith — <em>Europe's Lost World: The Rediscovery of Doggerland</em>, Council for British Archaeology, 2009</p>
      <p>Reid, Clement — <em>Submerged Forests</em>, Cambridge University Press, 1913</p>
      <p>Walker, Ben — "Conjuring the Lost Land Beneath the North Sea," <em>Hakai Magazine</em>, 2024</p>
      <p>Spinney, Laura — "Searching for Doggerland," <em>National Geographic</em>, 2012</p>
      <p class="separator">***</p>
      <p>This book is part of <strong>${book.series}</strong> in the HistorIQly Mysteries series — real history, told as a mystery.</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-doggerbank-chart.jpg'),
        title: 'Doggerland',
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

    console.log('\nPost-processing...');
    await polishEpub(outPath, outPath);

    console.log('\nDone!');
  } catch (err) {
    console.error('Failed to generate EPUB:', err);
    process.exit(1);
  }
}

build();
