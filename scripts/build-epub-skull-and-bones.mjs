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
  title: 'Skull and Bones',
  subtitle: 'The Order Behind the Power',
  author: 'HistorIQly',
  series: 'Vol. 6: Secret Societies',
  slug: 'skull-and-bones',
  description:
    'Founded in 1832 at Yale University, Skull and Bones has produced three presidents, a CIA director, and some of the most powerful figures in American history. Fifteen souls are chosen each year. They enter a windowless tomb. What happens inside has shaped the course of a nation.',
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
  tomb: imgFileUrl('hero-skull-and-bones-tomb.jpg'),
  logo: imgFileUrl('evidence-bones-logo-322.jpg'),
  kingsley: imgFileUrl('evidence-bones-kingsley.jpg'),
  classPhoto: imgFileUrl('evidence-class-of-1920.jpg'),
  geronimoGrave: imgFileUrl('evidence-geronimo-grave.jpg'),
  bushCIA: imgFileUrl('evidence-bush-cia-director-1976.jpg'),
  russell: imgFileUrl('figure-william-huntington-russell.jpg'),
  alphonsoTaft: imgFileUrl('figure-alphonso-taft.jpg'),
  whtTaft: imgFileUrl('figure-william-howard-taft-yale.jpg'),
  prescottBush: imgFileUrl('figure-prescott-bush.jpg'),
  ghwBush: imgFileUrl('figure-george-hw-bush.jpg'),
  gwBush: imgFileUrl('figure-george-w-bush.jpg'),
  kerry: imgFileUrl('figure-john-kerry.jpg'),
  stimson: imgFileUrl('figure-henry-stimson.jpg'),
  luce: imgFileUrl('figure-henry-luce.jpg'),
  bundy: imgFileUrl('figure-mcgeorge-bundy.jpg'),
  geronimo: imgFileUrl('figure-geronimo-portrait.jpg'),
  yale: imgFileUrl('atmosphere-yale-harkness-tower.jpg'),
  deerIsland: imgFileUrl('location-deer-island.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The German Connection': figureHtml(
    images.russell,
    'William Huntington Russell, co-founder of Skull and Bones',
    'William Huntington Russell, who returned from studying in Germany in 1832 with a vision for a new kind of secret society at Yale. He and Alphonso Taft founded The Order that same year.'
  ),
  'The Tomb': figureHtml(
    images.tomb,
    'The Skull and Bones Tomb at Yale University',
    'The Tomb — the windowless sandstone hall at 64 High Street, New Haven. Built in 1856 and expanded over the decades, it has no windows on the ground floor and its interior remains one of the most closely guarded secrets in American collegiate life.'
  ),
  'The Tapping': figureHtml(
    images.classPhoto,
    'Skull and Bones class photograph, circa 1920',
    'A Skull and Bones class photograph from around 1920, showing members including future Time magazine founder Henry Luce and Briton Hadden. Each year, exactly fifteen juniors are "tapped" — summoned to join The Order.'
  ),
  'The Architects': figureHtml(
    images.stimson,
    'Henry Stimson, Secretary of War',
    'Henry Stimson (Bones 1888), who served as Secretary of War under both Taft and Roosevelt, and as Secretary of State under Hoover. He oversaw the Manhattan Project and shaped American foreign policy for four decades.'
  ),
  'The Stolen Bones': figureHtml(
    images.geronimo,
    'Geronimo, Apache leader, photographed by Edward Curtis',
    'Geronimo, the legendary Apache leader. In 1918, Prescott Bush and fellow Bonesmen allegedly raided his grave at Fort Sill, Oklahoma, stealing his skull for display in The Tomb. The claim has never been definitively proven — or disproven.'
  ),
  'The Spymasters': figureHtml(
    images.bundy,
    'McGeorge Bundy, National Security Advisor',
    'McGeorge Bundy (Bones 1940), who served as National Security Advisor to Presidents Kennedy and Johnson. The intelligence community was so densely populated with Bonesmen that one could trace a direct line from The Tomb to the corridors of power at Langley.'
  ),
  'The Election': figureHtml(
    images.kerry,
    'John Kerry, U.S. Secretary of State',
    'John Kerry (Bones 1966) and George W. Bush (Bones 1968) faced each other in the 2004 presidential election — the only time in American history that both major-party candidates belonged to the same secret society.'
  ),
  'The Verdict': figureHtml(
    images.yale,
    'Harkness Tower at Yale University',
    'Harkness Tower rises over the Yale campus. For nearly two centuries, Skull and Bones has been woven into the fabric of this university and, through its alumni, into the fabric of American power itself.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/skull-and-bones.ts');
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
  <p class="epigraph">"Who is worthy? Who is not? Those are the only questions that matter."</p>
  <p class="epigraph-attr">— Lyman Bagg, <em>Four Years at Yale</em>, 1871</p>
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
      <p><strong>1832</strong> — William Huntington Russell and Alphonso Taft found the Order of Skull and Bones at Yale College, reportedly in response to Phi Beta Kappa's decision to abandon its secrecy. The number 322 becomes the society's emblem, possibly referencing the year 322 BC and the death of the Athenian orator Demosthenes.</p>
      <p><strong>1856</strong> — The Russell Trust Association is incorporated to manage Skull and Bones' finances and property. Construction begins on The Tomb, the society's windowless headquarters at 64 High Street, New Haven.</p>
      <p><strong>1876</strong> — A group of students calling themselves "The Order of File and Claw" breaks into The Tomb and publishes a description of its interior, including a room they call "the Inner Temple," filled with skulls, bones, and Masonic-style regalia.</p>
      <p><strong>1878</strong> — William Howard Taft (Bones 1878), son of co-founder Alphonso Taft, is tapped. He will become the 27th President of the United States and later Chief Justice of the Supreme Court — the only person to hold both offices.</p>
      <p><strong>1888</strong> — Henry Stimson (Bones 1888) is tapped. He will serve as Secretary of War under two presidents and Secretary of State under a third, overseeing the Manhattan Project and the decision to use the atomic bomb.</p>
      <p><strong>1903</strong> — Deer Island, a private retreat in the Thousand Islands of the St. Lawrence River, is acquired for Bones members' use.</p>
      <p><strong>1917</strong> — Prescott Bush (Bones 1917) is tapped. He and fellow Bonesmen allegedly raid the grave of Apache leader Geronimo at Fort Sill, Oklahoma, stealing his skull for display in The Tomb.</p>
      <p><strong>1920</strong> — Henry Luce and Briton Hadden (both Bones 1920) are tapped in the same class. Three years later, they will found Time magazine, transforming American journalism.</p>
      <p><strong>1940</strong> — McGeorge Bundy (Bones 1940) is tapped. He will serve as National Security Advisor to Presidents Kennedy and Johnson during the most dangerous years of the Cold War.</p>
      <p><strong>1948</strong> — George H. W. Bush (Bones 1948) is tapped. He will serve as CIA Director, Vice President, and the 41st President of the United States.</p>
      <p><strong>1966</strong> — John Kerry (Bones 1966) is tapped. He will serve as a U.S. Senator, presidential candidate, and Secretary of State.</p>
      <p><strong>1968</strong> — George W. Bush (Bones 1968) is tapped, continuing the family tradition. He will become the 43rd President of the United States.</p>
      <p><strong>1991</strong> — Skull and Bones votes to admit women for the first time, over the objection of some alumni. The decision is initially blocked by a group of older members but ultimately prevails.</p>
      <p><strong>2004</strong> — George W. Bush and John Kerry face each other in the presidential election — the only time in American history that both major-party candidates belonged to the same secret society. Both refuse to discuss their membership in televised interviews.</p>
      <p><strong>2009</strong> — Skull and Bones members file a federal lawsuit seeking the return of Geronimo's remains, sparking renewed public interest in the society's most controversial alleged theft.</p>
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
      <p>Robbins, Alexandra — <em>Secrets of the Tomb: Skull and Bones, the Ivy League, and the Hidden Paths of Power</em>, Back Bay Books, 2003</p>
      <p>Sutton, Antony C. — <em>America's Secret Establishment: An Introduction to the Order of Skull & Bones</em>, Trine Day, 2004</p>
      <p>Millegan, Kris (ed.) — <em>Fleshing Out Skull & Bones: Investigations into America's Most Powerful Secret Society</em>, Trine Day, 2003</p>
      <p>Rosenbaum, Ron — "The Last Secrets of Skull and Bones," <em>Esquire</em>, 1977</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-skull-and-bones-tomb.jpg'),
        title: 'Skull and\nBones',
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
