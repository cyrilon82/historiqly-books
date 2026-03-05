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
  title: 'Operation CHAOS',
  subtitle: 'The CIA\'s Secret War on American Dissent',
  author: 'HistorIQly',
  series: 'Vol. 7: Declassified',
  slug: 'operation-chaos',
  description:
    'For seven years, the CIA ran a massive illegal surveillance program targeting American citizens who dared to protest their government. Operation CHAOS compiled files on 7,200 Americans, indexed 300,000 names in a secret database, and infiltrated anti-war groups, civil rights organizations, and women\'s liberation movements — all in violation of the agency\'s own charter.',
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
  hero: imgFileUrl('hero-pentagon-protest-1967.jpg'),
  helms: imgFileUrl('figure-richard-helms.jpg'),
  helmsLBJ: imgFileUrl('figure-richard-helms-lbj.jpg'),
  helmsCommendation: imgFileUrl('figure-richard-helms-commendation.jpg'),
  angleton: imgFileUrl('figure-james-angleton.jpg'),
  church: imgFileUrl('figure-frank-church.jpg'),
  hersh: imgFileUrl('figure-seymour-hersh.jpg'),
  colby: imgFileUrl('figure-william-colby.jpg'),
  chaosDoc: imgFileUrl('evidence-operation-chaos-document.jpg'),
  churchReport: imgFileUrl('evidence-church-committee-report.jpg'),
  ciaHQ: imgFileUrl('atmosphere-cia-headquarters-aerial.jpg'),
  ciaBuilding: imgFileUrl('atmosphere-cia-headquarters-building.jpg'),
  flowerPower: imgFileUrl('atmosphere-flower-power-pentagon-1967.jpg'),
  rockefellerFord: imgFileUrl('atmosphere-rockefeller-commission-ford.jpg'),
  rockefellerSwearing: imgFileUrl('atmosphere-rockefeller-commission-swearing-in.png'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  "The Director's Demand": figureHtml(images.helmsLBJ, 'CIA Director Richard Helms with President Lyndon B. Johnson', 'CIA Director Richard Helms with President Lyndon B. Johnson. Johnson was convinced that foreign powers were directing the anti-war movement and demanded the CIA find proof — despite the Agency\'s charter prohibiting domestic operations.'),
  'The Man in the Vault': figureHtml(images.ciaHQ, 'Aerial view of CIA headquarters at Langley, Virginia', 'CIA headquarters at Langley, Virginia. Operation CHAOS was run from a vaulted basement area within this complex, in what one internal description called "the most secret of the Agency\'s secret compartments."'),
  'The Wilderness of Mirrors': figureHtml(images.angleton, 'James Jesus Angleton, CIA Chief of Counterintelligence, 1966', 'James Jesus Angleton (left), CIA Chief of Counterintelligence, meeting with Israeli intelligence chief Meir Amit, 1966. Angleton oversaw Operation CHAOS and the HTLINGUAL mail intercept program. He was forced to resign on Christmas Eve 1974.'),
  'Campus Spies': figureHtml(images.flowerPower, 'Anti-Vietnam War demonstrator offers a flower to military police at the Pentagon, 1967', 'A demonstrator offers a flower to military police at the Pentagon during an anti-Vietnam War protest, 1967. The anti-war movement was exactly what Operation CHAOS was created to surveil — and exactly the kind of movement the CIA\'s own analysts concluded was genuinely domestic.'),
  'Restless Youth': figureHtml(images.chaosDoc, 'Declassified Operation CHAOS document excerpt', 'An excerpt from a declassified Operation CHAOS document. Despite years of surveillance and thousands of files, the CIA\'s own reports repeatedly concluded that there was "no evidence of communist direction and control" of the anti-war movement.'),
  'The HYDRA': figureHtml(images.ciaBuilding, 'CIA headquarters building, Langley, Virginia', 'The CIA headquarters building at Langley, Virginia. In a soundproofed basement room, the HYDRA database indexed 300,000 American citizens — a city\'s worth of people catalogued in a secret government computer system.'),
  "Nixon's Obsession": figureHtml(images.helmsCommendation, 'CIA Director Richard Helms receiving a commendation, early 1970s', 'CIA Director Richard Helms receiving a commendation, early 1970s. Under Nixon, Operation CHAOS expanded dramatically. Helms later acknowledged that domestic surveillance was "a violation of our charter."'),
  'The Family Jewels': figureHtml(images.colby, 'CIA Director William Colby', 'CIA Director William Colby inherited the "Family Jewels" — a 693-page catalogue of CIA abuses — and made the fateful decision to terminate Operation CHAOS and cooperate with congressional investigators. His willingness to share secrets made him a pariah within the Agency.'),
  'Huge C.I.A. Operation': figureHtml(images.rockefellerFord, 'President Ford receiving the Rockefeller Commission report on CIA activities, 1975', 'President Gerald Ford receives the report of the Rockefeller Commission on CIA Activities Within the United States, 1975. The Commission concluded that Operation CHAOS "unlawfully exceeded the CIA\'s statutory authority."'),
  'The Reckoning': figureHtml(images.churchReport, 'Church Committee Final Report, Book II', 'The cover of Book II of the Church Committee\'s final report: "Intelligence Activities and the Rights of Americans." The six-volume, 2,702-page report remains the most comprehensive public accounting of U.S. intelligence abuses.'),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/operation-chaos.ts');
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
  <p class="epigraph">"I know the capacity that is there to make tyranny total in America, and we must see to it that this agency and all agencies that possess this technology operate within the law and under proper supervision, so that we never cross over that abyss. That is the abyss from which there is no return."</p>
  <p class="epigraph-attr">— Senator Frank Church, 1975</p>
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
      <p><strong>1952</strong> — CIA begins Project HTLINGUAL, intercepting mail between the U.S. and the Soviet Union.</p>
      <p><strong>February 1967</strong> — <em>Ramparts</em> magazine reveals CIA covert funding of the National Student Association.</p>
      <p><strong>August 1967</strong> — CIA Director Richard Helms establishes the Special Operations Group (Operation MHCHAOS) under James Angleton, directed by Richard Ober.</p>
      <p><strong>November 15, 1967</strong> — Helms reports to President Johnson: "no evidence of any contact between the most prominent peace movement leaders and foreign embassies."</p>
      <p><strong>1968</strong> — CIA's "Restless Youth" report finds "no convincing evidence" of foreign direction of student movements.</p>
      <p><strong>January 1969</strong> — Nixon takes office; over 50 CHAOS agents already operating.</p>
      <p><strong>June 1969</strong> — Nixon directs expanded CIA reporting on the anti-war movement.</p>
      <p><strong>1970</strong> — HYDRA computerized database launched; indexes 300,000 names.</p>
      <p><strong>July 23, 1970</strong> — Nixon approves the Huston Plan for expanded domestic surveillance; rescinded five days later.</p>
      <p><strong>June 17, 1972</strong> — Watergate break-in; burglars include former CIA officers Hunt and McCord.</p>
      <p><strong>May 7, 1973</strong> — CIA Director Schlesinger orders compilation of the "Family Jewels."</p>
      <p><strong>March 1974</strong> — Operation CHAOS formally terminated by Director Colby.</p>
      <p><strong>December 22, 1974</strong> — Seymour Hersh publishes "Huge C.I.A. Operation" exposé in the New York Times.</p>
      <p><strong>December 24, 1974</strong> — James Angleton forced to resign as CIA counterintelligence chief.</p>
      <p><strong>January 4, 1975</strong> — President Ford establishes the Rockefeller Commission.</p>
      <p><strong>June 1975</strong> — Rockefeller Commission report concludes CHAOS "unlawfully exceeded the CIA's statutory authority."</p>
      <p><strong>April 29, 1976</strong> — Church Committee publishes six-volume final report (2,702 pages).</p>
      <p><strong>1977</strong> — Richard Helms convicted of misleading Congress; fined $2,000.</p>
      <p><strong>1978</strong> — Foreign Intelligence Surveillance Act (FISA) signed into law.</p>
      <p><strong>1990</strong> — Operation CHAOS records destroyed.</p>
      <p><strong>June 25, 2007</strong> — CIA publicly releases the "Family Jewels" documents.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events, declassified CIA records, the Rockefeller Commission report, and the findings of the Church Committee. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Rafalko, Frank J. — <em>MH/CHAOS: The CIA's Campaign Against the Radical New Left and the Black Panthers</em>, Naval Institute Press, 2011</p>
      <p>Powers, Thomas — <em>The Man Who Kept the Secrets: Richard Helms and the CIA</em>, Knopf, 1979</p>
      <p>Morley, Jefferson — <em>The Ghost: The Secret Life of CIA Spymaster James Jesus Angleton</em>, St. Martin's Press, 2017</p>
      <p>Lyon, Verne — <em>Eyes on Havana: Memoir of an American Spy Betrayed by the CIA</em>, McFarland, 2017</p>
      <p>Risen, James — <em>The Last Honest Man: The CIA, the FBI, the Mafia, and the Kennedys — and One Senator's Fight to Save Democracy</em>, Little, Brown, 2023</p>
      <p>U.S. Senate — <em>Intelligence Activities and the Rights of Americans: Book II, Final Report of the Church Committee</em>, 1976</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-pentagon-protest-1967.jpg'),
        title: 'Operation\nCHAOS',
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
