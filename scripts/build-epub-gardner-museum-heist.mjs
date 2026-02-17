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
  title: 'The Gardner Museum Heist',
  subtitle: 'The Night They Stole the Impossible',
  author: 'HistorIQly',
  series: 'Vol. 11: Heists',
  slug: 'gardner-museum-heist',
  description:
    'On March 18, 1990, two men dressed as Boston police officers talked their way into the Isabella Stewart Gardner Museum and walked out with thirteen masterpieces worth half a billion dollars. It remains the largest unsolved art theft in history. The empty frames still hang on the walls.',
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
  hero: imgFileUrl('hero-gardner-museum-empty-frames.jpg'),
  exterior: imgFileUrl('atmosphere-gardner-museum-exterior.jpg'),
  courtyard: imgFileUrl('atmosphere-gardner-museum-courtyard.jpg'),
  dutchRoom: imgFileUrl('location-gardner-dutch-room.jpg'),
  vermeer: imgFileUrl('evidence-vermeer-the-concert.jpg'),
  rembrandtStorm: imgFileUrl('evidence-rembrandt-storm-sea-galilee.jpg'),
  rembrandtLady: imgFileUrl('evidence-rembrandt-lady-gentleman-black.jpg'),
  manet: imgFileUrl('evidence-manet-chez-tortoni.jpg'),
  flinck: imgFileUrl('evidence-flinck-landscape-obelisk.jpg'),
  degas: imgFileUrl('evidence-degas-cortege-florence.jpg'),
  gardner: imgFileUrl('figure-isabella-stewart-gardner-sargent.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Palace': figureHtml(
    images.gardner,
    'Isabella Stewart Gardner, painted by John Singer Sargent, 1888',
    'Isabella Stewart Gardner, painted by John Singer Sargent in 1888. The portrait was considered so provocative — with its low neckline and the suggestion of a halo formed by the wallpaper pattern — that Gardner\'s husband asked Sargent not to exhibit it publicly. It now hangs in the Gothic Room of the museum she built.'
  ),
  'The Night Watch': figureHtml(
    images.dutchRoom,
    'The Dutch Room at the Isabella Stewart Gardner Museum, before the theft',
    'The Dutch Room at the Isabella Stewart Gardner Museum, photographed before the theft. This room housed the Rembrandts and the Vermeer. The paintings hung on damask walls above carved furniture, exactly as Isabella Gardner had arranged them. On the morning of March 18, 1990, five of the frames were empty.'
  ),
  'Eighty-One Minutes': figureHtml(
    images.rembrandtStorm,
    'Rembrandt van Rijn — The Storm on the Sea of Galilee, 1633',
    'Rembrandt\'s The Storm on the Sea of Galilee (1633) — his only known seascape. The thieves cut it from its frame with a blade, leaving jagged edges and paint fragments behind. It has not been seen since March 18, 1990.'
  ),
  'The Morning After': figureHtml(
    images.vermeer,
    'Johannes Vermeer — The Concert, c. 1664',
    'Vermeer\'s The Concert (c. 1664) — one of only thirty-four known paintings by Vermeer. It is considered the most valuable stolen painting in the world, worth an estimated $200–300 million. It was cut from its frame like the Rembrandts.'
  ),
  'The Underworld': figureHtml(
    images.manet,
    'Édouard Manet — Chez Tortoni, c. 1878–1880',
    'Manet\'s Chez Tortoni (c. 1878–1880), a small portrait of a man in a top hat at a Parisian café. It was the only work stolen from the first floor. One of the thieves made a separate trip downstairs specifically to take it — a decision that has never been explained.'
  ),
  'The Press Conference': figureHtml(
    images.hero,
    'Empty frames at the Isabella Stewart Gardner Museum',
    'The empty frames in the Dutch Room of the Isabella Stewart Gardner Museum. Per Isabella Gardner\'s will, nothing in the museum can be moved. The frames have remained in place since the theft, waiting for the paintings to come home.'
  ),
  'Theories and Ghosts': figureHtml(
    images.flinck,
    'Govaert Flinck — Landscape with an Obelisk, 1638',
    'Govaert Flinck\'s Landscape with an Obelisk (1638), long attributed to Rembrandt before being reattributed to his student. It was taken frame and all from the Dutch Room — one of only two paintings not cut from their frames during the heist.'
  ),
  'The Empty Frames': figureHtml(
    images.courtyard,
    'The courtyard of the Isabella Stewart Gardner Museum',
    'The courtyard of the Isabella Stewart Gardner Museum — a four-storey glass-roofed garden modelled on a Venetian palazzo. Isabella Gardner designed it as the heart of her collection. The museum endures, diminished but defiant, its empty frames facing visitors like open questions.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/gardner-museum-heist.ts');
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
  <p class="epigraph">"Gentlemen, this is the police. We have a report of a disturbance."</p>
  <p class="epigraph-attr">— The first words spoken by the thieves at the door of the Isabella Stewart Gardner Museum, 1:24 a.m., March 18, 1990</p>
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
      <p><strong>1840</strong> — Isabella Stewart is born in New York City to a wealthy family.</p>
      <p><strong>1860</strong> — She marries John Lowell Gardner Jr., a Boston Brahmin and heir to a shipping fortune.</p>
      <p><strong>1891</strong> — Isabella inherits $1.75 million from her father and begins collecting art in earnest, guided by Bernard Berenson.</p>
      <p><strong>1899–1901</strong> — Construction of Fenway Court, a Venetian-style palazzo in Boston's Fenway neighbourhood, designed to house her collection.</p>
      <p><strong>January 1, 1903</strong> — The museum opens to the public for the first time, on New Year's Night.</p>
      <p><strong>July 17, 1924</strong> — Isabella Stewart Gardner dies. Her will stipulates that nothing in the museum may be moved or the collection will be dissolved and given to Harvard.</p>
      <p><strong>March 17, 1990 — 12:00 a.m.</strong> — St. Patrick's Day celebrations wind down across Boston. Rick Abath and Randy Hestand begin their overnight shift at the Gardner Museum.</p>
      <p><strong>March 18, 1990 — 1:24 a.m.</strong> — Two men in Boston Police uniforms ring the side entrance buzzer. Abath opens the door, violating museum protocol. The thieves enter and subdue both guards within minutes.</p>
      <p><strong>March 18, 1990 — 1:30–2:45 a.m.</strong> — The thieves spend 81 minutes in the museum. They steal 13 works from the Dutch Room, Short Gallery, and Blue Room. They cut canvases from frames, remove the security tape, and depart through the side entrance.</p>
      <p><strong>March 18, 1990 — 8:15 a.m.</strong> — The morning shift discovers the guards handcuffed in the basement. The theft is reported to Boston Police and the FBI.</p>
      <p><strong>1990–1991</strong> — The FBI investigates security guard Rick Abath, career criminal Myles Connor Jr. (in prison at the time), and Bobby Donati, a Patriarca crime family associate.</p>
      <p><strong>September 1991</strong> — Bobby Donati is found murdered in the trunk of his car in Revere, Massachusetts. If he planned the heist, his knowledge dies with him.</p>
      <p><strong>1997</strong> — Reporter Tom Mashberg claims he was taken to a Brooklyn warehouse and shown what appeared to be Rembrandt's <em>Storm on the Sea of Galilee</em>. The lead goes cold.</p>
      <p><strong>1999</strong> — The FBI sets up a sting operation targeting Carmello Merlino, who has claimed knowledge of the paintings. Merlino is convicted on unrelated charges but never produces the art.</p>
      <p><strong>2004</strong> — Robert Guarente dies. His widow later tells the FBI he gave paintings to Robert Gentile.</p>
      <p><strong>2010</strong> — The museum's reward is raised to $5 million.</p>
      <p><strong>March 18, 2013</strong> — The FBI holds a press conference announcing it has identified the two thieves — members of a New England criminal organisation — but does not name them. Both are believed dead.</p>
      <p><strong>2015</strong> — The FBI searches Robert Gentile's property in Connecticut. No paintings are found.</p>
      <p><strong>2017</strong> — The museum raises its reward to $10 million — the largest art recovery reward in history.</p>
      <p><strong>2021</strong> — Netflix releases <em>This Is a Robbery</em>, a four-part documentary series about the heist. Robert Gentile dies without revealing any information.</p>
      <p><strong>Present</strong> — The case remains the FBI's #1 art crime priority. The empty frames hang in the Dutch Room. The $10 million reward stands. None of the thirteen works have been recovered.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Kurkjian, Stephen — <em>Master Thieves: The Boston Gangsters Who Pulled Off the World's Greatest Art Heist</em>, PublicAffairs, 2015</p>
      <p>Amore, Anthony M. — <em>The Art Thief: A True Story of Love, Crime, and a Dangerous Obsession</em>, 2022</p>
      <p>Boser, Ulrich — <em>The Gardner Heist: The True Story of the World's Largest Unsolved Art Theft</em>, Smithsonian Books, 2009</p>
      <p>Netflix — <em>This Is a Robbery: The World's Biggest Art Heist</em>, documentary series, 2021</p>
      <p>FBI Art Crime Team — "Isabella Stewart Gardner Museum Theft," fbi.gov</p>
      <p>Isabella Stewart Gardner Museum — gardnermuseum.org/organization/theft</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-gardner-museum-empty-frames.jpg'),
        title: 'The Gardner\nMuseum Heist',
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
