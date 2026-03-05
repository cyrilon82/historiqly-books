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
  title: 'The Knights Templar',
  subtitle: 'The Warrior Monks Who Shook the World',
  author: 'HistorIQly',
  series: 'Vol. 6: Secret Societies',
  slug: 'knights-templar',
  description:
    'From nine penniless knights guarding pilgrims on the roads to Jerusalem to the most powerful military order in Christendom — and then, in a single dawn raid, to prisoners of the French Crown. This is the true story of the Knights Templar: the battles, the banking empire, the heresy trials, and the curse that followed their last Grand Master to the stake.',
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
  hero: imgFileUrl('hero-templars-burning-philip.jpg'),
  molay: imgFileUrl('suspect-jacques-de-molay.jpg'),
  execution: imgFileUrl('templar-molay-execution.jpg'),
  seal: imgFileUrl('evidence-templar-seal.png'),
  philip: imgFileUrl('suspect-philip-iv.jpg'),
  clement: imgFileUrl('suspect-clement-v.jpg'),
  battle: imgFileUrl('templar-crusade-battle.jpg'),
  fortress: imgFileUrl('templar-chastel-blanc.jpg'),
  stake: imgFileUrl('templar-stake-manuscript.jpg'),
  church: imgFileUrl('templar-temple-church-london.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'Nine Poor Knights': figureHtml(
    images.seal,
    'The seal of the Knights Templar — two knights on one horse',
    'The seal of the Knights Templar, depicting two knights riding a single horse — a symbol of the order\'s founding poverty and brotherhood. The Latin inscription reads: <em>Sigillum Militum Xpisti</em> — Seal of the Soldiers of Christ.'
  ),
  'The White Mantles': figureHtml(
    images.church,
    'Interior of the Temple Church, London',
    'The Temple Church in London, consecrated in 1185 as the English headquarters of the Knights Templar. The round nave echoes the Church of the Holy Sepulchre in Jerusalem. Stone effigies of medieval knights lie on the floor.'
  ),
  'The Sword of Christendom': figureHtml(
    images.battle,
    'The Conquest of Constantinople by the Crusaders in 1204',
    'Eugène Delacroix\'s dramatic depiction of Crusaders in battle. The Templars were the most feared cavalry force of the Crusading era — their disciplined mass charges could break armies many times their number.'
  ),
  'The Bankers of God': figureHtml(
    images.fortress,
    'Chastel Blanc, a Templar fortress in Syria',
    'The keep of Chastel Blanc (Safita) in modern-day Syria — one of the Templar fortresses that dotted the Crusader states. These strongholds served as both military garrisons and nodes in the order\'s vast financial network.'
  ),
  'The King Who Owed Too Much': figureHtml(
    images.philip,
    'King Philip IV of France',
    'Philip IV of France — called <em>le Bel</em> (the Fair) for his striking appearance. Handsome, cold, and calculating, he engineered the destruction of the Knights Templar to seize their wealth and eliminate a rival power within his kingdom.'
  ),
  'The Confessions': figureHtml(
    images.clement,
    'Pope Clement V',
    'Pope Clement V, born Bertrand de Got. Elected through Philip IV\'s influence, he privately absolved the Templars of heresy in 1308 but publicly cooperated in their destruction. He died just 33 days after Molay\'s execution.'
  ),
  'The Fire on the Island': figureHtml(
    images.execution,
    'The execution of Jacques de Molay',
    'An engraving depicting the burning of Jacques de Molay, last Grand Master of the Knights Templar, on March 18, 1314. From the pyre, Molay cursed both King Philip and Pope Clement, prophesying their deaths within a year.'
  ),
  'The Treasure That Vanished': figureHtml(
    images.molay,
    'Jacques de Molay, Grand Master of the Knights Templar',
    'Jacques de Molay, the 23rd and last Grand Master of the Knights Templar, as depicted by Fleury François Richard. Arrested in 1307, he confessed under torture, recanted, and was burned at the stake seven years later.'
  ),
  'The Long Shadow': figureHtml(
    images.hero,
    'The Knights Templar burned in the presence of Philip the Fair',
    'A medieval illumination by the Boucicaut Master showing the burning of the Knights Templar before Philip the Fair and his courtiers. The image captures the public spectacle that Philip made of the order\'s destruction.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/knights-templar.ts');
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
  <p class="epigraph">"A new kind of knighthood and one unknown to the ages gone by. It ceaselessly wages a twofold war both against flesh and blood and against a spiritual army of evil in the heavens."</p>
  <p class="epigraph-attr">— Bernard of Clairvaux, <em>In Praise of the New Knighthood</em>, c. 1136</p>
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
      <p><strong>1099</strong> — The First Crusade captures Jerusalem. The Kingdom of Jerusalem is established, but pilgrim roads remain extremely dangerous.</p>
      <p><strong>c. 1119</strong> — Hugues de Payens and eight companions propose a monastic military order to King Baldwin II of Jerusalem. They are granted headquarters on the Temple Mount, in the former Al-Aqsa Mosque.</p>
      <p><strong>1129 (January 13)</strong> — The Council of Troyes officially endorses the order. Bernard of Clairvaux helps draft the Latin Rule — 72 clauses governing every aspect of Templar life.</p>
      <p><strong>c. 1136</strong> — Bernard of Clairvaux writes <em>In Praise of the New Knighthood</em>, defending the concept of warrior-monks and igniting recruitment across Europe. Hugues de Payens dies on May 24.</p>
      <p><strong>1139</strong> — Pope Innocent II issues <em>Omne Datum Optimum</em>, granting the Templars extraordinary privileges: exemption from all taxes, the right to keep war spoils, and accountability to the Pope alone.</p>
      <p><strong>1147</strong> — Pope Eugenius III grants the Templars the right to wear the red cross (<em>croix pattée</em>) on their white mantles.</p>
      <p><strong>1177 (November 25)</strong> — Battle of Montgisard. Eighty Templar knights, fighting alongside the leper King Baldwin IV, rout Saladin's army of 26,000. Saladin barely escapes on a camel.</p>
      <p><strong>1185 (February 10)</strong> — The Temple Church in London is consecrated by the Patriarch of Jerusalem.</p>
      <p><strong>1187 (July 4)</strong> — Battle of Hattin. The Crusader army is annihilated. Saladin orders the execution of all captured Templars and Hospitallers. Jerusalem falls in October.</p>
      <p><strong>1191</strong> — Siege of Acre ends in Crusader victory during the Third Crusade. The Templars fight in the vanguard of Richard the Lionheart's army.</p>
      <p><strong>1244 (October 17)</strong> — Battle of La Forbie. Only 33 of more than 300 Templar knights survive — a catastrophic 90% casualty rate.</p>
      <p><strong>1291 (May 18)</strong> — Fall of Acre. Grand Master William de Beaujeu is killed. The Templar fortress holds out ten more days before collapsing. By August, the last Crusader strongholds are evacuated.</p>
      <p><strong>1305</strong> — Clement V, a French archbishop, is elected pope under Philip IV's influence. The papal court moves to Avignon.</p>
      <p><strong>1307 (October 13)</strong> — At dawn on Friday the thirteenth, Philip IV's soldiers simultaneously arrest more than 600 Templars across France, including Grand Master Jacques de Molay.</p>
      <p><strong>1308 (August)</strong> — The Chinon Parchment: papal cardinals secretly absolve the Templar leadership of heresy. The document remains hidden until 2001.</p>
      <p><strong>1310 (May)</strong> — Fifty-four Templars who attempted to retract their confessions are burned at the stake outside Paris.</p>
      <p><strong>1312 (March 22)</strong> — Pope Clement V issues <em>Vox in Excelso</em>, dissolving the Knights Templar. The bull does not condemn them for heresy — it eliminates them administratively.</p>
      <p><strong>1314 (March 18)</strong> — Jacques de Molay retracts his confession before a crowd at Notre-Dame, declaring the order innocent. He is burned at the stake that evening on the Île aux Juifs. From the pyre, he curses Philip IV and Clement V.</p>
      <p><strong>1314 (April 20)</strong> — Pope Clement V dies, 33 days after Molay's execution.</p>
      <p><strong>1314 (November 29)</strong> — King Philip IV dies of a stroke while hunting, eight months after the burning.</p>
      <p><strong>1328</strong> — Philip's last surviving son, Charles IV, dies without a male heir. The House of Capet, which had ruled France for 300 years, is extinguished. The succession crisis leads to the Hundred Years' War.</p>
      <p><strong>2001</strong> — Italian paleographer Barbara Frale discovers the Chinon Parchment in the Vatican Apostolic Archive, proving that the Pope had privately absolved the Templars in 1308.</p>
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
      <p>Barber, Malcolm — <em>The Trial of the Templars</em>, Cambridge University Press, 2nd edition, 2006</p>
      <p>Barber, Malcolm — <em>The New Knighthood: A History of the Order of the Temple</em>, Cambridge University Press, 1994</p>
      <p>Jones, Dan — <em>The Templars: The Rise and Spectacular Fall of God's Holy Warriors</em>, Viking, 2017</p>
      <p>Frale, Barbara — "The Chinon Chart: Papal Absolution to the Last Templar, Master Jacques de Molay," <em>Journal of Medieval History</em>, 2004</p>
      <p>Nicholson, Helen — <em>The Knights Templar: A New History</em>, Sutton Publishing, 2001</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-templars-burning-philip.jpg'),
        title: 'The Knights\nTemplar',
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
