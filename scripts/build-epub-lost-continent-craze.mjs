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
  title: 'The Lost Continent Craze',
  subtitle: 'Lemuria, Mu & the Science of Imaginary Worlds',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'lost-continent-craze',
  description:
    'A zoologist names a continent to explain where lemurs live. A German biologist turns it into humanity\'s cradle. A Russian mystic fills it with telepathic giants. A retired tea planter invents an entire Pacific civilization. This is the true story of how a modest scientific hypothesis became one of history\'s most persistent pseudoscientific myths — and how plate tectonics finally answered the question that started it all.',
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
  hero: imgFileUrl('hero-lemuria-map-scott-elliot.jpg'),
  haeckelMigration: imgFileUrl('haeckel-lemuria-migration.jpg'),
  blavatsky: imgFileUrl('suspect-helena-blavatsky.jpg'),
  scottElliotMap: imgFileUrl('scott-elliot-lemuria-1930.jpg'),
  lePlongeon: imgFileUrl('suspect-le-plongeon-chichen-itza.jpg'),
  churchwardMuMap: imgFileUrl('churchward-mu-map.jpg'),
  wegenerFossilMap: imgFileUrl('wegener-fossil-map.png'),
  easterIslandMoai: imgFileUrl('easter-island-moai-mana-expedition.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Paradise Lost': figureHtml(
    images.haeckelMigration,
    "Ernst Haeckel's hypothetical migration routes from Lemuria",
    "Ernst Haeckel's map showing the hypothetical migration routes of humanity from Lemuria, published in The History of Creation (1870)."
  ),
  'The Secret Doctrine': figureHtml(
    images.blavatsky,
    'Helena Petrovna Blavatsky, c. 1889',
    'Helena Petrovna Blavatsky, c. 1889 — co-founder of the Theosophical Society and architect of the Lemurian myth.'
  ),
  "The Clairvoyant's Maps": figureHtml(
    images.scottElliotMap,
    "W. Scott-Elliot's map of Lemuria",
    "W. Scott-Elliot's map of Lemuria from The Story of Atlantis and the Lost Lemuria — based on 'clairvoyant investigation' rather than evidence."
  ),
  'Queen Moo and the Mistranslation': figureHtml(
    images.lePlongeon,
    'Augustus Le Plongeon at Chichen Itza, 1875',
    'Augustus Le Plongeon at Chichen Itza, 1875. His mistranslation of Maya texts launched the myth of Mu.'
  ),
  "The Colonel's Tablets": figureHtml(
    images.churchwardMuMap,
    "James Churchward's map of Mu from The Lost Continent of Mu (1926)",
    "James Churchward's map of Mu from The Lost Continent of Mu (1926) — a Pacific civilization he claimed to have decoded from secret tablets in India."
  ),
  'The Permanence of Oceans': figureHtml(
    images.wegenerFossilMap,
    "Alfred Wegener's map showing fossil distribution across continents",
    "Alfred Wegener's map showing the distribution of identical fossils across continents — evidence that the continents themselves had moved, not sunk."
  ),
  'The Floor of the Sea': figureHtml(
    images.easterIslandMoai,
    'Moai at Rano Raraku, Easter Island',
    "Moai at Rano Raraku, Easter Island — often cited as 'evidence' of Mu, but actually the product of a sophisticated Polynesian culture."
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/lost-continent-craze.ts');
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
  <p class="epigraph">"The great tragedy of Science — the slaying of a beautiful hypothesis by an ugly fact."</p>
  <p class="epigraph-attr">— Thomas Henry Huxley</p>
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
      <p><strong>1864</strong> — Philip Sclater publishes "The Mammals of Madagascar," proposing "Lemuria" as a sunken Indian Ocean continent to explain lemur distribution.</p>
      <p><strong>1868</strong> — Ernst Haeckel declares Lemuria the "probable primeval home or 'Paradise'" of humanity in The History of Creation.</p>
      <p><strong>1870</strong> — Haeckel publishes his famous map showing twelve human races migrating outward from Lemuria.</p>
      <p><strong>1875</strong> — Helena Blavatsky founds the Theosophical Society in New York City.</p>
      <p><strong>1882</strong> — Ignatius Donnelly publishes <em>Atlantis: The Antediluvian World</em>, reviving popular interest in lost continents.</p>
      <p><strong>1885</strong> — Augustus Le Plongeon publishes <em>Sacred Mysteries Among the Mayas and Quiches</em>, introducing "Mu" based on a mistranslation of Maya texts.</p>
      <p><strong>1888</strong> — Blavatsky publishes <em>The Secret Doctrine</em>, describing Lemuria as home to a "Third Root Race" of egg-laying giants.</p>
      <p><strong>1896</strong> — W. Scott-Elliot publishes <em>The Story of Atlantis</em>, mapping Lemuria based on "clairvoyant investigation."</p>
      <p><strong>1904</strong> — Scott-Elliot publishes <em>The Lost Lemuria</em> with detailed maps of the continent's supposed geography.</p>
      <p><strong>1912</strong> — Alfred Wegener proposes continental drift at the Geological Association meeting in Frankfurt.</p>
      <p><strong>1926</strong> — James Churchward publishes <em>The Lost Continent of Mu</em>, claiming to have decoded ancient tablets describing a Pacific civilization.</p>
      <p><strong>1937</strong> — South African geologist Alexander Du Toit publishes <em>Our Wandering Continents</em>, providing extensive evidence for continental drift.</p>
      <p><strong>1960s</strong> — Discoveries of mid-ocean ridges, magnetic striping, and seafloor spreading confirm plate tectonics.</p>
      <p><strong>1968</strong> — The theory of plate tectonics achieves scientific consensus, definitively proving that ocean floors are young basalt and continents cannot sink.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a narrative non-fiction account of how a modest zoological hypothesis spiralled into one of history's most persistent pseudoscientific myths. The scientific history, biographical details, and intellectual developments described are based on published scholarship and primary sources; some scene-setting and atmospheric detail is imaginatively reconstructed.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Sclater, Philip Lutley — "The Mammals of Madagascar," <em>The Quarterly Journal of Science</em>, 1864</p>
      <p>Haeckel, Ernst — <em>The History of Creation</em>, 1868 (English translation 1876)</p>
      <p>Blavatsky, Helena Petrovna — <em>The Secret Doctrine</em>, 1888</p>
      <p>Churchward, James — <em>The Lost Continent of Mu</em>, 1926</p>
      <p>Ramaswamy, Sumathi — <em>The Lost Land of Lemuria: Fabulous Geographies, Catastrophic Histories</em>, University of California Press, 2004</p>
      <p>Oreskes, Naomi — <em>The Rejection of Continental Drift</em>, Oxford University Press, 1999</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-lemuria-map-scott-elliot.jpg'),
        title: 'The Lost Continent Craze',
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
