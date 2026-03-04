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
  title: "Han van Meegeren's Vermeers",
  subtitle: 'The Forger Who Fooled the Nazis',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'han-van-meegeren',
  description:
    'In 1937, the greatest Dutch art expert alive declared a newly discovered painting "every inch a Vermeer." It sold for half a million guilders and hung in a national museum. The man who made it had mixed his paints with Bakelite resin and baked the canvas in a kitchen oven. This is the true story of Han van Meegeren — the failed artist who forged his way into history, tricked Hermann Göring, and became a national hero.',
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
  hero:         imgFileUrl('hero-van-meegeren-1945.jpg'),
  emmaus:       imgFileUrl('van-meegeren-emmaus-forgery.jpg'),
  bredius:      imgFileUrl('suspect-abraham-bredius.jpg'),
  goering:      imgFileUrl('suspect-hermann-goering.jpg'),
  exhibition:   imgFileUrl('van-meegeren-emmaus-exhibition.jpg'),
  atWork:       imgFileUrl('van-meegeren-at-work-1945.jpg'),
  studio:       imgFileUrl('van-meegeren-studio-1928.jpg'),
  jesusDoctors: imgFileUrl('van-meegeren-jesus-doctors.jpg'),
  paintingProof:imgFileUrl('van-meegeren-painting-prison.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Wound': figureHtml(
    images.studio,
    'Han van Meegeren in his Hague studio, 1928',
    'Han van Meegeren at work in his Hague studio in 1928 — nine years before the Emmaus forgery. Critics called him technically brilliant but derivative. He was already planning his revenge.'
  ),
  'The Kitchen Laboratory': figureHtml(
    images.hero,
    'Han van Meegeren photographed in 1945',
    'Van Meegeren photographed in 1945, the year of his arrest. Decades of heavy drinking, morphine dependency, and heavy smoking had left him visibly deteriorated — but the technical intelligence that had created the forgeries remained intact.'
  ),
  'Every Inch a Vermeer': figureHtml(
    images.emmaus,
    'The Supper at Emmaus, van Meegeren\'s first major forgery (1936–37)',
    'The Supper at Emmaus, painted by Han van Meegeren between 1936 and 1937. Abraham Bredius called it "every inch a Vermeer" in The Burlington Magazine in November 1937. It sold for 520,000 guilders and hung in Museum Boijmans Van Beuningen for years as a national treasure.'
  ),
  'The Wartime Vermeers': figureHtml(
    images.goering,
    'Hermann Göring, frontal portrait, 1946',
    'Hermann Göring, Reichsmarschall and second in the Nazi hierarchy, photographed in 1946 during the Nuremberg trials. He exchanged approximately 137 looted paintings for van Meegeren\'s fake Vermeer, Christ with the Woman Taken in Adultery. He believed it was one of the finest paintings in the world.'
  ),
  'The Arrest': figureHtml(
    images.exhibition,
    'Van Meegeren\'s Emmaus on display, examined by experts',
    'Han van Meegeren\'s Supper at Emmaus being examined. When van Meegeren confessed that every Vermeer he had sold — including this canvas — was his own work, the art experts refused to believe him. They were convinced by Bredius\'s authentication that the paintings were genuine.'
  ),
  'Painting for His Life': figureHtml(
    images.paintingProof,
    'Han van Meegeren at work under police supervision, 1945',
    'Van Meegeren at work under court supervision in 1945, demonstrating his forgery techniques to prove his confession. He painted Jesus Among the Doctors using the same Bakelite-bound paints and oven-baking method that had produced the Emmaus eight years earlier.'
  ),
  'The Trial': figureHtml(
    images.atWork,
    'Han van Meegeren during his trial proceedings, October 1945',
    'Han van Meegeren photographed during the legal proceedings that would eventually lead to his trial in October 1947. The collaboration charges were dropped after his forgery was confirmed scientifically; he was tried instead for fraud.'
  ),
  'What Makes a Vermeer': figureHtml(
    images.jesusDoctors,
    'Jesus Among the Doctors, painted by van Meegeren as proof of his forgery skills',
    'Jesus Among the Doctors, painted by van Meegeren in 1945 under court supervision to prove that he could produce convincing Vermeers. The painting was executed using his own techniques: Bakelite binder, historically authentic pigments, seventeenth-century canvas, oven-baked to hardness.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/han-van-meegeren.ts');
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
  <p class="epigraph">"It is a wonderful moment in the life of a lover of art when he finds himself suddenly confronted with a hitherto unknown painting by a great master, untouched, on the original canvas, and without any restoration, just as it left the painter's studio. And what a picture!"</p>
  <p class="epigraph-attr">— Abraham Bredius, <em>The Burlington Magazine</em>, November 1937<br/>authenticating a painting made by Han van Meegeren</p>
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
      <p><strong>10 October 1889</strong> — Han van Meegeren born in Deventer, Netherlands.</p>
      <p><strong>1907</strong> — Enrolls at Delft University of Technology to study architecture under family pressure.</p>
      <p><strong>8 January 1913</strong> — Wins the Gold Medal from Delft for his detailed rendering of the interior of the Laurenskerk in Rotterdam.</p>
      <p><strong>1913</strong> — Abandons architecture; enrolls at the art school in The Hague.</p>
      <p><strong>April 1928 – March 1930</strong> — Publishes <em>De Kemphaan</em>, a monthly art journal mixing legitimate criticism with anti-modernist and anti-Semitic rhetoric.</p>
      <p><strong>1932</strong> — Moves with wife Johanna Oerlemans to Villa Primavera in Roquebrune-Cap-Martin, France. Begins four years of technical preparation for forgery, experimenting with Bakelite binder, historical pigments, and aged canvases.</p>
      <p><strong>1936–37</strong> — Paints <em>The Supper at Emmaus</em> on an authentic seventeenth-century canvas, using Bakelite-bound paints and an oven-baking technique to produce a convincingly aged surface.</p>
      <p><strong>September 1937</strong> — Amsterdam lawyer C. A. Boon presents the <em>Emmaus</em> to Abraham Bredius in Monaco. Bredius authenticates it as a masterpiece of Johannes Vermeer.</p>
      <p><strong>November 1937</strong> — Bredius publishes his authentication in <em>The Burlington Magazine</em> under the title "A New Vermeer," calling it "every inch a Vermeer."</p>
      <p><strong>1938</strong> — The Rembrandt Society purchases the <em>Emmaus</em> for 520,000–550,000 guilders. Donated to Museum Boijmans Van Beuningen in Rotterdam, where it is exhibited as a national treasure.</p>
      <p><strong>10 May 1940</strong> — Germany invades the Netherlands. The occupation begins.</p>
      <p><strong>1940–43</strong> — Van Meegeren produces a series of wartime "Vermeers" sold through Dutch art dealers: <em>The Head of Christ</em>, <em>The Last Supper II</em>, <em>The Blessing of Jacob</em>, <em>The Washing of the Feet.</em> Total receipts exceed seven million guilders.</p>
      <p><strong>1941–42</strong> — Van Meegeren paints <em>Christ with the Woman Taken in Adultery.</em></p>
      <p><strong>1942–43</strong> — The painting is sold through dealer Alois Miedl to Hermann Göring for 1,650,000 guilders. Göring trades approximately 137 looted Dutch paintings in exchange.</p>
      <p><strong>25 August 1943</strong> — Göring transfers his collection, including the fake Vermeer, to the Alt Aussee salt mine in Austria for wartime safekeeping.</p>
      <p><strong>May 1945</strong> — Allied forces recover Göring's collection from Alt Aussee. Provenance investigation traces the fake Vermeer back to van Meegeren in Amsterdam.</p>
      <p><strong>29 May 1945</strong> — Van Meegeren arrested in Amsterdam on charges of fraud and collaboration with the enemy.</p>
      <p><strong>12 July 1945</strong> — Van Meegeren confesses that every Vermeer he sold was his own forgery. Art experts refuse to believe him.</p>
      <p><strong>July–December 1945</strong> — Under court supervision, van Meegeren paints <em>Jesus Among the Doctors</em> using his own techniques, to prove his confession. Chemical analysis by Paul Coremans identifies Bakelite in the existing forgeries.</p>
      <p><strong>13 March 1946</strong> — Abraham Bredius dies in Monaco, never knowing he had been deceived.</p>
      <p><strong>29 October 1947</strong> — Trial opens in Amsterdam on charges of forgery and fraud. Collaboration charges have been dropped.</p>
      <p><strong>12 November 1947</strong> — Van Meegeren found guilty and sentenced to one year in prison. He is ranked second in a national popularity poll.</p>
      <p><strong>26 November 1947</strong> — Van Meegeren suffers a heart attack. Hospitalized.</p>
      <p><strong>30 December 1947</strong> — Han van Meegeren dies in Amsterdam, age 58, without serving a day of his sentence.</p>
      <p><strong>1967</strong> — Scientists at Carnegie Mellon University apply lead-210 dating to van Meegeren's forgeries, definitively confirming their twentieth-century origin.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship; some scene detail and dialogue are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Lopez, Jonathan — <em>The Man Who Made Vermeers: Unvarnishing the Legend of Master Forger Han van Meegeren</em>, Harcourt, 2008</p>
      <p>Dolnick, Edward — <em>The Forger's Spell: A True Story of Vermeer, Nazis, and the Greatest Art Hoax of the Twentieth Century</em>, Harper, 2008</p>
      <p>Coremans, Paul — <em>Van Meegeren's Faked Vermeers and De Hooghs</em>, Meulenhoff, 1949</p>
      <p>Bredius, Abraham — "A New Vermeer," <em>The Burlington Magazine</em>, November 1937</p>
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
        backgroundImage: resolve(IMG_DIR, 'van-meegeren-emmaus-forgery.jpg'),
        title: "Han van\nMeegeren's\nVermeers",
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
