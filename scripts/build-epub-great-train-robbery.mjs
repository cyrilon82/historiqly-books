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
  title: 'The Great Train Robbery',
  subtitle: "Britain's Crime of the Century",
  author: 'HistorIQly',
  series: 'Vol. 11: Heists',
  slug: 'great-train-robbery',
  description:
    'In the early hours of August 8, 1963, a gang of fifteen men stopped a Royal Mail train in the Buckinghamshire countryside and escaped with £2.6 million in used banknotes. It was the largest robbery in British history, and the manhunt that followed would captivate the nation for decades.',
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
  hero: imgFileUrl('hero-bridego-bridge-robbery-site.jpg'),
  bridgeCloseup: imgFileUrl('bridego-bridge-closeup.jpg'),
  mailtrain: imgFileUrl('mailtrain-bridego-bridge.jpg'),
  leatherslade: imgFileUrl('leatherslade-farm-buildings.jpg'),
  leathersladePath: imgFileUrl('leatherslade-farm-track.jpg'),
  cheddington: imgFileUrl('cheddington-station.jpg'),
  memorial: imgFileUrl('jack-mills-david-whitby-memorial.jpg'),
  plaque: imgFileUrl('train-robbers-bridge-plaque.jpg'),
  biggsMugshot: imgFileUrl('suspect-ronnie-biggs-mugshot.jpg'),
  reynolds: imgFileUrl('suspect-bruce-reynolds.jpg'),
  wcml: imgFileUrl('west-coast-main-line-robbery-site.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Travelling Post Office': figureHtml(
    images.mailtrain,
    'A Royal Mail train crossing Bridego Bridge',
    'A Royal Mail train crosses Bridego Bridge — the exact location where the gang stopped the Up Special on August 8, 1963, and formed a human chain to unload 120 sacks of banknotes.'
  ),
  'The Firm': figureHtml(
    images.reynolds,
    'Bruce Reynolds, mastermind of the Great Train Robbery',
    'Bruce Reynolds, the self-styled "mastermind" of the Great Train Robbery. A career criminal with aspirations beyond the underworld, Reynolds planned the heist with meticulous precision over several months.'
  ),
  'Thirty Minutes at Bridego Bridge': figureHtml(
    images.hero,
    'Bridego Bridge, site of the Great Train Robbery',
    'Bridego Bridge as it appears today — the railway overpass near Ledburn, Buckinghamshire, where the gang unloaded £2.6 million in under thirty minutes. The lane beneath the bridge provided direct vehicle access to the embankment.'
  ),
  'Leatherslade Farm': figureHtml(
    images.leatherslade,
    'Leatherslade Farm buildings near Oakley, Buckinghamshire',
    'The outbuildings at Leatherslade Farm, the gang\'s hideout twenty-seven miles from the robbery site. The farm was purchased through intermediaries and stocked with provisions — but the gang\'s failure to destroy it after their departure proved their undoing.'
  ),
  'The Hue and Cry': figureHtml(
    images.memorial,
    'Memorial plaque for Jack Mills and David Whitby',
    'The memorial plaque honouring train driver Jack Mills and fireman David Whitby, who "showed extreme bravery" during the robbery of the 1M44 Glasgow to London Royal Mail train on August 8, 1963.'
  ),
  'The Arrests': figureHtml(
    images.biggsMugshot,
    'Ronnie Biggs, Buckinghamshire Constabulary mugshot, 1960s',
    'Ronnie Biggs in his Buckinghamshire Constabulary mugshot. A minor figure in the robbery itself, Biggs would become the most famous of all the train robbers through his dramatic escape and decades as a fugitive in Brazil.'
  ),
  'The Crime of the Century': figureHtml(
    images.plaque,
    'Network Rail plaque on Train Robbers Bridge',
    'The bridge between Cheddington and Leighton Buzzard — once signed "Train Robbers\' Bridge" by Network Rail, now officially renamed Mentmore Bridge. The plaque remains a marker of the crime that shocked Britain and entered the national mythology.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/great-train-robbery.ts');
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
  <p class="epigraph">"It was a crime of sordid violence inspired by vast greed."</p>
  <p class="epigraph-attr">— Justice Edmund Davies, sentencing, April 15, 1964</p>
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
      <p><strong>March 1963</strong> — Planning begins. Bruce Reynolds, Gordon Goody, and Buster Edwards assemble a gang and begin scouting the West Coast Main Line between Leighton Buzzard and Cheddington.</p>
      <p><strong>May 1963</strong> — The "conspiracy" formally begins (as later determined by the court). Roger Cordrey develops his method of rigging railway signals using batteries and a leather glove.</p>
      <p><strong>Summer 1963</strong> — Leatherslade Farm is purchased through intermediaries Brian Field and John Wheater. The gang makes multiple reconnaissance trips to Bridego Bridge and Sears Crossing.</p>
      <p><strong>August 8, 1963 (c. 3:00 a.m.)</strong> — The gang stops the Up Special Travelling Post Office at Sears Crossing by rigging the signals. Driver Jack Mills is coshed. The train is moved to Bridego Bridge. 120 mailbags containing £2.6 million are unloaded in under 30 minutes.</p>
      <p><strong>August 8–11, 1963</strong> — The gang hides at Leatherslade Farm, counts the money, and plays Monopoly with real banknotes.</p>
      <p><strong>August 13, 1963</strong> — Herdsman John Maris reports suspicious activity at Leatherslade Farm. Police discover the hideout — and a wealth of fingerprint evidence.</p>
      <p><strong>August 14, 1963</strong> — Roger Cordrey arrested in Bournemouth after paying three months' rent in cash.</p>
      <p><strong>August–September 1963</strong> — Twelve men arrested in rapid succession: Wilson, Goody, James, Wisbey, Welch, Hussey, Biggs, Brian Field, Leonard Field, Wheater, Boal, and Cordrey.</p>
      <p><strong>January 20, 1964</strong> — Trial begins at Aylesbury Assizes before Justice Edmund Davies. It lasts 51 days with 613 exhibits and 240 witnesses.</p>
      <p><strong>April 15, 1964</strong> — Sentences handed down. Seven men receive 30 years. Total sentences: 307 years. The judge calls it "a crime of sordid violence inspired by vast greed."</p>
      <p><strong>August 12, 1964</strong> — Charlie Wilson escapes from Winson Green Prison, Birmingham. He flees to Canada.</p>
      <p><strong>July 8, 1965</strong> — Ronnie Biggs escapes from Wandsworth Prison using a rope ladder and a furniture van. He flees to France, then Australia, then Brazil.</p>
      <p><strong>September 1966</strong> — Buster Edwards surrenders voluntarily in London after three years as a fugitive in Mexico.</p>
      <p><strong>January 1968</strong> — Charlie Wilson recaptured in Canada.</p>
      <p><strong>November 8, 1968</strong> — Bruce Reynolds arrested in Torquay by Tommy Butler. Sentenced to 10 years.</p>
      <p><strong>February 1970</strong> — Jack Mills dies, aged 64, never having recovered from his injuries.</p>
      <p><strong>1971</strong> — Britain decimalises its currency. Most of the stolen banknotes become worthless.</p>
      <p><strong>1974</strong> — Detective Jack Slipper flies to Rio to arrest Biggs; fails due to Brazilian extradition law.</p>
      <p><strong>April 1990</strong> — Charlie Wilson shot dead outside his home in Spain.</p>
      <p><strong>November 1994</strong> — Buster Edwards found dead at his lock-up near Waterloo station. Verdict: suicide.</p>
      <p><strong>May 7, 2001</strong> — Ronnie Biggs returns voluntarily to Britain. Arrested and re-imprisoned.</p>
      <p><strong>August 2009</strong> — Biggs released on compassionate grounds, two days before his 80th birthday.</p>
      <p><strong>February 28, 2013</strong> — Bruce Reynolds dies in his sleep, aged 81.</p>
      <p><strong>December 18, 2013</strong> — Ronnie Biggs dies at a care home in Barnet, aged 84.</p>
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
      <p>Reynolds, Bruce — <em>The Autobiography of a Thief</em>, Virgin Books, 1995</p>
      <p>Biggs, Ronnie — <em>Odd Man Out: The Last Straw</em>, Bloomsbury, 1994</p>
      <p>Read, Piers Paul — <em>The Train Robbers</em>, W.H. Allen, 1978</p>
      <p>Goody, Gordon — <em>How to Rob a Train</em>, Milo Books, 2014</p>
      <p>British Transport Police — "The Great Train Robbery, 1963"</p>
      <p>Thames Valley Police Museum — Great Train Robbery collection, Sulhamstead, Berkshire</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-bridego-bridge-robbery-site.jpg'),
        title: 'The Great\nTrain Robbery',
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
