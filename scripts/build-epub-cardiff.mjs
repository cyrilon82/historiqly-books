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
  title: 'The Cardiff Giant',
  subtitle: 'The Cigar Maker Who Fooled America',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'cardiff-giant',
  description:
    'In 1869, a ten-foot stone man was unearthed on a quiet New York farm. Within days, thousands were paying to see the American Goliath. This is the true story of the atheist cigar maker, the scheming showman, and the greatest archaeological hoax in American history.',
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
  exhumed: imgFileUrl('hero-cardiff-giant-exhumed.jpg'),
  closeup: imgFileUrl('cardiff-giant-closeup.jpg'),
  cooperstown: imgFileUrl('cardiff-giant-cooperstown.jpg'),
  loc: imgFileUrl('cardiff-giant-loc.jpg'),
  iowa: imgFileUrl('cardiff-giant-iowa-illustration.jpg'),
  onondaga: imgFileUrl('onondaga-giant-engraving.jpg'),
  illustration: imgFileUrl('cardiff-giant-illustration.png'),
  marsh: imgFileUrl('suspect-othniel-marsh.jpg'),
  barnum: imgFileUrl('suspect-pt-barnum.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Block': figureHtml(
    images.iowa,
    'Illustration of the Cardiff Giant from the History of Iowa',
    'The Cardiff Giant as depicted in a contemporary illustration. Hull had the figure modelled on himself — his face, his proportions, scaled up to the dimensions of a biblical colossus.'
  ),
  'The Burial': figureHtml(
    images.exhumed,
    'The Cardiff Giant being excavated in 1869',
    'The Cardiff Giant as it appeared when unearthed on October 16, 1869. Workers Gideon Emmons and Henry Nichols struck the stone foot at a depth of three feet while digging a "well" on Stub Newell\'s farm.'
  ),
  'The Sensation': figureHtml(
    images.onondaga,
    'The Onondaga Giant — contemporary engraving of the Cardiff Giant',
    'A contemporary engraving of the Cardiff Giant, also known as "The Onondaga Giant." Thousands of visitors paid fifty cents to file past the figure under a white tent. Within a week, it was the most talked-about attraction in America.'
  ),
  'The Syndicate': figureHtml(
    images.barnum,
    'P.T. Barnum, circa 1860',
    'P.T. Barnum, the most famous showman in America. When Hannum\'s syndicate refused to sell the giant, Barnum simply made his own — and claimed it was the original.'
  ),
  'The Professor': figureHtml(
    images.marsh,
    'Othniel C. Marsh, Yale paleontologist',
    'Othniel Charles Marsh, professor of palaeontology at Yale. He spent approximately ten minutes examining the giant before declaring it "a most decided humbug." The chisel marks, he said, were still fresh.'
  ),
  'The Confession': figureHtml(
    images.closeup,
    'Close-up of the Cardiff Giant',
    'The Cardiff Giant in detail. Note the serene expression and the needle-prick "pores" that Hull drove into the gypsum surface by the hundred. The sulfuric acid he used for aging produced dark streaks that resembled blood vessels — an accident that made the figure disturbingly lifelike.'
  ),
  'Old Hoaxey': figureHtml(
    images.cooperstown,
    'The Cardiff Giant on display at the Farmers\' Museum in Cooperstown, NY',
    'The Cardiff Giant today, on permanent display at the Farmers\' Museum in Cooperstown, New York. Visitors still reach over the rope to touch it. After more than 150 years, the question it asks is still the same: <em>What do you want to believe?</em>'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/cardiff-giant.ts');
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
  <p class="epigraph">"There's a sucker born every minute."</p>
  <p class="epigraph-attr">— David Hannum, 1869 (commonly misattributed to P.T. Barnum)</p>
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
      <p><strong>1867</strong> — George Hull, an atheist tobacconist from Binghamton, New York, argues with Reverend Turk at a Methodist revival meeting in Iowa about biblical giants. He conceives the hoax.</p>
      <p><strong>1868 (Spring)</strong> — Hull quarries a 12-by-4-by-2-foot block of gypsum near Fort Dodge, Iowa, telling the quarrymen it is for an Abraham Lincoln memorial. Transporting the 3,000-pound block 40 miles to a railhead takes three weeks and destroys two wagons and a bridge.</p>
      <p><strong>1868 (Summer)</strong> — In a barn on West Twelfth Street, Chicago, German stonecutter Edward Burkhardt and assistants Henry Salle and Fred Mohrmann carve the figure in secret. They work evenings and Sundays, muffling their hammering with quilts. Hull models the face on his own.</p>
      <p><strong>1868 (November)</strong> — The completed figure is shipped by rail to Cardiff, New York, and buried behind the barn of Hull's cousin, William "Stub" Newell, on a cold night. Total cost of the project: $2,600.</p>
      <p><strong>1869 (October 16)</strong> — Nearly a year later, workers Gideon Emmons and Henry Nichols, hired to dig a "well," unearth the giant at a depth of three feet. Newell erects a tent and charges 50 cents admission. 2,500 visitors come in the first week.</p>
      <p><strong>1869 (October–November)</strong> — The giant becomes a national sensation. Scientists debate whether it is a petrified man or an ancient statue. State Geologist James Hall calls it "the most remarkable object yet brought to light in this country."</p>
      <p><strong>1869 (November)</strong> — Hull sells his stake for $23,000 to a syndicate of five Syracuse businessmen led by David Hannum. The giant is moved to Syracuse for exhibition. P.T. Barnum offers $50,000 to lease it; refused, he commissions an exact plaster replica.</p>
      <p><strong>1869 (November)</strong> — Yale palaeontologist Othniel C. Marsh visits the giant and declares it "a most decided humbug," citing fresh chisel marks and lack of water erosion.</p>
      <p><strong>1869 (December 10)</strong> — George Hull confesses to the press. The hoax is revealed.</p>
      <p><strong>1870 (February 2)</strong> — In court, both giants are declared fakes. The judge rules Barnum cannot be sued for "calling a fake a fake." David Hannum utters the line "There's a sucker born every minute" — later misattributed to Barnum.</p>
      <p><strong>1873</strong> — Hull, broke after bad investments, attempts a second hoax with a "Colorado Giant" made of clay and iron filings. It fails quickly.</p>
      <p><strong>1901</strong> — The giant is displayed at the Pan-American Exposition in Buffalo, New York.</p>
      <p><strong>1902</strong> — George Hull dies in obscurity.</p>
      <p><strong>1947</strong> — The New York State Historical Association purchases the giant and installs it at the Farmers' Museum in Cooperstown, New York, where it remains on permanent display.</p>
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
      <p>Franco, Barbara — "The Cardiff Giant: A Hundred Year Old Hoax," <em>New York History</em>, 1969</p>
      <p>Tribble, Scott — <em>A Colossal Hoax: The Giant from Cardiff that Fooled America</em>, Rowman & Littlefield, 2009</p>
      <p>Sears, Stephen W. — "The Giant in the Earth," <em>American Heritage</em>, 1975</p>
      <p>Museum of Hoaxes — "The Cardiff Giant (1869)," hoaxes.org</p>
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
        backgroundImage: resolve(IMG_DIR, 'onondaga-giant-engraving.jpg'),
        title: 'The Cardiff\nGiant',
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
