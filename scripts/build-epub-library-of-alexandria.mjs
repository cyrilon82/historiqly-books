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
  title: 'The Library of Alexandria',
  subtitle: 'What Was Really Lost?',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'library-of-alexandria',
  description:
    'The Library of Alexandria is history\'s most famous symbol of lost knowledge — an entire civilization\'s learning supposedly destroyed in a single catastrophic fire. But the real story is far more complicated, more fascinating, and more tragic than the myth. This is the true account of the greatest library the ancient world ever built, the scholars who made it extraordinary, and the centuries-long decline that erased it from the earth.',
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
  hero: imgFileUrl('hero-library-of-alexandria-von-corven.jpg'),
  burning: imgFileUrl('burning-library-alexandria-391.jpg'),
  ptolemy: imgFileUrl('ptolemy-ii-vincenzo-camuccini.jpg'),
  hypatia: imgFileUrl('hypatia-julius-kronberg-1889.jpg'),
  eratosthenes: imgFileUrl('eratosthenes-measurement-earth.jpg'),
  pharos: imgFileUrl('pharos-lighthouse-thiersch.png'),
  serapeum: imgFileUrl('serapeum-alexandria-ruins.jpg'),
  bibliotheca: imgFileUrl('bibliotheca-alexandrina-modern.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The City That Rose from Sand': figureHtml(
    images.pharos,
    'Reconstruction of the Pharos Lighthouse of Alexandria by Hermann Thiersch',
    'Hermann Thiersch\'s 1909 reconstruction of the Pharos Lighthouse — one of the Seven Wonders of the Ancient World. The beacon rose over 100 metres above Alexandria\'s eastern harbour.'
  ),
  'The Obsession with Scrolls': figureHtml(
    images.ptolemy,
    'Ptolemy II Philadelphus in the Library of Alexandria, by Vincenzo Camuccini, 1813',
    'Vincenzo Camuccini\'s 1813 painting of Ptolemy II Philadelphus visiting the Library. Under his reign, the library\'s aggressive scroll-acquisition campaign reached its peak.'
  ),
  'The Scholars of the Mouseion': figureHtml(
    images.eratosthenes,
    'Diagram of Eratosthenes\' method for measuring the circumference of the Earth',
    'Eratosthenes\' elegant method: by measuring the angle of a shadow in Alexandria at noon on the summer solstice, and knowing the distance to Syene where the sun was directly overhead, he calculated the Earth\'s circumference to within a few per cent.'
  ),
  'The Daughter Library': figureHtml(
    images.serapeum,
    'Ruins of the Serapeum of Alexandria, with Pompey\'s Pillar',
    'The ruins of the Serapeum, site of the daughter library. The massive red granite column, known as Pompey\'s Pillar, was erected in honour of the emperor Diocletian in 297 CE.'
  ),
  'The Wars That Followed': figureHtml(
    images.burning,
    'The Burning of the Library at Alexandria in 391 AD, 19th-century illustration',
    'A 19th-century imagining of the destruction of the Serapeum in 391 CE. The actual destruction was more a demolition than a conflagration — but the myth of a single great fire persists.'
  ),
  'Hypatia and the End of an Era': figureHtml(
    images.hypatia,
    'Hypatia by Julius Kronberg, 1889',
    'Julius Kronberg\'s 1889 painting of Hypatia — the last great scholar of the Alexandrian tradition, murdered by a mob in 415 CE.'
  ),
  'The Library That Rose Again': figureHtml(
    images.bibliotheca,
    'The Bibliotheca Alexandrina, the modern Library of Alexandria',
    'The Bibliotheca Alexandrina, designed by Snøhetta and opened in 2002 — a modern revival of the ancient library, built near the site of the original.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/library-of-alexandria.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'([^']*(?:\\.[^']*)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
const chapters = [];
let match;
while ((match = chapterRegex.exec(raw)) !== null) {
  chapters.push({
    num: match[1],
    title: (match[2] || match[3]).replace(/\\'/g, "'"),
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
  <p class="epigraph">"O Solon, Solon, you Greeks are always children.<br/>There is no such thing as an old Greek."</p>
  <p class="epigraph-attr">— An Egyptian priest to Solon, as told by Plato in the <em>Timaeus</em></p>
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
      <p><strong>332 BCE</strong> — Alexander the Great founds the city of Alexandria on the Mediterranean coast of Egypt, choosing the site for its natural harbours and strategic position.</p>
      <p><strong>c. 323 BCE</strong> — Alexander dies in Babylon. His general Ptolemy claims Egypt and diverts Alexander's funeral cortège to Memphis, later moving the body to Alexandria.</p>
      <p><strong>c. 295 BCE</strong> — Ptolemy I Soter commissions Demetrius of Phalerum to build the Mouseion and its library in the Bruchion, Alexandria's royal quarter.</p>
      <p><strong>c. 284 BCE</strong> — Zenodotus of Ephesus becomes the first head librarian. He invents textual criticism through systematic comparison of Homer manuscripts and introduces alphabetical ordering.</p>
      <p><strong>c. 280 BCE</strong> — The Pharos Lighthouse is completed under Ptolemy II Philadelphus, rising over 100 metres above the harbour entrance.</p>
      <p><strong>c. 260 BCE</strong> — Callimachus of Cyrene creates the <em>Pinakes</em>, a 120-volume catalogue of the library's holdings — the world's first subject catalogue and the ancestor of all modern library classification systems.</p>
      <p><strong>c. 245 BCE</strong> — Eratosthenes becomes head librarian. He calculates the circumference of the Earth to within a few per cent of the modern value.</p>
      <p><strong>c. 240 BCE</strong> — Ptolemy III borrows the original manuscripts of Aeschylus, Sophocles, and Euripides from Athens, pays a 15-talent deposit, sends back copies, and keeps the originals.</p>
      <p><strong>c. 235 BCE</strong> — The daughter library is established in the Serapeum, a temple to Serapis in southwestern Alexandria, to accommodate the growing collection.</p>
      <p><strong>145 BCE</strong> — Ptolemy VIII expels scholars from the Mouseion in a political purge. Aristarchus of Samothrace, the greatest Homeric critic, flees Alexandria.</p>
      <p><strong>48 BCE</strong> — Julius Caesar sets fire to the Egyptian fleet during the Alexandrian War. The fire spreads to dockside warehouses, destroying an estimated 40,000 scrolls.</p>
      <p><strong>30 BCE</strong> — Cleopatra VII dies. Egypt becomes a Roman province. The Ptolemaic dynasty ends.</p>
      <p><strong>272 CE</strong> — Emperor Aurelian besieges Alexandria to recapture it from Zenobia of Palmyra. The Bruchion quarter — site of the original library — is devastated and never rebuilt.</p>
      <p><strong>391 CE</strong> — Patriarch Theophilus orders the destruction of the Serapeum. The temple is demolished; the fate of its scroll collection is unknown.</p>
      <p><strong>415 CE</strong> — Hypatia, the last great scholar of the Alexandrian tradition, is murdered by a Christian mob.</p>
      <p><strong>641 CE</strong> — Arab forces conquer Alexandria. The later story of Caliph Omar ordering the library burned is almost certainly a 13th-century fabrication.</p>
      <p><strong>2002</strong> — The Bibliotheca Alexandrina, designed by Snøhetta, opens on the waterfront near the site of the ancient library.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; atmospheric detail is used to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Casson, Lionel — <em>Libraries in the Ancient World</em>, Yale University Press, 2001</p>
      <p>El-Abbadi, Mostafa — <em>The Life and Fate of the Ancient Library of Alexandria</em>, UNESCO, 1990</p>
      <p>MacLeod, Roy (ed.) — <em>The Library of Alexandria: Centre of Learning in the Ancient World</em>, I.B. Tauris, 2000</p>
      <p>Bagnall, Roger S. — "Alexandria: Library of Dreams," <em>Proceedings of the American Philosophical Society</em> 146, 2002</p>
      <p>Watts, Edward J. — <em>Hypatia: The Life and Legend of an Ancient Philosopher</em>, Oxford University Press, 2017</p>
      <p>Dzielska, Maria — <em>Hypatia of Alexandria</em>, Harvard University Press, 1995</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-library-of-alexandria-von-corven.jpg'),
        title: 'The Library\nof Alexandria',
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
