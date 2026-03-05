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
  title: 'The Tunguska Event',
  subtitle: 'The Explosion That Shook the World',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained',
  slug: 'tunguska-event',
  description:
    'On June 30, 1908, an explosion a thousand times more powerful than the Hiroshima bomb flattened 80 million trees across 830 square miles of Siberian wilderness. No crater was found. No fragments were recovered. For over a century, scientists, conspiracy theorists, and dreamers have argued over what fell from the sky that morning — and why it left almost no trace.',
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
  hero: imgFileUrl('hero-tunguska-fallen-trees.jpg'),
  devastation: imgFileUrl('atmosphere-tunguska-devastation.jpg'),
  river: imgFileUrl('atmosphere-tunguska-river.jpg'),
  vanavara: imgFileUrl('atmosphere-tunguska-vanavara.jpg'),
  evenki: imgFileUrl('atmosphere-evenki-tent.jpg'),
  blastCenter: imgFileUrl('evidence-tunguska-blast-center.png'),
  effectAreas: imgFileUrl('evidence-tunguska-effect-areas.png'),
  map: imgFileUrl('evidence-tunguska-map.png'),
  kulik: imgFileUrl('figure-leonid-kulik.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Morning the Sky Broke': figureHtml(
    images.evenki,
    'Evenki (Tungus) reindeer herders with their summer tent',
    'Evenki reindeer herders with a traditional summer tent, or chum. The Shanyagir clan of the Evenki were the closest witnesses to the explosion, losing reindeer, shelters, and everything they needed for survival.'
  ),
  'A World in Turmoil': figureHtml(
    images.kulik,
    'Leonid Alekseyevich Kulik, Soviet mineralogist',
    'Leonid Kulik (1883–1942), the Soviet mineralogist who became the first scientist to investigate the Tunguska blast zone. He led expeditions in 1927, 1928, 1929–30, and 1938, and died in a German prisoner-of-war camp during World War II.'
  ),
  'Into the Dead Forest': figureHtml(
    images.hero,
    'Fallen trees at the Tunguska blast site, photographed by Kulik expedition in 1927',
    'Fallen trees at the Tunguska blast site, photographed during Leonid Kulik\'s 1927 expedition. The trees lie in radial rows, all pointing away from the epicentre — the signature of an aerial explosion. Nineteen years after the event, the devastation was still absolute.'
  ),
  'The Search for Fragments': figureHtml(
    images.blastCenter,
    'The centre of the Tunguska blast zone showing standing dead trees',
    'The centre of the blast zone, where trees were stripped of branches but left standing — evidence that the explosion occurred directly overhead. Kulik expected to find an impact crater here but found only marshy bog.'
  ),
  'Comet or Asteroid': figureHtml(
    images.effectAreas,
    'Map showing the Tunguska event effect areas and tree-fall patterns',
    'The butterfly-shaped pattern of destruction at Tunguska, revealed by Kulik\'s 1938 aerial survey. The asymmetric shape indicates the object entered the atmosphere at an oblique angle, from the southeast.'
  ),
  'The Lake at the Edge of the World': figureHtml(
    images.river,
    'The Podkamennaya Tunguska River from a helicopter',
    'The Podkamennaya Tunguska River, viewed from the air. The river gave the event its name and served as the primary route for scientific expeditions into the blast zone.'
  ),
  'The Forest Remembers': figureHtml(
    images.devastation,
    'The Tunguska blast zone showing the scale of devastation',
    'The vast scale of the Tunguska devastation. An estimated 80 million trees were flattened across 2,150 square kilometres — an area slightly larger than the city of London.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/tunguska-event.ts');
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
  <p class="epigraph">"The sky split in two and fire appeared high and wide over the forest. At that moment I became so hot that I couldn't bear it, as if my shirt was on fire."</p>
  <p class="epigraph-attr">— S.B. Semenov, eyewitness at Vanavara Trading Post, 65 km from the epicentre</p>
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
      <p><strong>June 30, 1908</strong> — At approximately 7:17 a.m. local time, an object enters the atmosphere over central Siberia and explodes at an altitude of 5–10 km above the Podkamennaya Tunguska River basin. The explosion releases energy equivalent to 10–15 megatons of TNT, flattening 80 million trees across 2,150 square kilometres. The Evenki Shanyagir clan, camped 20 km from the epicentre, lose reindeer, shelters, and supplies.</p>
      <p><strong>June 30 – July 3, 1908</strong> — Anomalously bright nights are observed across Europe and Western Russia. People in London and Stockholm can read newspapers at midnight. Scientists attribute the phenomenon to unusual atmospheric conditions; the connection to Siberia is not made.</p>
      <p><strong>1908</strong> — Seismographs across Eurasia record the event as a magnitude 5.0 earthquake. Barographic stations around the world detect the atmospheric pressure wave, which circles the earth twice. The Irkutsk Observatory records the disturbance but no scientific investigation is launched.</p>
      <p><strong>1921</strong> — Leonid Kulik, a mineralogist at the Mineralogical Museum in Petrograd, leads a preliminary survey to the Tunguska region as part of a broader meteorite inventory for the Soviet Academy of Sciences. He gathers local accounts but does not reach the blast zone.</p>
      <p><strong>1927</strong> — Kulik reaches the epicentre for the first time, finding a vast radial field of fallen trees and a zone of stripped, standing trunks at the centre — but no crater and no meteorite fragments. He takes the photographs that will make the event internationally famous.</p>
      <p><strong>1928–1930</strong> — Kulik leads two more expeditions, establishing a semi-permanent camp and attempting to drain boggy depressions in search of meteorite material. He finds nothing but peat, mud, and undisturbed soil.</p>
      <p><strong>1930</strong> — British astronomer Francis Whipple proposes the comet hypothesis: the object was composed of ice and dust that vaporised completely on entry, explaining the absence of fragments.</p>
      <p><strong>1938</strong> — Kulik's final expedition. He charters a reconnaissance plane and takes over 1,500 aerial photographs, revealing the butterfly-shaped destruction pattern for the first time.</p>
      <p><strong>1942</strong> — Kulik dies of typhus in a German prisoner-of-war camp during World War II, aged 58.</p>
      <p><strong>1946</strong> — Soviet engineer Alexander Kazantsev publishes a short story proposing that the Tunguska explosion was caused by the crash of an alien nuclear-powered spacecraft. The theory becomes a cultural sensation.</p>
      <p><strong>1960s–1970s</strong> — Soviet scientists discover microscopic silicate and magnetite spherules in the blast zone soil, consistent with extraterrestrial material from a stony body.</p>
      <p><strong>1973</strong> — Physicists Jackson and Ryan propose the mini black hole hypothesis in <em>Nature</em>. It is widely discussed but ultimately rejected.</p>
      <p><strong>1983</strong> — Astronomer Zdeněk Sekanina publishes a critique of the comet hypothesis, arguing a cometary body would disintegrate at too high an altitude.</p>
      <p><strong>1995</strong> — The Tunguska Nature Reserve is established, protecting much of the original blast zone.</p>
      <p><strong>2001</strong> — Luigi Foschini's orbital modelling study concludes with 83% probability that the object followed an asteroidal orbit.</p>
      <p><strong>2007</strong> — Italian team led by Luca Gasperini proposes Lake Cheko as a possible impact crater.</p>
      <p><strong>2013 (February 15)</strong> — A 20-metre asteroid explodes over Chelyabinsk, Russia, injuring ~1,500 people. It is the largest airburst since Tunguska and demonstrates the ongoing asteroid threat.</p>
      <p><strong>2016</strong> — The United Nations designates June 30 as International Asteroid Day.</p>
      <p><strong>2017</strong> — Russian researchers refute the Lake Cheko impact hypothesis, dating the lake's sediments to at least 280 years before the event.</p>
      <p><strong>2022</strong> — NASA's DART mission successfully alters the orbit of asteroid Dimorphos, demonstrating planetary defence technology.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; atmospheric detail and some scene-setting are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Baxter, John & Atkins, Thomas — <em>The Fire Came By: The Riddle of the Great Siberian Explosion</em>, Doubleday, 1976</p>
      <p>Krinov, E.L. — <em>Giant Meteorites</em>, Pergamon Press, 1966</p>
      <p>Gallant, Roy A. — <em>The Day the Sky Split Apart: Investigating a Cosmic Mystery</em>, Atheneum, 1995</p>
      <p>Rubtsov, Vladimir — <em>The Tunguska Mystery</em>, Springer, 2009</p>
      <p>NASA — "115 Years Ago: The Tunguska Asteroid Impact Event," nasa.gov, 2023</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-tunguska-fallen-trees.jpg'),
        title: 'The Tunguska\nEvent',
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
