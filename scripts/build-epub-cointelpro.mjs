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
  title: 'COINTELPRO',
  subtitle: 'The FBI\'s Secret War on America',
  author: 'HistorIQly',
  series: 'Vol. 7: Declassified',
  slug: 'cointelpro',
  description:
    'For fifteen years, the FBI waged a covert war against American citizens — infiltrating civil rights organizations, destroying political movements, and targeting leaders for "neutralization." This is the true story of COINTELPRO, the secret program that turned the nation\'s law enforcement agency into a weapon against its own people.',
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
  march: imgFileUrl('hero-march-washington-1963.jpg'),
  hoover: imgFileUrl('figure-j-edgar-hoover.jpg'),
  hooverOffice: imgFileUrl('figure-hoover-office-1940.jpg'),
  mlk: imgFileUrl('figure-martin-luther-king.jpg'),
  mlkLectern: imgFileUrl('figure-mlk-lectern-1964.jpg'),
  hampton: imgFileUrl('figure-fred-hampton-rally.jpg'),
  hamptonProtest: imgFileUrl('figure-fred-hampton-protest.jpg'),
  newton: imgFileUrl('figure-huey-newton.jpg'),
  church: imgFileUrl('figure-frank-church.jpg'),
  sullivan: imgFileUrl('figure-william-sullivan.jpg'),
  felt: imgFileUrl('figure-mark-felt.jpg'),
  fbiLetter: imgFileUrl('evidence-fbi-letter-mlk.png'),
  sebergMemo: imgFileUrl('evidence-cointelpro-memo-seberg.jpg'),
  churchReport: imgFileUrl('evidence-church-committee-report.jpg'),
  hamptonBody: imgFileUrl('atmosphere-hampton-body-removed.jpg'),
  rushSurrenders: imgFileUrl('atmosphere-bobby-rush-surrenders.jpg'),
  mlkMarch: imgFileUrl('atmosphere-mlk-march-washington.jpg'),
  aliFrazier: imgFileUrl('atmosphere-ali-frazier-1971.jpg'),
  fbiHQ: imgFileUrl('location-fbi-headquarters.jpg'),
  mediaOffice: imgFileUrl('location-media-pa-fbi-office.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  "The Director's Obsession": figureHtml(images.hooverOffice, 'J. Edgar Hoover in his FBI office, 1940', 'J. Edgar Hoover in his office at FBI headquarters, 1940. He would serve as Director for 48 years, wielding more power than any law enforcement official in American history.'),
  'The Most Dangerous Negro': figureHtml(images.fbiLetter, 'The anonymous FBI letter sent to Martin Luther King Jr., 1964', 'The anonymous letter sent by the FBI to Martin Luther King Jr. in November 1964, urging him to commit suicide before receiving the Nobel Peace Prize. The full unredacted text was not publicly discovered until 2014.'),
  'The Greatest Threat': figureHtml(images.newton, 'Huey Newton seated in a rattan throne chair with a rifle and spear, 1967', 'Huey P. Newton, co-founder of the Black Panther Party, in the iconic 1967 photograph by Blair Stapp. The image became a symbol of armed Black self-defense — and a target for FBI Director Hoover, who called the Panthers "the greatest threat to the internal security of the country."'),
  'December 4, 1969': figureHtml(images.hamptonBody, 'Chicago police remove the body of Fred Hampton, December 4, 1969', 'Chicago police remove the body of Fred Hampton from his apartment at 2337 West Monroe Street, December 4, 1969. Hampton was twenty-one years old. Between 82 and 99 shots were fired by police. One shot was fired by the apartment\'s occupants.'),
  'The Night of the Fight': figureHtml(images.aliFrazier, 'Joe Frazier standing over Muhammad Ali, March 8, 1971', 'Joe Frazier stands over Muhammad Ali after knocking him down in the 15th round of the "Fight of the Century," March 8, 1971. While the nation watched the fight, eight citizens broke into the FBI\'s Media, Pennsylvania office and stole the documents that exposed COINTELPRO.'),
  'The Church Committee': figureHtml(images.churchReport, 'Church Committee Final Report, Book II', 'The cover of Book II of the Church Committee\'s final report: "Intelligence Activities and the Rights of Americans." Published in April 1976, the six-volume report remains the most comprehensive public accounting of U.S. intelligence abuses.'),
  'Echoes': figureHtml(images.felt, 'FBI Deputy Director Mark Felt, circa 1972-73', 'Mark Felt, FBI Deputy Director, circa 1972-73. Felt oversaw COINTELPRO operations and was later convicted of authorizing illegal break-ins. In 2005, he was revealed as "Deep Throat" — the source who helped expose Watergate. The hero of press freedom and the architect of illegal surveillance were the same man.'),
  'The Price of Secrecy': figureHtml(images.mediaOffice, 'The FBI\'s former office in Media, Pennsylvania', 'One Veterans Square, Media, Pennsylvania — the FBI resident agency that eight citizens broke into on March 8, 1971. The stolen documents first revealed the word "COINTELPRO" to the American public and led to the Church Committee investigation.'),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/cointelpro.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
const chapters = [];
let match;
while ((match = chapterRegex.exec(raw)) !== null) {
  chapters.push({
    num: match[1],
    title: (match[2] || match[3]).replace(/\\'/g, "'"),
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
    <p class="based-on">Based on declassified documents</p>
    <span class="divider"></span>
    <p class="meta" style="margin-top:3em;font-size:1em">${book.author}</p>
  </div>
`;

const epigraphPage = `
  <p class="epigraph">"Too many people have been spied upon by too many Government agencies and too much information has been collected."</p>
  <p class="epigraph-attr">— Church Committee Final Report, 1976</p>
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
      <p><strong>August 1956</strong> — J. Edgar Hoover launches COINTELPRO, initially targeting the Communist Party USA.</p>
      <p><strong>1960</strong> — Program expands to target Puerto Rican independence groups.</p>
      <p><strong>1961</strong> — Socialist Workers Party becomes a formal target.</p>
      <p><strong>August 1963</strong> — FBI marks Martin Luther King Jr. as "the most dangerous Negro of the future."</p>
      <p><strong>1964</strong> — COINTELPRO-White Hate Groups begins, targeting the KKK.</p>
      <p><strong>November 1964</strong> — FBI sends anonymous "suicide letter" to King with surveillance recordings.</p>
      <p><strong>October 1966</strong> — Black Panther Party founded by Huey Newton and Bobby Seale in Oakland.</p>
      <p><strong>August 1967</strong> — COINTELPRO-Black Nationalist Hate Groups formally launched.</p>
      <p><strong>March 1968</strong> — Hoover's "prevent the rise of a messiah" directive issued.</p>
      <p><strong>April 4, 1968</strong> — Martin Luther King Jr. assassinated in Memphis.</p>
      <p><strong>December 4, 1969</strong> — Fred Hampton and Mark Clark killed in FBI-coordinated predawn raid in Chicago.</p>
      <p><strong>March 8, 1971</strong> — Citizens' Commission breaks into FBI office in Media, PA, on the night of the Ali-Frazier fight.</p>
      <p><strong>March 24, 1971</strong> — Washington Post publishes first COINTELPRO documents.</p>
      <p><strong>April 28, 1971</strong> — Hoover officially terminates all COINTELPRO operations.</p>
      <p><strong>May 2, 1972</strong> — J. Edgar Hoover dies at age 77.</p>
      <p><strong>January 1975</strong> — Senate creates the Church Committee.</p>
      <p><strong>April 1976</strong> — Church Committee publishes six-volume final report.</p>
      <p><strong>1978</strong> — Foreign Intelligence Surveillance Act (FISA) signed into law.</p>
      <p><strong>1982</strong> — Hampton/Clark civil rights settlement: $1.85 million.</p>
      <p><strong>2014</strong> — Media burglars publicly identified for the first time in Betty Medsger's <em>The Burglary</em>.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events, declassified FBI records, and the findings of the Church Committee. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Medsger, Betty — <em>The Burglary: The Discovery of J. Edgar Hoover's Secret FBI</em>, Knopf, 2014</p>
      <p>Churchill, Ward and Vander Wall, Jim — <em>The COINTELPRO Papers: Documents from the FBI's Secret Wars Against Dissent in the United States</em>, South End Press, 1990</p>
      <p>Haas, Jeffrey — <em>The Assassination of Fred Hampton: How the FBI and the Chicago Police Murdered a Black Panther</em>, Chicago Review Press, 2010</p>
      <p>Garrow, David J. — <em>The FBI and Martin Luther King, Jr.: From "Solo" to Memphis</em>, W.W. Norton, 1981</p>
      <p>U.S. Senate — <em>Intelligence Activities and the Rights of Americans: Book II, Final Report of the Church Committee</em>, 1976</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-march-washington-1963.jpg'),
        title: 'COINTELPRO',
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
