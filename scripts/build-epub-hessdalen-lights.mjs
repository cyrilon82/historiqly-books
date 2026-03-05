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
  title: 'The Hessdalen Lights',
  subtitle: 'The Valley That Glows in the Dark',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained',
  slug: 'hessdalen-lights',
  description:
    'In a remote Norwegian valley, mysterious lights have appeared for decades — hovering silently, pulsing with impossible energy, and defying every explanation science has offered. This is the story of the farmers who first saw them, the engineers who chased them, and the ancient geology that may have created them.',
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
  hero: imgFileUrl('hero-hessdalen-valley-winter.jpg'),
  village: imgFileUrl('hessdalen-village-winter.jpg'),
  farms: imgFileUrl('hessdalen-farms-abandoned.jpg'),
  church: imgFileUrl('hessdalen-church.jpg'),
  bridge: imgFileUrl('hessdalen-bridge-barns.jpg'),
  community: imgFileUrl('hessdalen-community-winter.jpg'),
  ballLightning1886: imgFileUrl('ball-lightning-1886-engraving.jpg'),
  plasma: imgFileUrl('water-plasma-lab.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Burning Fireball': figureHtml(
    images.village,
    'Hessdalen village in winter',
    'The Hessdalen valley in winter — a landscape of snow, silence, and scattered farmhouses where residents first reported mysterious lights in December 1981.'
  ),
  'The Valley Awakens': figureHtml(
    images.farms,
    'Abandoned farms in Hessdalen, winter',
    'Farms in the Hessdalen valley. By 1982, word of the lights had spread beyond the valley, drawing journalists, tourists, and researchers to a community of barely 150 people.'
  ),
  'Into the Darkness': figureHtml(
    images.bridge,
    'Bridge and barns in Hessdalen',
    'The valley where Erling Strand and his team spent five weeks in the deep Norwegian winter of 1984, recording 53 light observations and 30 radar echoes with borrowed equipment and volunteer labor.'
  ),
  'The Skeptic in the Snow': figureHtml(
    images.church,
    'Hessdalen church',
    'The red church of Hessdalen — a landmark in a valley that became known worldwide not for its architecture but for the unexplained lights that appeared above its mountains.'
  ),
  'The Giant Battery': figureHtml(
    images.plasma,
    'Laboratory plasma experiment',
    'Laboratory plasma generated from water — similar to the process Jader Monari demonstrated when he built a working electrochemical cell from actual Hessdalen valley rocks, proving that the geology could generate electric current.'
  ),
  'Lights of the World': figureHtml(
    images.ballLightning1886,
    'Globe of Fire, 1886 engraving',
    'An 1886 engraving depicting ball lightning entering a room. While mystery lights have been reported worldwide — from Texas to Australia — most have been debunked as car headlights or mirages. Hessdalen alone has withstood four decades of scientific scrutiny.'
  ),
  'The Valley Endures': figureHtml(
    images.community,
    'Woman and child in deep snow, Hessdalen',
    'Life in the Hessdalen valley. For more than four decades, residents have lived alongside a phenomenon that science can measure but not yet explain — the lights as much a part of the landscape as the mountains and the river.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/hessdalen-lights.ts');
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
  <p class="epigraph">"Finding scandium tells you what's burning, not why it's burning or where the energy comes from."</p>
  <p class="epigraph-attr">— Bjorn Gitle Hauge, electrical engineer, Ostfold University College</p>
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
      <p><strong>1930s</strong> — Unusual lights first reported in the Hessdalen valley, but word never leaves the tight-knit community of ~150 people. Some sources suggest reports extending back to the 1800s.</p>
      <p><strong>1981 (December 8)</strong> — Aage and Ruth Marry Moe see "a burning fireball" from their kitchen window, marking the beginning of the modern Hessdalen Lights phenomenon.</p>
      <p><strong>1981–1984</strong> — Peak wave: 15–20 sightings per week across the 12 km valley. Lights of varying colors, shapes, and behaviors reported by dozens of residents.</p>
      <p><strong>1982 (March)</strong> — Leif Havik and Arne Thomassen lead a four-day expedition, encountering six separate incidents and producing the first clear photographs of the lights.</p>
      <p><strong>1982</strong> — Erling Strand, a 27-year-old electrical engineering student, travels to the valley after reading newspaper reports. He witnesses the lights on his first night.</p>
      <p><strong>1983 (Summer)</strong> — Strand formally establishes Project Hessdalen.</p>
      <p><strong>1984 (January 21 – February 26)</strong> — Five-week scientific field campaign: 53 light observations, 30 radar echoes, highest radar-measured speed of 30,000 km/h. Laser interaction experiment produces double-flash response 8 out of 9 times.</p>
      <p><strong>1984 (February 11)</strong> — Skeptical journalist Arne Wisth witnesses the lights himself during the field campaign.</p>
      <p><strong>Post-1984</strong> — Frequency drops from 15–20/week to 10–20 verified events per year.</p>
      <p><strong>1994</strong> — First international congress on Hessdalen phenomena.</p>
      <p><strong>1995</strong> — Project EMBLA created: joint Italian-Norwegian research program.</p>
      <p><strong>1998</strong> — Automated Measurement Station (AMS) / "Blue Box" established on a farmer's hillside. Continuous automated surveillance begins.</p>
      <p><strong>2000–2002</strong> — EMBLA missions. Massimo Teodorani measures radiant power up to 19 kW (EMBLA 2002: up to 100 kW). Elevated radioactivity detected near sighting sites.</p>
      <p><strong>2004</strong> — Teodorani publishes seminal paper, the most-cited work in the Hessdalen literature.</p>
      <p><strong>2007</strong> — Bjorn Gitle Hauge's 30-second exposure photograph reveals continuous spectrum "like a solid object, or a plasma." Scandium identified via spectroscopic analysis.</p>
      <p><strong>2010</strong> — Coulomb crystal / dusty plasma hypothesis published by Paiva and Taft.</p>
      <p><strong>2014</strong> — Jader Monari's "giant battery" theory featured in New Scientist. Lab model using actual valley rocks successfully generates current.</p>
      <p><strong>2023</strong> — Two sightings documented on the same day. Erling Strand retires; Fred Pallesen takes over leadership of the project.</p>
      <p><strong>2024</strong> — Major VLF electromagnetic survey published in Journal of Applied Geophysics. Discovery of conductive sulfide zones and elliptical gabbro structure (6 x 12 km) beneath the valley.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and scientific scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Teodorani, Massimo — "A Long-Term Scientific Survey of the Hessdalen Phenomenon," <em>Journal of Scientific Exploration</em>, 2004</p>
      <p>Paiva, Gerson S.; Taft, Carlton A. — "A hypothetical dusty plasma mechanism of Hessdalen lights," <em>Journal of Atmospheric and Solar-Terrestrial Physics</em>, 2010</p>
      <p>Project Hessdalen — <em>1984 Final Technical Report</em>, hessdalen.org</p>
      <p>Monari, Jader; Serra, Romano — Electrochemical experiments with Hessdalen valley rocks, Institute of Radio Astronomy, Medicina, Italy</p>
      <p>2024 VLF Survey — "Very Low Frequency electromagnetic survey of the Hessdalen valley," <em>Journal of Applied Geophysics</em>, 2024</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-hessdalen-valley-winter.jpg'),
        title: 'The Hessdalen\nLights',
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
