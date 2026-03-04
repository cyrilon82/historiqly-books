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
  title: 'The Shroud of Turin',
  subtitle: 'The Most Studied Cloth in Human History',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained Phenomena',
  slug: 'shroud-of-turin',
  description:
    'A fourteen-foot linen cloth bearing the faint image of a crucified man has confounded scientists, divided the faithful, and survived fire, war, and centuries of controversy. Is it the burial shroud of Jesus of Nazareth — or history\'s most sophisticated forgery? The answer, after decades of the most intensive scientific investigation ever applied to a single object, is that nobody knows.',
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
  hero: imgFileUrl('hero-shroud-of-turin.jpg'),
  secondoPia1898: imgFileUrl('shroud-secondo-pia-1898.jpg'),
  secondoPiaPortrait: imgFileUrl('suspect-secondo-pia.jpg'),
  holyFace: imgFileUrl('shroud-holy-face-1909.jpg'),
  prayCodex: imgFileUrl('shroud-pray-codex.jpg'),
  negativePositive: imgFileUrl('shroud-negative-positive.jpg'),
  fullNegative: imgFileUrl('shroud-full-negative.jpg'),
  colorComparison: imgFileUrl('shroud-positive-negative-color.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Photograph': figureHtml(
    images.secondoPia1898,
    'The Shroud of Turin as photographed by Secondo Pia in 1898',
    'The photographic negative taken by Secondo Pia in 1898 — the first photograph ever made of the Shroud. When Pia developed the negative plate, the faint positive image of the cloth resolved into a fully formed, three-dimensional portrait. His hands, he later wrote, trembled.'
  ),
  'The Lost Centuries': figureHtml(
    images.prayCodex,
    'The Pray Codex (1192 AD), Hungarian prayer manuscript',
    'A miniature from the Pray Codex (1192 AD), showing Christ being prepared for burial on a cloth bearing a distinctive L-shaped pattern of holes. The same four-hole pattern appears on the Shroud of Turin today — a detail that, if accurately depicted, places the Shroud\'s existence at least 165 years before its first documented appearance in France.'
  ),
  'The House of Savoy': figureHtml(
    images.hero,
    'The Shroud of Turin — the full linen cloth',
    'The full Shroud of Turin as it appears today: 4.37 metres long by 1.10 metres wide, a herringbone-weave linen bearing the faint impressions of a front and back figure, scorch marks from the 1532 fire, and water stains from the effort to extinguish it. The rectangular patches in two parallel rows are the 1532 repairs by Poor Clare nuns.'
  ),
  'The Image Problem': figureHtml(
    images.negativePositive,
    'Shroud of Turin — positive and negative comparison',
    'Left: the Shroud image as it appears to the naked eye — a faint, yellowish impression with little apparent depth or detail. Right: the photographic negative — the image that Secondo Pia first saw in his darkroom in 1898. The reversal of tones produces a fully formed, portrait-quality face. The image on the Shroud is itself already a negative.'
  ),
  'The Scientists': figureHtml(
    images.fullNegative,
    'Full-length negative images of the Shroud of Turin',
    'Full-length negative photographs of the Shroud showing both front (left) and back (right) images of a figure approximately 1.75 to 1.8 metres tall. STURP scientists examined these figures in 1978 with spectrometers, X-ray fluorescence, and ultraviolet imaging equipment, concluding that the image was not paint and that the image-formation mechanism was unknown.'
  ),
  'The Carbon Dating War': figureHtml(
    images.colorComparison,
    'Shroud of Turin positive and negative in colour',
    'The Shroud face in colour, showing the positive image (left) and photographic negative (right). The 1988 radiocarbon dating indicated a date of 1260–1390 AD. Subsequent studies — including infrared spectroscopy, Raman spectroscopy, and wide-angle X-ray scattering — have suggested dates consistent with the first or second century AD. The conflict remains unresolved.'
  ),
  'The Open Question': figureHtml(
    images.holyFace,
    'The Holy Face of Jesus from the Shroud of Turin (1909 photograph)',
    'The face on the Shroud of Turin as reproduced in a 1909 devotional photograph, slightly enhanced for clarity. The face shows a prominent nose, forked beard, and long hair — characteristics that have been a defining influence on Western artistic depictions of Jesus for over a century. Whether the face belongs to Jesus of Nazareth, to an anonymous victim of Roman crucifixion, or to no one at all remains the central unanswered question.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/shroud-of-turin.ts');
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
  <p class="epigraph">"The Shroud is a challenge to our intelligence. It first of all invites us to perceive with humility the profound message it sends to our reason and our life."</p>
  <p class="epigraph-attr">— Pope John Paul II, Turin, 1998</p>
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
      <p><strong>c. 33 AD</strong> — The crucifixion of Jesus of Nazareth in Jerusalem. The Shroud's claimed origin date.</p>
      <p><strong>544 AD</strong> — First credible historical reference to an "image not made by human hands" preserved in Edessa (now Sanliurfa, Turkey). Ian Wilson and others identify this as the Shroud, folded to show only the face.</p>
      <p><strong>944 AD</strong> — The Image of Edessa transferred to Constantinople, capital of the Byzantine Empire.</p>
      <p><strong>1192 AD</strong> — The Pray Codex, a Hungarian prayer manuscript, includes an illumination of Christ's burial showing an L-shaped pattern of holes that matches the pre-1532 burn holes on the Shroud.</p>
      <p><strong>1204 AD</strong> — Constantinople sacked by the Fourth Crusade. The Image of Edessa disappears from the historical record. Some researchers connect this to the Shroud's later emergence in France.</p>
      <p><strong>1357 AD</strong> — The Shroud first appears in recorded history at the collegiate church of Lirey, France, displayed by the widow of knight Geoffroi de Charny. Bishop Henri de Poitiers condemns it as a fake.</p>
      <p><strong>1389 AD</strong> — Bishop Pierre d'Arcis writes to Pope Clement VII claiming his predecessor identified the forger. The claim is never substantiated with documents.</p>
      <p><strong>1453 AD</strong> — Marguerite de Charny transfers the Shroud to the House of Savoy in exchange for a castle and annuity.</p>
      <p><strong>4 December 1532</strong> — Fire breaks out in the Sainte-Chapelle at Chambéry. The Shroud is rescued but damaged by a drop of molten silver and subsequent water. Poor Clare nuns later apply triangular patches to repair the holes.</p>
      <p><strong>1578 AD</strong> — The Savoys move the Shroud from Chambéry to Turin, where it has remained ever since (excepting wartime evacuations).</p>
      <p><strong>1694 AD</strong> — Guarino Guarini's Royal Chapel at Turin Cathedral completed, specifically to house the Shroud.</p>
      <p><strong>28 May 1898</strong> — Italian lawyer and photographer Secondo Pia makes the first photographs of the Shroud. When he develops the negative plates, he discovers that the cloth's image is itself a photographic negative — a positive image appears in the developed negative. He is "overcome with emotion."</p>
      <p><strong>1931 AD</strong> — Professional photographer Giuseppe Enrie takes the second series of photographs, confirming Pia's discovery.</p>
      <p><strong>1973 AD</strong> — Swiss criminologist Max Frei takes tape samples from the Shroud surface and later identifies 48 pollen species, including plants native to the Dead Sea region and the Levant.</p>
      <p><strong>1976 AD</strong> — USAF scientists John Jackson and Eric Jumper feed Shroud photographs into a VP-8 Image Analyzer and discover that the image encodes three-dimensional spatial information — a property unique to the Shroud and inexplicable by conventional image-formation methods.</p>
      <p><strong>8–13 October 1978</strong> — The Shroud of Turin Research Project (STURP), 33 American scientists, conducts 120 hours of direct examination with six tonnes of equipment. Their conclusion: the image is not paint, not dye, not any known applied medium. The image-formation mechanism is unknown.</p>
      <p><strong>1981 AD</strong> — STURP publishes its findings. Walter McCrone publishes his contradictory finding that the image is iron-oxide paint. The dispute is never fully resolved.</p>
      <p><strong>13 October 1988</strong> — Three radiocarbon laboratories (Oxford, Zurich, Arizona) announce simultaneous results: the Shroud linen dates to 1260–1390 AD. Headlines declare it a medieval fake.</p>
      <p><strong>1983 AD</strong> — King Umberto II of Italy bequeaths the Shroud to the Vatican upon his death. The cloth now belongs to the Catholic Church.</p>
      <p><strong>2005 AD</strong> — STURP chemist Ray Rogers publishes a paper in <em>Thermochimica Acta</em> arguing the 1988 carbon dating samples were taken from a medieval repair patch, not the original linen. He dies the same year.</p>
      <p><strong>2013 AD</strong> — Giulio Fanti of the University of Padua publishes infrared and Raman spectroscopy results suggesting a date of 300 BC – 400 AD. The methodology is contested.</p>
      <p><strong>2015 AD</strong> — Pope Francis visits the Shroud in Turin. Two million pilgrims attend the public exposition.</p>
      <p><strong>2020 AD</strong> — Wide-angle X-ray scattering (WAXS) study by De Caro and colleagues suggests an age consistent with first-century AD manufacture. The 1988 carbon date remains the only direct measurement using radiocarbon methodology.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events and published scientific research. The chronology, key figures, and factual framework are grounded in primary sources, peer-reviewed studies, and established historical scholarship. Quotations from historical figures are drawn from documented sources.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Wilson, Ian — <em>The Shroud of Turin: The Burial Cloth of Jesus Christ?</em>, Doubleday, 1978</p>
      <p>Heller, John H. — <em>Report on the Shroud of Turin</em>, Houghton Mifflin, 1983</p>
      <p>Antonacci, Mark — <em>The Resurrection of the Shroud</em>, M. Evans & Company, 2000</p>
      <p>Rogers, Ray N. — "Studies on the radiocarbon sample from the Shroud of Turin," <em>Thermochimica Acta</em> 425 (2005) 189–194</p>
      <p>Fanti, Giulio &amp; Malfi, Pierandrea — <em>The Shroud of Turin: First Century After Christ!</em>, Pan Stanford Publishing, 2015</p>
      <p>De Caro, Liberato et al. — "X-ray Dating of a Turin Shroud's Linen Sample," <em>Heritage</em> 5(2), 2022</p>
      <p>Damon, P.E. et al. — "Radiocarbon Dating of the Shroud of Turin," <em>Nature</em> 337, 611–615, 1989</p>
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
        backgroundImage: resolve(IMG_DIR, 'shroud-secondo-pia-1898.jpg'),
        title: 'The Shroud\nof Turin',
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
