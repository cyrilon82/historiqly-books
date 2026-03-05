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
  title: 'Operation Northwoods',
  subtitle: 'The Pentagon\'s Secret Plot Against America',
  author: 'HistorIQly',
  series: 'Vol. 7: Declassified',
  slug: 'operation-northwoods',
  description:
    'In 1962, the Joint Chiefs of Staff signed a top-secret plan to stage terrorist attacks on American soil to justify an invasion of Cuba. President Kennedy killed the plan and fired the general who proposed it. Thirty-five years later, the documents were finally declassified.',
};

// --- IMAGE PATHS (file:// URLs for epub-gen-memory) ---
function imgFileUrl(filename) {
  const filepath = resolve(IMG_DIR, filename);
  try {
    readFileSync(filepath);
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
  memorandum: imgFileUrl('hero-northwoods-memorandum.jpg'),
  lemnitzer: imgFileUrl('suspect-lyman-lemnitzer.jpg'),
  mcnamara: imgFileUrl('suspect-robert-mcnamara.jpg'),
  kennedyMcnamara: imgFileUrl('northwoods-kennedy-mcnamara.jpg'),
  excomm: imgFileUrl('northwoods-excomm-meeting.jpg'),
  pentagon: imgFileUrl('atmosphere-pentagon-building.jpg'),
  lansdale: imgFileUrl('suspect-edward-lansdale.jpg'),
  bayOfPigs: imgFileUrl('northwoods-bay-of-pigs.jpg'),
  cubanMissiles: imgFileUrl('northwoods-cuban-missiles.jpg'),
  guantanamo: imgFileUrl('northwoods-guantanamo-bay.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Generals and the President': figureHtml(
    images.pentagon,
    'The Pentagon, headquarters of the U.S. Department of Defense',
    'The Pentagon in Arlington, Virginia — the nerve center of American military power where Operation Northwoods was conceived. Its 17.5 miles of corridors connected offices staffed by WWII veterans who chafed under Kennedy\'s civilian leadership.'
  ),
  'The Document': figureHtml(
    images.memorandum,
    'The Operation Northwoods memorandum, March 13, 1962',
    'The cover page of the Northwoods memorandum, addressed from the Joint Chiefs of Staff to the Secretary of Defense. Stamped TOP SECRET SPECIAL HANDLING NOFORN, the document proposed a campaign of staged provocations to justify an invasion of Cuba.'
  ),
  'Remember the Maine': figureHtml(
    images.guantanamo,
    'Aerial view of U.S. Naval Station Guantanamo Bay, Cuba',
    'The U.S. Naval Station at Guantanamo Bay — one of the primary targets mentioned in the Northwoods proposals. The Joint Chiefs planned to stage attacks on the base and blame Cuban forces.'
  ),
  'The Drone': figureHtml(
    images.bayOfPigs,
    'U.S. Navy aircraft over USS Essex during the Bay of Pigs invasion, April 1961',
    'U.S. Navy Skyhawks over USS Essex during the Bay of Pigs invasion, April 1961. The catastrophic failure of the invasion convinced the Joint Chiefs that manufactured pretexts were needed to justify a second attempt.'
  ),
  'Terror in Miami': figureHtml(
    images.lansdale,
    'Major General Edward Lansdale',
    'Brigadier General Edward Lansdale, Chief of Operations for Operation Mongoose. A former advertising executive turned covert operations specialist, Lansdale\'s request for "pretexts for military intervention" directly led to the creation of the Northwoods document.'
  ),
  'The Rejection': figureHtml(
    images.kennedyMcnamara,
    'President Kennedy confers with Secretary of Defense McNamara at the White House',
    'President Kennedy and Secretary of Defense Robert McNamara at the White House. Kennedy rejected the Northwoods proposals on March 16, 1962, telling General Lemnitzer bluntly that "we were not discussing the use of military force."'
  ),
  'The Aftermath': figureHtml(
    images.lemnitzer,
    'General Lyman L. Lemnitzer, Chairman of the Joint Chiefs of Staff',
    'General Lyman Lemnitzer, Chairman of the Joint Chiefs of Staff, who signed the Northwoods memorandum. Kennedy removed him from the chairmanship in June 1962 and reassigned him to NATO. He died in 1988 — nine years before the document was declassified.'
  ),
  'Dirty Tricks': figureHtml(
    images.mcnamara,
    'Robert McNamara, Secretary of Defense',
    'Secretary of Defense Robert McNamara, the youngest person ever to hold the position. When asked about Operation Northwoods decades later, he said: "I have absolutely zero recollection of it. But I sure as hell would have rejected it... How stupid!"'
  ),
  'Thirty-Five Years in the Dark': figureHtml(
    images.excomm,
    'Executive Committee of the National Security Council during the Cuban Missile Crisis',
    'The Executive Committee of the National Security Council meets during the Cuban Missile Crisis, October 1962 — seven months after Northwoods was rejected. The Joint Chiefs unanimously recommended invasion; Kennedy chose a naval blockade instead.'
  ),
  'The Lesson': figureHtml(
    images.cubanMissiles,
    'U.S. reconnaissance photo of Soviet missile installations in Cuba',
    'A U.S. reconnaissance photograph showing Soviet missile installations in Cuba, October 1962. What no one knew during the crisis was that Soviet forces already possessed tactical nuclear weapons — an invasion triggered by Northwoods-style pretexts could have started nuclear war.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/operation-northwoods.ts');
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
  <p class="epigraph">"We had military officers proposing things that were completely insane."</p>
  <p class="epigraph-attr">— Robert McNamara, Secretary of Defense (1961-1968)</p>
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
      <p><strong>January 1, 1959</strong> — Fidel Castro overthrows the Batista regime and seizes power in Cuba, 90 miles from Florida.</p>
      <p><strong>October 1, 1960</strong> — General Lyman Lemnitzer becomes Chairman of the Joint Chiefs of Staff.</p>
      <p><strong>January 20, 1961</strong> — John F. Kennedy inaugurated as President. Robert McNamara, 44, becomes Secretary of Defense.</p>
      <p><strong>April 17-20, 1961</strong> — Bay of Pigs invasion fails catastrophically. Kennedy privately blames the Joint Chiefs. The failure "tainted all the Chiefs" in his mind.</p>
      <p><strong>November 3, 1961</strong> — Kennedy authorizes Operation Mongoose, a covert program to overthrow Castro. Edward Lansdale named Chief of Operations.</p>
      <p><strong>January 1962</strong> — McNamara requests the Pentagon develop "pretexts" for possible U.S. military intervention in Cuba.</p>
      <p><strong>February 20, 1962</strong> — John Glenn orbits the Earth. The Joint Chiefs had prepared Operation Dirty Trick: if Glenn died, they would blame Cuba by fabricating evidence of electronic interference.</p>
      <p><strong>March 9, 1962</strong> — The Joint Chiefs complete "Justification for U.S. Military Intervention in Cuba" — the Operation Northwoods document. Proposals include bombing Miami, sinking refugee boats, faking the destruction of a civilian airliner, and staging attacks on Guantanamo Bay.</p>
      <p><strong>March 13, 1962</strong> — General Lemnitzer presents the Northwoods memorandum to Secretary of Defense McNamara. It is signed by every member of the Joint Chiefs.</p>
      <p><strong>March 16, 1962</strong> — President Kennedy rejects the proposals in a meeting with Lemnitzer, stating "bluntly that we were not discussing the use of military force."</p>
      <p><strong>June 1962</strong> — Kennedy informs Lemnitzer he will not be reappointed as Chairman. He is reassigned to NATO.</p>
      <p><strong>October 1, 1962</strong> — General Maxwell Taylor replaces Lemnitzer as Chairman. Taylor is Kennedy's trusted personal advisor.</p>
      <p><strong>October 16-28, 1962</strong> — Cuban Missile Crisis. Soviet nuclear missiles discovered in Cuba. The Joint Chiefs unanimously recommend invasion. Kennedy chooses a naval blockade. The crisis is resolved through diplomacy.</p>
      <p><strong>November 22, 1963</strong> — President Kennedy assassinated in Dallas.</p>
      <p><strong>August 1964</strong> — Gulf of Tonkin incident. An alleged second attack on USS Maddox — later revealed as exaggerated or nonexistent — is used to authorize military escalation in Vietnam.</p>
      <p><strong>November 12, 1988</strong> — Lemnitzer dies at Walter Reed Army Medical Center, buried with full honors at Arlington National Cemetery — nine years before Northwoods is declassified.</p>
      <p><strong>November 18, 1997</strong> — The Assassination Records Review Board declassifies 1,521 pages of military records, including Operation Northwoods. The documents attract almost no public attention.</p>
      <p><strong>April 2001</strong> — Journalist James Bamford publishes <em>Body of Secrets</em>, bringing Operation Northwoods to mass public attention for the first time. He calls it what "may be the most corrupt plan ever created by the U.S. government."</p>
      <p><strong>September 11, 2001</strong> — Five months after Bamford's book, the 9/11 attacks occur. Operation Northwoods becomes a cornerstone reference for conspiracy theorists.</p>
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
      <p>Bamford, James — <em>Body of Secrets: Anatomy of the Ultra-Secret National Security Agency</em>, Doubleday, 2001</p>
      <p>National Security Archive — "Justification for U.S. Military Intervention in Cuba," George Washington University, 2001</p>
      <p>Kornbluh, Peter — <em>Bay of Pigs Declassified: The Secret CIA Report on the Invasion of Cuba</em>, The New Press, 1998</p>
      <p>Frankel, Max — <em>High Noon in the Cold War: Kennedy, Khrushchev, and the Cuban Missile Crisis</em>, Presidio Press, 2004</p>
      <p>Morris, Errol (dir.) — <em>The Fog of War: Eleven Lessons from the Life of Robert S. McNamara</em>, Sony Pictures Classics, 2003</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-northwoods-memorandum.jpg'),
        title: 'Operation\nNorthwoods',
        subtitle: book.subtitle,
        series: book.series,
        author: book.author,
        outputPath: coverPath,
      });
    } else {
      console.log(`  Using existing cover: ${coverPath}`);
    }

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

    const outDir = resolve(ROOT, 'public/books');
    mkdirSync(outDir, { recursive: true });

    const outPath = resolve(outDir, `${book.slug}.epub`);
    writeFileSync(outPath, epubBuffer);

    const imgCount = Object.values(chapterImages).filter(Boolean).length;
    console.log(`\nRaw EPUB written to: ${outPath}`);
    console.log(`Size: ${(epubBuffer.length / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Chapters: ${chapters.length}`);
    console.log(`Images: ${imgCount} chapters with illustrations`);

    console.log('\nPost-processing...');
    await polishEpub(outPath, outPath);

    console.log('\nDone!');
  } catch (err) {
    console.error('Failed to generate EPUB:', err);
    process.exit(1);
  }
}

build();
