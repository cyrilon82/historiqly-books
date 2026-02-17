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
  title: 'The Piltdown Men',
  subtitle: 'The 41-Year Fraud That Fooled Science',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'piltdown-man',
  description:
    'In 1912, a skull was found in a Sussex gravel pit that rewrote the story of human evolution. It took 41 years to discover it was a fraud. This is the full story — told as a thriller.',
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
  dawson: imgFileUrl('suspect-dawson.jpg'),
  woodward: imgFileUrl('woodward-portrait.png'),
  teilhard: imgFileUrl('suspect-teilhard.jpg'),
  doyle: imgFileUrl('suspect-conan-doyle.jpg'),
  painting: imgFileUrl('piltdown-gang-painting.jpg'),
  skull: imgFileUrl('piltdown-skull-reconstruction.jpg'),
  skullCabinet: imgFileUrl('skull-in-cabinet.jpg'),
  reconstruction: imgFileUrl('1913-reconstruction.png'),
  mcgregor: imgFileUrl('mcgregor-reconstruction.jpg'),
  headRestoration: imgFileUrl('piltdown-head-restoration.jpg'),
  comparativeSkulls: imgFileUrl('comparative-skulls.png'),
  waterston: imgFileUrl('waterston-mandible-comparison.jpg'),
  ctScan: imgFileUrl('ct-scan-piltdown.jpg'),
  filedTeeth: imgFileUrl('filed-teeth.jpg'),
  hintonTrunk: imgFileUrl('hinton-trunk.png'),
  memorial: imgFileUrl('memorial-stone.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Wizard of Sussex': figureHtml(
    images.dawson,
    'Charles Dawson, circa 1910',
    'Charles Dawson, solicitor and amateur antiquarian. "The Wizard of Sussex." He was the only person present at every stage of the excavation.'
  ),
  'The Keeper': figureHtml(
    images.woodward,
    'Arthur Smith Woodward, Keeper of Geology',
    'Arthur Smith Woodward, Keeper of Geology at the Natural History Museum. Meticulous, methodical, and deeply conventional — the perfect man to lend authority to a fraud he never suspected.'
  ),
  'The Dig': figureHtml(
    images.teilhard,
    'Pierre Teilhard de Chardin',
    'Pierre Teilhard de Chardin, the young French Jesuit priest who dug at Piltdown with an enthusiasm that bordered on joy. Later accused — and cleared — as a possible accomplice.'
  ),
  'The Jaw': figureHtml(
    images.skull,
    'The Piltdown skull reconstruction',
    'The Piltdown skull as reconstructed — a human cranium married to an ape\'s jaw. The dark fragments are the "original" bones; the white areas are plaster. The condyle — the one piece that would have exposed the fraud — was conveniently missing.'
  ),
  'Burlington House': figureHtml(
    images.painting,
    "John Cooke's 1915 painting of the Piltdown examination",
    "John Cooke's 1915 oil painting shows the Piltdown skull being examined at the Royal College of Surgeons. Arthur Keith stands at centre; Woodward sits at right. Every man in the room believed. Every man in the room was wrong."
  ),
  "England's Adam":
    figureHtml(
      images.reconstruction,
      'The 1913 reconstruction of Eoanthropus dawsoni',
      "The official reconstruction of <em>Eoanthropus dawsoni</em> — Dawn Man. This image was reproduced in newspapers, textbooks, and popular science books around the world. It showed what people wanted to see: an ancestor who was unmistakably English."
    ) +
    figureHtml(
      images.mcgregor,
      "McGregor's reconstruction of Piltdown Man",
      "An alternative reconstruction by J.H. McGregor. The face was pure speculation — built on fragments, plaster, and national pride."
    ),
  'The Doubters': figureHtml(
    images.filedTeeth,
    'The filed teeth of the Piltdown jaw',
    "The filed teeth. Under magnification, the flat molar surfaces dissolved into parallel scratches — the unmistakable marks of a steel file. Nobody looked closely enough."
  ),
  // No image for The Locked Cabinet — skull-in-cabinet.jpg was too similar to the Ch 5 skull
  'The Ghost': figureHtml(
    images.headRestoration,
    'Sculptural bust of Piltdown Man',
    "A sculptural restoration of Piltdown Man's head. This face — entirely speculative, built on forged bones — appeared in museums and textbooks for decades. It was the face of a creature that never existed."
  ),
  'Forty Years': figureHtml(
    images.comparativeSkulls,
    'Comparative anatomy of fossil human skulls',
    "Comparative anatomy: Australopithecus, Pithecanthropus, Sinanthropus, Neanderthal, Piltdown, and Cro-Magnon. Notice Piltdown at bottom left — the only skull with a modern-sized braincase and an ape's jaw. It didn't fit because it wasn't real."
  ),
  'The Chemist': figureHtml(
    images.ctScan,
    'CT scan of Piltdown canine tooth',
    "A micro-CT scan of the Piltdown canine tooth from the 2016 De Groote study. The scan revealed gravel fragments stuffed inside the root canal — putty used to weight the tooth and make it feel ancient. The forgery, under modern technology, was almost laughably crude."
  ),
  'The Anatomist': figureHtml(
    images.waterston,
    "Waterston's 1913 jaw comparison",
    "David Waterston's 1913 comparison argued that the Piltdown mandible was ape-like and did not belong with a modern human cranium. He was right, and almost everyone ignored him."
  ),
  'The Truth':
    figureHtml(
      images.hintonTrunk,
      "Martin Hinton's trunk found in the museum attic",
      "A trunk found in the Natural History Museum attic after Martin Hinton's death, containing bones stained with the same chemicals used on the Piltdown forgery. It fuelled decades of speculation — but DNA evidence eventually cleared Hinton."
    ) +
    figureHtml(
      images.memorial,
      'The Piltdown memorial stone',
      "The memorial stone at Piltdown, erected in 1938. It marks the spot where <em>Eoanthropus dawsoni</em> was \"discovered.\" It says nothing about what was really found there."
    ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/piltdown-man.ts');
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
  <p class="epigraph">"The most dangerous lies are not the ones that contradict what we know, but the ones that confirm what we wish."</p>
  <p class="epigraph-attr">— On the Piltdown forgery</p>
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
      <p><strong>1908</strong> — Charles Dawson claims to receive the first skull fragments from labourers at Barkham Manor gravel pit, Piltdown, Sussex.</p>
      <p><strong>1912</strong> — Dawson contacts Arthur Smith Woodward at the Natural History Museum. Together they excavate the site, recovering cranial fragments and a jawbone. Announced at the Geological Society in December.</p>
      <p><strong>1913</strong> — A canine tooth is "found" at the site by Teilhard de Chardin. Waterston publishes doubts in <em>Nature</em>, comparing the jaw to a chimpanzee's. He is ignored.</p>
      <p><strong>1915</strong> — Dawson reports a second Piltdown site ("Piltdown II") with similar fragments, reinforcing the original find. The location is never independently verified.</p>
      <p><strong>1916</strong> — Charles Dawson dies. No further discoveries are ever made at either site.</p>
      <p><strong>1920s–40s</strong> — Genuine hominid fossils from Africa and Asia increasingly contradict the Piltdown narrative. <em>Eoanthropus dawsoni</em> becomes an awkward outlier in human evolution.</p>
      <p><strong>1949</strong> — Kenneth Oakley applies the fluorine absorption test to the Piltdown bones. Results show them to be far younger than claimed — but the significance is not immediately grasped.</p>
      <p><strong>1953</strong> — Joseph Weiner, Oakley, and Le Gros Clark publish their exposé: the jaw is a modern orangutan's, the teeth have been filed, and the bones stained with iron solution and chromate. The fraud is over.</p>
      <p><strong>2016</strong> — Isabelle De Groote et al. publish a comprehensive forensic study using CT scanning and DNA analysis. Conclusion: a single forger — almost certainly Dawson — created all the Piltdown specimens.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key claims, and scientific context are grounded in primary sources and later scholarship; dialogue and some scene detail are imaginatively reconstructed to bring the history to life.</p>
      <p>Key sources include Dawson and Woodward's original reports (1912–1913), the mid-century investigations that exposed the forgery (Weiner, Oakley &amp; Le Gros Clark, 1953), and the comprehensive 2016 forensic study by De Groote et al. that used CT imaging and DNA analysis to support a single-hoaxer hypothesis.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Dawson, C. &amp; Woodward, A. S. — "On the Discovery of a Palaeolithic Human Skull," <em>Quarterly Journal of the Geological Society</em>, 1913</p>
      <p>Weiner, J. S. — <em>The Piltdown Forgery</em>, Oxford University Press, 1955</p>
      <p>De Groote, I. et al. — "New genetic and morphological evidence suggests a single hoaxer created 'Piltdown man'," <em>Royal Society Open Science</em>, 2016</p>
      <p>Walsh, J. E. — <em>Unraveling Piltdown</em>, Random House, 1996</p>
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
    const coverPath = resolve(COVER_DIR, `${book.slug}.jpg`);

    if (!existsSync(coverPath)) {
      await generateCover({
        backgroundImage: resolve(ROOT, 'public/cases/images/hero-gravel-pit.jpg'),
        title: 'The Piltdown\nMen',
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
