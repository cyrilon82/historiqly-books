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
  title: 'Hollywood Pirates',
  subtitle: 'Were Pirates Really Like the Movies?',
  author: 'HistorIQly',
  series: 'Vol. 2: Historical Myths Debunked',
  slug: 'hollywood-pirates',
  description:
    'Everything you think you know about pirates is wrong. The eye patches, the buried treasure, the walking the plank — nearly all of it was invented by novelists and Hollywood. The real Golden Age of Piracy was stranger, more democratic, and more brutal than any movie. This is the true story.',
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
  hero: imgFileUrl('hero-attack-on-galleon.jpg'),
  blackbeard: imgFileUrl('suspect-blackbeard-engraving.jpg'),
  roberts: imgFileUrl('suspect-bartholomew-roberts.jpg'),
  anneBonny: imgFileUrl('suspect-anne-bonny-mary-read.jpg'),
  blackBart: imgFileUrl('suspect-black-bart-portrait.jpg'),
  plank: imgFileUrl('walking-the-plank-pyle.jpg'),
  jollyRoger: imgFileUrl('jolly-roger-rackham.png'),
  kidd: imgFileUrl('captain-kidd-hanging.jpg'),
  burying: imgFileUrl('pirates-burying-treasure-pyle.jpg'),
  treasureIsland: imgFileUrl('treasure-island-captain-bones.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Invention of Arrr': figureHtml(
    images.treasureIsland,
    'N.C. Wyeth illustration of Captain Bill Bones from Treasure Island',
    'N.C. Wyeth\'s 1911 painting of Captain Bill Bones from Robert Louis Stevenson\'s <em>Treasure Island</em>. Stevenson\'s 1883 novel invented most of the pirate tropes that Hollywood later adopted — treasure maps, parrots, the one-legged pirate, and "Yo-ho-ho and a bottle of rum."'
  ),
  'The Golden Age': figureHtml(
    images.hero,
    'Howard Pyle — An Attack on a Galleon, 1905',
    'Howard Pyle\'s <em>An Attack on a Galleon</em> (1905). Pyle\'s paintings, created for magazines and books in the early 1900s, gave the Golden Age of Piracy its definitive visual language — and became the template for every pirate film that followed.'
  ),
  'The Pirate Republic': figureHtml(
    images.jollyRoger,
    'The Jolly Roger of Calico Jack Rackham',
    'The flag of John "Calico Jack" Rackham — a skull above two crossed swords. Each pirate captain had a unique flag; the standardised skull-and-crossbones is a Hollywood invention. Blackbeard\'s flag showed a skeleton spearing a bleeding heart.'
  ),
  'The Most Successful Pirate You Have Never Heard Of': figureHtml(
    images.roberts,
    'Captain Bartholomew Roberts with two ships, 1724 engraving',
    'Captain Bartholomew Roberts with his ships the <em>Royal Fortune</em> and <em>Ranger</em> at Whydah, West Africa, January 1722. Roberts captured over 400 ships in three years — more than any other pirate in history. He drank tea, not rum, and dressed in crimson damask.'
  ),
  'The Real Blackbeard': figureHtml(
    images.blackbeard,
    'Edward Teach, commonly called Blackbeard — 1736 engraving',
    'The iconic 1736 engraving of Edward Teach — Blackbeard. He tucked slow-burning fuses into his hat so that his head was wreathed in smoke during battle. Despite his terrifying image, there is no verified account of Teach killing anyone before his final fight.'
  ),
  'Women, Freedom, and the Black Flag': figureHtml(
    images.anneBonny,
    'Anne Bonny and Mary Read, 1724 engraving',
    'Anne Bonny and Mary Read, from <em>A General History of the Pyrates</em> (1724). When their ship was captured, they were the only crew members who fought back. Bonny\'s last words to her captain: "Had you fought like a man, you need not have been hanged like a dog."'
  ),
  'X Never Marked the Spot': figureHtml(
    images.burying,
    'Howard Pyle — Blackbeard Buries His Treasure, 1887',
    'Howard Pyle\'s <em>Blackbeard Buries His Treasure</em> (1887). In reality, almost no pirates buried treasure — they spent it immediately. Captain Kidd is the only documented case, and his "treasure" was a few bags buried on a Long Island sheep farm.'
  ),
  'The End of the Age': figureHtml(
    images.kidd,
    'Captain Kidd hanging in chains over the Thames',
    'Captain William Kidd\'s body, coated in tar and locked in an iron cage, hanging from a gibbet over the Thames after his execution in 1701. His body was displayed for years as a warning to sailors. By 1726, the Golden Age was over — killed by pardons, patrols, and the gallows.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/hollywood-pirates.ts');
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
  <p class="epigraph">"In an honest Service there is thin Commons, low Wages, and hard Labour; in this, Plenty and Satiety, Pleasure and Ease, Liberty and Power."</p>
  <p class="epigraph-attr">— Bartholomew Roberts, c. 1720</p>
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
      <p><strong>1650s</strong> — The age of the buccaneers begins in the Caribbean. French and English hunters on Hispaniola, driven from the land by the Spanish, take to the sea and begin raiding Spanish shipping.</p>
      <p><strong>1668</strong> — Henry Morgan attacks Portobelo, using captured monks as human shields. The plunder is immense.</p>
      <p><strong>1671</strong> — Morgan sacks Panama City with 1,400 men. The city burns. He is arrested, sent to London, knighted, and returned to Jamaica as Lieutenant Governor.</p>
      <p><strong>1690s</strong> — The Pirate Round begins. Pirates sail from the American colonies to the Indian Ocean, attacking Mughal treasure ships and establishing bases in Madagascar.</p>
      <p><strong>1695</strong> — Henry Every captures the <em>Ganj-i-Sawai</em>, one of the largest pirate hauls in history. He is never caught.</p>
      <p><strong>1701</strong> — Captain William Kidd is hanged at Execution Dock, London. His body is displayed in a gibbet over the Thames for years.</p>
      <p><strong>1713</strong> — The War of the Spanish Succession ends. Thousands of trained sailors are discharged from the Royal Navy and turn to piracy.</p>
      <p><strong>1716–1718</strong> — The pirate republic at Nassau, Bahamas, reaches its peak. Home to roughly 1,000 pirates including Blackbeard, Charles Vane, Jack Rackham, Anne Bonny, and Mary Read.</p>
      <p><strong>1717</strong> — Sam Bellamy and the <em>Whydah</em> go down in a nor'easter off Cape Cod. Bellamy's diverse crew included at least 25 Africans.</p>
      <p><strong>May 1718</strong> — Blackbeard blockades Charleston, South Carolina, for a week. His demand: a chest of medicine.</p>
      <p><strong>July 1718</strong> — Woodes Rogers arrives in Nassau with the King's Pardon. Hundreds of pirates surrender. The pirate republic collapses.</p>
      <p><strong>November 1718</strong> — Blackbeard is killed by Lt. Robert Maynard at Ocracoke. He sustains five gunshot wounds and over twenty sword cuts before dying.</p>
      <p><strong>November 1720</strong> — Jack Rackham, Anne Bonny, and Mary Read are captured. Rackham is hanged. Bonny and Read plead pregnancy and are spared.</p>
      <p><strong>1719–1722</strong> — Bartholomew Roberts captures over 400 ships in three years — more than any pirate in history.</p>
      <p><strong>February 1722</strong> — Roberts is killed by grapeshot off Cape Lopez, Gabon. His crew throws his body overboard in his finest clothes.</p>
      <p><strong>1726</strong> — The Golden Age of Piracy is effectively over.</p>
      <p><strong>1883</strong> — Robert Louis Stevenson publishes <em>Treasure Island</em>, inventing the pirate archetype that would dominate popular culture for the next 150 years.</p>
      <p><strong>1950</strong> — Robert Newton plays Long John Silver in Disney's <em>Treasure Island</em>, inventing the "pirate accent" that every pirate in every movie has used since.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a narrative non-fiction work examining the myths and realities of Golden Age piracy. The historical framework is grounded in primary sources and academic scholarship; narrative details are reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Rediker, Marcus — <em>Villains of All Nations: Atlantic Pirates in the Golden Age</em>, Beacon Press, 2004</p>
      <p>Woodard, Colin — <em>The Republic of Pirates: Being the True and Surprising Story of the Caribbean Pirates and the Man Who Brought Them Down</em>, Harcourt, 2007</p>
      <p>Johnson, Charles (attrib. Daniel Defoe) — <em>A General History of the Pyrates</em>, 1724</p>
      <p>Cordingly, David — <em>Under the Black Flag: The Romance and Reality of Life Among the Pirates</em>, Random House, 1995</p>
      <p>Konstam, Angus — <em>The History of Pirates</em>, Lyons Press, 2002</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-attack-on-galleon.jpg'),
        title: 'Hollywood\nPirates',
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
