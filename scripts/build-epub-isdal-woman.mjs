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
  title: 'The Isdal Woman',
  subtitle: 'Nine Identities, One Burned Body',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'isdal-woman',
  description:
    'In November 1970, a burned body was found in a remote Norwegian valley. She carried nine fake identities, coded notes, and no past. Over fifty years later, nobody knows who she was — or why she died. This is the story of the most baffling cold case in Scandinavian history.',
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
  hero: imgFileUrl('hero-isdal-valley.jpg'),
  bergenStation: imgFileUrl('isdal-bergen-station.jpg'),
  bryggen: imgFileUrl('isdal-bryggen-bergen.jpg'),
  ulriken: imgFileUrl('isdal-ulriken-mountain.jpg'),
  valleyHistoric: imgFileUrl('isdal-valley-historic.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Death Valley': figureHtml(
    images.hero,
    'Isdalen Valley near Bergen, Norway',
    'Isdalen — the Ice Valley — on the north face of Ulriken mountain near Bergen. The locals called it Death Valley long before the Isdal Woman was found here in November 1970.'
  ),
  'The Suitcases': figureHtml(
    images.bergenStation,
    'Bergen Railway Station, Norway',
    'Bergen Railway Station, where two unclaimed suitcases belonging to the Isdal Woman were discovered on December 2, 1970. Inside: wigs, currency from five countries, coded notes, and clothing with every label removed.'
  ),
  'The Aliases': figureHtml(
    images.bryggen,
    'Bryggen wharf in Bergen, Norway',
    'Bryggen, the historic wharf district of Bergen. The Isdal Woman stayed at multiple Bergen hotels under false names, always claiming Belgian nationality. She was last seen checking out of Hotel Hordaheimen on November 23, 1970.'
  ),
  'The Spy Question': figureHtml(
    images.ulriken,
    'Ulriken mountain overlooking Bergen, Norway',
    'Ulriken, the tallest of Bergen\'s seven mountains, overlooks the city and its military port. A classified document noted that the Isdal Woman\'s movements corresponded with top-secret Penguin missile trials along the Norwegian coast.'
  ),
  'The Reopening': figureHtml(
    images.valleyHistoric,
    'Historic photograph of Isdalen near Bergen',
    'A historic photograph of the Isdalen area near Bergen. In 2016, NRK reopened the case with modern forensic techniques. Isotope analysis of the preserved jawbone suggested the woman was born around 1930 near Nuremberg, Germany.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/isdal-woman.ts');
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
  <p class="epigraph">"She was someone. She was born, she grew up, she learned languages, she went to the dentist, she bought boots in Stavanger. Somewhere, someone knew her."</p>
  <p class="epigraph-attr">— On the Isdal Woman</p>
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
      <p><strong>~1930</strong> — The Isdal Woman is born, most likely in or near Nuremberg, Germany, based on stable isotope analysis of her teeth conducted in 2017.</p>
      <p><strong>~1935–1945</strong> — She moves to France or the Franco-German border region during childhood, consistent with handwriting analysis suggesting French-language education.</p>
      <p><strong>October 22–28, 1970</strong> — According to her coded travel diary, she is in Oslo, then travels to Paris.</p>
      <p><strong>October 29, 1970</strong> — She travels from Paris to Stavanger, Norway. She checks into the Hotel St. Svithun under the name Fenella Lorch. A shoe shop owner's son remembers selling her a pair of boots.</p>
      <p><strong>October 30 – November 5, 1970</strong> — She is in Bergen, staying at a hotel under a false name. Her movements coincide with top-secret Penguin missile trials along the Norwegian coast.</p>
      <p><strong>November 1970</strong> — She moves between Norwegian hotels, using at least eight different aliases: Fenella Lorch, Claudia Tielt, Genevieve Lancier, Vera Jarle, Elisabeth Leenhouwfr, Claudia Nielsen, and Alexia Zarne-Merchez, among others. She always claims Belgian nationality.</p>
      <p><strong>November 23, 1970</strong> — She checks out of Hotel Hordaheimen in Bergen, room 407. She is not seen alive again by any identified witness.</p>
      <p><strong>November 29, 1970</strong> — A man and his two daughters discover a charred body on a scree slope in Isdalen, a remote valley on Ulriken's north face. The body is badly burned. All clothing labels have been removed. A watch, jewellery, and empty bottles are arranged around the body.</p>
      <p><strong>December 2, 1970</strong> — Two suitcases are found at Bergen railway station. Contents include wigs, currency from five countries, non-prescription glasses, eczema cream (name scratched off), maps, and a notepad with coded entries.</p>
      <p><strong>December 1970</strong> — A classified military document notes that the woman's movements correspond to Penguin missile trial locations and dates. The Norwegian Intelligence Service conducts a parallel investigation.</p>
      <p><strong>December 21, 1970</strong> — Bergen police declare the death a suicide.</p>
      <p><strong>February 5, 1971</strong> — The Isdal Woman is buried in Møllendal cemetery, Bergen, in a zinc coffin. Only police attend. Catholic rites are used based on the saint names in her aliases.</p>
      <p><strong>2005</strong> — Norwegian author Dennis Zacher Aske publishes <em>Kvinnen i Isdalen</em>, proposing the woman was a sex worker catering to military clients.</p>
      <p><strong>2016</strong> — NRK journalists persuade Norwegian police to reopen the case using modern forensic techniques. The preserved jawbone is submitted for isotope and DNA analysis.</p>
      <p><strong>2017</strong> — Stable isotope analysis indicates the woman was born around 1930 near Nuremberg, Germany, and moved to the Franco-German border as a child. Dental work is consistent with Central or Southern European practice.</p>
      <p><strong>2018</strong> — NRK and BBC World Service launch the podcast <em>Death in Ice Valley</em>, reaching millions of listeners worldwide. DNA analysis reveals mitochondrial haplogroup H24, tracing matrilineal descent to Southeast Europe or Southwest Asia.</p>
      <p><strong>2019</strong> — A man from Forbach, France, claims a brief relationship with a woman matching the description in summer 1970. He describes her Balkan accent, international phone calls, and possession of wigs and disguises.</p>
      <p><strong>Present</strong> — The Isdal Woman remains unidentified. The case is officially active. The Interpol notice is current. Her zinc coffin lies in Møllendal cemetery, Bergen.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources, police records, and investigative journalism; scene detail and interior perspectives are imaginatively reconstructed to bring the story to life.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Aske, Dennis Zacher — <em>Kvinnen i Isdalen</em>, Vigmostad & Bjørke, 2005</p>
      <p>NRK & BBC World Service — <em>Death in Ice Valley</em> (podcast), 2018</p>
      <p>Hansen, Staal — NRK Dokumentar: <em>The Isdalen Mystery</em>, nrk.no/isdal</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-isdal-valley.jpg'),
        title: 'The Isdal\nWoman',
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
