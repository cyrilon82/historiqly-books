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
  title: 'The Black Dahlia',
  subtitle: 'Hollywood\'s Most Haunting Cold Case',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'black-dahlia',
  description:
    'On a January morning in 1947, a young mother walking with her daughter through a quiet Los Angeles neighborhood mistook a pale shape in a vacant lot for a store mannequin. It was the bisected body of Elizabeth Short — and the beginning of the most infamous unsolved murder in American history.',
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
  portrait: imgFileUrl('hero-black-dahlia-portrait.jpg'),
  mugshot: imgFileUrl('black-dahlia-mugshot.jpg'),
  fbi: imgFileUrl('black-dahlia-fbi-mugshot-fingerprints.jpg'),
  biltmore: imgFileUrl('black-dahlia-biltmore-hotel.jpg'),
  norton: imgFileUrl('black-dahlia-norton-avenue.jpg'),
  hodel: imgFileUrl('suspect-george-hodel.jpg'),
  sowden: imgFileUrl('black-dahlia-sowden-house.jpg'),
  sowdenGate: imgFileUrl('black-dahlia-sowden-house-gate.jpg'),
  hollywood: imgFileUrl('hero-black-dahlia-hollywood-1940s.jpg'),
  bulletin: imgFileUrl('black-dahlia-lapd-bulletin.png'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Girl from Medford': figureHtml(
    images.mugshot,
    'Elizabeth Short\'s mugshot, Santa Barbara, 1943',
    'Elizabeth Short, age nineteen, photographed by the Santa Barbara Police Department after her arrest for underage drinking on September 23, 1943. This mugshot — and the fingerprints taken that day — would be the key to identifying her body four years later.'
  ),
  'The Black Dahlia': figureHtml(
    images.hollywood,
    'Hollywood Boulevard, looking toward Vine Street, circa 1940s',
    'Hollywood in the 1940s: neon signs, palm trees, and the promise of stardom. Elizabeth Short arrived in this city of angels chasing a dream that would never materialize.'
  ),
  'The Last Week': figureHtml(
    images.biltmore,
    'The Biltmore Hotel, Los Angeles, circa 1940s',
    'The Biltmore Hotel in downtown Los Angeles, where Elizabeth Short was last seen alive on the evening of January 9, 1947. She was dropped off in the lobby by Robert \'Red\' Manley at approximately 6:30 p.m. Staff saw her using the lobby telephone. She was seen leaving via the Olive Street exit around 10:00 p.m.'
  ),
  'The Vacant Lot': figureHtml(
    images.norton,
    'The 3800 block of South Norton Avenue, Leimert Park, Los Angeles',
    'The 3800 block of South Norton Avenue as it appears today. The vacant lot where Elizabeth Short\'s body was discovered on January 15, 1947 is now occupied by residential housing.'
  ),
  'The Avenger': figureHtml(
    images.bulletin,
    'LAPD Police Bulletin for Elizabeth Short, January 15, 1947',
    'The LAPD police bulletin distributed on January 15, 1947, the day Elizabeth Short\'s body was discovered. Her fingerprints were transmitted to the FBI via the \'Soundphoto\' system and matched to her 1943 arrest record within hours.'
  ),
  'The Suspects': figureHtml(
    images.hodel,
    'Dr. George Hodel, circa 1950',
    'Dr. George Hill Hodel, the most compelling suspect in the Black Dahlia case. A prominent Los Angeles physician, Hodel lived in the architecturally famous Sowden House and was caught on an LAPD wiretap saying: \'Supposin\' I did kill the Black Dahlia. They couldn\'t prove it now.\''
  ),
  'The Case That Will Never Die': figureHtml(
    images.sowden,
    'The Sowden House, 5121 Franklin Avenue, Los Feliz',
    'The Sowden House, designed by Lloyd Wright in the Mayan Revival style. George Hodel\'s residence during the late 1940s. His son Steve, a retired LAPD homicide detective, believes the murder was committed here.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/black-dahlia.ts');
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
  <p class="epigraph">"It is not the least of the case's many ironies that the one person who was never allowed to speak — the victim — is the only one whose name everyone remembers."</p>
  <p class="epigraph-attr">— Piu Eatwell, <em>Black Dahlia, Red Rose</em>, 2017</p>
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
      <p><strong>July 29, 1924</strong> — Elizabeth Short is born in Hyde Park, Boston, Massachusetts, the third of five daughters.</p>
      <p><strong>1930</strong> — Elizabeth's father, Cleo Short, stages his suicide and abandons the family during the Great Depression.</p>
      <p><strong>December 1942</strong> — Elizabeth, now eighteen, moves to Vallejo, California, to reunite with her father. He throws her out within weeks.</p>
      <p><strong>1943</strong> — Elizabeth works at Camp Cooke (now Vandenberg AFB). Her fingerprints are placed on file with the FBI. In September, she is arrested in Santa Barbara for underage drinking.</p>
      <p><strong>Mid-1946</strong> — Elizabeth returns to Los Angeles. She lives in a rented room behind the Florentine Gardens nightclub on Hollywood Boulevard. Patrons at a Long Beach drugstore begin calling her "The Black Dahlia."</p>
      <p><strong>January 9, 1947</strong> — Robert "Red" Manley drops Elizabeth at the Biltmore Hotel at 6:30 p.m. She is seen leaving via the Olive Street exit around 10:00 p.m. This is the last confirmed sighting of Elizabeth Short alive.</p>
      <p><strong>January 10–14, 1947</strong> — The "missing week." Elizabeth Short's whereabouts during these six days remain entirely unknown.</p>
      <p><strong>January 15, 1947</strong> — Betty Bersinger discovers Elizabeth's bisected body in a vacant lot on South Norton Avenue in Leimert Park, Los Angeles. The body has been completely exsanguinated, washed clean, and deliberately posed.</p>
      <p><strong>January 24, 1947</strong> — A gasoline-washed manila envelope arrives at the Los Angeles Examiner containing Elizabeth's birth certificate, social security card, photographs, and Mark Hansen's address book with pages torn out.</p>
      <p><strong>January 26, 1947</strong> — A handwritten letter arrives: "Here it is. Turning in Wed., Jan. 29, 10 am. Had my fun at police. Black Dahlia Avenger."</p>
      <p><strong>1949–1950</strong> — LAPD investigates Dr. George Hodel. A wiretap captures him saying: "Supposin' I did kill the Black Dahlia. They couldn't prove it now."</p>
      <p><strong>1949</strong> — A Los Angeles County Grand Jury convenes to investigate the LAPD's failure to solve the case.</p>
      <p><strong>1999</strong> — George Hodel dies at age 91. His son Steve, a retired LAPD homicide detective, begins investigating.</p>
      <p><strong>2003</strong> — Steve Hodel publishes <em>Black Dahlia Avenger</em>, presenting evidence that his father was the killer.</p>
      <p><strong>Present</strong> — The case remains officially open and unsolved with the LAPD. No arrest has ever been made.</p>
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
      <p>Hodel, Steve — <em>Black Dahlia Avenger: A Genius for Murder</em>, Arcade Publishing, 2003</p>
      <p>Ellroy, James — <em>The Black Dahlia</em> (novel), Mysterious Press, 1987</p>
      <p>Eatwell, Piu — <em>Black Dahlia, Red Rose: The Crime, Corruption, and Cover-Up of America's Greatest Unsolved Murder</em>, Liveright, 2017</p>
      <p>Gilmore, John — <em>Severed: The True Story of the Black Dahlia Murder</em>, Zanja Press, 1994</p>
      <p>FBI — "Black Dahlia (Elizabeth Short)," The Vault, vault.fbi.gov</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-black-dahlia-portrait.jpg'),
        title: 'The Black\nDahlia',
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
