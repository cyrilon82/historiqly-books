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
  title: 'Were Ninjas Real?',
  subtitle: "The Truth Behind History's Most Mythologised Spies",
  author: 'HistorIQly',
  series: 'Vol. 2: Historical Myths Debunked',
  slug: 'ninjas',
  description:
    "The black-clad assassin who vanishes in a puff of smoke, walks on water, and kills with superhuman precision — this ninja never existed. But something far more interesting did. For two centuries, a network of mercenary intelligence operatives worked the shadows of Japan's Warring States era: not wizards, but spies. Not myth, but history. And the story of how the spy became the superhero is almost as remarkable as the spy himself.",
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
  hero: imgFileUrl('hero-ninjas.jpg'),
  hattoriHanzo: imgFileUrl('suspect-hattori-hanzo.jpg'),
  jiraiya: imgFileUrl('ninja-jiraiya-kabuki-print.jpg'),
  goemon: imgFileUrl('ninja-goemon-execution.jpg'),
  igaMap: imgFileUrl('ninja-iga-province-map.png'),
  yoshitoshi27: imgFileUrl('ninja-yoshitoshi-moon-27.jpg'),
  yoshitoshi72: imgFileUrl('ninja-yoshitoshi-moon-72.jpg'),
  igaCostume: imgFileUrl('ninja-iga-museum-costume.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Name They Never Used': figureHtml(
    images.hero,
    'Tsukioka Yoshitoshi — One Hundred Aspects of the Moon, No. 67 (1887)',
    'A moonlit warrior from Tsukioka Yoshitoshi\'s masterwork series "One Hundred Aspects of the Moon" (1885–1892). Yoshitoshi was the last great master of traditional Japanese woodblock printing, and his warrior series captures the atmosphere of the Sengoku period that produced the shinobi tradition. The word "ninja" did not enter the Japanese language in its modern sense until long after this era had passed.'
  ),
  'The World That Made Them': figureHtml(
    images.yoshitoshi27,
    'Tsukioka Yoshitoshi — One Hundred Aspects of the Moon, No. 27 (1885)',
    'Another print from Yoshitoshi\'s "One Hundred Aspects of the Moon." The chronic, grinding warfare of the Sengoku period (1467–1615) created the conditions that made the shinobi both possible and necessary: when alliances shifted seasonally and information was the most valuable military commodity, the independent operatives of Iga and Koka had a market.'
  ),
  'The Shadow Provinces': figureHtml(
    images.igaMap,
    'Map of Iga Province (modern Mie Prefecture), Japan',
    'Iga Province — the mountain basin that produced Japan\'s most documented shinobi tradition. Landlocked, surrounded by mountain ranges on all sides, with no resident daimyo and a culture of collective self-governance, Iga\'s jizamurai families were positioned to become mercenary intelligence contractors available to any warlord who could pay. The adjacent Koka district (modern Shiga Prefecture, to the north) contributed equal numbers of shinobi and maintained a close alliance with the Iga clans throughout the Sengoku period.'
  ),
  'What They Actually Did': figureHtml(
    images.goemon,
    'Edo period woodblock print depicting the execution of Ishikawa Goemon (1594)',
    'Ishikawa Goemon — legendary outlaw and folk hero, associated with shinobi traditions — was publicly executed in 1594 alongside his family, boiled alive in an iron cauldron after a failed attempt to assassinate the warlord Toyotomi Hideyoshi. The Bansenshukai manual\'s first principle was precisely this: a detected shinobi is a dead shinobi. Their operational value lay entirely in remaining undetected. When concealment failed, the consequences were absolute.'
  ),
  'The Books of Shadows': figureHtml(
    images.yoshitoshi72,
    'Tsukioka Yoshitoshi — One Hundred Aspects of the Moon, No. 72 (1890)',
    'The three great shinobi manuals — the Bansenshukai (1676), the Shoninki (1681), and the Ninpiden — were written during the early Edo period, after the Sengoku wars had ended, by men who feared the knowledge would die with the peace. Fujibayashi Yasutake opened the Bansenshukai with a metaphor: ten thousand rivers, however different their sources, all flow to the same sea. The sea was the practical truth of intelligence work: patience, disguise, and the capacity to remain unseen.'
  ),
  'Nobunaga and the End of Iga': figureHtml(
    images.hattoriHanzo,
    'Historical portrait of Hattori Hanzō Masanari (c. 1542–1596)',
    'Hattori Hanzō Masanari — nicknamed "Oni no Hanzō" (Demon Hanzo) — was a high-ranking military commander in service to Tokugawa Ieyasu, not the swordsmith of cinema. After the Tensho Iga no Ran of 1581 dispersed the Iga confederacy, Hanzo\'s network of Iga contacts proved decisive: he organised the Iga-goe in 1582, guiding Ieyasu through hostile territory after the assassination of Oda Nobunaga. Ieyasu gave Hanzo command of a 300-man Iga guard unit in gratitude. Hanzo died in 1596, in service.'
  ),
  'The Costume and the Stage': figureHtml(
    images.jiraiya,
    'Utagawa Kunisada — Kabuki actor Ichikawa Danjuro VIII as Jiraiya, 1852',
    'The kabuki actor Ichikawa Danjuro VIII in the role of Jiraiya, from the 1852 stage adaptation of "Jiraiya Goketsu Monogatari" — the 1839 serialised novel that introduced the supernatural toad-riding ninja to mass Japanese culture. The theatrical costume, the dramatic presentation, the supernatural frame: these are the sources of the modern ninja image, not the historical manuals. The Bansenshukai lists seven shinobi disguises; none of them is a black theatrical outfit.'
  ),
  'The Ninja Arrives in the West': figureHtml(
    images.igaCostume,
    'The kuro shozoku (black shinobi garment) on display at the Iga-ryu Ninja Museum, Iga, Japan',
    'The traditional black shinobi costume at the Iga Ninja Museum represents the theatrical tradition that became the popular image of the ninja in both Japan and the West. The museum, established in 1964 in a relocated Edo-period farmhouse in Iga City (Mie Prefecture), preserves both the reality — the practical tools, the defensive architecture, the concealment techniques — and the mythology that grew around it. The real shinobi wore civilian clothing. The black costume is a costume.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/ninjas.ts');
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
  <p class="epigraph">"The shinobi is one who twists and changes to achieve his purpose. He uses deception as his weapon and his greatest tool is never being seen at all."</p>
  <p class="epigraph-attr">— Bansenshukai, Fujibayashi Yasutake, 1676</p>
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
      <p><strong>c. 1370 AD</strong> — The war chronicle <em>Taiheiki</em> is completed. It contains some of the earliest documented military references to <em>shinobi</em>, including a castle burned by "an unnamed but highly skilled shinobi."</p>
      <p><strong>1467</strong> — The Onin War begins, triggering the collapse of the Ashikaga shogunate and launching the Sengoku (Warring States) period. The market for mercenary intelligence operatives opens overnight.</p>
      <p><strong>1485</strong> — The Yamashiro no Kuni Ikki. The Iga and Koka jizamurai demonstrate organised collective action in a provincial uprising, establishing the political independence that would characterise their shinobi tradition.</p>
      <p><strong>1542</strong> — Birth of Hattori Hanzō Masanari, the historical ninja commander who would later serve Tokugawa Ieyasu. He is known to history as the "first" Hattori Hanzo — the name would continue in his family for generations.</p>
      <p><strong>1558</strong> — 48 Iga/Koka shinobi under Tateoka Doshun infiltrate Sawayama Castle using a stolen clan-crest lantern. They set coordinated fires from within, enabling Rokkaku Yoshikata's forces to advance. One of the best-documented real shinobi operations.</p>
      <p><strong>1579</strong> — First Iga Invasion. Oda Nobukatsu, acting without his father's authorisation, invades Iga Province. The Iga ikki confederacy repulses the invasion in three engagements. Nobukatsu loses a significant portion of his army.</p>
      <p><strong>1581</strong> — Tensho Iga no Ran. Oda Nobunaga organises six armies to attack Iga simultaneously, with an estimated force of 40,000 to 60,000 men. The Iga confederacy is destroyed. The province is devastated. Survivors scatter across Japan.</p>
      <p><strong>June 1582</strong> — The Honnoji Incident. Oda Nobunaga is assassinated by his general Akechi Mitsuhide. Tokugawa Ieyasu is stranded near Osaka. Hattori Hanzo organises the Iga-goe — the passage through Iga — guiding Ieyasu to safety using his network of Iga shinobi contacts.</p>
      <p><strong>1594</strong> — Ishikawa Goemon, legendary shinobi outlaw who allegedly attempted to assassinate Toyotomi Hideyoshi, is captured and publicly executed by boiling alongside his family in an iron cauldron.</p>
      <p><strong>1596</strong> — Death of Hattori Hanzō Masanari in service to the Tokugawa. His Iga guard unit — the Iga-gumi — continues under subsequent commanders and serves the Tokugawa shogunate for generations.</p>
      <p><strong>1600</strong> — Battle of Sekigahara. Tokugawa Ieyasu's decisive victory effectively ends the Sengoku period. The era that produced the shinobi tradition is over.</p>
      <p><strong>1615</strong> — Siege of Osaka Castle. Toyotomi resistance is eliminated. The Tokugawa shogunate is established and the Edo period begins. The chronic warfare that sustained the shinobi market has ended.</p>
      <p><strong>c. 1560 (compiled c. 1731)</strong> — The Ninpiden, traditionally attributed to the first Hattori Hanzo, is the oldest of the three major shinobi manuals. It deals primarily with tools, castle infiltration, and escape techniques.</p>
      <p><strong>1676</strong> — Fujibayashi Yasutake writes the Bansenshukai — 22 volumes across ten books, the most comprehensive shinobi manual ever produced. He writes explicitly to preserve knowledge that is dying with the peace. The title means "ten thousand rivers flow to the sea."</p>
      <p><strong>1681</strong> — Natori Masazumi writes the Shoninki, a focused manual emphasising the psychological preparation of the shinobi operative — managing fear, maintaining composure under interrogation, conducting long-term deep cover operations.</p>
      <p><strong>1839</strong> — <em>Jiraiya Goketsu Monogatari</em> begins serialised publication. The toad-riding supernatural ninja hero becomes a defining figure of Edo period popular culture, adapted for kabuki and woodblock print. The mythological ninja — black costume, supernatural abilities — solidifies in the public imagination.</p>
      <p><strong>1852</strong> — Utagawa Kunisada produces a woodblock print of the kabuki actor Ichikawa Danjuro VIII in the role of Jiraiya. The theatrical ninja is now fully visualised and widely reproduced.</p>
      <p><strong>1868</strong> — The Meiji Restoration opens Japan to Western influence. The word "ninja" (the Chinese-reading of the shinobi kanji) begins to enter common use as Japan self-consciously modernises and repackages its martial traditions.</p>
      <p><strong>1964</strong> — The Iga-ryu Ninja Museum is established in Iga City (Mie Prefecture), relocated from a traditional Edo-period farmhouse with concealed defensive features. It becomes a major tourist destination and one of the primary sources of public education about real shinobi history.</p>
      <p><strong>1974</strong> — The word "ninja" enters the Japanese dictionary for the first time. The historical shinobi had been gone for over three centuries.</p>
      <p><strong>1980</strong> — Stephen K. Hayes publishes <em>The Ninja and Their Secret Fighting Art</em>, introducing Masaaki Hatsumi's Bujinkan ninjutsu tradition to the West. The 1980s Western ninja craze begins.</p>
      <p><strong>1981</strong> — Cannon Films releases <em>Enter the Ninja</em>, launching a wave of ninja action films. By the mid-1980s, ninja merchandise, schools, and films saturate the Western market.</p>
      <p><strong>1984</strong> — Kevin Eastman and Peter Laird publish the first issue of <em>Teenage Mutant Ninja Turtles</em>, a satirical black-and-white comic that will become the defining vehicle of the ninja mythology for an entire generation.</p>
      <p><strong>1991</strong> — Stephen Turnbull publishes <em>Ninja: The True Story of Japan's Secret Warrior Cult</em>, applying rigorous historical methodology to the shinobi source material. The academic correction of the ninja mythology begins.</p>
      <p><strong>2012</strong> — Antony Cummins and Yoshie Minami publish the first complete English translations of the Bansenshukai and the Shoninki, giving Western readers direct access to the primary sources for the first time.</p>
      <p><strong>2017</strong> — The International Ninja Research Center is established in Iga City, affiliated with the University of Mie. Academic scholarship on the historical shinobi enters an institutional phase.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events and published scholarship. The chronology, key figures, and factual framework are grounded in primary sources — principally the Bansenshukai, the Shoninki, and the Ninpiden — as well as in the academic historical literature on Sengoku-period Japan and the shinobi tradition.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Cummins, Antony &amp; Minami, Yoshie — <em>The Book of Ninja: The Bansenshukai</em>, Watkins Publishing, 2012</p>
      <p>Cummins, Antony &amp; Minami, Yoshie — <em>The Secret Traditions of the Shinobi: Hattori Hanzo's Shinobi Hiden and Other Ninja Scrolls</em>, North Atlantic Books, 2012</p>
      <p>Mazuer, Axel (trans.) — <em>Shoninki: The Secret Teachings of the Ninja</em>, Destiny Books, 2010</p>
      <p>Turnbull, Stephen — <em>Ninja: The True Story of Japan's Secret Warrior Cult</em>, Firebird Books, 1991</p>
      <p>Turnbull, Stephen — <em>Ninja AD 1460–1650</em>, Osprey Publishing, 2003</p>
      <p>Turnbull, Stephen — <em>The Ninja: An Illustrated History</em>, Osprey Publishing, 2014</p>
      <p>Friday, Karl F. — <em>Samurai, Warfare and the State in Early Medieval Japan</em>, Routledge, 2004</p>
      <p class="separator">***</p>
      <p><em>Image credits: Woodblock prints by Tsukioka Yoshitoshi (1839–1892) and Utagawa Kunisada (1786–1865) from public domain sources via Wikimedia Commons. Photograph of the Iga-ryu Ninja Museum via Wikimedia Commons. Historical portrait of Hattori Hanzō from public domain sources.</em></p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-ninjas.jpg'),
        title: 'Were Ninjas\nReal?',
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
