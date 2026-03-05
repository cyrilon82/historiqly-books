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
  title: 'The Nazi Gold Train',
  subtitle: 'Hidden Treasure in Polish Tunnels',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'nazi-gold-train',
  description:
    'In 2015, two treasure hunters claimed they had found a legendary Nazi armored train buried beneath the mountains of Poland. What followed was a media frenzy, a government investigation, and an excavation that cost over a hundred thousand euros — all chasing a ghost. This is the true story of Project Riese, the gold train legend, and the town that struck gold without ever finding any.',
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
  hero: imgFileUrl('hero-ksiaz-castle-trees.jpg'),
  tunnel: imgFileUrl('nazi-gold-train-osowka-tunnel.jpg'),
  corridor: imgFileUrl('nazi-gold-train-underground-corridor.jpg'),
  interior: imgFileUrl('nazi-gold-train-ksiaz-interior.jpg'),
  grossRosen: imgFileUrl('nazi-gold-train-gross-rosen-gate.jpg'),
  marker: imgFileUrl('nazi-gold-train-golden-train-marker.jpg'),
  mountains: imgFileUrl('nazi-gold-train-owl-mountains.jpg'),
  autumn: imgFileUrl('nazi-gold-train-ksiaz-autumn.jpg'),
  tunnel2: imgFileUrl('nazi-gold-train-osowka-tunnel-2.jpg'),
  landscape: imgFileUrl('nazi-gold-train-gory-sowie.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Vanishing': figureHtml(
    images.mountains,
    'Panoramic view of the Owl Mountains (Góry Sowie) in Lower Silesia, Poland',
    'The Owl Mountains of Lower Silesia — the forested range where Project Riese\'s seven underground complexes were carved into hard gneiss during the final years of World War II.'
  ),
  'The Giant': figureHtml(
    images.tunnel,
    'Interior of the Osówka tunnel complex, part of Project Riese',
    'Inside the Osówka complex — one of seven underground sites built under Project Riese. The tunnels stretch for kilometres through the mountains, their full extent still unknown.'
  ),
  'The Castle': figureHtml(
    images.autumn,
    'Książ Castle in autumn, surrounded by forest',
    'Książ Castle, the third-largest castle in Poland, seized by the Nazis in 1941. Beneath it, a two-kilometre tunnel network was excavated as part of a projected Führerhauptquartier.'
  ),
  'The Slaves': figureHtml(
    images.grossRosen,
    'Entrance gate of the Gross-Rosen concentration camp',
    'The main gate of Gross-Rosen concentration camp. Approximately 13,000 prisoners from Gross-Rosen and Auschwitz were deployed to dig the Project Riese tunnels. An estimated 5,000 died.'
  ),
  'The Legend Keepers': figureHtml(
    images.landscape,
    'View of the Góry Sowie mountains',
    'The Owl Mountains as seen from Niedźwiedzica. For decades after the war, treasure hunters searched these forests for the legendary gold train — all without success.'
  ),
  'The Deathbed Map': figureHtml(
    images.corridor,
    'Underground corridor in the Osówka complex, described as part of Hitler\'s underground city',
    'A tunnel corridor in the Osówka complex. Koper and Richter claimed that a similar passage, sealed since 1945, held an armored train laden with three hundred tonnes of gold.'
  ),
  'Gold Fever': figureHtml(
    images.marker,
    'Golden Train monument in Wałbrzych, Poland',
    'A golden train marker in Wałbrzych — testament to the legend\'s grip on the city. Tourism surged 45% after the 2015 announcement, delivering an estimated $200 million in free publicity.'
  ),
  'The Dig': figureHtml(
    images.tunnel2,
    'Another view inside the Osówka tunnel complex',
    'The Osówka tunnels today. After seven days of excavation in August 2016, the team found rocks, old railway track, and a horseshoe — but no train, no tunnel, and no gold.'
  ),
  'Still Searching': figureHtml(
    images.interior,
    'Interior of Książ Castle',
    'Inside Książ Castle, now restored as a museum and tourist attraction. The gold train legend transformed Wałbrzych from a forgotten coal town into a destination for mystery seekers.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/nazi-gold-train.ts');
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
  <p class="epigraph">"Whether the explorers find anything or not, that gold train has already arrived."</p>
  <p class="epigraph-attr">— Wałbrzych tourism official, 2015</p>
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
      <p><strong>Autumn 1943</strong> — Hitler authorises Project Riese, a massive underground construction project in the Owl Mountains of Lower Silesia. Albert Speer and Organisation Todt begin planning seven tunnel complexes beneath the mountains and Książ Castle.</p>
      <p><strong>November 1943</strong> — Construction begins using forced labourers from Poland, Russia, and Czechoslovakia, plus POWs from Italy and the Soviet Union. A typhus epidemic strikes in December, killing hundreds.</p>
      <p><strong>April 1944</strong> — Organisation Todt takes over from the civilian consortium. Concentration camp prisoners from Gross-Rosen and Auschwitz are deployed, creating Arbeitslager Riese — a network of thirteen subcamps. The workforce peaks at 30,788 in July.</p>
      <p><strong>Spring 1945</strong> — According to legend, an armored train laden with 300+ tonnes of gold departs besieged Breslau heading southwest. It reaches Świebodzice but never arrives at Wałbrzych — vanishing into the mountains. The SS destroys tunnel entrances before retreating.</p>
      <p><strong>1945–1989</strong> — Lower Silesia is transferred to Poland. The Polish Armed Forces conduct multiple Cold War–era searches for the train. All are fruitless.</p>
      <p><strong>1950s–1970s</strong> — Retired miner Tadeusz Słowikowski hears about the train from German colleagues. He dedicates his life to the search, building a scale model in his basement.</p>
      <p><strong>1995–1996</strong> — Wałbrzych's coal mines close. 14,000 workers lose their jobs. Unemployment reaches 38–40%.</p>
      <p><strong>August 28, 2015</strong> — Deputy Culture Minister Piotr Żuchowski holds a press conference declaring he is "99 percent convinced" a buried train has been found near the 65th kilometre of the Wrocław–Wałbrzych railway line.</p>
      <p><strong>September 4, 2015</strong> — Treasure hunters Piotr Koper and Andreas Richter go public, claiming ground-penetrating radar images show a 100-metre object at 8–9 metres depth. Global media frenzy erupts. Tourism to Wałbrzych surges 45%.</p>
      <p><strong>December 15, 2015</strong> — Geologist Janusz Madej and the AGH University team announce: no evidence of a train. "It's human to make a mistake, but it's foolish to stand by it."</p>
      <p><strong>August 15, 2016</strong> — A 64-person excavation team begins digging. After 7 days and €116,000, they find rocks, old track, and a horseshoe. The radar anomalies are natural ice formations. No train.</p>
      <p><strong>August 2018</strong> — Andreas Richter leaves the search team.</p>
      <p><strong>January 2019</strong> — Piotr Koper discovers genuine 16th-century wall paintings hidden behind plaster in a palace near Wrocław — actual buried treasure, just not the kind he was looking for.</p>
      <p><strong>April 2025</strong> — An anonymous group calling itself "Gold Train 2025" claims three WWII freight wagons are hidden in the Świdnica Forest District. Their reliance on dowsing is criticised as unscientific. The search continues.</p>
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
      <p>Heritage Daily — "What happened to the Nazi gold train?" (2024)</p>
      <p>ExplorerWeb — "Exploration Mysteries: The Nazi Gold Train"</p>
      <p>Gross-Rosen Memorial — "History of AL Riese"</p>
      <p>Smithsonian Magazine — "Legendary Nazi Gold Train Is a Total Bust"</p>
      <p>Christian Science Monitor — "Legend realized? Discovery of lost Nazi gold train invigorates Polish town" (2015)</p>
      <p>Notes from Poland — "Search for legendary Nazi gold train set to resume in Poland" (2025)</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-ksiaz-castle-trees.jpg'),
        title: 'The Nazi\nGold Train',
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
