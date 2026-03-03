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
  title: 'The Lost Colony of Roanoke',
  subtitle: 'The Disappearance That Haunts America',
  author: 'HistorIQly',
  series: 'Vol. 4: Disappearances',
  slug: 'roanoke-colony',
  description:
    'In 1587, 117 English colonists settled on a small island off the coast of North Carolina. Three years later, they had vanished — leaving only the word CROATOAN carved into a post. No bodies. No graves. No explanation. Over four centuries later, the mystery endures.',
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
  hero: imgFileUrl('hero-roanoke-colony.jpg'),
  map: imgFileUrl('roanoke-white-map.jpg'),
  secoton: imgFileUrl('roanoke-secoton-village.jpg'),
  raleigh: imgFileUrl('figure-walter-raleigh.jpg'),
  baptism: imgFileUrl('roanoke-virginia-dare-baptism.jpg'),
  croatoan: imgFileUrl('roanoke-croatoan-carving.jpg'),
  armada: imgFileUrl('roanoke-spanish-armada.jpg'),
  fort: imgFileUrl('roanoke-fort-raleigh.jpg'),
  debry: imgFileUrl('roanoke-debry-map-detail.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The New World Beckons': figureHtml(
    images.map,
    'John White\'s map of the Virginia coast, La Virginea Pars, c. 1585',
    'John White\'s map of the Virginia coast, "La Virginea Pars," drawn c. 1585 and now held in the British Museum. Roanoke Island is visible in the centre of the map, surrounded by the barrier islands of the Outer Banks.'
  ),
  'Manteo and Wanchese': figureHtml(
    images.raleigh,
    'Portrait of Sir Walter Raleigh by William Segar, 1598',
    'Sir Walter Raleigh, painted by William Segar in 1598. The courtier, poet, and colonial promoter financed the Roanoke expeditions but never set foot in America himself. He was executed in 1618.'
  ),
  "The Soldier's Colony": figureHtml(
    images.secoton,
    'John White\'s watercolour of the village of Secoton',
    'John White\'s watercolour of the Algonquian village of Secoton, painted during the 1585 expedition. The painting shows longhouses, cornfields at different stages of growth, a ceremonial fire, and a dance. It is one of the most important visual documents of pre-contact Native American life.'
  ),
  'The Cittie of Raleigh': figureHtml(
    images.hero,
    'Theodor de Bry\'s engraving of the English arrival in Virginia, 1590',
    'Theodor de Bry\'s engraving "The Arrival of the Englishmen in Virginia," published in 1590. Based on John White\'s drawings, it shows English ships navigating the treacherous waters of the Outer Banks.'
  ),
  'Virginia': figureHtml(
    images.baptism,
    'The Baptism of Virginia Dare, 1880 engraving',
    'An 1880 engraving depicting the baptism of Virginia Dare, the first English child born in North America, on Roanoke Island in August 1587.'
  ),
  'The Armada': figureHtml(
    images.armada,
    'English fireships attack the Spanish Armada at Calais, August 1588',
    'English fireships attack the Spanish Armada anchored at Calais on the night of August 7, 1588. The Armada crisis prevented John White from returning to Roanoke for three critical years.'
  ),
  'CROATOAN': figureHtml(
    images.croatoan,
    'John White discovers the word CROATOAN carved on a post, 1590',
    'An 1876 engraving by William Ludwell Sheppard depicting John White\'s return to Roanoke in August 1590, finding the word "CROATOAN" carved on a post — the only clue to the colonists\' fate.'
  ),
  'Digging for Truth': figureHtml(
    images.fort,
    'The reconstructed earthworks at Fort Raleigh National Historic Site',
    'The reconstructed earthworks at Fort Raleigh National Historic Site on Roanoke Island, North Carolina. The site preserves the remains of the 1585 fort and is administered by the National Park Service.'
  ),
  "America's Origin Story": figureHtml(
    images.debry,
    'Detail from Theodor de Bry\'s map showing Roanoke Island',
    'Detail from Theodor de Bry\'s 1590 map "The Carte of All the Coast of Virginia," showing Roanoke Island and the surrounding waters. The map was based on John White\'s original surveys.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/roanoke-colony.ts');
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
  <p class="epigraph">"I would to God my wealth were answerable to my will."</p>
  <p class="epigraph-attr">— John White, Governor of the Roanoke Colony, c. 1593</p>
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
      <p><strong>March 25, 1584</strong> — Queen Elizabeth I grants Sir Walter Raleigh a royal charter to explore and colonise the New World.</p>
      <p><strong>April 27, 1584</strong> — Captains Philip Amadas and Arthur Barlowe depart on a reconnaissance expedition, piloted by Simon Fernandez.</p>
      <p><strong>July 4, 1584</strong> — The expedition makes landfall near present-day Nags Head, North Carolina, and explores the Outer Banks and Roanoke Island.</p>
      <p><strong>Autumn 1584</strong> — Manteo and Wanchese travel to England with the returning expedition. Thomas Harriot begins learning the Carolina Algonquian language.</p>
      <p><strong>April 1585</strong> — Sir Richard Grenville leads a fleet of seven ships carrying approximately 600 men to establish the first English colony.</p>
      <p><strong>August 17, 1585</strong> — Ralph Lane establishes a military garrison of 107 men on Roanoke Island.</p>
      <p><strong>June 1, 1586</strong> — Lane kills the Secotan chief Pemisapan (formerly Wingina) in a preemptive strike.</p>
      <p><strong>June 9, 1586</strong> — Sir Francis Drake arrives at Roanoke; Lane's garrison abandons the colony and sails home.</p>
      <p><strong>Summer 1586</strong> — Grenville arrives with supplies, finds the colony deserted, and leaves a garrison of fifteen men.</p>
      <p><strong>January 7, 1587</strong> — Raleigh charters "the Cittie of Raleigh in Virginia" — a colony of families, not soldiers.</p>
      <p><strong>May 8, 1587</strong> — John White's colony of 117 settlers departs England aboard three ships.</p>
      <p><strong>July 22, 1587</strong> — The colonists arrive at Roanoke Island. Simon Fernandez reportedly refuses to take them on to the Chesapeake.</p>
      <p><strong>July 28, 1587</strong> — George Howe, one of the twelve assistants, is murdered by Dasamonquepeuc warriors while crabbing.</p>
      <p><strong>August 13, 1587</strong> — Manteo is baptised into the Church of England and named Lord of Roanoke and Dasamonquepeuc.</p>
      <p><strong>August 18, 1587</strong> — Virginia Dare is born — the first English child born in North America.</p>
      <p><strong>August 27, 1587</strong> — Governor John White sails for England to secure supplies, leaving 115 colonists behind.</p>
      <p><strong>April 22, 1588</strong> — White's first resupply attempt aboard the Brave and Roe. Both ships are attacked; White is wounded. The attempt fails.</p>
      <p><strong>August 1588</strong> — The Spanish Armada is defeated. England's shipping embargo prevents White from returning to Roanoke.</p>
      <p><strong>March 1590</strong> — White finally secures passage on a privateering fleet under John Watts.</p>
      <p><strong>August 18, 1590</strong> — White reaches Roanoke Island and finds the colony deserted. The word "CROATOAN" is carved on a gatepost. No Maltese cross is found.</p>
      <p><strong>October 24, 1590</strong> — White returns to England, never having reached Croatoan Island. He never returns to America.</p>
      <p><strong>c. 1593</strong> — John White dies in Ireland.</p>
      <p><strong>1607</strong> — Jamestown is founded. Later accounts report that Powhatan ordered the massacre of English-descended survivors among the Chesapeake tribe.</p>
      <p><strong>1937</strong> — Paul Green's outdoor drama "The Lost Colony" premieres at Fort Raleigh. The first Dare Stone is found near the Chowan River.</p>
      <p><strong>1941</strong> — The Dare Stones are exposed as a hoax by the Saturday Evening Post.</p>
      <p><strong>1993</strong> — The Croatoan Archaeological Project begins excavations at a Croatoan village site on Hatteras Island.</p>
      <p><strong>1998</strong> — A 16th-century gold signet ring is found at the Hatteras Island site.</p>
      <p><strong>2012</strong> — The First Colony Foundation discovers a hidden fort symbol on John White's map at the British Museum, marking "Site X" inland.</p>
      <p><strong>2013–2024</strong> — Excavations at Site X in Bertie County recover Elizabethan-era English ceramics and artifacts.</p>
      <p><strong>2025</strong> — Hammerscale deposits — evidence of European metalworking — are announced at the Hatteras Island site.</p>
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
      <p>Kupperman, Karen Ordahl — <em>Roanoke: The Abandoned Colony</em>, Rowman & Littlefield, 2007</p>
      <p>Miller, Lee — <em>Roanoke: Solving the Mystery of the Lost Colony</em>, Penguin, 2002</p>
      <p>Harriot, Thomas — <em>A Briefe and True Report of the New Found Land of Virginia</em>, 1588 (1590 de Bry illustrated edition)</p>
      <p>Dawson, Scott — <em>The Lost Colony and Hatteras Island</em>, The History Press, 2020</p>
      <p>Horn, James — <em>A Kingdom Strange: The Brief and Tragic History of the Lost Colony of Roanoke</em>, Basic Books, 2010</p>
      <p>First Colony Foundation — Archaeological reports and research archive, firstcolonyfoundation.org</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-roanoke-colony.jpg'),
        title: 'The Lost Colony\nof Roanoke',
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
