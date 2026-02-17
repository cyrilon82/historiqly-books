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
  title: 'The Dyatlov Pass Incident',
  subtitle: 'Nine Hikers, One Mountain, No Survivors',
  author: 'HistorIQly',
  series: 'Vol. 8: Unexplained',
  slug: 'dyatlov-pass',
  description:
    'In February 1959, nine Soviet hikers pitched their tent on a remote Ural Mountain slope and never came home. They slashed their way out of the tent in the middle of the night, fled half-dressed into -30°C darkness, and died in circumstances so bizarre that the Soviet investigation could only blame "a compelling natural force." This is the full story — from the last diary entries to the missing tongue, the radiation, and the theory that finally broke the case open sixty years later.',
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
  hero: imgFileUrl('hero-dyatlov-snowy-slope-night.jpg'),
  tent: imgFileUrl('hero-dyatlov-tent-discovery.jpg'),
  group: imgFileUrl('figure-dyatlov-group-photo.jpg'),
  caseCover: imgFileUrl('evidence-dyatlov-case-file-cover.jpg'),
  casePage1: imgFileUrl('evidence-dyatlov-case-page1.jpg'),
  caseClosure: imgFileUrl('evidence-dyatlov-case-closure.jpg'),
  radiationOrder: imgFileUrl('evidence-dyatlov-radiation-order.jpg'),
  model3d: imgFileUrl('evidence-dyatlov-3d-model.png'),
  avalanche: imgFileUrl('evidence-avalanche-snow-slab.jpg'),
  memorial: imgFileUrl('location-dyatlov-memorial.jpg'),
  cemetery: imgFileUrl('location-dyatlov-cemetery-graves.jpg'),
  otorten: imgFileUrl('atmosphere-dyatlov-otorten-mountain.jpg'),
  otortenView: imgFileUrl('atmosphere-dyatlov-otorten-view.jpg'),
  auspiya: imgFileUrl('atmosphere-dyatlov-auspiya-river.jpg'),
  uralPeaks: imgFileUrl('atmosphere-ural-mountain-peaks.jpg'),
  blizzard: imgFileUrl('atmosphere-blizzard-aftermath.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Pass': figureHtml(
    images.otorten,
    'Mount Otorten in the Northern Urals',
    'Mount Otorten, the group\'s destination. The name means "Don\'t Go There" in the Mansi language. The rock formations on the treeless summit rise from the Northern Ural tundra like sentinels.'
  ),
  'The Group': figureHtml(
    images.group,
    'Memorial with portraits of all nine members of the Dyatlov group',
    'The nine members of the Dyatlov group, as they appear on the memorial monument at Mikhailovskoe Cemetery in Yekaterinburg. Top row: Doroshenko, Dubinina, Dyatlov. Middle: Zolotaryov, Kolmogorova, Kolevatov. Bottom: Krivonischenko, Slobodin, Thibeaux-Brignolle.'
  ),
  'The Journey': figureHtml(
    images.auspiya,
    'The Auspiya River in the Northern Urals',
    'The Auspiya River, which the group followed upstream into the wilderness. On January 31, they cached supplies near its banks before turning toward the pass.'
  ),
  'The Night': figureHtml(
    images.blizzard,
    'Snow-covered mountain landscape after a blizzard',
    'The Northern Urals in winter. On the night of February 1-2, 1959, temperatures on the exposed slope of Kholat Syakhl plunged to -30°C with fierce winds.'
  ),
  'The Search': figureHtml(
    images.tent,
    'The Dyatlov group\'s tent as found by searchers on February 26, 1959',
    'The tent as discovered by search party members Mikhail Sharavin and Boris Slobtsov on February 26, 1959. It was partially collapsed and buried in snow, with a long slash cut from the inside. Ski poles protrude from the snow. Inside: shoes, clothing, food, cameras — everything the hikers would have needed to survive.'
  ),
  'The Ravine': figureHtml(
    images.casePage1,
    'First page of the criminal case file for the Dyatlov Pass incident',
    'The opening page of the criminal investigation into the deaths of the Dyatlov group. The document, dated February 26, 1959, initiates formal proceedings into the circumstances surrounding the hikers\' deaths near Mount Otorten.'
  ),
  'The Investigation': figureHtml(
    images.caseCover,
    'Original cover of the criminal case file',
    'The original cover of the criminal case. The handwritten Russian text reads: "Case No. — On the death of tourists in the area of Mount Otorten. Started: 1959. Completed: 1959." The case was opened and closed within months — its conclusions sealed for decades.'
  ),
  'Dead Mountain': figureHtml(
    images.memorial,
    'Memorial monument to the Dyatlov group at Mikhailovskoe Cemetery',
    'The memorial obelisk at Mikhailovskoe Cemetery in Yekaterinburg, where most of the group is buried. Oval portraits of all nine hikers are set into the stone. A red star rests at the base. More than sixty years after their deaths, visitors still come.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/dyatlov-pass.ts');
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
  <p class="epigraph">"If I had a chance to ask God just one question, it would be: What really happened to my friends that night?"</p>
  <p class="epigraph-attr">— Yuri Yudin, sole survivor of the Dyatlov expedition, 2008</p>
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
      <p><strong>January 23, 1959</strong> — The Ural Polytechnical Institute issues route book No. 5 for the Dyatlov group's expedition to Mount Otorten, a Grade III trek through the Northern Urals.</p>
      <p><strong>January 25</strong> — The group of ten arrives in Ivdel by train. They travel onward to the settlement of Vizhai by truck.</p>
      <p><strong>January 27</strong> — The group departs from the 2nd Northern settlement (District 41) on skis, heading north along the Lozva River.</p>
      <p><strong>January 28</strong> — Yuri Yudin, the tenth member, turns back due to sciatica and knee pain. He says goodbye to his nine friends. He will never see them again.</p>
      <p><strong>January 31</strong> — The group caches food and surplus equipment near the Auspiya River for the return journey. They begin their ascent toward the pass.</p>
      <p><strong>February 1</strong> — The group reaches the slope of Kholat Syakhl ("Dead Mountain") and pitches their tent at approximately 1,079 meters elevation on the northeastern face. The last diary entry is written. The last photographs are taken.</p>
      <p><strong>February 1–2 (night)</strong> — Something causes the group to slash their tent from the inside and flee into -30°C darkness wearing minimal clothing. All nine die during the night or following hours.</p>
      <p><strong>February 12</strong> — The group's expected return date passes without contact.</p>
      <p><strong>February 20</strong> — Relatives and the university raise the alarm. Search parties are organized.</p>
      <p><strong>February 26</strong> — Student volunteers Mikhail Sharavin and Boris Slobtsov discover the abandoned tent on the mountainside, slashed and partially buried in snow.</p>
      <p><strong>February 27</strong> — Two bodies are found at a large cedar tree 1.5 km downhill from the tent: Yuri Doroshenko and Yuri Krivonischenko. Both show signs of burns. Later that day, the body of Igor Dyatlov is found 300 meters from the cedar.</p>
      <p><strong>March 5</strong> — The bodies of Zinaida Kolmogorova and Rustem Slobodin are found between the tent and the cedar. Slobodin has a skull fracture.</p>
      <p><strong>March 4–8</strong> — Autopsies are performed on the first five bodies. Official cause of death: hypothermia.</p>
      <p><strong>May 4</strong> — The remaining four bodies are found in a ravine 75 meters from the cedar tree, under 4 meters of snow: Lyudmila Dubinina, Semyon Zolotaryov, Nicolas Thibeaux-Brignolle, and Alexander Kolevatov.</p>
      <p><strong>May 9</strong> — Autopsies on the ravine four reveal catastrophic injuries: Dubinina and Zolotaryov have multiple broken ribs; Thibeaux-Brignolle has a massive skull fracture. Dubinina is missing her tongue, eyes, and lips. Clothing on some bodies shows elevated radiation levels.</p>
      <p><strong>May 28, 1959</strong> — Lead investigator Lev Ivanov closes the case. Official cause: death due to "a compelling natural force which the hikers were not able to overcome."</p>
      <p><strong>1990</strong> — Lev Ivanov publishes an article claiming he was forced to close the case and that he witnessed "flying spheres" in the area, suggesting a government cover-up.</p>
      <p><strong>February 2019</strong> — Russian authorities officially reopen the investigation, examining only three natural hypotheses: avalanche, snow slab, or hurricane.</p>
      <p><strong>July 11, 2020</strong> — Deputy head of the Urals Federal District Andrey Kuryakov announces the official conclusion: a slab avalanche caused the group to flee the tent.</p>
      <p><strong>January 2021</strong> — Swiss researchers Alexander Puzrin and Johan Gaume publish a study in <em>Nature Communications Earth & Environment</em> demonstrating that a delayed slab avalanche, triggered by katabatic winds and the group's own tent cut into the slope, could explain the injuries.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources, translated case files, and published scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Eichar, Donnie — <em>Dead Mountain: The Untold True Story of the Dyatlov Pass Incident</em>, Chronicle Books, 2013</p>
      <p>McCloskey, Keith — <em>Mountain of the Dead: The Dyatlov Pass Incident</em>, The History Press, 2013</p>
      <p>Puzrin, Alexander M. & Johan Gaume — "Mechanisms of slab avalanche release and impact in the Dyatlov Pass incident in 1959," <em>Communications Earth & Environment</em>, Nature, 2021</p>
      <p>Rakitin, Alexei — <em>Dyatlov Pass</em> (Перевал Дятлова), 2011 (Russian)</p>
      <p>DyatlovPass.com — Comprehensive archive of translated case files, photographs, and witness testimonies</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-dyatlov-snowy-slope-night.jpg'),
        title: 'The Dyatlov\nPass Incident',
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
