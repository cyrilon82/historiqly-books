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
  title: 'Opus Dei',
  subtitle: 'The Secret Power Inside the Vatican',
  author: 'HistorIQly',
  series: 'Vol. 6: Secret Societies',
  slug: 'opus-dei',
  description:
    "From a young priest's vision in 1928 Madrid to a global empire of influence, wealth, and control — the untold story of Opus Dei, the Catholic Church's most powerful and controversial organization.",
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
  hero: imgFileUrl('hero-escriva-portrait.jpg'),
  hqManhattan: imgFileUrl('opus-dei-hq-manhattan.jpg'),
  hqRome: imgFileUrl('opus-dei-hq-rome.jpg'),
  cilice: imgFileUrl('cilice-mortification.jpg'),
  ocariz: imgFileUrl('suspect-fernando-ocariz.jpg'),
  escrivaVatican: imgFileUrl('escriva-in-vatican.jpg'),
  ordination: imgFileUrl('ordination-first-priests.jpg'),
  torreciudad: imgFileUrl('torreciudad-shrine.jpg'),
  delPortillo: imgFileUrl('suspect-alvaro-del-portillo.png'),
  altarVienna: imgFileUrl('escriva-altar-vienna.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Vision': figureHtml(
    images.ordination,
    'Ordination of the first Opus Dei priests',
    'The ordination of the first Opus Dei priests. From a handful of followers in a borrowed room in Madrid, Escrivá built an organization that would reach into the highest corridors of power in the Catholic Church.'
  ),
  'The Crossing': figureHtml(
    images.torreciudad,
    'The Sanctuary of Torreciudad in the Aragonese Pyrenees',
    'The Sanctuary of Torreciudad, built by Opus Dei in the Aragonese Pyrenees near the route Escrivá took during his escape from Republican Spain in 1937. The shrine became a major pilgrimage site for members of the Work.'
  ),
  "God's Workforce": figureHtml(
    images.hqRome,
    'Opus Dei central headquarters in Rome',
    "Villa Tevere, Opus Dei's central headquarters in Rome. From this building, the Prelate oversees an organization of approximately 90,000 members spanning more than 60 countries."
  ),
  'The Cilice': figureHtml(
    images.cilice,
    'A cilice — a spiked metal chain used for corporal mortification',
    'A cilice, the spiked metal chain worn around the upper thigh for two hours daily by Opus Dei numeraries. The small inward-pointing prongs press into the flesh as an act of penance. Former members testified that the practice left puncture marks and sometimes drew blood.'
  ),
  'The Technocrats': figureHtml(
    images.escrivaVatican,
    'Josemaría Escrivá at the Vatican',
    'Josemaría Escrivá during a visit to the Vatican. His close relationship with Pope John Paul II would prove crucial to both the elevation of Opus Dei to Personal Prelature status and his own fast-tracked canonization.'
  ),
  'The Fastest Saint': figureHtml(
    images.altarVienna,
    'Altar dedicated to Josemaría Escrivá in the Peterskirche, Vienna',
    'An altar dedicated to Saint Josemaría Escrivá in the Peterskirche in Vienna. His canonization in 2002 — just 27 years after his death — was one of the fastest in modern Catholic history and remains deeply controversial.'
  ),
  'The Code': figureHtml(
    images.hqManhattan,
    'Opus Dei headquarters in Manhattan, New York',
    "Opus Dei's national headquarters in Manhattan, New York City. The 17-story building on Lexington Avenue, completed in 2001, houses offices, a chapel, and residential quarters for numerary members."
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/opus-dei.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
const chapters = [];
let match;
while ((match = chapterRegex.exec(raw)) !== null) {
  chapters.push({
    num: match[1],
    title: (match[2] || match[3]).replace(/\\'/g, "'"),
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
  <p class="epigraph">"Obey, as an instrument obeys in the hands of the artist — not stopping to consider the reasons for this or that order."</p>
  <p class="epigraph-attr">— Josemaría Escrivá, <em>The Way</em>, Maxim 617</p>
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
      <p><strong>1902</strong> — Josemaría Escrivá de Balaguer is born on January 9 in Barbastro, Aragon, Spain.</p>
      <p><strong>1918</strong> — After his father's business failure and the death of three sisters, the family moves to Logroño. The teenage Escrivá enters the seminary.</p>
      <p><strong>1925</strong> — Escrivá is ordained a priest on March 28 in Zaragoza.</p>
      <p><strong>1927</strong> — Moves to Madrid to pursue a doctorate in civil law. Begins pastoral work in hospitals and slums.</p>
      <p><strong>1928 (October 2)</strong> — Escrivá experiences a vision and founds Opus Dei in Madrid.</p>
      <p><strong>1930</strong> — The women's branch of Opus Dei is established.</p>
      <p><strong>1934</strong> — Escrivá publishes <em>Consideraciones Espirituales</em>, the precursor to <em>The Way</em>.</p>
      <p><strong>1936–1937</strong> — The Spanish Civil War erupts. Escrivá goes into hiding in Republican Madrid.</p>
      <p><strong>1937 (November–December)</strong> — Escrivá and seven companions cross the Pyrenees on foot, escaping to Andorra and then to Nationalist Spain.</p>
      <p><strong>1939</strong> — Franco wins the Civil War. Escrivá publishes <em>The Way</em>, containing 999 maxims.</p>
      <p><strong>1950</strong> — Pope Pius XII grants Opus Dei definitive approval as a Secular Institute.</p>
      <p><strong>1957</strong> — Three Opus Dei members enter Franco's cabinet as "technocrat" ministers.</p>
      <p><strong>1959</strong> — The Stabilization Plan transforms the Spanish economy, beginning the "Spanish Miracle."</p>
      <p><strong>1968</strong> — Escrivá obtains the title of Marqués de Peralta through the Spanish Ministry of Justice.</p>
      <p><strong>1975 (June 26)</strong> — Escrivá dies of a heart attack at Villa Tevere in Rome. Álvaro del Portillo succeeds him.</p>
      <p><strong>1981</strong> — Cardinal Basil Hume issues guidelines for Opus Dei in England, including a minimum age of 18 for commitments.</p>
      <p><strong>1982</strong> — Pope John Paul II erects Opus Dei as a Personal Prelature — the first and only such designation in the Catholic Church.</p>
      <p><strong>1991</strong> — Tammy and Dianne DiNicola found ODAN (Opus Dei Awareness Network).</p>
      <p><strong>1992</strong> — Escrivá is beatified. María del Carmen Tapia publishes <em>Beyond the Threshold</em>.</p>
      <p><strong>2001</strong> — FBI agent Robert Hanssen, an Opus Dei member, is arrested as a Russian spy.</p>
      <p><strong>2002 (October 6)</strong> — Escrivá is canonized by John Paul II — 27 years after his death, one of the fastest modern canonizations.</p>
      <p><strong>2003</strong> — Dan Brown's <em>The Da Vinci Code</em> makes Opus Dei a household name worldwide.</p>
      <p><strong>2017</strong> — Banco Popular, long connected to Opus Dei, collapses unexpectedly.</p>
      <p><strong>2022</strong> — Pope Francis issues <em>Ad Charisma Tuendum</em>, stripping the Prelate of bishop status and increasing Vatican oversight.</p>
      <p><strong>2023</strong> — Francis issues <em>Ad Christi Evangelium</em>, further curtailing Opus Dei's autonomy over lay members.</p>
      <p><strong>2024</strong> — Argentine prosecutors charge four Opus Dei priests with human trafficking and labor exploitation of 43 women.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Gore, Gareth — <em>Opus: The Cult of Dark Money, Human Trafficking, and Right-Wing Conspiracy Inside the Catholic Church</em>, Simon & Schuster, 2024</p>
      <p>Allen, John L. Jr. — <em>Opus Dei: An Objective Look Behind the Myths and Reality</em>, Doubleday, 2005</p>
      <p>Tapia, María del Carmen — <em>Beyond the Threshold: A Life in Opus Dei</em>, Continuum, 1997</p>
      <p>Hutchison, Robert — <em>Their Kingdom Come: Inside the Secret World of Opus Dei</em>, Corgi, 2006</p>
      <p>Walsh, Michael — <em>Opus Dei: An Investigation into the Powerful Secretive Society within the Catholic Church</em>, HarperCollins, 2004</p>
      <p>Escrivá, Josemaría — <em>The Way</em> (Camino), 1939</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-escriva-portrait.jpg'),
        title: 'Opus Dei',
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
