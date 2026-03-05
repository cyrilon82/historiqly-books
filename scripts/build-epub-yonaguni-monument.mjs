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
  title: 'The Yonaguni Monument',
  subtitle: "Japan's Underwater Enigma",
  author: 'HistorIQly',
  series: 'Vol. 9: Lost Worlds',
  slug: 'yonaguni-monument',
  description:
    "Off the southern coast of Japan's westernmost island lies an enormous stepped structure beneath the waves — a formation so geometrically precise that it has divided scientists for decades. Discovered by a shark-hunting diver in 1986, the Yonaguni Monument has been called everything from a lost city older than the pyramids to a striking example of natural geology.",
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
  hero: imgFileUrl('hero-yonaguni-monument.jpg'),
  terraces: imgFileUrl('yonaguni-terraces.jpg'),
  island: imgFileUrl('yonaguni-island.jpg'),
  turtle: imgFileUrl('yonaguni-turtle.jpg'),
  arch: imgFileUrl('yonaguni-underwater-arch.jpg'),
  trench: imgFileUrl('yonaguni-underwater-trench.jpg'),
  megaliths: imgFileUrl('yonaguni-underwater-megaliths.jpg'),
  road: imgFileUrl('yonaguni-underwater-road.jpg'),
  diver: imgFileUrl('yonaguni-underwater-diver.jpg'),
  divers: imgFileUrl('yonaguni-underwater-divers.jpg'),
  ruins: imgFileUrl('yonaguni-underwater-ruins.jpg'),
  aboveWater: imgFileUrl('yonaguni-above-water.jpg'),
  terraceStair: imgFileUrl('yonaguni-terrace-stair.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Shark Diver': figureHtml(
    images.ruins,
    'Diver exploring the Yonaguni Monument',
    'A diver explores the stepped terraces of the Yonaguni Monument — the underwater formation discovered by Kihachiro Aratake in 1986.'
  ),
  'The Island at the Edge': figureHtml(
    images.aboveWater,
    'Yonaguni Island above-water rock formations',
    'Rock formations along the coast of Yonaguni Island — the same Yaeyama Group sandstone that makes up the underwater monument, shaped by identical geological processes.'
  ),
  'The Monument': figureHtml(
    images.terraces,
    'The stepped terraces of the Yonaguni Monument',
    'The monument\'s broad, flat terraces descend from top to base like a colossal staircase — the feature that has fuelled decades of debate about natural versus artificial origins.'
  ),
  'The Professor': figureHtml(
    images.turtle,
    'The turtle-shaped formation at the Yonaguni Monument',
    'The "Turtle" — a low, star-shaped platform near the main monument. Masaaki Kimura identified numerous such features as evidence of human construction.'
  ),
  'The Sceptic': figureHtml(
    images.terraceStair,
    'Stairway feature at the Yonaguni Monument',
    'A stairway feature on the monument. Robert Schoch examined these formations and concluded they were consistent with natural erosion of jointed sandstone.'
  ),
  'The Nature of Stone': figureHtml(
    images.trench,
    'Water trench near the Yonaguni Monument',
    'A water channel near the monument — one of the straight-sided grooves that could be natural erosion features or, as some argue, evidence of human modification.'
  ),
  'When the Sea Was Land': figureHtml(
    images.megaliths,
    'The Twin Megaliths at Yonaguni',
    'The Twin Megaliths — two massive rectangular stones standing side by side near the main monument. Their resemblance to standing stones found at megalithic sites worldwide has fuelled speculation.'
  ),
  'The Populariser': figureHtml(
    images.arch,
    'Underwater arch near the Yonaguni Monument',
    'An arch or gateway formation near the monument — one of the features that made the site irresistible to documentary filmmakers and alternative history writers.'
  ),
  'The Evidence': figureHtml(
    images.diver,
    'Diver next to the Yonaguni Monument for scale',
    'A diver provides scale beside one of the monument\'s formations. After decades of investigation, no unambiguous human artefact has been found at the site.'
  ),
  "Japan's Atlantis": figureHtml(
    images.divers,
    'Divers exploring the Yonaguni Monument megaliths',
    'Divers explore the monument\'s megaliths. Whatever its origins — temple or geology, ruin or rock — the Yonaguni Monument remains one of the most spectacular dive sites on Earth.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/yonaguni-monument.ts');
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
  <p class="epigraph">"Looking down at the ruins that resembled the monuments of Machu Picchu, I was stupefied."</p>
  <p class="epigraph-attr">— Kihachiro Aratake, discoverer of the Yonaguni Monument, 1986</p>
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
      <p><strong>~20,000,000 BCE</strong> — Yaeyama Group sandstones deposited in shallow-marine environments during the Early Miocene, forming the rock that will become the Yonaguni Monument.</p>
      <p><strong>~20,000 BCE</strong> — Last Glacial Maximum. Sea levels drop 125+ metres below present. The entire Yonaguni Monument is above water — a rocky outcrop on a hillside. The island is significantly larger than today.</p>
      <p><strong>~18,000 BCE</strong> — Minatogawa Man: anatomically modern humans inhabit Okinawa, 500 km northeast of Yonaguni. Evidence of maritime capability at a surprisingly early date.</p>
      <p><strong>~10,000–8,000 BCE</strong> — Post-glacial sea level rise progressively submerges the monument. By roughly 8,000 BCE, the entire formation is underwater.</p>
      <p><strong>1986</strong> — Kihachiro Aratake, a dive operator scouting for hammerhead sharks, discovers the monument off Yonaguni's southern coast at a depth of 5–25 metres.</p>
      <p><strong>1992</strong> — Professor Masaaki Kimura of the University of the Ryukyus makes his first dives at the site. He becomes convinced the monument is at least partly man-made.</p>
      <p><strong>1997 (March)</strong> — Graham Hancock dives the monument for the first time, later featuring it in his television series <em>Quest for the Lost Civilization</em>.</p>
      <p><strong>1997 (September)</strong> — Robert Schoch, geologist from Boston University, examines the monument during an expedition financed by Yasuo Watanabe. He concludes it is most likely a natural formation.</p>
      <p><strong>1998</strong> — Schoch returns for a second investigation as part of the Team Atlantis project. He confirms his natural formation assessment but leaves open the possibility of minor human modification.</p>
      <p><strong>1998</strong> — Hancock's <em>Quest for the Lost Civilization</em> television series airs, bringing the monument to a global audience of millions.</p>
      <p><strong>1999</strong> — German geologist Wolf Wichmann studies the monument during a Spiegel TV investigation. After three dives he declares he "didn't find anything that was man-made."</p>
      <p><strong>2002</strong> — Hancock publishes <em>Underworld: The Mysterious Origins of Civilization</em>, devoting extensive sections to Yonaguni. Accompanying TV series <em>Flooded Kingdoms of the Ice Age</em> airs worldwide.</p>
      <p><strong>2002</strong> — Kimura retires from the University of the Ryukyus but continues to advocate for human construction.</p>
      <p><strong>2007</strong> — Kimura revises his dating at the 21st Pacific Science Congress, proposing 2,000–3,000 years ago instead of 10,000+, attributing submersion to tectonic activity rather than sea level rise.</p>
      <p><strong>2019</strong> — Takayuki Ogata and colleagues publish a detailed topographical study comparing the monument with onshore formations at Sanninudai, Tindabana, and Kubura-furishi. They conclude natural processes are sufficient to explain the monument's features.</p>
      <p><strong>Present day</strong> — The monument remains officially unrecognised by Japan's Agency for Cultural Affairs. No systematic archaeological excavation has been conducted. The debate continues.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a narrative non-fiction account of the Yonaguni Monument — the enormous underwater formation off the coast of Japan's westernmost island. The geological history, scientific investigations, and cultural context described are based on published scholarship and primary sources; some scene-setting and atmospheric detail is imaginatively reconstructed.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Kimura, Masaaki — "Diving Survey Report for Submarine Ruins Off Yonaguni, Japan," <em>Marine Science Monthly</em>, 2004</p>
      <p>Schoch, Robert M. — "An Enigmatic Ancient Underwater Structure off the Coast of Yonaguni Island, Japan," <em>Circular Times</em>, 1999</p>
      <p>Ogata, Takayuki et al. — "Topographical Analysis of Yonaguni's Coastal Formations," 2019</p>
      <p>Hancock, Graham — <em>Underworld: The Mysterious Origins of Civilization</em>, Crown, 2002</p>
      <p>Nunn, Patrick D. — <em>Vanished Islands and Hidden Continents of the Pacific</em>, University of Hawaii Press, 2009</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-yonaguni-monument.jpg'),
        title: 'The Yonaguni Monument',
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
