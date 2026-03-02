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
  title: 'The Donation of Constantine',
  subtitle: 'The Forgery That Ruled the Medieval World',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'donation-of-constantine',
  description:
    'In the eighth century, someone in Rome wrote a document claiming that Emperor Constantine had given the entire Western Roman Empire to the pope. For seven hundred years, popes used it to crown and dethrone kings. It was the most consequential forgery in the history of Western civilization. It was also completely fake.',
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
  raphael: imgFileUrl('hero-donation-of-constantine-raphael.jpg'),
  fresco_donation: imgFileUrl('fresco-donation-constantine-sylvester.jpg'),
  fresco_leprosy: imgFileUrl('fresco-constantine-leprosy.jpg'),
  constantine: imgFileUrl('constantine-head-capitoline.jpg'),
  canossa: imgFileUrl('henry-iv-canossa.jpg'),
  valla: imgFileUrl('suspect-lorenzo-valla.jpg'),
  cusa: imgFileUrl('suspect-nicholas-of-cusa.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Emperor and the Bishop': figureHtml(
    images.constantine,
    'Colossal head of Constantine I, Capitoline Museums, Rome',
    'The colossal marble head of Constantine I, now at the Capitoline Museums in Rome. Originally part of a 12-metre seated statue in the Basilica of Maxentius, it is one of the most powerful surviving images of the emperor in whose name the Donation of Constantine was forged — four centuries after his death.'
  ),
  'The Letter of the Law': figureHtml(
    images.raphael,
    'Donation of Rome — School of Raphael, Vatican Museums, c. 1520–1524',
    'The Donation of Constantine as depicted by a follower of Raphael, c. 1520–1524, now in the Vatican Museums. The painting shows the emperor kneeling before Pope Sylvester, presenting a document — a scene that never occurred. The painting was made decades after Lorenzo Valla had already proven the document false.'
  ),
  'The Uses of a Forgery': figureHtml(
    images.fresco_donation,
    'Constantine leads the pope\'s horse — fresco, Chapel of San Silvestro, Cardinal\'s Palace, Santi Quattro Coronati, Rome, 1246',
    'The central scene of the 1246 fresco cycle in the Chapel of San Silvestro: the Emperor Constantine leading Pope Sylvester\'s white horse through the streets of Rome, performing the office of groom. Painted as political propaganda at the height of the conflict between Pope Innocent IV and Holy Roman Emperor Frederick II, these frescoes remain on the chapel walls today.'
  ),
  "The Philosopher's Doubt": figureHtml(
    images.fresco_leprosy,
    'Constantine afflicted with leprosy — fresco, Chapel of San Silvestro, Cardinal\'s Palace, Santi Quattro Coronati, Rome, 1246',
    'The opening scene of the Santi Quattro Coronati fresco cycle, 1246: Constantine afflicted with leprosy, surrounded by his court. The leprosy narrative, borrowed from the fifth-century Acts of Sylvester, was the dramatic premise of the Donation — a cured emperor\'s expression of gratitude transformed into a legal grant of empire.'
  ),
  'The Walk to Canossa': figureHtml(
    images.canossa,
    'Henry IV awaiting Pope Gregory VII at Canossa, January 1077',
    'A 19th-century depiction of Emperor Henry IV\'s penance at Canossa in January 1077 — the moment when the most powerful secular ruler in Western Europe stood barefoot in the snow outside a castle gate, waiting three days for a pope to lift his excommunication. The political theology that made this possible was built, in part, on the Donation of Constantine.'
  ),
  "The Humanist's Knife": figureHtml(
    images.valla,
    'Lorenzo Valla, c. 1450',
    'Lorenzo Valla (1407–1457), humanist scholar and papal secretary, author of the definitive exposure of the Donation of Constantine in 1440. Working as court historian for Alfonso of Aragon — the pope\'s military enemy — Valla proved the document a forgery through philological analysis, identifying anachronistic vocabulary, internal chronological contradictions, and passages plagiarised from later sources.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/donation-of-constantine.ts');
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
  <p class="epigraph">"For where the supremacy of priests and the head of the Christian religion has been established by a heavenly ruler, it is not just that there an earthly ruler should have jurisdiction."</p>
  <p class="epigraph-attr">— The Donation of Constantine, c. 750 AD (forged)</p>
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
      <p><strong>312 AD</strong> — Constantine defeats Maxentius at the Battle of Milvian Bridge. According to Eusebius, he sees a cross of light with the words "In this sign, conquer."</p>
      <p><strong>313 AD</strong> — Edict of Milan: Constantine and co-emperor Licinius grant legal toleration to all religions, ending the persecution of Christians.</p>
      <p><strong>314 AD</strong> — Sylvester I becomes Bishop of Rome. He sends legates to the Council of Arles but does not attend himself.</p>
      <p><strong>325 AD</strong> — First Council of Nicaea. Sylvester sends legates but does not attend. Constantine presides in person.</p>
      <p><strong>330 AD</strong> — Constantine moves the imperial capital to Constantinople. Rome's political importance begins to decline.</p>
      <p><strong>335 AD</strong> — Pope Sylvester I dies. He has never baptized Constantine, never cured his leprosy, and never received the western provinces.</p>
      <p><strong>337 AD</strong> — Constantine dies, baptized on his deathbed by Eusebius of Nicomedia — an Arian bishop. The embarrassing historical fact motivates later mythologizing.</p>
      <p><strong>c. 470–500 AD</strong> — The Acts of Sylvester (Actus Silvestri) is written: a fictional narrative of Constantine's leprosy, baptism by Sylvester, and cure. This becomes the literary source from which the Donation is fabricated.</p>
      <p><strong>c. 750–757 AD</strong> — The Donation of Constantine is forged, most likely in the papal chancery in Rome. It is created to justify the papacy's territorial claims against the Lombards and the Byzantine Empire.</p>
      <p><strong>753 AD</strong> — Pope Stephen II crosses the Alps — the first pope to do so — to meet Pepin the Short and seek Frankish military protection.</p>
      <p><strong>754–756 AD</strong> — Pepin campaigns in Italy, defeats the Lombards, and donates the Exarchate of Ravenna to the papacy. The Papal States are born.</p>
      <p><strong>c. 847–851 AD</strong> — The Donation is incorporated into the Pseudo-Isidorian Decretals, a vast collection of forged ecclesiastical documents. More than 100 manuscripts survive.</p>
      <p><strong>1001 AD</strong> — Emperor Otto III first publicly challenges the document's authenticity — the earliest known formal challenge. He dies in 1002; the challenge is forgotten.</p>
      <p><strong>1054 AD</strong> — Pope Leo IX cites the Donation in his dispute with Patriarch Michael I Cerularius of Constantinople. The resulting mutual excommunications create the East-West Schism.</p>
      <p><strong>1075 AD</strong> — Pope Gregory VII issues the Dictatus Papae, asserting that the pope may depose emperors — a claim grounded in the Donation's ideological framework.</p>
      <p><strong>January 1077 AD</strong> — Emperor Henry IV stands barefoot in the snow at Canossa for three days, waiting for Gregory VII to lift his excommunication. The Walk to Canossa.</p>
      <p><strong>1122 AD</strong> — Concordat of Worms ends the Investiture Controversy, temporarily settling the conflict over lay investiture.</p>
      <p><strong>1246 AD</strong> — The Chapel of San Silvestro at Santi Quattro Coronati in Rome is painted with a fresco cycle depicting the Donation narrative — propaganda commissioned at the height of the conflict between Pope Innocent IV and Holy Roman Emperor Frederick II.</p>
      <p><strong>c. 1300 AD</strong> — Dante Alighieri condemns the Donation in Inferno, Canto 19, believing it genuine and blaming it for the corruption of the church.</p>
      <p><strong>1433 AD</strong> — Nicholas of Cusa presents the first sustained scholarly challenge to the Donation in De Concordantia Catholica, arguing from historical silence and stylistic analysis. He stops short of calling it a forgery.</p>
      <p><strong>1440 AD</strong> — Lorenzo Valla writes De falso credita et ementita Constantini donatione declamatio, the definitive philological proof that the Donation is a forgery. He is investigated by the Inquisition and saved by Alfonso of Aragon.</p>
      <p><strong>1448 AD</strong> — Valla is appointed apostolic secretary by Pope Nicholas V. The man who exposed the papacy's greatest legal fraud now works directly for the papacy.</p>
      <p><strong>1517 AD</strong> — Ulrich von Hutten publishes Valla's treatise in print for the first time, the same year as Luther's Ninety-Five Theses. He dedicates it to Pope Leo X.</p>
      <p><strong>c. 1520 AD</strong> — Martin Luther reads Valla's treatise and writes: "Good heavens! What darkness and wickedness is at Rome."</p>
      <p><strong>1559 AD</strong> — Valla's complete works are placed on the Index of Prohibited Books.</p>
      <p><strong>1588–1607 AD</strong> — Cardinal Caesar Baronius admits in the Annales Ecclesiastici that the Donation is a forgery. The Catholic scholarly consensus accepts this.</p>
      <p><strong>1929 AD</strong> — The Lateran Treaty between the Holy See and Italy resolves the "Roman Question." The church surrenders its claims to the former Papal States and receives Vatican City (44 hectares) in return. The ideological framework the Donation had constructed is quietly set aside. Baronius's scholarly admission of forgery — three centuries earlier — remains the definitive Catholic concession.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events. The chronology, key figures, and factual framework are grounded in primary sources and historical scholarship. Valla's arguments are drawn from his actual treatise; the political events are based on the historical record.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Valla, Lorenzo — <em>The Treatise of Lorenzo Valla on the Donation of Constantine</em>, trans. Christopher B. Coleman, Yale University Press, 1922 (available free via Project Gutenberg)</p>
      <p>Fried, Johannes — <em>Donation of Constantine and Constitutum Constantini: The Misinterpretation of a Fiction and its Original Meaning</em>, De Gruyter, 2007</p>
      <p>Noble, Thomas F.X. — <em>The Republic of St. Peter: The Birth of the Papal State, 680–825</em>, University of Pennsylvania Press, 1984</p>
      <p>Morrison, Karl F. — "The Donation of Constantine as a Source for the Papal Diplomatic Chancery," <em>Traditio</em>, 1960</p>
      <p>Bowersock, G.W. — <em>Fiction as History: Nero to Julian</em>, University of California Press, 1994</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-donation-of-constantine-raphael.jpg'),
        title: 'The Donation\nof Constantine',
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
