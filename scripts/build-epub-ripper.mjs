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
  title: 'Jack the Ripper',
  subtitle: 'The Autumn of Terror',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'jack-the-ripper',
  description: 'In the autumn of 1888, five women were murdered in the dark streets of London\'s East End. The killer was never caught. This is the full story — the victims, the investigation, the suspects, and the mystery that has never been solved.',
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
  hero: imgFileUrl('hero-nemesis-of-neglect.jpg'),
  dorset: imgFileUrl('atmosphere-dorset-street-1902.jpg'),
  suspicious: imgFileUrl('atmosphere-suspicious-figure-1888.jpg'),
  outcasts: imgFileUrl('atmosphere-outcasts-whitechapel-1888.jpg'),
  nichols: imgFileUrl('victim-mary-ann-nichols.jpg'),
  stride: imgFileUrl('victim-elizabeth-stride.jpg'),
  kelly: imgFileUrl('victim-mary-jane-kelly-sketch.jpg'),
  dearBoss: imgFileUrl('evidence-dear-boss-letter.jpg'),
  fromHell: imgFileUrl('evidence-from-hell-letter.jpg'),
  policeNotice: imgFileUrl('evidence-police-notice-1888.jpg'),
  ipnChapman: imgFileUrl('evidence-illustrated-police-news-chapman.jpg'),
  map: imgFileUrl('map-whitechapel-murders.jpg'),
  abberline: imgFileUrl('figure-inspector-abberline.jpg'),
  warren: imgFileUrl('figure-sir-charles-warren.jpg'),
  lusk: imgFileUrl('figure-george-lusk.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  "Buck's Row": figureHtml(images.nichols, 'Mary Ann Nichols, period illustration', 'Mary Ann "Polly" Nichols, the first canonical victim. On August 31, 1888, she was turned away from her lodging house for lacking fourpence. Her body was found in Buck\'s Row shortly before 4 a.m.'),
  "The Abyss": figureHtml(images.ipnChapman, 'The Illustrated Police News, September 22, 1888', 'The front page of The Illustrated Police News after Annie Chapman\'s murder. The penny press turned Whitechapel into front-page news across the nation.'),
  "The Double Event": figureHtml(images.map, 'Map of the Whitechapel murders, 1894 Ordnance Survey', 'An annotated map of the Whitechapel murder sites. The canonical five victims were killed within a half-mile radius — a dense, dark warren of alleys, courts, and lodging houses.'),
  "Dear Boss": figureHtml(images.dearBoss, 'The "Dear Boss" letter, September 25, 1888', 'The "Dear Boss" letter, dated September 25, 1888. Written in red ink, it coined the name "Jack the Ripper" — arguably the most effective criminal alias ever created.'),
  "Miller's Court": figureHtml(images.dorset, 'Dorset Street, Spitalfields, photographed in 1902', 'Dorset Street, Spitalfields — known as "the worst street in London." Mary Jane Kelly was murdered in a small room at 13 Miller\'s Court, accessed through a narrow passage off this street.'),
  "The Investigators": figureHtml(images.abberline, 'Inspector Frederick Abberline', 'Inspector Frederick Abberline, the lead detective on the Whitechapel murders. He had served fourteen years in the East End and knew its streets, its people, and its criminal underworld better than any man at Scotland Yard.'),
  "The Suspects": figureHtml(images.fromHell, 'The "From Hell" letter, October 16, 1888', 'The "From Hell" letter, sent to George Lusk with half a human kidney. Unlike the "Dear Boss" letter, many researchers consider this the only potentially genuine communication from the killer.'),
  "The Name": figureHtml(images.hero, 'The Nemesis of Neglect, Punch magazine, September 29, 1888', 'The iconic Punch magazine cartoon from September 29, 1888 — a phantom stalking the alleys of Whitechapel. The image captured what the name "Jack the Ripper" would soon make permanent: the terror of an invisible killer in the heart of the world\'s greatest city.'),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/jack-the-ripper.ts');
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
  <p class="epigraph">"The murderer in external appearance is quite likely to be a quiet inoffensive looking man probably middle-aged and neatly and respectably dressed."</p>
  <p class="epigraph-attr">— Dr. Thomas Bond, November 10, 1888</p>
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
      <p><strong>August 31, 1888</strong> — Mary Ann "Polly" Nichols is found murdered in Buck's Row, Whitechapel, at approximately 3:40 a.m. Her throat has been cut twice and her abdomen mutilated. She is later identified as the first of the "canonical five" victims.</p>
      <p><strong>September 8, 1888</strong> — Annie Chapman is found dead in the backyard of 29 Hanbury Street, Spitalfields. The killer has removed her uterus and part of her bladder.</p>
      <p><strong>September 25, 1888</strong> — The Central News Agency receives the "Dear Boss" letter, written in red ink and signed "Jack the Ripper." It is the first use of the name that will become the most infamous criminal alias in history.</p>
      <p><strong>September 30, 1888</strong> — The "Double Event." Elizabeth Stride is found murdered in Dutfield's Yard, off Berner Street, at approximately 1:00 a.m. Less than an hour later, Catherine Eddowes is found in Mitre Square, her abdomen torn open and her left kidney removed.</p>
      <p><strong>September 30, 1888</strong> — A piece of Catherine Eddowes' apron is found in Goulston Street with a chalked message above it. Sir Charles Warren orders the message erased before it can be photographed.</p>
      <p><strong>October 1, 1888</strong> — The "Saucy Jacky" postcard arrives at the Central News Agency, referencing the "double event" before the details are public knowledge.</p>
      <p><strong>October 16, 1888</strong> — George Lusk receives a small cardboard box containing half a preserved human kidney and a letter beginning "From hell."</p>
      <p><strong>November 9, 1888</strong> — Mary Jane Kelly is found murdered in her room at 13 Miller's Court, off Dorset Street. The mutilations are by far the most extreme. Kelly is the last of the canonical five.</p>
      <p><strong>November 10, 1888</strong> — Dr. Thomas Bond submits his profile of the likely murderer — one of the earliest criminal profiles in history.</p>
      <p><strong>November 8, 1888</strong> — Sir Charles Warren resigns as Commissioner of the Metropolitan Police, the day before the Kelly murder.</p>
      <p><strong>1892</strong> — Inspector Frederick Abberline retires from the Metropolitan Police. He never publicly names a suspect.</p>
      <p><strong>1894</strong> — Sir Melville Macnaghten writes a confidential memorandum naming three prime suspects: Montague John Druitt, Michael Ostrog, and Aaron Kosminski.</p>
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
      <p>Sugden, Philip — <em>The Complete History of Jack the Ripper</em>, Robinson, 1994/2002</p>
      <p>Begg, Paul — <em>Jack the Ripper: The Definitive History</em>, Pearson, 2003</p>
      <p>Evans, Stewart and Skinner, Keith — <em>The Ultimate Jack the Ripper Sourcebook</em>, Robinson, 2001</p>
      <p>Rumbelow, Donald — <em>The Complete Jack the Ripper</em>, Penguin, 1975/2004</p>
      <p>Rubenhold, Hallie — <em>The Five: The Untold Lives of the Women Killed by Jack the Ripper</em>, Doubleday, 2019</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-nemesis-of-neglect.jpg'),
        title: 'Jack the\nRipper',
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
