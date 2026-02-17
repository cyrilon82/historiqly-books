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
  title: 'Göbekli Tepe',
  subtitle: 'The Temple Built Before Agriculture',
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'gobekli-tepe',
  description:
    'Eleven thousand years ago, hunter-gatherers who had no farms, no pottery, and no metal tools carved fifty-ton pillars from the bedrock and raised them in vast stone circles on a hilltop in southeastern Turkey. Then, after two thousand years of use, they buried the entire complex under tons of rubble and walked away. This is the story of the oldest temple on Earth, the archaeologist who found it, and the question it forces us to ask: what came first — the city or the shrine?',
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
  panorama: imgFileUrl('hero-gobekli-tepe-panorama.jpg'),
  enclosureD: imgFileUrl('hero-gobekli-tepe-enclosure-d.jpg'),
  vultureStone: imgFileUrl('evidence-gobekli-tepe-vulture-stone-detail.jpg'),
  tPillar: imgFileUrl('evidence-gobekli-tepe-t-pillar-animal-relief.jpg'),
  centralPillar: imgFileUrl('evidence-gobekli-tepe-enclosure-d-central-pillar.jpg'),
  animalRelief: imgFileUrl('evidence-gobekli-tepe-animal-hunting-relief.jpg'),
  pillarArmFox: imgFileUrl('evidence-gobekli-tepe-pillar-arm-fox.jpg'),
  excavation: imgFileUrl('evidence-gobekli-tepe-main-excavation-area.png'),
  landscape: imgFileUrl('atmosphere-gobekli-tepe-surrounding-landscape.jpg'),
  harranPlain: imgFileUrl('atmosphere-gobekli-tepe-harran-plain-view.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Hill That Should Not Exist': figureHtml(
    images.landscape,
    'The landscape surrounding Göbekli Tepe in southeastern Turkey',
    'The arid steppe of southeastern Anatolia. Göbekli Tepe rises from this landscape like a blister — fifteen metres high, three hundred metres across, with a flattened summit that looks almost artificial.'
  ),
  'The Man Who Knew the Pillars': figureHtml(
    images.tPillar,
    'T-shaped pillar at Göbekli Tepe with animal relief carvings',
    'A T-shaped pillar at Göbekli Tepe, carved with animal reliefs. Klaus Schmidt recognised these stones instantly — he had spent years excavating similar pillars at Nevalı Çori before that site was flooded by the Atatürk Dam.'
  ),
  'The Circles in the Ground': figureHtml(
    images.vultureStone,
    'Pillar 43 — The Vulture Stone at Göbekli Tepe',
    'Pillar 43, the Vulture Stone — the most densely carved pillar at the site. A vulture clutches a round object, a scorpion rears below, and a headless human figure stands in crude profile. Eleven thousand years old, and still unreadable.'
  ),
  'Before Everything': figureHtml(
    images.harranPlain,
    'View from Göbekli Tepe across the Harran plain',
    'The view from near Göbekli Tepe across the Harran plain. Thirty kilometres away stands Karacadağ, the mountain where the earliest domesticated wheat has been genetically traced. The oldest temple and the oldest farm, side by side.'
  ),
  'The Feast and the Work': figureHtml(
    images.animalRelief,
    'Animal relief carving at Göbekli Tepe showing a predator',
    'A predator carved in dynamic relief on a pillar at Göbekli Tepe. The animals depicted are overwhelmingly dangerous — lions, scorpions, snakes, vultures — not the gazelle and aurochs the builders actually ate.'
  ),
  'The Cult of Skulls': figureHtml(
    images.centralPillar,
    'Central T-shaped pillar of Enclosure D with anthropomorphic features',
    'A central pillar of Enclosure D, standing 5.5 metres tall. Arms carved in low relief run down the sides. Hands reach toward the belly. The T-shaped cap is a stylised head — the pillar is a person, or a god, or an ancestor.'
  ),
  'The Burial': figureHtml(
    images.enclosureD,
    'Enclosure D at Göbekli Tepe — the oldest excavated enclosure',
    'Enclosure D, the oldest and largest excavated enclosure, dating to approximately 9530 BCE. After sixteen hundred years of use, the builders filled it with tons of earth and rubble, preserving the carvings in extraordinary condition.'
  ),
  'What We Do Not Know': figureHtml(
    images.pillarArmFox,
    'Pillar at Göbekli Tepe showing carved arm and fox relief',
    'A pillar showing a human arm and a fox carved in low relief. Ninety-five per cent of Göbekli Tepe remains unexcavated. Two hundred pillars are still in the ground, bearing messages that no one alive can read.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/gobekli-tepe.ts');
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
  <p class="epigraph">"First came the temple, then the city."</p>
  <p class="epigraph-attr">— Klaus Schmidt, 1953–2014</p>
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
      <p><strong>c. 9600 BCE</strong> — Construction begins on the earliest enclosures at Göbekli Tepe, including Enclosure D, the oldest and largest. T-shaped pillars weighing up to 20 tons are quarried, carved with animal reliefs, and erected in circular formations by hunter-gatherers.</p>
      <p><strong>c. 9000 BCE</strong> — The first domesticated einkorn wheat appears at Karacadağ, a mountain 30 km from Göbekli Tepe — the earliest known evidence of agriculture.</p>
      <p><strong>c. 8200–8000 BCE</strong> — The enclosures are deliberately filled with earth, stone, animal bones, and thousands of discarded flint tools. The site is sealed and abandoned. Smaller, less elaborate buildings (Layer II) are constructed on top before they, too, are buried.</p>
      <p><strong>1963</strong> — A joint Istanbul–Chicago archaeological survey identifies the site. Peter Benedict notes the massive flint scatter but mistakes the protruding pillar tops for Islamic gravestones. The site is catalogued as a "small cemetery."</p>
      <p><strong>1991</strong> — The Atatürk Dam floods Nevalı Çori, a similar Neolithic site with T-shaped pillars. Its excavator, Klaus Schmidt, loses years of work — but the loss drives him to search for comparable sites.</p>
      <p><strong>October 1994</strong> — Schmidt visits Göbekli Tepe, re-examines Benedict's survey notes, and immediately recognises the limestone slabs as T-shaped pillars. He commits to excavating the site.</p>
      <p><strong>1995</strong> — Formal excavations begin under the Şanlıurfa Museum and the German Archaeological Institute. The first monumental enclosures are unearthed.</p>
      <p><strong>2003</strong> — Geophysical surveys reveal at least 20 enclosures still buried beneath the mound, containing an estimated 200+ additional pillars.</p>
      <p><strong>20 July 2014</strong> — Klaus Schmidt dies of a heart attack while swimming, aged 60. He had led excavations for 20 years and uncovered roughly 5% of the site.</p>
      <p><strong>2017</strong> — Julia Gresky's team publishes evidence of a "skull cult" — three human skulls with deep incisions, drilled holes, and red ochre, suggesting ritual display.</p>
      <p><strong>1 July 2018</strong> — UNESCO designates Göbekli Tepe a World Heritage Site: "one of the first manifestations of human-made monumental architecture."</p>
      <p><strong>2019–present</strong> — Prof. Necmi Karul leads ongoing excavations. The broader Taş Tepeler Project now involves 36 institutions and 220 researchers. Sister sites including Karahan Tepe, Sayburç, and others continue to yield discoveries.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events and archaeological research. The chronology, key figures, and factual framework are grounded in published scholarship and primary sources; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Schmidt, Klaus — <em>Göbekli Tepe: A Stone Age Sanctuary in South-Eastern Anatolia</em>, ex oriente, 2012</p>
      <p>Dietrich, Oliver et al. — "The Role of Cult and Feasting in the Emergence of Neolithic Communities," <em>Antiquity</em>, 2012</p>
      <p>Gresky, Julia et al. — "Modified human crania from Göbekli Tepe provide evidence for skull cult in the Pre-Pottery Neolithic," <em>Science Advances</em>, 2017</p>
      <p>Clare, Lee — "Inspired individuals and charismatic leaders," <em>Documenta Praehistorica</em>, 2024</p>
      <p>Tepe Telegrams — German Archaeological Institute research blog: dainst.blog/the-tepe-telegrams</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-gobekli-tepe-panorama.jpg'),
        title: 'Göbekli\nTepe',
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
    const outDir = resolve(ROOT, 'public/epub');
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
