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
  title: 'The Hitler Diaries',
  subtitle: 'The Forgery That Fooled the World',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'hitler-diaries',
  description:
    'In 1983, a Stuttgart con man and a Nazi-obsessed reporter convinced one of the world\'s biggest magazines to pay millions for sixty-two volumes of Adolf Hitler\'s secret diaries. Within eleven days, the entire thing collapsed. This is the true story of greed, gullibility, and the greatest media hoax of the twentieth century.',
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
  kujauGallery: imgFileUrl('kujau-gallery.jpg'),
  kujauPainting: imgFileUrl('kujau-painting.jpg'),
  kujauArchive: imgFileUrl('kujau-archive.jpg'),
  trevorRoper: imgFileUrl('suspect-trevor-roper.jpg'),
  murdoch: imgFileUrl('suspect-murdoch.jpg'),
  forgedSignature: imgFileUrl('forged-signature.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Forger': figureHtml(
    images.kujauPainting,
    'Konrad Kujau painting in his Stuttgart gallery, 1992',
    'Konrad Kujau at work in his Stuttgart gallery in 1992, after his release from prison. He reinvented himself as a celebrity artist, selling acknowledged forgeries under his own name. "A genuine Kujau forgery," his advertisements read.'
  ),
  'The Deal': figureHtml(
    images.forgedSignature,
    'Forged Hitler signature by Konrad Kujau',
    'A forged Adolf Hitler signature produced by Konrad Kujau. His forgeries were so prolific that they contaminated the pool of "authenticated" Hitler writings used to validate the diaries — a self-reinforcing loop of deception.'
  ),
  'The Expert': figureHtml(
    images.trevorRoper,
    'Hugh Trevor-Roper at a book presentation in Amsterdam, 1975',
    'Hugh Trevor-Roper (later Lord Dacre), photographed in 1975 at a presentation of a book about Hitler\'s Germany — a subject he knew better than almost anyone alive. His authentication of the diaries gave them the stamp of Oxford authority. His reversal came too late.'
  ),
  'The Press Conference': figureHtml(
    images.murdoch,
    'Rupert Murdoch at the World Economic Forum',
    'Rupert Murdoch, whose Sunday Times had purchased British serialisation rights. When Trevor-Roper wavered, Murdoch reportedly said: "Fuck Dacre. Publish."'
  ),
  'The Unravelling': figureHtml(
    images.kujauGallery,
    'Konrad Kujau portrait in his gallery',
    'Konrad Kujau in his Stuttgart gallery. Within eleven days of Stern\'s triumphant press conference, forensic analysis had demolished the diaries. The paper contained blankophor — an optical brightener not manufactured until after WWII. The ink, the thread, the glue: all modern.'
  ),
  'The Afterlife': figureHtml(
    images.kujauArchive,
    'Konrad Kujau at his archive gallery in Stuttgart',
    'Kujau in his gallery after prison, surrounded by his acknowledged forgeries. He ran for mayor of Stuttgart in 1996 on a platform of "transparency." He died of cancer in 2000 at sixty-two — the same number as the volumes he forged.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/hitler-diaries.ts');
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
  <p class="epigraph">"The forger's job is not to create a perfect copy. It is to create an object that activates the buyer's desire to believe."</p>
  <p class="epigraph-attr">— On the art of Konrad Kujau</p>
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
      <p><strong>1938</strong> — Konrad Kujau is born in Löbau, Saxony. He grows up in East Germany, where he begins a lifelong career of petty forgery and theft.</p>
      <p><strong>1957</strong> — Kujau flees East Germany for the West. He settles in Stuttgart and establishes himself as a dealer in Nazi memorabilia.</p>
      <p><strong>1970s</strong> — Kujau begins forging Nazi documents, paintings, and signed photographs, selling them to collectors. His forgeries enter the pool of "authenticated" Hitler writings.</p>
      <p><strong>Mid-1970s</strong> — Gerd Heidemann, a reporter for <em>Stern</em> magazine, purchases Hermann Göring's former yacht, the <em>Carin II</em>. The restoration bankrupts him.</p>
      <p><strong>~1978–1979</strong> — Kujau begins producing the Hitler diary volumes. He writes sixty-two notebooks by hand, using modern materials aged with tea and physical distressing. The Gothic initials on the covers read "FH" instead of "AH."</p>
      <p><strong>1980</strong> — Heidemann is shown a diary volume by collector Fritz Stiefel. He traces the source to Kujau, operating under the alias "Konrad Fischer."</p>
      <p><strong>Early 1981</strong> — Heidemann convinces <em>Stern</em> management to purchase the diaries. Handwriting is compared to "known" Hitler specimens — many of which were also forged by Kujau.</p>
      <p><strong>1981–1983</strong> — <em>Stern</em> pays approximately 9.3 million Deutsche Marks in instalments. Heidemann embezzles 1.7–2.5 million DM. No forensic analysis is conducted.</p>
      <p><strong>Early April 1983</strong> — Hugh Trevor-Roper (Lord Dacre) is flown to a Swiss bank vault in Zurich to authenticate the diaries. Under time pressure, he declares them genuine.</p>
      <p><strong>April 22, 1983</strong> — <em>Stern</em> announces the discovery to the international press. Serialisation rights are sold to <em>The Sunday Times</em>, <em>Newsweek</em>, <em>Paris Match</em>, and others.</p>
      <p><strong>April 24, 1983</strong> — <em>The Sunday Times</em> scoops <em>Stern</em> by one day, publishing extracts alongside Trevor-Roper's authentication.</p>
      <p><strong>April 25, 1983</strong> — <em>Stern</em>'s press conference in Hamburg. David Irving denounces the diaries as fakes. Trevor-Roper begins to waver publicly.</p>
      <p><strong>Late April 1983</strong> — International publications run the story. Historians and handwriting experts voice growing scepticism.</p>
      <p><strong>May 6, 1983</strong> — The Bundesarchiv declares the diaries "grotesque and superficial forgeries." Paper contains blankophor (postwar optical brightener); ink, thread, and binding materials are all modern. Eleven days after the press conference, the hoax is dead.</p>
      <p><strong>May 1983</strong> — Kujau and Heidemann are arrested. Peter Koch is fired as <em>Stern</em> editor-in-chief.</p>
      <p><strong>August 1984 – July 1985</strong> — Trial in Hamburg. Kujau demonstrates his forgery skills in court, copying paintings on the spot.</p>
      <p><strong>July 8, 1985</strong> — Kujau is sentenced to 4 years 6 months; Heidemann to 4 years 8 months. Both serve approximately 3 years.</p>
      <p><strong>~1988</strong> — Both men are released. Kujau opens a gallery selling acknowledged forgeries and becomes a minor celebrity.</p>
      <p><strong>1996</strong> — Kujau runs for mayor of Stuttgart on a platform of "transparency." He loses.</p>
      <p><strong>September 12, 2000</strong> — Konrad Kujau dies of cancer in Stuttgart at sixty-two.</p>
      <p><strong>January 26, 2003</strong> — Hugh Trevor-Roper dies. The Hitler Diaries feature prominently in every obituary.</p>
      <p><strong>December 2024</strong> — Gerd Heidemann dies at ninety-three.</p>
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
      <p>Harris, Robert — <em>Selling Hitler</em>, Faber and Faber, 1986</p>
      <p>Hamilton, Charles — <em>The Hitler Diaries: Fakes That Fooled the World</em>, University Press of Kentucky, 1991</p>
      <p>Trevor-Roper, Hugh — <em>The Last Days of Hitler</em>, Macmillan, 1947</p>
      <p>Domarus, Max — <em>Hitler: Speeches and Proclamations, 1932–1945</em>, Bolchazy-Carducci, 1990</p>
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
        backgroundImage: resolve(IMG_DIR, 'kujau-painting.jpg'),
        title: 'The Hitler\nDiaries',
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
