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
  title: 'Operation Paperclip',
  subtitle: 'The Nazi Scientists Who Built the American Dream',
  author: 'HistorIQly',
  series: 'Vol. 7: Declassified',
  slug: 'operation-paperclip',
  description:
    'In 1945, the United States secretly recruited more than 1,600 Nazi scientists — including men who had built weapons with slave labour — to win the Cold War and land on the Moon. This is the true story of the deal that traded justice for the stars.',
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
  heroSurrender: imgFileUrl('hero-von-braun-surrender-1945.jpg'),
  peenemuendeAerial: imgFileUrl('location-peenemuende-aerial-1943.jpg'),
  peenemuendeOfficials: imgFileUrl('atmosphere-peenemuende-officials.jpg'),
  prisonersV2: imgFileUrl('evidence-prisoners-assembling-v2.jpg'),
  mittelwerkTunnel: imgFileUrl('location-mittelwerk-tunnel.jpg'),
  v2Damage: imgFileUrl('evidence-v2-damage-london.jpg'),
  v2Cutaway: imgFileUrl('evidence-v2-cutaway-diagram.jpg'),
  fortBlissTeam: imgFileUrl('evidence-paperclip-team-fort-bliss.jpg'),
  truman: imgFileUrl('figure-president-truman-1945.jpg'),
  einstein: imgFileUrl('evidence-einstein-protest-telegram.jpg'),
  v2WhiteSands: imgFileUrl('evidence-v2-launch-white-sands.jpg'),
  vonBraunFortBliss: imgFileUrl('atmosphere-von-braun-fort-bliss.jpg'),
  sputnik: imgFileUrl('atmosphere-sputnik-nasm.jpg'),
  explorer1: imgFileUrl('evidence-explorer-1-celebration.jpg'),
  explorer1Launch: imgFileUrl('evidence-explorer-1-launch.jpg'),
  vonBraunSaturnV: imgFileUrl('figure-von-braun-saturn-v-engines.jpg'),
  saturnVCutaway: imgFileUrl('evidence-saturn-v-cutaway.jpg'),
  apollo11Launch: imgFileUrl('atmosphere-apollo-11-launch.jpg'),
  citizenship: imgFileUrl('evidence-citizenship-ceremony-1954.jpg'),
  doraTrial: imgFileUrl('evidence-dora-trial-judges.jpg'),
  vonBraunNasa: imgFileUrl('figure-von-braun-nasa-1960.jpg'),
  rudolph: imgFileUrl('figure-arthur-rudolph.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Weapon': [
    figureHtml(
      images.peenemuendeAerial,
      'RAF aerial reconnaissance photograph of Peenemünde, 1943',
      'Peenemünde as seen by RAF reconnaissance cameras, 1943. The remote Baltic research station was home to the V-2 programme — and the target of Operation Hydra, the bombing raid that drove production underground.'
    ),
    figureHtml(
      images.v2Cutaway,
      'Cutaway diagram of the V-2 rocket',
      'The V-2 in cross-section. Standing forty-six feet tall and weighing nearly thirteen tons, it was the most advanced piece of technology on earth in 1944.'
    ),
  ].join(''),
  'The Price': [
    figureHtml(
      images.prisonersV2,
      'Prisoners assembling V-2 rockets at the Mittelwerk underground factory',
      'Concentration camp prisoners assembling V-2 rockets inside the Mittelwerk. At least 20,000 prisoners died in the Mittelbau-Dora camp system — more than were killed by the V-2 in combat.'
    ),
    figureHtml(
      images.mittelwerkTunnel,
      'Entrance to the Mittelwerk tunnel complex at Nordhausen',
      'The entrance to the Mittelwerk tunnels beneath the Kohnstein mountain. The underground factory stretched for more than a mile, with forty-six cross-tunnels connecting two main shafts.'
    ),
  ].join(''),
  'The Surrender': figureHtml(
    images.heroSurrender,
    'Wernher von Braun surrenders to U.S. forces, May 1945',
    'Wernher von Braun (arm in cast) surrenders to American forces in Bavaria, May 1945. His broken arm was the result of a car accident during the chaotic final weeks of the war.'
  ),
  'The Race': figureHtml(
    images.fortBlissTeam,
    '104 German rocket scientists at Fort Bliss, Texas, 1946',
    'The Paperclip team: 104 German rocket scientists photographed at Fort Bliss, Texas, 1946. Von Braun is in the front row, seventh from the right.'
  ),
  'The Deal': [
    figureHtml(
      images.truman,
      'President Harry S. Truman, 1945',
      'President Harry S. Truman signed the directive authorising Paperclip with one condition: no "active supporters of Nazi militarism." The JIOA simply rewrote the dossiers to make the scientists fit.'
    ),
    figureHtml(
      images.einstein,
      'Albert Einstein\'s telegram to President Truman protesting Operation Paperclip, 1946',
      'Einstein\'s protest to Truman: "These men are fascists and potential war criminals." The letter was forwarded to the State Department, which forwarded it to the JIOA, which filed it.'
    ),
  ].join(''),
  'The Desert': [
    figureHtml(
      images.v2WhiteSands,
      'V-2 rocket launch at White Sands Proving Ground, 1948',
      'A V-2 lifts off from White Sands Proving Ground, New Mexico. Between 1946 and 1952, sixty-seven V-2s were launched from White Sands — the beginning of the American space programme.'
    ),
    figureHtml(
      images.sputnik,
      'Sputnik replica at the National Air and Space Museum',
      'A replica of Sputnik, the Soviet satellite that changed everything. Its beeping signal, audible on ham radios across America, transformed the Paperclip scientists from an embarrassment into a national priority.'
    ),
  ].join(''),
  'The Payoff': [
    figureHtml(
      images.explorer1,
      'Pickering, Van Allen, and Von Braun celebrate the successful launch of Explorer 1, January 1958',
      'The photograph that made a hero: William Pickering, James Van Allen, and Wernher von Braun hold a model of Explorer 1 aloft after its successful launch, January 31, 1958.'
    ),
    figureHtml(
      images.vonBraunSaturnV,
      'Wernher von Braun standing by the Saturn V F-1 engines',
      'Von Braun with the F-1 engines of the Saturn V — the largest, most powerful rocket ever built. It stood 363 feet tall and generated 7.5 million pounds of thrust.'
    ),
    figureHtml(
      images.apollo11Launch,
      'Saturn V rocket launching Apollo 11, July 16, 1969',
      'Saturn V AS-506 lifts off from Pad 39A carrying Apollo 11, July 16, 1969. Four days later, Neil Armstrong would step onto the Moon.'
    ),
  ].join(''),
  'The Reckoning': [
    figureHtml(
      images.doraTrial,
      'Judges at the Dora war crimes trial, 1947',
      'The Dora trial, 1947: a U.S. military tribunal tried nineteen defendants for crimes at Mittelbau-Dora. The Paperclip scientists were not among them.'
    ),
    figureHtml(
      images.citizenship,
      'Paperclip scientists at U.S. citizenship ceremony, 1954',
      'Thirty-nine Paperclip scientists take the oath of U.S. citizenship, 1954. Their dossiers had been sanitised, their Nazi affiliations minimised or erased.'
    ),
  ].join(''),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/operation-paperclip.ts');
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
  <p class="epigraph">"The V-2 rocket worked perfectly, except for landing on the wrong planet."</p>
  <p class="epigraph-attr">— Wernher von Braun (attributed)</p>
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
      <p><strong>1912</strong> — Wernher von Braun is born in Wirsitz, Province of Posen, German Empire (now Wyrzysk, Poland).</p>
      <p><strong>1932</strong> — Von Braun, aged 20, begins working for the German Army's rocket programme under Captain Walter Dornberger. The research station at Kummersdorf, south of Berlin, becomes Germany's first military rocket facility.</p>
      <p><strong>1937</strong> — The rocket programme relocates to Peenemünde on the Baltic coast. Von Braun joins the Nazi Party. Development of the A-4 rocket (later designated V-2) begins in earnest.</p>
      <p><strong>1940</strong> — Von Braun accepts a commission in the SS at the rank of Untersturmführer (second lieutenant), later promoted to Sturmbannführer (major).</p>
      <p><strong>October 3, 1942</strong> — The first successful A-4 test launch reaches an altitude of 85 km, becoming the first man-made object to cross the boundary of space. Dornberger declares: "Today the spaceship was born."</p>
      <p><strong>August 17–18, 1943</strong> — Operation Hydra: The RAF bombs Peenemünde, killing 735 people and setting the programme back months. Hitler orders V-2 production moved underground.</p>
      <p><strong>Autumn 1943</strong> — Construction of the Mittelwerk underground factory begins beneath the Kohnstein mountain near Nordhausen. Prisoners from Concentration Camp Dora provide the slave labour. Conditions during the tunnelling phase are catastrophic.</p>
      <p><strong>September 8, 1944</strong> — The first V-2 strikes London, killing three people in Chiswick. Over the next seven months, more than 3,000 V-2s will be launched against Allied targets.</p>
      <p><strong>January 1945</strong> — Peenemünde is evacuated as Soviet forces advance. Von Braun orders 14 tons of documents hidden in a mine shaft in the Harz Mountains.</p>
      <p><strong>April 11, 1945</strong> — U.S. forces liberate the Dora-Mittelbau concentration camp. The horrors of the slave labour programme are documented for the first time.</p>
      <p><strong>May 2, 1945</strong> — Magnus von Braun surrenders to the U.S. 44th Infantry Division in Bavaria. Wernher and approximately 500 engineers follow.</p>
      <p><strong>June 1945</strong> — U.S. forces strip the Mittelwerk of enough V-2 components to build 100 rockets. The parts are shipped west on 300 railway cars before the Soviets arrive.</p>
      <p><strong>September 1945</strong> — Operation Overcast is renamed Operation Paperclip. The first 118 German scientists arrive at Fort Bliss, Texas.</p>
      <p><strong>September 3, 1946</strong> — President Truman signs the classified directive authorising Paperclip, with the condition that "active supporters of Nazi militarism" be excluded. The JIOA begins systematically falsifying dossiers.</p>
      <p><strong>1946–1952</strong> — 67 V-2 rockets are launched from White Sands Proving Ground, New Mexico. The launches mark the beginning of the American space programme.</p>
      <p><strong>1950</strong> — Von Braun's team is transferred to the Redstone Arsenal in Huntsville, Alabama, to develop the Army's first ballistic missile.</p>
      <p><strong>November 11, 1954</strong> — 39 Paperclip scientists take the oath of U.S. citizenship in a ceremony at Huntsville.</p>
      <p><strong>October 4, 1957</strong> — The Soviet Union launches Sputnik. The "Sputnik crisis" transforms the Paperclip scientists from an embarrassment into a national priority.</p>
      <p><strong>January 31, 1958</strong> — Explorer 1, launched on a Jupiter-C rocket designed by von Braun's team, becomes the first American satellite in orbit.</p>
      <p><strong>1960</strong> — Von Braun is named director of NASA's Marshall Space Flight Center. He begins work on the Saturn V.</p>
      <p><strong>July 16, 1969</strong> — Saturn V AS-506 launches Apollo 11 from Kennedy Space Center. Neil Armstrong walks on the Moon four days later.</p>
      <p><strong>June 16, 1977</strong> — Wernher von Braun dies of pancreatic cancer in Alexandria, Virginia, aged 65.</p>
      <p><strong>1984</strong> — Arthur Rudolph, Saturn V project manager, renounces his U.S. citizenship and leaves the country after a Justice Department investigation into his role at the Mittelwerk.</p>
      <p><strong>2013</strong> — The Hubertus Strughold Award for aerospace medicine is renamed after revelations about Strughold's wartime connections to human experimentation at Dachau.</p>
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
      <p>Jacobsen, Annie — <em>Operation Paperclip: The Secret Intelligence Program That Brought Nazi Scientists to America</em>, Little, Brown, 2014</p>
      <p>Hunt, Linda — <em>Secret Agenda: The United States Government, Nazi Scientists, and Project Paperclip, 1945 to 1990</em>, St. Martin's Press, 1991</p>
      <p>Neufeld, Michael J. — <em>Von Braun: Dreamer of Space, Engineer of War</em>, Knopf, 2007</p>
      <p>Piszkiewicz, Dennis — <em>The Nazi Rocketeers: Dreams of Space and Crimes of War</em>, Praeger, 1995</p>
      <p>Bower, Tom — <em>The Paperclip Conspiracy: The Hunt for the Nazi Scientists</em>, Little, Brown, 1987</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-von-braun-surrender-1945.jpg'),
        title: 'Operation\nPaperclip',
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
