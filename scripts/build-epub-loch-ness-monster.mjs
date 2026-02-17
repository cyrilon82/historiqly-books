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
  title: 'The Loch Ness Monster',
  subtitle: 'The Hunt for Scotland\'s Impossible Creature',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained',
  slug: 'loch-ness-monster',
  description:
    'In 1934, a photograph of a long-necked creature in a Scottish lake became the most famous image in cryptozoology. It took sixty years to prove it was a toy submarine. This is the full story — of hoaxers, believers, scientists, and the myth that refused to die.',
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
  surgeons: imgFileUrl('evidence-surgeons-photograph-1934.jpg'),
  urquhart: imgFileUrl('location-urquhart-castle-loch-ness.jpg'),
  urquhartRuins: imgFileUrl('atmosphere-urquhart-castle-ruins.jpg'),
  plesiosaur: imgFileUrl('atmosphere-duria-antiquior-plesiosaur-1830.jpg'),
  grant: imgFileUrl('evidence-arthur-grant-sketch-1934.png'),
  columba: imgFileUrl('figure-saint-columba.jpg'),
  kelpie: imgFileUrl('atmosphere-kelpie-water-horse.jpg'),
  fortAugustus: imgFileUrl('location-fort-augustus-canal.jpg'),
  skeleton: imgFileUrl('evidence-plesiosaur-skeleton-1824.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Road': figureHtml(
    images.fortAugustus,
    'The Caledonian Canal at Fort Augustus, leading to Loch Ness',
    'The Caledonian Canal at Fort Augustus, where the waterway enters Loch Ness. The canal, opened in 1822, brought the first regular boat traffic to the loch — but it was the A82 road in 1933 that brought the eyes that would create the monster.'
  ),
  'The Water Beast': figureHtml(
    images.columba,
    'Saint Columba confronts the water beast at the River Ness, 1906 illustration',
    'Saint Columba commands the water beast to retreat, from a 1906 illustration. The account, written by his biographer Adomnan around 700 AD, is the earliest written record of a creature in the waters of Loch Ness — though it served as a miracle story, not a naturalist\'s report.'
  ),
  'The Monster Hunter': figureHtml(
    images.kelpie,
    'The Water Horse — Theodor Kittelsen painting of a Nøkken as a white horse',
    'The water spirit as a white horse, by Norwegian artist Theodor Kittelsen. Scottish folklore was saturated with stories of the each-uisge — the water horse that lured travellers to their deaths. These ancient myths provided the cultural framework for the modern monster.'
  ),
  'The Photograph': figureHtml(
    images.surgeons,
    'The Surgeon\'s Photograph, 1934 — the most famous image of the Loch Ness Monster',
    'The "Surgeon\'s Photograph," published by the Daily Mail on 21 April 1934 and attributed to Dr. Robert Kenneth Wilson. For sixty years, this image defined the Loch Ness Monster in the public imagination. It was a toy submarine with a sculpted head of plastic wood, approximately twelve inches tall.'
  ),
  'The Searchers': figureHtml(
    images.plesiosaur,
    'Duria Antiquior — the first pictorial reconstruction of prehistoric life, showing plesiosaurs',
    'Henry De la Beche\'s <em>Duria Antiquior</em> (1830), the first artistic reconstruction of prehistoric marine life, showing plesiosaurs, ichthyosaurs, and pterosaurs. The plesiosaur\'s long neck and small head became the template for the Loch Ness Monster — an image that persisted despite the fact that plesiosaurs went extinct 66 million years ago.'
  ),
  'The Underwater Eye': figureHtml(
    images.skeleton,
    'Plesiosaurus dolichodeirus — scientific illustration of the skeleton, 1824',
    'William Conybeare\'s 1824 skeletal reconstruction of <em>Plesiosaurus dolichodeirus</em>. Robert Rines\'s underwater photographs briefly convinced some that a living plesiosaur inhabited Loch Ness — until the "flipper" turned out to be painted and the "gargoyle head" turned out to be a tree stump.'
  ),
  'Deepscan': figureHtml(
    images.urquhart,
    'Urquhart Castle on the shore of Loch Ness',
    'Urquhart Castle, on a promontory above Urquhart Bay — the single most frequent location for reported sightings. Adrian Shine\'s Operation Deepscan detected three anomalous sonar contacts near here in 1987, but concluded they were most likely seals, debris, or thermal effects.'
  ),
  'The Confession': figureHtml(
    images.grant,
    'Arthur Grant\'s sketch of a creature crossing the road near Loch Ness, 1934',
    'Arthur Grant\'s sketch of a creature he claimed to have seen crossing the road near Loch Ness in January 1934. The plesiosaur-like shape he drew was already embedded in the public imagination — a template created by the Surgeon\'s Photograph and reinforced by every subsequent sighting.'
  ),
  'The Verdict': figureHtml(
    images.urquhartRuins,
    'Urquhart Castle ruins above Loch Ness',
    'Urquhart Castle above the dark waters of Loch Ness. Half a million visitors come to the loch each year, contributing approximately £41 million to the Scottish economy. The monster may not be real, but its economic impact certainly is.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/loch-ness-monster.ts');
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
  <p class="epigraph">"There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy."</p>
  <p class="epigraph-attr">— William Shakespeare, <em>Hamlet</em></p>
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
      <p><strong>c. 565 AD</strong> — Saint Columba encounters a "water beast" in the River Ness, as recorded in Adomnan's <em>Vita Columbae</em>. The creature retreats at Columba's command. This is the earliest written account of a large creature in the Loch Ness vicinity.</p>
      <p><strong>1822</strong> — The Caledonian Canal opens, connecting the Scottish east coast with the west coast through the Great Glen and Loch Ness, increasing boat traffic on the loch.</p>
      <p><strong>January 1933</strong> — Construction of the A82 road along the northern shore of Loch Ness is completed, providing the first clear views of the water for motorists.</p>
      <p><strong>April 14, 1933</strong> — Aldie and John Mackay spot a violent disturbance in the water while driving the new road. Water bailiff Alex Campbell publishes the sighting in the <em>Inverness Courier</em> on May 2, using the word "monster" for the first time.</p>
      <p><strong>July 22, 1933</strong> — George and Margaret Spicer report seeing a 25-foot creature with a long neck cross the road near the loch.</p>
      <p><strong>November 12, 1933</strong> — Hugh Gray takes the first photograph of the alleged creature near Foyers. Published December 6 in the <em>Scottish Daily Record</em>.</p>
      <p><strong>December 1933</strong> — The <em>Daily Mail</em> sends big-game hunter Marmaduke Wetherell to find the monster. He announces the discovery of large footprints on the shore.</p>
      <p><strong>January 1934</strong> — The Natural History Museum determines Wetherell's footprints were made with a dried hippopotamus foot. Wetherell is publicly humiliated.</p>
      <p><strong>April 21, 1934</strong> — The <em>Daily Mail</em> publishes the "Surgeon's Photograph," attributed to Dr. Robert Kenneth Wilson. It becomes the most iconic image of the Loch Ness Monster.</p>
      <p><strong>1957</strong> — Constance Whyte publishes <em>More Than a Legend</em>, reviving serious interest in the phenomenon.</p>
      <p><strong>April 23, 1960</strong> — Tim Dinsdale films a moving object on the loch from above Foyers. JARIC later judges the object "probably animate."</p>
      <p><strong>1962</strong> — The Loch Ness Phenomena Investigation Bureau is founded by David James MP, Sir Peter Scott, and others.</p>
      <p><strong>August 8, 1972</strong> — Robert Rines obtains underwater photographs in Urquhart Bay that appear to show a diamond-shaped flipper. Later revealed to have been retouched.</p>
      <p><strong>June 20, 1975</strong> — Rines obtains photographs appearing to show a "gargoyle head" and plesiosaur-like body. Sir Peter Scott proposes the Latin name <em>Nessiteras rhombopteryx</em>.</p>
      <p><strong>1984</strong> — <em>Discover</em> and the <em>Skeptical Inquirer</em> reveal that Rines's flipper photographs were retouched.</p>
      <p><strong>October 1987</strong> — Adrian Shine leads Operation Deepscan. Twenty-four boats sweep the loch with sonar. Three anomalous contacts are detected but remain unexplained.</p>
      <p><strong>1987</strong> — The "gargoyle head" from Rines's photographs is identified as a rotting tree stump.</p>
      <p><strong>June 1991</strong> — Steve Feltham begins his continuous vigil at Dores Beach, eventually setting a Guinness World Record.</p>
      <p><strong>November 1993</strong> — Christian Spurling confesses to researchers David Martin and Alastair Boyd that the Surgeon's Photograph was a hoax — a toy submarine with a sculpted head, orchestrated by his stepfather-in-law Marmaduke Wetherell as revenge against the <em>Daily Mail</em>.</p>
      <p><strong>2003</strong> — A BBC-sponsored sonar survey using 600 beams finds no trace of a large creature.</p>
      <p><strong>September 2019</strong> — Professor Neil Gemmell publishes the results of an eDNA study: no plesiosaur, shark, catfish, or sturgeon DNA found, but significant quantities of European eel DNA at every sampling location.</p>
      <p><strong>August 2023</strong> — The Quest Weekend, the largest organized search since 1972, uses drones, hydrophones, and sonar. No conclusive evidence is found.</p>
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
      <p>Bauer, Henry H. — <em>The Enigma of Loch Ness: Making Sense of a Mystery</em>, University of Illinois Press, 1986</p>
      <p>Binns, Ronald — <em>The Loch Ness Mystery Solved</em>, Open Books, 1983</p>
      <p>Loxton, Daniel and Prothero, Donald R. — <em>Abominable Science!: Origins of the Yeti, Nessie, and Other Famous Cryptids</em>, Columbia University Press, 2013</p>
      <p>Shine, Adrian — "The Biology of Loch Ness," <em>New Scientist</em>, 1993</p>
      <p>Gemmell, Neil et al. — "Environmental DNA Metabarcoding of Loch Ness," 2019</p>
      <p>Museum of Hoaxes — "The Surgeon's Photo," hoaxes.org</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-loch-ness-panorama.jpg'),
        title: 'The Loch Ness\nMonster',
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
