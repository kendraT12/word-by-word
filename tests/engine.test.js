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
test("placementStep: the first-day check never places her past the 2nd-grade ladder", () => {
  // Steps past 10 are earned, never handed out by a letter-sound check: a 7-year-old
  // who makes no mistakes on letter sounds still cannot read contractions.
  const perfect = {};
  for (let i = 1; i <= 14; i++) perfect[i] = [true, true, true, true];
  eq(E.placementStep(perfect, 14), E.MAX_PLACEMENT_STEP);
  eq(E.MAX_PLACEMENT_STEP, 10);
  eq(E.placementStep(perfect, 4), 4, "fewer steps than the cap");
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

// ---- Choosing the story for today ----
const st = (title, text) => ({ title, text, q: [] });
const stepStories = { 1: [st("S1", "The cat sat."), st("S2", "The pig is big."), st("S3", "A map and a hat.")] };
const dayStories = [st("Colors", "The cat is red and the pig is blue."), st("More", "The map is green.")];

test("unknownWords: names the taught words she has not learned, and leaves helpers alone", () => {
  const words = { cat: learned(), red: learned() };
  eq(E.unknownWords("The cat is red and the pig is blue.", words, content), ["the", "pig", "blue"]);
});
test("unknownWords: a word credited by the first-day check counts as known", () => {
  const words = { cat: { status: "placed" }, red: { status: "placed" }, the: learned(), pig: learned(), blue: learned() };
  eq(E.unknownWords("The cat is red and the pig is blue.", words, content), []);
});
test("readableStories: keeps only the ones she can read today", () => {
  const words = { the: learned(), cat: learned(), pig: learned(), red: learned(), blue: learned() };
  eq(E.readableStories(dayStories, words, content).map((s) => s.title), ["Colors"]);
});
test("chooseStory: before any everyday story is ready, it rotates the step stories", () => {
  const words = {};
  const pick = (dayCount) => E.chooseStory({ step: 1, words, content, stories: stepStories, everydayStories: dayStories, dayCount }).title;
  eq([0, 1, 2, 3].map(pick), ["S1", "S2", "S3", "S1"]);
});
test("chooseStory: once she can read one, every other day is an everyday story", () => {
  const words = { the: learned(), cat: learned(), pig: learned(), map: learned(), red: learned(), blue: learned(), green: learned() };
  const pick = (dayCount) => E.chooseStory({ step: 1, words, content, stories: stepStories, everydayStories: dayStories, dayCount }).title;
  eq([0, 1, 2, 3, 4, 5].map(pick), ["S1", "Colors", "S2", "More", "S3", "Colors"]);
});
test("chooseStory: no step stories for her step falls back to step 1", () => {
  ok(E.chooseStory({ step: 9, words: {}, content, stories: stepStories, everydayStories: [], dayCount: 0 }).title === "S1");
});

// ---- Maths, Task 1: the routine's step names are not the reading's ----
const MSTEPS = ["tried", "family", "why", "problem"];
test("applyRoutine: a maths result marks a fact learned when she knew it first try", () => {
  const r = { tried: "ok", family: "ok", why: "ok", problem: "ok" };
  const s = E.applyRoutine(null, r, "2026-11-26", MSTEPS, "tried");
  eq(s.status, "learned"); eq(s.lvl, 1); eq(s.slow, false);
});
test("applyRoutine: a fact she worked out is practising, not learned", () => {
  const s = E.applyRoutine(null, { tried: "slow", family: "ok", why: "ok", problem: "ok" }, "2026-11-26", MSTEPS, "tried");
  eq(s.status, "practicing"); eq(s.slow, true);
});
test("applyRoutine: a maths step she needed help on counts as a help", () => {
  const s = E.applyRoutine(null, { tried: "ok", family: "help", why: "ok", problem: "ok" }, "2026-11-26", MSTEPS, "tried");
  eq(s.status, "practicing"); eq(s.helps, 1); eq(s.slow, false);
});

// ---- Maths, Task 3: scheduling facts and building a maths lesson ----
import * as MC from "../math-content.js";

const factLearned = (due = "2026-12-01") => ({ status: "learned", lvl: 1, due, helps: 0, seen: 1, lastSeen: "2026-11-20", slow: false });
const factSlow = (lastSeen = "2026-11-25") => ({ status: "practicing", lvl: 0, due: "2026-11-26", helps: 0, seen: 1, lastSeen, slow: true });

// A small ladder with exactly ten facts in its first level, so the 80% line is testable.
const tinyMath = {
  LEVELS: [
    { id: 1, name: "First ten", idea: "A level that teaches ten facts.", families: [[1, 2], [3, 4], [5, 5]], drills: ["9+9", "18-9"] },
    { id: 2, name: "Second", idea: "A level after the first one.", families: [[6, 6]], drills: [] },
  ],
  familyOf: MC.familyOf,
  keysOfLevel: MC.keysOfLevel,
  levelById: (id) => tinyMath.LEVELS[Math.min(Math.max(1, id), 2) - 1],
};

test("buildMathLesson: a fresh learner gets her level and two new families", () => {
  const l = E.buildMathLesson({ profile: { mathLevel: 1 }, facts: {}, content: MC, today: "2026-11-26" });
  eq(l.level, 1);
  eq(l.newFamilies.length, E.FAMILIES_PER_LESSON);
  eq(l.newFamilies, [[0, 0], [0, 1]]);
  eq(l.reviews, []);
});
test("buildMathLesson: a family she is part way through comes before an unseen one", () => {
  const facts = { "0+3": factSlow("2026-11-20"), "3+0": { ...factSlow("2026-11-20"), slow: false } };
  const l = E.buildMathLesson({ profile: { mathLevel: 1 }, facts, content: MC, today: "2026-11-26" });
  eq(l.newFamilies[0], [0, 3]);
});
test("buildMathLesson: facts she worked out come back as Fast Facts warmup", () => {
  // Both families are finished apart from her speed, so the lesson teaches neither
  // again: a fact she can work out needs practice, not another explanation.
  const facts = {
    "7+7": factSlow("2026-11-24"), "14-7": factLearned(),
    "6+6": factSlow("2026-11-25"), "12-6": factLearned(),
  };
  const l = E.buildMathLesson({ profile: { mathLevel: 2 }, facts, content: MC, today: "2026-11-26" });
  eq(l.warmup.slice(0, 2), ["7+7", "6+6"]);
});
test("buildMathLesson: warmup never grows past the Fast Facts size", () => {
  const facts = {};
  for (let i = 0; i <= 10; i++) facts["0+" + i] = factSlow("2026-11-2" + (i % 10));
  const l = E.buildMathLesson({ profile: { mathLevel: 1 }, facts, content: MC, today: "2026-11-26" });
  eq(l.warmup.length, E.FAST_FACTS_SIZE);
});
test("buildMathLesson: facts due for review are included", () => {
  const facts = { "4+4": factLearned("2026-11-25"), "8-4": factLearned("2026-12-20") };
  const l = E.buildMathLesson({ profile: { mathLevel: 2 }, facts, content: MC, today: "2026-11-26" });
  eq(l.reviews, ["4+4"]);
});
test("buildMathLesson: nothing left in her level pulls unfinished families from the earlier ones", () => {
  const facts = {};
  for (const [a, b] of tinyMath.LEVELS[1].families) for (const k of MC.familyOf(a, b)) facts[k] = factLearned();
  for (const k of MC.familyOf(5, 5)) facts[k] = factLearned();
  facts["1+2"] = factSlow("2026-11-20");
  const l = E.buildMathLesson({ profile: { mathLevel: 2 }, facts, content: tinyMath, today: "2026-11-26" });
  // The one she has touched leads; the one she never started comes with it, because
  // a family nobody ever teaches her is a fact she never learns.
  eq(l.newFamilies, [[1, 2], [3, 4]]);
});

// Review Focus 1 — the rule the whole app turns on. Both branches are "correct".
test("a fact answered correctly but too slowly is not learned", () => {
  const s = E.applyFast(null, "slow", "2026-11-26");
  eq(s.status, "practicing"); eq(s.slow, true); eq(s.due, "2026-11-27");
});
test("a fact answered correctly inside the bar is learned", () => {
  const s = E.applyFast(null, "ok", "2026-11-26");
  eq(s.status, "learned"); eq(s.slow, false);
});

test("canAdvanceLevel: 80% of the level's facts learned, and not before", () => {
  const keys = tinyMath.LEVELS[0].families.flatMap(([a, b]) => MC.familyOf(a, b));
  eq(keys.length, 10);
  const facts = {};
  keys.slice(0, 7).forEach((k) => (facts[k] = factLearned()));
  eq(E.canAdvanceLevel(1, facts, tinyMath), false);
  facts[keys[7]] = factLearned();
  eq(E.canAdvanceLevel(1, facts, tinyMath), true);
});
test("canAdvanceLevel: the facts a level only drills again do not hold her back", () => {
  const facts = {};
  tinyMath.LEVELS[0].families.flatMap(([a, b]) => MC.familyOf(a, b)).forEach((k) => (facts[k] = factLearned()));
  eq(E.canAdvanceLevel(1, facts, tinyMath), true, "9+9 and 18-9 are never taught on this level");
});
test("canAdvanceLevel: there is nowhere to go from the last level", () => {
  const facts = {};
  MC.keysOfLevel(tinyMath.LEVELS[1]).forEach((k) => (facts[k] = factLearned()));
  eq(E.canAdvanceLevel(2, facts, tinyMath), false);
});

// Review Focus 5 — the mistake already found and fixed on the reading side.
test("mathPlacementLevel: a perfect showing still starts her at level 5, not the top", () => {
  const perfect = {};
  for (let i = 1; i <= 8; i++) perfect[i] = [true, true];
  eq(E.mathPlacementLevel(perfect, 8), E.MAX_PLACEMENT_LEVEL);
  eq(E.MAX_PLACEMENT_LEVEL, 5);
});
test("mathPlacementLevel: two missed inside a level starts her there", () => {
  eq(E.mathPlacementLevel({ 1: [true, true], 2: [false, false], 3: [true, true] }), 2);
});

test("fadeNote: nothing to say until there are four sessions to compare", () => {
  const bad = { mathMinutes: 18, mathTrace: ["ok", "ok", "ok", "slow", "miss", "miss"] };
  eq(E.fadeNote({ "2026-11-23": bad }), null);
  eq(E.fadeNote({ "2026-11-21": bad, "2026-11-22": bad, "2026-11-23": bad }), null);
});
test("fadeNote: says so when the last third of a session is consistently worse", () => {
  const bad = { mathMinutes: 18, mathTrace: ["ok", "ok", "ok", "slow", "miss", "miss"] };
  const note = E.fadeNote({ "2026-11-20": bad, "2026-11-21": bad, "2026-11-22": bad, "2026-11-23": bad });
  ok(typeof note === "string" && note.includes("12"), note);
});
test("fadeNote: an even session says nothing", () => {
  const even = { mathMinutes: 18, mathTrace: ["ok", "slow", "ok", "ok", "slow", "ok"] };
  const days = {};
  for (let i = 20; i <= 25; i++) days["2026-11-" + i] = even;
  eq(E.fadeNote(days), null);
});
test("hardestFacts: the ones she needs help with most, worst first", () => {
  const facts = {
    "8+5": { status: "practicing", helps: 3, slow: false },
    "7+6": { status: "practicing", helps: 1, slow: false },
    "4+4": { status: "learned", helps: 9, slow: false },
    "2+2": { status: "practicing", helps: 0, slow: true },
  };
  eq(E.hardestFacts(facts, 5), ["8+5", "7+6"]);
});

// ---- Maths, Task 6: the twenty-minute box ----
// Review Focus 4 — a lesson must never cut her off part way through a fact.
test("sessionOver: true only once the limit has passed, so the item in hand finishes", () => {
  const t0 = 1000;
  eq(E.sessionOver(t0, t0 + 19 * 60000), false);
  eq(E.sessionOver(t0, t0 + 20 * 60000 - 1), false);
  eq(E.sessionOver(t0, t0 + 20 * 60000), true);
});
test("sessionOver: the limit can be set, and a missing start never ends the lesson", () => {
  eq(E.sessionOver(1000, 6000, 4000), true);
  eq(E.sessionOver(1000, 4000, 4000), false);
  eq(E.sessionOver(0, 99999999), false);
  eq(E.sessionOver(null, 99999999), false);
});

// ---- Maths, Task 8: what a grown-up sees ----
test("streak: her reading days and her maths days make separate runs", () => {
  const days = {
    "2026-11-24": { minutes: 10 },
    "2026-11-25": { mathMinutes: 8 },
    "2026-11-26": { minutes: 9, mathMinutes: 7 },
  };
  const readDays = Object.keys(days).filter((k) => days[k].minutes);
  const mathDays = Object.keys(days).filter((k) => days[k].mathMinutes);
  eq(E.streak(readDays, "2026-11-26"), 1);
  eq(E.streak(mathDays, "2026-11-26"), 2);
});
test("answerSpeed: nothing to compare until she has answered on two days", () => {
  eq(E.answerSpeed({}), null);
  eq(E.answerSpeed({ "2026-11-24": { mathStartMs: [3000, 4000] } }), null);
});
test("answerSpeed: says she is getting quicker when she is", () => {
  const days = {
    "2026-11-20": { mathStartMs: [6000, 5000, 7000] },
    "2026-11-21": { mathStartMs: [5000, 6000, 5000] },
    "2026-11-22": { mathStartMs: [5000, 5000, 6000] },
    "2026-11-24": { mathStartMs: [2000, 2500, 2000] },
    "2026-11-25": { mathStartMs: [2000, 1800, 2200] },
    "2026-11-26": { mathStartMs: [1900, 2000, 2100] },
  };
  const got = E.answerSpeed(days);
  eq(got.direction, "faster");
  eq(got.now, 2000);
  eq(got.before, 5000);
});
test("answerSpeed: a small wobble is not a change", () => {
  const same = (ms) => ({ mathStartMs: [ms, ms, ms] });
  const got = E.answerSpeed({
    "2026-11-20": same(3000), "2026-11-21": same(3000), "2026-11-22": same(3000),
    "2026-11-24": same(3100), "2026-11-25": same(3000), "2026-11-26": same(2900),
  });
  eq(got.direction, "same");
});
test("answerSpeed: her first few days report a time with nothing to compare it to", () => {
  const got = E.answerSpeed({ "2026-11-25": { mathStartMs: [4000] }, "2026-11-26": { mathStartMs: [3000] } });
  eq(got.direction, "new");
  eq(got.before, null);
});
test("factTip: names the fact she needs help with most, in words a grown-up can act on", () => {
  eq(E.factTip({}), null);
  eq(E.factTip({ "8+5": { status: "practicing", helps: 3 }, "7-2": { status: "practicing", helps: 1 } }),
    "Practice 8 + 5: she needed help 3 times.");
  eq(E.factTip({ "15-7": { status: "practicing", helps: 1 } }),
    "Practice 15 − 7: she needed help 1 time.");
});
test("progressSummary: says nothing about maths until she has done some", () => {
  const content = { STEPS: [{ id: 1, name: "Short a and i", words: [{ w: "cat" }, { w: "hat" }] }] };
  const base = { profile: { name: "Ada", step: 1 }, words: { cat: { status: "learned" } }, days: { "2026-11-26": { minutes: 12 } }, content, today: "2026-11-26" };
  ok(!E.progressSummary(base).includes("Maths"));
  const withMaths = E.progressSummary({ ...base, facts: { "3+4": { status: "learned" } }, profile: { name: "Ada", step: 1, mathLevel: 2 } });
  ok(withMaths.includes("Maths"), withMaths);
  ok(withMaths.includes("Knows cold: 1"), withMaths);
});
test("buildMathLesson: her very first lesson has no Fast Facts, because she has met none", () => {
  const l = E.buildMathLesson({ profile: { mathLevel: 5 }, facts: {}, content: MC, today: "2026-11-26" });
  eq(l.warmup, []);
  eq(l.newFamilies.length, 2);
});

// ---- What the branch review found ----

// A level is measured on the facts it TEACHES. Counting the facts it only drills again
// made levels 3 and 7 unreachable for any child the check did not start at level 1:
// the drills are earlier levels' facts, and an earlier fact she was never taught could
// never become learned.
test("levelProgress: a level is measured on its own facts, not the ones it drills again", () => {
  const facts = {};
  for (const [a, b] of MC.levelById(3).families) for (const k of MC.familyOf(a, b)) facts[k] = factLearned();
  const got = E.levelProgress(3, facts, MC);
  eq(got.total, 12);
  eq(got.learned, 12);
  eq(E.canAdvanceLevel(3, facts, MC), true);
});
test("canAdvanceLevel: a child who starts at level 3 is not held back by level 1's facts", () => {
  const facts = {};
  const fams = MC.levelById(3).families;
  for (const [a, b] of fams.slice(0, 3)) for (const k of MC.familyOf(a, b)) facts[k] = factLearned();
  eq(E.canAdvanceLevel(3, facts, MC), true);
});
test("levelProgress: a level that teaches nothing is measured on the facts she has met", () => {
  const facts = { "11-2": factLearned(), "12-3": factLearned() };
  const got = E.levelProgress(7, facts, MC);
  eq(got.total, 2);
  eq(got.learned, 2);
  eq(E.canAdvanceLevel(7, facts, MC), true);
  eq(E.canAdvanceLevel(7, {}, MC), false);
});

// Families left behind when she crossed the 80% line must come back, or "every fact to
// 20" is not true. They are unstarted, so the old rule skipped them for good.
test("buildMathLesson: a family left behind on an earlier level is picked up later", () => {
  const facts = {};
  for (const l of MC.LEVELS.slice(0, 2)) {
    for (const [a, b] of l.families) for (const k of MC.familyOf(a, b)) facts[k] = factLearned();
  }
  for (const k of MC.familyOf(1, 9)) delete facts[k];
  for (const [a, b] of MC.levelById(3).families) for (const k of MC.familyOf(a, b)) facts[k] = factLearned();
  const l = E.buildMathLesson({ profile: { mathLevel: 3 }, facts, content: MC, today: "2026-11-26" });
  eq(l.newFamilies, [[1, 9]]);
});
test("placedBelowLevel: the levels under where the check put her are assumed, not taught", () => {
  const below = E.placedBelowLevel(3, MC);
  ok(below.includes("5+5"), "a level 2 fact");
  ok(below.includes("0+7"), "a level 1 fact");
  ok(!below.includes("3+7"), "nothing from her own level");
  const facts = {};
  for (const k of below) facts[k] = { status: "placed", lvl: 0, due: null, helps: 0, seen: 0, lastSeen: null, slow: false };
  const l = E.buildMathLesson({ profile: { mathLevel: 3 }, facts, content: MC, today: "2026-11-26" });
  for (const fam of l.newFamilies) ok(MC.levelById(3).families.some((f) => f[0] === fam[0] && f[1] === fam[1]), String(fam));
});

// A step she needed help on is the strongest sign she is tiring. Scoring it as nothing
// meant a fading child reported as steady.
test("fadeNote: a step she needed help on counts as tiring, not as nothing", () => {
  const bad = { mathMinutes: 18, mathTrace: ["ok", "ok", "ok", "slow", "help", "help"] };
  const note = E.fadeNote({ "2026-11-20": bad, "2026-11-21": bad, "2026-11-22": bad, "2026-11-23": bad });
  ok(typeof note === "string" && note.includes("12"), String(note));
});

// This one used to filter the days itself and never call practiceDays at all.
test("streak: a maths day does not extend her reading run", () => {
  eq(E.streak(["2026-11-24", "2026-11-26"], "2026-11-26"), 1);
  eq(E.streak(["2026-11-25", "2026-11-26"], "2026-11-26"), 2);
});
