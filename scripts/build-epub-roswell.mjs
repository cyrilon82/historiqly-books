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
  title: 'Roswell, 1947',
  subtitle: 'The Crash That Launched a Conspiracy',
  author: 'HistorIQly',
  series: 'Vol. 5: Conspiracies',
  slug: 'roswell',
  description:
    'In the summer of 1947, something crashed on a remote New Mexico ranch. The military said it was a flying saucer — then said it wasn\'t. This is the true story of the Roswell incident: the debris, the witnesses, the cover-up, and the conspiracy that refuses to die.',
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
  newspaper: imgFileUrl('hero-roswell-newspaper-1947.jpg'),
  rameyMemo: imgFileUrl('evidence-ramey-memo.jpg'),
  marcelDebris: imgFileUrl('evidence-marcel-debris.jpg'),
  rameyDebris: imgFileUrl('evidence-ramey-debris.jpg'),
  mogulBalloon: imgFileUrl('evidence-mogul-balloon.png'),
  crashMap: imgFileUrl('location-roswell-crash-map.jpg'),
  marcel: imgFileUrl('suspect-jesse-marcel.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Something on the Range': figureHtml(images.crashMap, 'Map of the Roswell crash site locations, 1947', 'Map showing the locations associated with the Roswell incident: the debris field on the Foster Ranch, approximately 75 miles northwest of Roswell, and the Roswell Army Air Field to the south.'),
  'The Debris Field': figureHtml(images.marcelDebris, 'Major Jesse Marcel posing with debris in General Ramey\'s office, Fort Worth, July 8, 1947', 'Major Jesse Marcel holding pieces of the debris displayed in General Ramey\'s office at Fort Worth Army Air Field. Marcel later claimed the material shown in the photographs was not what he had recovered from the ranch — that a substitution had been made before the cameras arrived.'),
  'The Retraction': figureHtml(images.rameyDebris, 'Brigadier General Roger Ramey with the weather balloon debris, Fort Worth, July 8, 1947', 'General Ramey poses with the debris identified as a weather balloon and radar reflector in his Fort Worth office. Note the crumpled aluminum foil and dark rubber — materials consistent with a standard weather balloon, but inconsistent with the extraordinary debris described by Marcel and other witnesses.'),
  'Thirty Years of Silence': figureHtml(images.marcel, 'Major Jesse Marcel, intelligence officer of the 509th Bomb Group', 'Jesse Marcel, the intelligence officer at Roswell Army Air Field who first examined the debris. Marcel maintained for the rest of his life that the material he recovered was unlike anything manufactured on Earth and that the weather balloon story was a deliberate cover-up.'),
  'Project Mogul': figureHtml(images.mogulBalloon, 'Diagram of a Project Mogul balloon train assembly, USAF 1995', 'A Project Mogul balloon train consisted of twenty to thirty individual weather balloons strung on a vertical line extending up to 600 feet, with ML-307 radar reflectors and instrument packages interspersed along its length. The Air Force identified this classified program as the source of the Roswell debris.'),
  'Believers and Skeptics': figureHtml(images.rameyMemo, 'General Ramey holding what appears to be a memo, Fort Worth, July 8, 1947', 'In this photograph, General Ramey holds what appears to be a folded piece of paper — the so-called "Ramey memo." Researchers have spent decades attempting to enhance and read the text, which some believe contains references to the recovery of "victims" and a "disc."'),
  'Disclosure': figureHtml(images.newspaper, 'The Roswell Daily Record front page, July 8, 1947', 'The front page of the Roswell Daily Record, July 8, 1947, carrying the headline that would become the most famous in UFO history: "RAAF Captures Flying Saucer On Ranch in Roswell Region." The story was retracted the following day.'),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/roswell.ts');
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
  <p class="epigraph">"Something happened near Roswell in 1947. I know it; I was there."</p>
  <p class="epigraph-attr">— Walter Haut, public information officer, 509th Bomb Group</p>
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
      <p><strong>June 14, 1947</strong> — Mac Brazel discovers debris on the Foster Ranch.</p>
      <p><strong>June 24, 1947</strong> — Kenneth Arnold reports nine "flying saucers" near Mount Rainier, coining the term.</p>
      <p><strong>July 6, 1947</strong> — Brazel brings debris samples to Sheriff Wilcox in Roswell.</p>
      <p><strong>July 7, 1947</strong> — Major Marcel and Captain Cavitt examine the debris field.</p>
      <p><strong>July 8, 1947 (AM)</strong> — Colonel Blanchard orders a press release: "RAAF Captures Flying Saucer."</p>
      <p><strong>July 8, 1947 (PM)</strong> — General Ramey holds a press conference in Fort Worth, identifying the debris as a weather balloon.</p>
      <p><strong>July 9, 1947</strong> — Brazel gives a retraction interview to the Roswell Daily Record.</p>
      <p><strong>July 10–14, 1947</strong> — Military cleanup of the Foster Ranch debris field.</p>
      <p><strong>1947–1978</strong> — Thirty years of silence. The Roswell incident is forgotten.</p>
      <p><strong>1978</strong> — Stanton Friedman interviews Jesse Marcel, reviving the case.</p>
      <p><strong>1980</strong> — <em>The Roswell Incident</em> by Berlitz and Moore is published.</p>
      <p><strong>1991</strong> — International UFO Museum and Research Center opens in Roswell.</p>
      <p><strong>1994</strong> — Air Force releases "The Roswell Report," attributing debris to Project Mogul.</p>
      <p><strong>1995</strong> — Ray Santilli releases the "alien autopsy" film (later admitted to be staged).</p>
      <p><strong>1997</strong> — Air Force releases "Case Closed" report, attributing body claims to crash test dummies.</p>
      <p><strong>2005</strong> — Walter Haut's posthumous affidavit is made public, claiming he saw alien bodies.</p>
      <p><strong>2017</strong> — New York Times reveals the Pentagon's Advanced Aerospace Threat Identification Program.</p>
      <p><strong>2023</strong> — David Grusch testifies before Congress about government retrieval of "non-human" craft.</p>
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
      <p>Berlitz, Charles & Moore, William — <em>The Roswell Incident</em>, Grosset & Dunlap, 1980</p>
      <p>Randle, Kevin & Schmitt, Donald — <em>UFO Crash at Roswell</em>, Avon Books, 1991</p>
      <p>Pflock, Karl — <em>Roswell: Inconvenient Facts and the Will to Believe</em>, Prometheus Books, 2001</p>
      <p>Carey, Thomas & Schmitt, Donald — <em>Witness to Roswell</em>, New Page Books, 2009</p>
      <p>US Air Force — <em>The Roswell Report: Fact versus Fiction in the New Mexico Desert</em>, 1994</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-roswell-newspaper-1947.jpg'),
        title: 'Roswell,\n1947',
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
