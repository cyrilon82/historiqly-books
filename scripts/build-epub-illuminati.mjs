import { EPub } from 'epub-gen-memory';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
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
  title: 'The Illuminati',
  subtitle: 'Nine Years That Conquered the World\'s Imagination',
  author: 'HistorIQly',
  series: 'Vol. 6: Secret Societies',
  slug: 'illuminati',
  description:
    'On May 1, 1776, a young professor in Bavaria founded a secret order to overthrow superstition and reshape society. Nine years later, the Illuminati were destroyed. Two centuries later, they are more powerful as a myth than they ever were as an organisation.',
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
  weishaupt: imgFileUrl('figure-weishaupt-portrait.jpg'),
  knigge: imgFileUrl('suspect-knigge.jpg'),
  karlTheodor: imgFileUrl('figure-karl-theodor.jpg'),
  minervalSeal: imgFileUrl('evidence-minerval-seal.png'),
  eyeOfProvidence: imgFileUrl('hero-eye-of-providence.jpg'),
  masonicInitiation: imgFileUrl('atmosphere-masonic-initiation.jpg'),
  bastille: imgFileUrl('atmosphere-storming-bastille.jpg'),
  barruel: imgFileUrl('suspect-barruel.jpg'),
  robison: imgFileUrl('suspect-robison.jpg'),
  bode: imgFileUrl('suspect-bode.jpg'),
  deathMask: imgFileUrl('evidence-weishaupt-death-mask.jpg'),
  declarationRights: imgFileUrl('evidence-declaration-rights-man.jpg'),
  wilhelmsbad: imgFileUrl('atmosphere-wilhelmsbad-ruins.jpg'),
  ingolstadt: imgFileUrl('atmosphere-ingolstadt-kreuztor.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Professor': figureHtml(
    images.weishaupt,
    'Adam Weishaupt, founder of the Bavarian Illuminati',
    'Adam Weishaupt (1748–1830), engraved by Friedrich Rossmassler in 1799. The youngest professor of canon law at the University of Ingolstadt, he founded the Order of the Illuminati on May 1, 1776 — the same year as American independence.'
  ),
  'Philo and Spartacus': figureHtml(
    images.knigge,
    'Baron Adolph von Knigge, key Illuminati recruiter',
    'Baron Adolph Freiherr von Knigge (1752–1796), code name Philo. He joined the Illuminati in 1780 and transformed it from a small Bavarian club into a pan-German network by grafting the order onto the Masonic lodge system.'
  ),
  'The Secret Machinery': figureHtml(
    images.minervalSeal,
    'The Minerval insignia of the Bavarian Illuminati',
    'The Minerval insignia — the Owl of Minerva perched on an open book. This was the actual symbol of the Illuminati, not the Eye of Providence commonly associated with them today.'
  ),
  'The Thunderbolt': figureHtml(
    images.karlTheodor,
    'Karl Theodor, Elector of Bavaria',
    'Karl Theodor, Elector of Bavaria (1724–1799), painted by Anna Dorothea Therbusch. He issued the edicts of 1784–1787 that suppressed the Illuminati, the final one threatening death for membership.'
  ),
  'The Ghost That Would Not Die': figureHtml(
    images.bastille,
    'Storming of the Bastille, July 14, 1789',
    'The Storming of the Bastille, July 14, 1789. Anonymous painting, Palace of Versailles. Barruel and Robison both claimed the Illuminati orchestrated the French Revolution — a theory for which there is no credible evidence.'
  ),
  'The All-Seeing Eye': figureHtml(
    images.eyeOfProvidence,
    'The Eye of Providence on the US one-dollar bill',
    'The Eye of Providence on the reverse of the US one-dollar bill. The Illuminati\'s actual symbol was the Owl of Minerva — the association with the Eye of Providence is a modern conflation driven by conspiracy culture.'
  ),
  'The Verdict': figureHtml(
    images.ingolstadt,
    'The Kreuztor gate of Ingolstadt, Bavaria',
    'The Kreuztor, the medieval gate of Ingolstadt. The city where Weishaupt founded the Illuminati with five students in 1776 remembers the order as a footnote — while the conspiracy theory it spawned has become one of the most enduring in Western history.'
  ),
  'The Owl at Dusk': figureHtml(
    images.deathMask,
    'Image from Leopold Engel\'s Geschichte des Illuminaten-Ordens, 1906',
    'From Leopold Engel\'s <em>Geschichte des Illuminaten-Ordens</em> (1906). Weishaupt died in Gotha in 1830, aged 82, largely forgotten. His order lasted nine years. The conspiracy theory about his order has lasted more than two centuries.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/illuminati.ts');
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
  <p class="epigraph">"The owl of Minerva spreads its wings only with the falling of the dusk."</p>
  <p class="epigraph-attr">— G.W.F. Hegel, <em>Philosophy of Right</em>, 1820</p>
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
      <p><strong>1748</strong> — Adam Weishaupt is born in Ingolstadt, Bavaria. His father is a professor of law at the University of Ingolstadt.</p>
      <p><strong>1773</strong> — Pope Clement XIV suppresses the Jesuit order. Weishaupt, aged 25, becomes the first non-Jesuit to hold the chair of canon law at Ingolstadt.</p>
      <p><strong>1776 (May 1)</strong> — Weishaupt founds the Order of the Illuminati (originally "Perfectibilists") with five students at the University of Ingolstadt. He takes the code name Spartacus.</p>
      <p><strong>1777</strong> — Weishaupt is initiated into Freemasonry at the Lodge Theodore of Good Counsel in Munich, laying the groundwork for later Masonic infiltration.</p>
      <p><strong>1780</strong> — Baron Adolph von Knigge (code name Philo) joins the order. He redesigns the degree system to nest within Masonic lodges, enabling explosive growth.</p>
      <p><strong>1782</strong> — Congress of Wilhelmsbad. The Illuminati secure influence over multiple Masonic lodges across the German-speaking world. Peak influence.</p>
      <p><strong>1783</strong> — Internal dissent begins. Former members Utzschneider, Grünberger, and Cosandey submit a formal denunciation to the Bavarian Electress.</p>
      <p><strong>1784 (April)</strong> — Knigge resigns from the order after an irreconcilable clash with Weishaupt over control.</p>
      <p><strong>1784 (June 22)</strong> — Karl Theodor, Elector of Bavaria, issues the first edict banning all secret societies not authorised by law.</p>
      <p><strong>1785 (March 2)</strong> — Second edict specifically names and bans the Illuminati. Weishaupt flees to Gotha, where Duke Ernest II of Saxe-Gotha-Altenburg gives him refuge.</p>
      <p><strong>1786 (October)</strong> — Police raid the home of Xavier von Zwack in Landshut, seizing the order's internal correspondence, membership lists, cipher keys, and instructions.</p>
      <p><strong>1787</strong> — The Bavarian government publishes the seized documents as <em>Einige Originalschriften des Illuminatenordens</em>. A third edict threatens death for membership. The order effectively ceases to exist.</p>
      <p><strong>1789 (July 14)</strong> — The French Revolution begins with the storming of the Bastille. The Illuminati have been defunct for two years.</p>
      <p><strong>1797</strong> — Augustin Barruel publishes <em>Mémoires pour servir à l'histoire du Jacobinisme</em>. John Robison publishes <em>Proofs of a Conspiracy</em>. Both blame the Illuminati for the French Revolution.</p>
      <p><strong>1798</strong> — George Washington writes a letter acknowledging the Illuminati scare but expressing doubt that they infiltrated American lodges.</p>
      <p><strong>1830 (November 18)</strong> — Adam Weishaupt dies in Gotha at the age of 82, largely forgotten.</p>
      <p><strong>1935</strong> — The reverse of the Great Seal of the United States — featuring the Eye of Providence — is placed on the one-dollar bill by order of Franklin D. Roosevelt.</p>
      <p><strong>1975</strong> — Robert Shea and Robert Anton Wilson publish <em>The Illuminatus! Trilogy</em>, blending real history with conspiracy satire.</p>
      <p><strong>2000</strong> — Dan Brown's <em>Angels & Demons</em> features an Illuminati plot against the Vatican, reigniting popular fascination.</p>
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
      <p>Markner, Reinhard, and Neugebauer-Wölk, Monika — <em>Die Korrespondenz des Illuminatenordens</em>, 2 vols., Max Niemeyer Verlag, 2005–2013</p>
      <p>Stauffer, Vernon — <em>New England and the Bavarian Illuminati</em>, Columbia University Press, 1918</p>
      <p>Roberts, J.M. — <em>The Mythology of the Secret Societies</em>, Secker & Warburg, 1972</p>
      <p>Melanson, Terry — <em>Perfectibilists: The 18th Century Bavarian Order of the Illuminati</em>, Trine Day, 2009</p>
      <p>Bieberstein, Johannes Rogalla von — <em>Die These von der Verschwörung 1776–1945</em>, Herbert Lang, 1976</p>
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

    await generateCover({
      backgroundImage: resolve(IMG_DIR, 'atmosphere-ingolstadt-kreuztor.jpg'),
      title: 'The\nIlluminati',
      subtitle: book.subtitle,
      series: book.series,
      author: book.author,
      outputPath: coverPath,
    });

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
