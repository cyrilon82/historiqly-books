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
  title: 'MKUltra',
  subtitle: 'The CIA\'s Secret War on the Mind',
  author: 'HistorIQly',
  series: 'Vol. 7: Declassified',
  slug: 'mkultra',
  description:
    'In 1953, the CIA launched a covert program to crack the code of human consciousness — through LSD, electroshock, sensory deprivation, and psychological torture. For twenty years, MKUltra operated in the shadows, using unwitting American citizens as test subjects. This is the true story of the poisoner, the psychiatrist, the victims, and the cover-up that almost succeeded.',
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
  hero: imgFileUrl('hero-mkultra-declassified-documents.jpg'),
  senateReport: imgFileUrl('hero-mkultra-senate-report.jpg'),
  lsdDoc: imgFileUrl('evidence-mkultra-lsd-document.jpg'),
  declassifiedPage: imgFileUrl('evidence-mkultra-declassified-page.png'),
  gottlieb: imgFileUrl('figure-sidney-gottlieb.jpg'),
  dulles: imgFileUrl('figure-allen-dulles.jpg'),
  dullesId: imgFileUrl('evidence-allen-dulles-id-card.jpg'),
  helms: imgFileUrl('figure-richard-helms.jpg'),
  helmsLbj: imgFileUrl('figure-richard-helms-lbj.jpg'),
  cameron: imgFileUrl('figure-donald-ewen-cameron.jpg'),
  church: imgFileUrl('figure-frank-church.png'),
  kennedy: imgFileUrl('figure-ted-kennedy.png'),
  colby: imgFileUrl('figure-william-colby.jpg'),
  turner: imgFileUrl('figure-stansfield-turner.jpg'),
  hofmann: imgFileUrl('figure-albert-hofmann.jpg'),
  olson: imgFileUrl('victim-frank-olson.jpg'),
  bulger: imgFileUrl('victim-whitey-bulger-mugshot.jpg'),
  kaczynski: imgFileUrl('victim-ted-kaczynski-yearbook.jpg'),
  fortDetrick: imgFileUrl('location-fort-detrick-test-sphere.jpg'),
  allanMemorial: imgFileUrl('location-allan-memorial-institute.jpg'),
  ciaEntrance: imgFileUrl('location-cia-new-hq-entrance.jpg'),
  ciaBuilding: imgFileUrl('atmosphere-cia-headquarters-building.jpg'),
  ciaFloorSeal: imgFileUrl('atmosphere-cia-floor-seal.png'),
  koreanPow: imgFileUrl('atmosphere-korean-war-pow.jpg'),
  lsdMolecule: imgFileUrl('evidence-lsd-molecule.png'),
  furtherBus: imgFileUrl('atmosphere-further-bus-kesey.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Fear': figureHtml(
    images.koreanPow,
    'Korean War prisoners of war',
    'American prisoners of war during the Korean War. The fear that Communist nations had developed techniques of "brainwashing" was the direct catalyst for the creation of MKUltra.'
  ),
  'The Chemist': figureHtml(
    images.gottlieb,
    'Sidney Gottlieb, director of MKUltra',
    'Sidney Gottlieb, the CIA chemist who directed MKUltra from 1953 to 1973. Known as the "Poisoner in Chief," Gottlieb oversaw 149 subprojects involving LSD, electroshock, and psychological manipulation.'
  ),
  'The Experiments': figureHtml(
    images.bulger,
    'Whitey Bulger prison mugshot, 1956',
    'James "Whitey" Bulger in his 1956 prison mugshot. As an inmate at Atlanta Federal Penitentiary, Bulger was given LSD repeatedly for eighteen months as part of MKUltra experiments. "They were looking for the mind-control drug," he later said, "and they used us as guinea pigs."'
  ),
  'The Doctor': figureHtml(
    images.allanMemorial,
    'The Allan Memorial Institute (Ravenscrag), Montreal',
    'The Allan Memorial Institute in Montreal, housed in the Gothic Victorian mansion called Ravenscrag. Here Dr. Donald Ewen Cameron conducted his notorious "psychic driving" experiments under MKUltra Subproject 68.'
  ),
  'The Unwitting': figureHtml(
    images.olson,
    'Frank Olson (1910–1953)',
    'Frank Olson, the U.S. Army biochemist who was covertly dosed with LSD by Sidney Gottlieb in November 1953. Nine days later, Olson fell from the thirteenth floor of the Hotel Statler in New York City. The CIA called it suicide. His family spent fifty years trying to prove it was murder.'
  ),
  'The Destruction': figureHtml(
    images.helmsLbj,
    'CIA Director Richard Helms',
    'CIA Director Richard Helms (right), photographed at the White House. In January 1973, weeks before leaving office, Helms ordered the destruction of nearly all MKUltra records — an act that very nearly erased the program from history.'
  ),
  'The Reckoning': figureHtml(
    images.senateReport,
    'Cover page of the 1977 Senate report on MKUltra',
    'The cover page of "Project MKULTRA, The CIA\'s Program of Research in Behavioral Modification" — the 1977 Senate report that publicly documented the program\'s scope and abuses for the first time.'
  ),
  'The Legacy': figureHtml(
    images.hero,
    'Declassified MKUltra document',
    'A page from the declassified MKUltra files. Of the approximately twenty thousand documents that survived Richard Helms\'s 1973 destruction order, most were financial records — dry, bureaucratic, technical. But they were enough to prove what the CIA had done.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/mkultra.ts');
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
  <p class="epigraph">"I can assure you that the concern for the rights of the individual is deeply embedded in our culture, and we wouldn't have these hearings without it."</p>
  <p class="epigraph-attr">— Senator Edward Kennedy, MKUltra hearings, August 3, 1977</p>
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
      <p><strong>1943</strong> — Swiss chemist Albert Hofmann at Sandoz Laboratories accidentally discovers the psychedelic effects of LSD-25.</p>
      <p><strong>1947</strong> — The National Security Act creates the Central Intelligence Agency from the wartime Office of Strategic Services.</p>
      <p><strong>1950</strong> — American POWs in Korea appear on Chinese state radio making "confessions." Journalist Edward Hunter introduces the term "brainwashing" to the American public.</p>
      <p><strong>1950</strong> — The CIA launches Project BLUEBIRD, its first behavioural modification program. It is renamed ARTICHOKE in 1951.</p>
      <p><strong>1953 (April 13)</strong> — CIA Director Allen Dulles authorises MKUltra. Sidney Gottlieb is appointed to direct the program.</p>
      <p><strong>1953 (November 19)</strong> — Gottlieb covertly doses Frank Olson and others with LSD at Deep Creek Lodge, Maryland.</p>
      <p><strong>1953 (November 28)</strong> — Frank Olson falls to his death from room 1018A of the Hotel Statler in New York City. The CIA rules it a suicide.</p>
      <p><strong>1955–1965</strong> — Operation Midnight Climax: CIA safe houses in San Francisco and New York dose unwitting citizens with LSD, observed through one-way mirrors.</p>
      <p><strong>1957–1964</strong> — Dr. Donald Ewen Cameron conducts "psychic driving" experiments at the Allan Memorial Institute in Montreal under MKUltra Subproject 68.</p>
      <p><strong>1959–1962</strong> — Dr. Henry Murray conducts stress experiments on Harvard undergraduates, including sixteen-year-old Theodore Kaczynski.</p>
      <p><strong>1963</strong> — CIA Inspector General John Earman produces a scathing internal review of MKUltra, recommending a halt to unwitting experiments.</p>
      <p><strong>1964</strong> — Ken Kesey, a former MKUltra test subject at Menlo Park VA Hospital, launches the Acid Tests. LSD escapes the laboratory and enters the counterculture.</p>
      <p><strong>1973 (January)</strong> — CIA Director Richard Helms orders the destruction of all MKUltra files before leaving office. Sidney Gottlieb oversees the shredding and incineration. Approximately twenty thousand financial records survive by accident.</p>
      <p><strong>1974 (December 22)</strong> — Seymour Hersh's New York Times exposé on CIA domestic spying triggers congressional investigations.</p>
      <p><strong>1975 (January–April 1976)</strong> — The Church Committee investigates CIA abuses, including MKUltra. Senator Frank Church displays a CIA dart gun on live television.</p>
      <p><strong>1975</strong> — President Ford apologises to the Olson family. Congress authorises a $750,000 settlement.</p>
      <p><strong>1977 (August 3)</strong> — Senator Edward Kennedy convenes hearings on MKUltra. CIA Director Stansfield Turner reveals the discovery of twenty thousand surviving documents.</p>
      <p><strong>1977 (September 21)</strong> — Sidney Gottlieb testifies before the Senate, invoking the Fifth Amendment and claiming memory loss.</p>
      <p><strong>1988</strong> — Nine of Cameron's former patients in Montreal sue the CIA. The case is settled in 1988 for $750,000.</p>
      <p><strong>1992</strong> — The Canadian government compensates seventy-seven former patients of the Allan Memorial Institute with approximately $100,000 each.</p>
      <p><strong>1994</strong> — Frank Olson's body is exhumed. A forensic pathologist finds a previously undetected cranial haematoma inconsistent with a fall.</p>
      <p><strong>1999 (March 7)</strong> — Sidney Gottlieb dies at age eighty in rural Virginia.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources — including the declassified MKUltra documents, the 1977 Senate report, and the Church Committee findings — while some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Kinzer, Stephen — <em>Poisoner in Chief: Sidney Gottlieb and the CIA Search for Mind Control</em>, Henry Holt, 2019</p>
      <p>Marks, John — <em>The Search for the "Manchurian Candidate": The CIA and Mind Control</em>, Times Books, 1979</p>
      <p>Collins, Anne — <em>In the Sleep Room: The Story of the CIA Brainwashing Experiments in Canada</em>, Lester & Orpen Dennys, 1988</p>
      <p>U.S. Senate — <em>Project MKULTRA, The CIA's Program of Research in Behavioral Modification</em>, Joint Hearing, 95th Congress, 1977</p>
      <p>Albarelli, H.P. Jr. — <em>A Terrible Mistake: The Murder of Frank Olson and the CIA's Secret Cold War Experiments</em>, Trine Day, 2009</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-mkultra-declassified-documents.jpg'),
        title: 'MKUltra',
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
