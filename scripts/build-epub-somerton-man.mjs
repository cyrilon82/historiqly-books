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
  title: 'The Somerton Man',
  subtitle: 'The Cold War Mystery on an Australian Beach',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'somerton-man',
  description:
    'On December 1, 1948, a smartly dressed man was found dead on an Australian beach. He carried no wallet, no name, and no explanation. A torn scrap of paper in his pocket read "Tamám Shud" — It is finished. Seventy-four years later, science finally named him. This is the true story of the Somerton Man.',
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
  portrait: imgFileUrl('somerton-man-portrait.jpg'),
  beach: imgFileUrl('hero-somerton-man-beach.jpg'),
  tamam: imgFileUrl('evidence-tamam-shud-slip.jpg'),
  code: imgFileUrl('evidence-somerton-code.jpg'),
  suitcase: imgFileUrl('evidence-somerton-suitcase.jpg'),
  burial: imgFileUrl('somerton-man-burial.jpg'),
  grave: imgFileUrl('somerton-man-grave.jpg'),
  bust: imgFileUrl('somerton-man-bust.jpg'),
  headstone: imgFileUrl('somerton-man-headstone.jpg'),
  rubaiyat: imgFileUrl('evidence-somerton-rubaiyat.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Man on the Beach': figureHtml(
    images.beach,
    'Somerton Park beach, Adelaide — the site where the body was found',
    'Somerton Park beach near the seawall where the unidentified man was found on the morning of December 1, 1948. The Crippled Children\'s Home is visible in the background.'
  ),
  'The Autopsy': figureHtml(
    images.portrait,
    'Post-mortem photograph of the Somerton Man',
    'The Somerton Man as he appeared in death. Note the fair hair, the composed expression, and the mole near his lip. This photograph was circulated internationally in the hope that someone would recognise him. No one did.'
  ),
  'The Labels': figureHtml(
    images.suitcase,
    'Contents of the Somerton Man\'s suitcase found at Adelaide Railway Station',
    'Items recovered from the brown suitcase at Adelaide Railway Station: clothing, a stenciling brush, a modified knife, and singlets bearing the names "T. Keane" and "T. Kean." Almost all labels had been removed.'
  ),
  'Tamám Shud': figureHtml(
    images.code,
    'The mysterious code found on the back of the Rubaiyat of Omar Khayyam',
    'The five lines of unbroken code discovered under ultraviolet light on the inside back cover of the Rubáiyát. The second line is crossed out. Despite more than seventy-five years of analysis, no decryption has been universally accepted.'
  ),
  'The Nurse': figureHtml(
    images.rubaiyat,
    'The Tamám Shud slip torn from the Rubaiyat of Omar Khayyam',
    'The torn scrap of paper found in a concealed pocket in the dead man\'s trousers. The ornate typeface reads "Tamám Shud" — Persian for "It is finished." It was torn from the final page of a rare Whitcomb & Tombs edition of the Rubáiyát.'
  ),
  'The Exhumation': figureHtml(
    images.grave,
    'The Somerton Man\'s grave at West Terrace Cemetery, Adelaide',
    'The grave at West Terrace Cemetery, Adelaide, where the Somerton Man lay for over seventy years. The headstone reads: "Here lies the unknown man who was found at Somerton Beach, 1st Dec 1948." Flowers were regularly placed by unknown visitors.'
  ),
  'It Is Finished': figureHtml(
    images.bust,
    'Plaster bust of the Somerton Man',
    'The plaster bust of the Somerton Man, created in 1949 when all other identification efforts failed. Hairs embedded in the plaster during its creation would, sixty years later, provide the DNA that finally identified him as Carl "Charles" Webb.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/somerton-man.ts');
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
  <p class="epigraph">"And when Thyself with shining Foot shall pass<br/>Among the Guests Star-scatter'd on the Grass,<br/>And in thy joyous Errand reach the Spot<br/>Where I made one — turn down an empty Glass!"</p>
  <p class="epigraph-attr">— Omar Khayyám, <em>Rubáiyát</em> (trans. Edward FitzGerald, 1859)</p>
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
      <p><strong>November 16, 1905</strong> — Carl "Charles" Webb is born in Footscray, a suburb of Melbourne, Victoria.</p>
      <p><strong>October 1941</strong> — Webb marries Dorothy Jean Robertson in Melbourne. They settle in South Yarra.</p>
      <p><strong>August 1945</strong> — At the Clifton Gardens Hotel in Sydney, a young woman named Jessica Harkness (later Thomson) gives Lieutenant Alfred Boxall a copy of the <em>Rubáiyát of Omar Khayyám</em>, inscribed with a verse and signed "Jestyn."</p>
      <p><strong>April 1947</strong> — The last public record of Carl Webb. He deserts his wife and vanishes.</p>
      <p><strong>November 30, 1948, ~11:00 a.m.</strong> — A brown suitcase is checked into the cloakroom at Adelaide Railway Station.</p>
      <p><strong>November 30, 1948, ~7:00 p.m.</strong> — Jeweler John Bain Lyons and his wife observe a smartly dressed man alive on Somerton Park beach, propped against the seawall. He extends his arm, then lets it fall.</p>
      <p><strong>December 1, 1948, ~6:30 a.m.</strong> — The man is found dead in the same position. Police find no identification. All clothing labels have been removed.</p>
      <p><strong>January 14, 1949</strong> — Police discover the brown suitcase at Adelaide Railway Station. Contents include clothing with removed labels, a stenciling brush, and singlets marked "T. Keane."</p>
      <p><strong>June 1949</strong> — The "Tamám Shud" slip is discovered in a concealed fob pocket in the dead man's trousers during a re-examination of the clothing.</p>
      <p><strong>June 14, 1949</strong> — The Somerton Man is buried at West Terrace Cemetery, Adelaide.</p>
      <p><strong>Late July 1949</strong> — A man turns in a copy of the <em>Rubáiyát</em> found in his car on Jetty Road, Glenelg. The torn final page matches the slip. A mysterious code and a telephone number are found on the back cover.</p>
      <p><strong>July 1949</strong> — The phone number is traced to Jessica Thomson on Moseley Street, Glenelg — 400 meters from the death site. She denies knowing the man. Alfred Boxall is found alive in Sydney; his copy of the <em>Rubáiyát</em> is intact.</p>
      <p><strong>May 1950</strong> — Jessica marries Prosper Thomson.</p>
      <p><strong>October 1951</strong> — Dorothy Webb files for divorce from Carl Webb on grounds of desertion.</p>
      <p><strong>2007</strong> — Jessica Thomson dies.</p>
      <p><strong>2009</strong> — Robin Thomson dies.</p>
      <p><strong>2011</strong> — Professor Derek Abbott gains access to the plaster death mask; hair samples are extracted.</p>
      <p><strong>2018</strong> — The Australian Centre for Ancient DNA extracts the complete mitochondrial genome from the hair.</p>
      <p><strong>May 19, 2021</strong> — The Somerton Man's remains are exhumed from West Terrace Cemetery as part of Operation Persevere.</p>
      <p><strong>July 26, 2022</strong> — Abbott and genealogist Colleen Fitzpatrick announce the identification: the Somerton Man was Carl "Charles" Webb of Melbourne.</p>
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
      <p>Feltus, Gerald Michael — <em>The Unknown Man: A Suspicious Death at Somerton Beach</em>, Melbourne Books, 2010</p>
      <p>Abbott, Derek — "The Taman Shud Case," University of Adelaide research archive</p>
      <p>Fitzpatrick, Colleen & Abbott, Derek — "Identification of the Somerton Man," DNA Doe Project, 2022</p>
      <p>Dash, Mike — "The Body on Somerton Beach," <em>Smithsonian Magazine</em>, 2011</p>
      <p>South Australia Police — Case files, State Records of South Australia</p>
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
        backgroundImage: resolve(IMG_DIR, 'somerton-man-portrait.jpg'),
        title: 'The Somerton\nMan',
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
