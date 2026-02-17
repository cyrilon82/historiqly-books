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
  title: 'The Horned Helmet',
  subtitle: 'How an Opera Costume Fooled the World',
  author: 'HistorIQly',
  series: 'Vol. 2: Historical Myths Debunked',
  slug: 'viking-horned-helmets',
  description:
    'The horned Viking helmet is one of history\'s most iconic images — and one of its biggest lies. Only one complete Viking helmet has ever been found, and it has no horns. This is the story of the poets, painters, and opera costumes that invented an image so powerful it overwrote a thousand years of history.',
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
  hero: imgFileUrl('hero-gjermundbu-helmet.jpg'),
  museum: imgFileUrl('gjermundbu-helmet-museum.jpg'),
  vekso: imgFileUrl('vekso-bronze-age-helmets.jpg'),
  oseberg: imgFileUrl('oseberg-tapestry-detail.jpg'),
  wagner: imgFileUrl('suspect-wagner.jpg'),
  malmstromValhalla: imgFileUrl('malmstrom-valhalla.jpg'),
  tegner: imgFileUrl('suspect-tegner.jpg'),
  bayreuth: imgFileUrl('bayreuth-rheingold-1876.jpg'),
  walkure: imgFileUrl('ring-cycle-walkure.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Helmet': figureHtml(
    images.hero,
    'The Gjermundbu helmet — the only complete Viking Age helmet ever found',
    'The Gjermundbu helmet, discovered in 1943 in Ringerike, Norway. Dated to 950–975 AD, it is the only complete Viking Age helmet in existence. It is a plain iron cap with a spectacle guard. No horns.'
  ),
  'The Romantics': figureHtml(
    images.tegner,
    'Esaias Tegnér, Swedish poet and bishop',
    'Esaias Tegnér (1782–1846), whose epic poem <em>Frithiof\'s Saga</em> became the most famous Swedish literary work of the nineteenth century. His romanticised Viking world demanded dramatic visual illustration — and illustrators obliged.'
  ),
  'The Artist': figureHtml(
    images.malmstromValhalla,
    'Valhalla by August Malmström, 1880',
    'August Malmström\'s <em>Valhalla</em> (1880). Malmström illustrated editions of Tegnér\'s saga with Vikings wearing horned helmets — an image conjured from imagination, not archaeology. His paintings defined what millions believed Vikings looked like.'
  ),
  'The Ring': figureHtml(
    images.bayreuth,
    'The first Bayreuth Festival staging of Das Rheingold, 1876',
    'The staging of <em>Das Rheingold</em> at the inaugural Bayreuth Festival, August 1876. Carl Emil Doepler\'s costume designs for Wagner\'s Ring Cycle gave Valkyries winged helmets and Hunding horned ones — images that became synonymous with Vikings.'
  ),
  'The Horns Before the Horns': figureHtml(
    images.vekso,
    'The Viksø helmets at the National Museum of Denmark, Copenhagen',
    'The Viksø helmets, displayed at the National Museum of Denmark. These Bronze Age helmets (~900 BC) are the most famous "Viking" horned helmets — but they predate the Vikings by nearly two thousand years. The confusion between Bronze Age and Viking Age has fuelled the myth for decades.'
  ),
  'The Five Helmets': figureHtml(
    images.museum,
    'The Gjermundbu helmet on display at the Museum of Cultural History, Oslo',
    'The Gjermundbu helmet in its museum display. Five Viking Age helmets have been found in total — all of them plain iron, none with horns. The absence of horned helmets in the archaeological record is not a gap in the evidence. It <em>is</em> the evidence.'
  ),
  'The Detective': figureHtml(
    images.oseberg,
    'Detail of the Oseberg tapestry, c. 834 AD',
    'A fragment of the Oseberg tapestry, found in a Viking ship burial in Norway. One figure appears to wear a horned helmet in a ritual procession — evidence that Vikings knew of such headgear in ceremonial contexts, but never for battle. It was clues like this that helped scholars like Roberta Frank separate myth from reality.'
  ),
  'The Myth That Won': figureHtml(
    images.walkure,
    'Illustration of Die Walküre from Wagner\'s Ring Cycle',
    'An illustration from Wagner\'s <em>Die Walküre</em>. The Valkyries\' winged helmets morphed into horned helmets in public memory, creating the iconic image that now adorns football logos, beer bottles, and Halloween costumes from Minneapolis to Melbourne.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/viking-horned-helmets.ts');
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
  <p class="epigraph">"There is only one preserved helmet from the Viking Age and this does not have horns."</p>
  <p class="epigraph-attr">— National Museum of Denmark</p>
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
      <p><strong>~900 BC</strong> — The Viksø horned helmets are deposited in a Danish peat bog during the late Nordic Bronze Age — nearly two thousand years before the Viking Age begins.</p>
      <p><strong>800–500 BC</strong> — The Grevensvænge figurines, depicting warriors in horned helmets, are created in Bronze Age Denmark.</p>
      <p><strong>~150–50 BC</strong> — The Waterloo Helmet, a Celtic ceremonial horned helmet, is deposited in the River Thames.</p>
      <p><strong>1st century BC</strong> — Greek historian Diodorus Siculus describes Celtic warriors wearing helmets "adorned with horns." Nineteenth-century artists will later misapply this description to Vikings.</p>
      <p><strong>~834 AD</strong> — The Oseberg ship burial in Norway includes a tapestry fragment depicting a figure in what may be a horned helmet — in a ceremonial, not military, context.</p>
      <p><strong>950–975 AD</strong> — The Gjermundbu helmet is manufactured: a plain iron cap with a spectacle guard. No horns.</p>
      <p><strong>1811</strong> — The Gotiska Förbundet (Geatish Society) is founded in Sweden, launching the Romantic nationalist movement that idealises Vikings.</p>
      <p><strong>1820–1825</strong> — Swedish poet Esaias Tegnér publishes <em>Frithiof's Saga</em>, which becomes an international sensation. The poem describes an "eagle's helm" — not horns.</p>
      <p><strong>1860s–1870s</strong> — Swedish artist August Malmström illustrates editions of <em>Frithiof's Saga</em> with Vikings wearing horned helmets — images conjured from imagination, not archaeology.</p>
      <p><strong>August 13–17, 1876</strong> — The first complete Ring Cycle premieres at the Bayreuth Festival. Costume designer Carl Emil Doepler gives Valkyries winged helmets and Hunding horned ones. The myth explodes across Europe.</p>
      <p><strong>By ~1900</strong> — Horned helmets are fully synonymous with Vikings in popular culture.</p>
      <p><strong>1942</strong> — The Viksø horned helmets are discovered in a Danish bog. They are Bronze Age (~900 BC) but are widely confused with Viking artefacts.</p>
      <p><strong>1943</strong> — The Gjermundbu helmet is discovered in Norway — the only complete Viking helmet. No horns.</p>
      <p><strong>1961</strong> — The Minnesota Vikings NFL team is founded with a horned-helmet logo.</p>
      <p><strong>1973</strong> — <em>Hagar the Horrible</em> comic strip debuts, featuring a Viking in a horned helmet. It runs in 1,800+ newspapers in 58 countries.</p>
      <p><strong>2000</strong> — Yale scholar Roberta Frank publishes "The Invention of the Viking Horned Helmet," tracing the myth to the 1876 Bayreuth premiere.</p>
      <p><strong>2013</strong> — The History Channel's <em>Vikings</em> series deliberately avoids horned helmets.</p>
      <p><strong>2021</strong> — A study in <em>Praehistorische Zeitschrift</em> confirms the Viksø helmets are Bronze Age (~900 BC), with Mediterranean — not Scandinavian — origins.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a narrative investigation based on documented historical and archaeological evidence. The chronology, key figures, and factual framework are grounded in primary sources and scholarship; some narrative detail is reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Frank, Roberta — "The Invention of the Viking Horned Helmet," <em>International Scandinavian and Medieval Studies in Memory of Gerd Wolfgang Weber</em>, Edizioni Parnaso, 2000</p>
      <p>Vandkilde, Helle et al. — "The Viksø Helmets: Date, Context and Connections," <em>Praehistorische Zeitschrift</em>, 2021</p>
      <p>Williams, Gareth — "Viking Helmets," <em>British Museum Blog</em></p>
      <p>National Museum of Denmark — "Helmets" (Viking Age collection)</p>
      <p>Price, Neil — <em>The Children of Ash and Elm: A History of the Vikings</em>, Basic Books, 2020</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-gjermundbu-helmet.jpg'),
        title: 'The Horned\nHelmet',
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
