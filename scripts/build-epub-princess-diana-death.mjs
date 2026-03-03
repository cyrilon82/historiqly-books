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
  title: 'The Thirteenth Pillar',
  subtitle: 'The Death of Princess Diana and the Conspiracy That Would Not Die',
  author: 'HistorIQly',
  series: 'Vol. 5: Conspiracies',
  slug: 'princess-diana-death',
  description:
    'In the early hours of August 31, 1997, a black Mercedes carrying the most famous woman in the world slammed into a concrete pillar in a Paris tunnel. Within hours, Princess Diana was dead. The official verdict blamed a drunk driver and reckless paparazzi — but for millions, the questions were only beginning.',
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
  hero: imgFileUrl('hero-princess-diana-portrait.jpg'),
  tunnel: imgFileUrl('pont-de-lalma-tunnel.jpg'),
  ritz: imgFileUrl('ritz-paris-vendome.jpg'),
  flame: imgFileUrl('flame-of-liberty-paris.jpg'),
  flowers: imgFileUrl('kensington-palace-flowers-diana.jpg'),
  althorp: imgFileUrl('althorp-house.jpg'),
  henriPaul: imgFileUrl('suspect-henri-paul.png'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The People\'s Princess': figureHtml(
    images.hero,
    'Diana, Princess of Wales, 1997',
    'Diana, Princess of Wales, in 1997 — the most photographed and most famous woman in the world. Her combination of glamour, vulnerability, and humanitarian commitment made her a global icon.'
  ),
  'The Last Night in Paris': figureHtml(
    images.ritz,
    'Place Vendome, Paris, location of the Ritz Hotel',
    'The Place Vendome in Paris, home to the Ritz Hotel where Diana and Dodi spent their final evening. The couple departed from the hotel\'s rear exit on Rue Cambon at 12:20 a.m. on August 31, 1997.'
  ),
  'Impact at the Thirteenth Pillar': figureHtml(
    images.tunnel,
    'The western entrance to the Pont de l\'Alma tunnel in Paris',
    'The Pont de l\'Alma tunnel in Paris, where the Mercedes S280 struck the thirteenth concrete support pillar at approximately 12:23 a.m. on August 31, 1997. The tunnel carried two lanes of traffic beneath the Place de l\'Alma.'
  ),
  'The Race Against Time': figureHtml(
    images.flame,
    'The Flame of Liberty memorial near the Pont de l\'Alma tunnel',
    'The Flame of Liberty, a gold-leaf replica of the Statue of Liberty\'s torch, stands above the Pont de l\'Alma tunnel. Originally a Franco-American friendship monument, it became an unofficial memorial to Diana. The site was renamed Place Diana in 2019.'
  ),
  'A Nation Weeps': figureHtml(
    images.flowers,
    'Sea of flowers at Kensington Palace after Princess Diana\'s death',
    'An estimated one million bouquets were laid at the gates of Kensington Palace in the week following Diana\'s death — the largest floral tribute in recorded history, comprising some sixty million individual blooms.'
  ),
  'The Search for Answers': figureHtml(
    images.henriPaul,
    'Henri Paul, deputy head of security at the Ritz Hotel',
    'Henri Paul, the forty-one-year-old deputy head of security at the Ritz Hotel who drove the Mercedes on its final journey. Post-mortem blood tests revealed an alcohol level more than three times the French legal limit.'
  ),
  'The Verdict': figureHtml(
    images.althorp,
    'Althorp House, the Spencer family estate in Northamptonshire',
    'Althorp House in Northamptonshire, seat of the Spencer family for over five centuries. Diana was buried on a small island in an ornamental lake on the estate grounds, a path lined with thirty-six oak trees — one for each year of her life — leading to the water\'s edge.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/princess-diana-death.ts');
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
  <p class="epigraph">"She was the People's Princess, and that is how she will stay, how she will remain in our hearts and in our memories forever."</p>
  <p class="epigraph-attr">— Tony Blair, August 31, 1997</p>
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
      <p><strong>July 1, 1961</strong> — Diana Frances Spencer is born at Park House on the Sandringham estate, Norfolk, England.</p>
      <p><strong>February 24, 1981</strong> — Engagement of Prince Charles and Lady Diana Spencer is announced.</p>
      <p><strong>July 29, 1981</strong> — Wedding at St Paul's Cathedral, London. Estimated global TV audience of 750 million.</p>
      <p><strong>June 21, 1982</strong> — Prince William is born.</p>
      <p><strong>September 15, 1984</strong> — Prince Harry is born.</p>
      <p><strong>June 1992</strong> — Andrew Morton's <em>Diana: Her True Story</em> is published, revealing Diana's cooperation.</p>
      <p><strong>August 1992</strong> — "Squidgygate" tapes published, revealing Diana's private phone conversation with James Gilbey.</p>
      <p><strong>December 1992</strong> — Prime Minister John Major announces the formal separation of the Prince and Princess of Wales.</p>
      <p><strong>November 20, 1995</strong> — Diana's <em>Panorama</em> interview airs on BBC1. "There were three of us in this marriage."</p>
      <p><strong>August 28, 1996</strong> — Divorce is finalised. Diana retains the title Princess of Wales but loses "Her Royal Highness."</p>
      <p><strong>January 1997</strong> — Diana walks through a live minefield in Huambo, Angola, with the HALO Trust.</p>
      <p><strong>July 11, 1997</strong> — Diana and her sons begin a holiday with the Al-Fayed family in Saint-Tropez.</p>
      <p><strong>August 30, 1997</strong> — Diana and Dodi Fayed arrive in Paris from Sardinia. They dine at the Ritz Hotel.</p>
      <p><strong>August 31, 12:20 a.m.</strong> — Diana and Dodi depart the Ritz via the rear exit on Rue Cambon, driven by Henri Paul.</p>
      <p><strong>August 31, 12:23 a.m.</strong> — The Mercedes S280 crashes into the thirteenth pillar of the Pont de l'Alma tunnel. Dodi and Henri Paul are killed instantly.</p>
      <p><strong>August 31, 4:00 a.m.</strong> — Diana is pronounced dead at the Pitie-Salpetriere Hospital after two hours of emergency surgery.</p>
      <p><strong>September 6, 1997</strong> — Diana's funeral at Westminster Abbey. Global TV audience estimated at 2.5 billion.</p>
      <p><strong>December 1997</strong> — The Ottawa Treaty banning anti-personnel landmines opens for signature, three months after Diana's death.</p>
      <p><strong>September 1999</strong> — French judicial inquiry concludes the crash was caused by Henri Paul's intoxication and excessive speed.</p>
      <p><strong>December 14, 2006</strong> — Operation Paget report published: 832 pages, no evidence of conspiracy.</p>
      <p><strong>October 2, 2007</strong> — Formal inquest into the deaths of Diana and Dodi opens before Lord Justice Scott Baker.</p>
      <p><strong>April 7, 2008</strong> — Jury returns a verdict of "unlawful killing" through grossly negligent driving by Henri Paul and the pursuing paparazzi.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources, official investigations, and historical scholarship; some scene detail is imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Sancton, Tom — <em>Death of a Princess: An Investigation</em>, St. Martin's Press, 1998</p>
      <p>Gregory, Martyn — <em>Diana: The Last Days</em>, Virgin Books, 1999</p>
      <p>Scott Baker, Lord Justice — <em>Summing Up of the Coroner</em>, Inquests into the Deaths of Diana, Princess of Wales, and Emad El-Din Mohamed Abdel Moneim Fayed, 2008</p>
      <p>Stevens, Lord — <em>The Operation Paget Inquiry Report into the Allegation of Conspiracy to Murder</em>, Metropolitan Police, 2006</p>
      <p>Morton, Andrew — <em>Diana: Her True Story</em>, Michael O'Mara Books, 1992</p>
      <p>Spencer, Charles — Funeral Eulogy, September 6, 1997</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-princess-diana-portrait.jpg'),
        title: 'The Thirteenth\nPillar',
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
