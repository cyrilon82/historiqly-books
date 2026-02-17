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
  title: 'Area 51',
  subtitle: 'The Secret Base That Launched a Thousand Conspiracies',
  author: 'HistorIQly',
  series: 'Vol. 5: Conspiracies',
  slug: 'area-51',
  description:
    'In 1955, the CIA built a secret airbase on a dry lakebed in the Nevada desert. For decades, the government denied it existed. What they were actually hiding was stranger than aliens — and the truth, when it finally emerged, was more extraordinary than any conspiracy theory.',
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
  hero: imgFileUrl('hero-area51-aerial-1968.jpg'),
  u2Cover: imgFileUrl('evidence-u2-nasa-cover-story.jpg'),
  sr71: imgFileUrl('evidence-sr71-blackbird-flight.jpg'),
  f117: imgFileUrl('evidence-f117-nighthawk-flight.jpg'),
  roswell: imgFileUrl('evidence-roswell-daily-record-1947.jpg'),
  janet: imgFileUrl('evidence-janet-airlines-737.jpg'),
  storm: imgFileUrl('atmosphere-storm-area51-crowd.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Ranch': figureHtml(
    images.hero,
    'Aerial photograph of Area 51 and Groom Lake, 1968',
    'Area 51 as seen in a 1968 USGS aerial photograph. The dry lakebed of Groom Lake stretches across the desert floor, surrounded by the mountains that provided natural concealment for the most secret airbase in America.'
  ),
  'The Angel': figureHtml(
    images.u2Cover,
    'U-2 spy plane with fictitious NASA markings, 1960',
    'After Francis Gary Powers was shot down over the Soviet Union, the CIA staged this U-2 with fictitious NASA markings at Edwards Air Force Base — a prop in a cover story that was about to collapse.'
  ),
  'Faster Than a Bullet': figureHtml(
    images.sr71,
    'SR-71 Blackbird in flight over the Sierra Nevada',
    'The SR-71 Blackbird — the fastest air-breathing manned aircraft ever built. Developed from the A-12 OXCART tested at Area 51, the Blackbird could fly from New York to London in under two hours.'
  ),
  'The Invisible Airplane': figureHtml(
    images.f117,
    'F-117 Nighthawk stealth fighter in flight',
    'The F-117 Nighthawk, born from the Have Blue programme at Area 51. Its angular facets, designed to scatter radar, made it nearly invisible — and generated a new wave of UFO sightings over the Nevada desert.'
  ),
  'Something Crashed in the Desert': figureHtml(
    images.roswell,
    'Roswell Daily Record headline, July 8, 1947',
    'The headline that launched a mythology. The Roswell Daily Record\'s front page from July 8, 1947: "RAAF Captures Flying Saucer On Ranch in Roswell Region." The Army retracted the story within hours, but the legend proved impossible to kill.'
  ),
  'The Man Who Saw the Saucers': figureHtml(
    images.storm,
    'Crowd gathered at the back gate of Area 51, September 2019',
    'The "Storm Area 51" event, September 20, 2019. Over two million people RSVP\'d to a Facebook joke proposing to rush the gates. Approximately 1,500 showed up. Nobody stormed anything. The Cammo Dudes had the quietest shift of their careers.'
  ),
  "They Can't Stop All of Us": figureHtml(
    images.janet,
    'Janet Airlines Boeing 737 at Las Vegas airport',
    'A JANET Boeing 737 — the unmarked white plane with a red stripe that ferries workers between Las Vegas and Area 51 daily. The airline has no official name. The call sign is "JANET." The terminal is behind a guarded parking lot.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/area-51.ts');
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
  <p class="epigraph">"The real story of Area 51 is more extraordinary than the conspiracy theories. But by the time the truth emerged, the fiction had become more powerful than the truth."</p>
  <p class="epigraph-attr">— Annie Jacobsen, <em>Area 51: An Uncensored History</em>, 2011</p>
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
      <p><strong>1947 (July)</strong> — Something crashes on a ranch near Roswell, New Mexico. The Army announces recovery of a "flying disc," then retracts the story, blaming a weather balloon. The debris is actually from Project Mogul, a classified nuclear detection programme.</p>
      <p><strong>1954</strong> — President Eisenhower approves the U-2 spy plane programme (Project AQUATONE). Kelly Johnson of Lockheed's Skunk Works is tasked with building an aircraft that can fly above 70,000 feet.</p>
      <p><strong>1955 (April)</strong> — Kelly Johnson and Tony LeVier select Groom Lake, Nevada, as the test site. Construction begins immediately. The CIA designates it Area 51.</p>
      <p><strong>1955 (August 4)</strong> — Tony LeVier makes the first flight of the U-2 at Groom Lake — accidentally, during a high-speed taxi run.</p>
      <p><strong>1956 (July 4)</strong> — First U-2 overflight of the Soviet Union. UFO sightings from U-2 flights begin accumulating; the CIA cannot explain them without revealing the programme.</p>
      <p><strong>1960 (May 1)</strong> — Francis Gary Powers is shot down over the Soviet Union. The CIA's cover story — a NASA weather plane — collapses when Khrushchev reveals Powers is alive. The Paris Summit collapses. The U-2 overflight programme ends.</p>
      <p><strong>1962 (April 26)</strong> — First flight of the A-12 OXCART at Area 51. The aircraft is built from Soviet titanium, purchased through CIA front companies.</p>
      <p><strong>1964 (December 22)</strong> — First flight of the SR-71 Blackbird, the fastest air-breathing manned aircraft ever built.</p>
      <p><strong>1977 (December 1)</strong> — First flight of Have Blue, the stealth technology demonstrator, at Area 51. The aircraft's radar cross-section is approximately that of a ball bearing. The Red Eagles programme begins — American pilots flying captured Soviet MiGs.</p>
      <p><strong>1981</strong> — The F-117 Nighthawk stealth fighter begins testing at Area 51 and Tonopah Test Range.</p>
      <p><strong>1988 (November 10)</strong> — The Air Force acknowledges the F-117's existence, five years after it became operational.</p>
      <p><strong>1989 (May–November)</strong> — Bob Lazar goes public on KLAS-TV with George Knapp, claiming to have reverse-engineered alien spacecraft at "S-4" near Area 51.</p>
      <p><strong>1991 (January–February)</strong> — F-117s fly 1,200+ combat sorties in the Gulf War without a single aircraft being hit.</p>
      <p><strong>1994</strong> — Former Area 51 workers file <em>Frost v. Perry</em>, alleging toxic exposure from open-air burning of classified materials. Jonathan Turley represents them.</p>
      <p><strong>1995 (September 29)</strong> — President Clinton signs Presidential Determination No. 95-45, exempting Area 51 from all federal environmental law. The exemption is renewed annually by every subsequent president.</p>
      <p><strong>2003</strong> — Element 115 (Moscovium) is first synthesised by Russian scientists, cited by Lazar supporters as vindication of his claims.</p>
      <p><strong>2013 (June 25)</strong> — The CIA formally acknowledges Area 51 by name in declassified documents, responding to a FOIA request by Jeffrey Richelson of the National Security Archive.</p>
      <p><strong>2019 (June 27)</strong> — College student Matty Roberts creates "Storm Area 51, They Can't Stop All of Us" Facebook event. Over 2 million RSVP. On September 20, approximately 1,500–3,000 attend. Nobody storms anything.</p>
      <p><strong>Present</strong> — Area 51 remains an active military installation. Janet Airlines continues to ferry workers daily from Las Vegas. The restricted airspace remains in force. New construction is visible in satellite imagery. The presidential environmental exemption continues.</p>
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
      <p>Jacobsen, Annie — <em>Area 51: An Uncensored History of America's Top Secret Military Base</em>, Little, Brown, 2011</p>
      <p>Rich, Ben and Leo Janos — <em>Skunk Works: A Personal Memoir of My Years at Lockheed</em>, Little, Brown, 1994</p>
      <p>Merlin, Peter — <em>Images of Aviation: Area 51</em>, Arcadia Publishing, 2011</p>
      <p>CIA — "The Central Intelligence Agency and Overhead Reconnaissance: The U-2 and OXCART Programs, 1954–1974" (declassified June 2013)</p>
      <p>National Security Archive, George Washington University — nsarchive.gwu.edu</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-area51-aerial-1968.jpg'),
        title: 'Area 51',
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
