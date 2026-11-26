import { test, eq, ok } from "./t.js";
import * as M from "../math-content.js";

const pairKey = ([a, b]) => a + ":" + b;

// ---- Fact families ----

test("families: an ordinary fact makes four, a double makes two", () => {
  eq(M.familyOf(3, 4), ["3+4", "4+3", "7-3", "7-4"]);
  eq(M.familyOf(4, 4), ["4+4", "8-4"]);
});
test("families: a fact with nothing in it still makes a family", () => {
  eq(M.familyOf(0, 5), ["0+5", "5+0", "5-0", "5-5"]);
});
test("factKey and answerOf agree on both operators", () => {
  eq(M.factKey(3, "+", 4), "3+4");
  eq(M.factKey(7, "-", 4), "7-4");
  eq(M.answerOf("3+4"), 7);
  eq(M.answerOf("7-4"), 3);
});
test("families: every key answers to a number between 0 and 20", () => {
  for (const lvl of M.LEVELS) {
    for (const [a, b] of lvl.families) {
      for (const k of M.familyOf(a, b)) ok(M.answerOf(k) >= 0 && M.answerOf(k) <= 20, k);
    }
  }
});

// ---- The ladder ----

test("ladder: the levels are numbered in order, each with a name and a one-line idea", () => {
  eq(M.LEVELS.map((l) => l.id), M.LEVELS.map((_, i) => i + 1));
  for (const l of M.LEVELS) {
    ok(l.name && l.name.length > 3, "name on level " + l.id);
    ok(l.idea && l.idea.length > 10, "idea on level " + l.id);
  }
});
test("ladder: every level has at least five facts to practise", () => {
  for (const l of M.LEVELS) {
    const n = l.families.flatMap(([a, b]) => M.familyOf(a, b)).length + l.drills.length;
    ok(n >= 5, "level " + l.id + " has only " + n);
  }
});
test("ladder: no family is taught twice", () => {
  const seen = new Set();
  for (const l of M.LEVELS) {
    for (const f of l.families) {
      ok(!seen.has(pairKey(f)), "level " + l.id + " repeats " + pairKey(f));
      seen.add(pairKey(f));
    }
  }
});
test("ladder: every fact to 20 is covered by the time the last level ends", () => {
  const taught = new Set();
  for (const l of M.LEVELS) for (const f of l.families) taught.add(pairKey(f));
  const missing = [];
  for (let a = 0; a <= 10; a++) {
    for (let b = a; b <= 10; b++) if (!taught.has(pairKey([a, b]))) missing.push(a + "+" + b);
  }
  eq(missing, []);
});
test("ladder: a level's drills are facts, and ones she has already met", () => {
  const met = new Set();
  for (const l of M.LEVELS) {
    for (const k of l.drills) ok(met.has(k), "level " + l.id + " drills " + k + " before teaching it");
    for (const f of l.families) for (const k of M.familyOf(f[0], f[1])) met.add(k);
  }
});

// ---- Word problems ----

test("problems: every level has a problem for adding and one for taking away", () => {
  for (const l of M.LEVELS) {
    const ps = M.WORD_PROBLEMS[l.id] || [];
    ok(ps.some((p) => p.op === "+"), "level " + l.id + " has no adding problem");
    ok(ps.some((p) => p.op === "-"), "level " + l.id + " has no taking-away problem");
    for (const p of ps) ok(p.text.includes("{a}") && p.text.includes("{b}"), p.text);
  }
});
test("content: no emoji anywhere in the maths content", () => {
  const all = JSON.stringify([M.LEVELS, M.WORD_PROBLEMS]);
  ok(!/\p{Extended_Pictographic}/u.test(all));
});

// ---- The keypad: how long to wait before taking her digits as her answer ----

// Review Focus 2 — she means 12 and has only tapped the 1.
test("settleDelay: waits longer when another digit could still follow", () => {
  ok(M.settleDelay("1") >= 1000, "1 could become 10 to 19");
  eq(M.settleDelay("2"), 1000, "2 could become 20");
  ok(M.settleDelay("3") < 1000, "nothing above 20 starts with 3, so 3 is final");
  ok(M.settleDelay("9") < 1000, "9 is final");
  ok(M.settleDelay("12") < 1000, "two digits is always final");
  ok(M.settleDelay("0") < 1000, "no answer starts with a nothing digit");
});
test("settleDelay: a bigger answer changes which first digits can still grow", () => {
  ok(M.settleDelay("3", 30) >= 1000, "with answers up to 30, a 3 could become 30");
  ok(M.settleDelay("4", 30) < 1000);
});

// ---- Word problems: she is never shown one she cannot read ----
import * as C from "../content.js";
import { tokens } from "../engine.js";

const learned = () => ({ status: "learned", lvl: 1, due: "2026-12-01", helps: 0, seen: 1, lastSeen: "2026-11-20", slow: false });

// Review Focus 3 — a problem she cannot read renders perfectly and teaches nothing.
test("problemFor: skips a problem holding a word she has not been taught", () => {
  const words = { the: learned(), pig: learned() };
  eq(M.problemFor(1, "4+3", { words, content: C }), null);
});
test("problemFor: offers one when every word in it is hers", () => {
  const words = { the: learned(), cat: learned(), hat: learned() };
  const got = M.problemFor(1, "4+3", { words, content: C });
  ok(got && got.text === "The cat had 4 hats. Mom got him 3 hats.", got && got.text);
});
test("problemFor: a plural counts as the word it comes from", () => {
  const words = { bag: learned() };
  eq(M.problemFor(5, "6+2", { words, content: C }), null);
  words.sock = learned();
  ok(M.problemFor(5, "6+2", { words, content: C }).text.includes("6 socks"));
});
test("problemFor: a taking-away fact gets a taking-away problem", () => {
  const words = { chip: learned(), of: learned(), we: learned() };
  const got = M.problemFor(5, "8-3", { words, content: C });
  ok(got && got.text === "We had 8 chips. I had 3 of them.", got && got.text);
});
test("problemFor: a fact that is not a fact gets nothing", () => {
  eq(M.problemFor(1, "nonsense", { words: {}, content: C }), null);
});
test("problems: every word in every template is one the app teaches or treats as given", () => {
  const taught = new Set();
  C.STEPS.forEach((s) => s.words.forEach((e) => taught.add(e.w.toLowerCase())));
  C.SIGHT.forEach((e) => taught.add(e.w.toLowerCase()));
  C.EVERYDAY.forEach((e) => taught.add(e.w.toLowerCase()));
  C.HELPERS.forEach((w) => taught.add(w.toLowerCase()));
  const bad = [];
  for (const id of Object.keys(M.WORD_PROBLEMS)) {
    for (const entry of M.WORD_PROBLEMS[id]) {
      const text = entry.text.replaceAll("{a}", "7").replaceAll("{b}", "4");
      for (const t of tokens(text)) {
        if (/^\d+$/.test(t) || taught.has(t) || taught.has(t.replace(/s$/, ""))) continue;
        bad.push("level " + id + ": " + t);
      }
    }
  }
  eq(bad, []);
});
test("whyLine: says the adding and the taking away in one breath", () => {
  eq(M.whyLine(3, 4), "3 and 4 make 7. So 7 take away 3 is 4.");
  eq(M.whyLine(4, 4), "4 and 4 make 8. So 8 take away 4 is 4.");
});
test("problemFor: borrows another level's problem rather than skip the step", () => {
  const words = { the: learned(), cat: learned(), hat: learned() };
  const got = M.problemFor(6, "9+4", { words, content: C });
  ok(got && got.text === "The cat had 9 hats. Mom got him 4 hats.", got && got.text);
});
test("problemFor: her own level's problem is preferred when she can read it", () => {
  const words = { the: learned(), cat: learned(), hat: learned(), shop: learned(), drum: learned() };
  const got = M.problemFor(6, "9+4", { words, content: C });
  ok(got && got.text.includes("drums"), got && got.text);
});
