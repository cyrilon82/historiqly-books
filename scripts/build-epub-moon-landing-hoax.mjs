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
  title: 'The Moon Landing',
  subtitle: 'The Conspiracy That Would Not Die',
  author: 'HistorIQly',
  series: 'Vol. 5: Conspiracy Claims',
  slug: 'moon-landing-hoax',
  description:
    'On July 20, 1969, Neil Armstrong stepped onto the lunar surface. Within a decade, millions believed it never happened. This is the true story of the greatest achievement in human history — and the conspiracy theory that has haunted it ever since.',
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
  hero: imgFileUrl('hero-aldrin-visor-moon.jpg'),
  crew: imgFileUrl('figure-apollo-11-crew.jpg'),
  launch: imgFileUrl('atmosphere-apollo-11-launch.jpg'),
  bootprint: imgFileUrl('evidence-bootprint-lunar-soil.jpg'),
  flag: imgFileUrl('evidence-aldrin-flag-moon.jpg'),
  earthrise: imgFileUrl('atmosphere-earthrise-apollo-8.jpg'),
  lm: imgFileUrl('atmosphere-lunar-module-surface.jpg'),
  retroreflector: imgFileUrl('evidence-laser-retroreflector.jpg'),
  missionControl: imgFileUrl('atmosphere-mission-control-apollo.jpg'),
  nixon: imgFileUrl('figure-nixon-apollo-quarantine.jpg'),
  kubrick: imgFileUrl('suspect-stanley-kubrick.jpg'),
  moonRock: imgFileUrl('evidence-lunar-rock-sample.jpg'),
  lro: imgFileUrl('evidence-lro-apollo11-site.jpg'),
  armstrong: imgFileUrl('figure-neil-armstrong.jpg'),
  aldrin: imgFileUrl('figure-buzz-aldrin.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Eagle': figureHtml(
    images.hero,
    'Buzz Aldrin on the lunar surface, July 20, 1969',
    'Buzz Aldrin on the Sea of Tranquility. In his gold-tinted visor, Neil Armstrong is reflected — a small white figure holding the camera. Behind him, the Lunar Module, the flag, and the Earth.'
  ),
  'The Swindler': figureHtml(
    images.launch,
    'Apollo 11 Saturn V launch, July 16, 1969',
    'The Saturn V rocket carrying Apollo 11 lifts off from Pad 39A at Kennedy Space Center, July 16, 1969. The vehicle stood 363 feet tall and generated 7.5 million pounds of thrust at liftoff — the most powerful machine ever built.'
  ),
  'The Flag': figureHtml(
    images.flag,
    'Buzz Aldrin salutes the U.S. flag on the Moon',
    'Aldrin salutes the flag at Tranquility Base. The flag\'s horizontal support rod did not fully extend, creating the appearance of rippling. In subsequent photos where no one is touching the flag, it hangs perfectly still. There is no wind on the Moon.'
  ),
  'The Radiation': figureHtml(
    images.earthrise,
    'Earthrise from Apollo 8, December 24, 1968',
    'Earthrise. Photographed by Bill Anders during Apollo 8, December 24, 1968 — the first colour photograph of Earth from lunar orbit. The astronauts passed through the Van Allen belts on a carefully calculated trajectory that minimised radiation exposure.'
  ),
  'The Filmmaker': figureHtml(
    images.kubrick,
    'Stanley Kubrick, self-portrait, 1949',
    'Stanley Kubrick. The conspiracy theory claims NASA hired the director of 2001: A Space Odyssey to film the fake moon landings. In 2002, filmmaker Bart Sibrel confronted Buzz Aldrin with this accusation. Aldrin, then 72, punched him in the face.'
  ),
  'The Proof': figureHtml(
    images.retroreflector,
    'Lunar Laser Ranging Retroreflector on the Moon',
    'The Laser Ranging Retroreflector deployed at Tranquility Base during Apollo 11. Observatories worldwide bounce lasers off this array daily, measuring the Earth-Moon distance to within millimetres. It is still there. Someone put it there.'
  ),
  'The Persistence': figureHtml(
    images.missionControl,
    'Mission Control during Apollo 11',
    'Mission Operations Control Room during Apollo 11. The programme employed 400,000 people across 20,000 companies. Not one, in over fifty years, has produced evidence of fraud.'
  ),
  'The Photograph': figureHtml(
    images.lro,
    'Apollo 11 landing site photographed by the Lunar Reconnaissance Orbiter',
    'The Apollo 11 landing site, photographed from orbit by NASA\'s Lunar Reconnaissance Orbiter. The descent stage of the Lunar Module Eagle is visible as a bright dot. The footpaths and experiment locations are faintly visible in the regolith.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/moon-landing-hoax.ts');
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
  <p class="epigraph">"That's one small step for man, one giant leap for mankind."</p>
  <p class="epigraph-attr">— Neil Armstrong, July 20, 1969</p>
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
      <p><strong>1958</strong> — James Van Allen discovers the Van Allen radiation belts using data from Explorer 1. The belts would later become the basis for one of the most persistent conspiracy claims.</p>
      <p><strong>1961 (May 25)</strong> — President John F. Kennedy addresses Congress: "I believe that this nation should commit itself to achieving the goal, before this decade is out, of landing a man on the Moon and returning him safely to the Earth."</p>
      <p><strong>1967 (January 27)</strong> — The Apollo 1 fire kills astronauts Gus Grissom, Ed White, and Roger Chaffee during a launch pad test. The programme is suspended for twenty months.</p>
      <p><strong>1968 (December 21–27)</strong> — Apollo 8 becomes the first crewed spacecraft to orbit the Moon. Bill Anders photographs "Earthrise" — one of the most influential images in history.</p>
      <p><strong>1969 (July 16)</strong> — Apollo 11 launches from Kennedy Space Center atop a Saturn V rocket. Crew: Neil Armstrong (Commander), Buzz Aldrin (Lunar Module Pilot), Michael Collins (Command Module Pilot).</p>
      <p><strong>1969 (July 20)</strong> — The Lunar Module Eagle lands in the Sea of Tranquility at 20:17 UTC. Armstrong steps onto the surface at 02:56 UTC on July 21. Aldrin follows nineteen minutes later. They deploy experiments, collect samples, and plant the flag. Total EVA time: 2 hours 31 minutes.</p>
      <p><strong>1969 (July 24)</strong> — Apollo 11 splashes down safely in the Pacific Ocean. The crew enters quarantine aboard USS Hornet. President Nixon greets them through the window of the Mobile Quarantine Facility.</p>
      <p><strong>1969–1972</strong> — Five more Apollo missions land on the Moon: Apollo 12, 14, 15, 16, and 17. Twelve men walk on the lunar surface. Apollo 13 suffers a catastrophic failure en route but returns safely.</p>
      <p><strong>1972 (December 14)</strong> — Eugene Cernan becomes the last human to walk on the Moon during Apollo 17. The programme ends.</p>
      <p><strong>1976</strong> — Bill Kaysing self-publishes "We Never Went to the Moon: America's Thirty Billion Dollar Swindle." The modern conspiracy theory is born.</p>
      <p><strong>1977</strong> — The film Capricorn One, about a faked Mars landing, is released. It becomes a cultural touchstone for moon landing conspiracy theorists.</p>
      <p><strong>2001 (February 15)</strong> — Fox TV broadcasts "Conspiracy Theory: Did We Really Land on the Moon?" to approximately 15 million viewers. NASA declines to respond officially.</p>
      <p><strong>2002</strong> — Filmmaker Bart Sibrel confronts Buzz Aldrin outside a Beverly Hills hotel, calling him a liar and a coward. Aldrin, then 72, punches Sibrel in the face. No charges are filed.</p>
      <p><strong>2005 (April 21)</strong> — Bill Kaysing dies at age 82 in Henderson, Nevada.</p>
      <p><strong>2009</strong> — NASA's Lunar Reconnaissance Orbiter begins photographing the lunar surface at high resolution, imaging all six Apollo landing sites.</p>
      <p><strong>2011–2012</strong> — LRO images of Apollo landing sites are released, showing descent stages, rover tracks, and astronaut footpaths. Conspiracy theorists reject the images as fabricated.</p>
      <p><strong>2012 (August 25)</strong> — Neil Armstrong dies at age 82 in Cincinnati, Ohio.</p>
      <p><strong>2019</strong> — On the fiftieth anniversary of Apollo 11, a YouGov poll finds that 11% of Americans doubt the landings — rising to 18% among adults aged 18–24. The conspiracy theory is growing, not fading.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a narrative investigation of the moon landing conspiracy theory, grounded in documented history, physics, and primary sources. The Apollo missions are the most extensively documented events in human history; the conspiracy theory is examined as a cultural and psychological phenomenon.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Chaikin, Andrew — <em>A Man on the Moon: The Voyages of the Apollo Astronauts</em>, Viking, 1994</p>
      <p>Plait, Philip — <em>Bad Astronomy: Misconceptions and Misuses Revealed</em>, Wiley, 2002</p>
      <p>Windley, Jay — "Moon Base Clavius" (clavius.org) — comprehensive technical rebuttals</p>
      <p>NASA — "The Great Moon Hoax" (science.nasa.gov), 2001</p>
      <p>Aaronovitch, David — <em>Voodoo Histories: The Role of the Conspiracy Theory in Shaping Modern History</em>, Riverhead, 2010</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-aldrin-visor-moon.jpg'),
        title: 'The Moon\nLanding',
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
