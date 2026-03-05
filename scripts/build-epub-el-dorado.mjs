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
  title: 'El Dorado',
  subtitle: 'The City of Gold That Drove Men Mad',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'el-dorado',
  description:
    'For three centuries, the legend of El Dorado lured conquistadors, knights, and poets into the jungles of South America. They were searching for a city paved in gold. What they found was starvation, madness, and death. This is the true story of the myth that consumed an empire.',
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
  hero: imgFileUrl('hero-muisca-raft-gold.jpg'),
  lake: imgFileUrl('el-dorado-lake-guatavita.jpg'),
  tunjo: imgFileUrl('el-dorado-muisca-tunjo.jpg'),
  orellana: imgFileUrl('el-dorado-orellana-amazon.jpg'),
  aguirre: imgFileUrl('el-dorado-aguirre.jpg'),
  raleigh: imgFileUrl('el-dorado-raleigh-portrait.jpg'),
  map: imgFileUrl('el-dorado-parime-map.jpg'),
  lidar: imgFileUrl('el-dorado-lidar-amazon.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Golden One': figureHtml(
    images.hero,
    'The Muisca Raft, a gold votive sculpture depicting the El Dorado ceremony',
    'The Muisca Raft (Balsa Muisca), discovered in 1969 near Pasca, Colombia. Cast in tumbaga by the lost-wax method, it depicts the El Dorado ceremony — the golden chief on his raft, surrounded by attendants, about to cast offerings into the sacred lake.'
  ),
  'Three Conquistadors': figureHtml(
    images.tunjo,
    'A Muisca tunjo — a gold votive figurine from pre-Columbian Colombia',
    'A Muisca tunjo — a small votive figurine cast in gold alloy, created as an offering to the gods. The rough, unpolished surface was deliberate: these objects were made to be given away, not displayed.'
  ),
  'From Man to Mirage': figureHtml(
    images.map,
    'Historical map showing the mythical Lake Parime and El Dorado',
    'A European map showing the mythical Lake Parime and the golden city of Manoa — geographical fictions that appeared on maps for over two centuries, conjured from nothing by the power of the El Dorado legend.'
  ),
  'Into the Green Hell': figureHtml(
    images.orellana,
    'Francisco de Orellana and the first European navigation of the Amazon River',
    'The Pizarro-Orellana expedition of 1541-42 — the disastrous search for El Dorado and cinnamon that resulted in the first European navigation of the entire Amazon River, at a cost of thousands of lives.'
  ),
  'The Wrath of God': figureHtml(
    images.aguirre,
    'Lope de Aguirre, the self-proclaimed Wrath of God',
    'Lope de Aguirre — the mad conquistador who murdered his own commander, renounced the Spanish Crown, and killed his teenage daughter before being shot and dismembered in Venezuela in 1561.'
  ),
  'The Discoverie of Guiana': figureHtml(
    images.raleigh,
    'Portrait of Sir Walter Raleigh, English explorer and poet',
    'Sir Walter Raleigh — poet, courtier, and adventurer, who spent thirteen years in the Tower of London and lost his son and his head in pursuit of El Dorado.'
  ),
  'Draining the Lake': figureHtml(
    images.lake,
    'Lake Guatavita, the sacred Muisca lake in Colombia',
    'Lake Guatavita — the nearly circular crater lake where the El Dorado ceremony took place. The notch cut by Sepúlveda in 1580 is still visible in the rim. The lake has been a protected heritage site since 1965.'
  ),
  'The Lost Cities Were Real': figureHtml(
    images.lidar,
    'LIDAR survey revealing ancient settlements beneath the Amazon canopy',
    'LIDAR technology has revealed vast networks of pre-Columbian settlements hidden beneath the Amazon canopy — lost cities that were real, just not golden.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/el-dorado.ts');
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
  <p class="epigraph">"The king, stripped of all his clothing, was anointed<br/>with a sticky earth and then powdered with gold dust<br/>blown through cane tubes until his whole body was covered<br/>from the soles of his feet to his forehead,<br/>making him resplendent as a golden object<br/>worked by the hand of a skilled craftsman."</p>
  <p class="epigraph-attr">— Juan de Castellanos, <em>Elegías de varones ilustres de Indias</em>, 1589</p>
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
      <p><strong>c. 600–1600 CE</strong> — The Muisca Raft is created by lost-wax casting, depicting the El Dorado ceremony at Lake Guatavita.</p>
      <p><strong>1535–1536</strong> — Sebastián de Belalcázar hears stories of a "golden chief" in Quito. His treasurer records the first use of the phrase "El Dorado."</p>
      <p><strong>April 1536</strong> — Gonzalo Jiménez de Quesada departs Santa Marta with 800 men to march up the Magdalena River into the Colombian interior.</p>
      <p><strong>Early 1537</strong> — Quesada reaches the Muisca highlands with only 166 survivors. He conquers the Muisca and seizes 191,000 pesos of gold and 1,815 emeralds.</p>
      <p><strong>August 6, 1538</strong> — Quesada founds Santa Fe de Bogotá on the site of the Zipa's former capital.</p>
      <p><strong>Early 1539</strong> — Three expeditions — Quesada, Belalcázar, and Federmann — converge on the Muisca highlands from different directions in one of history's most extraordinary coincidences.</p>
      <p><strong>February 1541</strong> — Gonzalo Pizarro departs Quito with 220 Spaniards and 4,000 indigenous porters to search for El Dorado and the Land of Cinnamon.</p>
      <p><strong>December 26, 1541</strong> — Francisco de Orellana is sent downriver and begins the first European navigation of the Amazon.</p>
      <p><strong>August 26, 1542</strong> — Orellana reaches the mouth of the Amazon and the Atlantic Ocean after an eight-month, 4,800-km journey.</p>
      <p><strong>1545</strong> — Hernán Pérez de Quesada makes the first attempt to drain Lake Guatavita using a bucket chain. Recovers 3,000–4,000 pesos of gold.</p>
      <p><strong>January 1, 1561</strong> — Lope de Aguirre murders his commander Pedro de Ursúa on New Year's Day and seizes control of the Amazon expedition.</p>
      <p><strong>October 27, 1561</strong> — Aguirre is shot and killed in Barquisimeto, Venezuela, after murdering his teenage daughter Elvira. His body is dismembered.</p>
      <p><strong>1580</strong> — Antonio de Sepúlveda cuts a notch through the rim of Lake Guatavita, lowering the water by 20 metres. The channel collapses, killing workers.</p>
      <p><strong>April 15, 1595</strong> — Sir Walter Raleigh enters the Orinoco delta with 100 men, searching for Manoa. Finds no gold.</p>
      <p><strong>1596</strong> — Raleigh publishes <em>The Discoverie of the Large, Rich, and Beautifull Empyre of Guiana</em>.</p>
      <p><strong>1617–1618</strong> — Raleigh's second expedition. His son Wat is killed at San Thomé. Keymis commits suicide.</p>
      <p><strong>October 29, 1618</strong> — Sir Walter Raleigh is beheaded at Westminster. "Strike, man, strike!"</p>
      <p><strong>1801</strong> — Alexander von Humboldt visits Lake Guatavita and estimates $300 million in treasure on the lakebed.</p>
      <p><strong>1898–1912</strong> — British company Contractors Ltd. drains Lake Guatavita through a tunnel. Recovers only £500 of treasure before going bankrupt.</p>
      <p><strong>1925</strong> — Colonel Percy Fawcett vanishes in the Brazilian Mato Grosso while searching for the Lost City of Z.</p>
      <p><strong>1965</strong> — Colombian government declares Lake Guatavita a protected cultural heritage site.</p>
      <p><strong>1969</strong> — Cruz María Dimaté discovers the Muisca Raft in a cave near Pasca, Colombia.</p>
      <p><strong>January 2024</strong> — <em>Science</em> publishes LIDAR discovery of 2,500-year-old Amazonian cities in Ecuador's Upano Valley.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; dialogue and some scene detail are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Hemming, John — <em>The Search for El Dorado</em>, Phoenix Press, 2001</p>
      <p>Nicholl, Charles — <em>The Creature in the Map: Sir Walter Raleigh's Quest for El Dorado</em>, Vintage, 1996</p>
      <p>Carvajal, Gaspar de — <em>Relación del nuevo descubrimiento del famoso río Grande</em> (Account of the New Discovery of the Famous Grand River), 1542</p>
      <p>Raleigh, Sir Walter — <em>The Discoverie of the Large, Rich, and Beautifull Empyre of Guiana</em>, 1596</p>
      <p>Freyle, Juan Rodríguez — <em>El Carnero</em>, 1636</p>
      <p>Rostain, Stéphen, et al. — "Two thousand years of garden urbanism in the Upper Amazon," <em>Science</em>, January 2024</p>
      <p>Grann, David — <em>The Lost City of Z: A Tale of Deadly Obsession in the Amazon</em>, Doubleday, 2009</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-muisca-raft-gold.jpg'),
        title: 'El Dorado',
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
