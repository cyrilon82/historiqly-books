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
  title: 'The Cleveland Torso Murders',
  subtitle: 'The Mad Butcher of Kingsbury Run',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'cleveland-torso-murders',
  description:
    'Between 1934 and 1938, a serial killer dismembered at least twelve victims in the ravines of Depression-era Cleveland. Eliot Ness — the man who took down Al Capone — led the investigation. He never caught the killer. This is the full story of America\'s forgotten serial murder case.',
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
  hero: imgFileUrl('hero-kingsbury-run-murders.jpg'),
  investigation: imgFileUrl('evidence-kingsbury-run-investigation-1936.jpg'),
  deathMask: imgFileUrl('evidence-torso-murder-death-mask.jpg'),
  report: imgFileUrl('evidence-torso-murder-report.jpg'),
  ness: imgFileUrl('figure-eliot-ness.jpg'),
  bridge: imgFileUrl('atmosphere-kingsbury-run-bridge-1886.jpg'),
  hooverville: imgFileUrl('atmosphere-hooverville-1936.jpg'),
  poster: imgFileUrl('evidence-torso-murder-poster.jpg'),
  deathMaskDisplay: imgFileUrl('evidence-death-mask-display.jpg'),
  victims: imgFileUrl('evidence-torso-murder-victims.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Jackass Hill': figureHtml(
    images.hero,
    'Kingsbury Run murder scene, Cleveland, 1930s',
    'Kingsbury Run — the ravine where the first bodies were discovered on September 23, 1935. Two teenage boys stumbled upon the decapitated remains of Edward Andrassy and an unidentified man at the base of Jackass Hill.'
  ),
  'The Run': figureHtml(
    images.bridge,
    'Kingsbury Run Bridge, circa 1886',
    'A bridge spanning Kingsbury Run in the late 19th century. The ravine — up to 80 feet deep — became home to sprawling shantytowns during the Great Depression, and the hunting ground of the Mad Butcher.'
  ),
  "The Butcher's Work": figureHtml(
    images.deathMask,
    'Death mask of the Tattooed Man, Cleveland Torso Murders',
    'The plaster death mask of the "Tattooed Man" — the fourth victim, found in June 1936. Displayed at the Great Lakes Exposition, it was viewed by over 100,000 people. No one recognised him. He remains unidentified.'
  ),
  'The Untouchable': figureHtml(
    images.ness,
    'Eliot Ness, Cleveland Safety Director',
    'Eliot Ness — famous for leading the Untouchables against Al Capone — was appointed Cleveland\'s Safety Director in 1935. The Torso case became his greatest failure and destroyed his reputation.'
  ),
  'The Torso Clinic': figureHtml(
    images.investigation,
    'Kingsbury Run investigation, September 1936',
    'Investigators at a Kingsbury Run crime scene, September 1936. The case prompted the "Torso Clinic" — an early attempt at criminal profiling, decades before the FBI\'s Behavioral Science Unit.'
  ),
  'Prove It': figureHtml(
    images.report,
    'Cleveland Torso Murder police report',
    'A police report from the Torso murder investigation. Despite interviewing over 10,000 suspects and the prime suspect failing two polygraph tests, no one was ever charged.'
  ),
  'The Burning': figureHtml(
    images.hooverville,
    'A Depression-era shantytown, 1936',
    'A Hooverville shantytown during the Great Depression. On August 18, 1938, Ness led a midnight raid on the Kingsbury Run camps, evicting 300 squatters and burning approximately 100 shanties — an act widely condemned as cruel and desperate.'
  ),
  'The Postcards': figureHtml(
    images.poster,
    'Cleveland Torso Murder exhibit poster',
    'A poster from an exhibit on the Cleveland Torso Murders. The case was never officially solved. In 2024, DNA testing began on the unidentified victims — an attempt, after nearly 90 years, to give the nameless their names.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/cleveland-torso-murders.ts');
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
  <p class="epigraph">"Prove it."</p>
  <p class="epigraph-attr">— Dr. Francis Sweeney to Eliot Ness, May 1938</p>
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
      <p><strong>September 5, 1934</strong> — The "Lady of the Lake": the lower half of a woman's torso washes ashore on Lake Erie near Bratenahl. Skin has been chemically treated. She is never identified. Later retroactively considered the first victim.</p>
      <p><strong>September 23, 1935</strong> — Two teenage boys discover the decapitated bodies of Edward Andrassy (age 28) and an unidentified man on Jackass Hill in Kingsbury Run. Both have been drained of blood. Andrassy is identified via fingerprints.</p>
      <p><strong>January 26, 1936</strong> — Remains of Florence "Flo" Polillo, 42, are found in bushel baskets behind a building at East 20th Street. Her head is never recovered. She is identified through fingerprints — the third and last victim to be positively identified.</p>
      <p><strong>June 5, 1936</strong> — The "Tattooed Man" is discovered in Kingsbury Run. A death mask is created and displayed at the Great Lakes Exposition; over 100,000 view it. He is never identified.</p>
      <p><strong>September 10, 1936</strong> — The sixth victim is found in a stagnant pool near East 37th Street. The case goes national. Newspapers dub the killer "The Mad Butcher of Kingsbury Run." Mayor Burton makes the case Eliot Ness's top priority.</p>
      <p><strong>December 1935</strong> — Eliot Ness is appointed Cleveland Safety Director by Mayor Harold Burton. He assigns a 20-detective unit to the Torso case full-time.</p>
      <p><strong>February – July 1937</strong> — Three more victims are found: an unidentified woman on the Lake Erie shore, the skeletal remains of Rose Wallace under the Lorain-Carnegie Bridge, and a man's gutted torso in the Cuyahoga River.</p>
      <p><strong>May 1938</strong> — Dr. Francis Sweeney is secretly interrogated at the Cleveland Hotel. Polygraph inventor Leonard Keeler administers two lie-detector tests. Sweeney fails both. "That's your man," Keeler tells Ness. Sweeney responds: "Prove it." He is released.</p>
      <p><strong>August 16, 1938</strong> — The final two victims are found at the East 9th Street lakefront dump — within sight of Ness's office at City Hall.</p>
      <p><strong>August 18, 1938</strong> — Ness leads a midnight raid on the Kingsbury Run shantytowns. Approximately 300 squatters are evicted, 63 arrested for vagrancy, and 100 shanties are burned. The murders stop.</p>
      <p><strong>July 5, 1939</strong> — Frank Dolezal, a bricklayer who once lived with Flo Polillo, is arrested and confesses. He retracts immediately, claiming the confession was beaten out of him.</p>
      <p><strong>August 24, 1939</strong> — Dolezal is found dead in his jail cell, officially ruled a suicide. The circumstances — a hook barely taller than the man, broken ribs, extensive bruising — suggest he was murdered in custody. He is posthumously exonerated.</p>
      <p><strong>1950s–1957</strong> — Sweeney sends taunting postcards to Ness, signed "F.E. Sweeney, paranoidal nemesis."</p>
      <p><strong>May 16, 1957</strong> — Eliot Ness dies of a heart attack at age 54, nearly penniless, in Coudersport, Pennsylvania. <em>The Untouchables</em> is published weeks later, making him famous posthumously.</p>
      <p><strong>July 9, 1964</strong> — Dr. Francis Sweeney dies in a veterans' hospital, age 70. He was never charged.</p>
      <p><strong>2024</strong> — The Cuyahoga County Medical Examiner partners with the DNA Doe Project to exhume and identify unidentified victims through genetic genealogy.</p>
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
      <p>Badal, James Jessen — <em>In the Wake of the Butcher: Cleveland's Torso Murders</em>, Kent State University Press, 2001 (revised edition 2013)</p>
      <p>Nickel, Steven — <em>Torso: The Story of Eliot Ness and the Search for a Psychopathic Killer</em>, Avon Books, 1989</p>
      <p>Bendis, Brian Michael & Andreyko, Marc — <em>Torso</em> (graphic novel), Image Comics, 2001</p>
      <p>Badal, James Jessen — <em>Hell's Wasteland: The Pennsylvania Torso Murders</em>, Kent State University Press, 2012</p>
      <p>Encyclopedia of Cleveland History — "Torso Murders," Case Western Reserve University</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-kingsbury-run-murders.jpg'),
        title: 'The Cleveland\nTorso Murders',
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
