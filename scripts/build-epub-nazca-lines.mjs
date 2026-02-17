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
  title: 'The Nazca Lines',
  subtitle: 'The Desert That Drew Itself',
  author: 'HistorIQly',
  series: 'Vol. 10: Archaeological Mysteries',
  slug: 'nazca-lines',
  description:
    'On a sun-scorched plateau in southern Peru, ancient hands scraped away the desert surface to reveal something astonishing: hundreds of enormous figures — birds, spiders, monkeys, whales — visible only from the sky. This is the story of the lines, the woman who saved them, and the question that still haunts archaeology: why would anyone draw pictures that only gods could see?',
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
  hero: imgFileUrl('hero-nazca-lines-aerial.jpg'),
  hummingbird: imgFileUrl('nazca-hummingbird-aerial.jpg'),
  spider: imgFileUrl('nazca-spider-aerial.jpg'),
  monkey: imgFileUrl('nazca-monkey-aerial.jpg'),
  condor: imgFileUrl('nazca-condor-aerial.jpg'),
  astronaut: imgFileUrl('nazca-astronaut-hillside.jpg'),
  reiche: imgFileUrl('figure-maria-reiche.jpg'),
  pampa: imgFileUrl('nazca-pampa-overview.jpg'),
  pottery: imgFileUrl('nazca-pottery-vessel.jpg'),
  tree: imgFileUrl('nazca-tree-hands.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Red Plain': figureHtml(
    images.pampa,
    'Aerial view of the Nazca pampa desert plateau',
    'The Pampa Colorada — the Red Plain — stretching across 450 square kilometres of coastal desert in southern Peru. The dark, iron-oxide-coated pebble surface conceals the lighter subsoil beneath, forming the canvas for the world\'s largest gallery of geoglyphs.'
  ),
  'The View from Above': figureHtml(
    images.hummingbird,
    'Aerial photograph of the Nazca hummingbird geoglyph',
    'The Hummingbird — 93 metres long, one of the most iconic of the Nazca geoglyphs. Paul Kosok first photographed the figures from the air in 1940, calling the pampa "the largest astronomy book in the world."'
  ),
  'The Lady of the Lines': figureHtml(
    images.reiche,
    'Maria Reiche, the Lady of the Lines',
    'Maria Reiche (1903–1998), the German mathematician who devoted fifty years to studying and protecting the Nazca Lines. Her advocacy was instrumental in the 1994 UNESCO World Heritage designation.'
  ),
  'The Builders': figureHtml(
    images.pottery,
    'Nazca polychrome pottery vessel',
    'Nazca polychrome pottery — among the most technically accomplished ceramics of the pre-Columbian Americas. The Nazca used at least twelve distinct colours, applying mineral-based slips before firing.'
  ),
  'The Sacred Pathways': figureHtml(
    images.spider,
    'Aerial photograph of the Nazca spider geoglyph',
    'The Spider — 47 metres of precise anatomical detail, identified as a member of the genus Ricinulei, found only in the Amazon rainforest. Astronomer Phyllis Pitluga argued it represents an anamorphic diagram of the constellation Orion.'
  ),
  'Chariots and Charlatans': figureHtml(
    images.astronaut,
    'The Nazca astronaut or owl-man figure on a hillside',
    'The so-called "Astronaut" — a 30-metre humanoid figure etched into a hillside. Despite its nickname, the figure predates any concept of spaceflight by two millennia. It was Erich von Däniken\'s star witness for the extraterrestrial hypothesis.'
  ),
  'The Lines Speak': figureHtml(
    images.monkey,
    'Aerial photograph of the Nazca monkey geoglyph',
    'The Monkey — with its distinctive nine-coiled spiral tail, stretching across 93 metres of desert floor. By 2025, AI-assisted drone surveys had identified 893 geoglyphs on the pampa, nearly doubling the previously known total.'
  ),
  'The Desert Remembers': figureHtml(
    images.condor,
    'Aerial photograph of the Nazca condor geoglyph',
    'The Condor — 134 metres from beak to tail, wings outstretched across the desert surface. The Nazca Lines were designated a UNESCO World Heritage Site in 1994, recognised as "a unique and magnificent artistic achievement unrivalled anywhere in the prehistoric world."'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/nazca-lines.ts');
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
  <p class="epigraph">"The largest astronomy book in the world."</p>
  <p class="epigraph-attr">— Paul Kosok, 1941</p>
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
      <p><strong>c. 400–200 BCE</strong> — The Paracas culture creates the earliest geoglyphs on the Nazca pampa, including the cat figure discovered in 2020 — the oldest known geoglyph at the site.</p>
      <p><strong>c. 200 BCE – 500 CE</strong> — The Nazca civilisation creates the majority of the geoglyphs during eight centuries of cultural activity. Over 800 straight lines, 300 geometric designs, and 70+ animal and plant figures are etched into the desert surface.</p>
      <p><strong>c. 500 CE</strong> — The Nazca construct the <em>puquio</em> underground aqueduct system. Researchers documented forty-three puquios near Nazca, of which more than thirty still carry water today.</p>
      <p><strong>c. 500–750 CE</strong> — The Nazca civilisation declines and collapses, likely due to a catastrophic El Niño event compounded by deforestation of the Huarango tree.</p>
      <p><strong>1553</strong> — Spanish chronicler Pedro Cieza de León publishes the first written mention of the lines, describing them as trail markers.</p>
      <p><strong>1927</strong> — Peruvian archaeologist Toribio Mejía Xesspe spots the lines while hiking through the foothills — the first modern scholarly observation. He interprets them as ancient ritual pathways (<em>ceques</em>).</p>
      <p><strong>1940–1941</strong> — American historian Paul Kosok conducts the first aerial surveys. On June 22, 1941 — the winter solstice — he observes lines converging at the sunset point and calls the pampa "the largest astronomy book in the world."</p>
      <p><strong>1946</strong> — German mathematician Maria Reiche begins her lifelong study and preservation of the lines. She will devote fifty years to the work, sweeping the desert surface by hand to keep the figures visible.</p>
      <p><strong>1949</strong> — Reiche publishes <em>The Mystery on the Desert</em>, proposing that the lines form an astronomical calendar.</p>
      <p><strong>1968</strong> — Erich von Däniken publishes <em>Chariots of the Gods?</em>, claiming the lines were alien landing strips. The book sells over 30 million copies and transforms the Nazca Lines into a global pop-culture phenomenon.</p>
      <p><strong>1973</strong> — Astronomer Gerald Hawkins tests the astronomical alignment theory by computer analysis of 186 lines and finds no statistically significant pattern.</p>
      <p><strong>1985</strong> — Anthropologist Johan Reinhard proposes the water/fertility cult theory: the lines were sacred pathways for rituals petitioning mountain gods for rain.</p>
      <p><strong>1990s</strong> — Anthony Aveni conducts the most comprehensive survey of the lines to date. Confirms insufficient evidence for the astronomical theory, but finds clear correlation between lines and water features.</p>
      <p><strong>1994</strong> — The "Lines and Geoglyphs of Nasca and Palpa" are designated a UNESCO World Heritage Site.</p>
      <p><strong>1998 (June 8)</strong> — Maria Reiche dies in Lima at age ninety-five. Her home in Nazca is converted into a museum.</p>
      <p><strong>2014 (December)</strong> — Greenpeace activists damage the hummingbird geoglyph during a protest at a UN climate conference, leaving footprints across 1,600 square metres of protected ground.</p>
      <p><strong>2018 (January)</strong> — A truck driver drives his rig off the Pan-American Highway and across the pampa, damaging three geoglyphs over a 50-by-100-metre area.</p>
      <p><strong>2020 (October)</strong> — The cat geoglyph is discovered during hillside renovation — the oldest known figure, dated to 200–100 BCE, attributed to the Paracas culture.</p>
      <p><strong>2024 (September)</strong> — Yamagata University and IBM announce 303 new figurative geoglyphs discovered using AI in just six months, nearly doubling the known total.</p>
      <p><strong>2025</strong> — Total known geoglyphs reaches 893, with 781 identified through AI and aerial-image analysis.</p>
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
      <p>Aveni, Anthony F. — <em>Between the Lines: The Mystery of the Giant Ground Drawings of Ancient Nasca, Peru</em>, University of Texas Press, 2000</p>
      <p>Reiche, Maria — <em>The Mystery on the Desert</em>, 1949 (reprinted 1968)</p>
      <p>Reinhard, Johan — <em>The Nasca Lines: A New Perspective on Their Origin and Meaning</em>, Editorial Los Pinos, 1996</p>
      <p>Silverman, Helaine & Proulx, Donald — <em>The Nasca</em>, Blackwell, 2002</p>
      <p>Lambers, Karsten — <em>The Geoglyphs of Palpa, Peru</em>, Forschungen zur Archäologie Außereuropäischer Kulturen, 2006</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-nazca-lines-aerial.jpg'),
        title: 'The Nazca\nLines',
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
