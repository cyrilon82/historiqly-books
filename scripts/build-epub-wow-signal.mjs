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
  title: 'The Wow! Signal',
  subtitle: '72 Seconds from the Edge of Forever',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained',
  slug: 'wow-signal',
  description:
    'On August 15, 1977, a radio telescope in Ohio picked up a signal so powerful, so precise, and so strange that the astronomer who found it could only write one word in the margin: Wow! Nearly fifty years later, it has never been explained.',
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
  printout: imgFileUrl('hero-wow-signal-printout.jpg'),
  printoutLarge: imgFileUrl('evidence-wow-signal-printout-large.jpg'),
  nancay: imgFileUrl('evidence-nancay-radio-telescope.jpg'),
  ibm1130: imgFileUrl('evidence-ibm-1130-computer.jpg'),
  ibmConsole: imgFileUrl('evidence-ibm-1130-console.jpg'),
  starField: imgFileUrl('evidence-wow-signal-star-field.jpg'),
  vla: imgFileUrl('evidence-very-large-array.jpg'),
  greenBank: imgFileUrl('evidence-green-bank-telescope.jpg'),
  allen: imgFileUrl('evidence-allen-telescope-array.jpg'),
  arecibo: imgFileUrl('evidence-arecibo-observatory.jpg'),
  kraus: imgFileUrl('figure-john-kraus.jpg'),
  drake: imgFileUrl('figure-frank-drake.jpg'),
  galacticCenter: imgFileUrl('atmosphere-galactic-center-milky-way.jpg'),
  sagittarius: imgFileUrl('atmosphere-sagittarius-urania.jpg'),
  alma: imgFileUrl('atmosphere-milky-way-alma.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Listening': figureHtml(
    images.nancay,
    'A Kraus-type radio telescope — the same design as Big Ear',
    'A Kraus-type radio telescope at Nançay, France — the same flat-reflector design that John Kraus used for Big Ear. The Ohio telescope was demolished in 1998; no photographs survive on public record. This is the closest surviving equivalent.'
  ),
  'The Signal': figureHtml(
    images.printout,
    'The original Wow! Signal printout with 6EQUJ5 circled',
    'The signal as it appeared on the printout: 6EQUJ5. The peak value "U" represents a signal intensity thirty times above the background noise — the strongest narrowband signal any SETI program had ever recorded.'
  ),
  'The Circle': figureHtml(
    images.printoutLarge,
    'The Wow! Signal printout — extended view',
    'The full printout showing the Wow! Signal in context. Columns of blank spaces and low numbers represent the ordinary silence of the cosmos. The sequence 6EQUJ5, circled in red, is the exception — the only time the signal climbed into the letter range.'
  ),
  'The Frequency': figureHtml(
    images.galacticCenter,
    'The galactic centre in Sagittarius — direction of the Wow! Signal',
    'The centre of the Milky Way in the constellation Sagittarius, imaged in near-infrared. The Wow! Signal originated from this region of sky — roughly 19 degrees southeast of the galactic plane, where the density of stars is highest.'
  ),
  'The Search': figureHtml(
    images.vla,
    'The Very Large Array in New Mexico',
    'The Very Large Array near Socorro, New Mexico. In 1995, Robert Gray became the first amateur astronomer to use the VLA, pointing its twenty-seven dishes at the Wow! Signal\'s coordinates. He found nothing.'
  ),
  'The Theories': figureHtml(
    images.ibm1130,
    'An IBM 1130 computer — the same model used at Big Ear',
    'An IBM 1130 computer, the same model that processed Big Ear\'s radio data. The line printer on the right produced the continuous-feed printout on which the Wow! Signal was recorded. The machine is now a museum piece.'
  ),
  'The Demolition': figureHtml(
    images.alma,
    'Radio telescopes under the Milky Way',
    'Radio telescopes under the Milky Way at the ALMA Observatory in Chile. The search for extraterrestrial intelligence continues with newer, more powerful instruments — but the Wow! Signal has never been detected again.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/wow-signal.ts');
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
  <p class="epigraph">"Searching for interstellar communications … is eminently worth doing. It involves no danger. The probability of success is difficult to estimate, but if we never search, the chance of success is zero."</p>
  <p class="epigraph-attr">— Giuseppe Cocconi &amp; Philip Morrison, <em>Nature</em>, 1959</p>
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
      <p><strong>1956–1963</strong> — John D. Kraus designs and builds the Big Ear radio telescope at Ohio Wesleyan University's Perkins Observatory site in Delaware, Ohio. The telescope spans three football fields.</p>
      <p><strong>1959</strong> — Cornell physicists Giuseppe Cocconi and Philip Morrison publish "Searching for Interstellar Communications" in <em>Nature</em>, proposing the hydrogen line (1420 MHz) as the natural frequency for extraterrestrial communication.</p>
      <p><strong>1960</strong> — Frank Drake conducts Project Ozma at Green Bank, West Virginia — the first systematic SETI search. He listens to two nearby stars for 150 hours. He hears nothing.</p>
      <p><strong>December 1973</strong> — Robert S. Dixon launches the Ohio SETI Program at Big Ear, which will become the longest-running continuous SETI search in history.</p>
      <p><strong>August 15, 1977, 11:16 PM EDT</strong> — The Wow! Signal is recorded by Big Ear from the direction of Sagittarius. The signal lasts 72 seconds, peaks at 30 standard deviations above noise, and appears on a single channel at 1420 MHz — the hydrogen line.</p>
      <p><strong>August 1977 (days later)</strong> — Volunteer astronomer Jerry Ehman discovers the anomaly while reviewing printout data at his kitchen table. He circles the sequence 6EQUJ5 in red ink and writes "Wow!" in the margin.</p>
      <p><strong>1977–1997</strong> — Big Ear returns to the signal's coordinates hundreds of times. The signal never reappears.</p>
      <p><strong>1987, 1989</strong> — Robert H. Gray searches for the signal using the Harvard-Smithsonian META array. No detection.</p>
      <p><strong>1995–1996</strong> — Gray and Kevin Marvel search using the Very Large Array in New Mexico — 27 dishes, the most powerful radio telescope on Earth. Gray is the first amateur astronomer to use the VLA. No detection.</p>
      <p><strong>December 1997</strong> — The Ohio SETI program ends after 24 years of continuous operation.</p>
      <p><strong>1998</strong> — Big Ear is demolished to make way for a housing development and the expansion of the Dornoch Golf Club.</p>
      <p><strong>2012</strong> — On the 35th anniversary, Arecibo Observatory beams a response containing 10,000 Twitter messages toward the signal's origin.</p>
      <p><strong>2016–2017</strong> — Antonio Paris proposes the comet hypothesis. The scientific community rejects it; Ehman co-authors a rebuttal.</p>
      <p><strong>2022</strong> — Breakthrough Listen searches with the Green Bank Telescope and Allen Telescope Array. No technosignature candidates found. Robert H. Gray dies after 35 years of searching.</p>
      <p><strong>August 2024</strong> — Abel Mendez publishes the hydrogen maser/magnetar flare hypothesis — the first comprehensive natural explanation for all observed properties of the signal.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and scientific literature; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Gray, Robert H. — <em>The Elusive Wow: Searching for Extraterrestrial Intelligence</em>, Palmer Square Press, 2012</p>
      <p>Cocconi, G. &amp; Morrison, P. — "Searching for Interstellar Communications," <em>Nature</em>, Vol. 184, 1959</p>
      <p>Ehman, Jerry R. — "The Big Ear Wow! Signal: What We Know and Don't Know About It After 20 Years," 1997</p>
      <p>Mendez, Abel et al. — "Arecibo Wow! I: An Astrophysical Explanation for the Wow! Signal," <em>arXiv</em>, 2024</p>
      <p>Drake, Frank &amp; Sobel, Dava — <em>Is Anyone Out There? The Scientific Search for Extraterrestrial Intelligence</em>, Delacorte Press, 1992</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-wow-signal-printout.jpg'),
        title: 'The Wow!\nSignal',
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
