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
  title: 'Atlantis',
  subtitle: 'Deconstructing Plato\'s Original Myth',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'atlantis',
  description:
    'Everyone knows the story of Atlantis — the island paradise that sank beneath the waves. Almost nobody has read the original. What Plato actually wrote is stranger, more political, and more deliberately fictional than the legend suggests. This is the real story of history\'s most famous lost civilization.',
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
  kircher: imgFileUrl('hero-kircher-atlantis-map-1665.jpg'),
  timaeus: imgFileUrl('evidence-timaeus-manuscript-medieval.jpg'),
  solon: imgFileUrl('figure-solon-lawgiver-athens.jpg'),
  plato: imgFileUrl('figure-plato-bust-capitoline.jpg'),
  orichalcum: imgFileUrl('evidence-orichalcum-sestertius-nero.jpg'),
  santorini: imgFileUrl('atmosphere-santorini-caldera.jpg'),
  santoriniSat: imgFileUrl('evidence-santorini-satellite-landsat.jpg'),
  minoanFleet: imgFileUrl('evidence-minoan-fleet-fresco-akrotiri.jpg'),
  donnelly: imgFileUrl('figure-ignatius-donnelly.jpg'),
  donnellyMap: imgFileUrl('evidence-donnelly-atlantis-map-p037.jpg'),
  richat: imgFileUrl('evidence-richat-structure-satellite.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'O Solon, Solon': figureHtml(
    images.solon,
    'Statue of Solon, the Athenian lawgiver',
    'Solon, the great Athenian lawgiver (c. 630–560 BCE). Plato attributed the Atlantis story to Solon\'s visit to Egyptian priests at Sais — a chain of transmission four steps removed from the supposed source, a classic Greek literary technique for lending authority to fiction.'
  ),
  'The Island Beyond the Pillars': figureHtml(
    images.orichalcum,
    'Roman sestertius coin — orichalcum alloy',
    'A Roman sestertius minted in orichalcum, a copper-zinc alloy. Plato described the walls of Atlantis\'s central citadel as lined with orichalcum that "flashed with red light." The word appears nowhere else in Greek literature with this meaning — another detail placed just beyond the reach of verification.'
  ),
  'The War and the Fall': figureHtml(
    images.timaeus,
    'Medieval manuscript of Plato\'s Timaeus',
    'A medieval manuscript of the <em>Timaeus</em> — the dialogue where the Atlantis story first appears. The <em>Critias</em>, which contains the detailed description of the island, breaks off mid-sentence in the middle of Zeus\'s speech. The ending was either never written or has been lost.'
  ),
  'What Was Plato Actually Doing?': figureHtml(
    images.plato,
    'Marble bust of Plato, Capitoline Museum, Rome',
    'Plato (c. 428–348 BCE). Aristotle, his student of twenty years, dismissed the Atlantis story as fiction: "The man who dreamed it up also made it disappear." The scholarly consensus today is nearly unanimous — Atlantis is a philosophical invention, not a geographical report.'
  ),
  'The Ghost of Helike': figureHtml(
    images.santoriniSat,
    'Satellite image of Santorini caldera, Landsat',
    'The caldera of Santorini, seen from Landsat satellite imagery. The Thera eruption of c. 1600 BCE was one of the largest in the Holocene. The Thera-Atlantis theory is seductive — but requires changing the date, location, size, and civilisation Plato described.'
  ),
  'The First True Believers': figureHtml(
    images.kircher,
    'Athanasius Kircher\'s map of Atlantis, 1665',
    'Kircher\'s 1665 map of Atlantis from <em>Mundus Subterraneus</em>, oriented with south at top. He had no evidence for the island\'s location — he simply read Plato\'s description and drew it. This image has been reproduced more than any other in the history of Atlantis studies.'
  ),
  'Donnelly\'s Dream': figureHtml(
    images.donnellyMap,
    'Map from Donnelly\'s Atlantis: The Antediluvian World, 1882',
    'A map from Ignatius Donnelly\'s <em>Atlantis: The Antediluvian World</em> (1882), showing his hypothetical island in the mid-Atlantic. The book became one of the bestselling non-fiction titles of the nineteenth century and launched the modern Atlantis obsession.'
  ),
  'The Volcano and the Verdict': figureHtml(
    images.richat,
    'The Richat Structure in the Sahara Desert, satellite view',
    'The Richat Structure in Mauritania — the "Eye of the Sahara." Its concentric rings have made it a popular Atlantis candidate on social media. But the formation is 100 million years old, has never been underwater in human history, and contains no artefacts of any kind.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/atlantis.ts');
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
  <p class="epigraph">"O Solon, Solon, you Greeks are always children. There is no such thing as an old Greek."</p>
  <p class="epigraph-attr">— Egyptian priest to Solon, as told by Plato, <em>Timaeus</em>, c. 360 BCE</p>
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
      <p><strong>c. 9600 BCE</strong> — The date Plato gives for the war between Atlantis and Athens, placing the events deep in the Mesolithic period — thousands of years before the earliest known civilizations.</p>
      <p><strong>c. 1600 BCE</strong> — The eruption of Thera (modern Santorini) destroys the Minoan settlement at Akrotiri and devastates Crete. Later proposed as a possible inspiration for the Atlantis story.</p>
      <p><strong>c. 600 BCE</strong> — Solon visits Egypt, according to Greek tradition. Plato attributes the Atlantis story to Solon's conversations with Egyptian priests at Sais.</p>
      <p><strong>c. 380 BCE</strong> — Plato writes the <em>Republic</em>, describing the ideal city governed by philosopher-kings. The Atlantis dialogues will serve as a dramatic sequel.</p>
      <p><strong>373 BCE</strong> — The Greek city of Helike is destroyed by earthquake and tsunami, sinking into the Gulf of Corinth in a single night. Plato was approximately fifty years old.</p>
      <p><strong>c. 360 BCE</strong> — Plato writes the <em>Timaeus</em> and <em>Critias</em>, introducing the Atlantis story. The <em>Critias</em> breaks off mid-sentence.</p>
      <p><strong>c. 330 BCE</strong> — Aristotle dismisses Atlantis as fiction: "The man who dreamed it up also made it disappear."</p>
      <p><strong>1553</strong> — Francisco López de Gómara suggests the Americas are the remains of Atlantis.</p>
      <p><strong>1627</strong> — Francis Bacon publishes <em>The New Atlantis</em>, a utopian fiction.</p>
      <p><strong>1665</strong> — Athanasius Kircher publishes a map of Atlantis in <em>Mundus Subterraneus</em>, placing it in the mid-Atlantic. The image becomes iconic.</p>
      <p><strong>1882</strong> — Ignatius Donnelly publishes <em>Atlantis: The Antediluvian World</em>, arguing the island was the origin of all civilization. It becomes a massive bestseller.</p>
      <p><strong>1888</strong> — Helena Blavatsky incorporates Atlantis into Theosophical doctrine as the homeland of the "Fourth Root Race."</p>
      <p><strong>1909</strong> — K.T. Frost proposes the Minoan-Atlantis connection.</p>
      <p><strong>1967</strong> — Spyridon Marinatos begins excavation of Akrotiri on Santorini, uncovering a preserved Bronze Age city.</p>
      <p><strong>1968</strong> — The Bimini Road is discovered in the Bahamas, claimed by Edgar Cayce followers as Atlantean. Geologists identify it as natural beach rock.</p>
      <p><strong>2001</strong> — Archaeologists locate ancient Helike beneath a coastal lagoon in the Gulf of Corinth.</p>
      <p><strong>2011</strong> — A team claims to have found Atlantis in the mud flats of southern Spain. The claim is not accepted by mainstream scholars.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a narrative non-fiction account examining Plato's original texts, the philosophical context in which they were written, and the long history of attempts to locate a real Atlantis. The analysis draws on primary classical sources and modern scholarship.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Plato — <em>Timaeus</em> and <em>Critias</em>, trans. Robin Waterfield, Oxford World's Classics, 2008</p>
      <p>Gill, Christopher — "The Genre of the Atlantis Story," <em>Classical Philology</em>, 1977</p>
      <p>Vidal-Naquet, Pierre — <em>The Atlantis Story: A Short History of Plato's Myth</em>, University of Exeter Press, 2007</p>
      <p>Donnelly, Ignatius — <em>Atlantis: The Antediluvian World</em>, Harper & Brothers, 1882</p>
      <p>Castleden, Rodney — <em>Atlantis Destroyed</em>, Routledge, 1998</p>
      <p>Nesselrath, Heinz-Günther — "Where the Lord of the Sea Grants Passage to Sailors through the Deep-Blue Mere No More: The Greeks and the Western Seas," <em>Greece & Rome</em>, 2005</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-kircher-atlantis-map-1665.jpg'),
        title: 'Atlantis',
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

    // Post-process
    console.log('\nPost-processing...');
    await polishEpub(outPath, outPath);

    console.log('\nDone!');
  } catch (err) {
    console.error('Failed to generate EPUB:', err);
    process.exit(1);
  }
}

build();
