// Word by Word: pure lesson logic. No browser or Claude dependencies.

// ---------- Dates (plain "YYYY-MM-DD" keys, local calendar days) ----------

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function toUTC(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key, n) {
  return new Date(toUTC(key) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

// ---------- Word state ----------

export const INTERVALS = [1, 3, 7, 14, 30];
const STEPS_OF_ROUTINE = ["say", "spell", "mean", "story"];

function intervalFor(lvl) {
  return INTERVALS[Math.min(lvl - 1, INTERVALS.length - 1)];
}

const FRESH = { status: "new", lvl: 0, due: null, helps: 0, seen: 0, lastSeen: null, slow: false };

/** After the four-step routine.
 *  Learned means she read the word whole, with no help. A word she had to sound out first
 *  is not learned: it goes to fast practice (`slow`), where only her speed needs work.
 *
 *  `steps` names the four steps and `firstTry` the one that must be read whole, so the
 *  maths routine (tried, family, why, problem) uses the same rule as the reading one. */
export function applyRoutine(state, result, today, steps = STEPS_OF_ROUTINE, firstTry = "say") {
  const prev = state || FRESH;
  const helped = steps.filter((k) => result[k] === "help").length;
  const base = { helps: (prev.helps || 0) + helped, seen: (prev.seen || 0) + 1, lastSeen: today };
  if (helped === 0 && result[firstTry] === "ok") {
    return { ...base, status: "learned", lvl: 1, due: addDays(today, intervalFor(1)), slow: false };
  }
  // Sounding it out is not a mistake, so it never counts as needing help.
  return { ...base, status: "practicing", lvl: 0, due: addDays(today, 1), slow: helped === 0 && result[firstTry] === "slow" };
}

/** quality: "ok" read whole, "slow" sounded out first, "miss" could not read it. */
const asQuality = (q) => (q === true ? "ok" : q === false ? "miss" : q);

/** After a quick review (Say it + Spell it) of a learned word. */
export function applyReview(state, quality, today) {
  const q = asQuality(quality);
  const base = { ...state, seen: (state.seen || 0) + 1, lastSeen: today };
  if (q === "ok") {
    const lvl = (state.lvl || 1) + 1;
    return { ...base, status: "learned", lvl, due: addDays(today, intervalFor(lvl)), slow: false };
  }
  if (q === "slow") return { ...base, status: "practicing", lvl: 0, due: addDays(today, 1), slow: true };
  return { ...base, status: "practicing", lvl: 0, due: addDays(today, 1), slow: false, helps: (state.helps || 0) + 1 };
}

/** After Fast Words: one word, read whole or sounded out. This is the path that
 *  turns "she can work it out" into "she just reads it". */
export function applyFast(state, quality, today) {
  const prev = state || FRESH;
  const q = asQuality(quality);
  const base = { ...prev, seen: (prev.seen || 0) + 1, lastSeen: today };
  if (q === "ok") {
    const lvl = prev.status === "learned" ? (prev.lvl || 1) + 1 : 1;
    return { ...base, status: "learned", lvl, due: addDays(today, intervalFor(lvl)), slow: false };
  }
  if (q === "slow") return { ...base, status: "practicing", lvl: 0, due: addDays(today, 1), slow: true };
  return { ...base, status: "practicing", lvl: 0, due: addDays(today, 1), slow: false, helps: (prev.helps || 0) + 1 };
}

/** Words she can read but still has to sound out first. */
export function slowWords(words) {
  return Object.keys(words)
    .filter((w) => words[w].status === "practicing" && words[w].slow)
    .sort((a, b) => {
      const sa = words[a].lastSeen || "", sb = words[b].lastSeen || "";
      return sa !== sb ? (sa < sb ? -1 : 1) : a < b ? -1 : 1;
    });
}

/** The number that matters: how many she reads whole versus how many she works out. */
export function fluencyCounts(words) {
  let instant = 0, slow = 0;
  for (const w of Object.keys(words)) {
    if (words[w].status === "learned") instant++;
    else if (words[w].status === "practicing" && words[w].slow) slow++;
  }
  return { instant, slow };
}

/** Learned words whose review is due, oldest first, capped so a lesson stays short. */
export function dueReviews(words, today, cap = 8) {
  return Object.keys(words)
    .filter((w) => words[w].status === "learned" && words[w].due && words[w].due <= today)
    .sort((a, b) => (words[a].due < words[b].due ? -1 : words[a].due > words[b].due ? 1 : a < b ? -1 : 1))
    .slice(0, cap);
}

// ---------- Text helpers ----------

/** Lowercase words; apostrophes kept, other punctuation dropped. */
export function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^a-z0-9']+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

export function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Did what the app heard contain the target word? Lenient for long words and same-sound words. */
export function matchSpoken(heard, target, homophones = {}) {
  const want = String(target).toLowerCase();
  const same = (homophones[want] || homophones[target] || []).map((h) => String(h).toLowerCase());
  return tokens(heard).some(
    (t) => t === want || same.includes(t) || (want.length >= 6 && editDistance(t, want) <= 1)
  );
}

/** Words in a text that are not in the allowed set (each listed once, in order). */
export function offListWords(text, allowed) {
  const out = [];
  for (const t of tokens(text)) {
    const base = t.endsWith("'s") ? t.slice(0, -2) : t;
    if (allowed.has(t) || allowed.has(base)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export const CHUNKS = ["igh", "tch", "sh", "ch", "th", "wh", "ck", "ng", "ee", "ea", "ai", "ay", "oa", "ow",
  "ar", "or", "er", "ir", "ur", "oo", "ou", "oi", "oy"];

function longestAt(word, i, list) {
  const lower = word.toLowerCase();
  let best = "";
  for (const c of list) if (c.length > best.length && lower.startsWith(c, i)) best = c;
  return best;
}

/** Split a word into the parts she says one at a time: "ship" -> sh, i, p. */
export function soundChunks(word, chunks = CHUNKS) {
  const out = [];
  for (let i = 0; i < word.length; ) {
    const len = longestAt(word, i, chunks).length || 1;
    out.push(word.slice(i, i + len));
    i += len;
  }
  return out;
}

/** Split a word into plain and highlighted runs for the step's pattern letters. */
export function highlightParts(word, pats) {
  const out = [];
  let plain = "";
  for (let i = 0; i < word.length; ) {
    const len = longestAt(word, i, pats).length;
    if (len) {
      if (plain) { out.push({ t: plain, hi: false }); plain = ""; }
      out.push({ t: word.slice(i, i + len), hi: true });
      i += len;
    } else { plain += word[i]; i++; }
  }
  if (plain) out.push({ t: plain, hi: false });
  return out;
}

// ---------- Lesson builder ----------

const statusOf = (words, w) => (words[w] && words[w].status) || "new";
const isSlow = (words, w) => !!(words[w] && words[w].slow && words[w].status === "practicing");
const isOpen = (words, w) => {
  const s = statusOf(words, w);
  return s === "new" || (s === "practicing" && !isSlow(words, w));
};

/** Entries still to be taught: practicing ones first (oldest seen first), then unseen in list order. */
function nextToTeach(entries, words, n) {
  const open = entries.map((e) => e.w).filter((w) => isOpen(words, w));
  const practicing = open
    .filter((w) => statusOf(words, w) === "practicing")
    .sort((a, b) => ((words[a].lastSeen || "") < (words[b].lastSeen || "") ? -1 : 1));
  const unseen = open.filter((w) => statusOf(words, w) === "new");
  return practicing.concat(unseen).slice(0, n);
}

const STEP_WORDS_PER_LESSON = 3;
const PLACED_PER_LESSON = 3;
const WARMUP_SIZE = 5;

export function buildLesson({ profile, words, content, today }) {
  const stepDef = content.STEPS[profile.step - 1];
  const stepEntries = stepDef.words;

  let newWords = nextToTeach(stepEntries, words, STEP_WORDS_PER_LESSON);
  if (newWords.length < STEP_WORDS_PER_LESSON) {
    const earlier = content.STEPS.slice(0, profile.step - 1).flatMap((s) => s.words)
      .filter((e) => statusOf(words, e.w) === "practicing");
    newWords = newWords.concat(nextToTeach(earlier, words, STEP_WORDS_PER_LESSON - newWords.length));
  }

  const fast = (profile.recentHelpFree || []).length === 3 && profile.recentHelpFree.every(Boolean);
  const sight = nextToTeach(content.SIGHT, words, 1);
  const everyday = nextToTeach(content.EVERYDAY, words, fast ? 2 : 1);

  const inOrder = content.STEPS.flatMap((s) => s.words).concat(content.SIGHT, content.EVERYDAY);
  const placed = inOrder.map((e) => e.w).filter((w) => statusOf(words, w) === "placed").slice(0, PLACED_PER_LESSON);

  const reviews = dueReviews(words, today);

  const busyToday = new Set([...newWords, ...placed, ...sight, ...everyday, ...reviews]);
  const warmup = slowWords(words).filter((w) => !busyToday.has(w)).slice(0, WARMUP_SIZE);
  const known = Object.keys(words)
    .filter((w) => words[w].status === "learned" && !busyToday.has(w))
    .sort((a, b) => ((words[a].lastSeen || "") > (words[b].lastSeen || "") ? -1 : 1));
  for (const w of known) { if (warmup.length >= WARMUP_SIZE) break; warmup.push(w); }
  for (const e of stepEntries) {
    if (warmup.length >= WARMUP_SIZE) break;
    if (!warmup.includes(e.w) && !busyToday.has(e.w)) warmup.push(e.w);
  }

  const introduced = profile.introduced || [];
  const byWord = Object.fromEntries(stepEntries.map((e) => [e.w, e]));
  const firstUntaught = newWords.map((w) => byWord[w]).find((e) => e && e.pat && !introduced.includes(e.pat));
  const introPattern = firstUntaught ? firstUntaught.pat : null;
  let introWords = [];
  if (introPattern) {
    const samePat = stepEntries.filter((e) => e.pat === introPattern).map((e) => e.w);
    introWords = samePat.filter((w) => !newWords.includes(w)).slice(0, 4);
    if (!introWords.length) introWords = samePat.slice(0, 4);
  }

  return { step: profile.step, warmup, introPattern, introWords, newWords, placed, sight, everyday, reviews };
}

// ---------- Progression ----------

export function stepProgress(step, words, content) {
  const entries = content.STEPS[step - 1].words;
  const learned = entries.filter((e) => statusOf(words, e.w) === "learned").length;
  return { learned, total: entries.length, pct: entries.length ? learned / entries.length : 0 };
}

export function canAdvance(step, words, content, storyHelps) {
  if (step >= content.STEPS.length) return false;
  return stepProgress(step, words, content).pct >= 0.8 && storyHelps <= 2;
}

export function isStuck(profile, dayKeys) {
  return dayKeys.filter((d) => d >= profile.stepStartedDay).length >= 15;
}

/** Starting step from the first-day check: the first step where she missed 2 or more words. */
/** The furthest the first-day check may place her. Steps past this one are earned by
 *  reading, never handed out for knowing letter sounds: a child can know every sound
 *  and still not read a contraction. */
export const MAX_PLACEMENT_STEP = 10;

export function placementStep(stepScores, top = MAX_PLACEMENT_STEP) {
  const cap = Math.min(top, MAX_PLACEMENT_STEP);
  const ids = Object.keys(stepScores).map(Number).sort((a, b) => a - b);
  for (const id of ids) if (stepScores[id].filter((x) => !x).length >= 2) return Math.min(id, cap);
  return cap;
}

// ---------- Parent insights ----------

/** Words per minute. A read under 1.5s is a stray tap, not a reading, and counts as nothing. */
export const MIN_READ_MS = 1500;
export const MAX_WPM = 400;
export function wpm(wordCount, ms) {
  if (!(ms >= MIN_READ_MS)) return 0;
  return Math.min(MAX_WPM, Math.round(wordCount / (ms / 60000)));
}

export function tipForTonight(words) {
  let best = null;
  for (const w of Object.keys(words)) {
    const s = words[w];
    if (s.status !== "practicing" || !(s.helps > 0)) continue;
    if (!best || s.helps > words[best].helps) best = w;
  }
  if (!best) return null;
  const n = words[best].helps;
  return 'Practice "' + best + '": she needed help ' + n + (n === 1 ? " time." : " times.");
}

export function streak(dayKeys, today) {
  const done = new Set(dayKeys);
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

/** Every word a Claude-written story may use without counting as too hard. */
export function allowedWords({ profile, words, content }) {
  const out = new Set();
  const add = (text) => tokens(text).forEach((t) => out.add(t));
  add(profile.name);
  (profile.favorites || []).forEach(add);
  (content.HELPERS || []).forEach(add);
  content.STEPS.slice(0, profile.step).forEach((s) => s.words.forEach((e) => add(e.w)));
  for (const w of Object.keys(words)) {
    if (words[w].status === "learned" || words[w].status === "placed") add(w);
  }
  return out;
}

// ---------- Choosing the story for today ----------

/** Every word the lessons teach, found by its lowercase spelling (January -> january). */
function taughtIndex(content) {
  const out = new Map();
  const add = (e) => out.set(e.w.toLowerCase(), e.w);
  content.STEPS.forEach((s) => s.words.forEach(add));
  (content.SIGHT || []).forEach(add);
  (content.EVERYDAY || []).forEach(add);
  return out;
}

/** The words in a text that the app teaches but she has not learned yet, in reading order.
 *  Helper words (a, in, it) are not taught one at a time, so they never count. */
export function unknownWords(text, words, content) {
  const taught = taughtIndex(content);
  const out = [];
  for (const t of tokens(text)) {
    const w = taught.get(t);
    if (!w || out.includes(t)) continue;
    const s = statusOf(words, w);
    if (s !== "learned" && s !== "placed") out.push(t);
  }
  return out;
}

/** The stories she can read today: every taught word in them is one she knows. */
export function readableStories(list, words, content) {
  return (list || []).filter((st) => unknownWords(st.text, words, content).length === 0);
}

/** Today's story. Her step's stories carry the sounds she is learning, so they lead;
 *  once she can read an everyday story (months, colors, days), one comes every other day. */
export function chooseStory({ step, words, content, stories, everydayStories, dayCount }) {
  const list = stories[step] || stories[1];
  const ready = readableStories(everydayStories, words, content);
  if (!ready.length) return list[dayCount % list.length];
  const turn = Math.floor(dayCount / 2);
  return dayCount % 2 === 1 ? ready[turn % ready.length] : list[turn % list.length];
}

/** How many of a story's words she has read so far, following along as she speaks. */
export function matchReadAlong(storyWords, heardTokens, homophones = {}) {
  let w = 0;
  for (const t of heardTokens) {
    if (w >= storyWords.length) break;
    if (matchSpoken(t, storyWords[w], homophones)) { w++; continue; }
    // She may have skipped a word; let the next one carry her past it.
    if (w + 1 < storyWords.length && matchSpoken(t, storyWords[w + 1], homophones)) w += 2;
  }
  return w;
}

/** A short note a grown-up can send themselves: where she is, in plain words. */
export function progressSummary({ profile, words, facts = {}, days, content, today }) {
  const practised = Object.keys(days).filter((k) => (days[k].practiced || []).length || days[k].minutes).sort();
  const { instant, slow } = fluencyCounts(words);
  const sounding = slowWords(words);
  const progress = stepProgress(profile.step, words, content);
  const stepDef = content.STEPS[profile.step - 1];
  const lastRead = practised.filter((d) => (days[d].storyWpm || []).some((n) => n > 0)).pop();
  const tip = tipForTonight(words);

  const lines = [
    profile.name + "'s reading — " + today,
    practised.length + (practised.length === 1 ? " day practiced" : " days practiced")
      + ", " + streak(practised, today) + " in a row",
    "Reads whole: " + instant,
    "Still sounds out: " + slow + (sounding.length ? " (" + sounding.slice(0, 6).join(", ") + ")" : ""),
    "Step " + profile.step + ": " + stepDef.name + " (" + progress.learned + " of " + progress.total + ")",
  ];
  if (lastRead) lines.push("Story speed: " + days[lastRead].storyWpm[0] + " then " + days[lastRead].storyWpm[1] + " words a minute");
  if (tip) lines.push(tip);

  // Her maths, when there is any. Same distinction as the reading: knowing is not working out.
  if (Object.keys(facts).length) {
    const f = fluencyCounts(facts);
    const speed = answerSpeed(days);
    lines.push("", "Maths — level " + (profile.mathLevel || 1));
    lines.push("Knows cold: " + f.instant);
    lines.push("Still counts: " + f.slow);
    if (speed && speed.direction !== "new") {
      lines.push("Time to answer: " + (speed.now / 1000).toFixed(1) + "s, was " + (speed.before / 1000).toFixed(1) + "s");
    }
    const mtip = factTip(facts);
    if (mtip) lines.push(mtip);
    const fade = fadeNote(days);
    if (fade) lines.push(fade);
  }
  return lines.join("\n");
}

// ---------- Maths: scheduling facts, and building a maths lesson ----------
//
// A fact keys as "3+4" or "7-3", so everything above — applyFast, applyReview,
// dueReviews, slowWords, fluencyCounts — stores facts beside words untouched.
// `content` here is the maths content module: LEVELS, familyOf, keysOfLevel, levelById.

export const FAMILIES_PER_LESSON = 2;
export const FAST_FACTS_SIZE = 8;

/** The furthest the first-day maths check may place her. Levels past this one are earned
 *  by answering, never handed out for a good showing on the easy facts. */
export const MAX_PLACEMENT_LEVEL = 5;

export function mathPlacementLevel(levelScores, top = MAX_PLACEMENT_LEVEL) {
  const cap = Math.min(top, MAX_PLACEMENT_LEVEL);
  const ids = Object.keys(levelScores).map(Number).sort((a, b) => a - b);
  for (const id of ids) if (levelScores[id].filter((x) => !x).length >= 2) return Math.min(id, cap);
  return cap;
}

const famKeys = (fam, content) => content.familyOf(fam[0], fam[1]);
const sameFam = (a, b) => a[0] === b[0] && a[1] === b[1];

/** A family still worth teaching: some fact in it is new, or she missed it.
 *  A fact she can work out but works out slowly is not here — that needs Fast Facts. */
function familyOpen(fam, facts, content) {
  return famKeys(fam, content).some((k) => isOpen(facts, k));
}
function familyStarted(fam, facts, content) {
  return famKeys(fam, content).some((k) => facts[k] && facts[k].status !== "new");
}
function familyLastSeen(fam, facts, content) {
  let last = "";
  for (const k of famKeys(fam, content)) {
    const s = facts[k];
    if (s && s.lastSeen && s.lastSeen > last) last = s.lastSeen;
  }
  return last;
}

/** Families to teach: ones she has started, longest untouched first, then unseen ones. */
function nextFamilies(families, facts, content, n) {
  const open = families.filter((f) => familyOpen(f, facts, content));
  const started = open
    .filter((f) => familyStarted(f, facts, content))
    .sort((a, b) => (familyLastSeen(a, facts, content) < familyLastSeen(b, facts, content) ? -1 : 1));
  const fresh = open.filter((f) => !familyStarted(f, facts, content));
  return started.concat(fresh).slice(0, n);
}

export function buildMathLesson({ profile, facts, content, today }) {
  const levelId = Math.min(Math.max(1, profile.mathLevel || 1), content.LEVELS.length);
  const level = content.levelById(levelId);

  let newFamilies = nextFamilies(level.families, facts, content, FAMILIES_PER_LESSON);
  if (newFamilies.length < FAMILIES_PER_LESSON) {
    // Whatever earlier levels left behind. She moves up at 80%, so every level leaves a
    // few families untaught; they come back here once her own level has nothing open.
    // Facts the first-day check marked "placed" are not open, so they are not re-taught.
    const earlier = content.LEVELS.slice(0, levelId - 1)
      .flatMap((l) => l.families)
      .filter((f) => !newFamilies.some((g) => sameFam(g, f)));
    newFamilies = newFamilies.concat(
      nextFamilies(earlier, facts, content, FAMILIES_PER_LESSON - newFamilies.length)
    );
  }

  const reviews = dueReviews(facts, today);
  const busy = new Set(newFamilies.flatMap((f) => famKeys(f, content)).concat(reviews));

  // Fast Facts: the ones she can work out lead, because speed is all they need, then
  // the ones she knows, to keep them. Only facts she has MET go here. The reading side
  // pads its warmup with untaught words, which works because the same words are then
  // taught in the lesson; here the facts taught today are different ones, so padding
  // would open her lesson with a run of facts she cannot do and is not about to learn.
  const warmup = slowWords(facts).filter((k) => !busy.has(k)).slice(0, FAST_FACTS_SIZE);
  const known = Object.keys(facts)
    .filter((k) => facts[k].status === "learned" && !busy.has(k) && !warmup.includes(k))
    .sort((a, b) => ((facts[a].lastSeen || "") > (facts[b].lastSeen || "") ? -1 : 1));
  for (const k of known) { if (warmup.length >= FAST_FACTS_SIZE) break; warmup.push(k); }

  return { level: levelId, warmup, newFamilies, reviews };
}

/** How far through a level she is.
 *
 *  A level is measured on the facts it TEACHES — its own families — never on the ones it
 *  only drills again. Those belong to earlier levels, and a child the first-day check
 *  started at level 3 was never taught them, so counting them made the level's bar
 *  impossible to fill and left her there for good.
 *
 *  The last two levels teach nothing of their own, so they are measured on the facts they
 *  drill that she has actually met. */
export function levelProgress(levelId, facts, content) {
  const level = content.levelById(levelId);
  const own = level.families.flatMap((f) => famKeys(f, content));
  const met = (k) => { const st = statusOf(facts, k); return st !== "new" && st !== "placed"; };
  const keys = own.length ? own : level.drills.filter(met);
  const learned = keys.filter((k) => statusOf(facts, k) === "learned").length;
  return { learned, total: keys.length, pct: keys.length ? learned / keys.length : 0 };
}

export function canAdvanceLevel(levelId, facts, content) {
  if (levelId >= content.LEVELS.length) return false;
  const { total, pct } = levelProgress(levelId, facts, content);
  return total > 0 && pct >= 0.8;
}

/** Every fact below the level the first-day check put her on. She is assumed to know
 *  these, so they are marked "placed": not counted as learned, and never taught at her
 *  from scratch. The reading side places her skipped words the same way. */
export function placedBelowLevel(levelId, content) {
  const out = [];
  for (const level of content.LEVELS.slice(0, levelId - 1)) {
    for (const fam of level.families) for (const k of famKeys(fam, content)) if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** Facts she gets wrong most often, worst first — what to practise tonight. */
export function hardestFacts(facts, n = 5) {
  return Object.keys(facts)
    .filter((k) => (facts[k].helps || 0) > 0 && facts[k].status !== "learned")
    .sort((a, b) => (facts[b].helps - facts[a].helps) || (a < b ? -1 : 1))
    .slice(0, n);
}

const FADE_SCORE = { ok: 0, slow: 1, miss: 2, help: 2 };

/** Does she tail off within a sitting? Compares the last third of each session against
 *  its first third. This reports what it sees; it never shortens the lesson by itself. */
export function fadeNote(days, lookback = 5, needed = 4) {
  const usable = Object.keys(days)
    .sort()
    .filter((d) => (days[d].mathTrace || []).length >= 6)
    .slice(-lookback);
  if (usable.length < needed) return null;

  const mean = (list) => list.reduce((s, q) => s + (FADE_SCORE[q] || 0), 0) / list.length;
  const fadeMinutes = [];
  for (const d of usable) {
    const t = days[d].mathTrace;
    const third = Math.floor(t.length / 3);
    if (mean(t.slice(-third)) > mean(t.slice(0, third))) {
      fadeMinutes.push((days[d].mathMinutes || 0) * ((t.length - third) / t.length));
    }
  }
  if (fadeMinutes.length < needed) return null;

  fadeMinutes.sort((a, b) => a - b);
  const mins = Math.round(fadeMinutes[Math.floor(fadeMinutes.length / 2)]);
  if (!(mins > 0)) return null;
  return "She does well for about " + mins + " minutes, then it gets hard."
    + " A shorter sitting may teach her more.";
}

/** Twenty minutes is a time box, not a quota of work. The lesson asks this BETWEEN items
 *  only: an item already in hand is always finished, so she is never cut off part way
 *  through a fact. A session with no start time never ends itself. */
export const SESSION_MS = 20 * 60000;

export function sessionOver(startedAt, now, limitMs = SESSION_MS) {
  if (!startedAt) return false;
  return now - startedAt >= limitMs;
}

/** Is she getting quicker to answer? Compares the middle time-to-start of her last few
 *  maths days against the few before them. "new" means there is nothing to compare yet. */
export function answerSpeed(days, span = 3) {
  const keys = Object.keys(days).sort().filter((d) => (days[d].mathStartMs || []).length);
  if (keys.length < 2) return null;
  const mid = (list) => { const s = list.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const dayMid = (d) => mid(days[d].mathStartMs);
  const recent = mid(keys.slice(-span).map(dayMid));
  const older = keys.slice(-span * 2, -span).map(dayMid);
  if (!older.length) return { now: Math.round(recent), before: null, direction: "new" };
  const before = mid(older);
  const direction = recent < before * 0.9 ? "faster" : recent > before * 1.1 ? "slower" : "same";
  return { now: Math.round(recent), before: Math.round(before), direction };
}

/** The fact worth ten minutes tonight, said so a grown-up can act on it. */
export function factTip(facts) {
  const worst = hardestFacts(facts, 1)[0];
  if (!worst) return null;
  const n = facts[worst].helps;
  const pretty = worst.replace("+", " + ").replace("-", " − ");
  return "Practice " + pretty + ": she needed help " + n + (n === 1 ? " time." : " times.");
}

// ---------- Setting the bar from what she actually does ----------

/** Fewest answers worth drawing a conclusion from. */
export const MIN_TIMED = 12;

/**
 * Where her own answers divide.
 *
 * A child answering a page of facts produces two clumps of times: the ones she knows,
 * which come back in about the same short time every time, and the ones she works out,
 * which take several times longer. The bar belongs in the gap between them.
 *
 * This finds the split that leaves both clumps tightest, and reports it — it never
 * applies it. Both bars in this app were invented by someone who had never watched her;
 * this is how they stop being invented.
 *
 * Returns null when there is nothing to say: too few answers, no real gap, or a gap that
 * rests on one or two stray times.
 */
export function suggestedBar(times, { min = 2000, max = 8000, needed = MIN_TIMED, ratio = 1.6, side = 3 } = {}) {
  const xs = (times || []).filter((t) => t > 0).sort((a, b) => a - b);
  const n = xs.length;
  if (n < needed || n < side * 2) return null;

  // Running totals, so every candidate split is one subtraction rather than a loop.
  const sum = [0], square = [0];
  for (let i = 0; i < n; i++) { sum.push(sum[i] + xs[i]); square.push(square[i] + xs[i] * xs[i]); }
  const spread = (a, b) => {
    const k = b - a;
    if (k <= 0) return 0;
    const s = sum[b] - sum[a];
    return square[b] - square[a] - (s * s) / k;
  };

  let best = null;
  for (let i = side; i <= n - side; i++) {
    const v = spread(0, i) + spread(i, n);
    if (best === null || v < best.v) best = { v, i };
  }
  if (best === null) return null;

  const lo = xs.slice(0, best.i), hi = xs.slice(best.i);
  const middle = (list) => list[Math.floor(list.length / 2)];
  const fast = middle(lo), slow = middle(hi);
  // Two clumps only count as two if the slow one is clearly slower.
  if (!(slow >= fast * ratio)) return null;

  const gap = Math.round((lo[lo.length - 1] + hi[0]) / 2);
  return { n, fast: Math.round(fast), slow: Math.round(slow), split: Math.max(min, Math.min(max, gap)) };
}
