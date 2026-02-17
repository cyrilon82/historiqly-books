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
  title: "Cleopatra's Last Breath",
  subtitle: "The Mystery of the Serpent Queen's Death",
  author: 'HistorIQly',
  series: 'Vol. 2: Myths',
  slug: 'cleopatra-snake-bite',
  description:
    "For two thousand years, the world has believed Cleopatra VII died from the bite of a sacred asp. But Plutarch himself doubted the story. Modern toxicologists say it's nearly impossible. And her own physician — the only eyewitness — never mentioned a snake at all.",
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
  hero: imgFileUrl('hero-death-of-cleopatra.jpg'),
  rixens: imgFileUrl('death-of-cleopatra-rixens.jpg'),
  waterhouse: imgFileUrl('cleopatra-waterhouse.jpg'),
  cagnacci: imgFileUrl('death-of-cleopatra-cagnacci.jpg'),
  giampietrino: imgFileUrl('death-of-cleopatra-giampietrino.jpg'),
  bust: imgFileUrl('bust-cleopatra-berlin.jpg'),
  augustus: imgFileUrl('suspect-octavian-augustus.jpg'),
  antony: imgFileUrl('suspect-mark-antony.jpg'),
  actium: imgFileUrl('battle-of-actium.jpg'),
  cobra: imgFileUrl('egyptian-cobra.jpg'),
  poisons: imgFileUrl('cleopatra-testing-poisons.jpg'),
  plutarch: imgFileUrl('bust-plutarch.jpg'),
  taposiris: imgFileUrl('taposiris-magna-temple.jpg'),
  coin: imgFileUrl('coin-antony-cleopatra.jpg'),
  uraeus: imgFileUrl('uraeus-cobra-crown.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Serpent and the Queen': figureHtml(
    images.rixens,
    'The Death of Cleopatra by Jean-André Rixens, 1874',
    'Jean-André Rixens, <em>The Death of Cleopatra</em> (1874). The iconic scene as the Western imagination constructed it — Cleopatra sprawled on a golden chaise, the serpent\'s work done. But is this what really happened?'
  ),
  'The Last Pharaoh': figureHtml(
    images.poisons,
    'Cleopatra Testing Poisons on Condemned Prisoners by Alexandre Cabanel, 1887',
    'Alexandre Cabanel, <em>Cleopatra Testing Poisons on Condemned Prisoners</em> (1887). Plutarch records that Cleopatra methodically tested venoms and poisons on the condemned, cataloguing which produced the most painless death.'
  ),
  'The Fall': figureHtml(
    images.actium,
    'The Battle of Actium by Lorenzo A. Castro, 1672',
    'Lorenzo A. Castro, <em>The Battle of Actium, 2 September 31 BC</em> (1672). The naval defeat that sealed Cleopatra and Antony\'s fate. Within a year, both would be dead and Egypt would belong to Rome.'
  ),
  'The Death Scene': figureHtml(
    images.cagnacci,
    'The Death of Cleopatra by Guido Cagnacci, c. 1657-1669',
    'Guido Cagnacci, <em>The Death of Cleopatra</em> (c. 1657). Three women were found dead or dying in the sealed mausoleum — Cleopatra, Iras, and Charmion. Their near-simultaneous deaths are one of the strongest arguments against the snake.'
  ),
  'The Ancient Sources': figureHtml(
    images.plutarch,
    'Bust of Plutarch at the Archaeological Museum of Delphi',
    'Plutarch of Chaeronea (c. 46–127 AD), whose <em>Life of Antony</em> is the primary source for the death scene. He presented the asp story as one of several possibilities, concluding: "The truth of the matter no one knows."'
  ),
  'The Snake Problem': figureHtml(
    images.cobra,
    'Egyptian cobra (Naja haje)',
    'The Egyptian cobra (<em>Naja haje</em>), the species traditionally associated with Cleopatra\'s death. Adults measure 5–6 feet and can reach 8 feet. Concealing one in a basket of figs, as the legend claims, would be virtually impossible.'
  ),
  'The Poison Cabinet': figureHtml(
    images.waterhouse,
    'Cleopatra by John William Waterhouse, 1888',
    'John William Waterhouse, <em>Cleopatra</em> (1888). A brooding, Pre-Raphaelite portrait of the queen. Modern scholars increasingly believe she chose a self-administered poison — not a snake — drawing on her documented expertise in toxicology.'
  ),
  'The Verdict': figureHtml(
    images.taposiris,
    'Ruins of the Osiris temple at Taposiris Magna',
    'The Osiris temple at Taposiris Magna, the Ptolemaic-era site where archaeologist Kathleen Martinez has been searching for Cleopatra\'s tomb. Without recovering the queen\'s remains, the mystery may never be fully solved.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/cleopatra-snake-bite.ts');
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
  <p class="epigraph">"The truth of the matter no one knows; for it was also said that she carried about poison in a hollow comb and kept the comb hidden in her hair."</p>
  <p class="epigraph-attr">— Plutarch, Life of Antony, c. 110 AD</p>
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
      <p><strong>69 BC</strong> — Cleopatra VII Philopator is born in Alexandria, the third child of Ptolemy XII Auletes. She will become the last active ruler of the Ptolemaic Kingdom of Egypt.</p>
      <p><strong>51 BC</strong> — Cleopatra ascends to the throne at age 18, initially co-ruling with her younger brother Ptolemy XIII.</p>
      <p><strong>48 BC</strong> — Julius Caesar arrives in Alexandria. Cleopatra famously smuggles herself into his presence. Their alliance produces a son, Caesarion (Ptolemy XV).</p>
      <p><strong>44 BC</strong> — Caesar is assassinated in Rome. Cleopatra returns to Egypt and consolidates power.</p>
      <p><strong>41 BC</strong> — Mark Antony summons Cleopatra to Tarsus. Their political and romantic alliance begins.</p>
      <p><strong>34 BC</strong> — The Donations of Alexandria: Antony grants Roman territories to Cleopatra and her children, provoking fury in Rome.</p>
      <p><strong>September 2, 31 BC</strong> — The Battle of Actium. Octavian's fleet, commanded by Agrippa, decisively defeats Antony and Cleopatra in the Ionian Sea. The couple retreats to Egypt.</p>
      <p><strong>August 1, 30 BC</strong> — Octavian's legions breach Alexandria. Antony's remaining forces desert. Cleopatra seals herself in her mausoleum. Antony, believing Cleopatra dead, falls on his sword and is carried to the mausoleum, where he dies in her arms.</p>
      <p><strong>Early August, 30 BC</strong> — Octavian's agent Gaius Proculeius enters the mausoleum and captures Cleopatra, preventing her from destroying her treasure. She is placed under guard.</p>
      <p><strong>August 10–12, 30 BC</strong> — Cleopatra dies at age 39, along with her handmaidens Iras and Charmion. They are found in the sealed mausoleum — Cleopatra on a bed of gold in full royal regalia, Iras dead at her feet, Charmion barely alive, adjusting her mistress's crown.</p>
      <p><strong>August 29, 30 BC</strong> — Cleopatra's son Caesarion is captured and executed on Octavian's orders.</p>
      <p><strong>29 BC</strong> — Octavian celebrates his triple triumph in Rome, parading an effigy of Cleopatra with an asp clinging to her arm — establishing the snake narrative in the Roman imagination.</p>
      <p><strong>c. 23 BC</strong> — The poet Horace writes of Cleopatra's death with serpent imagery, one of the earliest literary references.</p>
      <p><strong>c. 110 AD</strong> — Plutarch writes the <em>Life of Antony</em>, providing the fullest ancient account. He presents the asp story as one of several alternatives, citing Cleopatra's physician Olympos — who never mentioned a snake.</p>
      <p><strong>c. 229 AD</strong> — Cassius Dio writes of puncture wounds on Cleopatra's arm and a poisoned pin hidden in her hair.</p>
      <p><strong>365 AD</strong> — A massive earthquake and tsunami devastate Alexandria. Much of the ancient royal quarter, including Cleopatra's mausoleum, is destroyed or submerged.</p>
      <p><strong>2010</strong> — Historian Christoph Schaefer and toxicologist Dietrich Mebs conclude Cleopatra likely ingested a cocktail of hemlock, wolfsbane, and opium.</p>
      <p><strong>2022</strong> — Archaeologist Kathleen Martinez discovers a 1,300-metre tunnel beneath the temple at Taposiris Magna, possibly leading toward Cleopatra's tomb.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; dialogue and some scene detail are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Primary Sources</strong></p>
      <p>Plutarch — <em>Life of Antony</em>, c. 110–115 AD (trans. Bernadotte Perrin, Loeb Classical Library)</p>
      <p>Cassius Dio — <em>Roman History</em>, Book 51, c. 229 AD</p>
      <p>Strabo — <em>Geography</em>, Book 17, c. 18 BC – 2 AD</p>
      <p>Suetonius — <em>Life of Augustus</em>, c. 121 AD</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Roller, Duane — "The Death of Cleopatra: There Was No Asp," CAMWS Paper, 2010</p>
      <p>Schaefer, Christoph & Mebs, Dietrich — "Cleopatra's death by poison," 2010</p>
      <p>Brown, Pat — <em>The Murder of Cleopatra: History's Greatest Cold Case</em>, Prometheus Books, 2013</p>
      <p>Tsoucalas, Gregory & Sgantzos, Markos — "Toxicology and snakes in Ptolemaic Egyptian dynasty," <em>Toxicology Reports</em>, 2021</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-death-of-cleopatra.jpg'),
        title: "Cleopatra's\nLast Breath",
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
