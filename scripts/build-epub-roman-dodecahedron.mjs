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
  title: 'The Roman Dodecahedron',
  subtitle: 'The Object That Defied an Empire',
  author: 'HistorIQly',
  series: 'Vol. 10: Archaeology',
  slug: 'roman-dodecahedron',
  description:
    'Across the northwestern provinces of the Roman Empire, archaeologists have unearthed more than a hundred and thirty small, hollow bronze objects — twelve-sided, riddled with holes, studded with knobs. No Roman text mentions them. After eighteen hundred years and fifty proposed theories, nobody knows what they were for.',
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
  heroBronze: imgFileUrl('hero-roman-dodecahedron-bronze.jpg'),
  heroTongeren: imgFileUrl('hero-roman-dodecahedron-tongeren.jpg'),
  corbridge: imgFileUrl('evidence-roman-dodecahedron-corbridge.jpg'),
  tongerenCloseup: imgFileUrl('evidence-roman-dodecahedron-tongeren-closeup.jpg'),
  lyon: imgFileUrl('evidence-roman-dodecahedron-lyon.jpg'),
  strasbourgMultiple: imgFileUrl('evidence-roman-dodecahedron-strasbourg-multiple.jpg'),
  bonn: imgFileUrl('evidence-roman-dodecahedron-bonn.jpg'),
  krefeld: imgFileUrl('evidence-roman-dodecahedron-krefeld.jpg'),
  nortonDisney: imgFileUrl('location-roman-dodecahedron-norton-disney.jpg'),
  stuttgart: imgFileUrl('roman-dodecahedron-stuttgart.jpg'),
  lyonCollection: imgFileUrl('roman-dodecahedron-lyon-collection.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Dig at Potter Hill': figureHtml(
    images.nortonDisney,
    'The Norton Disney dodecahedron',
    'The Norton Disney dodecahedron — the thirty-third found in Britain, discovered during a controlled excavation in Lincolnshire in 2023. One of the largest and most finely made examples ever recovered.'
  ),
  'A Field Called Hagdale': figureHtml(
    images.heroTongeren,
    'Roman dodecahedron at the Gallo-Roman Museum in Tongeren, Belgium',
    'A Roman dodecahedron on display at the Gallo-Roman Museum in Tongeren, Belgium — one of the finest collections of Gallo-Roman artefacts in Europe.'
  ),
  'Twelve Faces, Twenty Knobs': figureHtml(
    images.tongerenCloseup,
    'Close-up of a Roman dodecahedron showing pentagonal faces and vertex knobs',
    'Close-up showing the distinctive features: pentagonal faces pierced by circular holes of varying diameter, concentric decorative rings, and the characteristic knobs at each of the twenty vertices.'
  ),
  'The Frontier World': figureHtml(
    images.corbridge,
    'Roman dodecahedron from Corbridge, near Hadrian\'s Wall',
    'A dodecahedron from Corbridge Roman Town, near Hadrian\'s Wall — the northernmost complete example found in Britain.'
  ),
  'The Theory Wars': figureHtml(
    images.strasbourgMultiple,
    'Multiple Roman dodecahedra at the Strasbourg Archaeological Museum',
    'Multiple dodecahedra displayed together at the Strasbourg Archaeological Museum, illustrating the variation in size and decoration across specimens.'
  ),
  "The Philosopher's Shape": figureHtml(
    images.bonn,
    'Roman dodecahedron and icosahedron at the Rheinisches Landesmuseum, Bonn',
    'A dodecahedron displayed alongside a Roman icosahedron at the Rheinisches Landesmuseum in Bonn — two of the five Platonic solids rendered in bronze by Gallo-Roman craftsmen.'
  ),
  'The Graves and the Hoards': figureHtml(
    images.krefeld,
    'Roman dodecahedron from Museum Burg Linn, Krefeld',
    'A dodecahedron from Museum Burg Linn in Krefeld, Germany. A specimen from this region was found in a fourth-century grave alongside the remains of a bone staff.'
  ),
  'Made in Bronze': figureHtml(
    images.heroBronze,
    'Roman dodecahedron in bronze showing fine craftsmanship',
    'A finely preserved bronze dodecahedron. The exterior is polished smooth while the interior retains the rough texture of the lost-wax casting — evidence that the outside was meant to be seen and handled.'
  ),
  'The Enduring Enigma': figureHtml(
    images.lyonCollection,
    'Collection of Roman dodecahedra at the Lyon Gallo-Roman Museum',
    'A collection of dodecahedra of varying sizes at the Lyon Gallo-Roman Museum, France. After eighteen hundred years and more than fifty proposed theories, their purpose remains unknown.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/roman-dodecahedron.ts');
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
  <p class="epigraph">"It's hard to believe that we have anything from the Roman period that we don't know what it's for."</p>
  <p class="epigraph-attr">— Lorena Hitchens, Newcastle University</p>
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
      <p><strong>1739 (June 28)</strong> — First recorded Roman dodecahedron presented to the Society of Antiquaries of London by "Mr. North." Found in a field called Hagdale, Aston, Hertfordshire, alongside copper coins. This specimen is now lost.</p>
      <p><strong>1st–4th century CE</strong> — Period of manufacture. Most dodecahedra date to the 2nd–4th centuries, with the majority from the 3rd–4th centuries. They are found exclusively in the northwestern provinces of the Roman Empire: Britain, Gaul, Germania, and the Danube frontier.</p>
      <p><strong>1800s–1900s</strong> — Dozens of dodecahedra discovered across Belgium, France, Germany, the Netherlands, Switzerland, Austria, and Hungary as railway construction and urban expansion expose Roman-era deposits.</p>
      <p><strong>1913</strong> — Clement Reid publishes <em>Submerged Forests</em>, one of the earliest systematic studies of Romano-British landscapes, providing context for frontier archaeology.</p>
      <p><strong>1939</strong> — A dodecahedron found in a 4th-century grave in Krefeld, Germany — the grave of a wealthy woman, alongside the remains of a bone staff. The Gallo-Roman Museum in Tongeren acquires its specimen.</p>
      <p><strong>1995</strong> — A unique dodecahedron with two elliptical holes discovered at Jublains (ancient Noviodunum), France.</p>
      <p><strong>2012</strong> — Amelia Carolina Sparavigna publishes two papers proposing the "dioptron" (rangefinder) theory, arguing the dodecahedra were optical distance-measuring instruments.</p>
      <p><strong>2023 (Summer)</strong> — The Norton Disney History and Archaeology Group discovers a remarkably well-preserved dodecahedron at Potter Hill, Lincolnshire — the 33rd found in Britain, the first in the Midlands. Supervised by Allen Archaeology.</p>
      <p><strong>2023</strong> — A deliberately broken dodecahedron fragment found near Kortessem, Belgium, by metal detectorist Patrick Schuermans. Flanders Heritage Agency confirms deliberate fracture.</p>
      <p><strong>2024 (January)</strong> — Norton Disney dodecahedron featured on BBC2's <em>Digging for Britain</em> (Season 11, Episode 4). Story goes viral worldwide.</p>
      <p><strong>2024</strong> — XRF analysis by archaeometallurgist Gerry McDonnell reveals the Norton Disney specimen is leaded gunmetal: 63–75% copper, 18–27% lead, 7–8% tin.</p>
      <p><strong>2025 (February)</strong> — Masashi Ishihara publishes a new theory: the dodecahedra as timekeeping devices using controlled burning of tallow or wax.</p>
      <p><strong>2025–2026</strong> — Norton Disney dodecahedron exhibited at Lakeside Arts Centre, Nottingham. Further excavation planned at Potter Hill.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a work of narrative non-fiction based on documented archaeological finds, published research, and expert commentary. All facts, dates, and quotations are grounded in primary sources and scholarly publications.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Hitchens, Lorena — dodecahedragirl.org — comprehensive catalogue and analysis of known Roman dodecahedra</p>
      <p>Sparavigna, Amelia Carolina — "Roman Dodecahedron as Dioptron" and "A Roman Dodecahedron for Measuring Distance," arXiv, 2012</p>
      <p>Wagemans, G.M.C. — romandodecahedron.com — agricultural calendar hypothesis</p>
      <p>Norton Disney History and Archaeology Group — nortondisneyhag.org</p>
      <p>English Heritage — "The Corbridge Dodecahedron" exhibition, Corbridge Roman Town</p>
      <p>"The Gallo-Roman Dodecahedron and the Receptacle of All Becoming," <em>The Antiquaries Journal</em>, Cambridge University Press</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-roman-dodecahedron-bronze.jpg'),
        title: 'The Roman\nDodecahedron',
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
