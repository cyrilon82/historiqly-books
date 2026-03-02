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
  title: 'The Cottingley Fairies',
  subtitle: 'Two Girls, Five Photographs, and a Nation That Wanted to Believe',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'cottingley-fairies',
  description:
    'In 1917, two Yorkshire girls borrowed a camera and returned with five photographs of fairies. Arthur Conan Doyle declared them an epoch-making event. The world believed. This is the true story of a childhood prank, a grieving nation, and the sixty-year secret that fooled everyone — including the creator of Sherlock Holmes.',
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
  hero: imgFileUrl('hero-cottingley-fairies-1.jpg'),
  elsieGnome: imgFileUrl('cottingley-fairies-elsie-gnome.jpg'),
  francesLeaping: imgFileUrl('cottingley-fairies-frances-leaping.jpg'),
  elsieHarebells: imgFileUrl('cottingley-fairies-elsie-harebells.jpg'),
  girlsTogether: imgFileUrl('cottingley-frances-elsie-together.jpg'),
  doyle: imgFileUrl('suspect-arthur-conan-doyle.jpg'),
  gardner: imgFileUrl('suspect-edward-gardner.jpg'),
  strand: imgFileUrl('cottingley-strand-magazine-1920.jpg'),
  beck: imgFileUrl('cottingley-beck.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Two Girls and a Beck': figureHtml(
    images.hero,
    'Frances Griffiths with dancing fairies, Cottingley Beck, July 1917',
    'The first Cottingley photograph, taken July 1917 by Elsie Wright. Frances Griffiths stands behind the vegetation at the beck\'s edge while four winged fairy figures appear to dance in the foreground. This is the most famous of the five photographs.'
  ),
  'Paper Wings': figureHtml(
    images.elsieGnome,
    'Elsie Wright with a gnome-like fairy figure, September 1917',
    'The second Cottingley photograph, taken September 1917 by Frances Griffiths. Elsie Wright extends her hand toward a single gnome-like figure wearing black tights and a bright red cap, caught mid-leap. The figure was a cardboard cutout supported by a hatpin.'
  ),
  'The Man Who Needed to Believe': figureHtml(
    images.doyle,
    'Sir Arthur Conan Doyle, photograph by Herbert Rose Barraud, 1893',
    'Arthur Conan Doyle, creator of Sherlock Holmes, in 1893. By 1920 he was one of the most celebrated authors in the English-speaking world — and one of the most devoted believers in the Cottingley photographs. His Strand Magazine article of December 1920 declared the photographs "an epoch-making event."'
  ),
  "The Expert's Opinion": figureHtml(
    images.francesLeaping,
    'Frances Griffiths with a leaping fairy, August 1920',
    'The third Cottingley photograph, taken August 1920 by Elsie Wright using one of the Cameo cameras provided by Edward Gardner. The fairy figures in the 1920 series are more elaborate than those in the 1917 photographs, reflecting Elsie\'s three additional years of artistic practice.'
  ),
  'An Epoch-Making Event': figureHtml(
    images.strand,
    'Page 463 of The Strand Magazine, December 1920',
    'The page from The Strand Magazine\'s Christmas 1920 issue in which Arthur Conan Doyle published his article "Fairies Photographed: An Epoch-Making Event." The issue sold out within days of publication.'
  ),
  'The Long Silence': figureHtml(
    images.elsieHarebells,
    'Elsie Wright receiving harebells from a fairy, August 1920',
    'The fourth Cottingley photograph, August 1920. A fairy offers Elsie Wright a posy of harebells — the wildflowers common on the banks of Yorkshire streams. Frances Griffiths and Elsie Wright produced this photograph using one of the Cameo cameras provided by Edward Gardner and Arthur Conan Doyle.'
  ),
  'That Astonishing Affair': figureHtml(
    images.gardner,
    'Edward Lewis Gardner, Theosophical Society',
    'Edward Lewis Gardner (1869–1969), the Theosophical Society lecturer who championed the Cottingley photographs from 1919 onward. Gardner lived exactly one century and never renounced his belief in the photographs\' authenticity. He supplied the girls with cameras and marked plates for the 1920 session.'
  ),
  'The Fairy Bower': figureHtml(
    images.girlsTogether,
    'Frances Griffiths and Elsie Wright at Cottingley Beck',
    'Frances Griffiths and Elsie Wright, the two girls at the centre of the Cottingley affair. The photograph was taken at or near Cottingley Beck. The cameras they used — along with Elsie\'s written confession and the original prints of all five photographs — are now held at the National Science and Media Museum in Bradford.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/cottingley-fairies.ts');
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
  <p class="epigraph">"People often say to me, 'Don't you feel ashamed that you have made all these poor people look like fools?' But I do not, because they wanted to believe."</p>
  <p class="epigraph-attr">— Frances Griffiths, 1983</p>
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
      <p><strong>July 1917</strong> — Elsie Wright (16) borrows her father Arthur Wright's quarter-plate Midg camera. She and Frances Griffiths (9) photograph cardboard fairy cutouts at Cottingley Beck. Arthur Wright develops the plate, suspects paper cutouts, and refuses to lend the camera again.</p>
      <p><strong>September 1917</strong> — The girls borrow the camera again and produce a second photograph: Elsie with a gnome-like figure. Arthur Wright develops it, repeats his suspicion, and puts both photographs away.</p>
      <p><strong>Summer 1919</strong> — Polly Wright mentions the photographs at a Bradford Theosophical Society meeting. The photographs are displayed at the Society's annual conference in Harrogate. Edward Gardner acquires the negatives.</p>
      <p><strong>Early 1920</strong> — Gardner sends the negatives to photographic expert Harold Snelling, who declares them genuine single-exposure photographs. Snelling simultaneously retouches the negatives to improve image quality for publication — a fatal dual commission.</p>
      <p><strong>May 1920</strong> — Gardner begins using lantern slides of the photographs in public lectures in London. Arthur Conan Doyle learns of the photographs through the spiritualist journal <em>Light</em>. He has been commissioned by <em>The Strand Magazine</em> to write a Christmas article on fairies.</p>
      <p><strong>June–July 1920</strong> — Doyle and Gardner send Snelling's enhanced reprints to Kodak. Kodak finds no evidence of manipulation but refuses to certify authenticity. Gardner visits Cottingley, meets the girls, and provides them with two Cameo cameras and 24 secretly marked glass plates.</p>
      <p><strong>August 1920</strong> — Elsie and Frances produce three more photographs. They return 17 of the 24 plates unused. The fifth photograph — the most ambiguous of the series — shows indistinct forms in tall grass, with neither girl present.</p>
      <p><strong>December 1920</strong> — Doyle's article "Fairies Photographed: An Epoch-Making Event" appears in <em>The Strand Magazine</em>. The issue sells out within days. A second article with the 1920 photographs follows in March 1921.</p>
      <p><strong>August 1921</strong> — Gardner returns to Cottingley with Theosophical clairvoyant Geoffrey Hodson. No new photographs are produced. The girls later say they "played along with Hodson out of mischief" and considered him a fake.</p>
      <p><strong>1 September 1922</strong> — Conan Doyle publishes <em>The Coming of the Fairies</em>, his full account of the affair.</p>
      <p><strong>1926</strong> — Elsie Wright emigrates to America, later moving to India with her husband Frank Hill.</p>
      <p><strong>1966</strong> — A <em>Daily Express</em> reporter finds Elsie. She suggests the fairies might have been "figments of my imagination" but adds she might have "photographed my thoughts" — neither confirming nor denying the hoax.</p>
      <p><strong>30 June 1969</strong> — Edward Gardner dies aged exactly 100, still convinced the photographs were genuine.</p>
      <p><strong>7 September 1976</strong> — Yorkshire Television broadcasts an interview with both Elsie and Frances. Both say "a rational person doesn't see fairies" but neither confirms nor denies fabrication.</p>
      <p><strong>1978</strong> — James Randi identifies the fairy figures in the first photograph as based on Claude Shepperson's illustration in <em>Princess Mary's Gift Book</em> (1914). Computer enhancements suggest supporting threads or hatpins.</p>
      <p><strong>1982–1983</strong> — Geoffrey Crawley, editor of the <em>British Journal of Photography</em>, publishes a ten-part forensic investigation titled "That Astonishing Affair of the Cottingley Fairies."</p>
      <p><strong>September 1981</strong> — Frances Griffiths makes her first private admission of the hoax to researcher Joe Cooper in Canterbury.</p>
      <p><strong>17 February 1983</strong> — Elsie Wright sends a written confession to Crawley admitting all five photographs were fabricated. Frances admits photos 1–4 were faked but maintains that Photo 5 was genuine until her death.</p>
      <p><strong>1986</strong> — Frances Griffiths dies aged 78, still insisting the fifth photograph was real.</p>
      <p><strong>1988</strong> — Elsie Wright dies aged 87.</p>
      <p><strong>October 2018</strong> — Two of the original photographs sell at auction for a combined £20,400 — ten times their pre-sale estimate.</p>
      <p><strong>July 2024</strong> — Researchers at the University of Bradford CT-scan the cameras at seven-micron resolution. No fairies are found.</p>
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
      <p>Cooper, Joe — <em>The Case of the Cottingley Fairies</em>, Simon and Schuster Ltd., London, 1997</p>
      <p>Doyle, Arthur Conan — <em>The Coming of the Fairies</em>, Hodder and Stoughton, London, 1922</p>
      <p>Gardner, Edward L. — <em>Fairies: The Cottingley Photographs and Their Sequel</em>, The Theosophical Publishing House, London, 1945</p>
      <p>Crawley, Geoffrey — "That Astonishing Affair of the Cottingley Fairies," <em>British Journal of Photography</em>, 10-part series, 1982–1983</p>
      <p>Lynch, Christine — <em>Reflections on the Cottingley Fairies: Frances Griffiths in Her Own Words</em>, 2009</p>
      <p>National Science and Media Museum, Bradford — collection includes the original cameras, prints, and correspondence</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-cottingley-fairies-1.jpg'),
        title: 'The Cottingley\nFairies',
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
