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
  title: 'The Zodiac Killer',
  subtitle: 'The Cipher, the Letters, and the Hunt for America\'s Most Elusive Serial Killer',
  author: 'HistorIQly',
  series: 'Vol. 3: Cold Cases',
  slug: 'zodiac-killer',
  description:
    'Between 1968 and 1969, a masked killer terrorised Northern California — shooting couples on lovers\' lanes, stabbing picnickers by a lake, and executing a cab driver in San Francisco. He sent taunting letters and unsolvable ciphers to newspapers, called himself the Zodiac, and vanished. More than fifty years later, his identity remains unknown.',
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
  wantedPoster: imgFileUrl('zodiac-wanted-poster-1969.png'),
  policeSketch: imgFileUrl('hero-zodiac-police-sketch.jpg'),
  cipher408: imgFileUrl('zodiac-cipher-408-chronicle.jpg'),
  cipher340: imgFileUrl('zodiac-cipher-340-dripping-pen.jpg'),
  schoolbus: imgFileUrl('zodiac-letter-schoolbus-1969.jpg'),
  crimeScene: imgFileUrl('zodiac-crime-scene-paul-stine.jpg'),
  toschi: imgFileUrl('investigator-dave-toschi.jpg'),
  allen: imgFileUrl('suspect-arthur-leigh-allen.jpg'),
  letterMap: imgFileUrl('zodiac-letter-map-cipher-1970.jpg'),
  berryessa: imgFileUrl('location-lake-berryessa.jpg'),
  halloween: imgFileUrl('zodiac-halloween-card-1970.jpg'),
  victims: imgFileUrl('victims-faraday-jensen-1968.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Lovers\' Lane': figureHtml(
    images.victims,
    'David Faraday and Betty Lou Jensen, 1968',
    'David Faraday and Betty Lou Jensen — the first confirmed victims of the Zodiac Killer. They were shot on Lake Herman Road, Solano County, on December 20, 1968. Faraday was 17, Jensen was 16.'
  ),
  'Fourth of July': figureHtml(
    images.policeSketch,
    'SFPD composite sketch of the Zodiac Killer',
    'The SFPD composite sketch, based on witness descriptions from the Paul Stine murder. The Blue Rock Springs attack on July 4, 1969, produced the first physical description of the Zodiac — a stocky white male, approximately five-foot-eight, 195–200 pounds.'
  ),
  'This Is the Zodiac Speaking': figureHtml(
    images.cipher408,
    'The Z408 cipher as published in the San Francisco Chronicle, July 1969',
    'One of three sections of the Z408 cipher, as published in the San Francisco Chronicle on August 1, 1969. The full 408-character cipher was cracked within a week by schoolteacher Donald Harden and his wife Bettye.'
  ),
  'The Man in the Hood': figureHtml(
    images.berryessa,
    'Lake Berryessa, California',
    'Lake Berryessa, in the hills east of Napa. On September 27, 1969, the Zodiac appeared in a homemade executioner\'s hood bearing his crossed-circle symbol and attacked Bryan Hartnell and Cecelia Shepard with a knife.'
  ),
  'Cab Ride': figureHtml(
    images.crimeScene,
    'Crime scene at Washington and Cherry Streets, Presidio Heights, October 11, 1969',
    'The Presidio Heights crime scene where cab driver Paul Stine was shot on October 11, 1969. Three teenagers witnessed the Zodiac leaning into the cab from a window across the street.'
  ),
  'The Investigators': figureHtml(
    images.allen,
    'Arthur Leigh Allen\'s 1967 California driver\'s license',
    'Arthur Leigh Allen — the most investigated Zodiac suspect. The circumstantial evidence was overwhelming: Wing Walker boots, a Zodiac-brand watch, suspicious statements to friends. But his fingerprints, handwriting, and DNA did not match. He died in 1992, never charged.'
  ),
  'Codes and Letters': figureHtml(
    images.cipher340,
    'The Z340 cipher, sent to the San Francisco Chronicle on November 8, 1969',
    'The Z340 cipher — 340 characters that resisted codebreakers for 51 years. In December 2020, David Oranchak, Sam Blake, and Jarl Van Eycke finally cracked it using a combination of homophonic substitution and complex three-section transposition analysis.'
  ),
  'Unmasked?': figureHtml(
    images.toschi,
    'Inspector Dave Toschi at the Hall of Justice, San Francisco, 1976',
    'SFPD Inspector Dave Toschi, the lead investigator on the Zodiac case and the inspiration for Clint Eastwood\'s "Dirty Harry." He pursued the Zodiac for nearly a decade. Photo: Nancy Wong, 1976.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/zodiac-killer.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'([^']*(?:\\.[^']*)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
const chapters = [];
let match;
while ((match = chapterRegex.exec(raw)) !== null) {
  const title = (match[2] || match[3]).replace(/\\'/g, "'");
  chapters.push({
    num: match[1],
    title,
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
  <p class="epigraph">"I like killing people because it is so much fun."</p>
  <p class="epigraph-attr">— The Zodiac Killer, decoded Z408 cipher, August 1969</p>
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
      <p><strong>October 30, 1966</strong> — Cheri Jo Bates, 18, is murdered in a parking lot at Riverside City College, California. A "Confession" letter follows. The Zodiac connection remains disputed.</p>
      <p><strong>December 20, 1968</strong> — Betty Lou Jensen, 16, and David Faraday, 17, are shot on Lake Herman Road near Benicia, Solano County. Jensen is killed instantly; Faraday dies at the hospital. No suspects.</p>
      <p><strong>July 4–5, 1969</strong> — Darlene Ferrin, 22, is killed and Michael Mageau, 19, is wounded at Blue Rock Springs Park, Vallejo. The shooter calls the Vallejo Police Department 35 minutes later: "I also killed those kids last year."</p>
      <p><strong>July 31, 1969</strong> — Three letters containing the Z408 cipher are mailed to the <em>San Francisco Chronicle</em>, <em>San Francisco Examiner</em>, and <em>Vallejo Times-Herald</em>. The killer demands front-page publication.</p>
      <p><strong>August 7, 1969</strong> — A letter to the <em>Examiner</em> opens: "Dear Editor — This is the Zodiac speaking." The killer names himself for the first time.</p>
      <p><strong>August 8, 1969</strong> — Schoolteacher Donald Harden and his wife Bettye crack the Z408 cipher. The decoded message describes killing as "so much fun" and fantasises about collecting "slaves" in the afterlife.</p>
      <p><strong>September 27, 1969</strong> — Bryan Hartnell, 20, is stabbed and Cecelia Shepard, 22, is mortally wounded at Lake Berryessa. The attacker wears a homemade executioner's hood with the Zodiac's crossed-circle symbol. Shepard dies two days later.</p>
      <p><strong>October 11, 1969</strong> — Cab driver Paul Stine, 29, is shot in Presidio Heights, San Francisco. SFPD officers encounter the Zodiac on foot but do not stop him due to a dispatch error describing the suspect as a Black male.</p>
      <p><strong>October 13, 1969</strong> — Letter to the <em>Chronicle</em> with a piece of Stine's bloodstained shirt. The Zodiac threatens to "wipe out a school bus some morning."</p>
      <p><strong>November 8, 1969</strong> — The Z340 cipher is mailed to the <em>Chronicle</em>. It will remain unsolved for 51 years.</p>
      <p><strong>October 27, 1970</strong> — Halloween card sent to reporter Paul Avery: "FROM YOUR SECRET PAL." <em>Chronicle</em> staff begin wearing "I Am Not Paul Avery" buttons.</p>
      <p><strong>1971</strong> — Don Cheney reports Arthur Leigh Allen's suspicious statements to police. Allen becomes the prime suspect.</p>
      <p><strong>July 8, 1974</strong> — The last confirmed Zodiac letter is received. After this, silence.</p>
      <p><strong>1986</strong> — Robert Graysmith publishes <em>Zodiac</em>, pointing to Allen as the likely killer.</p>
      <p><strong>August 26, 1992</strong> — Arthur Leigh Allen dies of a heart attack, never charged.</p>
      <p><strong>2002</strong> — DNA from the Zodiac's letter envelopes is compared to Allen. No match.</p>
      <p><strong>2007</strong> — David Fincher's film <em>Zodiac</em> is released, renewing worldwide interest in the case.</p>
      <p><strong>December 5, 2020</strong> — David Oranchak, Sam Blake, and Jarl Van Eycke crack the Z340 cipher after 51 years. The FBI confirms the solution on December 11. The decoded text does not reveal the killer's identity.</p>
      <p><strong>October 2021</strong> — The "Case Breakers" group names Gary Francis Poste (died 2018) as the Zodiac. FBI and SFPD do not confirm the identification. The case remains open.</p>
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
      <p>Graysmith, Robert — <em>Zodiac</em>, St. Martin's Press, 1986</p>
      <p>Graysmith, Robert — <em>Zodiac Unmasked</em>, Berkley Books, 2002</p>
      <p>Rodelli, Mike — <em>The Hunt for Zodiac</em>, 2020</p>
      <p>Oranchak, David — "Let's Crack Zodiac" (YouTube/website), 2006–present</p>
      <p>FBI — Zodiac Killer case files (partially declassified)</p>
      <p>Voigt, Tom — Zodiackiller.com (primary document repository)</p>
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
        backgroundImage: resolve(IMG_DIR, 'zodiac-wanted-poster-1969.png'),
        title: 'The Zodiac\nKiller',
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
