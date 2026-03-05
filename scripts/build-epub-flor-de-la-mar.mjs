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
  title: 'The Flor de la Mar',
  subtitle: 'The Richest Shipwreck Never Found',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'flor-de-la-mar',
  description:
    'In 1511, the largest Portuguese carrack ever built sank in a monsoon storm off the coast of Sumatra — carrying the plundered treasure of the Malacca Sultanate. Gold thrones, chests of jewels, and sixty tons of gold vanished beneath the waves. Five centuries later, the $2.6 billion wreck has never been found.',
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
  hero: imgFileUrl('hero-flor-de-la-mar.jpg'),
  ship1505: imgFileUrl('evidence-flor-de-la-mar-1505.jpg'),
  replica: imgFileUrl('location-flor-de-la-mar-replica.jpg'),
  albuquerque: imgFileUrl('suspect-albuquerque.png'),
  conquest: imgFileUrl('evidence-conquest-malacca-1511.jpg'),
  battle: imgFileUrl('evidence-conquest-malacca-battle.png'),
  sultan: imgFileUrl('suspect-sultan-mahmud-shah.jpg'),
  carracks: imgFileUrl('evidence-portuguese-carracks.jpg'),
  chart: imgFileUrl('location-strait-of-malacca-chart.jpg'),
  malacca: imgFileUrl('location-portuguese-malacca.png'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Flower of the Sea': figureHtml(
    images.hero,
    'Historical drawing of the Flor de la Mar from the Roteiro de Malaca',
    'The earliest known depiction of the Flor de la Mar, from the 16th-century Roteiro de Malaca by Francisco Rodrigues. Caption reads: "Galleon Flor de la Mar, in which Affonso d\'Albuquerque took Malacca."'
  ),
  'A Troubled Ship': figureHtml(
    images.ship1505,
    'The Flor de la Mar depicted in the Livro de Lisuarte de Abreu, 1563',
    'The nau Frol de la Mar as depicted in the Livro de Lisuarte de Abreu (1563), showing the ship as part of the Portuguese India fleet in 1505.'
  ),
  'The Battle That Changed the World': figureHtml(
    images.carracks,
    'Portuguese carracks off a rocky coast, circa 1540',
    'Portuguese carracks of the type Flor de la Mar belonged to, painted circa 1540. These multi-decked vessels with high forecastles and sterncastles were the workhorses of the Portuguese maritime empire.'
  ),
  'The Lion of the Seas': figureHtml(
    images.albuquerque,
    'Portrait of Afonso de Albuquerque, Viceroy of Portuguese India',
    'Afonso de Albuquerque, Governor of Portuguese India from 1509 to 1515. Known as "The Lion of the Seas," he conquered Goa, Malacca, and Hormuz — and chose the Flor de la Mar as his flagship.'
  ),
  'The Throat of Venice': figureHtml(
    images.sultan,
    'Sultan Mahmud Shah of Malacca',
    'Sultan Mahmud Shah, the last ruler of the Malacca Sultanate. His royal treasure — thrones, jewels, and sixty tons of gold — was loaded onto the Flor de la Mar after the city fell.'
  ),
  'The Fall of Malacca': figureHtml(
    images.conquest,
    'The Conquest of Malacca by Afonso de Albuquerque in 1511',
    'The Portuguese conquest of Malacca, 1511. Painting by Domingos Rebelo (1945), depicting the assault that gave Portugal control of the richest trading port in Southeast Asia.'
  ),
  'The Greatest Treasure Ever Assembled': figureHtml(
    images.malacca,
    'View of Portuguese Malacca, circa 1550-1563',
    'Malacca under Portuguese rule, drawn by Gaspar Correia in his chronicle Lendas da India (c. 1550-1563). The fortified settlement, including the A Famosa fortress, dominated the strait for 130 years.'
  ),
  'The Night of the Storm': figureHtml(
    images.chart,
    'Nautical chart of the Strait of Malacca, 1806',
    'Nautical chart of the Strait of Malacca by James Horsburgh (1806). The Flor de la Mar sank somewhere along the northeast Sumatran coast, in waters that remain treacherous to this day.'
  ),
  'Echoes of Empire': figureHtml(
    images.replica,
    'Full-size replica of the Flor de la Mar at the Maritime Museum in Malacca',
    'The full-size replica of the Flor de la Mar, built in 1994, now serving as the Maritime Museum in Malacca, Malaysia. At 34 metres high and 36 metres long, it stands as a monument to the ship — and the treasure — that was lost.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/flor-de-la-mar.ts');
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
  <p class="epigraph">"Whoever is lord of Malacca has his hand on the throat of Venice."</p>
  <p class="epigraph-attr">— Tomé Pires, Suma Oriental, c. 1515</p>
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
      <p><strong>1502</strong> — The Flor de la Mar is built in Lisbon, the largest Portuguese carrack of her time at 400 tons burden. She departs on her maiden voyage to India under Estevão da Gama.</p>
      <p><strong>1503</strong> — On the return voyage, the ship springs severe leaks in the Mozambique Channel. Forced repairs at Mozambique Island for two months. The pattern of structural vulnerability begins.</p>
      <p><strong>1505</strong> — Departs Lisbon again under João da Nova as part of the 7th India Armada carrying Viceroy Francisco de Almeida.</p>
      <p><strong>1506–1507</strong> — Stranded at Mozambique Island for ten months due to recurring leaks. Rescued by Tristão da Cunha's 8th India Armada in February 1507. The ship never returns to Portugal.</p>
      <p><strong>1507</strong> — Participates in the conquest of Socotra and Albuquerque's Arabian campaigns: Muscat, Khor Fakkan, and Hormuz.</p>
      <p><strong>3 February 1509</strong> — Serves as flagship at the Battle of Diu, one of the most decisive naval battles in history. Portugal wins unchallenged control of the Indian Ocean.</p>
      <p><strong>1509</strong> — João da Nova dies in Cochin. Afonso de Albuquerque claims the Flor de la Mar as his personal flagship.</p>
      <p><strong>17 February 1510</strong> — Albuquerque conquers Goa from the deck of the Flor de la Mar. The city becomes the capital of Portuguese India.</p>
      <p><strong>1 July 1511</strong> — The Portuguese armada arrives at Malacca. The Flor de la Mar is Albuquerque's flagship for the campaign.</p>
      <p><strong>25 July 1511</strong> — First assault on Malacca. Portuguese capture the bridge but are forced to retreat at nightfall. Sultan Mahmud Shah leads a counterattack atop a war elephant.</p>
      <p><strong>24 August 1511</strong> — Final assault. Sultan Mahmud flees. Malacca falls to Portugal after 40 days of fighting.</p>
      <p><strong>September–November 1511</strong> — The Sultan's treasure is systematically loaded onto the Flor de la Mar: gold thrones, 200 chests of jewels, bronze lions, and an estimated 60–80 tons of gold.</p>
      <p><strong>20 November 1511</strong> — Caught in a monsoon storm off the northeast coast of Sumatra, the overloaded Flor de la Mar strikes shoals and splits in two. More than 400 men perish. Albuquerque survives on a makeshift raft.</p>
      <p><strong>16 December 1515</strong> — Albuquerque dies on a ship within sight of Goa, embittered after being replaced as Governor by his political enemy.</p>
      <p><strong>1527</strong> — Sultan Mahmud Shah dies in exile in Kampar, Sumatra. His sons found the Sultanates of Johor and Perak.</p>
      <p><strong>1557</strong> — Brás de Albuquerque publishes the <em>Commentarios do Grande Affonso d'Alboquerque</em>, the primary historical source for the Flor de la Mar story.</p>
      <p><strong>1992</strong> — American treasure hunter Robert Marx claims to have located the wreck off the coast of Sumatra. Indonesian authorities shut down the expedition. The claim is never verified.</p>
      <p><strong>1994</strong> — A full-size replica of the Flor de la Mar opens as the Maritime Museum in Malacca, Malaysia.</p>
      <p><strong>2001</strong> — UNESCO's Convention on the Protection of Underwater Cultural Heritage further complicates any potential recovery of the wreck.</p>
      <p><strong>Present day</strong> — The Flor de la Mar remains the richest undiscovered shipwreck in history. The three-way territorial dispute between Portugal, Indonesia, and Malaysia continues unresolved.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; dialogue and some scene detail are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Primary Sources</strong></p>
      <p>Albuquerque, Brás de — <em>Commentarios do Grande Affonso d'Alboquerque</em>, 1557 (revised 1576). English translation: Laurier Books Ltd./AES, 2000</p>
      <p>Pires, Tomé — <em>Suma Oriental</em>, c. 1512–1515. Translated by Armando Cortesão</p>
      <p>Lopes, Thomé — Eyewitness account of the Flor de la Mar's first voyage, 1502–1503. Italian translation by Giovanni Battista Ramusio, 1550</p>
      <p>Correia, Gaspar — <em>Lendas da India</em>, c. 1550–1563</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Subrahmanyam, Sanjay — <em>The Portuguese Empire in Asia, 1500–1700</em>, Wiley-Blackwell, 2012</p>
      <p>Andaya, Leonard Y. and Barbara Watson Andaya — <em>A History of Malaysia</em>, Palgrave Macmillan, 2017</p>
      <p>Diffie, Bailey W. and George D. Winius — <em>Foundations of the Portuguese Empire, 1415–1580</em>, University of Minnesota Press, 1977</p>
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
        backgroundImage: resolve(IMG_DIR, 'evidence-portuguese-carracks.jpg'),
        title: 'The Flor\nde la Mar',
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
