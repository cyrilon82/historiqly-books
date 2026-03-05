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
  title: "Yamashita's Gold",
  subtitle: "Japan's Buried Philippine Treasure",
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'yamashitas-gold',
  description:
    'During World War II, Japan looted the wealth of a dozen Asian nations in a secret operation called Golden Lily. As defeat loomed, the treasure was allegedly buried across the Philippines in 175 hidden sites. This is the true story of the general, the locksmith, the dictator, and the $100 billion treasure that may still lie beneath the jungle.',
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
  surrender: imgFileUrl('hero-yamashita-surrender.jpg'),
  portrait: imgFileUrl('suspect-yamashita-portrait.jpg'),
  trial: imgFileUrl('yamashita-war-crimes-trial.jpg'),
  verdict: imgFileUrl('yamashita-after-verdict.jpg'),
  signing: imgFileUrl('yamashita-signing-surrender.jpg'),
  marcos: imgFileUrl('suspect-marcos-portrait.jpg'),
  chichibu: imgFileUrl('suspect-chichibu-portrait.jpg'),
  manila: imgFileUrl('manila-destruction-1945.jpg'),
  tunnel: imgFileUrl('malinta-tunnel-corregidor.jpg'),
  gold: imgFileUrl('gold-bullion-bars.jpg'),
  baguio: imgFileUrl('baguio-city-panorama.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Tiger of Malaya': figureHtml(
    images.portrait,
    'General Tomoyuki Yamashita in dress uniform',
    'General Tomoyuki Yamashita, the "Tiger of Malaya," in full dress uniform with medals and samurai sword. His conquest of Singapore in seventy days made him the most celebrated general in the Imperial Japanese Army — and the most dangerous rival of Prime Minister Tojo.'
  ),
  'The Golden Lily': figureHtml(
    images.chichibu,
    'Prince Chichibu Yasuhito in military uniform',
    'Prince Yasuhito Chichibu, Emperor Hirohito\'s younger brother, who allegedly oversaw Operation Golden Lily — the systematic looting and concealment of Asia\'s wealth during World War II.'
  ),
  'The Fall of Manila': figureHtml(
    images.manila,
    'Aerial view of the devastation of Manila\'s Walled City in May 1945',
    'The Walled City of Intramuros, Manila, after the battle of February-March 1945. An estimated 100,000 Filipino civilians died in the fighting and the Japanese massacre that accompanied it. Manila was the second most destroyed Allied capital of World War II, after Warsaw.'
  ),
  'The Trial of the Tiger': figureHtml(
    images.trial,
    'Yamashita\'s war crimes trial in Manila, 1945',
    'The war crimes tribunal in Manila, 1945. Yamashita was charged not with ordering atrocities but with failing to prevent them — a legal principle that became known as the "Yamashita Standard" and remains a cornerstone of international humanitarian law.'
  ),
  'The Locksmith': figureHtml(
    images.baguio,
    'Panoramic view of Baguio City, Philippines',
    'Baguio City, perched 5,000 feet above sea level in the Cordillera Mountains of northern Luzon. It was here that locksmith Rogelio Roxas lived, and in the surrounding mountains that he found a tunnel containing gold bars and a golden Buddha stuffed with diamonds.'
  ),
  "The Dictator's Hand": figureHtml(
    images.marcos,
    'Ferdinand Marcos, President of the Philippines',
    'Ferdinand Marcos, who ruled the Philippines from 1965 to 1986. His personal fortune, estimated at $5-10 billion, has never been fully explained. Some researchers believe a significant portion came from the recovery of Japanese war loot.'
  ),
  'Twenty-Two Billion Dollars': figureHtml(
    images.gold,
    'Stack of gold bullion bars',
    'Gold bullion bars. The jury in Hawaii awarded $22 billion in damages against the Marcos estate — the largest jury verdict in American history at the time — based on the estimated value of the treasure Roxas discovered in his tunnel.'
  ),
  'The Hunters': figureHtml(
    images.tunnel,
    'Entrance to the Malinta Tunnel on Corregidor Island',
    'The Malinta Tunnel on Corregidor Island, one of the most famous tunnel complexes in the Philippines. Japanese military engineers constructed extensive underground fortifications across the archipelago during the occupation — and, according to legend, used similar tunnels to hide the Golden Lily treasure.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/yamashitas-gold.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
const chapters = [];
let match;
while ((match = chapterRegex.exec(raw)) !== null) {
  chapters.push({
    num: match[1],
    title: (match[2] || match[3]).replace(/\\'/g, "'"),
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
  <p class="epigraph">"What makes me wonder is that for the past fifty years, despite all the treasure hunters, their maps, oral testimony and sophisticated metal detectors, nobody has found a thing."</p>
  <p class="epigraph-attr">— Professor Ambeth Ocampo, Filipino historian</p>
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
      <p><strong>1931</strong> — Japan invades Manchuria. Systematic looting of Chinese wealth begins and continues for the next fourteen years.</p>
      <p><strong>1937</strong> — Full-scale war in China. Japanese forces strip banks, museums, temples, and private collections across the occupied territories.</p>
      <p><strong>1941 (December)</strong> — Japan attacks Pearl Harbor and invades Southeast Asia. Yamashita's 25th Army lands in Malaya.</p>
      <p><strong>1942 (February 15)</strong> — Yamashita captures Singapore in 70 days, earning the title "Tiger of Malaya." 80,000 British troops surrender — the largest capitulation in British military history.</p>
      <p><strong>1942 (Spring)</strong> — Operation Golden Lily, overseen by Prince Chichibu, establishes headquarters in Singapore. Looted treasure from across Southeast Asia is inventoried and shipped toward Japan.</p>
      <p><strong>1942 (June)</strong> — Battle of Midway. Japan loses four aircraft carriers. Sea lanes to Japan become increasingly dangerous, forcing the treasure to be stored in the Philippines instead.</p>
      <p><strong>1943–1944</strong> — Golden Lily teams allegedly construct approximately 175 treasure sites across the Philippine archipelago — tunnels, caves, and underground complexes.</p>
      <p><strong>1944 (October)</strong> — Yamashita arrives in the Philippines to command the defense against the American invasion. He orders the evacuation of Manila.</p>
      <p><strong>1945 (February–March)</strong> — Battle of Manila. Admiral Iwabuchi defies Yamashita's evacuation order. An estimated 100,000 Filipino civilians die in the fighting and the Manila Massacre.</p>
      <p><strong>1945 (September 2)</strong> — Yamashita surrenders to American forces in northern Luzon.</p>
      <p><strong>1945 (October 29–December 7)</strong> — Yamashita's war crimes trial in Manila. He is found guilty under the new doctrine of command responsibility and sentenced to death.</p>
      <p><strong>1946 (February 23)</strong> — Yamashita is hanged at Los Banos internment camp. He is 60 years old.</p>
      <p><strong>1953</strong> — Prince Chichibu dies of tuberculosis. He never faces legal consequences for his alleged role in Golden Lily.</p>
      <p><strong>1961</strong> — Rogelio Roxas, a 17-year-old locksmith in Baguio, meets the son of a Japanese soldier who provides a treasure map.</p>
      <p><strong>1970</strong> — Roxas obtains an excavation permit and begins a seven-month dig in the mountains near Baguio.</p>
      <p><strong>1971 (January)</strong> — Roxas discovers a tunnel containing gold bars and a golden Buddha statue filled with diamonds.</p>
      <p><strong>1971 (April 6)</strong> — Armed men raid Roxas's home, seizing the Buddha, diamonds, and 17 gold bars.</p>
      <p><strong>1971 (May–1974)</strong> — Roxas is arrested, tortured, and imprisoned without charges for over three years.</p>
      <p><strong>1986 (February)</strong> — People Power Revolution. Marcos flees to Hawaii.</p>
      <p><strong>1988 (March)</strong> — Roxas files suit against the Marcos estate in Hawaii.</p>
      <p><strong>1989 (September 28)</strong> — Ferdinand Marcos dies in exile in Honolulu.</p>
      <p><strong>1993 (May 25)</strong> — Rogelio Roxas dies at age 49. Cause: tuberculosis. No autopsy performed.</p>
      <p><strong>1996</strong> — Hawaii jury awards $22 billion to Golden Buddha Corporation — the largest jury verdict in American history at the time.</p>
      <p><strong>2003</strong> — Sterling and Peggy Seagrave publish <em>Gold Warriors</em>, alleging US government recovery and covert use of the treasure.</p>
      <p><strong>2019</strong> — History Channel premieres <em>Lost Gold of World War II</em>, following modern treasure hunters in the Philippines.</p>
      <p><strong>2024 (March)</strong> — Four Filipino treasure hunters die of carbon monoxide poisoning while excavating a cave in Bukidnon province.</p>
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
      <p>Seagrave, Sterling and Peggy — <em>Gold Warriors: America's Secret Recovery of Yamashita's Gold</em>, Verso, 2003</p>
      <p>Schloss, Craig — <em>Yamashita's Gold: The Story of Yamashita's Legendary Wartime Treasure</em></p>
      <p>Ocampo, Ambeth R. — "Yamashita's Treasure," <em>Philippine Daily Inquirer</em></p>
      <p>Frank, Richard B. — <em>Downfall: The End of the Imperial Japanese Empire</em>, Random House, 1999</p>
      <p>Lael, Richard L. — <em>The Yamashita Precedent: War Crimes and Command Responsibility</em>, Scholarly Resources, 1982</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-yamashita-surrender.jpg'),
        title: "Yamashita's\nGold",
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
