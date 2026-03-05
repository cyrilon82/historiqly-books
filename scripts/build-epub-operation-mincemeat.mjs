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
  title: 'Operation Mincemeat',
  subtitle: 'The Dead Man Who Fooled Hitler',
  author: 'HistorIQly',
  series: 'Vol. 7: Declassified',
  slug: 'operation-mincemeat',
  description:
    'In 1943, two British intelligence officers dressed a dead homeless man in a Royal Marines uniform, stuffed his pockets with love letters and fake invasion plans, and dropped him into the sea off Spain. The Germans found the body, believed every word, and moved entire divisions to the wrong countries. This is the true story of the most audacious deception of the Second World War.',
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
  hero: imgFileUrl('hero-hms-seraph-portsmouth.jpg'),
  cholmondeleyMontagu: imgFileUrl('cholmondeley-montagu-mincemeat.jpg'),
  montagu: imgFileUrl('suspect-ewen-montagu.jpg'),
  glyndwrMichael: imgFileUrl('suspect-glyndwr-michael.jpg'),
  corpse: imgFileUrl('mincemeat-corpse-major-martin.jpg'),
  idCard: imgFileUrl('mincemeat-major-martin-documents.jpg'),
  archiveDoc: imgFileUrl('mincemeat-national-archives-document.jpg'),
  seraphOfficers: imgFileUrl('mincemeat-hms-seraph-officers.jpg'),
  grave: imgFileUrl('mincemeat-grave-huelva.jpg'),
  sicilyInvasion: imgFileUrl('atmosphere-sicily-invasion-1943.jpg'),
  soldierReading: imgFileUrl('atmosphere-soldier-reading-sicily.jpg'),
  troopsAshore: imgFileUrl('atmosphere-sicily-troops-ashore-1943.jpg'),
  aberbargoed: imgFileUrl('mincemeat-aberbargoed-memorial.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Trout Memo': figureHtml(
    images.archiveDoc,
    'UK National Archives document related to Operation Mincemeat',
    'A War Office document from the National Archives relating to the planning of Operation Mincemeat. The operation was classified for decades; full files were not released until the 1990s.'
  ),
  'The Man Who Never Was': figureHtml(
    images.glyndwrMichael,
    'Glyndwr Michael, the homeless Welshman whose body was used',
    'Glyndwr Michael of Aberbargoed, South Wales — the man whose body became "Major William Martin." He died of phosphorus poisoning in a London warehouse in January 1943, aged 34.'
  ),
  'The Wallet of a Dead Man': figureHtml(
    images.idCard,
    'The forged Naval Identity Card of Major William Martin',
    'The forged Naval Identity Card No. 148228, in the name of Captain (Acting Major) William Martin, Royal Marines. Born Cardiff, 1907. The photograph was actually of MI5 officer Ronnie Reed, who resembled the corpse.'
  ),
  'Five Hundred Miles in the Dark': figureHtml(
    images.cholmondeleyMontagu,
    'Charles Cholmondeley and Ewen Montagu with the transport van',
    'Flight Lieutenant Charles Cholmondeley (left) and Lieutenant Commander Ewen Montagu (right) beside the van used to transport the body from London to Scotland. The 500-mile overnight journey was driven at breakneck speed through the blackout.'
  ),
  'Into the Water': figureHtml(
    images.hero,
    'HMS Seraph returns to Portsmouth after Mediterranean operations',
    'HMS Seraph (P219) returns to Portsmouth. The S-class submarine carried the body of "Major Martin" from Scotland to the coast of Spain in April 1943. Only the captain and one officer knew the canister\'s true contents.'
  ),
  'The Fisherman and the Spy': figureHtml(
    images.corpse,
    'The body of Glyndwr Michael dressed as Major Martin before deployment',
    'The corpse of Glyndwr Michael dressed in Royal Marines uniform as "Major Martin," photographed before deployment in April 1943. The briefcase containing the fake documents was chained to his belt.'
  ),
  'Swallowed Whole': figureHtml(
    images.soldierReading,
    'A British soldier reads about Sicily before the invasion, 1943',
    'A British soldier reads up on Sicily — the real target of the Allied invasion — before Operation Husky. Thanks to Operation Mincemeat, the Germans believed Sicily was a feint and reinforced Greece and Sardinia instead.'
  ),
  'The Soft Underbelly': figureHtml(
    images.troopsAshore,
    'British troops wade ashore during the invasion of Sicily, July 10, 1943',
    'British troops wade ashore from landing craft during the invasion of Sicily, 10 July 1943. The deception had diverted German armour to Greece and delayed the Axis response by critical hours.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/operation-mincemeat.ts');
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
  <p class="epigraph">"In wartime, truth is so precious that she should always be attended by a bodyguard of lies."</p>
  <p class="epigraph-attr">— Winston Churchill, 1943</p>
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
      <p><strong>September 1939</strong> — The "Trout Memo," attributed to Admiral Godfrey with input from Ian Fleming, circulates within Naval Intelligence. Item 28 proposes planting fake documents on a corpse.</p>
      <p><strong>October 1942</strong> — Flight Lieutenant Charles Cholmondeley proposes a dead-body deception scheme to the Twenty Committee. It is initially rejected as impractical.</p>
      <p><strong>November 1942</strong> — Lieutenant Commander Ewen Montagu joins the effort. Together with Cholmondeley, he refines the plan into Operation Mincemeat.</p>
      <p><strong>January 28, 1943</strong> — Glyndwr Michael, a homeless Welshman aged 34, dies of phosphorus poisoning in a warehouse near King's Cross, London. His body is selected for the operation.</p>
      <p><strong>February–April 1943</strong> — The identity of "Major William Martin, RM" is painstakingly constructed: fake ID card, love letters from "Pam" (Jean Leslie's photograph), engagement ring receipt, bank overdraft notice, theatre stubs, and personal effects.</p>
      <p><strong>April 17, 1943</strong> — The body is dressed, placed in a steel canister packed with dry ice, and driven 500 miles overnight from London to Holy Loch, Scotland, by MI5 driver Jock Horsfall.</p>
      <p><strong>April 19, 1943</strong> — HMS Seraph, commanded by Lieutenant Bill Jewell, departs with the canister lashed to her deck.</p>
      <p><strong>April 30, 1943, 4:15 AM</strong> — Seraph surfaces off Huelva, Spain. The body is deployed into the water. Jewell reads Psalm 39.</p>
      <p><strong>April 30, 1943, 9:30 AM</strong> — Fisherman Jose Antonio Rey Maria discovers the body near Punta Umbria.</p>
      <p><strong>May 1, 1943</strong> — A Spanish pathologist conducts a cursory autopsy and concludes death by drowning. The phosphorus poisoning goes undetected.</p>
      <p><strong>May 2, 1943</strong> — "Major Martin" is buried with full military honors in the Cementerio de la Soledad, Huelva.</p>
      <p><strong>May 2–11, 1943</strong> — Adolf Clauss (Abwehr agent, Huelva) arranges for the documents to be copied. Karl-Erich Kuhlenthal (senior Abwehr, Madrid) forwards them to Berlin with high confidence.</p>
      <p><strong>May 14, 1943</strong> — Hitler tells Admiral Donitz that Sicily is NOT the target. He orders the 1st Panzer Division to Greece, plus 17 additional divisions to Greece, Sardinia, and the Balkans.</p>
      <p><strong>May 14, 1943</strong> — Signal to Churchill: "Mincemeat swallowed rod, line and sinker."</p>
      <p><strong>July 10, 1943</strong> — Operation Husky: 160,000 Allied troops invade Sicily. Hitler initially believes it is a feint and delays committing reserves.</p>
      <p><strong>July 25, 1943</strong> — Mussolini is deposed. Italy signs an armistice on September 8.</p>
      <p><strong>August 17, 1943</strong> — Sicily falls to the Allies after a 38-day campaign.</p>
      <p><strong>1953</strong> — Ewen Montagu publishes <em>The Man Who Never Was</em>, the first public account.</p>
      <p><strong>1956</strong> — Film adaptation starring Clifton Webb wins a BAFTA.</p>
      <p><strong>1982</strong> — Charles Cholmondeley dies in obscurity, his role unrecognised.</p>
      <p><strong>1985</strong> — Ewen Montagu dies in Kensington.</p>
      <p><strong>1996–97</strong> — Glyndwr Michael's identity is revealed. His name is added to the Huelva headstone: "Glyndwr Michael; Served as Major William Martin, RM."</p>
      <p><strong>2010</strong> — Ben Macintyre publishes the definitive modern account, restoring Cholmondeley's role.</p>
      <p><strong>2022</strong> — Netflix film <em>Operation Mincemeat</em> starring Colin Firth as Montagu.</p>
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
      <p>Macintyre, Ben — <em>Operation Mincemeat: The True Spy Story That Changed the Course of World War II</em>, Bloomsbury, 2010</p>
      <p>Montagu, Ewen — <em>The Man Who Never Was</em>, Evans Brothers, 1953</p>
      <p>Smyth, Denis — <em>Deathly Deception: The Real Story of Operation Mincemeat</em>, Oxford University Press, 2010</p>
      <p>Holt, Thaddeus — <em>The Deceivers: Allied Military Deception in the Second World War</em>, Scribner, 2004</p>
      <p>Howard, Michael — <em>British Intelligence in the Second World War, Vol. 5: Strategic Deception</em>, HMSO, 1990</p>
      <p>Masterman, J.C. — <em>The Double Cross System</em>, Yale University Press, 1972</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-hms-seraph-portsmouth.jpg'),
        title: 'Operation\nMincemeat',
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
