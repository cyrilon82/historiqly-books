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
  title: 'The Dancing Plague of 1518',
  subtitle: 'When Strasbourg Danced to Death',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'dancing-plague',
  description:
    'In the sweltering summer of 1518, a woman stepped into a Strasbourg street and began to dance. She could not stop. Within weeks, hundreds had joined her, dancing day and night until their feet bled and their hearts gave out. This is the true story of the most bizarre epidemic in history — and the desperate city that tried everything to make it stop.',
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
  hero: imgFileUrl('hero-dancing-plague-hondius.jpg'),
  churchyard: imgFileUrl('dancing-plague-churchyard.jpg'),
  mania: imgFileUrl('dancing-mania-engraving.jpg'),
  bruegel: imgFileUrl('brueghel-pilgrimage-molenbeek.jpg'),
  color: imgFileUrl('brueghel-st-johns-dancers-color.jpg'),
  tanzwut: imgFileUrl('tanzwut-hecker-illustration.jpg'),
  map: imgFileUrl('strasbourg-map-1548.jpg'),
  vitus: imgFileUrl('st-vitus-dance-rijksmuseum.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The First Step': figureHtml(
    images.map,
    'Bird\'s eye view of Strasbourg, 1548',
    'Strasbourg as it appeared just thirty years after the dancing plague — a Free Imperial City on the Grand Île, surrounded by the Ill River, dominated by the 142-meter cathedral spire.'
  ),
  'A City Under Siege': figureHtml(
    images.churchyard,
    'Citizens of Strasbourg dancing amid graves in a churchyard, circa 1600',
    'An engraving depicting the dancers of 1518 Strasbourg, their bodies convulsing amid gravestones in a churchyard — a scene that captured the horror of a city watching its citizens dance themselves to death.'
  ),
  'The Prescription': figureHtml(
    images.hero,
    'The Pilgrimage of the Epileptics to Molenbeek, engraving by Hendrik Hondius after Pieter Bruegel the Elder',
    'Hendrik Hondius\'s 1642 engraving, based on a 1564 drawing by Pieter Bruegel the Elder, showing afflicted dancers being led to a church. The most iconic depiction of the dancing mania.'
  ),
  'The Curse of Saint Vitus': figureHtml(
    images.vitus,
    'Design for a painting of St. Vitus\'s Dance, from the Rijksmuseum',
    'A design sketch depicting St. Vitus\'s Dance — the name given to the dancing mania that the people of Strasbourg believed was a curse from the vengeful saint.'
  ),
  'The Red Shoes': figureHtml(
    images.mania,
    'The Dancing Plague — La danse de saint Guy, circa 1600',
    'An engraving of the dancing mania, showing the afflicted in the grip of a compulsion they could not control. The red shoes placed on their feet at the shrine of Saint Vitus were the only cure.'
  ),
  'Hot Blood and Laughing Veins': figureHtml(
    images.tanzwut,
    'Illustration from Hecker\'s The Dancing Mania, a Common Disease in the Middle Ages',
    'An illustration from one of the foundational medical texts about the dancing plague, showing the phenomenon that baffled physicians for centuries.'
  ),
  'A Contagion Through the Centuries': figureHtml(
    images.color,
    'The Saint John\'s Dancers in Molenbeeck, 1592, by Pieter Brueghel II',
    'Pieter Brueghel the Younger\'s vivid 1592 painting of the dancing mania — one of the few colour depictions of the phenomenon that swept medieval Europe.'
  ),
  'The Echo': figureHtml(
    images.bruegel,
    'The Dancing Mania — Pilgrimage of the Epileptics to the Church at Molenbeek, 1564, by Pieter Bruegel the Elder',
    'Pieter Bruegel the Elder\'s original 1564 drawing — the foundation for all subsequent depictions of the dancing plague. Five centuries later, the image still haunts.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/dancing-plague.ts');
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
  <p class="epigraph">"Many hundreds in Strassburg began<br/>To dance and hop, women and men,<br/>In the public market, in alleys and streets,<br/>Day and night."</p>
  <p class="epigraph-attr">— Johann Schilter, chronicler, quoting a contemporary manuscript</p>
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
      <p><strong>1515–1517</strong> — Three consecutive years of failed harvests devastate Strasbourg and the Alsace region. Famine, plague, syphilis, and floods push the population to the breaking point.</p>
      <p><strong>October 1517</strong> — Martin Luther nails his Ninety-Five Theses to the church door in Wittenberg. The resulting spiritual crisis reaches Strasbourg within weeks, shaking the foundations of Catholic authority.</p>
      <p><strong>July 14, 1518</strong> — Frau Troffea steps into a narrow street in Strasbourg and begins to dance. There is no music. She cannot stop. She dances for six consecutive days.</p>
      <p><strong>July 20, 1518</strong> — The Strasbourg city council formally notes the phenomenon. By now, 34 people are dancing involuntarily in the streets.</p>
      <p><strong>Late July 1518</strong> — City physicians diagnose "hot blood" and prescribe more dancing. The council builds wooden stages in the grain market (Kornmarkt) and horse market (Rossmarkt), hires musicians, and recruits professional dancers.</p>
      <p><strong>Early August 1518</strong> — The strategy backfires catastrophically. The public spectacle draws more dancers. At the peak, approximately 400 people are afflicted. Up to 15 people die per day from heart attacks, strokes, and exhaustion.</p>
      <p><strong>August 3, 1518</strong> — Sebastian Brant, chancellor of the city council and author of <em>The Ship of Fools</em>, records the council's reversal. Public dancing is banned until September 29. Music is restricted: only stringed instruments at private weddings, no tambourines or drums.</p>
      <p><strong>August–September 1518</strong> — The worst cases are transported by wagon on a three-day journey to the grotto shrine of Saint Vitus near Saverne, approximately 30 miles from Strasbourg. Priests perform a ritual cure: holy water, consecrated oil, and red shoes anointed with holy oil are placed on the dancers' feet.</p>
      <p><strong>September 1518</strong> — The dancing plague abates. The streets of Strasbourg fall silent.</p>
      <p><strong>1526</strong> — Paracelsus visits Strasbourg and becomes the first physician to systematically study the dancing plague. He coins the term "choreomania."</p>
      <p><strong>1564</strong> — Pieter Bruegel the Elder creates a drawing of the dancing mania, <em>The Pilgrimage of the Epileptics to the Church at Molenbeek</em>.</p>
      <p><strong>1642</strong> — Hendrik Hondius publishes his copper engraving based on Bruegel's drawing — it becomes the most iconic depiction of the dancing plague.</p>
      <p><strong>2008</strong> — John Waller publishes <em>A Time to Dance, A Time to Die</em>, the definitive modern study, arguing that mass psychogenic illness explains the plague.</p>
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
      <p>Waller, John — <em>A Time to Dance, A Time to Die: The Extraordinary Story of the Dancing Plague of 1518</em>, Icon Books, 2009</p>
      <p>Waller, John — "A forgotten plague: making sense of dancing mania," <em>The Lancet</em> 373, 2009</p>
      <p>Brant, Sebastian — Council notes of August 3, 1518 (Strasbourg city archives)</p>
      <p>Specklin, Daniel — <em>Collectanées</em> (16th-century Strasbourg chronicle)</p>
      <p>Schilter, Johann — <em>Strasbourg Chronicle</em> (17th century)</p>
      <p>Backman, Eugene Louis — <em>Religious Dances in the Christian Church and in Popular Medicine</em>, 1952</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-dancing-plague-hondius.jpg'),
        title: 'The Dancing\nPlague of 1518',
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
