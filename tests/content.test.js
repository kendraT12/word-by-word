import { test, eq, ok } from "./t.js";
import * as C from "../content.js";
import * as S from "../stories.js";
import { offListWords, tokens } from "../engine.js";

const all = () => C.STEPS.flatMap((s) => s.words).concat(C.SIGHT, C.EVERYDAY);
const everyStory = () => C.STEPS.flatMap((s) => S.STORIES[s.id])
  .concat(Object.keys(S.EVERYDAY_STORIES).flatMap((c) => S.EVERYDAY_STORIES[c]));
const everyday = (cat) => C.EVERYDAY.filter((e) => e.cat === cat).map((e) => e.w);

test("content: 14 steps with at least 12 words each, ids 1..14", () => {
  eq(C.STEPS.length, 14);
  C.STEPS.forEach((s, i) => { eq(s.id, i + 1); ok(s.words.length >= 12, "step " + s.id + " has " + s.words.length); });
});
test("content: every word has an example sentence, and a meaning or a fill-in", () => {
  for (const e of all()) {
    ok(e.w && e.ex, "missing w/ex: " + JSON.stringify(e));
    if (e.kind === "little") {
      ok(e.fill && e.fill.includes("___"), e.w + " needs fill with ___");
      ok(Array.isArray(e.alts) && e.alts.length === 2, e.w + " needs 2 alts");
    } else {
      ok(e.mean && e.mean.split(" ").length <= 12, e.w + " needs a short mean");
    }
    ok(["thing", "action", "describe", "little", "everyday"].includes(e.kind), e.w + " bad kind " + e.kind);
  }
});
test("content: step words know their step and no word is listed twice", () => {
  const seen = new Set();
  for (const s of C.STEPS) for (const e of s.words) eq(e.step, s.id, e.w);
  for (const e of all()) { ok(!seen.has(e.w), "duplicate word " + e.w); seen.add(e.w); }
});
test("content: every pattern used by a step word has intro text", () => {
  for (const s of C.STEPS) for (const e of s.words) {
    if (e.pat) ok(s.intro[e.pat] && s.pats.includes(e.pat), "step " + s.id + " missing intro for " + e.pat);
  }
});
test("content: everyday words cover colors, numbers, days, months, seasons", () => {
  eq(everyday("color").length, 11);
  eq(everyday("number"), ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]);
  eq(everyday("day"), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  eq(everyday("month"), ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"]);
  eq(everyday("season"), ["winter", "spring", "summer", "fall"]);
  eq(everyday("time"), ["today", "yesterday", "tomorrow"]);
});
test("content: everyday teaching order is colors, one-ten, days, months, eleven-twenty, seasons", () => {
  const idx = (w) => C.EVERYDAY.findIndex((e) => e.w === w);
  ok(idx("gray") < idx("one") && idx("ten") < idx("Monday") && idx("tomorrow") < idx("January")
    && idx("December") < idx("eleven") && idx("twenty") < idx("winter"));
});
test("content: sight words name their list", () => {
  ok(C.SIGHT.length >= 36);
  for (const e of C.SIGHT) ok(["pre-primer", "primer", "first", "second"].includes(e.list), e.w);
});
test("content: 26 letter-sound questions, each answer among its 3 choices", () => {
  eq(C.PLACEMENT_SOUNDS.length, 26);
  for (const q of C.PLACEMENT_SOUNDS) {
    eq(q.choices.length, 3); ok(q.choices.includes(q.answer), q.say);
    ok(["start", "middle", "end"].includes(q.where), q.say);
  }
  eq(new Set(C.PLACEMENT_SOUNDS.map((q) => q.answer)).size, 26);
});
test("content: no emoji or pictographs anywhere", () => {
  const text = JSON.stringify([C.STEPS, C.SIGHT, C.EVERYDAY, C.HELPERS, C.PLACEMENT_SOUNDS,
    S.STORIES, S.EVERYDAY_STORIES]);
  ok(!/\p{Extended_Pictographic}/u.test(text));
});
test("stories: 6 per step, 4 to 8 sentences, questions answerable", () => {
  for (const s of C.STEPS) {
    const list = S.STORIES[s.id];
    ok(list && list.length === 6, "step " + s.id + " needs 6 stories, has " + (list ? list.length : 0));
    for (const st of list) {
      const n = st.text.split(/[.!?]+/).filter((x) => x.trim()).length;
      ok(n >= 4 && n <= 8, st.title + " has " + n + " sentences");
      ok(st.q.length >= 1 && st.q.length <= 2, st.title + " questions");
      for (const q of st.q) { eq(q.choices.length, 3); ok(q.choices.includes(q.answer), st.title + ": " + q.ask); }
    }
  }
});
test("stories: no title is used twice, so a repeat always reads as a repeat", () => {
  const seen = new Set();
  for (const st of everyStory()) {
    ok(!seen.has(st.title), "two stories are called \"" + st.title + "\"");
    seen.add(st.title);
  }
});
test("everyday stories: one set per kind of everyday word, 4 to 8 sentences, questions answerable", () => {
  eq(Object.keys(S.EVERYDAY_STORIES), ["color", "number", "day", "month", "season"]);
  for (const cat of Object.keys(S.EVERYDAY_STORIES)) {
    const list = S.EVERYDAY_STORIES[cat];
    ok(list.length >= 2, cat + " needs at least 2 stories, has " + list.length);
    for (const st of list) {
      const n = st.text.split(/[.!?]+/).filter((x) => x.trim()).length;
      ok(n >= 4 && n <= 8, st.title + " has " + n + " sentences");
      ok(st.q.length >= 1 && st.q.length <= 2, st.title + " questions");
      for (const q of st.q) { eq(q.choices.length, 3); ok(q.choices.includes(q.answer), st.title + ": " + q.ask); }
    }
  }
});
test("everyday stories: between them they use every color, day, month, season and number", () => {
  const cat = (c) => C.EVERYDAY.filter((e) => e.cat === c).map((e) => e.w.toLowerCase());
  const used = (c) => new Set(S.EVERYDAY_STORIES[c].flatMap((st) => tokens(st.text)));
  for (const [storyCat, wordCat] of [["color", "color"], ["day", "day"], ["month", "month"], ["season", "season"]]) {
    const seen = used(storyCat);
    const missing = cat(wordCat).filter((w) => !seen.has(w));
    eq(missing, [], storyCat + " stories never use");
  }
  const seenNumbers = used("number");
  eq(cat("number").filter((w) => !seenNumbers.has(w)), [], "number stories never use");
  // Every "when" word gets read somewhere too, so today/yesterday/tomorrow are not taught and dropped.
  const everywhere = new Set(Object.keys(S.EVERYDAY_STORIES).flatMap((c) => [...used(c)]));
  eq(cat("time").filter((w) => !everywhere.has(w)), [], "no story uses");
});
// Held to the first three steps so a story arrives when she learns the words, not weeks later:
// anything from a later step would gate the story behind a sound she has not reached.
test("everyday stories: only taught words, and only sounds from the first three steps", () => {
  const allowed = new Set(["zoe"]);
  C.STEPS.slice(0, 3).forEach((s) => s.words.forEach((e) => allowed.add(e.w.toLowerCase())));
  C.SIGHT.forEach((e) => allowed.add(e.w.toLowerCase()));
  C.EVERYDAY.forEach((e) => allowed.add(e.w.toLowerCase()));
  C.HELPERS.forEach((h) => tokens(h).forEach((t) => allowed.add(t)));
  for (const cat of Object.keys(S.EVERYDAY_STORIES)) for (const st of S.EVERYDAY_STORIES[cat]) {
    const off = offListWords(st.text.replaceAll("{name}", "Zoe"), allowed);
    eq(off, [], "\"" + st.title + "\" off-list");
  }
});
test("stories: each uses only words taught by its step, with nothing left over", () => {
  for (const s of C.STEPS) {
    const allowed = new Set(["zoe"]);
    C.STEPS.slice(0, s.id).forEach((x) => x.words.forEach((e) => allowed.add(e.w.toLowerCase())));
    C.SIGHT.forEach((e) => allowed.add(e.w.toLowerCase()));
    C.HELPERS.forEach((h) => tokens(h).forEach((t) => allowed.add(t)));
    for (const st of S.STORIES[s.id]) {
      const off = offListWords(st.text.replaceAll("{name}", "Zoe"), allowed);
      ok(off.length === 0, "step " + s.id + " \"" + st.title + "\" off-list: " + off.join(", "));
    }
  }
});
// A lesson teaches one sight word and one everyday word, both in list order, so a story
// holding a late sight word waits for that word instead of for the words it is there to drill.
test("everyday stories: no sight word makes a story wait longer than its everyday words", () => {
  const place = (list) => new Map(list.map((e, i) => [e.w.toLowerCase(), i + 1]));
  const sightAt = place(C.SIGHT), everydayAt = place(C.EVERYDAY);
  for (const cat of Object.keys(S.EVERYDAY_STORIES)) for (const st of S.EVERYDAY_STORIES[cat]) {
    let sight = 0, sightWord = "", everyday = 0;
    for (const t of tokens(st.text)) {
      if (sightAt.has(t) && sightAt.get(t) > sight) { sight = sightAt.get(t); sightWord = t; }
      if (everydayAt.has(t)) everyday = Math.max(everyday, everydayAt.get(t));
    }
    ok(sight <= everyday, "\"" + st.title + "\" waits on the sight word \"" + sightWord
      + "\" (lesson " + sight + ") after its own words are known (lesson " + everyday + ")");
  }
});
test("content: homophones are lists keyed by lowercase word", () => {
  ok(C.HOMOPHONES.two.includes("2") && C.HOMOPHONES.blue.includes("blew"));
});
