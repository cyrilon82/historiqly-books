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
  title: 'November 22, 1963',
  subtitle: 'The Assassination That Changed America',
  author: 'HistorIQly',
  series: 'Vol. 5: Conspiracies',
  slug: 'jfk-assassination',
  description:
    'On a sunlit November afternoon in Dallas, three shots shattered the American century. This is the true story of the assassination of President John F. Kennedy — the evidence, the suspects, the investigations, and the conspiracy theories that have haunted a nation for sixty years.',
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
  motorcade: imgFileUrl('hero-motorcade-dealey-plaza.jpg'),
  oswald: imgFileUrl('suspect-oswald-booking-photo.jpg'),
  ruby: imgFileUrl('suspect-jack-ruby-booking.jpg'),
  rifle: imgFileUrl('evidence-mannlicher-carcano-rifle.jpg'),
  bullet: imgFileUrl('evidence-magic-bullet-ce399.jpg'),
  backyard: imgFileUrl('evidence-oswald-backyard-rifle.jpg'),
  snipersNest: imgFileUrl('evidence-snipers-nest-sixth-floor.jpg'),
  warrenCommission: imgFileUrl('investigation-warren-commission.jpg'),
  loveField: imgFileUrl('atmosphere-love-field-arrival.jpg'),
  lbjSwearing: imgFileUrl('aftermath-lbj-swearing-in-air-force-one.jpg'),
  funeral: imgFileUrl('aftermath-jfk-funeral-procession.jpg'),
  jfk: imgFileUrl('figure-jfk-presidential-portrait.jpg'),
  grassyKnoll: imgFileUrl('location-grassy-knoll-1963.jpg'),
  tippit: imgFileUrl('figure-officer-tippit.jpg'),
  threeTramps: imgFileUrl('conspiracy-three-tramps.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Dallas, November 22': figureHtml(images.loveField, 'President and Mrs. Kennedy arrive at Love Field, Dallas, November 22, 1963', 'JFK and Jackie Kennedy arriving at Love Field airport in Dallas on the morning of November 22, 1963. The weather had cleared, and the bubble top was removed from the presidential limousine.'),
  'Parkland': figureHtml(images.lbjSwearing, 'Lyndon B. Johnson takes the oath of office aboard Air Force One', 'Lyndon B. Johnson takes the presidential oath aboard Air Force One at Love Field, with Jackie Kennedy standing beside him in her blood-stained pink suit. Photograph by Cecil Stoughton, the White House photographer.'),
  'The Suspect': figureHtml(images.oswald, 'Lee Harvey Oswald, Dallas Police Department photograph, 1963', 'Lee Harvey Oswald after his arrest at the Texas Theatre on November 22, 1963. He told reporters, "I\'m just a patsy." He would be dead within forty-eight hours.'),
  'The Evidence': figureHtml(images.rifle, 'The Mannlicher-Carcano rifle, Commission Exhibit 139', 'The 6.5mm Mannlicher-Carcano rifle, serial number C2766, found on the sixth floor of the Texas School Book Depository. It had been purchased by mail order under the alias "A. Hidell" — handwriting later identified as Oswald\'s.'),
  'Silenced': figureHtml(images.ruby, 'Jack Ruby, Dallas Police Department booking photograph, 1963', 'Jack Ruby — born Jacob Rubenstein in Chicago — after his arrest for the murder of Lee Harvey Oswald. He claimed he killed Oswald to spare Jackie Kennedy the pain of a trial.'),
  'The Warren Report': figureHtml(images.warrenCommission, 'Members of the Warren Commission present their report to President Johnson', 'The Warren Commission presents its 888-page report to President Lyndon Johnson, September 1964. From left: Representative Gerald Ford, Representative Hale Boggs, Senator Richard Russell, Chief Justice Earl Warren, Senator John Sherman Cooper, John J. McCloy, and Allen Dulles.'),
  'The Conspiracy': figureHtml(images.grassyKnoll, 'The grassy knoll and picket fence at Dealey Plaza', 'The grassy knoll and the wooden picket fence behind it, viewed from Elm Street. More than fifty witnesses reported hearing shots from this direction. The House Select Committee on Assassinations concluded in 1979 that a shot was likely fired from here.'),
  'The Shadows That Remain': figureHtml(images.funeral, 'The funeral procession of President Kennedy leaving the White House', 'The flag-draped casket of President Kennedy leaves the White House on a horse-drawn caisson, November 25, 1963. An estimated one million people lined the route from the Capitol to Arlington National Cemetery.'),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/jfk-assassination.ts');
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
  <p class="epigraph">"The very word 'secrecy' is repugnant in a free and open society."</p>
  <p class="epigraph-attr">— President John F. Kennedy, April 27, 1961</p>
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
      <p><strong>1939</strong> — Lee Harvey Oswald born in New Orleans.</p>
      <p><strong>1956</strong> — Oswald enlists in the Marines, learns to shoot.</p>
      <p><strong>1959</strong> — Oswald defects to the Soviet Union.</p>
      <p><strong>1962</strong> — Returns to Dallas with wife Marina.</p>
      <p><strong>April 1963</strong> — Oswald attempts to assassinate General Edwin Walker.</p>
      <p><strong>November 22, 1963, 11:40 AM</strong> — JFK arrives at Love Field.</p>
      <p><strong>12:30 PM</strong> — Three shots fired in Dealey Plaza.</p>
      <p><strong>1:00 PM</strong> — Kennedy pronounced dead at Parkland.</p>
      <p><strong>1:15 PM</strong> — Officer J.D. Tippit shot dead.</p>
      <p><strong>1:50 PM</strong> — Oswald arrested at the Texas Theatre.</p>
      <p><strong>2:38 PM</strong> — LBJ sworn in aboard Air Force One.</p>
      <p><strong>November 24, 1963</strong> — Jack Ruby shoots Oswald on live TV.</p>
      <p><strong>November 25, 1963</strong> — Kennedy's funeral.</p>
      <p><strong>September 1964</strong> — Warren Commission report published.</p>
      <p><strong>1967</strong> — Jim Garrison charges Clay Shaw with conspiracy.</p>
      <p><strong>1969</strong> — Shaw acquitted.</p>
      <p><strong>1979</strong> — HSCA concludes "probable conspiracy."</p>
      <p><strong>1992</strong> — JFK Records Act signed.</p>
      <p><strong>Present</strong> — Millions of pages still classified.</p>
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
      <p>Bugliosi, Vincent — <em>Reclaiming History: The Assassination of President John F. Kennedy</em>, W.W. Norton, 2007</p>
      <p>Posner, Gerald — <em>Case Closed: Lee Harvey Oswald and the Assassination of JFK</em>, Random House, 1993</p>
      <p>McKnight, Gerald D. — <em>Breach of Trust: How the Warren Commission Failed the Nation and Why</em>, University Press of Kansas, 2005</p>
      <p>Shenon, Philip — <em>A Cruel and Shocking Act: The Secret History of the Kennedy Assassination</em>, Henry Holt, 2013</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-motorcade-dealey-plaza.jpg'),
        title: 'November 22,\n1963',
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
