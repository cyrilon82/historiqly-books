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
  title: 'The Freemasons',
  subtitle: 'The Builders Who Became a Brotherhood',
  author: 'HistorIQly',
  series: 'Vol. 6: Secret Societies',
  slug: 'freemasons',
  description:
    'From medieval stonemasons to modern conspiracy theories, the Freemasons have shaped revolutions, survived persecution, and inspired centuries of suspicion. This is the true story of the world\'s most famous secret society — the rituals, the power, the scandals, and the slow fade of a fraternity that once counted presidents and kings among its members.',
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
  hero: imgFileUrl('hero-freemasons-emblematic-chart-1877.jpg'),
  heroWashington: imgFileUrl('hero-freemasons-washington-mason-allegory.jpg'),
  washington: imgFileUrl('figure-george-washington-freemason.jpg'),
  franklin: imgFileUrl('figure-benjamin-franklin-duplessis.jpg'),
  morgan: imgFileUrl('figure-william-morgan-anti-mason.jpg'),
  truman: imgFileUrl('figure-president-truman-masonic-regalia.jpg'),
  apron: imgFileUrl('evidence-anti-masonic-apron-1831.jpg'),
  eye: imgFileUrl('evidence-eye-of-providence-1888.jpg'),
  initiation: imgFileUrl('evidence-freemason-initiation-ceremony.jpg'),
  allegorical: imgFileUrl('atmosphere-washington-freemason-allegorical-print.jpg'),
  grandTemple: imgFileUrl('atmosphere-grand-temple-freemasons-hall-london.jpg'),
  gems: imgFileUrl('atmosphere-gems-of-masonry-1859.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Lodge on the Building Site': figureHtml(
    images.gems,
    'Masonic emblematic illustration from 1859',
    'An emblematic plate from "The Gems of Masonry" (1859), rich with the symbols that would define the fraternity — the square and compasses, the pillars, the all-seeing eye.'
  ),
  'The Goose and Gridiron': figureHtml(
    images.grandTemple,
    'Interior of the Grand Temple at Freemasons\' Hall, London',
    'The Grand Temple at Freemasons\' Hall, London — headquarters of the United Grand Lodge of England, the world\'s oldest Grand Lodge. The Art Deco interior, completed in 1933, seats 1,700.'
  ),
  'The Temple': figureHtml(
    images.initiation,
    'Masonic initiation ceremony, c. 1805',
    'A colored engraving depicting the initiation of an apprentice Freemason, c. 1800. The blindfolded candidate stands surrounded by lodge members in a candlelit ceremony — the most widely reproduced image of Masonic ritual.'
  ),
  'The Apron and the Revolution': figureHtml(
    images.allegorical,
    'George Washington depicted as a Freemason',
    'Washington as a Freemason — an allegorical print from the Library of Congress. On September 18, 1793, wearing full Masonic regalia, he laid the Capitol cornerstone with a silver trowel and marble-headed gavel.'
  ),
  'The Hall of Fame': figureHtml(
    images.truman,
    'President Truman in 33rd degree Masonic regalia, 1950',
    'President Harry Truman wearing 33rd degree Scottish Rite regalia at the George Washington Masonic Memorial, February 22, 1950. He called his election as Grand Master of Missouri "the greatest honor that has ever come to me."'
  ),
  'The Disappearance': figureHtml(
    images.morgan,
    'William Morgan, anti-Mason, 1829 portrait',
    'Captain William Morgan — the former Mason whose 1826 disappearance after threatening to publish Masonic secrets triggered the Morgan Affair and birthed America\'s first third party.'
  ),
  'The Enemies': figureHtml(
    images.apron,
    'Anti-Masonic political apron engraving, 1831',
    'A remarkable engraving in the shape of a Masonic apron, attacking the Anti-Masonic Party after their 1831 Baltimore convention. The right side shows Masonic virtues; the left, the "Hydra of Antimasonry" spouting Persecution, Intolerance, and Anarchy.'
  ),
  'The Empty Chair': figureHtml(
    images.eye,
    'The Eye of Providence, 1888',
    'The Eye of Providence — the single most recognizable symbol associated with Freemasonry and conspiracy theories. It appears on the Great Seal of the United States, though the evidence for direct Masonic influence on the seal\'s design is weaker than commonly assumed.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/freemasons.ts');
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
  <p class="epigraph">"The very existence of Freemasonry, the fact that it is a secret organisation, is proof that there is something in this world which is hidden from ordinary mortals."</p>
  <p class="epigraph-attr">— Leo Tolstoy, <em>War and Peace</em>, 1869</p>
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
      <p><strong>c. 1390</strong> — The Regius Poem, the oldest known document relating to Freemasonry, is written in Middle English verse. It traces masonry to Euclid and ancient Egypt.</p>
      <p><strong>1598–1599</strong> — William Schaw, Master of Works to King James VI of Scotland, issues the Schaw Statutes regulating Scottish masonic lodges.</p>
      <p><strong>1646</strong> — Elias Ashmole records in his diary that he was "made a Free Mason" at Warrington, Lancashire — one of the earliest documented speculative initiations.</p>
      <p><strong>1717</strong> — Four London lodges gather at the Goose and Gridiron Ale-House and form the Grand Lodge of England, the first Grand Lodge in the world. Anthony Sayer is elected Grand Master.</p>
      <p><strong>1723</strong> — James Anderson publishes <em>The Constitutions of the Free-Masons</em>, establishing the principle that Masons need only believe in "that Religion in which all Men agree."</p>
      <p><strong>1731</strong> — Benjamin Franklin is initiated in Philadelphia. He becomes Grand Master of Pennsylvania in 1734, at age 28.</p>
      <p><strong>1738</strong> — Pope Clement XII issues <em>In Eminenti</em>, the first papal condemnation of Freemasonry. Frederick the Great of Prussia is initiated.</p>
      <p><strong>1752</strong> — George Washington is initiated at Fredericksburg Lodge No. 4, Virginia, on November 4.</p>
      <p><strong>1773</strong> — On the night of the Boston Tea Party (December 16), the minutes of St. Andrew's Lodge read: "Lodge closed on account of the few members present."</p>
      <p><strong>1775</strong> — Prince Hall, a free Black man in Boston, is initiated by a British military lodge, founding African American Freemasonry.</p>
      <p><strong>1778</strong> — Voltaire is initiated at the Lodge of the Nine Sisters in Paris, with Benjamin Franklin presiding, on April 7.</p>
      <p><strong>1784</strong> — Mozart is initiated at Lodge "Zur Wohlthatigkeit" in Vienna on December 14.</p>
      <p><strong>1793</strong> — Washington, wearing full Masonic regalia, lays the Capitol cornerstone on September 18.</p>
      <p><strong>1813</strong> — The United Grand Lodge of England is formed on December 27, merging the "Antients" and "Moderns" after sixty years of rivalry.</p>
      <p><strong>1826</strong> — Captain William Morgan is kidnapped in Batavia, New York, after announcing plans to publish Masonic secrets. He is never seen again.</p>
      <p><strong>1831</strong> — The Anti-Masonic Party holds the first national nominating convention in American political history, in Baltimore.</p>
      <p><strong>1871</strong> — Albert Pike publishes <em>Morals and Dogma</em>, an 861-page commentary on the Scottish Rite degrees.</p>
      <p><strong>1884</strong> — Pope Leo XIII issues <em>Humanum Genus</em>, calling Freemasonry "the kingdom of Satan."</p>
      <p><strong>1897</strong> — Hoaxer Leo Taxil reveals at a packed Paris press conference that his twelve years of anti-Masonic publications were a fabrication to embarrass the Catholic Church.</p>
      <p><strong>1945</strong> — President Truman receives the 33rd degree of the Scottish Rite while serving as President, on October 19.</p>
      <p><strong>1959</strong> — American Freemasonry reaches its peak membership: 4.1 million — roughly 1 in 12 eligible men.</p>
      <p><strong>1969</strong> — Buzz Aldrin carries a Masonic deputation to the Moon and symbolically "opens" Tranquility Lodge No. 2000 on July 20.</p>
      <p><strong>1981</strong> — Italian magistrates raid the villa of Licio Gelli and discover the membership list of Propaganda Due (P2), a secret Masonic lodge with 962 members including politicians, generals, and Silvio Berlusconi.</p>
      <p><strong>1982</strong> — Roberto Calvi, "God's Banker," is found hanging from Blackfriars Bridge, London, on June 18, with bricks in his pockets.</p>
      <p><strong>1983</strong> — Cardinal Ratzinger declares that Catholics who join Masonic associations "are in a state of grave sin and may not receive Holy Communion."</p>
      <p><strong>2017</strong> — The United Grand Lodge of England celebrates its 300th anniversary.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Stevenson, David — <em>The Origins of Freemasonry: Scotland's Century, 1590–1710</em>, Cambridge University Press, 1988</p>
      <p>Jacob, Margaret C. — <em>The Origins of Freemasonry: Facts and Fictions</em>, University of Pennsylvania Press, 2005</p>
      <p>Bullock, Steven C. — <em>Revolutionary Brotherhood: Freemasonry and the Transformation of the American Social Order</em>, University of North Carolina Press, 1996</p>
      <p>Tabbert, Mark A. — <em>American Freemasons: Three Centuries of Building Communities</em>, NYU Press, 2005</p>
      <p>Pike, Albert — <em>Morals and Dogma of the Ancient and Accepted Scottish Rite of Freemasonry</em>, 1871</p>
      <p>Anderson, James — <em>The Constitutions of the Free-Masons</em>, 1723</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-freemasons-emblematic-chart-1877.jpg'),
        title: 'The\nFreemasons',
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
