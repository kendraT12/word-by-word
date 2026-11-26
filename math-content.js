// Fast Facts: the ladder of addition and subtraction facts, and the word problems.
// Pure content and pure helpers — no browser, so the tests can read all of it.

import { unknownWords } from "./engine.js";

// ---------- Facts and fact families ----------

/** A fact is a string: "3+4", "7-3". op is "+" or "-". */
export function factKey(a, op, b) {
  return String(a) + op + String(b);
}

export function partsOf(key) {
  const m = /^(\d+)([+-])(\d+)$/.exec(String(key));
  if (!m) return null;
  return { a: Number(m[1]), op: m[2], b: Number(m[3]) };
}

export function answerOf(key) {
  const p = partsOf(key);
  if (!p) return NaN;
  return p.op === "+" ? p.a + p.b : p.a - p.b;
}

/** One thing learned, four facts known. A double knows only two of them. */
export function familyOf(a, b) {
  const sum = a + b;
  if (a === b) return [factKey(a, "+", b), factKey(sum, "-", a)];
  return [factKey(a, "+", b), factKey(b, "+", a), factKey(sum, "-", a), factKey(sum, "-", b)];
}

/** A fact written out for a person to read: "7-3" becomes "7 \u2212 3". */
export function prettyFact(key) {
  const q = partsOf(key);
  return q ? q.a + (q.op === "+" ? " + " : " \u2212 ") + q.b : String(key);
}

/** Every fact a level puts in front of her: the new families, then what it drills again. */
export function keysOfLevel(level) {
  const out = [];
  for (const [a, b] of level.families) for (const k of familyOf(a, b)) if (!out.includes(k)) out.push(k);
  for (const k of level.drills) if (!out.includes(k)) out.push(k);
  return out;
}

// ---------- The ladder ----------

// Every pair worth knowing: both numbers 0 to 10, written with the smaller one first,
// so "3 and 4" and "4 and 3" are one thing to learn, not two.
const ALL_PAIRS = [];
for (let a = 0; a <= 10; a++) for (let b = a; b <= 10; b++) ALL_PAIRS.push([a, b]);

/** The order a child actually builds recall in. Each level takes only the pairs the
 *  levels before it left, so nothing is taught twice and nothing is missed. */
const LADDER = [
  {
    name: "Plus nothing, plus one",
    idea: "Add nothing and it stays the same. Add one and you get the next number up.",
    claims: (a) => a <= 1,
  },
  {
    name: "Doubles",
    idea: "Two the same is a double. 4 and 4 make 8.",
    claims: (a, b) => a === b,
  },
  {
    name: "Pairs that make ten",
    idea: "These two make ten. 3 and 7 make 10.",
    claims: (a, b) => a + b === 10,
    // She met 1 and 9, 5 and 5, and 10 and nothing in the levels before. They belong
    // to this set too, so the set is practised whole.
    drillsFrom: [[0, 10], [1, 9], [5, 5]],
  },
  {
    name: "Near doubles",
    idea: "One more than a double. 6 and 7 is 6 and 6, then 1 more.",
    claims: (a, b) => b === a + 1,
    drillsFrom: [[5, 5], [6, 6], [7, 7]],
  },
  {
    // The level the first draft of the ladder left out: 2+6 and 3+5 are neither
    // doubles, near doubles, nor pairs that make ten, and she has to know them.
    name: "Count on two or three",
    idea: "Start at the big one and count on. 2 and 6 is 6, then 7, 8.",
    claims: (a) => a === 2 || a === 3,
  },
  {
    name: "Bridging ten",
    idea: "Make ten first. 8 and 5 is 8 and 2, then 3 more.",
    claims: (a, b) => a + b > 10,
  },
  {
    name: "Back from the teens",
    idea: "Take away from a teen. 15 take away 7 is 8. Think: 7 and what make 15?",
    claims: null,
    // No new families: the hard half of what she already learned, on its own.
    drillsPick: (met) => met.filter((k) => {
      const p = partsOf(k);
      return p && p.op === "-" && p.a > 10;
    }),
  },
  {
    name: "All of it, mixed",
    idea: "All of them, mixed up. No counting now, just know them.",
    claims: null,
    drillsPick: (met) => met.slice(),
  },
];

function buildLevels() {
  const left = ALL_PAIRS.slice();
  const met = [];
  const out = [];
  for (let i = 0; i < LADDER.length; i++) {
    const def = LADDER[i];
    const families = [];
    if (def.claims) {
      for (let j = left.length - 1; j >= 0; j--) {
        const [a, b] = left[j];
        if (def.claims(a, b)) { families.unshift(left[j]); left.splice(j, 1); }
      }
    }
    const drills = [];
    for (const [a, b] of def.drillsFrom || []) {
      for (const k of familyOf(a, b)) if (met.includes(k) && !drills.includes(k)) drills.push(k);
    }
    if (def.drillsPick) for (const k of def.drillsPick(met)) if (!drills.includes(k)) drills.push(k);
    out.push({ id: i + 1, name: def.name, idea: def.idea, families, drills });
    for (const [a, b] of families) for (const k of familyOf(a, b)) if (!met.includes(k)) met.push(k);
  }
  return out;
}

export const LEVELS = buildLevels();

export const TOP_LEVEL = LEVELS.length;

export function levelById(id) {
  return LEVELS[Math.min(Math.max(1, id), LEVELS.length) - 1];
}

// ---------- Word problems ----------

// Two short sentences that set the fact up. `{a}` and `{b}` are filled from the fact,
// so "7-3" reads "She had 7 ... 3 of them ...". `op` says which shape the words model.
//
// Every word in every one of these is a word the reading app teaches, or a helper word
// it treats as given. Nothing here needs a picture to make sense.
export const WORD_PROBLEMS = {
  1: [
    { op: "+", text: "The cat had {a} hats. Mom got him {b} hats." },
    { op: "+", text: "I had {a} bugs in my box. Dad put {b} in it." },
    { op: "-", text: "I had {a} bugs. {b} ran off." },
  ],
  2: [
    { op: "+", text: "{a} pigs sat in the sun. {b} pigs ran up to sit too." },
    { op: "+", text: "Dad had {a} cups. Mom had {b} cups too." },
    { op: "-", text: "{a} bugs sat on the bed. {b} of them ran off." },
  ],
  3: [
    { op: "+", text: "I had {a} pens. Mom got me {b} pens." },
    { op: "+", text: "{a} ducks sat in the mud. {b} ducks ran in too." },
    { op: "-", text: "The shop had {a} maps. We got {b} of them." },
  ],
  4: [
    { op: "+", text: "{a} frogs sat in the mud. {b} frogs hop in." },
    { op: "+", text: "Mom had {a} hot dogs. Dad got {b} hot dogs." },
    { op: "-", text: "{a} frogs sat on the step. {b} of them did a big jump." },
  ],
  5: [
    { op: "+", text: "I had {a} socks in my bag. Dad put {b} in it." },
    { op: "+", text: "{a} fish swim in the dish. {b} fish swim up to them." },
    { op: "-", text: "We had {a} chips. I had {b} of them." },
  ],
  6: [
    { op: "+", text: "The shop had {a} drums. Dad got {b} drums too." },
    { op: "+", text: "{a} bugs sat in the nest. {b} bugs ran in." },
    { op: "-", text: "We had {a} chips. {b} of them went in the mud." },
  ],
  7: [
    { op: "-", text: "Mom had {a} cups. {b} of them got wet." },
    { op: "-", text: "I had {a} bugs in a box. {b} of them ran off." },
    { op: "+", text: "{a} ducks sat in the sun. {b} ducks ran up to them." },
  ],
  8: [
    { op: "+", text: "I had {a} chips. Dad got me {b} chips too." },
    { op: "+", text: "{a} frogs sat on the sled. {b} frogs jump on too." },
    { op: "-", text: "The cat had {a} socks. {b} of them went in the mud." },
  ],
};

// ---------- The keypad ----------

/** She has no submit button to find mid-drill: the answer settles on its own.
 *  How long to wait depends on whether another digit could still be coming. */
export const SETTLE_MS = 1000;
export const FINAL_MS = 250;

export function settleDelay(typed, answerMax = 20) {
  const s = String(typed === null || typed === undefined ? "" : typed);
  if (s.length !== 1) return FINAL_MS;
  for (let n = 10; n <= answerMax; n++) if (String(n).charAt(0) === s) return SETTLE_MS;
  return FINAL_MS;
}

// ---------- Why a fact works, and the problem that uses it ----------

/** The one line she reads herself in step three. One family, said out loud. */
export function whyLine(a, b) {
  const sum = a + b;
  return a + " and " + b + " make " + sum + ". So " + sum + " take away " + a + " is " + b + ".";
}

/** The taught words in a problem that she cannot read yet.
 *
 *  `unknownWords` knows only the exact spellings the lessons teach, so "chips" would slip
 *  past it untouched. Checking a singular copy of the text as well catches the plurals,
 *  which is every noun in these problems. */
function hardWords(text, words, content) {
  const singular = String(text).replace(/([A-Za-z]+)s\b/g, "$1");
  const out = unknownWords(text, words, content);
  for (const w of unknownWords(singular, words, content)) if (!out.includes(w)) out.push(w);
  return out;
}

/**
 * A short problem in words for this fact, or null when none of the level's problems is
 * one she can read. Skipping is the right answer then: the fact is taught on numerals
 * alone rather than hidden behind words she has not met.
 */
export function problemFor(levelId, key, { words = {}, content = null, elsewhere = true } = {}) {
  const parts = partsOf(key);
  if (!parts || !content) return null;
  // Her own level's problems first; then any level's, because a problem she can read is
  // worth more than one that matches the level she happens to be on.
  const ids = [String(levelId)].concat(elsewhere ? Object.keys(WORD_PROBLEMS).filter((k) => k !== String(levelId)) : []);
  for (const id of ids) {
    for (const entry of WORD_PROBLEMS[id] || []) {
      if (entry.op !== parts.op) continue;
      const text = entry.text.replaceAll("{a}", String(parts.a)).replaceAll("{b}", String(parts.b));
      if (hardWords(text, words, content).length === 0) return { text, key };
    }
  }
  return null;
}
