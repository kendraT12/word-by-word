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
 *  is not learned: it goes to fast practice (`slow`), where only her speed needs work. */
export function applyRoutine(state, result, today) {
  const prev = state || FRESH;
  const helped = STEPS_OF_ROUTINE.filter((k) => result[k] === "help").length;
  const base = { helps: (prev.helps || 0) + helped, seen: (prev.seen || 0) + 1, lastSeen: today };
  if (helped === 0 && result.say === "ok") {
    return { ...base, status: "learned", lvl: 1, due: addDays(today, intervalFor(1)), slow: false };
  }
  // Sounding it out is not a mistake, so it never counts as needing help.
  return { ...base, status: "practicing", lvl: 0, due: addDays(today, 1), slow: helped === 0 && result.say === "slow" };
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
export function progressSummary({ profile, words, days, content, today }) {
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
  return lines.join("\n");
}
