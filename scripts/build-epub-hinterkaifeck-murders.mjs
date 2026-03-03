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
  title: 'The Hinterkaifeck Murders',
  subtitle: 'The Farm That Swallowed Six Souls',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'hinterkaifeck-murders',
  description:
    'In March 1922, six people were bludgeoned to death on a remote Bavarian farmstead. Someone stayed for days afterward — feeding the livestock, lighting fires, eating from the kitchen. Over a century later, nobody knows who killed the Gruber family or why. This is the story of Germany\'s most infamous unsolved crime.',
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
  hero: imgFileUrl('hero-hinterkaifeck-farm.jpg'),
  farmAlternate: imgFileUrl('hinterkaifeck-farm-alternate.jpg'),
  landSurvey: imgFileUrl('hinterkaifeck-land-survey-map.jpg'),
  memorial: imgFileUrl('hinterkaifeck-memorial.jpg'),
  mattock: imgFileUrl('hinterkaifeck-mattock.png'),
  schrobenhausen: imgFileUrl('hinterkaifeck-schrobenhausen-1917.jpg'),
  inscription: imgFileUrl('hinterkaifeck-inscription.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Footprints': figureHtml(
    images.hero,
    'The Hinterkaifeck farmstead photographed in 1922',
    'The Hinterkaifeck farmstead, photographed from the south in April 1922 by Andreas Biegleder. This isolated farm, hidden behind forest about a kilometre north of Kaifeck, was the scene of one of Germany\'s most infamous unsolved crimes.'
  ),
  'The Discovery': figureHtml(
    images.mattock,
    'A mattock — the type of agricultural tool used as the murder weapon',
    'A mattock (Reuthaue) — the type of heavy agricultural tool used to kill all six victims at Hinterkaifeck. The actual murder weapon was found hidden in the attic a year later when the farm was demolished in 1923.'
  ),
  'The Aftermath': figureHtml(
    images.landSurvey,
    'Historical land survey map of the Hinterkaifeck property',
    'A Bavarian land survey map showing the Hinterkaifeck property and surrounding land parcels. The farm was built around 1863 and demolished in 1923. Note the nearby "Hexenholz" (Witch Wood) — the forest from which the mysterious footprints emerged.'
  ),
  'The Family': figureHtml(
    images.farmAlternate,
    'Alternate photograph of the Hinterkaifeck farmstead',
    'An earlier photograph of the isolated Hinterkaifeck farmstead. The single-storey complex comprised a residential building and stable forming an L-shape with the barn — connected by the narrow passage through which each victim was lured to their death.'
  ),
  'The Suspects': figureHtml(
    images.schrobenhausen,
    'Schrobenhausen, Bavaria — the nearest town to Hinterkaifeck, photographed in 1917',
    'A 1917 postcard of Schrobenhausen, the nearest town to Hinterkaifeck, about six kilometres south of the farm. The professional investigators had to travel from Munich, seventy kilometres away, by which time the crime scene had been irreparably contaminated.'
  ),
  'The Silence': figureHtml(
    images.inscription,
    'Close-up of the memorial inscription listing the six victims',
    'The memorial inscription at the site of the former Hinterkaifeck farmstead, listing all six victims: Andreas Gruber (1857), Cäzilia Gruber (1849), Viktoria Gabriel (1887), Cäzilia Gabriel (1915), Josef Gabriel (1919), and Maria Baumgartner (1877).'
  ),
  'The Farm That Remains': figureHtml(
    images.memorial,
    'The memorial shrine (Marterl) near the site of Hinterkaifeck',
    'The Marterl — a traditional Bavarian wayside shrine — erected near the former site of Hinterkaifeck. The inscription reads: "By godless murderer\'s hand, on March 31, 1922, the Gabriel-Gruber family of this place fell victim."'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/hinterkaifeck-murders.ts');
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
  <p class="epigraph">"By godless murderer's hand, on March 31, 1922, the Gabriel-Gruber family of this place fell victim."</p>
  <p class="epigraph-attr">— Memorial inscription at Hinterkaifeck</p>
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
      <p><strong>~1863</strong> — The Hinterkaifeck farmstead is constructed in a secluded location about one kilometre north of the hamlet of Kaifeck, in the municipality of Waidhofen, Bavaria.</p>
      <p><strong>1907–1910</strong> — Andreas Gruber begins a sexual relationship with his daughter Viktoria. The abuse continues for years.</p>
      <p><strong>1914</strong> — Viktoria marries Karl Gabriel. Karl is reported killed in action in France on December 29, 1914, during the early months of World War I. His body is never recovered.</p>
      <p><strong>May 28, 1915</strong> — The district court in Neuburg convicts Andreas and Viktoria Gruber of incest. Andreas is sentenced to one year in prison; Viktoria receives a shorter sentence.</p>
      <p><strong>1919</strong> — Viktoria gives birth to her son Josef. She tells her lover, Lorenz Schlittenbauer, that the child was fathered by her own father. Schlittenbauer agrees to acknowledge paternity.</p>
      <p><strong>Late 1921</strong> — Maid Kreszenz Rieger quits, citing strange noises in the attic and a belief that the house is haunted.</p>
      <p><strong>Late March 1922</strong> — Andreas discovers footprints in the snow leading from the forest to the machine room, but none leading away. A Munich newspaper appears on the property. A household key goes missing. Strange sounds are heard in the attic.</p>
      <p><strong>Friday, March 31, 1922 (afternoon)</strong> — New maid Maria Baumgartner arrives at the farm. Her sister escorts her and leaves — the last outsider to see the family alive.</p>
      <p><strong>Friday, March 31, 1922 (evening)</strong> — Six people are murdered with a mattock. Four are killed in the barn; two in the house.</p>
      <p><strong>April 1–3, 1922</strong> — Someone remains at the farm, feeding livestock, eating food, and lighting fires. Neighbours see smoke rising from the chimney. Young Cäzilia misses school. The family misses church. Mail accumulates.</p>
      <p><strong>Tuesday, April 4, 1922</strong> — Lorenz Schlittenbauer, with neighbours Michael Pöll and Jakob Sigl, discovers the six bodies. Dozens of people trample the crime scene before investigators arrive from Munich.</p>
      <p><strong>1923</strong> — The farmstead is demolished. During demolition, a blood-caked mattock is found hidden in the attic. A penknife is found in the barn hay.</p>
      <p><strong>1922–1950s</strong> — Multiple investigations are conducted. Over 100 suspects are questioned. The victims' skulls are sent to Munich for examination by forensic experts and clairvoyants. No arrest is made.</p>
      <p><strong>1941</strong> — Lorenz Schlittenbauer, the primary suspect, dies without ever being charged.</p>
      <p><strong>1955</strong> — The case is officially closed by Bavarian police.</p>
      <p><strong>2006</strong> — Andrea Maria Schenkel publishes <em>Tannöd</em>, a fictionalized novel based on the case. It sells over one million copies and wins the German Crime Prize.</p>
      <p><strong>November 11, 2007</strong> — Police Academy students at Fürstenfeldbruck release their cold-case analysis. They identify a primary suspect but decline to name him out of respect for living descendants. They conclude the case will never be definitively solved.</p>
      <p><strong>Present</strong> — The victims' skulls, lost during World War II, have never been recovered. The six headless bodies rest in the Waidhofen cemetery. The case remains officially unsolved.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources, police records, court documents, and investigative journalism; scene detail and interior perspectives are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Schenkel, Andrea Maria — <em>Tannöd</em> (The Murder Farm), Nautilus, 2006</p>
      <p>James, Bill — <em>The Man from the Train</em>, Scribner, 2017</p>
      <p>Bavarian State Archives — Hinterkaifeck Investigation Files</p>
      <p>Fürstenfeldbruck Police Academy — Cold Case Analysis Report, 2007</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-hinterkaifeck-farm.jpg'),
        title: 'The Hinterkaifeck\nMurders',
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
