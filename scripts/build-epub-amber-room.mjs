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
  title: 'The Amber Room',
  subtitle: 'The Eighth Wonder of the World That Vanished',
  author: 'HistorIQly',
  series: 'Vol. 11: Heists',
  slug: 'amber-room',
  description:
    'In 1701, a Prussian king commissioned a room made entirely of amber — six tonnes of fossilised sunlight, worth hundreds of millions. In 1941, the Nazis dismantled it in 36 hours and shipped it to Königsberg. Then it vanished. Eighty years of obsession, mysterious deaths, and false leads have produced no answers. This is the story of the most valuable object ever lost.',
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
  hero: imgFileUrl('hero-amber-room-reconstructed.jpg'),
  historical: imgFileUrl('evidence-amber-room-1917.jpg'),
  catherine: imgFileUrl('location-catherine-palace.jpg'),
  peter: imgFileUrl('figure-peter-the-great.jpg'),
  konigsberg: imgFileUrl('location-konigsberg-castle.jpg'),
  panel: imgFileUrl('evidence-amber-panel-detail.jpg'),
  frederick: imgFileUrl('figure-frederick-i-prussia.jpg'),
  amber: imgFileUrl('atmosphere-amber-raw.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The King Who Wanted Sunlight': figureHtml(
    images.frederick,
    'Frederick I of Prussia, who commissioned the Amber Room',
    'Frederick I of Prussia. In 1701, he commissioned a room lined entirely with amber — a material so rare and difficult to work that no one had attempted anything on this scale before.'
  ),
  'Amber for Giants': figureHtml(
    images.peter,
    'Peter the Great of Russia',
    'Peter the Great received the Amber Room panels from Frederick William I in 1716, in exchange for 55 tall Russian grenadiers for the Prussian King\'s "Potsdam Giants" regiment.'
  ),
  'Six Tonnes of Sunlight': figureHtml(
    images.hero,
    'The Amber Room at Catherine Palace',
    'The Amber Room in its full glory. Over six tonnes of amber covered more than 55 square metres of wall surface. Five hundred and fifty candles set the room ablaze with warm golden light. Visitors called it the Eighth Wonder of the World.'
  ),
  'Thirty-Six Hours': figureHtml(
    images.konigsberg,
    'Königsberg Castle, where the Amber Room was displayed 1942–1944',
    'Königsberg Castle in East Prussia. German soldiers dismantled the Amber Room in 36 hours and shipped it here in 27 crates. Curator Alfred Rohde declared the room had "returned to its homeland."'
  ),
  "The Gauleiter's Veto": figureHtml(
    images.historical,
    'Historical photograph of the original Amber Room',
    'One of only 86 black-and-white photographs documenting the original room. When Gauleiter Erich Koch vetoed evacuation, this documentation became all that survived of the room\'s original appearance.'
  ),
  'The Curse of the Search': figureHtml(
    images.catherine,
    'Catherine Palace at Tsarskoye Selo',
    'The Catherine Palace at Tsarskoye Selo, where the Amber Room stood for nearly 200 years before the Nazi invasion. The empty room became a symbol of everything the war had destroyed.'
  ),
  'Where in the World': figureHtml(
    images.amber,
    'Raw Baltic amber pieces',
    'Raw Baltic amber — fossilised tree resin, forty million years old. Six tonnes of this material, carved and assembled over seventy years, vanished in the final weeks of World War II. The search has consumed treasure hunters, intelligence agents, and scholars for eighty years.'
  ),
  'Resurrection': figureHtml(
    images.panel,
    'Detail of amber panel craftsmanship',
    'Amber panel detail showing the intricate mosaic work. The reconstruction team of 50 artisans spent 24 years reinventing lost techniques from photographs and 76 surviving fragments.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/amber-room.ts');
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
  <p class="epigraph">"What has been lost can be rebuilt; what has been destroyed can be remembered; what has been forgotten can be discovered again."</p>
  <p class="epigraph-attr">— Alexander Zhuravlyov, Head of the Amber Room Reconstruction Workshop</p>
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
      <p><strong>1701</strong> — Frederick I of Prussia commissions a room lined entirely with amber for the Charlottenburg Palace in Berlin. Architect Andreas Schlüter designs the concept; master craftsman Gottfried Wolfram begins fabrication.</p>
      <p><strong>1707</strong> — Wolfram is dismissed over payment disputes. Amber masters Ernst Schacht and Gottfried Turau continue the work from workshops in Danzig.</p>
      <p><strong>1713</strong> — Frederick I dies. His successor, Frederick William I (the "Soldier King"), halts all work on the room. The unfinished panels are stored in the Berlin armoury.</p>
      <p><strong>1716 (November 17)</strong> — Frederick William I gifts the amber panels to Tsar Peter the Great of Russia to cement an alliance in the Great Northern War. In exchange, Peter provides 55 exceptionally tall grenadiers for the King's "Potsdam Giants" regiment.</p>
      <p><strong>1717 (January)</strong> — The panels, packed in 18 crates, are shipped from Berlin to St. Petersburg. The journey takes nearly six months.</p>
      <p><strong>1755</strong> — Empress Elizabeth orders the panels moved to the Catherine Palace at Tsarskoye Selo. Architect Bartolomeo Rastrelli expands the design with mirrors, gilded carvings, and Florentine mosaics.</p>
      <p><strong>1763–1770</strong> — Catherine the Great orders the remaining painted surfaces replaced with new amber panels. 450 kg of additional amber is used. The room is essentially complete — 70 years after construction began.</p>
      <p><strong>1941 (June 22)</strong> — Nazi Germany launches Operation Barbarossa. Curator Anatoly Kuchumov attempts to hide the Amber Room behind wallpaper, but the amber is too brittle to dismantle.</p>
      <p><strong>1941 (October 14)</strong> — German soldiers, directed by art historian Solms-Laubach, dismantle the entire Amber Room in 36 hours. The panels are packed into 27 crates and shipped to Königsberg Castle.</p>
      <p><strong>1942 (March)</strong> — Curator Alfred Rohde reassembles the room in Königsberg Castle's Knight's Hall and opens it to public exhibition.</p>
      <p><strong>1944 (August)</strong> — RAF bombing raids severely damage Königsberg Castle. Rohde dismantles and crates the panels. Gauleiter Erich Koch vetoes evacuation.</p>
      <p><strong>1945 (January 12)</strong> — Last confirmed sighting: Rohde writes to Berlin that the room is packed and ready for transport. Railway connections are severed days later.</p>
      <p><strong>1945 (April 9)</strong> — Soviet forces capture Königsberg. The castle is in ruins. No trace of the Amber Room is found.</p>
      <p><strong>1945 (December)</strong> — Alfred Rohde and his wife die of typhus while under KGB investigation.</p>
      <p><strong>1979</strong> — The Soviet government orders the reconstruction of the Amber Room. Work begins with 86 black-and-white photographs and one colour slide as references.</p>
      <p><strong>1987</strong> — Treasure hunter Georg Stein is found dead in a Bavarian forest under suspicious circumstances. Stasi investigator Paul Enke dies of heart failure.</p>
      <p><strong>1997</strong> — One original Florentine mosaic (the allegory of "Touch and Smell") is recovered in Bremen, Germany — the only confirmed original piece to surface.</p>
      <p><strong>2003 (May 31)</strong> — The reconstructed Amber Room is unveiled at the Catherine Palace by Presidents Putin and Schröder during St. Petersburg's 300th anniversary celebrations. Cost: over $11 million across 24 years.</p>
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
      <p>Scott-Clark, Catherine & Levy, Adrian — <em>The Amber Room: The Fate of the World's Greatest Lost Treasure</em>, Walker & Company, 2004</p>
      <p>Varoli, John — "A Brief History of the Amber Room," <em>Smithsonian Magazine</em>, 2007</p>
      <p>Koeppe, Wolfram — "Amber in the Arts," <em>The Metropolitan Museum of Art Heilbrunn Timeline of Art History</em></p>
      <p>Enke, Paul — <em>Bernsteinzimmer-Report</em>, German Democratic Republic Ministry of State Security</p>
      <p>Tsarskoe Selo State Museum — "The Amber Room," official museum documentation</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-amber-room-reconstructed.jpg'),
        title: 'The Amber\nRoom',
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
