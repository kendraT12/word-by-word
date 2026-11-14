// Word by Word: the daily lesson, story time, her word collection, and the first-day check.

import * as E from "./engine.js";
import * as C from "./content.js";
import { STORIES, EVERYDAY_STORIES } from "./stories.js";
import { state, today, show, screen, save, dayLog, practiceDays, say } from "./state.js";
import { el, div, p, h, btn, card, mount, wordEl, bar, shuffle, sleep } from "./ui.js";
import { runWord, setHeader, readAlong, FLUENT_MS } from "./word.js";

const withName = (s) => String(s).replaceAll("{name}", state.profile ? state.profile.name : "");
const entryFor = (w) => C.STEPS.flatMap((s) => s.words).concat(C.SIGHT, C.EVERYDAY).find((e) => e.w === w) || null;

// ---------- The daily lesson ----------

screen("lesson", (params) => runLesson(params).catch(async (err) => {
  // She may be on her own: save what she did and give her a way out.
  await save({ profile: true, words: true, day: true }).catch(() => {});
  state.lesson = null;
  mount([card([
    h(1, "Let's stop here"),
    p("", "Something went wrong, but your words are saved."),
    p("tiny muted", String((err && err.message) || err)),
    el("div", { class: "row", style: "justify-content:center" }, [btn("Go home", () => show("home"), "primary big")]),
  ])]);
}));

async function runLesson() {
  const prof = state.profile;
  const plan = E.buildLesson({ profile: prof, words: state.words, content: C, today: today() });
  const stepDef = C.STEPS[prof.step - 1];
  const startedAt = Date.now();
  const log = dayLog();
  state.lesson = { plan, okSteps: 0, totalSteps: 0, learnedNow: [], helpedAnyStep: false };

  const teach = plan.newWords.concat(plan.placed, plan.sight, plan.everyday).map(entryFor).filter(Boolean);
  const reviews = plan.reviews.map(entryFor).filter(Boolean);
  const warmups = plan.warmup.map(entryFor).filter(Boolean);
  const total = warmups.length + teach.length + reviews.length;
  let at = 0;
  const step = () => { at++; setHeader("Word " + at + " of " + total); };

  const note = (result) => {
    const steps = Object.values(result);
    state.lesson.totalSteps += steps.length;
    state.lesson.okSteps += steps.filter((r) => r === "ok").length;
    if (steps.some((r) => r === "help")) state.lesson.helpedAnyStep = true;
    log.helps += steps.filter((r) => r === "help").length;
  };

  // Fast Words: say it the moment you see it. This is what turns working a word
  // out into simply reading it, so a word she sounds out comes back here tomorrow.
  if (warmups.length) await fastWordsIntro();
  for (const entry of warmups) {
    step();
    const result = await runWord(entry, { mode: "warmup", pats: patsFor(entry) });
    note(result);
    const before = state.words[entry.w];
    state.words[entry.w] = E.applyFast(before, result.say, today());
    if (state.words[entry.w].status === "learned" && (!before || before.status !== "learned")) {
      state.lesson.learnedNow.push(entry.w);
      log.learned.push(entry.w);
    }
    track(log, entry.w);
    await save({ words: true, day: true });
  }

  // The new sound of the day.
  if (plan.introPattern && stepDef.intro[plan.introPattern]) {
    await teachPattern(stepDef, plan);
    prof.introduced = (prof.introduced || []).concat([plan.introPattern]);
    await save({ profile: true });
  }

  // New words, then the ones that are due again.
  for (const entry of teach) {
    step();
    const result = await runWord(entry, { mode: "new", pats: patsFor(entry) });
    note(result);
    const before = state.words[entry.w];
    state.words[entry.w] = E.applyRoutine(before, result, today());
    if (state.words[entry.w].status === "learned" && (!before || before.status !== "learned")) {
      state.lesson.learnedNow.push(entry.w);
      log.learned.push(entry.w);
    }
    track(log, entry.w);
    await save({ words: true, day: true });
  }

  for (const entry of reviews) {
    step();
    const result = await runWord(entry, { mode: "review", pats: patsFor(entry) });
    note(result);
    state.words[entry.w] = E.applyReview(state.words[entry.w], result.say === "ok" && result.spell === "ok", today());
    track(log, entry.w);
    await save({ words: true, day: true });
  }

  setHeader("");
  await storyTime();

  log.minutes = Math.round(((log.minutes || 0) + (Date.now() - startedAt) / 60000) * 10) / 10;
  prof.recentHelpFree = (prof.recentHelpFree || []).concat([!state.lesson.helpedAnyStep]).slice(-3);
  await save({ profile: true, words: true, day: true });
  show("finish");
}

function fastWordsIntro() {
  return new Promise((resolve) => {
    mount([card([
      h(1, "Fast Words"),
      p("center", "Say each word the moment you see it. Do not spell it out — just let it come."),
      p("center muted", "Beat the little bar."),
      el("div", { class: "row", style: "justify-content:center" }, [btn("I am ready", () => resolve(), "primary big")]),
    ])]);
  });
}

function patsFor(entry) {
  if (entry.hi !== undefined) return entry.hi ? [entry.hi] : [];
  if (entry.end) return [entry.end];
  return entry.pat ? [entry.pat] : [];
}

function track(log, word) {
  if (!log.practiced.includes(word)) log.practiced.push(word);
}

function teachPattern(stepDef, plan) {
  return new Promise(async (resolve) => {
    const pat = plan.introPattern;
    const samples = plan.introWords.length ? plan.introWords : stepDef.words.filter((e) => e.pat === pat).slice(0, 4).map((e) => e.w);
    const text = stepDef.intro[pat];
    mount([card([
      p("small muted center", "A new sound"),
      el("p", { class: "reading center", text }),
      div("row", samples.map((w) => el("span", { class: "chip" }, [wordEl(w, [pat], "")]))),
      el("div", { class: "row", style: "justify-content:center" }, [btn("Got it", () => resolve(), "primary big")]),
    ])]);
    await say(text);
  });
}

// ---------- Story time ----------

/** Everyday stories in the order she meets the words: colors, then numbers, days, months, seasons.
 *  The flag marks them so a Claude-written story never takes their turn: months and colours
 *  are the point of those days. */
const EVERYDAY_LIST = ["color", "number", "day", "month", "season"]
  .flatMap((c) => EVERYDAY_STORIES[c].map((st) => ({ ...st, everyday: true })));

function pickStory(step) {
  return E.chooseStory({
    step, words: state.words, content: C,
    stories: STORIES, everydayStories: EVERYDAY_LIST,
    dayCount: practiceDays().length,
  });
}

async function storyTime() {
  const prof = state.profile;
  const log = dayLog();
  const builtIn = pickStory(prof.step);
  let story = null;

  if (!builtIn.everyday && state.ai && state.ai.available) {
    mount([card([p("center muted", "Writing you a story…")])]);
    story = await state.ai.story({
      name: prof.name, favorites: prof.favorites || [],
      allowed: [...E.allowedWords({ profile: prof, words: state.words, content: C })],
      stepWords: C.STEPS[prof.step - 1].words.map((e) => e.w).slice(0, 8),
      sentences: Math.min(8, 4 + Math.floor(prof.step / 3)),
    });
  }
  if (!story) story = builtIn;

  const text = withName(story.text);
  const title = withName(story.title);

  await new Promise((resolve) => mount([card([
    p("small muted center", "Story time"),
    h(2, title),
    p("center muted", "Read it on your own. Tap a word if you get stuck."),
    el("div", { class: "row", style: "justify-content:center" }, [btn("I am ready", () => resolve(), "primary big")]),
  ])]));

  const first = await readAlong(text, { label: title });
  const second = await new Promise((resolve) => mount([card([
    p("small muted center", "Once more"),
    p("center", "Reading it again makes it smoother."),
    el("div", { class: "row", style: "justify-content:center" }, [btn("Read it again", async () => resolve(await readAlong(text, { label: title })), "primary big")]),
  ])]));

  const wpm1 = E.wpm(first.words, first.ms), wpm2 = E.wpm(second.words, second.ms);
  log.storyWpm = [wpm1, wpm2];
  const storyHelps = Math.min(first.helps, second.helps);
  log.helps += first.helps + second.helps;

  for (const question of (story.q || []).slice(0, 2)) await askStoryQuestion(question);

  if (wpm2 > wpm1 && wpm1 > 0) {
    await new Promise((resolve) => mount([card([
      h(2, "Smoother the second time!"),
      p("center", "You read " + wpm1 + " words a minute, then " + wpm2 + "."),
      el("div", { class: "row", style: "justify-content:center" }, [btn("Next", () => resolve(), "primary big")]),
    ])]));
  }

  if (E.canAdvance(prof.step, state.words, C, storyHelps)) {
    prof.step += 1;
    prof.stepStartedDay = today();
    await new Promise((resolve) => mount([card([
      h(1, "New step!"),
      p("center", "You finished " + C.STEPS[prof.step - 2].name + "."),
      p("center muted", "Next: " + C.STEPS[prof.step - 1].name + "."),
      el("div", { class: "row", style: "justify-content:center" }, [btn("Let's go", () => resolve(), "primary big")]),
    ])]));
  }
}

function askStoryQuestion(question) {
  return new Promise((resolve) => {
    const choices = shuffle((question.choices || []).map(withName), question.answer);
    const answer = withName(question.answer);
    let misses = 0;
    const buttons = choices.map((choice) => {
      const b = btn(choice, async () => {
        if (choice === answer) { b.classList.add("right"); await say("That's right."); resolve(); return; }
        misses++; b.disabled = true;
        if (misses >= 2) {
          const good = buttons.find((x) => x.textContent === answer);
          if (good) good.classList.add("right");
          await say(answer);
          setTimeout(resolve, 600);
        }
      });
      b.style.whiteSpace = "normal"; b.style.textAlign = "left";
      return b;
    });
    mount([card([
      p("small muted center", "About the story"),
      el("p", { class: "reading center", text: withName(question.ask) }),
      el("div", { class: "stack" }, buttons),
      btn("Read it to me", async () => { await say(withName(question.ask)); for (const c of choices) await say(c); }, "quiet"),
    ])]);
  });
}

// ---------- Finishing ----------

screen("finish", () => {
  const lesson = state.lesson || { okSteps: 0, learnedNow: [] };
  const log = dayLog();
  const learnedTotal = Object.keys(state.words).filter((w) => state.words[w].status === "learned").length;
  const run = E.streak(practiceDays(), today());
  const goal = state.profile.goalMin || 15;
  state.lesson = null;
  say("Great reading today!");

  mount([
    card([
      h(1, "Great reading!"),
      p("center", "+" + lesson.okSteps + " points"),
      lesson.learnedNow.length
        ? div("stack", [p("center muted", "You read these straight off today:"), div("chips", lesson.learnedNow.map((w) => el("span", { class: "chip", text: w })))])
        : p("center muted", "Those words come back tomorrow as Fast Words."),
      p("center", "You read " + learnedTotal + (learnedTotal === 1 ? " word" : " words") + " without sounding them out."),
    ]),
    card([
      div("spread", [el("span", { text: "Today" }), el("span", { class: "muted nums", text: Math.round(log.minutes) + " of " + goal + " minutes" })]),
      bar((log.minutes || 0) / goal),
      p("center", run + (run === 1 ? " day" : " days") + " in a row"),
    ]),
    el("div", { class: "row", style: "justify-content:center" }, [
      btn("Done", () => show("home"), "primary big"),
      btn("See my words", () => show("collection")),
    ]),
  ]);
});

// ---------- Her word collection ----------

screen("collection", () => {
  const learned = (list) => list.filter((e) => (state.words[e.w] || {}).status === "learned");
  const groups = C.STEPS.map((s) => [s.name, learned(s.words)])
    .concat([["Sight words", learned(C.SIGHT)]])
    .concat(Object.entries(C.CATEGORY_PHRASE).map(([cat, label]) =>
      [label.replace(/^a /, "").replace(/ of the (week|year)$/, "s"), learned(C.EVERYDAY.filter((e) => e.cat === cat))]))
    .filter(([, list]) => list.length);
  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  const gettingThere = E.slowWords(state.words);

  mount([
    card([
      div("spread", [h(1, "My words"), btn("Back", () => show("home"), "quiet")]),
      p("center", "You read " + total + (total === 1 ? " word" : " words") + " straight off!"),
    ]),
    gettingThere.length ? card([
      div("spread", [h(2, "Almost there"), el("span", { class: "muted small nums", text: String(gettingThere.length) })]),
      p("tiny muted", "You can read these. Next you will read them without stopping to sound them out."),
      div("chips", gettingThere.map((w) => el("span", { class: "chip", text: w }))),
    ]) : null,
    ...(groups.length ? groups.map(([name, list]) => card([
      div("spread", [h(2, name), el("span", { class: "muted small nums", text: String(list.length) })]),
      div("chips", list.map((e) => el("span", { class: "chip", text: e.w }))),
    ])) : [card([p("center muted", "Finish a word today and it will show up here.")])]),
  ]);
});

// ---------- The first-day check ----------

screen("placementIntro", () => {
  mount([card([
    h(1, "Let's see what you know"),
    p("", "A few words to read. Some will be easy and some will be hard, and that is fine. It takes about 10 minutes."),
    p("small muted", "Grown-ups: sitting with her for this part makes the result more accurate."),
    el("div", { class: "stack" }, [
      btn("A grown-up is helping", () => show("placement", { grownup: true }), "primary big"),
      btn("I am on my own", () => show("placement", { grownup: false })),
    ]),
  ])]);
});

/** Resolves "ok" (read it whole), "slow" (worked it out first) or "miss". */
function checkWord(word, grownup, label) {
  return new Promise((resolve) => {
    let startedAt = Date.now();
    const frame = (note, controls) => mount([card([
      p("small muted center", label),
      div("center", [wordEl(word, [], "word")]),
      note ? p("center", note) : null,
      el("div", { class: "stack" }, controls),
    ])]);
    const byClock = () => (Date.now() - startedAt > FLUENT_MS ? "slow" : "ok");

    if (grownup) {
      frame("How did she read it?", [
        btn("Right away", () => resolve("ok"), "primary"),
        btn("Sounded it out first", () => resolve("slow")),
        btn("Not yet", () => resolve("miss")),
      ]);
      return;
    }
    if (state.listener && state.listener.available) {
      frame(null, [btn("Start", async () => {
        startedAt = Date.now();
        frame("Listening…", []);
        const heard = await state.listener.listenForWord(word);
        if (heard !== null) return resolve(E.matchSpoken(heard, word, C.HOMOPHONES) ? byClock() : "miss");
        frame("I did not hear that.", [btn("Check me", () => selfCheck(), "primary")]);
      }, "primary big")]);
      return;
    }
    selfCheck();

    function selfCheck() {
      startedAt = Date.now();
      frame(null, [btn("Check me", async () => {
        const quality = byClock();
        frame(null, []);
        await say(word);
        frame("Did you say it the same way?", [
          btn("Yes, the same", () => resolve(quality), "primary"),
          btn("No, different", () => resolve("miss")),
        ]);
      }, "primary big")]);
    }
  });
}

function checkSound(item) {
  return new Promise((resolve) => {
    const where = item.where === "start" ? "start" : item.where === "end" ? "end" : "middle";
    const ask = "Which letter do you hear at the " + where + " of " + item.say + "?";
    const buttons = shuffle(item.choices, item.say).map((letter) => {
      const b = btn(letter, () => resolve(letter === item.answer), "big");
      b.style.fontFamily = "var(--word)";
      b.style.minWidth = "72px";
      return b;
    });
    mount([card([
      p("small muted center", "Listen"),
      el("p", { class: "reading center", text: ask.replace(item.say, "…") }),
      el("div", { class: "row", style: "justify-content:center" }, buttons),
      btn("Say it again", () => say(ask), "quiet"),
    ])]);
    say(ask);
  });
}

screen("placement", async ({ grownup }) => {
  const prof = state.profile;
  const results = { sounds: { ok: 0, total: 0 }, stepScores: {}, sight: [], everyday: [] };

  // 1. Letter sounds.
  let wrongRun = 0;
  for (const item of C.PLACEMENT_SOUNDS) {
    const right = await checkSound(item);
    results.sounds.total++;
    if (right) { results.sounds.ok++; wrongRun = 0; } else if (++wrongRun >= 5) break;
  }

  // 2. Reading, four words per step, stopping once two steps in a row are too hard.
  let hardSteps = 0;
  for (const stepDef of C.STEPS) {
    const sample = stepDef.words.slice(0, 4);
    const howRead = [];
    for (const entry of sample) howRead.push(await checkWord(entry.w, grownup, "Step " + stepDef.id));
    const scores = howRead.map((r) => r !== "miss");
    results.stepScores[stepDef.id] = scores;
    sample.forEach((entry, i) => seedFromCheck(entry.w, howRead[i]));
    if (scores.filter((x) => !x).length >= 2) { if (++hardSteps >= 2) break; } else hardSteps = 0;
  }

  // 3. Sight words.
  wrongRun = 0;
  for (const entry of C.SIGHT.slice(0, 10)) {
    const how = await checkWord(entry.w, grownup, "Word you see a lot");
    seedFromCheck(entry.w, how);
    if (how !== "miss") { results.sight.push(entry.w); wrongRun = 0; }
    else if (++wrongRun >= 3) break;
  }

  // 4. Everyday words.
  const samples = [["color", 5], ["number", 5], ["day", 3], ["month", 4]];
  for (const [cat, count] of samples) {
    const list = C.EVERYDAY.filter((e) => e.cat === cat).slice(0, count);
    wrongRun = 0;
    for (const entry of list) {
      const how = await checkWord(entry.w, grownup, C.CATEGORY_PHRASE[cat]);
      seedFromCheck(entry.w, how);
      if (how !== "miss") { results.everyday.push(entry.w); wrongRun = 0; }
      else if (++wrongRun >= 3) break;
    }
  }

  prof.step = E.placementStep(results.stepScores, C.STEPS.length);
  prof.stepStartedDay = today();
  prof.placementDone = true;
  prof.placement = results;
  // Everything below her starting step comes back once, for the full four steps.
  C.STEPS.slice(0, prof.step - 1).forEach((s) => s.words.forEach((e) => seedPlaced(e.w)));
  await save({ profile: true, words: true });

  mount([card([
    h(1, "All done!"),
    p("", "You are starting on step " + prof.step + ": " + C.STEPS[prof.step - 1].name + "."),
    p("small muted", "Words you already read will come back now and then, so they stick."),
    E.slowWords(state.words).length
      ? p("small muted", "The ones you had to sound out will come back as Fast Words, until you can just read them.")
      : null,
    el("div", { class: "row", style: "justify-content:center" }, [btn("Start reading", () => show("lesson"), "primary big")]),
  ])]);
});

function seedPlaced(word) {
  const prev = state.words[word];
  if (prev && (prev.status === "learned" || prev.status === "practicing")) return;
  state.words[word] = { status: "placed", lvl: 0, due: null, helps: 0, seen: 0, lastSeen: null, slow: false };
}

/** A word she read whole waits its turn; one she sounded out goes straight into Fast Words. */
function seedFromCheck(word, how) {
  if (how === "miss") return;
  if (how === "slow") {
    const prev = state.words[word];
    if (prev && prev.status === "learned") return;
    state.words[word] = { status: "practicing", lvl: 0, due: today(), helps: 0, seen: 1, lastSeen: today(), slow: true };
    return;
  }
  seedPlaced(word);
}
