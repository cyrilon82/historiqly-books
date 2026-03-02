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
  title: "The Gladiator's Thumb",
  subtitle: 'How a Painting Rewrote Roman History',
  author: 'HistorIQly',
  series: 'Vol. 2: Historical Myths Debunked',
  slug: 'gladiator-thumbs-down',
  description:
    "For a hundred and fifty years, everyone knew what the Roman crowd's thumbs-down meant. It meant death. The image was so vivid, so cinematic, so perfectly suited to our idea of Roman cruelty that it needed no investigation. The investigation, when it finally came, produced a conclusion that no one expected: the Romans almost certainly never used a thumbs-down gesture at all.",
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
  hero: imgFileUrl('hero-gladiator-pollice-verso.jpg'),
  polliceVerso: imgFileUrl('gerome-pollice-verso-1872.jpg'),
  zlitenMosaic: imgFileUrl('zliten-mosaic-gladiators.jpg'),
  pompeiiGraffiti: imgFileUrl('pompeii-gladiatorial-graffiti.jpg'),
  geromePortrait: imgFileUrl('suspect-gerome.jpg'),
  commodus: imgFileUrl('suspect-commodus.jpg'),
};

// Map of chapter title -> image HTML to inject after the content
const chapterImages = {
  'The Painting': figureHtml(
    images.polliceVerso,
    'Pollice Verso by Jean-Léon Gérôme, 1872, Phoenix Art Museum',
    'Jean-Léon Gérôme, <em>Pollice Verso</em>, 1872. Phoenix Art Museum, Arizona. The painting that Ridley Scott saw in 2000 and immediately decided to make <em>Gladiator</em>. Its Vestal Virgins in the foreground extend their arms with thumbs turned downward — a gesture for which there is no ancient evidence, and which almost certainly reverses the historical meaning of the Roman arena thumb signal.'
  ),
  'The Arena': figureHtml(
    images.zlitenMosaic,
    'The Zliten Mosaic — gladiatorial combat, c. 100 AD',
    'A detail from the Zliten Mosaic (c. 100 AD), discovered in 1913 near Zliten, Libya. One of the most detailed surviving documents of Roman gladiatorial combat, it shows fighters, referees, and arena officials in a moment of apparent adjudication — but the crowd thumb gesture, central to the Gérôme-derived myth, is conspicuously absent. In thousands of surviving Roman gladiatorial images, not one clearly depicts a downward thumb signalling death.'
  ),
  'Verso': figureHtml(
    images.pompeiiGraffiti,
    'Gladiatorial graffiti and records from the Pompeii amphitheatre — before 79 AD',
    'Arena graffiti and records from Pompeii, sealed by the eruption of Vesuvius in 79 AD. Pompeii\'s walls contain coded records of gladiatorial outcomes: V (<em>vicit</em>, won), M (<em>missus</em>, released with mercy), and P (<em>periit</em>, died). These records confirm that mercy — the <em>missio</em> — was routine, that gladiators survived many bouts before dying, and that the life-or-death decision was a real and recurring ritual. They say nothing about what the deciding gesture looked like.'
  ),
  'The Detective': figureHtml(
    images.hero,
    "Gérôme's Pollice Verso — the Vestal Virgins section",
    'A detail from Gérôme\'s <em>Pollice Verso</em> (1872) showing the Vestal Virgins and surrounding crowd with thumbs extended downward. Anthony Corbeill\'s landmark 1997 paper "Thumbs in Ancient Rome: Pollex as Index" argued that this gesture, while beautiful and dramatically compelling, reverses the historical signal: an extended thumb most likely meant death, while a pressed or concealed thumb — the sheathed sword — signalled mercy and life.'
  ),
  "The Artist's Error": figureHtml(
    images.geromePortrait,
    'Jean-Léon Gérôme, French academic painter (1824–1904)',
    'Jean-Léon Gérôme (1824–1904), one of the most celebrated academic painters of the 19th century and the inadvertent author of one of history\'s most persistent historical errors. Gérôme was renowned for his obsessive accuracy — he studied gladiatorial armour in Naples, cast bronze figurines of arena fighters, and consulted ancient texts before every Roman painting. His thumb gesture in <em>Pollice Verso</em> had no ancient basis. A scholarly rebuttal appeared in 1879. It changed nothing.'
  ),
  'The Silence of the Stones': figureHtml(
    images.zlitenMosaic,
    'The Zliten Mosaic — arena combat detail, c. 100 AD',
    'The Zliten Mosaic (c. 100 AD, Villa Dar Buc Ammera, Libya) — one of the richest surviving documents of Roman gladiatorial culture. Despite showing fighters, referees, officials, and the decisive moment of adjudication in fine detail, it contains no depiction of the thumbs-down gesture that has dominated Western popular imagination since 1872. This absence is consistent across thousands of pieces of surviving Roman gladiatorial art: the crowd gesture that decided life and death is simply not there.'
  ),
  'The Myth That Won': figureHtml(
    images.polliceVerso,
    'Pollice Verso by Jean-Léon Gérôme, 1872 — detail of the victorious gladiator',
    'The central figure of Gérôme\'s <em>Pollice Verso</em> (1872): a victorious murmillo gladiator standing over a fallen opponent, waiting for the crowd\'s verdict. This image — reproduced in millions of engravings and prints through the late 19th century, embedded in silent films, Hollywood epics, and finally in Ridley Scott\'s 2000 Academy Award-winning <em>Gladiator</em> — has been seen by more people than any other depiction of ancient Rome. The myth it carries is effectively indestructible.'
  ),
  'What We Actually Know': figureHtml(
    images.commodus,
    'Marble bust of Emperor Commodus, 2nd century AD',
    'Marble bust of Emperor Commodus (ruled 177–192 AD), the most controversial Roman emperor to preside over gladiatorial games — he fought in the arena himself, as the incarnation of Hercules, to the horror of the Roman Senate. Commodus is the model for Joaquin Phoenix\'s villain in <em>Gladiator</em> (2000). His arm extended over the arena floor, turning his thumb downward to seal a gladiator\'s fate, is the cinematic image that has defined the gesture for 21st-century audiences — based, like Gérôme\'s painting, on no ancient evidence.'
  ),
};

// --- PARSE CHAPTERS FROM DATA FILE ---
const dataPath = resolve(ROOT, 'src/data/books/gladiator-thumbs-down.ts');
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
  <p class="epigraph">"With turned thumb the mob bids them kill, as the people want."</p>
  <p class="epigraph-attr">— Juvenal, <em>Satires</em>, c. 100 AD<br/><em>The earliest written description of the Roman arena thumb gesture.<br/>He never says which direction.</em></p>
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
      <p><strong>264 BC</strong> — First recorded gladiatorial games in Rome. Decimus Junius Brutus Scaeva holds three pairs of gladiators fight at the Forum Boarium as part of the funeral games for his father, Brutus Pera. The event is a <em>munus</em> — a duty owed to the dead.</p>
      <p><strong>73–71 BC</strong> — Spartacus leads the Third Servile War, escaping from a gladiatorial school at Capua with approximately 70 fighters and building a rebel force of up to 70,000. Crushed by Marcus Crassus.</p>
      <p><strong>65 BC</strong> — Julius Caesar holds funeral games for his father featuring 320 pairs of gladiators — a new standard in spectacle and political display.</p>
      <p><strong>80 AD</strong> — The Colosseum is inaugurated by Emperor Titus with 100 days of games. An estimated 9,000 animals are killed. Seating capacity: 50,000–80,000.</p>
      <p><strong>c. 35–100 AD</strong> — Quintilian, the Roman rhetorician, uses "infesto pollice" (hostile thumb) as a recognised gesture of threatening intent, without specific gladiatorial context.</p>
      <p><strong>23–79 AD</strong> — Pliny the Elder writes in <em>Natural History</em> XXVIII.25: "When we favour someone, we are told even by proverb to press our thumbs [<em>pollices premere</em>]." This gesture of goodwill and favour — the pressed, concealed thumb — is the key evidence for what the mercy signal looked like.</p>
      <p><strong>c. 55–140 AD</strong> — Juvenal writes the earliest surviving reference to a thumb gesture at the gladiatorial games: "With turned thumb [<em>verso pollice</em>] the mob bids them kill, as the people want." He does not specify the direction of the turn.</p>
      <p><strong>c. 86–103 AD</strong> — Martial writes his <em>Epigrams</em> and <em>On the Spectacles</em>, documenting crowd mercy signals including handkerchief-waving (<em>oraria</em>) and the shouts "Mitte!" (spare him) and "Iugula!" (cut his throat).</p>
      <p><strong>177–192 AD</strong> — Emperor Commodus rules. He fights in the arena himself, dressed as Hercules, deeply scandalising the Roman Senate. He wielded the life-and-death editor's decision as personal political theatre, and is the model for Gérôme's implied imperial presence — and for Joaquin Phoenix's villain in <em>Gladiator</em> (2000).</p>
      <p><strong>c. 400–405 AD</strong> — Prudentius writes <em>Contra Symmachum</em>, including the vivid description of a Vestal Virgin calling "with a turn of her thumb [<em>converso pollice</em>]" for a gladiator's death. His phrase "converso" — reversed — is equally ambiguous about direction.</p>
      <p><strong>1 January 404 AD</strong> — Christian monk Telemachus enters the Colosseum during a gladiatorial bout to separate the combatants. He is stoned to death by the crowd. Emperor Honorius declares him a martyr and formally abolishes gladiatorial games in the Western Empire. The arena thumb gesture disappears with the games.</p>
      <p><strong>Early 6th century AD</strong> — The <em>Anthologia Latina</em> is compiled, including the phrase "infesto pollice" (hostile thumb) in a gladiatorial context: "the conquered gladiator has hope, although the crowd threatens with its hostile thumb."</p>
      <p><strong>1824</strong> — Jean-Léon Gérôme is born in Vesoul, France, son of a goldsmith. He will become one of the most celebrated academic painters of the 19th century.</p>
      <p><strong>1843–44</strong> — Gérôme accompanies his teacher Paul Delaroche on an extended Italian tour, visiting Rome, Pompeii, and Naples. He begins decades of research into Roman antiquity.</p>
      <p><strong>1872</strong> — Gérôme completes <em>Pollice Verso</em>. The painting depicts Vestal Virgins with thumbs turned downward, condemning a gladiator to death. There is no ancient evidence for this gesture.</p>
      <p><strong>1873</strong> — <em>Pollice Verso</em> is exhibited publicly. American department-store magnate Alexander Turney Stewart purchases it for 80,000 francs — a record price for Gérôme — and exhibits it in New York.</p>
      <p><strong>8 December 1878</strong> — Jean-Léon Gérôme writes a letter defending the historical accuracy of his thumb-down gesture against scholarly criticism.</p>
      <p><strong>1879</strong> — A 26-page pamphlet is published challenging the historical accuracy of Gérôme's gesture, citing the same ancient sources Gérôme had read. It changes nothing. The painting's image has already escaped into mass culture.</p>
      <p><strong>1904</strong> — Jean-Léon Gérôme dies in Paris, 10 January, aged 79.</p>
      <p><strong>1913</strong> — The Zliten Mosaic is discovered near Zliten, Libya — one of the most detailed surviving documents of Roman gladiatorial combat. It shows the decisive moment of arena adjudication without depicting a crowd thumb gesture.</p>
      <p><strong>1913</strong> — The Italian silent epic <em>Quo Vadis?</em> is released, incorporating arena scenes based on Gérôme's visual language. The thumbs-down gesture enters cinema.</p>
      <p><strong>1958</strong> — Daniel Pratt Mannix publishes <em>Those About to Die</em>, a popular history of Roman gladiatorial games that follows the Gérôme-derived tradition on the thumb gesture.</p>
      <p><strong>1959–1964</strong> — Hollywood's Roman epics — <em>Ben-Hur</em> (1959), <em>Spartacus</em> (1960), <em>The Fall of the Roman Empire</em> (1964) — cement the thumbs-down image for post-war global audiences.</p>
      <p><strong>1993</strong> — Archaeologists in Ephesus, Turkey, discover a gladiatorial cemetery with at least 68 identifiable gladiator skeletons. Osteological analysis confirms gladiators were professional athletes who survived multiple bouts, received medical treatment, and were fed a specialised diet. Most died from wounds received in their final fight, not at every contest.</p>
      <p><strong>1997</strong> — Anthony Corbeill publishes "Thumbs in Ancient Rome: Pollex as Index" in <em>Memoirs of the American Academy in Rome</em> — the definitive modern scholarly treatment of the gladiatorial gesture. His conclusion: an extended thumb probably signalled death; a pressed or concealed thumb probably signalled mercy.</p>
      <p><strong>2000</strong> — Ridley Scott's <em>Gladiator</em> is released, directly inspired by Gérôme's <em>Pollice Verso</em>. It wins five Academy Awards including Best Picture and Best Actor, and is seen by more than 200 million people globally. The thumbs-down death signal is re-entrenched for the 21st century.</p>
      <p><strong>2004</strong> — Anthony Corbeill publishes <em>Nature Embodied: Gesture in Ancient Rome</em> (Princeton University Press), expanding his analysis of the pollice verso question into a broader study of Roman gesture culture.</p>
      <p><strong>2009</strong> — Facebook launches its "Like" button — a thumbs-up icon. The thumbs-up/thumbs-down binary becomes the default grammar of online interaction, reaching hundreds of billions of interactions. The myth achieves its final, functionally indestructible form.</p>
      <p><strong>2024</strong> — Ridley Scott releases <em>Gladiator II</em>. The gesture is still there.</p>
      <p class="end-mark">&bull; &bull; &bull;</p>
    `,
  },
  {
    title: 'About This Book',
    content: `
      <h2>About This Book</h2>
      <p><strong>${book.title}</strong> is a dramatised historical narrative based on documented events and published scholarly research. The chronology, key figures, and factual framework are grounded in primary ancient sources, peer-reviewed studies, and established historical scholarship.</p>
      <p class="separator">***</p>
      <p><strong>Further Reading</strong></p>
      <p>Corbeill, Anthony — "Thumbs in Ancient Rome: Pollex as Index," <em>Memoirs of the American Academy in Rome</em>, Vol. 42, 1997, pp. 61–81</p>
      <p>Corbeill, Anthony — <em>Nature Embodied: Gesture in Ancient Rome</em>, Princeton University Press, 2004</p>
      <p>Juvenal — <em>Satires</em> (trans. Niall Rudd), Oxford University Press, 1992</p>
      <p>Mannix, Daniel P. — <em>Those About to Die</em>, Ballantine Books, 1958</p>
      <p>Kyle, Donald G. — <em>Spectacles of Death in Ancient Rome</em>, Routledge, 1998</p>
      <p>Fagan, Garrett — <em>The Lure of the Arena: Social Psychology and the Crowd at the Roman Games</em>, Cambridge University Press, 2011</p>
      <p>Junkelmann, Marcus — <em>Das Spiel mit dem Tod: So kämpften Roms Gladiatoren</em>, Philipp von Zabern, 2000</p>
      <p>Grout, James — "Pollice Verso," <em>Encyclopaedia Romana</em>, University of Chicago Penelope Project</p>
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
        backgroundImage: resolve(IMG_DIR, 'hero-gladiator-pollice-verso.jpg'),
        title: "The Gladiator's\nThumb",
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
