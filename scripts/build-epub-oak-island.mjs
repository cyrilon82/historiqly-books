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
  title: 'The Oak Island Money Pit',
  subtitle: 'The Treasure Hunt That Swallowed Fortunes and Lives',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'oak-island',
  description:
    'On a wooded island off the coast of Nova Scotia, three teenage boys discovered a mysterious depression in the earth in 1795 — and ignited the longest, most expensive, and most deadly treasure hunt in history. For over two centuries, the Oak Island Money Pit has consumed fortunes, broken lives, and killed six men, yet its secret remains sealed beneath layers of oak platforms, coconut fibre, and relentless seawater.',
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
  hero: imgFileUrl('hero-oak-island-1931.jpg'),
  digs: imgFileUrl('oak-island-digs-1931.jpg'),
  buildings: imgFileUrl('oak-island-digs-buildings-1931.jpg'),
  fdr: imgFileUrl('suspect-fdr-oak-island.jpg'),
  diagram: imgFileUrl('oak-island-money-pit-diagram.jpg'),
  headline: imgFileUrl('oak-island-headline-1866.jpg'),
  crossSection: imgFileUrl('oak-island-pit-cross-section.png'),
  kidd: imgFileUrl('suspect-captain-kidd.jpg'),
  kiddBurying: imgFileUrl('oak-island-kidd-burying-treasure.jpg'),
  treasureSign: imgFileUrl('oak-island-treasure-sign.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Depression in the Earth': figureHtml(
    images.kiddBurying,
    'Captain Kidd burying treasure — Victorian cigarette card',
    'Captain Kidd burying treasure, from a Victorian-era cigarette card. The legend of Kidd\'s buried gold was well known along the coast of Nova Scotia and may have been the inspiration for the original dig.'
  ),
  'The Onslow Company': figureHtml(
    images.diagram,
    'Diagram of the Oak Island Money Pit',
    'An early diagram of the Money Pit showing the layered oak platforms discovered at ten-foot intervals and the flood tunnel connecting the shaft to Smith\'s Cove.'
  ),
  "The Drains at Smith's Cove": figureHtml(
    images.crossSection,
    'Cross-section diagram of the Oak Island Money Pit excavation',
    'A cross-section of the Money Pit and surrounding shafts, showing the complex web of tunnels and excavations that accumulated over two centuries of treasure hunting.'
  ),
  'A Century of Failure': figureHtml(
    images.headline,
    'New York Herald headline about Oak Island, 1866',
    'An 1866 headline from the New York Herald brought the Oak Island mystery to a national audience, attracting investors and treasure hunters from across North America.'
  ),
  'A Future President Digs': figureHtml(
    images.fdr,
    'Franklin D. Roosevelt and others at Oak Island, Nova Scotia',
    'A young Franklin D. Roosevelt (far right) with members of the Old Gold Salvage Company on Oak Island, circa 1909. Roosevelt maintained a lifelong interest in the treasure hunt.'
  ),
  'The Restall Tragedy': figureHtml(
    images.digs,
    'Excavation buildings on Oak Island, 1931',
    'Buildings and equipment at the Oak Island dig site, photographed in August 1931. The island\'s remote location and primitive conditions made rescue operations nearly impossible.'
  ),
  'Into the Deep': figureHtml(
    images.buildings,
    'Digs and buildings on Oak Island, 1931',
    'The industrial scale of Oak Island operations, photographed in 1931. By this time, the original Money Pit had been surrounded by dozens of intersecting shafts and tunnels.'
  ),
  'The Theories': figureHtml(
    images.kidd,
    'Captain William Kidd, engraving',
    'Captain William Kidd, the most frequently named suspect in the Oak Island mystery. Kidd was executed in London in 1701, and the legend of his buried treasure has been linked to the Money Pit since its discovery.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/oak-island.ts');
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
  <p class="epigraph">"The treasure will not be found until seven men have died in the search for it."</p>
  <p class="epigraph-attr">— The Oak Island curse, according to local legend</p>
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
      <p><strong>1795</strong> — Daniel McGinnis discovers a circular depression and a ship's tackle block on Oak Island. With friends John Smith and Anthony Vaughan, he digs to thirty feet, finding oak platforms every ten feet.</p>
      <p><strong>1802–1805</strong> — The Onslow Company excavates to ninety feet, finding charcoal, putty, coconut fibre, and an inscribed stone at eighty feet. The pit floods with sixty feet of seawater.</p>
      <p><strong>1849–1851</strong> — The Truro Company drills into the flooded pit. Auger samples bring up gold chain links, coconut fibre, and a scrap of parchment from 126 feet. Box drains and coconut fibre discovered at Smith's Cove.</p>
      <p><strong>1861</strong> — The Oak Island Association begins work. A pump engine boiler burst kills a worker — the first death on the island.</p>
      <p><strong>1866</strong> — The <em>New York Herald</em> publishes an article about the Money Pit, bringing national attention to the mystery.</p>
      <p><strong>1878</strong> — Sophia Sellers sinks into the ground while ploughing between Smith's Cove and the Money Pit, suggesting underground tunnels or natural sinkholes.</p>
      <p><strong>1893–1951</strong> — Frederick Blair holds the treasure trove licence for Oak Island. He organizes multiple expeditions over fifty-eight years.</p>
      <p><strong>1897</strong> — Worker Maynard Kaiser falls to his death during excavation — the second fatality.</p>
      <p><strong>1909</strong> — A young Franklin D. Roosevelt invests in the Old Gold Salvage Company and visits Oak Island.</p>
      <p><strong>1935–1938</strong> — Gilbert Hedden purchases the eastern end of Oak Island and hires professional engineers. Workers discover a stone triangle pointing at the Money Pit.</p>
      <p><strong>1939–1942</strong> — Erwin Hamilton's dye test reveals water exits a hundred yards offshore, suggesting multiple flood tunnels.</p>
      <p><strong>1959–1965</strong> — Robert Restall and family move to Oak Island. On August 17, 1965, Robert, his son Bobby, Karl Graeser, and Cyril Hiltz die from toxic gas in a shaft.</p>
      <p><strong>1965–1966</strong> — Robert Dunfield uses a seventy-ton crane to excavate a massive crater, destroying much of the original pit's archaeological context.</p>
      <p><strong>1967–2019</strong> — Dan Blankenship and the Triton Alliance spend decades exploring the island. Borehole 10-X reaches 235 feet and reveals a possible underground cavern.</p>
      <p><strong>1976</strong> — Borehole 10-X's steel casing collapses seconds after Blankenship is hauled clear.</p>
      <p><strong>2006–present</strong> — Rick and Marty Lagina purchase Oak Island Tours, Inc. Their excavation, documented by <em>The Curse of Oak Island</em> television series, employs modern technology including ground-penetrating radar, sonic drilling, and environmental DNA analysis.</p>
      <p><strong>2017</strong> — A lead cross from southern France, dating to the 1300s–1400s, is found at Smith's Cove.</p>
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
      <p>O'Connor, D'Arcy — <em>The Money Pit: The Story of Oak Island and the World's Greatest Treasure Hunt</em>, Coward, McCann & Geoghegan, 1978</p>
      <p>Crooker, William S. — <em>Oak Island Gold</em>, Nimbus Publishing, 1993</p>
      <p>Finnan, Mark — <em>Oak Island Secrets</em>, Formac Publishing, 1995</p>
      <p>Lamb, Joe — <em>Oak Island Obsession</em>, Dundurn Press, 2006</p>
      <p>Nickell, Joe — "The Secrets of Oak Island," <em>Skeptical Inquirer</em>, 2000</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-oak-island-1931.jpg'),
        title: 'The Oak Island\nMoney Pit',
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
