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
  title: 'The Antikythera Mechanism',
  subtitle: "The Ancient Computer That Shouldn't Exist",
  author: 'HistorIQly',
  series: 'Vol. 10: Archaeological Mysteries',
  slug: 'antikythera-mechanism',
  description:
    'In 1901, sponge divers hauled a corroded lump of bronze from a Roman shipwreck off a tiny Greek island. It took a century to understand what they had found: a 2,000-year-old computer that could predict eclipses, track the planets, and calculate the timing of the Olympic Games. Nothing like it would be built again for a thousand years.',
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
  hero: imgFileUrl('hero-antikythera-mechanism.jpg'),
  fragmentBack: imgFileUrl('evidence-antikythera-fragment-back.jpg'),
  closeup: imgFileUrl('evidence-antikythera-closeup.jpg'),
  price: imgFileUrl('figure-derek-de-solla-price.jpg'),
  island: imgFileUrl('atmosphere-antikythera-island.jpg'),
  nama: imgFileUrl('evidence-antikythera-mechanism-nama.jpg'),
  rearDial: imgFileUrl('evidence-antikythera-rear-dial.jpg'),
  modelFront: imgFileUrl('evidence-antikythera-model-front.jpg'),
  modelClockface: imgFileUrl('evidence-antikythera-model-clockface.jpg'),
  fragments: imgFileUrl('evidence-antikythera-fragments.jpg'),
  museumDisplay: imgFileUrl('evidence-antikythera-museum-display.jpg'),
  gearsDetail: imgFileUrl('evidence-antikythera-gears-detail.jpg'),
  inscriptions: imgFileUrl('evidence-antikythera-inscriptions.jpg'),
  museum: imgFileUrl('location-national-archaeological-museum-athens.jpg'),
  ephebe: imgFileUrl('figure-antikythera-ephebe.jpg'),
  diverHelmet: imgFileUrl('atmosphere-sponge-diver-helmet.jpg'),
  xray: imgFileUrl('evidence-antikythera-xray.jpg'),
  corroded: imgFileUrl('evidence-antikythera-corroded.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Storm': figureHtml(
    images.diverHelmet,
    'A traditional Greek sponge diver\'s helmet from Symi',
    'A traditional copper diving helmet of the type used by Greek sponge divers at the turn of the twentieth century. Elias Stadiatis was wearing equipment like this when he descended sixty metres to the seabed off Antikythera and discovered the wreck that would change the history of archaeology.'
  ),
  'The Lump': figureHtml(
    images.hero,
    'The largest fragment of the Antikythera mechanism (Fragment A)',
    'Fragment A of the Antikythera mechanism — the largest surviving piece, showing the main drive gear and clusters of smaller wheels visible through two millennia of corrosion. When Valerios Stais spotted a gear wheel in a crack in the encrustation in 1902, he was met with disbelief. The ancient Greeks were not supposed to build machines like this.'
  ),
  'Gears from the Greeks': figureHtml(
    images.price,
    'Derek de Solla Price, physicist and historian of science',
    'Derek de Solla Price (1922–1983), the British-American physicist who first recognized the Antikythera mechanism as an ancient computer. His 1974 monograph <em>Gears from the Greeks</em> transformed a museum curiosity into one of the most significant archaeological discoveries of the twentieth century.'
  ),
  'The Machine': figureHtml(
    images.modelFront,
    'A modern reconstruction of the Antikythera mechanism showing the front dial',
    'A modern working reconstruction of the Antikythera mechanism. The front dial displays the zodiac and Egyptian calendar rings. A hand crank on the side drives the gear train, advancing the date and moving pointers for the sun, moon, and planets through their celestial cycles.'
  ),
  'Fragment A': figureHtml(
    images.gearsDetail,
    'Detailed view of the Antikythera mechanism\'s gear wheels',
    'The internal gear wheels of the Antikythera mechanism, revealed through careful conservation. At least thirty-seven interlocking bronze gears transmitted motion from a single hand crank to multiple output dials, encoding the Metonic cycle, the Saros eclipse cycle, and the motions of the sun, moon, and planets.'
  ),
  'The Cosmos in Bronze': figureHtml(
    images.inscriptions,
    'Greek inscriptions on the surface of the Antikythera mechanism',
    'Greek inscriptions on the mechanism\'s surface, revealed by advanced imaging technology. Over three thousand characters of text were discovered — a user manual explaining how to operate the device and interpret its astronomical displays. Some characters are barely 1.2 millimetres tall.'
  ),
  'The Maker': figureHtml(
    images.fragments,
    'Multiple fragments of the Antikythera mechanism',
    'The eighty-two surviving fragments of the Antikythera mechanism. The device broke apart during the shipwreck or during its two thousand years on the seafloor. Each fragment has been meticulously catalogued, photographed, and CT-scanned to reveal its hidden structure.'
  ),
  'The Ghost in the Gears': figureHtml(
    images.museumDisplay,
    'The Antikythera mechanism on display at the National Archaeological Museum in Athens',
    'The Antikythera mechanism in its display case at the National Archaeological Museum in Athens. After more than a century of study, the device continues to challenge our understanding of what ancient civilisations were capable of building — and what else may have been lost.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/antikythera-mechanism.ts');
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
  <p class="epigraph">"The mechanism is like a great astronomical clock... or like a modern analogue computer which uses mechanical parts to save tedious calculation."</p>
  <p class="epigraph-attr">— Derek de Solla Price, <em>Gears from the Greeks</em>, 1974</p>
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
      <p><strong>c. 205 BCE</strong> — Earliest date encoded in the mechanism's eclipse predictions (Saros dial start epoch). This likely reflects the astronomical data available to the device's designers.</p>
      <p><strong>c. 150–100 BCE</strong> — Estimated date of manufacture, based on the style of the Greek inscriptions, the letter forms, and the Corinthian calendar system used on the Metonic dial.</p>
      <p><strong>c. 70–60 BCE</strong> — The Roman cargo ship carrying the mechanism sinks in a storm in the strait between Crete and the Peloponnese, near the island of Antikythera. The ship was carrying Greek art, luxury goods, bronze and marble statues, glassware, coins, and jewellery — almost certainly bound for Rome.</p>
      <p><strong>1900 (October)</strong> — Greek sponge divers from the island of Symi, led by Captain Dimitrios Kondos, shelter from a storm near Antikythera. Diver Elias Stadiatis descends to the seabed and discovers the wreck, initially mistaking the bronze and marble statues for human corpses.</p>
      <p><strong>1900–1901</strong> — A salvage operation, supervised by the Greek government and archaeologists from the National Museum in Athens, recovers statues, pottery, coins, jewellery, and a corroded lump of bronze that is catalogued and stored without further examination.</p>
      <p><strong>1902 (May 17)</strong> — Greek archaeologist Valerios Stais examines the corroded lump and notices a gear wheel visible through a crack in the encrustation. He proposes the object is an astronomical calculating device. Scholars dismiss the idea.</p>
      <p><strong>1905–1920s</strong> — German philologist Albert Rehm identifies Greek inscriptions on the fragments, including astronomical terms and numbers. His findings attract little attention.</p>
      <p><strong>1951</strong> — British physicist and historian of science Derek de Solla Price encounters the mechanism during research at Cambridge and begins a decades-long investigation.</p>
      <p><strong>1959</strong> — Price publishes "An Ancient Greek Computer" in <em>Scientific American</em>, the first presentation of the mechanism to a general audience. The paper causes a sensation.</p>
      <p><strong>1971</strong> — Price arranges for the fragments to be X-rayed using gamma radiography, revealing internal gear wheels invisible to the naked eye.</p>
      <p><strong>1974</strong> — Price publishes <em>Gears from the Greeks</em>, the first comprehensive analysis of the mechanism. He identifies at least thirty gears and shows that the device modelled the motions of the sun and moon.</p>
      <p><strong>1983</strong> — Derek de Solla Price dies at age sixty-one.</p>
      <p><strong>1990s–2000s</strong> — Michael Wright, curator at the Science Museum in London, builds working models of the mechanism and proposes that it included planetary displays.</p>
      <p><strong>2005</strong> — The Antikythera Mechanism Research Project, led by Mike Edmunds and Tony Freeth of Cardiff University, uses Hewlett-Packard surface imaging and a custom eight-tonne CT scanner (built by X-Tek/Nikon) to produce three-dimensional images of the fragments at fifty-micron resolution.</p>
      <p><strong>2006</strong> — The team publishes results revealing over 3,000 characters of Greek inscriptions, the pin-and-slot lunar anomaly mechanism, the Saros and Exeligmos eclipse dials, and the Games dial showing the cycle of Panhellenic athletic festivals including the Olympics.</p>
      <p><strong>2008–2016</strong> — Continued research reveals planetary inscriptions, the Corinthian calendar, connections to Rhodes and the astronomical tradition of Hipparchus, and additional details of the mechanism's functions.</p>
      <p><strong>2012–2014</strong> — New underwater excavations at the Antikythera shipwreck site recover additional artefacts but no further mechanism fragments.</p>
      <p><strong>2021</strong> — Tony Freeth and a team at University College London publish a paper in <em>Scientific Reports</em> proposing a complete reconstruction of the mechanism's front dial, including all five planetary displays. The reconstruction represents the most comprehensive model of the mechanism to date.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Price, Derek de Solla — <em>Gears from the Greeks: The Antikythera Mechanism — A Calendar Computer from ca. 80 B.C.</em>, Science History Publications, 1974</p>
      <p>Freeth, Tony et al. — "Decoding the Ancient Greek Astronomical Calculator Known as the Antikythera Mechanism," <em>Nature</em>, 2006</p>
      <p>Freeth, Tony et al. — "A Model of the Cosmos in the Ancient Greek Antikythera Mechanism," <em>Scientific Reports</em>, 2021</p>
      <p>Marchant, Jo — <em>Decoding the Heavens: A 2,000-Year-Old Computer and the Century-Long Search to Discover Its Secrets</em>, Da Capo Press, 2009</p>
      <p>Jones, Alexander — <em>A Portable Cosmos: Revealing the Antikythera Mechanism, Scientific Wonder of the Ancient World</em>, Oxford University Press, 2017</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-antikythera-mechanism.jpg'),
        title: 'The Antikythera\nMechanism',
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
