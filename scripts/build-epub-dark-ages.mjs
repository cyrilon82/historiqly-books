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
  title: 'The Dark Ages',
  subtitle: 'The Most Persistent Myth in History',
  author: 'HistorIQly',
  series: 'Vol. 2: Historical Myths Debunked',
  slug: 'dark-ages',
  description:
    'For seven centuries, historians, writers, and textbooks have told the same story: Rome fell in 476 AD, the lights went out, and Europe spent a thousand years in ignorance and barbarism before the Renaissance switched civilization back on. The story is almost entirely wrong. Here is what actually happened.',
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
  hero: imgFileUrl('hero-dark-ages-chartres.jpg'),
  bookOfKells: imgFileUrl('dark-ages-book-of-kells.jpg'),
  charlemagne: imgFileUrl('dark-ages-charlemagne-coronation.jpg'),
  houseOfWisdom: imgFileUrl('dark-ages-house-of-wisdom.jpg'),
  flyingButtress: imgFileUrl('dark-ages-notre-dame-buttresses.jpg'),
  medievalUniversity: imgFileUrl('dark-ages-university-bologna.jpg'),
  petrarch: imgFileUrl('suspect-petrarch.jpg'),
  alcuin: imgFileUrl('suspect-alcuin.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Name Itself Is a Lie': figureHtml(
    images.petrarch,
    'Francesco Petrarch (1304–1374), the Italian poet who coined the "Dark Ages"',
    'Francesco Petrarch, the Italian poet who first framed post-Roman history as "dark." Writing in the 1330s, Petrarch needed a benighted past to justify the rebirth — the rinascita — he believed his own generation was beginning. His rhetorical invention would misrepresent a thousand years of history for the next seven centuries.'
  ),
  'What Rome Actually Left Behind': figureHtml(
    images.hero,
    'Chartres Cathedral nave, constructed largely 1194–1220',
    'The nave of Chartres Cathedral, built during the supposed "Dark Ages" and largely complete by 1220. The vault rises 37 metres above the floor. The walls are almost entirely stained glass — made possible by the flying buttress, a medieval structural invention. The building has stood for 800 years. Ancient Rome built nothing like it.'
  ),
  'The Island of Saints and Scholars': figureHtml(
    images.bookOfKells,
    'A page from the Book of Kells, created by Irish monks c. 800 AD',
    'A page from the Book of Kells, created by Celtic monks at Iona around 800 AD — during the height of the supposed Dark Ages. The manuscript contains 340 vellum folios with over 2,000 decorated initials. It was called "the chief relic of the western world" when it was briefly stolen from Kells monastery in 1007. It now resides in Trinity College Dublin.'
  ),
  'The House of Wisdom': figureHtml(
    images.houseOfWisdom,
    'The House of Wisdom (Bayt al-Hikma) in Abbasid Baghdad',
    'The Bayt al-Hikma — House of Wisdom — in Baghdad, established by Caliph al-Ma\'mun in the early 9th century. During the period that European tradition calls the Dark Ages, Baghdad was the world\'s largest city (population c. 1 million) and home to the greatest concentration of scholars in the world. Al-Khwarizmi worked here when he invented algebra around 820 AD.'
  ),
  "Charlemagne's School": figureHtml(
    images.charlemagne,
    'The coronation of Charlemagne as Emperor of the West, 800 AD',
    'The coronation of Charlemagne as Emperor of the West on Christmas Day, 800 AD, in Rome — depicted in a later medieval illumination. Charlemagne\'s court at Aachen gathered scholars from across Europe and issued the first public education mandate in European history. The Carolingian minuscule script developed at his court is the ancestor of our modern lowercase alphabet.'
  ),
  'The Medieval Invention That Changed Everything': figureHtml(
    images.medievalUniversity,
    'The University of Bologna, founded 1088 — the oldest continuously operating university in the world',
    'Bologna, Italy — home to the University of Bologna, founded in 1088 and the oldest continuously operating university in the world. The university is a medieval invention: nothing comparable existed in ancient Rome or Greece. By 1300, Europe had approximately 15 universities. By 1500, over 70. The Bachelor\'s degree, Master\'s degree, and doctorate are all medieval technologies of knowledge.'
  ),
  'Stone Into Sky': figureHtml(
    images.flyingButtress,
    'Flying buttresses of Notre-Dame de Paris, c. 1163–1345',
    'The flying buttresses of Notre-Dame de Paris — a medieval structural invention that made Gothic architecture possible. By transferring the outward thrust of the stone vault to external piers, the flying buttress freed the interior walls from structural duty, allowing them to become screens of stained glass. Notre-Dame was begun in 1163 and largely complete by 1345. The flying buttress has no ancient precedent.'
  ),
  'Why the Myth Persists': figureHtml(
    images.alcuin,
    'Alcuin of York (735–804), scholar at Charlemagne\'s court',
    'Alcuin of York (c. 735–804), the Northumbrian scholar who became head of Charlemagne\'s Palace School at Aachen. Alcuin co-developed Carolingian minuscule, the ancestor of our modern lowercase alphabet; standardised the European educational curriculum; and wrote textbooks still referenced centuries later. He lived and worked at the height of the supposed "darkness" and was one of the most productive scholars of his age.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/dark-ages.ts');
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
  <p class="epigraph">"Far from being a period of cultural bleakness and unmitigated violence, the centuries known popularly as the Dark Ages were a time of dynamic development, cultural creativity, and long-distance networking."</p>
  <p class="epigraph-attr">— Peter Wells, historian, <em>Barbarians to Angels</em></p>
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
      <p><strong>410 AD</strong> — Visigoths sack Rome. The Western Empire begins its final decades of fragmentation.</p>
      <p><strong>476 AD</strong> — Odoacer deposes the last Western emperor, Romulus Augustulus. Conventional date of Rome's "fall." The Eastern Roman Empire continues unbroken from Constantinople.</p>
      <p><strong>527–565 AD</strong> — Emperor Justinian I rules the Eastern Empire, reconquers North Africa and Italy, completes the Hagia Sophia (537), and compiles the <em>Corpus Juris Civilis</em> — the Roman legal code underpinning modern European law.</p>
      <p><strong>563 AD</strong> — Columba founds the monastery of Iona off the coast of Scotland, beginning the Irish monastic mission to continental Europe.</p>
      <p><strong>c. 543–615 AD</strong> — Columbanus founds monasteries at Luxeuil (France), Bobbio (Italy), and dozens of others. Each becomes a centre of manuscript production and learning.</p>
      <p><strong>c. 673–735 AD</strong> — Life of Bede the Venerable, Northumbrian monk and scholar. His <em>Ecclesiastical History of the English People</em> (731) is the founding document of English history. He popularised AD dating, still in use today.</p>
      <p><strong>c. 715–720 AD</strong> — The Lindisfarne Gospels produced at Holy Island, Northumberland, by the monk Eadfrith.</p>
      <p><strong>c. 786–809 AD</strong> — Harun al-Rashid rules the Abbasid Caliphate. Baghdad reaches a population of approximately 1 million — the world's largest city. He establishes the initial academy that becomes the House of Wisdom.</p>
      <p><strong>c. 800 AD</strong> — The Book of Kells created at Iona (or Kells), containing over 2,000 decorated initials. Among the most sophisticated artworks ever produced.</p>
      <p><strong>781–814 AD</strong> — Charlemagne's Carolingian Renaissance. Alcuin of York heads the Palace School at Aachen. The <em>Admonitio Generalis</em> (789) mandates schools across the Frankish Empire. Carolingian minuscule — ancestor of our modern lowercase alphabet — is standardised.</p>
      <p><strong>813–833 AD</strong> — Caliph al-Ma'mun formally establishes the House of Wisdom in Baghdad. Al-Khwarizmi writes the book that gives algebra its name (c. 820). His name gives us the word "algorithm."</p>
      <p><strong>c. 875 AD</strong> — The Lindisfarne community flees their monastery due to Viking raids, beginning 200 years of wandering while carrying their manuscripts and relics.</p>
      <p><strong>980–1037 AD</strong> — Life of Ibn Sina (Avicenna). His <em>Canon of Medicine</em> (completed 1025) remains the standard medical textbook in European universities until the 17th century.</p>
      <p><strong>1066 AD</strong> — Norman Conquest of England. The Domesday Book (1086) records a population of c. 1.5 million in England; by 1300 it will reach 4–5 million, enabled by medieval agricultural innovation.</p>
      <p><strong>1088 AD</strong> — University of Bologna founded — the oldest continuously operating university in the world. The university is a medieval invention.</p>
      <p><strong>c. 1098–1179 AD</strong> — Life of Hildegard of Bingen. Benedictine abbess, composer, naturalist, and medical encyclopedist. Wrote two encyclopedias of medicine covering over 2,000 remedies.</p>
      <p><strong>c. 1150–1200 AD</strong> — University of Paris emerges from the cathedral school of Notre-Dame.</p>
      <p><strong>1163 AD</strong> — Construction of Notre-Dame de Paris begins. The flying buttress, one of the great innovations in structural engineering, is developed and refined during this project.</p>
      <p><strong>c. 1167 AD</strong> — University of Oxford takes shape following a ban on English students studying in Paris.</p>
      <p><strong>1194–1220 AD</strong> — Chartres Cathedral rebuilt after a fire. Its 176 stained-glass windows cover 2,600 square metres. The vault rises 37 metres. "Chartres blue" glass remains unmatchable today.</p>
      <p><strong>1209 AD</strong> — University of Cambridge founded by scholars who left Oxford after a town-gown dispute.</p>
      <p><strong>1225–1274 AD</strong> — Life of Thomas Aquinas. His <em>Summa Theologica</em> synthesises Christian theology and Aristotelian philosophy in one of the most ambitious intellectual projects in history.</p>
      <p><strong>1248 AD</strong> — Foundation stone of Cologne Cathedral laid by Archbishop Konrad von Hochstaden. Designed by Master Gerhard — a named medieval architect. The cathedral, completed to the original medieval design in 1880, rises 157 metres.</p>
      <p><strong>1258 AD</strong> — Mongol sack of Baghdad destroys the House of Wisdom. The Tigris runs black with ink for days.</p>
      <p><strong>c. 1304–1374 AD</strong> — Life of Francesco Petrarch. Italian poet and humanist who first describes post-Roman history as "dark," laying the foundation for the "Dark Ages" myth that will distort historical understanding for seven centuries.</p>
      <p><strong>By 1300 AD</strong> — Approximately 15 universities operate across Europe. By 1500: over 70. The "Dark Ages" ends at the very moment the university system reaches critical mass.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}: ${book.subtitle}</strong> is a work of narrative non-fiction based on documented history and established scholarship. The chronology, key figures, and factual claims are grounded in primary sources and peer-reviewed historical research.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Brown, Peter — <em>The World of Late Antiquity</em>, Thames and Hudson, 1971</p>
      <p>Haskins, Charles Homer — <em>The Renaissance of the Twelfth Century</em>, Harvard University Press, 1927</p>
      <p>Wells, Peter S. — <em>Barbarians to Angels: The Dark Ages Reconsidered</em>, W. W. Norton, 2008</p>
      <p>Wickham, Chris — <em>The Inheritance of Rome: Illuminating the Dark Ages, 400–1000</em>, Penguin, 2009</p>
      <p>Lyons, Jonathan — <em>The House of Wisdom: How the Arabs Transformed Western Civilization</em>, Bloomsbury, 2009</p>
      <p>Eco, Umberto — <em>Art and Beauty in the Middle Ages</em>, Yale University Press, 1986</p>
      <p>Gies, Frances &amp; Joseph — <em>Cathedral, Forge and Waterwheel: Technology and Invention in the Middle Ages</em>, HarperCollins, 1994</p>
      <p>Herlihy, David — <em>Medieval Culture and Society</em>, Harper &amp; Row, 1968</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-dark-ages-chartres.jpg'),
        title: 'The Dark Ages',
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
