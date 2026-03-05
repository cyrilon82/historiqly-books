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
  title: 'The Gulf of Tonkin',
  subtitle: 'The Phantom Attack That Started a War',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'gulf-of-tonkin',
  description:
    'On August 4, 1964, the United States went to war over an attack that never happened. Two destroyers fired into empty darkness, a president addressed the nation with facts he knew were false, and Congress handed over the power to wage war on the strength of a lie. This is the true story of the phantom battle in the Gulf of Tonkin.',
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
  hero: imgFileUrl('hero-uss-maddox-at-sea.jpg'),
  herrickOgier: imgFileUrl('tonkin-herrick-ogier-aboard-maddox.jpg'),
  torpedoBoatUnderFire: imgFileUrl('tonkin-torpedo-boat-under-fire.jpg'),
  p4TorpedoBoat: imgFileUrl('tonkin-p4-torpedo-boat.jpg'),
  p4UnderFire: imgFileUrl('tonkin-p4-under-fire-maddox.jpg'),
  lbjMidnightAddress: imgFileUrl('tonkin-lbj-midnight-address.jpg'),
  lbjSignsResolution: imgFileUrl('tonkin-lbj-signs-resolution.jpg'),
  trackChart: imgFileUrl('tonkin-track-chart-aug2.png'),
  desotoMap: imgFileUrl('tonkin-desoto-patrol-map.png'),
  herrick: imgFileUrl('suspect-john-herrick.jpg'),
  stockdale: imgFileUrl('suspect-james-stockdale.jpg'),
  mcnamara: imgFileUrl('suspect-robert-mcnamara.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The DESOTO Patrol': figureHtml(
    images.desotoMap,
    'DESOTO patrol mission map off Vietnam, 1964',
    'The DESOTO patrol route in the Gulf of Tonkin. The USS Maddox cruised close to the North Vietnamese coast, intercepting communications from military installations while South Vietnamese commandos carried out separate raids nearby.'
  ),
  'The Shadow War': figureHtml(
    images.herrickOgier,
    'Captain Herrick and Commander Ogier aboard USS Maddox in August 1964',
    'Captain John J. Herrick (left) and Commander Herbert L. Ogier aboard the USS Maddox in August 1964. Herrick, the task group commander, would express grave doubts about the August 4 "attack" — doubts that were ignored in Washington.'
  ),
  'The First Attack': figureHtml(
    images.torpedoBoatUnderFire,
    'North Vietnamese torpedo boat under fire on 2 August 1964',
    'A North Vietnamese P-4 motor torpedo boat under fire from the USS Maddox on August 2, 1964. The real attack lasted approximately twenty minutes. One P-4 was sunk, two were damaged, and the Maddox sustained a single bullet dent.'
  ),
  'The Phantom Battle': figureHtml(
    images.trackChart,
    'Track chart of USS Maddox and North Vietnamese torpedo boats on 2 August 1964',
    'The official track chart of the August 2 engagement — the attack that actually happened. No comparable chart exists for August 4, because there was nothing to chart.'
  ),
  'The Rush to Retaliate': figureHtml(
    images.lbjMidnightAddress,
    'President Johnson delivers his midnight address on the Gulf of Tonkin incident',
    'President Lyndon B. Johnson addresses the nation just before midnight on August 4, 1964, announcing retaliatory air strikes against North Vietnam. He described the attacks as "deliberate" and "unprovoked" — claims he knew to be questionable.'
  ),
  'The Blank Check': figureHtml(
    images.lbjSignsResolution,
    'President Johnson signs the Gulf of Tonkin Resolution',
    'President Johnson signs the Gulf of Tonkin Resolution on August 10, 1964. The resolution passed the Senate 88-2 and the House 416-0, giving the President sweeping authority to wage war in Southeast Asia.'
  ),
  'Operation Pierce Arrow': figureHtml(
    images.p4UnderFire,
    'North Vietnamese P-4 torpedo boat under fire from USS Maddox',
    'A North Vietnamese P-4 torpedo boat photographed during the August 2 engagement. Operation Pierce Arrow, launched in retaliation for the phantom August 4 attack, destroyed dozens of these boats at their bases.'
  ),
  'The Truth Emerges': figureHtml(
    images.mcnamara,
    'Robert McNamara, Secretary of Defense',
    'Robert S. McNamara, Secretary of Defense. In 1995, he travelled to Hanoi and asked General Giap what happened on August 4, 1964. "Absolutely nothing," Giap replied. McNamara called it "a pretty damned good source."'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/gulf-of-tonkin.ts');
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
  <p class="epigraph">"I had the best seat in the house to watch that event, and our destroyers were just shooting at phantom targets — there were no PT boats there. There was nothing there but black water and American firepower."</p>
  <p class="epigraph-attr">— Commander James Stockdale, U.S. Navy pilot, August 4, 1964</p>
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
      <p><strong>1961</strong> — The CIA begins inserting South Vietnamese agent teams into North Vietnam for intelligence gathering and sabotage. Nearly all teams are captured or killed.</p>
      <p><strong>January 1964</strong> — The covert programme is transferred from the CIA to the Department of Defense and renamed Operational Plan 34-Alpha (OPLAN 34A). The Pentagon's Studies and Observations Group (SOG) takes over operations.</p>
      <p><strong>July 1964</strong> — Lt. Gen. Westmoreland shifts 34-Alpha tactics from land-based commando raids to shore bombardments from fast patrol boats.</p>
      <p><strong>July 28, 1964</strong> — USS Maddox departs Keelung, Taiwan, for a DESOTO intelligence-gathering patrol in the Gulf of Tonkin.</p>
      <p><strong>July 30–31, 1964</strong> — South Vietnamese commandos attack North Vietnamese radar stations on Hon Me and Hon Ngu islands under Operation 34-Alpha.</p>
      <p><strong>August 2, 1964</strong> — Three North Vietnamese P-4 torpedo boats attack the USS Maddox in the Gulf of Tonkin. The Maddox and aircraft from USS Ticonderoga sink one boat and damage two. The Maddox sustains one bullet dent. This attack is confirmed and undisputed.</p>
      <p><strong>August 3, 1964</strong> — USS Turner Joy joins the Maddox in the gulf. Both ships are ordered to continue patrol despite Captain Herrick's recommendation to withdraw.</p>
      <p><strong>August 4, 1964 (evening, local time)</strong> — The Maddox and Turner Joy report a second attack by torpedo boats. Over four hours, both ships fire hundreds of rounds at radar and sonar contacts. Commander James Stockdale, flying overhead, sees no enemy vessels. Captain Herrick sends a cable expressing doubts: "Freak weather effects on radar and overeager sonarmen may have accounted for many reports."</p>
      <p><strong>August 4, 1964 (11:36 PM ET)</strong> — President Johnson delivers his "Midnight Address," announcing retaliatory air strikes and describing the attacks as "deliberate" and "unprovoked."</p>
      <p><strong>August 5, 1964</strong> — Operation Pierce Arrow: 64 sorties from USS Ticonderoga and USS Constellation strike North Vietnamese torpedo boat bases and the Vinh oil storage facility. Lt.(jg) Richard Sather is killed — the first American aviator lost over North Vietnam. Lt.(jg) Everett Alvarez Jr. is captured — the first American POW of the Vietnam War.</p>
      <p><strong>August 7, 1964</strong> — Congress passes the Gulf of Tonkin Resolution. Senate vote: 88–2 (Wayne Morse and Ernest Gruening dissenting). House vote: 416–0.</p>
      <p><strong>August 10, 1964</strong> — President Johnson signs the Gulf of Tonkin Resolution into law.</p>
      <p><strong>March 1965</strong> — Operation Rolling Thunder begins — a sustained bombing campaign against North Vietnam that will last more than three years. First U.S. combat troops (Marines) land at Da Nang.</p>
      <p><strong>1968</strong> — U.S. troop levels in Vietnam reach 536,000. Senator Fulbright holds hearings questioning the Gulf of Tonkin incident. Peak of American involvement.</p>
      <p><strong>1970</strong> — Congress repeals the Gulf of Tonkin Resolution.</p>
      <p><strong>1971</strong> — Daniel Ellsberg leaks the Pentagon Papers, revealing systematic government deception about the origins and conduct of the Vietnam War.</p>
      <p><strong>1995</strong> — Robert McNamara meets General Vo Nguyen Giap in Hanoi. Giap confirms: "On the fourth of August, there was absolutely nothing."</p>
      <p><strong>2003</strong> — McNamara admits in the documentary <em>The Fog of War</em> that the August 4 attack did not occur.</p>
      <p><strong>2005</strong> — NSA declassifies nearly 200 documents. Historian Robert J. Hanyok's study concludes that signals intelligence was deliberately manipulated to support the false narrative of an August 4 attack.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources, declassified documents, and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Hanyok, Robert J. — "Skunks, Bogies, Silent Hounds, and the Flying Fish: The Gulf of Tonkin Mystery, 2–4 August 1964," NSA Cryptologic Quarterly, 2001 (declassified 2005)</p>
      <p>Moise, Edwin E. — <em>Tonkin Gulf and the Escalation of the Vietnam War</em>, University of North Carolina Press, 1996</p>
      <p>Ellsberg, Daniel — <em>Secrets: A Memoir of Vietnam and the Pentagon Papers</em>, Viking, 2002</p>
      <p>McNamara, Robert S. — <em>In Retrospect: The Tragedy and Lessons of Vietnam</em>, Times Books, 1995</p>
      <p>Morris, Errol (director) — <em>The Fog of War: Eleven Lessons from the Life of Robert S. McNamara</em>, Sony Pictures Classics, 2003</p>
      <p>Stockdale, Jim and Sybil — <em>In Love and War</em>, Harper & Row, 1984</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-uss-maddox-at-sea.jpg'),
        title: 'The Gulf\nof Tonkin',
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
