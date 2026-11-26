// Word by Word: the daily maths lesson, and the first-day maths check.

import * as E from "./engine.js";
import * as C from "./content.js";
import * as MC from "./math-content.js";
import { state, today, show, screen, save, dayLog, practiceDays, say } from "./state.js";
import { el, div, p, h, btn, card, mount, bar } from "./ui.js";
import { setHeader } from "./word.js";
import { askFact, runFact, MATH_STEPS } from "./math.js";

// ---------- The daily lesson ----------

screen("mathLesson", (params) => runMathLesson(params).catch(async (err) => {
  // She may be on her own: keep what she did and give her a way out.
  await save({ profile: true, facts: true, day: true }).catch(() => {});
  state.mathLesson = null;
  mount([card([
    h(1, "Let's stop here"),
    p("", "Something went wrong, but your maths is saved."),
    p("tiny muted", String((err && err.message) || err)),
    el("div", { class: "row", style: "justify-content:center" }, [btn("Go home", () => show("home"), "primary big")]),
  ])]);
}));

async function runMathLesson() {
  const prof = state.profile;
  const plan = E.buildMathLesson({ profile: prof, facts: state.facts, content: MC, today: today() });
  const level = MC.levelById(plan.level);
  const startedAt = Date.now();
  const log = dayLog();
  const lesson = { points: 0, learnedNow: [], helpedAnyStep: false, level: plan.level };
  state.mathLesson = lesson;

  // Minutes are banked after every item, not at the end, so a lesson she walks away
  // from still counts the time she put in.
  let bankedAt = startedAt;
  const bankMinutes = () => {
    const now = Date.now();
    log.mathMinutes = Math.round(((log.mathMinutes || 0) + (now - bankedAt) / 60000) * 10) / 10;
    bankedAt = now;
  };

  /** One item is done: record it, bank the time, and save before anything else. */
  const noteItem = async (qualities) => {
    for (const q of qualities) {
      if (!q) continue;
      log.mathAnswered = (log.mathAnswered || 0) + 1;
      log.mathTrace = (log.mathTrace || []).concat([q]);
      if (q === "help" || q === "miss") log.mathHelps = (log.mathHelps || 0) + 1;
      if (q === "ok") lesson.points++;
    }
    if (qualities.some((q) => q === "help" || q === "miss")) lesson.helpedAnyStep = true;
    bankMinutes();
    await save({ facts: true, day: true });
  };

  const learnedCheck = (key, before) => {
    const now = state.facts[key];
    if (now && now.status === "learned" && (!before || before.status !== "learned")) {
      lesson.learnedNow.push(key);
    }
  };

  // The lesson keeps offering work until twenty minutes have passed. It asks between
  // items only, so the fact in hand is always finished.
  const outOfTime = () => E.sessionOver(startedAt, Date.now());

  const total = plan.warmup.length + plan.newFamilies.length + plan.reviews.length;
  let at = 0;
  const step = () => { at++; setHeader("Maths " + at + " of " + total); };

  // Fast Facts: the ones she can work out but still works out. Speed is all they need.
  if (plan.warmup.length) await fastFactsIntro(level);
  for (const key of plan.warmup) {
    if (outOfTime()) break;
    step();
    const before = state.facts[key];
    const r = await askFact(key, { note: "Fast Facts" });
    if (r.startedMs) log.mathStartMs.push(r.startedMs);
    state.facts[key] = E.applyFast(before, r.quality, today());
    learnedCheck(key, before);
    await noteItem([r.quality]);
  }

  // New fact families, taught in four steps.
  for (const fam of plan.newFamilies) {
    if (outOfTime()) break;
    step();
    await levelIdea(level, fam);
    const keys = MC.familyOf(fam[0], fam[1]);
    const result = await runFact(fam, {
      levelId: plan.level, words: state.words, content: C, idea: level.idea,
    });
    if (result.triedMs) log.mathStartMs.push(result.triedMs);
    // The whole family moves together: she met every fact in it just now.
    for (const key of keys) {
      const before = state.facts[key];
      state.facts[key] = E.applyRoutine(before, result, today(), MATH_STEPS, "tried");
      learnedCheck(key, before);
    }
    await noteItem(MATH_STEPS.map((k) => result[k]));
  }

  // Facts whose review has come round.
  for (const key of plan.reviews) {
    if (outOfTime()) break;
    step();
    const r = await askFact(key, { note: "Do you still know this one?" });
    if (r.startedMs) log.mathStartMs.push(r.startedMs);
    state.facts[key] = E.applyReview(state.facts[key], r.quality, today());
    await noteItem([r.quality]);
  }

  // Moving up a level is earned by answering, never by the calendar.
  if (E.canAdvanceLevel(plan.level, state.facts, MC)) {
    prof.mathLevel = plan.level + 1;
    lesson.movedUp = MC.levelById(prof.mathLevel);
  }
  setHeader("");
  bankMinutes();
  await save({ profile: true, facts: true, day: true });
  show("mathFinish");
}

function fastFactsIntro(level) {
  return new Promise((resolve) => {
    say("Fast Facts! Answer as soon as you see it.");
    mount([card([
      h(1, "Fast Facts"),
      p("", "A sum comes up. Tap the answer as soon as you see it."),
      p("muted small", "No counting on your fingers — if you know it, it is already there."),
      p("note small", level.name + ". " + level.idea),
      el("div", { class: "row", style: "justify-content:center" }, [btn("I am ready", resolve, "primary big")]),
    ])]);
  });
}

function levelIdea(level, fam) {
  return new Promise((resolve) => {
    say("A new one. " + level.idea);
    mount([card([
      p("small muted center", "A new one"),
      el("div", { class: "sum center", text: fam[0] + " + " + fam[1] }),
      p("note center", level.idea),
      el("div", { class: "row", style: "justify-content:center" }, [btn("Let me try", resolve, "primary big")]),
    ])]);
  });
}

screen("mathFinish", () => {
  const lesson = state.mathLesson || { points: 0, learnedNow: [] };
  const log = dayLog();
  const known = E.fluencyCounts(state.facts);
  const run = E.streak(practiceDays("maths"), today());
  const goal = state.profile.mathGoalMin || 20;
  state.mathLesson = null;
  say("Great maths today!");

  mount([
    card([
      h(1, "Great maths!"),
      p("center", "+" + lesson.points + " points"),
      lesson.learnedNow.length
        ? div("stack", [
            p("center muted", "You just knew these today:"),
            div("chips", lesson.learnedNow.map((k) => el("span", { class: "chip nums", text: MC.prettyFact(k) }))),
          ])
        : p("center muted", "Those come back tomorrow as Fast Facts."),
      p("center", "You know " + known.instant + (known.instant === 1 ? " fact" : " facts") + " without working them out."),
      known.slow ? p("center muted small", "And " + known.slow + " you can work out, which is most of the way there.") : null,
      lesson.movedUp ? p("note center", "You are on to " + lesson.movedUp.name + " now.") : null,
    ]),
    card([
      div("spread", [el("span", { text: "Today" }), el("span", { class: "muted nums", text: Math.round(log.mathMinutes || 0) + " of " + goal + " minutes" })]),
      bar((log.mathMinutes || 0) / goal),
      p("center", run + (run === 1 ? " day" : " days") + " in a row"),
    ]),
    el("div", { class: "row", style: "justify-content:center" }, [
      btn("Done", () => show("home"), "primary big"),
    ]),
  ]);
});

// ---------- The first-day maths check ----------

/** Two facts from each level the check can place her on, asked untimed.
 *
 *  It stops at MAX_PLACEMENT_LEVEL on purpose. The levels above it can never be the
 *  answer — the placement clamps to 5 either way — so asking facts from them would
 *  only tire her out for nothing. Those levels are earned by answering. */
export function checkFacts(top = E.MAX_PLACEMENT_LEVEL) {
  const out = [];
  for (const level of MC.LEVELS.slice(0, top)) {
    const pool = level.families.length
      ? level.families.map((f) => MC.familyOf(f[0], f[1])[0])
      : level.drills.slice();
    if (!pool.length) continue;
    // A third and two thirds of the way in: typical of the level, not its easiest edge.
    const picks = [pool[Math.floor(pool.length / 3)], pool[Math.floor((pool.length * 2) / 3)]];
    out.push({ level: level.id, keys: picks.filter((k, i) => k && picks.indexOf(k) === i) });
  }
  return out;
}

screen("mathCheckIntro", () => {
  const name = state.profile ? state.profile.name : "";
  say("Let's see which sums you already know.");
  mount([card([
    h(1, "A few sums first"),
    p("", "Ten sums, " + name + ". No clock on these — take as long as you like."),
    p("muted", "Some will be easy and some will be too hard. Both are fine: this is only so the app knows where to start you."),
    el("div", { class: "row", style: "justify-content:center" }, [
      btn("I am ready", () => show("mathCheck"), "primary big"),
    ]),
  ])]);
});

screen("mathCheck", async () => {
  const groups = checkFacts();
  const scores = {};
  const total = groups.reduce((n, g) => n + g.keys.length, 0);
  let at = 0;

  for (const group of groups) {
    scores[group.level] = [];
    for (const key of group.keys) {
      at++;
      setHeader("Sum " + at + " of " + total);
      let r;
      try { r = await askFact(key, { timed: false, feedback: false, note: "Do you know this one?" }); }
      catch { r = { correct: false }; }
      scores[group.level].push(!!r.correct);
      // What she missed is where she starts, so it is seeded as practice, not as new.
      if (!r.correct) {
        state.facts[key] = { status: "practicing", lvl: 0, due: today(), helps: 0, seen: 1, lastSeen: today(), slow: false };
      }
    }
  }
  setHeader("");

  const prof = state.profile;
  prof.mathLevel = E.mathPlacementLevel(scores);
  prof.mathCheckDone = true;
  prof.mathCheckScores = scores;
  await save({ profile: true, facts: true }).catch(() => {});

  const level = MC.levelById(prof.mathLevel);
  say("All done. Thank you!");
  mount([card([
    h(1, "All done!"),
    p("", "You are starting on " + level.name + "."),
    p("note", level.idea),
    el("div", { class: "row", style: "justify-content:center" }, [
      btn("Start my maths", () => show("mathLesson"), "primary big"),
      btn("Not now", () => show("home"), "quiet"),
    ]),
  ])]);
});
