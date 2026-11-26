// Word by Word: start-up, her home screen, setup, and the grown-up corner.

import * as E from "./engine.js";
import * as P from "./platform.js";
import * as C from "./content.js";
import * as MC from "./math-content.js";
import { state, today, show, screen, save, practiceDays, dayLog } from "./state.js";
import { el, div, p, h, btn, card, field, mount, bar, wordEl, sleep } from "./ui.js";
import "./word.js";
import "./lesson.js";
import "./math-lesson.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const prettyDate = (key) => { const [y, m, d] = key.split("-").map(Number); return MONTHS[m - 1].slice(0, 3) + " " + d; };
const dayName = (key) => { const [y, m, d] = key.split("-").map(Number); return DAY_NAMES[new Date(y, m - 1, d).getDay()]; };

// ---------- Her home screen ----------

// Two doors: Reading and Maths. She picks. Separate streaks, and a plain line of words
// saying what she has already done today — a marker, never a nag, and never a picture.
screen("home", () => {
  const prof = state.profile;
  const readDays = practiceDays("reading");
  const mathDays = practiceDays("maths");
  const readRun = E.streak(readDays, today());
  const mathRun = E.streak(mathDays, today());
  const learned = Object.keys(state.words).filter((w) => state.words[w].status === "learned").length;
  const knownFacts = E.fluencyCounts(state.facts).instant;
  const readToday = readDays.includes(today());
  const mathToday = mathDays.includes(today());
  const needCheck = !prof.mathCheckDone;
  const runLine = (n) => (n > 0 ? " \u00b7 " + n + (n === 1 ? " day in a row" : " days in a row") : "");

  mount([
    card([
      h(1, "Hi, " + prof.name + "!"),
      p("muted", readToday && mathToday ? "You have done both today. Want to do some more?" : "What do you want to do today?"),
    ]),
    card([
      div("spread", [h(2, "Reading"), el("span", { class: "small muted", text: readToday ? "Done today" : "" })]),
      p("small muted nums", learned + (learned === 1 ? " word" : " words") + " read whole" + runLine(readRun)),
      btn(readToday ? "Read some more" : "Start today's reading", () => show("lesson"), "primary big"),
      btn("See my words", () => show("collection")),
    ]),
    card([
      div("spread", [h(2, "Maths"), el("span", { class: "small muted", text: mathToday ? "Done today" : "" })]),
      p("small muted nums", needCheck
        ? "A few sums first, so we know where to start you."
        : knownFacts + (knownFacts === 1 ? " fact" : " facts") + " you just know" + runLine(mathRun)),
      btn(needCheck ? "Start my sums" : mathToday ? "Do some more maths" : "Start today's maths",
        () => show(needCheck ? "mathCheckIntro" : "mathLesson"), "primary big"),
    ]),
    el("div", { class: "row", style: "justify-content:center" }, [btn("Grown-ups", () => show("parentGate"), "quiet")]),
  ]);
});

// ---------- Setup ----------

screen("setup", () => {
  const name = el("input", { type: "text", id: "kid-name", autocomplete: "off", placeholder: "Her first name", maxLength: 20 });
  const month = el("select", { id: "kid-month" }, [el("option", { value: "", text: "Pick a month" }),
    ...MONTHS.map((m, i) => el("option", { value: String(i + 1), text: m }))]);
  const favs = [0, 1, 2, 3, 4].map((i) => el("input", { type: "text", id: "fav-" + i, autocomplete: "off", placeholder: i < 3 ? "Something she loves" : "Optional", maxLength: 24 }));
  let goal = 15;
  const goalBtns = [15, 20].map((n) => btn(n + " minutes", () => {
    goal = n; goalBtns.forEach((b, i) => b.classList.toggle("picked", [15, 20][i] === n));
  }));
  goalBtns[0].classList.add("picked");
  const code1 = el("input", { type: "password", inputMode: "numeric", id: "code-1", class: "code-input", maxLength: 4, autocomplete: "new-password" });
  const code2 = el("input", { type: "password", inputMode: "numeric", id: "code-2", class: "code-input", maxLength: 4, autocomplete: "new-password" });
  const problem = p("small", "");
  problem.style.color = "var(--accent)";

  const start = btn("Save and start", async () => {
    const favorites = favs.map((f) => f.value.trim()).filter(Boolean);
    if (!name.value.trim()) return (problem.textContent = "Please add her first name.");
    if (!month.value) return (problem.textContent = "Please pick her birthday month.");
    if (!/^\d{4}$/.test(code1.value)) return (problem.textContent = "The grown-up code needs to be 4 digits.");
    if (code1.value !== code2.value) return (problem.textContent = "The two codes do not match.");
    start.disabled = true;
    state.profile = {
      name: name.value.trim(), birthMonth: Number(month.value), favorites, goalMin: goal,
      codeHash: await P.hashCode(code1.value), placementDone: false,
      step: 1, stepStartedDay: today(), introduced: [], recentHelpFree: [],
    };
    await save({ profile: true });
    show("placementIntro");
  }, "primary big");

  mount([
    card([
      h(1, "Word by Word"),
      p("muted", "Reading and spelling practice, one word at a time. No pictures to guess from: she reads the words."),
    ]),
    card([
      h(2, "Set up"),
      field("Her name", name),
      field("Her birthday month", month),
      field("Things she loves (used in her stories)", div("stack", favs)),
      el("div", { class: "stack" }, [el("span", { class: "small muted", text: "How long each day?" }), div("row", goalBtns)]),
    ]),
    card([
      h(2, "Grown-up code"),
      p("small muted", "4 digits. It keeps her out of the progress screens."),
      field("Code", code1),
      field("Type it again", code2),
      problem,
      start,
    ]),
  ]);
});

// ---------- The grown-up corner ----------

screen("parentGate", () => {
  const code = el("input", { type: "password", inputMode: "numeric", class: "code-input", maxLength: 4, id: "gate-code", autocomplete: "current-password" });
  const problem = p("small", "");
  problem.style.color = "var(--accent)";
  const open = btn("Open", async () => {
    if ((await P.hashCode(code.value)) === state.profile.codeHash) return show("parent");
    problem.textContent = "That code is not right.";
    code.value = "";
  }, "primary");
  code.addEventListener("keydown", (e) => { if (e.key === "Enter") open.click(); });

  mount([card([
    h(1, "Grown-ups"),
    field("Enter the 4-digit code", code),
    problem,
    div("row", [open, btn("Back", () => show("home"), "quiet")]),
    btn("Forgot the code?", () => show("codeReset"), "quiet"),
  ])]);
  code.focus();
});

screen("codeReset", () => {
  const a = 2 + Math.floor(Math.random() * 90), b = 3 + Math.floor(Math.random() * 7);
  const answer = el("input", { type: "number", inputMode: "numeric", id: "math-answer" });
  const code1 = el("input", { type: "password", inputMode: "numeric", class: "code-input", maxLength: 4, id: "new-code", autocomplete: "new-password" });
  const problem = p("small", "");
  problem.style.color = "var(--accent)";

  mount([card([
    h(1, "Set a new code"),
    p("small muted", "A grown-up question first."),
    field("What is " + a + " × " + b + "?", answer),
    field("New 4-digit code", code1),
    problem,
    div("row", [
      btn("Save new code", async () => {
        if (Number(answer.value) !== a * b) return (problem.textContent = "That is not the answer.");
        if (!/^\d{4}$/.test(code1.value)) return (problem.textContent = "The code needs to be 4 digits.");
        state.profile.codeHash = await P.hashCode(code1.value);
        await save({ profile: true });
        show("parent");
      }, "primary"),
      btn("Back", () => show("parentGate"), "quiet"),
    ]),
  ])]);
});

function everydayChecklist() {
  const cats = [["color", "Colors"], ["number", "Numbers"], ["day", "Days"], ["month", "Months"], ["season", "Seasons"], ["time", "Today / yesterday"]];
  return cats.map(([cat, label]) => {
    const list = C.EVERYDAY.filter((e) => e.cat === cat);
    const known = list.filter((e) => (state.words[e.w] || {}).status === "learned");
    return div("stack", [
      div("spread", [el("strong", { text: label }), el("span", { class: "muted small nums", text: known.length + " of " + list.length })]),
      bar(known.length / list.length),
      known.length ? div("chips", known.map((e) => el("span", { class: "chip", text: e.w }))) : p("tiny muted", "Not started yet."),
    ]);
  });
}

function shareProgressControls() {
  const text = E.progressSummary({ profile: state.profile, words: state.words, facts: state.facts, days: state.days, content: C, today: today() });
  const box = el("pre", {
    class: "small", text,
    style: "white-space:pre-wrap;background:var(--sunk);border-radius:10px;padding:12px 14px;margin:0;font-family:var(--ui);overflow-x:auto",
  });
  const said = p("tiny muted", "");
  const buttons = div("row", []);

  if (navigator.share) {
    buttons.append(btn("Share", async () => {
      try { await navigator.share({ title: state.profile.name + "'s reading", text }); }
      catch { said.textContent = "Not shared."; }
    }, "primary"));
  }
  buttons.append(btn("Copy", async () => {
    try { await navigator.clipboard.writeText(text); said.textContent = "Copied."; }
    catch {
      const range = document.createRange();
      range.selectNodeContents(box);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      said.textContent = "Selected — press and hold to copy.";
    }
  }));
  return div("stack", [box, buttons, said]);
}

screen("parent", () => {
  const prof = state.profile;
  const days = practiceDays().sort();
  const run = E.streak(days, today());
  const learnedWords = Object.keys(state.words).filter((w) => state.words[w].status === "learned");
  const progress = E.stepProgress(prof.step, state.words, C);
  const tip = E.tipForTonight(state.words);
  const stuck = E.isStuck(prof, days);
  const tricky = Object.keys(state.words)
    .filter((w) => state.words[w].status === "practicing" && state.words[w].helps > 0)
    .sort((x, y) => state.words[y].helps - state.words[x].helps).slice(0, 5);
  const recent = days.slice(-14);
  const wpmDays = days.filter((d) => (state.days[d].storyWpm || []).some((n) => n > 0));
  const sounds = prof.placement && prof.placement.sounds;
  const fluency = E.fluencyCounts(state.words);
  const soundingOut = E.slowWords(state.words);
  const mathFluency = E.fluencyCounts(state.facts);
  const stillCounting = E.slowWords(state.facts);
  const mathLevel = MC.levelById(prof.mathLevel || 1);
  const levelDone = E.levelProgress(mathLevel.id, state.facts, MC);
  const speed = E.answerSpeed(state.days);
  const hardFacts = E.hardestFacts(state.facts);
  const factTip = E.factTip(state.facts);
  const fade = E.fadeNote(state.days);
  const mathRecent = Object.keys(state.days).sort().filter((d) => state.days[d].mathMinutes).slice(-14);
  const prettyFact = MC.prettyFact;

  mount([
    card([
      div("spread", [h(1, prof.name + "'s progress"), btn("Done", () => show("home"), "quiet")]),
      state.store && state.store.mode === "device"
        ? div("note", [p("small", "Progress is saved on this device only."), p("tiny muted", "Sign in to Claude on this device to sync it across her devices.")])
        : null,
      div("row", [
        el("span", { class: "nums", text: run + (run === 1 ? " day" : " days") + " in a row" }),
        el("span", { class: "muted", text: "·" }),
        el("span", { class: "nums", text: days.length + (days.length === 1 ? " day practiced" : " days practiced") }),
        el("span", { class: "muted", text: "·" }),
        el("span", { class: "nums", text: learnedWords.length + " read whole" }),
      ]),
    ]),

    tip || stuck ? card([
      h(2, "Tonight"),
      tip ? p("", tip) : p("muted", "Nothing is tripping her up right now."),
      stuck ? div("note", [p("small", "She has practiced on " + days.length + " days and is still on this step. It may be worth asking her teacher about a reading check.")]) : null,
    ]) : null,

    card([
      h(2, "Reading them whole"),
      p("tiny muted", "The number that matters. A word only counts as learned once she says it without sounding it out first."),
      div("spread", [el("span", { text: "Reads right away" }), el("span", { class: "muted small nums", text: String(fluency.instant) })]),
      bar(fluency.instant + fluency.slow ? fluency.instant / (fluency.instant + fluency.slow) : 0),
      div("spread", [el("span", { text: "Still sounds out" }), el("span", { class: "muted small nums", text: String(fluency.slow) })]),
      soundingOut.length
        ? div("chips", soundingOut.slice(0, 20).map((w) => el("span", { class: "chip", text: w })))
        : p("tiny muted", fluency.instant ? "Nothing waiting in Fast Words." : "Nothing here yet."),
      p("tiny muted", "These come back as Fast Words at the start of each lesson, where she has about 3 seconds to say each one."),
    ]),

    card([
      h(2, "Where she is"),
      div("spread", [el("strong", { text: "Step " + prof.step + ": " + C.STEPS[prof.step - 1].name }),
        el("span", { class: "muted small nums", text: progress.learned + " of " + progress.total + " words" })]),
      bar(progress.pct),
      p("tiny muted", "She moves up when she has learned about 8 in 10 of this step's words and can read its story with little help."),
    ]),

    card([h(2, "Everyday words"), ...everydayChecklist()]),

    sounds && sounds.total ? card([
      h(2, "Letter sounds"),
      div("spread", [el("span", { text: "On her first-day check" }),
        el("span", { class: "muted small nums", text: sounds.ok + " of " + sounds.total + " right" })]),
      bar(sounds.ok / sounds.total),
      p("tiny muted", sounds.ok >= sounds.total * 0.8
        ? "She has her sounds. The work now is blending them into whole words."
        : "Some letter sounds are still shaky. Practising those with her will speed everything up."),
    ]) : null,

    card([
      h(2, "Tricky words"),
      tricky.length
        ? div("list", tricky.map((w) => div("spread", [
            el("span", { class: "chip", text: w }),
            el("span", { class: "muted small nums", text: "needed help " + state.words[w].helps + (state.words[w].helps === 1 ? " time" : " times") }),
          ])))
        : p("muted", "Nothing is giving her trouble yet."),
    ]),

    card([
      h(2, "Minutes"),
      recent.length
        ? div("list", recent.slice().reverse().map((d) => div("row", [
            el("span", { class: "small nums", style: "width:84px", text: dayName(d) + " " + prettyDate(d) }),
            el("span", { class: "grow" }, [bar((state.days[d].minutes || 0) / (prof.goalMin || 15))]),
            el("span", { class: "small nums muted", style: "width:52px;text-align:right", text: Math.round(state.days[d].minutes || 0) + "m" }),
          ])))
        : p("muted", "No lessons yet."),
      p("tiny muted", "The bar is full at her " + (prof.goalMin || 15) + "-minute goal."),
    ]),

    card([
      h(2, "Reading speed"),
      wpmDays.length
        ? div("list", wpmDays.slice(-10).reverse().map((d) => div("spread", [
            el("span", { class: "small nums", text: prettyDate(d) }),
            el("span", { class: "small nums", text: (state.days[d].storyWpm[0] || "—") + " then " + (state.days[d].storyWpm[1] || "—") + " words a minute" }),
          ])))
        : p("muted", "She reads each story twice. The two speeds show up here."),
      p("tiny muted", "An average 2nd grader starts the year near 50 words a minute."),
    ]),

    card([
      h(2, "Maths facts"),
      p("tiny muted", "The same rule as her reading: a fact counts only once she just knows it, not when she can work it out."),
      Object.keys(state.facts).length ? null : p("muted", "She has not started her maths yet."),
      Object.keys(state.facts).length ? div("spread", [el("span", { text: "Knows right away" }), el("span", { class: "muted small nums", text: String(mathFluency.instant) })]) : null,
      Object.keys(state.facts).length ? bar(mathFluency.instant + mathFluency.slow ? mathFluency.instant / (mathFluency.instant + mathFluency.slow) : 0) : null,
      Object.keys(state.facts).length ? div("spread", [el("span", { text: "Still works them out" }), el("span", { class: "muted small nums", text: String(mathFluency.slow) })]) : null,
      stillCounting.length
        ? div("chips", stillCounting.slice(0, 20).map((k) => el("span", { class: "chip nums", text: prettyFact(k) })))
        : null,
      prof.mathCheckDone ? div("divider") : null,
      prof.mathCheckDone ? div("spread", [
        el("strong", { text: "Level " + mathLevel.id + ": " + mathLevel.name }),
        el("span", { class: "muted small nums", text: levelDone.learned + " of " + levelDone.total + " facts" }),
      ]) : null,
      prof.mathCheckDone ? bar(levelDone.pct) : null,
      prof.mathCheckDone ? p("tiny muted", mathLevel.idea) : null,
      prof.mathCheckDone ? p("tiny muted", "She moves up at about 8 facts in 10 of this level. Levels past " + E.MAX_PLACEMENT_LEVEL + " are only ever earned by answering.") : null,
      speed && speed.direction !== "new" ? p("small", "Time to answer: " + (speed.now / 1000).toFixed(1) + " seconds, was " + (speed.before / 1000).toFixed(1)
        + (speed.direction === "faster" ? ". She is getting quicker." : speed.direction === "slower" ? ". Slower than before." : ". About the same.")) : null,
      speed && speed.direction === "new" ? p("small muted", "Time to answer: " + (speed.now / 1000).toFixed(1) + " seconds. A few more days and this will show whether it is falling.") : null,
      hardFacts.length ? div("list", hardFacts.map((k) => div("spread", [
        el("span", { class: "chip nums", text: prettyFact(k) }),
        el("span", { class: "muted small nums", text: "needed help " + state.facts[k].helps + (state.facts[k].helps === 1 ? " time" : " times") }),
      ]))) : null,
      factTip ? p("", factTip) : null,
      fade ? div("note", [p("small", fade), p("tiny muted", "The app will not shorten her lesson on its own. That is your call.")]) : null,
    ]),

    card([
      h(2, "Maths minutes"),
      mathRecent.length
        ? div("list", mathRecent.slice().reverse().map((d) => div("row", [
            el("span", { class: "small nums", style: "width:84px", text: dayName(d) + " " + prettyDate(d) }),
            el("span", { class: "grow" }, [bar((state.days[d].mathMinutes || 0) / (prof.mathGoalMin || 20))]),
            el("span", { class: "small nums muted", style: "width:52px;text-align:right", text: Math.round(state.days[d].mathMinutes || 0) + "m" }),
          ])))
        : p("muted", "No maths lessons yet."),
      p("tiny muted", "The bar is full at her " + (prof.mathGoalMin || 20) + "-minute goal. Twenty minutes of maths on top of twenty of reading is a lot for a 7-year-old. If she starts to tail off within a sitting, the app will say so in her maths card and leave the decision to you."),
    ]),

    card([
      h(2, "Words she has learned"),
      learnedWords.length ? div("chips", learnedWords.map((w) => el("span", { class: "chip", text: w }))) : p("muted", "None yet."),
    ]),

    card([
      h(2, "Listening"),
      p("small", prof.micOn
        ? "She can read words out loud and the app checks them."
        : "Off. She says each word out loud, then taps to check herself."),
      p("tiny muted", prof.micOn
        ? "Works best on a computer in Chrome. On a tablet it may not hear her, and she taps to check instead."
        : "Turning this on asks for the microphone the first time she reads a word. Nothing is recorded or kept."),
      btn(prof.micOn ? "Turn listening off" : "Turn listening on", async () => {
        state.profile.micOn = !prof.micOn;
        await save({ profile: true });
        buildListener();
        show("parent");
      }),
    ]),

    card([
      h(2, "Send yourself an update"),
      p("small muted", "A short note on how she is doing, to text or email to yourself. Nothing is uploaded."),
      shareProgressControls(),
    ]),

    card([
      h(2, "Start over"),
      p("small muted", "Runs the first-day check again and puts her on a new step. Her learned words are kept."),
      btn("Run the first-day check again", () => {
        state.profile.placementDone = false;
        save({ profile: true });
        show("placementIntro");
      }),
      p("small muted", "The maths check is separate. Running it again moves her level; the facts she knows are kept."),
      btn("Run the maths check again", () => {
        state.profile.mathCheckDone = false;
        save({ profile: true });
        show("mathCheckIntro");
      }),
    ]),
  ]);
});

// ---------- Start-up ----------

const isLocal = () => ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);

async function applyCaps(caps) {
  state.caps = { ...caps, homophones: C.HOMOPHONES };
  state.voice = P.makeVoice(state.caps);
  state.ai = P.makeAI(state.caps);
  let uid = null;
  try { uid = caps.user ? await caps.user.id() : null; } catch { uid = null; }
  state.store = P.makeStore(state.caps, uid);
  const loaded = await state.store.load();
  state.profile = loaded.profile || state.profile;
  state.words = Object.keys(loaded.words || {}).length ? loaded.words : state.words;
  state.facts = Object.keys(loaded.facts || {}).length ? loaded.facts : state.facts;
  state.days = Object.keys(loaded.days || {}).length ? loaded.days : state.days;
  buildListener();
}

/** Listening is a grown-up's decision, not a 7-year-old's: it stays off until a
 *  grown-up turns it on in the parent corner, so she is never asked for the microphone. */
export function buildListener() {
  const allowed = !!(state.profile && state.profile.micOn);
  state.listener = allowed ? P.makeListener(state.caps) : P.makeListener({}, { speech: {} });
}

function openFirstScreen() {
  if (!state.profile) return show("setup");
  if (!state.profile.placementDone) return show("placementIntro");
  show("home");
}

async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get("today") && isLocal()) state.todayOverride = params.get("today");

  const detecting = P.detect();
  const caps = await Promise.race([detecting, sleep(4000).then(() => null)]);
  await applyCaps(caps || {});
  openFirstScreen();

  // A slow host should not keep her waiting: pick the capabilities up when they arrive.
  if (!caps) {
    detecting.then(async (late) => {
      // Nothing may replace her profile, words and facts while she is mid-lesson: the
      // running lesson holds the old objects, and she would lose the work in hand.
      if (!late || state.lesson || state.mathLesson) return;
      await applyCaps(late);
      openFirstScreen();
    }).catch(() => {});
  }
}

boot().catch((err) => {
  mount([card([h(1, "Word by Word"), p("", "Something went wrong starting up."), p("small muted", String(err && err.message || err))])]);
});
