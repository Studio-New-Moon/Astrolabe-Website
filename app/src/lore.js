// The app's fixed vocabulary, copied from its Swift source so the web says
// exactly what the iPhone app says.
//
// Only fixed, chart-independent copy lives here: names, glyphs, keynotes,
// what a house covers, what an aspect is. Anything composed from a reader's
// own chart (horoscopes, nameplates, the whole-chart summary) comes from the
// reading server instead, which runs the app's own Swift, so it is never kept
// in two places.
//
// Sources, as of launch-prep 082b525. If one of these changes in the app,
// change it here in the same breath:
//   Zodiac.swift (signs), LifeArea.swift (areas, rulers), HouseDetail.swift
//   (house titles, covers, essences), Aspects.swift (aspect kinds), Points.swift
//   (points), Guidance.swift (retrograde note), TarotCard.swift (the deck),
//   SignGuidance.swift (each sign's portrait and shadow, both free in the app).

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];

/** Nameplate.ordinal: "7th", for the engraved source lines. */
export const shortOrdinal = (n) => {
  const s = (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${s}`;
};

// Zodiac.signs. The variation selector (U+FE0E) keeps each glyph as text
// rather than an emoji, as the app's strings do.
export const SIGNS = [
  { index: 0, name: "Aries", glyph: "♈︎", element: "fire", ruler: "Mars", keynote: "The First Move", dateRange: "Mar 21 – Apr 19" },
  { index: 1, name: "Taurus", glyph: "♉︎", element: "earth", ruler: "Venus", keynote: "What Is Worth Keeping", dateRange: "Apr 20 – May 20" },
  { index: 2, name: "Gemini", glyph: "♊︎", element: "air", ruler: "Mercury", keynote: "The Two Minds", dateRange: "May 21 – Jun 20" },
  { index: 3, name: "Cancer", glyph: "♋︎", element: "water", ruler: "Moon", keynote: "The Shell and the Soft Part", dateRange: "Jun 21 – Jul 22" },
  { index: 4, name: "Leo", glyph: "♌︎", element: "fire", ruler: "Sun", keynote: "The Thing You Can't Help Being", dateRange: "Jul 23 – Aug 22" },
  { index: 5, name: "Virgo", glyph: "♍︎", element: "earth", ruler: "Mercury", keynote: "The Work of Sorting", dateRange: "Aug 23 – Sep 22" },
  { index: 6, name: "Libra", glyph: "♎︎", element: "air", ruler: "Venus", keynote: "The Weighing", dateRange: "Sep 23 – Oct 22" },
  { index: 7, name: "Scorpio", glyph: "♏︎", element: "water", ruler: "Pluto", keynote: "What Is Under the Surface", dateRange: "Oct 23 – Nov 21" },
  { index: 8, name: "Sagittarius", glyph: "♐︎", element: "fire", ruler: "Jupiter", keynote: "The Long Shot", dateRange: "Nov 22 – Dec 21" },
  { index: 9, name: "Capricorn", glyph: "♑︎", element: "earth", ruler: "Saturn", keynote: "The Climb", dateRange: "Dec 22 – Jan 19" },
  { index: 10, name: "Aquarius", glyph: "♒︎", element: "air", ruler: "Uranus", keynote: "The Pattern Nobody Else Sees", dateRange: "Jan 20 – Feb 18" },
  { index: 11, name: "Pisces", glyph: "♓︎", element: "water", ruler: "Neptune", keynote: "Where the Edges Dissolve", dateRange: "Feb 19 – Mar 20" },
];
export const signAt = (lon) => SIGNS[Math.min(11, Math.floor((((lon % 360) + 360) % 360) / 30))];

const TRADITIONAL = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
export const rulerOf = (sign, system = "modern") => (system === "traditional" ? TRADITIONAL[sign.index] : sign.ruler);
/** Planet.subject: "the Sun" and "the Moon", every other planet by name. */
export const subject = (name, capitalized = false) =>
  (name === "Sun" || name === "Moon") ? `${capitalized ? "The" : "the"} ${name}` : name;
export const rulerSubject = (sign, system = "modern", capitalized = false) => subject(rulerOf(sign, system), capitalized);

export const PLANET_NAMES = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
};
export const PLANET_GLYPHS = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

export const POINT_INFO = {
  northNode: { name: "North Node", glyph: "☊", houseDescriptor: "your North Node" },
  chiron: { name: "Chiron", glyph: "⚷", houseDescriptor: "the small planetary body Chiron" },
  blackMoonLilith: { name: "Black Moon Lilith", glyph: "⚸", houseDescriptor: "your Black Moon Lilith" },
  whiteMoonSelena: { name: "White Moon Selena", glyph: "⚸", houseDescriptor: "your White Moon Selena" },
};

export const ANGLE_INFO = {
  ascendant: { name: "Ascendant", abbreviation: "ASC" },
  midheaven: { name: "Midheaven", abbreviation: "MC" },
  descendant: { name: "Descendant", abbreviation: "DSC" },
  imumCoeli: { name: "Imum Coeli", abbreviation: "IC" },
};

/** Guidance.retrogradeNote and PointGuidance.chironRetrogradeNote. */
export const retrogradeNote = (planetName) =>
  `${subject(planetName, true)} was retrograde when you were born — apparently moving backwards as the Earth overtook it. Nothing is reversed, but this drive tends to run inward first and show outwardly late. Expect it to want private rehearsal before public use.`;
export const CHIRON_RETROGRADE_NOTE = "Chiron was retrograde when you were born — its usual forward motion apparently reversed as Earth overtook it. The wound points inward first here, worked through privately before it becomes something you can offer outward.";

// HouseDetail.title / covers / essence.
export const HOUSE_TITLES = ["Awareness of Self", "Personal Resources", "Immediate Environment", "Inner World",
  "Personal Creativity", "Daily Life", "Awareness of Others", "Shared Resources",
  "Expanded Horizons", "Outer World", "Group Contribution", "Spiritual Life"];
export const HOUSE_COVERS = ["Appearance · Outward Personality", "Money · Possessions · Values · Skills",
  "Learning · Siblings · Communication", "Home · Parents · Roots",
  "Romance · Children · Fun", "Work · Health · Self-Improvement",
  "Marriage & Partnership", "Sex · Death · Regeneration · Shared Money",
  "Philosophy · Travel · Religion · Law", "Career · Status · Vocation",
  "Friends · Groups · Goals", "Solitude · Transcendence"];
export const HOUSE_ESSENCES = [
  "The mask you put on before anyone sees you — the version of yourself that forms in a first impression. Less who you are, more how you walk into a room.",
  "What's actually yours: money, talent, the things you'd fight to keep. Less about how much you have, more about what you've decided is worth having.",
  "The everyday reach of your life — conversations, errands, the people you grew up next to. How you think out loud, and how you get around.",
  "The floor everything else stands on: where you're from, who raised you, what home has to feel like before you can rest in it.",
  "Whatever you do purely because it delights you — flirting, art, a hobby with no ambition attached. The house with nothing to prove.",
  "The unglamorous machinery that keeps you upright: routines, health, the job that pays for a life rather than being the point of one.",
  "The mirror you chose. Partners, close collaborators, even open rivals — who you become in the presence of one other person.",
  "Whatever gets more serious the moment it's shared — intimacy, debt, inheritance, the parts of yourself you only show one person at a time.",
  "The search for a bigger frame: travel, belief, study, whatever convinces you the world is larger than your own street.",
  "The version of you the public meets — career, reputation, what you're known for by people who've never seen you at home.",
  "The people you'd choose as family, and the future you're quietly building alongside them. Less who loves you, more who you're going somewhere with.",
  "Whatever happens with the door closed — sleep, solitude, everything you haven't said out loud yet, even to yourself.",
];

// LifeArea, in the order LifeAreasView shows them.
export const AREAS = [
  { id: "purpose", title: "Purpose", house: null, motto: "I AM FOR", covers: "The Planet That Rules Your Chart, and What Keeps It Fed" },
  { id: "love", title: "Love", house: 7, motto: "I PARTNER", covers: "Marriage · Partnership · What You Seek in Another" },
  { id: "friends", title: "Friends", house: 11, motto: "I ASPIRE", covers: "Friends · Groups · The Goals You Hold in Common" },
  { id: "career", title: "Career", house: 10, motto: "I ACHIEVE", covers: "Career · Status · Vocation" },
  { id: "home", title: "Home", house: 4, motto: "I NURTURE", covers: "Home · Parents · Roots" },
  { id: "spirit", title: "Spirit", house: 12, motto: "I DREAM", covers: "Solitude · Transcendence · What You Don't Say" },
];

// AspectKind.
export const ASPECT_KINDS = [
  { id: "conjunction", angle: 0, orb: 8, glyph: "☌", temper: "fused",
    meaning: "The two planets sit in the same place, so they don't take turns — they fuse into one combined drive. Whatever they're each after, you pursue it as a single impulse rather than two separate voices." },
  { id: "sextile", angle: 60, orb: 4, glyph: "⚹", temper: "easy",
    meaning: "An aspect that opens a door without pushing you through it. The two planets support each other, but only if you actually reach for it — sextiles are opportunities, not automatic events." },
  { id: "square", angle: 90, orb: 6, glyph: "□", temper: "friction",
    meaning: "The two planets pull in different directions on purpose. It reads as friction because it is friction — but a square is also the aspect that actually gets things built, since ease alone rarely forces anything to change." },
  { id: "trine", angle: 120, orb: 6, glyph: "△", temper: "flowing",
    meaning: "The two planets already agree, and it shows: this is the easiest aspect in the chart. The risk is exactly that — talent that flows this freely is also easy to coast on rather than develop." },
  { id: "opposition", angle: 180, orb: 8, glyph: "☍", temper: "pulled apart",
    meaning: "The two planets face each other from opposite sides of the chart, like a see-saw. It's a tension of balance rather than of conflict — the growth is in learning to hold both ends instead of collapsing toward one." },
];

/** AspectKind.match: the one angle (if any) between two longitudes. */
export function matchAspect(a, b) {
  let sep = Math.abs(a - b) % 360;
  if (sep > 180) sep = 360 - sep;
  for (const kind of ASPECT_KINDS) {
    const orb = Math.abs(sep - kind.angle);
    if (orb <= kind.orb) return { kind, orb, separation: sep };
  }
  return null;
}

// MajorArcana, for the Coming Soon card. Only names, numerals, keynotes and
// what each card corresponds to: the meanings stay in the app until Tarot
// launches.
const EL = { fire: "🜂", earth: "🜃", air: "🜁", water: "🜄" };
export const TAROT = [
  ["0", "The Fool", "The Uncommitted Step", EL.air, "air"],
  ["I", "The Magician", "What Is Already on the Table", "☿", "planet"],
  ["II", "The High Priestess", "What Hasn't Been Said Yet", "☽", "planet"],
  ["III", "The Empress", "What Grows Without Forcing", "♀", "planet"],
  ["IV", "The Emperor", "The Structure That Holds", "♈︎", "fire"],
  ["V", "The Hierophant", "The Method Already Proven", "♉︎", "earth"],
  ["VI", "The Lovers", "The Choice Between Two Real Things", "♊︎", "air"],
  ["VII", "The Chariot", "Two Forces, One Direction", "♋︎", "water"],
  ["VIII", "Strength", "The Quiet Kind of Force", "♌︎", "fire"],
  ["IX", "The Hermit", "The Light You Carry Alone", "♍︎", "earth"],
  ["X", "Wheel of Fortune", "What Turns Without Asking", "♃", "planet"],
  ["XI", "Justice", "The Balance Already Struck", "♎︎", "air"],
  ["XII", "The Hanged Man", "The View From Upside Down", EL.water, "water"],
  ["XIII", "Death", "The End That Clears the Ground", "♏︎", "water"],
  ["XIV", "Temperance", "The Mix That Actually Works", "♐︎", "fire"],
  ["XV", "The Devil", "The Chain You Could Take Off", "♑︎", "earth"],
  ["XVI", "The Tower", "The Fast Correction", "♂", "planet"],
  ["XVII", "The Star", "What's Left After the Fall", "♒︎", "air"],
  ["XVIII", "The Moon", "What Looks Different by Night", "♓︎", "water"],
  ["XIX", "The Sun", "What Needs No Translation", "☉", "planet"],
  ["XX", "Judgement", "The Account Called In", EL.fire, "fire"],
  ["XXI", "The World", "The Thing Actually Finished", "♄", "planet"],
].map(([roman, name, keynote, glyph, tint]) => ({ roman, name, keynote, glyph, tint }));

export const SIGN_READINGS = {
  "Aries": {
    "portrait": "Cardinal fire, ruled by Mars: the impulse that arrives before the plan does. Aries is the first sign because it's the one that begins — not the one that finishes, and it has no particular interest in finishing. Its intelligence is in the body and in the moment, which is why an Aries decision made in four seconds is often better than the same decision agonized over for a month.",
    "shadow": "Starting is easy and cheap, so unchecked Aries accumulates beginnings — a shelf of half-built things, each abandoned at the point it stopped being exciting and started being work."
  },
  "Taurus": {
    "portrait": "Fixed earth, ruled by Venus: the sign that decides what's worth keeping. Taurus isn't slow, it's unhurried — a distinction that matters, because it moves at the speed of things that last. It's the most sensory sign in the zodiac and the least apologetic about it: good bread, a warm room, a debt paid off.",
    "shadow": "Fixed earth doesn't distinguish between a thing worth keeping and a thing merely held. Stubbornness is Taurus's own strength pointed at something that stopped deserving it."
  },
  "Gemini": {
    "portrait": "Mutable air, ruled by Mercury: two minds, and the traffic between them. Gemini is the sign of the second opinion, including about itself — which is why it can argue either side of a thing sincerely, and why people mistake that for insincerity. It thinks by talking, so it often doesn't know what it believes until it hears itself say it.",
    "shadow": "Ideas are more exciting than the labor of any one of them, so unchecked Gemini talks its projects out of existence — the telling is satisfying enough that the making never happens."
  },
  "Cancer": {
    "portrait": "Cardinal water, ruled by the Moon: the shell and the soft thing inside it, and the fact that the shell was built for a reason. Cancer initiates through care — it's the sign that notices what a room needs and quietly provides it. Its memory is long and emotional rather than factual, which is both why it's loyal and why old injuries stay vivid.",
    "shadow": "Care given without being asked becomes a ledger nobody agreed to. Unchecked Cancer feeds people and then quietly resents them for eating."
  },
  "Leo": {
    "portrait": "Fixed fire, ruled by the Sun: the thing you can't help being. Leo is often miscast as wanting attention; what it wants is to be seen accurately, which is a different and much harder request. It sustains warmth the way fixed signs sustain anything — reliably, at cost to itself, long after the audience has stopped clapping.",
    "shadow": "When the seeing doesn't come, Leo will take being noticed as a substitute. Performance is the counterfeit of recognition and it never quite pays."
  },
  "Virgo": {
    "portrait": "Mutable earth, ruled by Mercury: the intelligence of sorting. Virgo sees the flaw first, and this is a genuine perceptual gift rather than pessimism — it's the sign you want checking the work. It's also the sign of service in the plain sense: usefulness as a way of loving people, offered through the thing done properly.",
    "shadow": "The eye that finds the flaw doesn't switch off when it turns inward, and the standard applied to the self is one no self could meet."
  },
  "Libra": {
    "portrait": "Cardinal air, ruled by Venus: the weighing. Libra initiates through relationship — it works out what it thinks by placing it against another person, which is why it can seem to have no position and actually has a very exact one. It's the sign most attuned to proportion, in a room, in an argument, in a design.",
    "shadow": "Weighing is meant to end in a verdict. Held open indefinitely it becomes avoidance wearing the costume of fairness, and everyone else ends up deciding instead."
  },
  "Scorpio": {
    "portrait": "Fixed water, ruled by Pluto in the modern scheme and Mars in the old one — and both are true of it. Scorpio is the sign that won't settle for the surface account of anything, including itself. It's comfortable with what other people find unbearable: grief, debt, desire, the actual state of things.",
    "shadow": "The same depth that refuses a comfortable lie can refuse a comfortable truth. Unchecked Scorpio keeps its own counsel past the point where anyone can reach it."
  },
  "Sagittarius": {
    "portrait": "Mutable fire, ruled by Jupiter: the long shot, and the appetite for a bigger frame. Sagittarius is the sign of meaning rather than fact — it wants to know what a thing is for. Its honesty is famous and genuinely meant, arriving without much padding because padding strikes it as a kind of lie.",
    "shadow": "The frame can always be widened, and widening it is easier than staying inside one. Unchecked Sagittarius mistakes the next horizon for progress and leaves the present unfinished behind it."
  },
  "Capricorn": {
    "portrait": "Cardinal earth, ruled by Saturn: the climb, and the willingness to pay in years. Capricorn initiates through structure — it starts things that are designed to still exist later, which is rarer than it sounds. It carries responsibility early, often before anyone offers it, and tends to be the most competent person in a room without mentioning it.",
    "shadow": "Worth becomes something to be earned rather than had, and the summit keeps moving. Rest starts to feel like a debt being run up."
  },
  "Aquarius": {
    "portrait": "Fixed air, ruled by Uranus in the modern scheme and Saturn in the old one — the pattern-breaker and the structure-builder, which is less contradictory than it looks. Aquarius sees the system rather than the instance, and is loyal to the principle over the person. It's the sign most able to be genuinely unbothered by what a group thinks.",
    "shadow": "Seeing the system from outside can become standing outside it permanently. The detachment that grants clarity also grants distance, and distance is easy to keep."
  },
  "Pisces": {
    "portrait": "Mutable water, ruled by Neptune in the modern scheme and Jupiter in the old one: where the edges dissolve. Pisces is the least defended sign — it takes on the state of the room without deciding to, which is the source of both its empathy and its exhaustion. It thinks in images and associations rather than sequence, and is often right long before it can say why.",
    "shadow": "Without an edge there's no way to tell your own weather from someone else's, and the fatigue that follows gets explained as anything but what it is."
  }
};
