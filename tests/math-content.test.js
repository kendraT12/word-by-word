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
