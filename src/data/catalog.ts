/**
 * Lightweight catalog for the homepage grid.
 * Only display metadata — no chapter content.
 */

export interface CatalogBook {
  slug: string;
  title: string;
  subtitle: string;
  volume: string;
  volumeNum: number;
  isFree?: boolean;
  asin?: string;
}

/** Amazon ASIN lookup by slug */
export const kindleAsins: Record<string, string> = {
  'area-51': 'B0GQ8T2KLK',
  'mkultra': 'B0GQ3QJWZY',
  'antwerp-diamond-heist': 'B0GQ82SFX7',
  'amber-room': 'B0GGWV1C83',
  'amelia-earhart': 'B0GQ397VTF',
  'illuminati': 'B0GQ5H5N22',
  'atlantis': 'B0GQ4XF4CX',
  'gardner-museum-heist': 'B0GQ3KCGJY',
  'jack-the-ripper': 'B0GQ3DLZKT',
  'antikythera-mechanism': 'B0GQ8DS8Q7',
};

export const catalog: CatalogBook[] = [
  // Vol. 1: Hoaxes
  { slug: 'piltdown-man', title: 'The Piltdown Men', subtitle: 'The 41-Year Fraud That Fooled Science', volume: 'Hoaxes', volumeNum: 1, isFree: true },
  { slug: 'cardiff-giant', title: 'The Cardiff Giant', subtitle: 'The Cigar Maker Who Fooled America', volume: 'Hoaxes', volumeNum: 1 },
  { slug: 'hitler-diaries', title: 'The Hitler Diaries', subtitle: 'The Forgery That Fooled the World', volume: 'Hoaxes', volumeNum: 1 },

  // Vol. 2: Myths
  { slug: 'cleopatra-snake-bite', title: "Cleopatra's Last Breath", subtitle: "The Mystery of the Serpent Queen's Death", volume: 'Myths', volumeNum: 2 },
  { slug: 'viking-horned-helmets', title: 'The Horned Helmet', subtitle: 'How an Opera Costume Fooled the World', volume: 'Myths', volumeNum: 2 },
  { slug: 'hollywood-pirates', title: 'Hollywood Pirates', subtitle: 'Were Pirates Really Like the Movies?', volume: 'Myths', volumeNum: 2 },

  // Vol. 3: Cold Cases
  { slug: 'jack-the-ripper', title: 'Jack the Ripper', subtitle: 'The Autumn of Terror', volume: 'Cold Cases', volumeNum: 3 },
  { slug: 'black-dahlia', title: 'The Black Dahlia', subtitle: "Hollywood's Most Haunting Cold Case", volume: 'Cold Cases', volumeNum: 3 },
  { slug: 'zodiac-killer', title: 'The Zodiac Killer', subtitle: "America's Most Elusive Serial Killer", volume: 'Cold Cases', volumeNum: 3 },

  // Vol. 4: Disappearances
  { slug: 'amelia-earhart', title: 'Into the Pacific', subtitle: 'The Disappearance of Amelia Earhart', volume: 'Disappearances', volumeNum: 4 },
  { slug: 'db-cooper', title: 'D.B. Cooper', subtitle: 'The Man Who Fell Off the Earth', volume: 'Disappearances', volumeNum: 4 },
  { slug: 'mary-celeste', title: 'The Mary Celeste', subtitle: 'The Ghost Ship That Haunted the Atlantic', volume: 'Disappearances', volumeNum: 4 },

  // Vol. 5: Conspiracies
  { slug: 'jfk-assassination', title: 'November 22, 1963', subtitle: 'The Assassination That Changed America', volume: 'Conspiracies', volumeNum: 5 },
  { slug: 'moon-landing-hoax', title: 'The Moon Landing', subtitle: 'The Conspiracy That Would Not Die', volume: 'Conspiracies', volumeNum: 5 },
  { slug: 'area-51', title: 'Area 51', subtitle: 'The Secret Base That Launched a Thousand Conspiracies', volume: 'Conspiracies', volumeNum: 5 },

  // Vol. 6: Secret Societies
  { slug: 'illuminati', title: 'The Bavarian Illuminati', subtitle: "Nine Years That Conquered the World's Imagination", volume: 'Secret Societies', volumeNum: 6 },
  { slug: 'freemasons', title: 'The Freemasons', subtitle: 'The Builders Who Became a Brotherhood', volume: 'Secret Societies', volumeNum: 6 },
  { slug: 'skull-and-bones', title: 'Skull and Bones', subtitle: 'The Order Behind the Power', volume: 'Secret Societies', volumeNum: 6 },

  // Vol. 7: Declassified
  { slug: 'mkultra', title: 'MKUltra', subtitle: "The CIA's Secret War on the Mind", volume: 'Declassified', volumeNum: 7 },
  { slug: 'operation-paperclip', title: 'Operation Paperclip', subtitle: 'The Nazi Scientists Who Built the American Dream', volume: 'Declassified', volumeNum: 7 },
  { slug: 'cointelpro', title: 'COINTELPRO', subtitle: "The FBI's Secret War on America", volume: 'Declassified', volumeNum: 7 },

  // Vol. 8: Unexplained
  { slug: 'dyatlov-pass', title: 'The Dyatlov Pass Incident', subtitle: 'Nine Hikers, One Mountain, No Survivors', volume: 'Unexplained', volumeNum: 8 },
  { slug: 'loch-ness-monster', title: 'The Loch Ness Monster', subtitle: "The Hunt for Scotland's Impossible Creature", volume: 'Unexplained', volumeNum: 8 },
  { slug: 'wow-signal', title: 'The Wow! Signal', subtitle: '72 Seconds from the Edge of Forever', volume: 'Unexplained', volumeNum: 8 },

  // Vol. 9: Lost Worlds
  { slug: 'atlantis', title: 'Atlantis', subtitle: "Deconstructing Plato's Original Myth", volume: 'Lost Worlds', volumeNum: 9 },
  { slug: 'gobekli-tepe', title: 'Göbekli Tepe', subtitle: 'The Temple Built Before Agriculture', volume: 'Lost Worlds', volumeNum: 9 },
  { slug: 'younger-dryas-impact', title: 'The Younger Dryas Impact', subtitle: 'Did a Comet Reset Civilization?', volume: 'Lost Worlds', volumeNum: 9 },

  // Vol. 10: Archaeological Mysteries
  { slug: 'nazca-lines', title: 'The Nazca Lines', subtitle: 'The Desert That Drew Itself', volume: 'Archaeological Mysteries', volumeNum: 10 },
  { slug: 'voynich-manuscript', title: 'The Book of Nowhere', subtitle: "The Voynich Manuscript and the Language That Doesn't Exist", volume: 'Archaeological Mysteries', volumeNum: 10 },
  { slug: 'antikythera-mechanism', title: 'The Antikythera Mechanism', subtitle: "The Ancient Computer That Shouldn't Exist", volume: 'Archaeological Mysteries', volumeNum: 10 },

  // Vol. 11: Heists
  { slug: 'gardner-museum-heist', title: 'The Gardner Museum Heist', subtitle: 'The Night They Stole the Impossible', volume: 'Heists', volumeNum: 11 },
  { slug: 'amber-room', title: 'The Amber Room', subtitle: 'The Eighth Wonder of the World That Vanished', volume: 'Heists', volumeNum: 11 },
  { slug: 'antwerp-diamond-heist', title: 'The Antwerp Diamond Heist', subtitle: 'The Thieves Who Beat Ten Layers of Security', volume: 'Heists', volumeNum: 11 },
];

export const paidBooks = catalog.filter((b) => !b.isFree);
