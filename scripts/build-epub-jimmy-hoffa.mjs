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
  title: 'Jimmy Hoffa',
  subtitle: 'The Most Powerful Man Who Ever Vanished',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'jimmy-hoffa',
  description:
    'On July 30, 1975, the most powerful labor leader in American history walked into a restaurant parking lot and was never seen again. Jimmy Hoffa had built the Teamsters into the largest union on earth, made deals with the Mafia, survived Bobby Kennedy\'s crusade, and endured federal prison. Then he disappeared. Fifty years later, his body has never been found.',
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
  hero: imgFileUrl('hero-jimmy-hoffa-portrait.jpg'),
  mugshot: imgFileUrl('hoffa-1939-mugshot.jpg'),
  spindel: imgFileUrl('hoffa-spindel-1957.jpg'),
  son: imgFileUrl('hoffa-and-son.jpg'),
  kennedy: imgFileUrl('figure-robert-kennedy.jpg'),
  teamsters: imgFileUrl('teamsters-headquarters.jpg'),
  lewisburg: imgFileUrl('lewisburg-penitentiary.jpg'),
  alternative: imgFileUrl('hoffa-alternative.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Strawberry Boys': figureHtml(
    images.mugshot,
    'Jimmy Hoffa 1939 mugshot',
    'A young Jimmy Hoffa in 1939, already deeply involved in union organizing in Detroit. He was arrested eighteen times in a single twenty-four-hour period during one particularly brutal organizing campaign.'
  ),
  'King of the Road': figureHtml(
    images.teamsters,
    'International Brotherhood of Teamsters headquarters in Washington, D.C.',
    'The Teamsters\' "Marble Palace" on Louisiana Avenue in Washington, D.C., built by Dave Beck directly across from the United States Senate. Under Hoffa, the union grew to more than two million members.'
  ),
  'The Vendetta': figureHtml(
    images.kennedy,
    'Robert F. Kennedy, Attorney General of the United States',
    'Robert F. Kennedy as Attorney General. He created a dedicated "Get Hoffa Squad" within the Department of Justice, employing twenty prosecutors devoted exclusively to building criminal cases against Hoffa.'
  ),
  'Inside Lewisburg': figureHtml(
    images.lewisburg,
    'United States Penitentiary at Lewisburg, Pennsylvania',
    'The United States Penitentiary at Lewisburg, where Hoffa began serving his thirteen-year sentence on March 7, 1967. It was here that his friendship with Tony Provenzano turned to a blood feud.'
  ),
  'The Last Afternoon': figureHtml(
    images.hero,
    'Jimmy Hoffa portrait, circa 1960s',
    'Jimmy Hoffa in the years before his disappearance. On July 30, 1975, he drove to the Machus Red Fox restaurant in Bloomfield Township, Michigan, for a meeting that had been arranged — he believed — as a peace summit.'
  ),
  'The Mercury': figureHtml(
    images.spindel,
    'Jimmy Hoffa and Bernard Spindel, 1957',
    'Hoffa with wiretapping expert Bernard Spindel in 1957. The web of surveillance, informants, and counter-surveillance that surrounded Hoffa throughout his career reflected the dangerous world he inhabited.'
  ),
  'The Man Who Vanished': figureHtml(
    images.son,
    'Jimmy Hoffa and his son James P. Hoffa',
    'Jimmy Hoffa with his son James P. Hoffa. James would later serve as Teamsters president from 1999 to 2022, carrying forward his father\'s legacy and name.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/jimmy-hoffa.ts');
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
  <p class="epigraph">"I may have my faults, but being wrong ain't one of them."</p>
  <p class="epigraph-attr">— Jimmy Hoffa</p>
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
      <p><strong>February 14, 1913</strong> — James Riddle Hoffa is born in Brazil, Indiana. Third of four children of John Cleveland Hoffa, a coal mine blacksmith, and Viola Riddle Hoffa.</p>
      <p><strong>October 19, 1920</strong> — Father John Hoffa dies of lung disease from coal mine exposure. Jimmy is seven years old.</p>
      <p><strong>1924</strong> — The Hoffa family moves to Detroit, Michigan, following the promise of industrial work.</p>
      <p><strong>~1930</strong> — At seventeen, Hoffa leads the "Strawberry Strike" at the Kroger warehouse, winning his first union contract in under an hour.</p>
      <p><strong>1932</strong> — Becomes a full-time Teamster organizer in Detroit at age nineteen.</p>
      <p><strong>1936</strong> — Marries Josephine Poszywak, a laundry worker he met during an organizing drive.</p>
      <p><strong>1937</strong> — Elected president of Teamsters Local 299 in Detroit.</p>
      <p><strong>September 1957</strong> — Elected General President of the International Brotherhood of Teamsters, succeeding Dave Beck.</p>
      <p><strong>December 12, 1957</strong> — The Teamsters are expelled from the AFL-CIO on corruption charges.</p>
      <p><strong>January 15, 1964</strong> — Signs the National Master Freight Agreement in Chicago, covering 450,000 drivers under a single contract.</p>
      <p><strong>March 4, 1964</strong> — Convicted of jury tampering in Chattanooga, Tennessee. Sentenced to eight years.</p>
      <p><strong>July 26, 1964</strong> — Convicted of pension fund fraud in Chicago. Sentenced to five additional years.</p>
      <p><strong>March 7, 1967</strong> — Begins serving his thirteen-year sentence at the United States Penitentiary in Lewisburg, Pennsylvania.</p>
      <p><strong>July 1967</strong> — Fistfight with Anthony "Tony Pro" Provenzano at Lewisburg over pension payments.</p>
      <p><strong>December 23, 1971</strong> — President Nixon commutes Hoffa's sentence with the condition that he cannot engage in union management until March 1980.</p>
      <p><strong>July 30, 1975</strong> — Hoffa disappears from the parking lot of the Machus Red Fox restaurant in Bloomfield Township, Michigan. He is sixty-two years old.</p>
      <p><strong>July 31, 1975</strong> — Hoffa's unlocked car is found at the restaurant. James P. Hoffa files a missing-person report.</p>
      <p><strong>January 1976</strong> — FBI prepares the classified HOFFEX Memo, concluding Hoffa was murdered by organized crime figures.</p>
      <p><strong>March 21, 1978</strong> — Salvatore "Sally Bugs" Briguglio, a prime suspect, is murdered gangland-style on Mulberry Street in Manhattan.</p>
      <p><strong>December 8, 1982</strong> — Jimmy Hoffa is declared legally dead by an Oakland County judge, effective July 30, 1982.</p>
      <p><strong>2003</strong> — Frank Sheeran confesses to author Charles Brandt that he shot Hoffa in a Detroit house.</p>
      <p><strong>2004</strong> — <em>I Heard You Paint Houses</em> is published. FBI searches a Detroit house; blood found does not match Hoffa.</p>
      <p><strong>May 2006</strong> — FBI spends twelve days excavating a Michigan horse farm. Nothing is found.</p>
      <p><strong>2010</strong> — Giants Stadium is demolished. No remains are discovered.</p>
      <p><strong>2013</strong> — Anthony Zerilli leads investigators to an Oakland County field. Three-day search finds nothing.</p>
      <p><strong>November 2019</strong> — Martin Scorsese's <em>The Irishman</em> premieres on Netflix, introducing the Hoffa story to a new generation.</p>
      <p><strong>October 2021</strong> — FBI surveys a New Jersey landfill beneath the Pulaski Skyway.</p>
      <p><strong>July 2022</strong> — FBI announces no evidence of Hoffa found at the New Jersey site.</p>
      <p><strong>July 30, 2025</strong> — Fiftieth anniversary of Hoffa's disappearance. FBI Detroit states the case remains open.</p>
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
      <p>Sloane, Arthur A. — <em>Hoffa</em>, MIT Press, 1991</p>
      <p>Moldea, Dan E. — <em>The Hoffa Wars: Teamsters, Rebels, Politicians, and the Mob</em>, 1978</p>
      <p>Brandt, Charles — <em>I Heard You Paint Houses</em>, Steerforth Press, 2004</p>
      <p>Neff, James — <em>Vendetta: Bobby Kennedy Versus Jimmy Hoffa</em>, Little, Brown, 2015</p>
      <p>Russell, Thaddeus — <em>Out of the Jungle: Jimmy Hoffa and the Remaking of the American Working Class</em>, Temple University Press, 2003</p>
      <p>FBI HOFFEX Memo — Available through the FBI Vault (vault.fbi.gov)</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-jimmy-hoffa-portrait.jpg'),
        title: 'Jimmy\nHoffa',
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
