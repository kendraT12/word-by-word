import { test, eq, ok } from "./t.js";
import * as E from "../engine.js";

const allOk = { say: "ok", spell: "ok", mean: "ok", story: "ok" };

// ---- Task 1: dates and word state ----
test("addDays crosses a year boundary", () => {
  eq(E.addDays("2026-12-30", 3), "2027-01-02");
});
test("daysBetween counts whole days", () => {
  eq(E.daysBetween("2026-11-12", "2026-11-26"), 14);
});
test("todayKey formats local date", () => {
  eq(E.todayKey(new Date(2026, 10, 5)), "2026-11-05");
});
test("applyRoutine: all four steps ok makes a new word learned", () => {
  eq(E.applyRoutine(undefined, allOk, "2026-11-12"),
    { status: "learned", lvl: 1, due: "2026-11-13", helps: 0, seen: 1, lastSeen: "2026-11-12", slow: false });
});
test("applyRoutine: any helped step keeps the word practicing", () => {
  const s = E.applyRoutine(undefined, { say: "ok", spell: "help", mean: "help", story: "ok" }, "2026-11-12");
  eq(s.status, "practicing"); eq(s.lvl, 0); eq(s.due, "2026-11-13"); eq(s.helps, 2); eq(s.seen, 1);
});
test("applyRoutine: helps accumulate across attempts", () => {
  const first = E.applyRoutine(undefined, { ...allOk, spell: "help" }, "2026-11-12");
  const second = E.applyRoutine(first, { ...allOk, say: "help" }, "2026-11-13");
  eq(second.helps, 2); eq(second.seen, 2); eq(second.status, "practicing");
});
test("applyRoutine: a placed word becomes learned after an all-ok routine", () => {
  const s = E.applyRoutine({ status: "placed", lvl: 0, due: null, helps: 0, seen: 0, lastSeen: null }, allOk, "2026-11-12");
  eq(s.status, "learned"); eq(s.lvl, 1);
});
test("applyReview: a passed review moves to the next interval", () => {
  const s = E.applyReview({ status: "learned", lvl: 1, due: "2026-11-13", helps: 0, seen: 1, lastSeen: "2026-11-12" }, true, "2026-11-13");
  eq(s.lvl, 2); eq(s.due, "2026-11-16"); eq(s.status, "learned");
});
test("applyReview: intervals stop growing at 30 days", () => {
  const s = E.applyReview({ status: "learned", lvl: 5, due: "2026-11-13", helps: 0, seen: 5, lastSeen: "2026-11-01" }, true, "2026-11-13");
  eq(s.due, "2026-12-13");
});
test("applyReview: a missed review sends the word back to practicing", () => {
  const s = E.applyReview({ status: "learned", lvl: 3, due: "2026-11-13", helps: 0, seen: 3, lastSeen: "2026-11-06" }, false, "2026-11-13");
  eq(s.status, "practicing"); eq(s.lvl, 0); eq(s.due, "2026-11-14");
});
test("dueReviews: only learned words that are due, oldest first", () => {
  const words = {
    a: { status: "learned", due: "2026-11-12" },
    b: { status: "learned", due: "2026-11-10" },
    c: { status: "learned", due: "2026-11-20" },
    d: { status: "practicing", due: "2026-11-01" },
  };
  eq(E.dueReviews(words, "2026-11-12"), ["b", "a"]);
});
test("dueReviews: capped at 8 after a long break", () => {
  const words = {};
  for (let i = 0; i < 30; i++) words["w" + i] = { status: "learned", due: "2026-11-01" };
  eq(E.dueReviews(words, "2026-11-12").length, 8);
});
test("INTERVALS are 1, 3, 7, 14, 30 days", () => {
  eq(E.INTERVALS, [1, 3, 7, 14, 30]);
});

// ---- Task 2: matching, story check, text helpers ----
test("matchSpoken ignores case and punctuation", () => { eq(E.matchSpoken("Ship!", "ship"), true); });
test("matchSpoken rejects a different word in a phrase", () => { eq(E.matchSpoken("I said shop", "ship"), false); });
test("matchSpoken accepts the target anywhere in a phrase", () => { eq(E.matchSpoken("um ship", "ship"), true); });
test("matchSpoken accepts a listed same-sound word", () => { eq(E.matchSpoken("blew", "blue", { blue: ["blew"] }), true); });
test("matchSpoken allows one letter off for long words", () => { eq(E.matchSpoken("Janury", "January"), true); });
test("matchSpoken does not allow one letter off for short words", () => { eq(E.matchSpoken("cap", "cat"), false); });
test("matchSpoken rejects silence", () => { eq(E.matchSpoken("", "cat"), false); });
test("matchSpoken matches a capitalized target", () => { eq(E.matchSpoken("monday", "Monday"), true); });
test("editDistance counts single edits", () => { eq(E.editDistance("kitten", "sitten"), 1); eq(E.editDistance("abc", "abc"), 0); eq(E.editDistance("ab", "abcd"), 2); });
test("tokens lowercases, keeps apostrophes, drops other punctuation", () => {
  eq(E.tokens("Sam's cat sat. \"Yes!\""), ["sam's", "cat", "sat", "yes"]);
});
test("offListWords returns each off-list word once", () => {
  eq(E.offListWords("Sam sat. Sam ran to the big van! The van.", new Set(["sam", "sat", "ran", "to", "the", "big"])), ["van"]);
});
test("offListWords accepts a possessive of an allowed word", () => {
  eq(E.offListWords("Sam's cat", new Set(["sam", "cat"])), []);
});
test("soundChunks keeps letter teams together", () => {
  eq(E.soundChunks("ship", E.CHUNKS), ["sh", "i", "p"]);
  eq(E.soundChunks("night", E.CHUNKS), ["n", "igh", "t"]);
  eq(E.soundChunks("rain", E.CHUNKS), ["r", "ai", "n"]);
  eq(E.soundChunks("jump", E.CHUNKS), ["j", "u", "m", "p"]);
});
test("soundChunks keeps a capital letter", () => { eq(E.soundChunks("March", E.CHUNKS), ["M", "ar", "ch"]); });
test("highlightParts marks the pattern letters", () => {
  eq(E.highlightParts("fish", ["sh"]), [{ t: "fi", hi: false }, { t: "sh", hi: true }]);
});
test("highlightParts with no pattern returns the whole word plain", () => {
  eq(E.highlightParts("cat", []), [{ t: "cat", hi: false }]);
});
test("highlightParts marks every occurrence", () => {
  eq(E.highlightParts("shush", ["sh"]), [{ t: "sh", hi: true }, { t: "u", hi: false }, { t: "sh", hi: true }]);
});
test("matchSpoken accepts a digit the recognizer wrote for a number word", () => {
  eq(E.matchSpoken("2", "two", { two: ["to", "too", "2"] }), true);
});

// ---- Task 3: lesson builder, progression, placement, parent insights ----
const mk = (w, step, extra = {}) => ({ w, step, kind: "thing", cat: null, mean: "m " + w, ex: "e " + w, pat: null, ...extra });
const content = {
  STEPS: [
    { id: 1, name: "Short a and i", pats: ["a", "i"], intro: {},
      words: ["cat", "map", "sat", "pig", "sit", "big", "hat", "pin", "man", "lip"].map((w) => mk(w, 1, { pat: w.includes("a") ? "a" : "i" })) },
    { id: 2, name: "sh and ch", pats: ["sh", "ch"], intro: {},
      words: ["ship", "shop", "fish", "dish", "chin", "chop", "much", "rich", "shed", "chat"].map((w) => mk(w, 2, { pat: w.includes("sh") ? "sh" : "ch" })) },
  ],
  SIGHT: ["the", "said", "was"].map((w) => mk(w, 0, { kind: "little" })),
  EVERYDAY: ["red", "blue", "green"].map((w) => mk(w, 0, { kind: "everyday", cat: "color" })),
  HELPERS: ["a", "and"],
};
const profile = (over = {}) => ({ name: "Zoe", favorites: ["soccer", "ice cream"], step: 1, stepStartedDay: "2026-11-12",
  introduced: [], recentHelpFree: [], ...over });
const learned = (due = "2026-12-30", lastSeen = "2026-11-10") => ({ status: "learned", lvl: 2, due, lastSeen, helps: 0, seen: 2 });
const T = "2026-11-12";

test("buildLesson: a fresh learner gets 3 step words, 1 sight word, 1 everyday word", () => {
  const l = E.buildLesson({ profile: profile(), words: {}, content, today: T });
  eq(l.newWords, ["cat", "map", "sat"]); eq(l.sight, ["the"]); eq(l.everyday, ["red"]);
  eq(l.reviews, []); eq(l.placed, []); eq(l.step, 1);
});
test("buildLesson: warm-up has 5 words and falls back to step words not being taught today", () => {
  const l = E.buildLesson({ profile: profile(), words: {}, content, today: T });
  eq(l.warmup, ["pig", "sit", "big", "hat", "pin"]);
});
test("buildLesson: warm-up prefers learned words, most recently seen first, skipping due reviews", () => {
  const words = { cat: learned("2026-12-30", "2026-11-10"), map: learned("2026-12-30", "2026-11-11"), sat: learned("2026-11-12", "2026-11-11") };
  const l = E.buildLesson({ profile: profile(), words, content, today: T });
  eq(l.warmup.slice(0, 2), ["map", "cat"]); eq(l.warmup.length, 5); ok(!l.warmup.includes("sat"));
  eq(l.reviews, ["sat"]);
});
test("buildLesson: two everyday words after three help-free lessons", () => {
  const l = E.buildLesson({ profile: profile({ recentHelpFree: [true, true, true] }), words: {}, content, today: T });
  eq(l.everyday, ["red", "blue"]);
});
test("buildLesson: one everyday word if any recent lesson needed help", () => {
  const l = E.buildLesson({ profile: profile({ recentHelpFree: [true, false, true] }), words: {}, content, today: T });
  eq(l.everyday.length, 1);
});
test("buildLesson: reviews are capped at 8 after a long break", () => {
  const words = {};
  for (let i = 0; i < 30; i++) words["w" + i] = learned("2026-11-01");
  eq(E.buildLesson({ profile: profile(), words, content, today: T }).reviews.length, 8);
});
test("buildLesson: at most 3 placed words come back, lowest step first", () => {
  const words = {};
  for (const w of ["ship", "shop", "cat", "map", "sat", "pig", "the", "red", "fish", "dish"]) words[w] = { status: "placed", lvl: 0, due: null, helps: 0, seen: 0 };
  const l = E.buildLesson({ profile: profile({ step: 2 }), words, content, today: T });
  eq(l.placed, ["cat", "map", "sat"]);
});
test("buildLesson: practicing words come before unseen ones, oldest first", () => {
  const words = { pig: { status: "practicing", lastSeen: "2026-11-10" }, sit: { status: "practicing", lastSeen: "2026-11-09" } };
  eq(E.buildLesson({ profile: profile(), words, content, today: T }).newWords, ["sit", "pig", "cat"]);
});
test("buildLesson: fills from earlier steps' practicing words when the step is nearly done", () => {
  const words = { map: { status: "practicing", lastSeen: "2026-11-01" } };
  for (const w of ["ship", "shop", "fish", "dish", "chin", "chop", "much", "rich", "shed"]) words[w] = learned();
  eq(E.buildLesson({ profile: profile({ step: 2 }), words, content, today: T }).newWords, ["chat", "map"]);
});
test("buildLesson: introPattern is the first new word's pattern that has not been taught", () => {
  const l = E.buildLesson({ profile: profile(), words: {}, content, today: T });
  eq(l.introPattern, "a"); eq(l.introWords, ["hat", "man"]);
});
test("buildLesson: no intro when today's patterns were already taught", () => {
  const l = E.buildLesson({ profile: profile({ introduced: ["a", "i"] }), words: {}, content, today: T });
  eq(l.introPattern, null); eq(l.introWords, []);
});
test("stepProgress counts learned words in the step", () => {
  const words = { cat: learned(), map: learned(), sat: { status: "practicing" }, pig: { status: "placed" } };
  eq(E.stepProgress(1, words, content), { learned: 2, total: 10, pct: 0.2 });
});
test("canAdvance: needs 8 in 10 learned and at most 2 helped story words", () => {
  const w8 = {}, w7 = {};
  content.STEPS[0].words.slice(0, 8).forEach((e) => (w8[e.w] = learned()));
  content.STEPS[0].words.slice(0, 7).forEach((e) => (w7[e.w] = learned()));
  eq(E.canAdvance(1, w8, content, 2), true);
  eq(E.canAdvance(1, w7, content, 0), false);
  eq(E.canAdvance(1, w8, content, 3), false);
});
test("canAdvance: the last step never advances", () => {
  const all = {};
  content.STEPS[1].words.forEach((e) => (all[e.w] = learned()));
  eq(E.canAdvance(2, all, content, 0), false);
});
test("isStuck: 15 practice days on the same step", () => {
  const days = (n) => Array.from({ length: n }, (_, i) => E.addDays("2026-11-12", i));
  eq(E.isStuck(profile(), days(15)), true);
  eq(E.isStuck(profile(), days(14)), false);
  eq(E.isStuck(profile({ stepStartedDay: "2026-11-20" }), days(15)), false);
});
test("placementStep: first step with two or more misses", () => {
  eq(E.placementStep({ 1: [true, true, true, true], 2: [true, false, true, false], 3: [false, false, false, false] }), 2);
});
test("placementStep: no misses anywhere means the top step", () => {
  eq(E.placementStep({ 1: [true, true, true, true], 2: [true, true, false, true] }, 10), 10);
});
test("wpm rounds words per minute and survives zero time", () => {
  eq(E.wpm(40, 60000), 40); eq(E.wpm(30, 45000), 40); eq(E.wpm(10, 0), 0);
});
test("wpm ignores a read too fast to be real, so a stray tap cannot fake a score", () => {
  eq(E.wpm(6, 300), 0);
  eq(E.wpm(6, 1400), 0);
  eq(E.wpm(6, 4000), 90);
});
test("wpm never reports more than a person could read", () => {
  eq(E.wpm(900, 60000), 400);
});
test("tipForTonight names the practicing word that needed the most help", () => {
  const words = { February: { status: "practicing", helps: 3 }, cat: { status: "practicing", helps: 1 }, map: { status: "learned", helps: 9 } };
  eq(E.tipForTonight(words), 'Practice "February": she needed help 3 times.');
  eq(E.tipForTonight({ cat: { status: "practicing", helps: 1 } }), 'Practice "cat": she needed help 1 time.');
  eq(E.tipForTonight({ map: { status: "learned", helps: 0 } }), null);
});
test("allowedWords includes her name, favorite-thing words, helpers, and words up to her step", () => {
  const a = E.allowedWords({ profile: profile({ step: 1 }), words: { the: learned(), ship: { status: "placed" } }, content });
  for (const w of ["zoe", "soccer", "ice", "cream", "a", "and", "cat", "lip", "the", "ship"]) ok(a.has(w), "missing " + w);
  ok(!a.has("shop"), "shop is above her step and not learned");
});
test("streak counts back from today, or from yesterday if today is not done yet", () => {
  eq(E.streak(["2026-11-10", "2026-11-11", "2026-11-12"], "2026-11-12"), 3);
  eq(E.streak(["2026-11-10", "2026-11-11"], "2026-11-12"), 2);
  eq(E.streak(["2026-11-08", "2026-11-11", "2026-11-12"], "2026-11-12"), 2);
  eq(E.streak(["2026-11-09"], "2026-11-12"), 0);
  eq(E.streak([], "2026-11-12"), 0);
});

// ---- Read-along: following her as she reads a story ----
const toks = (s) => E.tokens(s);
test("readAlong: a clean read matches every word", () => {
  eq(E.matchReadAlong(toks("The cat sat"), toks("the cat sat")), 3);
});
test("readAlong: filler words between the real ones are ignored", () => {
  eq(E.matchReadAlong(toks("The cat sat"), toks("the um cat uh sat")), 3);
});
test("readAlong: a skipped word does not stall the rest", () => {
  eq(E.matchReadAlong(toks("The big cat sat"), toks("the big sat")), 4);
});
test("readAlong: a wrong word does not count as read", () => {
  eq(E.matchReadAlong(toks("The cat sat"), toks("the dog")), 1);
});
test("readAlong: nothing heard yet means nothing read", () => {
  eq(E.matchReadAlong(toks("The cat sat"), []), 0);
});
test("buildLesson: no word is both a warm-up and a word she is taught today", () => {
  const words = {};
  for (const w of ["ship", "shop", "fish"]) words[w] = { status: "placed", lvl: 0, due: null, helps: 0, seen: 0 };
  const l = E.buildLesson({ profile: profile({ step: 2 }), words, content, today: T });
  const taught = new Set([...l.newWords, ...l.placed, ...l.sight, ...l.everyday, ...l.reviews]);
  eq(l.warmup.filter((w) => taught.has(w)), []);
});

// ---- Fluency: reading a word whole, not spelling it out first ----
const slowSay = { say: "slow", spell: "ok", mean: "ok", story: "ok" };
test("fluency: a word read right away is learned", () => {
  const s = E.applyRoutine(undefined, allOk, "2026-11-12");
  eq(s.status, "learned"); eq(s.slow, false);
});
test("fluency: a word she sounded out is not learned yet, and comes back tomorrow", () => {
  const s = E.applyRoutine(undefined, slowSay, "2026-11-12");
  eq(s.status, "practicing"); eq(s.slow, true); eq(s.due, "2026-11-13"); eq(s.helps, 0);
});
test("fluency: sounding out is not counted as needing help", () => {
  eq(E.applyRoutine(undefined, slowSay, "2026-11-12").helps, 0);
});
test("fluency: a word that needed help goes back to the full routine, not to fast practice", () => {
  const s = E.applyRoutine(undefined, { say: "slow", spell: "help", mean: "ok", story: "ok" }, "2026-11-12");
  eq(s.status, "practicing"); eq(s.slow, false); eq(s.helps, 1);
});
test("fast practice: reading a sounded-out word right away promotes it", () => {
  const before = { status: "practicing", slow: true, lvl: 0, due: "2026-11-13", helps: 0, seen: 1, lastSeen: "2026-11-12" };
  const s = E.applyFast(before, "ok", "2026-11-13");
  eq(s.status, "learned"); eq(s.lvl, 1); eq(s.slow, false); eq(s.due, "2026-11-14");
});
test("fast practice: a learned word read right away moves to the next review", () => {
  const before = { status: "learned", slow: false, lvl: 2, due: "2026-11-13", helps: 0, seen: 3, lastSeen: "2026-11-10" };
  const s = E.applyFast(before, "ok", "2026-11-13");
  eq(s.lvl, 3); eq(s.due, "2026-11-20"); eq(s.status, "learned");
});
test("fast practice: a learned word she now sounds out goes back to fast practice", () => {
  const before = { status: "learned", slow: false, lvl: 3, due: "2026-11-13", helps: 0, seen: 4, lastSeen: "2026-11-10" };
  const s = E.applyFast(before, "slow", "2026-11-13");
  eq(s.status, "practicing"); eq(s.slow, true); eq(s.lvl, 0); eq(s.due, "2026-11-14");
});
test("fast practice: a word she could not read at all needs the whole routine again", () => {
  const before = { status: "learned", slow: false, lvl: 3, due: "2026-11-13", helps: 0, seen: 4, lastSeen: "2026-11-10" };
  const s = E.applyFast(before, "miss", "2026-11-13");
  eq(s.status, "practicing"); eq(s.slow, false); eq(s.helps, 1);
});
test("fluency counts: how many she reads right away and how many she sounds out", () => {
  const words = {
    cat: { status: "learned", slow: false }, map: { status: "learned", slow: false },
    ship: { status: "practicing", slow: true }, fish: { status: "practicing", slow: true },
    chin: { status: "practicing", slow: false }, dish: { status: "placed" },
  };
  eq(E.fluencyCounts(words), { instant: 2, slow: 2 });
  eq(E.slowWords(words), ["fish", "ship"]);
});
test("buildLesson: fast practice takes sounded-out words first, oldest first", () => {
  const words = {
    cat: { status: "practicing", slow: true, lastSeen: "2026-11-10" },
    map: { status: "practicing", slow: true, lastSeen: "2026-11-09" },
    sat: { status: "learned", slow: false, due: "2026-12-30", lastSeen: "2026-11-11" },
  };
  const l = E.buildLesson({ profile: profile(), words, content, today: T });
  eq(l.warmup.slice(0, 3), ["map", "cat", "sat"]);
});
test("buildLesson: a sounded-out word is not taught from scratch again", () => {
  const words = { cat: { status: "practicing", slow: true, lastSeen: "2026-11-10" } };
  const l = E.buildLesson({ profile: profile(), words, content, today: T });
  ok(!l.newWords.includes("cat"), "cat belongs in fast practice, not new words");
  ok(l.warmup.includes("cat"));
});

// ---- A progress summary a parent can send to themselves ----
test("summary: says where she is in plain words", () => {
  const words = {
    cat: { status: "learned", slow: false }, map: { status: "learned", slow: false },
    ship: { status: "practicing", slow: true, lastSeen: "2026-11-13" },
    pig: { status: "practicing", slow: false, helps: 4 },
  };
  const days = { "2026-11-12": { minutes: 15, practiced: ["cat"], storyWpm: [30, 38] }, "2026-11-13": { minutes: 16, practiced: ["map"], storyWpm: [34, 44] } };
  const text = E.progressSummary({ profile: profile({ step: 2, name: "Ava" }), words, days, content, today: "2026-11-13" });
  ok(text.includes("Ava"), text);
  ok(text.includes("2 days practiced"), text);
  ok(text.includes("Reads whole: 2"), text);
  ok(text.includes("Still sounds out: 1"), text);
  ok(text.includes("ship"), text);
  ok(text.includes("Step 2"), text);
  ok(text.includes("34 then 44"), text);
  ok(text.includes("pig"), text);
});
test("summary: a brand new learner still gets a readable note", () => {
  const text = E.progressSummary({ profile: profile(), words: {}, days: {}, content, today: "2026-11-13" });
  ok(text.includes("Reads whole: 0"), text);
  ok(!text.includes("undefined"), text);
  ok(!text.includes("NaN"), text);
});
