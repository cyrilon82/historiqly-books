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
  title: 'The Hashshashin',
  subtitle: 'The Order That Made Murder a Political Art',
  author: 'HistorIQly',
  series: 'Vol. 6: Secret Societies',
  slug: 'hashshashin',
  description:
    'In 1090, a man disguised as a schoolteacher walked into an impregnable mountain fortress and took it without a single drop of blood. For the next 166 years, his followers would terrify sultans, caliphs, and Crusader kings with a weapon no army could defend against: a single man with a dagger, willing to die. This is the true story of the Assassins — and the myths that made them immortal.',
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
  heroAlamut: imgFileUrl('hero-alamut-castle.jpg'),
  alamutValley: imgFileUrl('atmosphere-alamut-valley.jpg'),
  gardenParadise: imgFileUrl('atmosphere-garden-paradise-marco-polo.jpg'),
  nizamAssassination: imgFileUrl('assassination-nizam-al-mulk.jpg'),
  masyafCastle: imgFileUrl('atmosphere-masyaf-castle.jpg'),
  masyafAerial: imgFileUrl('atmosphere-masyaf-aerial.jpg'),
  oldManMountain: imgFileUrl('atmosphere-old-man-mountain-saint-louis.jpg'),
  hassanSabbah: imgFileUrl('suspect-hassan-sabbah-2.jpg'),
  nizamAlMulk: imgFileUrl('suspect-nizam-al-mulk.png'),
  rashidSinan: imgFileUrl('suspect-rashid-sinan.jpg'),
  alamutCoin: imgFileUrl('evidence-alamut-coin.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  "The Eagle's Nest": figureHtml(
    images.heroAlamut,
    'The ruins of Alamut Castle on its rocky ridge in northern Iran',
    'The ruins of Alamut Castle, perched on a narrow limestone ridge over 180 metres above the Alamut Valley in the Alborz Mountains of northern Iran. Hassan-i Sabbah seized the fortress without a battle in September 1090 and spent the remaining 34 years of his life within its walls.'
  ),
  'The Convert': figureHtml(
    images.hassanSabbah,
    'Portrait of Hassan-i Sabbah, 19th-century engraving',
    'A 19th-century engraving depicting Hassan-i Sabbah, the founder of the Nizari Ismaili state. Born in Qom in the 1050s, he converted to Ismaili Shi\'ism as a young man in Rayy and spent years as a missionary before seizing Alamut.'
  ),
  'The Fortress State': figureHtml(
    images.alamutValley,
    'The Alamut Valley as seen from the castle ruins',
    'The Alamut Valley viewed from the heights of the castle. The valley\'s natural defences \u2014 narrow gorges, high peaks, and converging rivers \u2014 made it an ideal base for the Ismaili fortress state that Hassan built across the mountains of Persia and Syria.'
  ),
  'The First Kill': figureHtml(
    images.nizamAssassination,
    'Persian manuscript illumination depicting the assassination of Nizam al-Mulk',
    'A Persian manuscript illustration of the assassination of Nizam al-Mulk, the powerful Seljuk vizier, by the <em>fida\'i</em> Bu Tahir Arrani on 14 October 1092. It was the first major political assassination carried out by the Order.'
  ),
  'The Self-Sacrificers': figureHtml(
    images.nizamAlMulk,
    'Portrait of Nizam al-Mulk, Seljuk vizier',
    'Nizam al-Mulk, the great Seljuk vizier whose assassination in 1092 marked the beginning of the Hashshashin\'s campaign of targeted killing. His <em>Siyasatnama</em> (Book of Government) devoted an entire chapter to warning against the Ismaili threat.'
  ),
  'The Old Man of the Mountain': figureHtml(
    images.oldManMountain,
    'The Old Man of the Mountain receives envoys of King Louis IX',
    'Guillaume-Fran\u00e7ois-Gabriel Lepaule\'s painting depicting the Old Man of the Mountain receiving envoys from King Louis IX of France during the Seventh Crusade (1248\u20131254). The Crusaders\' accounts of the Assassin leader transformed him into a figure of legend across medieval Europe.'
  ),
  'The Dagger on the Pillow': figureHtml(
    images.masyafCastle,
    'Masyaf Castle in Syria, stronghold of the Assassins',
    'Masyaf Castle in western Syria, the principal stronghold of the Syrian branch of the Hashshashin. Under Rashid ad-Din Sinan, the "Old Man of the Mountain," Masyaf became the centre of operations against both Crusader and Muslim rulers.'
  ),
  'The Garden of Paradise': figureHtml(
    images.gardenParadise,
    'Medieval illumination depicting the Garden of the Old Man of the Mountain',
    'A medieval manuscript illumination illustrating Marco Polo\'s account of the "Garden of Paradise" \u2014 the legendary walled garden where the Old Man of the Mountain supposedly drugged young recruits with hashish before sending them on suicide missions. Modern historians regard the story as apocryphal.'
  ),
  'The Mongol Storm': figureHtml(
    images.masyafAerial,
    'Aerial view of Masyaf Castle and its surroundings',
    'An aerial view of Masyaf Castle and the surrounding landscape. The Mongol invasion under H\u00fcleg\u00fc Khan in 1256 systematically destroyed the Ismaili fortress network, beginning with Alamut and ending with the surrender of the Syrian castles to the Mamluk sultan Baybars.'
  ),
  'The Last Castles': figureHtml(
    images.alamutCoin,
    'Gold coin minted at Alamut Castle',
    'A gold coin minted at Alamut Castle during the Ismaili period \u2014 one of the few surviving physical artefacts of the Nizari state. When H\u00fcleg\u00fc Khan\'s forces captured Alamut in 1256, they destroyed the famous library, though the historian Juvayni managed to save some manuscripts.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/hashshashin.ts');
const raw = readFileSync(dataPath, 'utf-8');

const chapterRegex = /\{\s*num:\s*'([^']+)',\s*title:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*?)"),\s*content:\s*`([\s\S]*?)`,?\s*\}/g;
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
  <p class="epigraph">"Nothing is true; everything is permitted."</p>
  <p class="epigraph-attr">— Attributed to Hassan-i Sabbah<br/>Apocryphal last words, 1124</p>
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
      <p><strong>c. 765</strong> — Death of Ismail ibn Jafar, the Imam from whom the Ismaili branch of Shi'ism takes its name. The Ismaili-Twelver split over the succession defines the theological foundation of the movement Hassan-i Sabbah will later lead.</p>
      <p><strong>909</strong> — The Ismaili Fatimid Caliphate is established in North Africa, eventually expanding to rule Egypt, the Levant, and the Hejaz. Cairo becomes the centre of Ismaili political and intellectual power.</p>
      <p><strong>c. 1050s</strong> — Hassan-i Sabbah is born in the city of Qom, Persia. His family are Twelver Shia Muslims.</p>
      <p><strong>c. 1070</strong> — Hassan converts to Ismaili Shi'ism in the city of Rayy after encountering Ismaili missionaries. He begins studying under the chief <em>da'i</em> of northern Persia.</p>
      <p><strong>1076</strong> — Hassan travels to Fatimid Cairo, where he studies at Al-Azhar and becomes a supporter of Nizar, the eldest son of Caliph al-Mustansir, as the rightful heir to the Imamate.</p>
      <p><strong>1078\u20131090</strong> — Hassan returns to Persia and spends over a decade as a travelling missionary, building networks of converts throughout the Alborz Mountains and the Zagros region.</p>
      <p><strong>4 September 1090</strong> — Hassan-i Sabbah seizes Alamut Castle without bloodshed, paying the departing Zaydi governor three thousand gold dinars. Alamut becomes the headquarters of the Nizari Ismaili state.</p>
      <p><strong>1090\u20131092</strong> — Hassan captures additional fortresses across the Alborz and begins fortifying a network of mountain castles in Persia.</p>
      <p><strong>14 October 1092</strong> — The <em>fida'i</em> Bu Tahir Arrani assassinates Nizam al-Mulk, the powerful Seljuk vizier, near Nahavand. It is the Order's first major political killing.</p>
      <p><strong>19 November 1092</strong> — Sultan Malik-Shah I dies under mysterious circumstances, barely a month after his vizier's assassination. The Seljuk Empire fragments into civil war.</p>
      <p><strong>1094</strong> — The Fatimid succession crisis: Caliph al-Mustansir dies and his younger son al-Musta'li seizes the throne over the eldest son Nizar. Hassan backs Nizar, splitting the Ismaili movement into Nizari and Musta'li branches.</p>
      <p><strong>1103</strong> — Hassan's son Muhammad is executed on suspicion of murdering a fellow Ismaili. Hassan orders the execution personally, demonstrating the strict discipline of the Order.</p>
      <p><strong>1105\u20131118</strong> — Sultan Muhammad Tapar launches repeated campaigns against the Ismaili fortresses but fails to capture Alamut or break the network.</p>
      <p><strong>12 June 1124</strong> — Hassan-i Sabbah dies at Alamut at approximately seventy years of age. He has not left his personal quarters for decades. Leadership passes to Kiya Buzurg-Ummid.</p>
      <p><strong>1126\u20131138</strong> — Buzurg-Ummid consolidates the Nizari state and continues the assassination campaigns. The network expands into Syria.</p>
      <p><strong>c. 1132</strong> — The Syrian branch of the Ismailis establishes itself in the Jabal Bahra mountains, acquiring castles including Masyaf, Kahf, and Qadmus.</p>
      <p><strong>1162\u20131193</strong> — Rashid ad-Din Sinan, the "Old Man of the Mountain," leads the Syrian Assassins from Masyaf. He becomes the most famous Assassin leader in Crusader chronicles.</p>
      <p><strong>1174</strong> — Two assassination attempts on Saladin by Sinan's <em>fida'is</em>. According to legend, Saladin wakes to find a poisoned dagger and a threatening note on his pillow.</p>
      <p><strong>1176</strong> — Saladin besieges Masyaf but withdraws after negotiations, leaving the Syrian Assassins unmolested for the remainder of his reign.</p>
      <p><strong>1192</strong> — Conrad of Montferrat, King of Jerusalem, is assassinated by two <em>fida'is</em> disguised as Christian monks in the streets of Tyre. Responsibility is disputed between Sinan, Saladin, and Richard the Lionheart.</p>
      <p><strong>1210\u20131255</strong> — The Alamut period's final phase under successive lords. Imam Jalal al-Din Hasan briefly declares orthodox Sunni Islam (the "New Teaching" reversal), then his successors return to Ismaili practice.</p>
      <p><strong>1248\u20131254</strong> — During the Seventh Crusade, King Louis IX of France exchanges embassies with the Old Man of the Mountain. The encounter enters European legend.</p>
      <p><strong>1 November 1256</strong> — Mongol forces under H\u00fcleg\u00fc Khan reach Alamut after systematically destroying the outlying Ismaili fortresses. The last lord of Alamut, Rukn al-Din Khurshah, surrenders. The Mongols destroy the castle and burn the famous library, though the historian Juvayni saves some manuscripts.</p>
      <p><strong>1257\u20131258</strong> — Rukn al-Din is sent to the Mongol court and executed. The remaining Ismaili castles in Persia fall. H\u00fcleg\u00fc's forces sack Baghdad, ending the Abbasid Caliphate.</p>
      <p><strong>1270s</strong> — The Mamluk sultan Baybars absorbs the Syrian Assassin castles, ending independent Ismaili political power in the Levant.</p>
      <p><strong>1818</strong> — The first European scholarly study of the Assassins is published, beginning the modern historiography of the movement.</p>
      <p><strong>2007</strong> — The Aga Khan Trust for Culture begins restoration work at Alamut Castle, preserving the ruins as a heritage site.</p>
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
      <p>Lewis, Bernard — <em>The Assassins: A Radical Sect in Islam</em>, Weidenfeld & Nicolson, 1967</p>
      <p>Daftary, Farhad — <em>The Assassin Legends: Myths of the Isma'ilis</em>, I.B. Tauris, 1994</p>
      <p>Daftary, Farhad — <em>The Isma'ilis: Their History and Doctrines</em>, Cambridge University Press, 2007</p>
      <p>Juvayni, Ata-Malik — <em>The History of the World-Conqueror</em>, trans. John Andrew Boyle, Manchester University Press, 1958</p>
      <p>Polo, Marco — <em>The Travels of Marco Polo</em>, trans. Ronald Latham, Penguin Classics, 1958</p>
      <p>Hodgson, Marshall G.S. — <em>The Order of Assassins</em>, Mouton & Co., 1955</p>
      <p class="separator">***</p>
      <p>This book is part of <strong>${book.series}</strong> in the HistorIQly Mysteries series — real history, told as a mystery.</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-alamut-castle.jpg'),
        title: 'The\nHashshashin',
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
