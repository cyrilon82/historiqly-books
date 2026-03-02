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
  title: 'The Iron Maiden',
  subtitle: 'The Torture Device That Never Was',
  author: 'HistorIQly',
  series: 'Vol. 2: Historical Myths Debunked',
  slug: 'iron-maiden',
  description:
    'The spiked iron cabinet known as the Iron Maiden terrified visitors to Nuremberg\'s Royal Castle for a century, was exhibited before millions at the Chicago World\'s Fair, and toured vaudeville theaters from London to New York. There is only one problem: it was never used as a torture device. The first written account appeared in 1793. The physical device was assembled around 1800. The supposed victim died in 1515. Not a single medieval document records its use. The Iron Maiden is the most famous torture device in history — and it may never have tortured anyone.',
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
  device1894: imgFileUrl('iron-maiden-nuremberg-1894.jpg'),
  interior: imgFileUrl('iron-maiden-interior.jpg'),
  catalogue: imgFileUrl('iron-maiden-exhibition-catalogue.jpg'),
  schandmantel: imgFileUrl('schandmantel.jpg'),
  hero: imgFileUrl('hero-iron-maiden.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Cabinet': figureHtml(
    images.device1894,
    'The Nuremberg Iron Maiden photographed by Schmidt and Michel, August 1894',
    'The Nuremberg Iron Maiden as photographed by Ferdinand Schmidt and A. Michel on August 11, 1894. The albumen silver prints are now held at the J. Paul Getty Museum (accession no. 84.XD.1157.1161, CC0 Public Domain). The device was assembled from disparate metalwork around 1800 and displayed as a genuine medieval artifact. It was destroyed in bombing raids on Nuremberg in 1944.'
  ),
  'The Assembler': figureHtml(
    images.schandmantel,
    'The Schandmantel — medieval cloak of shame punishment device',
    'The Schandmantel, or "cloak of shame," was a genuine medieval German punishment device: a barrel-shaped frame of wood and tin worn by petty offenders during public humiliation rituals. Professor Wolfgang Schild identified it as the probable ancestor of the iron maiden myth — a human-shaped enclosure transformed by nineteenth-century imagination from a humiliation device into an execution machine.'
  ),
  'The Grand Tour': figureHtml(
    images.catalogue,
    'Illustrated catalogue of the Nuremberg torture collection, 1890 Earl of Shrewsbury exhibition',
    'The illustrated catalogue compiled by Julius D. Ichenhauser for the Earl of Shrewsbury\'s exhibition of the Nuremberg torture collection, which toured Britain from 1890 to 1892 before crossing the Atlantic to the 1893 World\'s Columbian Exposition in Chicago. The iron maiden is described throughout as a genuine medieval artifact. The catalogue is preserved at the Wellcome Collection, London.'
  ),
  'What They Actually Did': figureHtml(
    images.hero,
    'The Iron Maiden — the device that claimed to define medieval torture',
    'The iron maiden\'s imposing exterior — human-shaped, surmounted by the Virgin Mary — was designed to be visually convincing. The interior spikes, allegedly positioned to pierce without immediately killing, represented a theatrical conception of torture that had no basis in actual medieval penal practice, which relied primarily on simple methods like strappado, the pillory, and public execution.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/iron-maiden.ts');
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
  <p class="epigraph">"Stories of iron maidens contain such wild inconsistencies and implausibilities that the most reasonable conclusion is that they are entirely fictional."</p>
  <p class="epigraph-attr">— Ronald Hutton, historian</p>
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
      <p><strong>13th century AD</strong> — The Schandmantel (cloak of shame) is in documented use across Germany as a punishment device for petty offenders: poachers, drunkards, prostitutes, quarrelsome neighbors. A barrel-shaped frame of wood and tin, worn during public humiliation. No spikes. No deaths.</p>
      <p><strong>1252 AD</strong> — Pope Innocent IV issues the papal bull <em>Ad extirpanda</em>, formally authorizing torture in Inquisition proceedings. The method prescribed is primarily strappado — a rope and a pulley. The iron maiden appears in no Inquisition document.</p>
      <p><strong>1304–1374</strong> — Francesco Petrarch coins the term "Dark Ages" to describe the gap in classical learning since Rome's fall. His darkness is literary, not moral. The concept will later be weaponized.</p>
      <p><strong>1447 AD</strong> — First documented use of the rack at the Tower of London, one of the few genuinely elaborate medieval torture instruments in the historical record.</p>
      <p><strong>4 October 1759</strong> — Johann Philipp Siebenkees born in Nuremberg. He will become a philosopher, philologist, and professor of languages at the University of Altdorf.</p>
      <p><strong>1793</strong> — Siebenkees publishes an account of a coin forger executed by iron maiden in Nuremberg on August 14, 1515. In the same year, French critic Jean-Francois de la Harpe publishes an iron maiden account set in the Spanish Inquisition. Neither writer has access to a physical device. Neither can produce their source documents.</p>
      <p><strong>25 June 1796</strong> — Johann Philipp Siebenkees dies in Altdorf at the age of thirty-six, before anyone can press him on his sources.</p>
      <p><strong>c. 1800–1802</strong> — The Nuremberg Iron Maiden first appears as a documented physical object, placed on display at the Royal Castle of Nuremberg. It is assembled from disparate metalwork components. Interior spikes are later identified as consistent with Napoleonic-era French bayonets. The story predates the object by approximately seven years.</p>
      <p><strong>Through the 19th century</strong> — The Iron Maiden becomes one of Nuremberg's most popular tourist attractions. Guidebooks describe it as an essential stop. Photographs, drawings, and postcard images circulate across Europe.</p>
      <p><strong>April 1890</strong> — The entire torture collection from the Royal Castle of Nuremberg — over 1,300 objects — is purchased by Julius D. Ichenhauser on behalf of Charles Henry John Chetwynd-Talbot, the 20th Earl of Shrewsbury and Talbot. Ichenhauser compiles an illustrated catalogue describing the iron maiden as a genuine medieval artifact.</p>
      <p><strong>1890–1892</strong> — The Nuremberg torture collection tours principal cities of Great Britain.</p>
      <p><strong>May–October 1893</strong> — The collection is displayed at the World's Columbian Exposition in Chicago, Illinois. Approximately 27 million visitors attend the exposition over six months. The iron maiden is exhibited in the Anthropological Building.</p>
      <p><strong>1894</strong> — The collection is exhibited at Koster and Bial's Music Hall, a vaudeville theater in New York City. On August 11, 1894, photographers Ferdinand Schmidt and A. Michel make albumen silver prints of the device, now held at the J. Paul Getty Museum (CC0 public domain).</p>
      <p><strong>1921</strong> — A postcard photograph of the Nuremberg Iron Maiden is made, now in the public domain.</p>
      <p><strong>1944</strong> — RAF bombing raids destroy the original Nuremberg Iron Maiden. The device assembled around 1800 is gone. What survives are copies.</p>
      <p><strong>2 January 1945</strong> — The RAF's largest single raid on Nuremberg kills more than 1,800 people and destroys the medieval Altstadt almost completely.</p>
      <p><strong>1960s</strong> — The Medieval Crime Museum in Rothenburg ob der Tauber acquires a copy of the iron maiden, made in the early 1960s as a copy of the nineteenth-century Nuremberg original. A copy of a fake.</p>
      <p><strong>1975</strong> — Iron Maiden the heavy metal band is formed in Leyton, East London. They will go on to sell more than 100 million albums, cementing the iron maiden's place in global popular consciousness beyond any scholarly correction.</p>
      <p><strong>2000</strong> — Professor Wolfgang Schild of the University of Bielefeld publishes <em>Die eiserne Jungfrau: Dichtung und Wahrheit</em> (The Iron Maiden: Fiction and Truth). Schild concludes that iron maidens across European collections were assembled from disparate artifacts in the early nineteenth century for commercial display. No medieval specimen is verified.</p>
      <p><strong>2003</strong> — Coalition forces in Baghdad report finding an iron maiden at the Iraqi National Olympic Committee headquarters, allegedly used by Uday Hussein. The myth has fully migrated from the nineteenth-century imagination into the twenty-first century.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events and published scholarly research. The chronology, key figures, and factual framework are grounded in primary sources, peer-reviewed studies, and established historical scholarship.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Schild, Wolfgang — <em>Die eiserne Jungfrau: Dichtung und Wahrheit</em>, Biberach an der Riss, 2000</p>
      <p>Hutton, Ronald — "Revisionism and Counter-Revisionism in Pagan History," <em>The Pomegranate</em>, 2011</p>
      <p>Ichenhauser, Julius D. — <em>Illustrated Catalogue of the Original Collection of Instruments of Torture from the Royal Castle of Nuremberg</em>, London, c.1890 (Wellcome Collection, digitized)</p>
      <p>Bull, Stephen — <em>An Historical Guide to Arms and Armour</em>, Facts on File, 1991</p>
      <p>Konieczny, Peter — "Medieval Torture Devices: Separating Fact from Fiction," <em>Medieval Warfare</em> magazine</p>
      <p>Innocent IV — <em>Ad extirpanda</em> (papal bull), 1252 — Authorizing torture in Inquisition proceedings; primary source for documented medieval judicial torture</p>
      <p>Schmidt, Ferdinand and Michel, A. — "Iron Maiden, Nuremberg Castle / Eiserne Jungfrau," albumen silver print, August 11, 1894. J. Paul Getty Museum, accession no. 84.XD.1157.1161 (CC0 public domain)</p>
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
        backgroundImage: resolve(IMG_DIR, 'iron-maiden-nuremberg-1894.jpg'),
        title: 'The Iron\nMaiden',
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
