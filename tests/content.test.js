import { test, eq, ok } from "./t.js";
import * as C from "../content.js";
import * as S from "../stories.js";
import { offListWords, tokens } from "../engine.js";

const all = () => C.STEPS.flatMap((s) => s.words).concat(C.SIGHT, C.EVERYDAY);
const everyday = (cat) => C.EVERYDAY.filter((e) => e.cat === cat).map((e) => e.w);

test("content: 10 steps with at least 12 words each, ids 1..10", () => {
  eq(C.STEPS.length, 10);
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
  const text = JSON.stringify([C.STEPS, C.SIGHT, C.EVERYDAY, C.HELPERS, C.PLACEMENT_SOUNDS, S.STORIES]);
  ok(!/\p{Extended_Pictographic}/u.test(text));
});
test("stories: 3 per step, 4 to 8 sentences, questions answerable", () => {
  for (const s of C.STEPS) {
    const list = S.STORIES[s.id];
    ok(list && list.length === 3, "step " + s.id + " needs 3 stories");
    for (const st of list) {
      const n = st.text.split(/[.!?]+/).filter((x) => x.trim()).length;
      ok(n >= 4 && n <= 8, st.title + " has " + n + " sentences");
      ok(st.q.length >= 1 && st.q.length <= 2, st.title + " questions");
      for (const q of st.q) { eq(q.choices.length, 3); ok(q.choices.includes(q.answer), st.title + ": " + q.ask); }
    }
  }
});
test("stories: each uses only words taught by its step (at most 2 others)", () => {
  for (const s of C.STEPS) {
    const allowed = new Set(["zoe"]);
    C.STEPS.slice(0, s.id).forEach((x) => x.words.forEach((e) => allowed.add(e.w.toLowerCase())));
    C.SIGHT.forEach((e) => allowed.add(e.w.toLowerCase()));
    C.HELPERS.forEach((h) => tokens(h).forEach((t) => allowed.add(t)));
    for (const st of S.STORIES[s.id]) {
      const off = offListWords(st.text.replaceAll("{name}", "Zoe"), allowed);
      ok(off.length <= 2, "step " + s.id + " \"" + st.title + "\" off-list: " + off.join(", "));
    }
  }
});
test("content: homophones are lists keyed by lowercase word", () => {
  ok(C.HOMOPHONES.two.includes("2") && C.HOMOPHONES.blue.includes("blew"));
});
