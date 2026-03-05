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
  title: 'The Bohemian Grove',
  subtitle: 'Where Power Goes to Play',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'bohemian-grove',
  description:
    'Deep in a California redwood forest, the most powerful men in America gather each July for a secret two-week retreat. Presidents, bankers, generals, and tycoons perform torchlit rituals before a forty-foot stone owl, deliver off-the-record speeches that shape world policy, and drink beneath ancient trees where the Manhattan Project was conceived. This is the true story of the Bohemian Grove — the most exclusive club on Earth.',
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
  redwoods: imgFileUrl('hero-bohemian-grove-redwoods.jpg'),
  grove1909: imgFileUrl('bohemian-grove-1909.png'),
  ritual1915: imgFileUrl('bohemian-grove-1915-ritual.png'),
  owlShrine: imgFileUrl('bohemian-grove-owl-shrine.jpg'),
  clubSF: imgFileUrl('bohemian-club-san-francisco.jpg'),
  owlEntrance: imgFileUrl('bohemian-club-owl-entrance.jpg'),
  tavernier: imgFileUrl('cremation-of-care-tavernier-1881.jpg'),
  ceremony1907: imgFileUrl('cremation-of-care-1907.jpg'),
  members1907: imgFileUrl('bohemian-grove-members-1907.jpg'),
  members1913: imgFileUrl('bohemian-grove-members-1913.jpg'),
  panorama1918: imgFileUrl('bohemian-grove-camp-panorama-1918.jpg'),
  nixon: imgFileUrl('suspect-richard-nixon.jpg'),
  hoover: imgFileUrl('suspect-herbert-hoover.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Redwood Cathedral': figureHtml(
    images.owlShrine,
    'The Owl Shrine at Bohemian Grove, beside the lake',
    'The Owl Shrine — a forty-foot concrete statue beside the artificial lake at the Bohemian Grove. Built in 1929, it serves as the centrepiece of the Cremation of Care ceremony and houses electrical and audio equipment within its hollow interior.'
  ),
  "The Journalists' Club": figureHtml(
    images.clubSF,
    'The Bohemian Club building in San Francisco',
    'The Bohemian Club\'s permanent headquarters on Taylor Street in downtown San Francisco, just blocks from the financial district. The six-story building houses a reading room, bar, dining hall, and a 611-seat theatre.'
  ),
  'Weaving Spiders Come Not Here': figureHtml(
    images.panorama1918,
    'Panorama of a Bohemian Grove camp, 1918',
    'A panoramic view of a Bohemian Grove camp in 1918, showing the rustic tents and platforms where members slept beneath the redwoods. Approximately 120 camps house the members during the annual two-week encampment.'
  ),
  'The Cremation of Care': figureHtml(
    images.tavernier,
    'Cremation of Care painting by Jules Tavernier, 1881',
    '<em>Cremation of Care</em> by Jules Tavernier, 1881 — the earliest known depiction of the ceremony. Robed figures gather among the towering redwoods as firelight illuminates the forest clearing.'
  ),
  'The Lakeside Talks': figureHtml(
    images.grove1909,
    'A gathering at Bohemian Grove, 1909',
    'Members gather at the Bohemian Grove, circa 1909. The Lakeside Talks, initiated in 1932, became the defining political feature of the encampment — off-the-record speeches by cabinet secretaries, generals, and presidents.'
  ),
  'The Atomic Grove': figureHtml(
    images.ceremony1907,
    'The Cremation of Care ceremony, 1907',
    'The Cremation of Care ceremony in 1907, showing the pyrotechnics and firelight that characterise the ritual. In September 1942, the Grove hosted a meeting of Manhattan Project scientists and military officials that helped launch the atomic bomb programme.'
  ),
  'Presidents Among the Redwoods': figureHtml(
    images.nixon,
    'Richard Nixon, official presidential portrait',
    'Richard Nixon, whose 1967 Lakeside Talk he later called "the first milestone on my road to the presidency." Nixon met Ronald Reagan at the Grove and negotiated the deal that cleared his path to the 1968 Republican nomination.'
  ),
  'Behind the Curtain': figureHtml(
    images.members1907,
    'James Hopper, Herman Scheffauer, Harry Lafler, and George Sterling at Bohemian Grove, 1907',
    'Members at the Bohemian Grove in 1907 — writers and artists who represented the club\'s original bohemian character. By the late twentieth century, journalists like Philip Weiss and Alex Jones would attempt to infiltrate the Grove and expose its secrets to the world.'
  ),
  'Secrets and Shadows': figureHtml(
    images.hoover,
    'Herbert Hoover, official presidential portrait',
    'Herbert Hoover, who joined the Bohemian Club in 1913 and became the grand old man of the Grove. His Saturday afternoon Lakeside Talk was the climactic event of every encampment until his death in 1964.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/bohemian-grove.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
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
  <p class="epigraph">"Weaving spiders, come not here."</p>
  <p class="epigraph-attr">— William Shakespeare, <em>A Midsummer Night's Dream</em><br/>Motto of the Bohemian Club, adopted 1872</p>
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
      <p><strong>1872</strong> — The Bohemian Club is founded on April 2 in San Francisco by journalists from the <em>San Francisco Examiner</em>, the <em>Chronicle</em>, and other papers. The owl is chosen as the club's symbol; the motto "Weaving Spiders Come Not Here" is adopted from Shakespeare.</p>
      <p><strong>1878</strong> — The club holds its first outdoor summer retreat in a rented redwood grove near the Russian River, prompted by founding member Henry Edwards' departure for New York.</p>
      <p><strong>1880</strong> — The Cremation of Care ceremony is performed for the first time at the summer encampment.</p>
      <p><strong>1881</strong> — Jules Tavernier paints <em>Cremation of Care</em>, the earliest known depiction of the ceremony. The ritual becomes an annual tradition.</p>
      <p><strong>1893</strong> — The club signs a formal lease for Meeker's Grove, a redwood property near Monte Rio in Sonoma County.</p>
      <p><strong>1899</strong> — The Bohemian Club purchases the Grove property outright from logger Melvin Cyrus Meeker.</p>
      <p><strong>1913</strong> — Herbert Hoover joins the Bohemian Club as a regular member, beginning a five-decade association that will transform the Grove into a political institution.</p>
      <p><strong>1929</strong> — The forty-foot concrete Owl Shrine is constructed at the lakeside, replacing an earlier, smaller figure.</p>
      <p><strong>1932</strong> — The Lakeside Talks are formally inaugurated, providing a forum for off-the-record speeches by politicians, military leaders, and business executives.</p>
      <p><strong>1942 (September)</strong> — A special meeting at the Grove brings together Ernest Lawrence, J. Robert Oppenheimer, and members of the S-1 Executive Committee to discuss the feasibility of building an atomic bomb. The discussions contribute to the centralisation that will produce the Manhattan Project.</p>
      <p><strong>1944</strong> — The Grove's land holdings reach 2,700 acres through continued purchases of adjacent parcels.</p>
      <p><strong>1950 (July)</strong> — Dwight D. Eisenhower and Richard Nixon meet for the first time at Cave Man camp, as guests of former President Hoover. Eisenhower delivers a Lakeside Talk that establishes him as a serious presidential candidate. Within two years, he chooses Nixon as his running mate.</p>
      <p><strong>1964</strong> — Herbert Hoover dies. His Saturday afternoon Lakeside Talk had been the climactic event of every encampment for decades.</p>
      <p><strong>1967 (July 29)</strong> — Richard Nixon delivers the featured Lakeside address in Hoover's honour — a fifty-minute analysis of the global situation that he later calls "the first milestone on my road to the presidency." During the same encampment, he negotiates with Ronald Reagan, who agrees not to enter the 1968 Republican primaries.</p>
      <p><strong>1975</strong> — Ronald Reagan joins the Bohemian Club and is assigned to Owl's Nest camp.</p>
      <p><strong>1980</strong> — Rick Clogher, a journalist, enters the Grove posing as a worker. His account in <em>Mother Jones</em> is the first published magazine report from inside the compound. Mary Moore founds the Bohemian Grove Action Network to organise protests.</p>
      <p><strong>1984</strong> — Some 300 demonstrators blockade the Grove's entrance during the annual encampment, demanding the admission of women and public accountability. At least 50 are arrested.</p>
      <p><strong>1989 (July)</strong> — Philip Weiss of <em>Spy</em> magazine infiltrates the Grove, posing as a guest for seven days. His article, "Masters of the Universe Go to Camp," provides a detailed and satirical account of life inside the encampment.</p>
      <p><strong>2000 (July 15)</strong> — Alex Jones and cameraman Mike Hanson enter the Grove with a hidden camera and film the Cremation of Care ceremony. The footage becomes the documentary <em>Dark Secrets: Inside Bohemian Grove</em> and fuels decades of conspiracy theories.</p>
      <p><strong>2008</strong> — <em>Vanity Fair</em> reporter Alex Shoumatoff is caught infiltrating the Grove and arrested for trespassing. His article, "Bohemian Tragedy," focuses on logging controversies.</p>
      <p><strong>2023 (April)</strong> — ProPublica reveals that Supreme Court Justice Clarence Thomas has been attending the Bohemian Grove for more than two decades as a guest of billionaire Republican donor Harlan Crow, without disclosing the trips on his financial forms.</p>
      <p><strong>2023 (November)</strong> — The Supreme Court adopts its first-ever code of conduct, a direct response to the Thomas revelations.</p>
      <p><strong>2026 (February)</strong> — Independent journalist Daniel Boguslaw leaks the 2023 Bohemian Grove membership list, exposing over 2,200 names including Conan O'Brien, Michael Bloomberg, Eric Schmidt, Paul Pelosi, and the late Charles Koch.</p>
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
      <p>Domhoff, G. William — <em>The Bohemian Grove and Other Retreats: A Study in Ruling-Class Cohesiveness</em>, Harper & Row, 1974</p>
      <p>Weiss, Philip — "Masters of the Universe Go to Camp: Inside the Bohemian Grove," <em>Spy</em> magazine, November 1989</p>
      <p>Phillips, Peter — "A Relative Advantage: Sociology of the San Francisco Bohemian Club," Ph.D. dissertation, UC Davis, 1994</p>
      <p>ProPublica — "Clarence Thomas and the Billionaire," investigative series, 2023</p>
      <p class="separator">***</p>
      <p>This book is part of <strong>${book.series}</strong> in the HistorIQly Mysteries series — real history, told as a mystery.</p>
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
        backgroundImage: resolve(IMG_DIR, 'cremation-of-care-tavernier-1881.jpg'),
        title: 'The Bohemian\nGrove',
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
