// Word by Word: the four steps every word goes through.
// She always tries first. The app only says a word after she has had a go at it.

import * as E from "./engine.js";
import * as C from "./content.js";
import { state, say, modelWord } from "./state.js";
import { el, div, p, btn, card, mount, wordEl, shuffle, sleep, tappableText } from "./ui.js";

const STUCK_AT = 3;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const withName = (s) => String(s).replaceAll("{name}", state.profile ? state.profile.name : "");

let header = "";
export function setHeader(text) { header = text; }

/** The one card the lesson lives in. Exported so the maths screens share the header. */
export function stage(kids) {
  mount([header ? p("small muted center", header) : null, card(kids)]);
}

const taughtSet = () => E.allowedWords({ profile: state.profile, words: state.words, content: C });
const readable = (text) => E.offListWords(text, taughtSet()).length === 0;

// ---------- Step 1: Say it ----------

/** How long she may take and still have read the word whole, rather than worked it out.
 *  This was invented, not measured. A grown-up can set it in the parent corner, where the
 *  app shows what her own two groups of times actually are. */
export const FLUENT_MS = 3500;

export function fluentMs() {
  const set = state.profile && state.profile.wordMs;
  return set > 0 ? set : FLUENT_MS;
}

function stepSay(entry, pats, { fast = false } = {}, out = null) {
  return new Promise((resolve) => {
    let misses = 0, listenFails = 0, startedAt = 0, readMs = 0;
    const word = entry.w;
    const stopClock = () => { readMs = startedAt ? Date.now() - startedAt : 0; };

    let startBar = null;
    const timerBar = () => {
      // The transition must already be in place before the width changes, or nothing animates.
      const fill = el("span", {
        style: "display:block;height:100%;width:100%;background:var(--accent);transition:width " + fluentMs() + "ms linear",
      });
      // width is explicit: inside a flex column, `margin: auto` alone collapses it to nothing.
      const outer = el("div", { class: "bar", style: "width:100%;max-width:220px;margin:0 auto;height:12px;background:var(--line)" }, [fill]);
      // Measure once it is on the page, so the browser has a width to animate away from.
      startBar = () => { void fill.getBoundingClientRect().width; fill.style.width = "0%"; };
      return outer;
    };

    const frame = (note, controls, { bar = false } = {}) => {
      startBar = null;
      stage([
        p("small muted center", fast ? "Say it as soon as you see it" : "Read it out loud"),
        // In Fast Words the whole word is the point, so nothing is highlighted inside it.
        div("center", [wordEl(word, fast ? [] : pats)]),
        bar ? timerBar() : null,
        note ? p("center", note) : null,
        el("div", { class: "row", style: "justify-content:center" }, controls),
      ]);
      if (startBar) startBar();
    };

    const done = () => {
      // Her time is kept whatever the outcome: it is what the bar gets set from later.
      if (out && readMs > 0) out.sayMs = readMs;
      if (misses > 0) return resolve("help");
      resolve(readMs > fluentMs() ? "slow" : "ok");
    };

    async function miss(heard) {
      misses++;
      if (misses >= STUCK_AT) {
        await slideAndSay(word, pats);
        resolve("help");
        return;
      }
      frame(heard ? "I heard “" + heard + "”." : null, []);
      await modelWord(word);
      frame("Your turn.", [btn("I am ready", () => tryAgain(), "primary big")]);
    }

    function tryAgain() { useListener() ? listenNow() : selfCheck(); }
    const useListener = () => state.listener && state.listener.available && listenFails < 2;

    async function listenNow() {
      startedAt = Date.now();
      frame("Listening…", [btn("I cannot talk now", () => { listenFails = 2; selfCheck(); }, "quiet")], { bar: fast });
      const heard = await state.listener.listenForWord(word);
      if (heard === null) {
        listenFails++;
        if (!useListener()) { frame("Let's try it another way.", [btn("Next", () => selfCheck(), "primary big")]); return; }
        frame("I did not hear that.", [btn("Try again", () => listenNow(), "primary big")]);
        return;
      }
      if (E.matchSpoken(heard, word, C.HOMOPHONES)) { stopClock(); await say("Yes! " + word + "!"); done(); return; }
      miss(heard);
    }

    function selfCheck() {
      startedAt = Date.now();
      frame(null, [btn(fast ? "I said it!" : "Check me", async () => {
        stopClock(); // her reading time stops here, not after she has heard it back
        frame(null, []);
        await say(word);
        frame("Did you say it the same way?", [
          btn("I said it the same", () => done(), "primary"),
          btn("I said it differently", () => miss(null)),
        ]);
      }, "primary big")], { bar: fast });
    }

    if (useListener()) frame(null, [btn("Start", () => listenNow(), "primary big")]);
    else selfCheck();
  });
}

// ---------- Slide & Say ----------

export function slideAndSay(word, pats = []) {
  return new Promise((resolve) => {
    const chunks = E.soundChunks(word);
    let lit = 0;

    const spans = chunks.map((c) => el("span", {
      text: c, class: "word",
      style: "padding:0 .06em;border-radius:8px;transition:background .12s;opacity:.35",
    }));

    const track = el("div", {
      style: "display:flex;justify-content:center;flex-wrap:wrap;touch-action:none;cursor:pointer;user-select:none;padding:8px 0",
    }, spans);

    const paint = () => spans.forEach((s, i) => {
      s.style.opacity = i < lit ? "1" : "0.35";
      s.style.background = i === lit - 1 ? "var(--hi-bg)" : "transparent";
      s.style.color = i === lit - 1 ? "var(--hi-ink)" : "var(--ink)";
    });

    const hint = p("center small muted", "Slide your finger across and say each sound.");
    const controls = el("div", { class: "row", style: "justify-content:center" }, []);

    let speaking = false;
    const advanceTo = async (index) => {
      if (speaking) return; // her finger keeps moving while a sound plays
      const next = Math.max(lit, Math.min(chunks.length, index + 1));
      speaking = true;
      try { while (lit < next) { lit++; paint(); await say(chunks[lit - 1]); } }
      finally { speaking = false; }
      if (lit >= chunks.length) finish();
    };

    const fromPoint = (clientX) => {
      for (let i = 0; i < spans.length; i++) {
        const box = spans[i].getBoundingClientRect();
        if (clientX >= box.left && clientX <= box.right) return i;
      }
      return clientX < track.getBoundingClientRect().left ? -1 : chunks.length - 1;
    };

    let dragging = false;
    track.addEventListener("pointerdown", (e) => { dragging = true; track.setPointerCapture(e.pointerId); advanceTo(fromPoint(e.clientX)); });
    track.addEventListener("pointermove", (e) => { if (dragging) advanceTo(fromPoint(e.clientX)); });
    track.addEventListener("pointerup", () => { dragging = false; });
    track.addEventListener("pointercancel", () => { dragging = false; });

    function finish() {
      hint.textContent = "Now say the whole word.";
      controls.replaceChildren(btn("Check me", async () => {
        controls.replaceChildren();
        await say(word, { slow: true });
        await say(word);
        controls.replaceChildren(btn("Got it", () => resolve(), "primary big"));
      }, "primary big"));
    }

    stage([
      p("small muted center", "Let's slide the sounds together"),
      track,
      hint,
      controls,
      btn("Skip to the end", () => advanceTo(chunks.length - 1), "quiet"),
    ]);
    paint();
  });
}

// ---------- Step 2: Spell it ----------

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function stepSpell(entry) {
  return new Promise(async (resolve) => {
    const word = entry.w;
    const letters = word.split("");
    let filled = 0, wrongHere = 0, wrongTotal = 0;

    const slots = letters.map(() => el("span", {
      class: "word",
      style: "min-width:.75em;border-bottom:5px solid var(--line);display:inline-block;text-align:center;margin:0 .06em",
      text: " ",
    }));
    const slotRow = el("div", { style: "display:flex;justify-content:center;flex-wrap:wrap;gap:4px" }, slots);

    const extras = [];
    const pool = ALPHABET.split("").filter((c) => !word.toLowerCase().includes(c));
    while (extras.length < 3 && pool.length) extras.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);

    const tray = el("div", { class: "row", style: "justify-content:center" }, []);
    const note = p("center small muted", "");

    const tiles = shuffle(letters.concat(extras), word).map((ch) => {
      const tile = btn(ch, () => pick(ch, tile), "big");
      tile.style.fontFamily = "var(--word)";
      tile.style.minWidth = "58px";
      return tile;
    });
    tray.replaceChildren(...tiles);

    const glowRight = () => {
      const want = letters[filled];
      const tile = tiles.find((t) => !t.disabled && t.textContent === want);
      if (tile) { tile.classList.add("right"); note.textContent = "This one comes next."; }
    };

    function pick(ch, tile) {
      if (filled >= letters.length) return;
      if (ch === letters[filled]) {
        slots[filled].textContent = ch;
        slots[filled].style.borderBottomColor = "var(--good)";
        tile.disabled = true; tile.classList.remove("right");
        filled++; wrongHere = 0; note.textContent = "";
        tiles.forEach((t) => t.classList.remove("right"));
        if (filled === letters.length) {
          say("Yes! That spells " + word + ".");
          setTimeout(() => resolve(wrongTotal >= STUCK_AT ? "help" : "ok"), 650);
        }
        return;
      }
      wrongHere++; wrongTotal++;
      tile.classList.add("pop");
      setTimeout(() => tile.classList.remove("pop"), 260);
      note.textContent = "Not that one.";
      if (wrongHere >= 2) glowRight();
    }

    stage([
      p("small muted center", "Spell it"),
      slotRow,
      note,
      tray,
      btn("Say it again", () => say("Spell " + word), "quiet"),
    ]);
    await say("Spell " + word);
  });
}

// ---------- Step 3: What is it? ----------

function distractors(entry) {
  if (entry.kind === "everyday") {
    const others = Object.keys(C.CATEGORY_PHRASE).filter((c) => c !== entry.cat);
    return shuffle(others, entry.w).slice(0, 2).map((c) => C.CATEGORY_PHRASE[c]);
  }
  const pool = C.STEPS.flatMap((s) => s.words).filter((e) => e.mean && e.w !== entry.w && e.kind !== entry.kind);
  const picked = shuffle(pool, entry.w).slice(0, 2).map((e) => e.mean);
  while (picked.length < 2) picked.push(C.CATEGORY_PHRASE.color);
  return picked;
}

function orderQuestion(entry) {
  const list = C.EVERYDAY.filter((e) => e.cat === entry.cat);
  const at = list.findIndex((e) => e.w === entry.w);
  if (at < 0 || at + 1 >= list.length) return null;
  const answer = list[at + 1].w;
  const wrong = shuffle(list.filter((e) => e.w !== answer && e.w !== entry.w), entry.w).slice(0, 2).map((e) => e.w);
  return { ask: "What comes after " + entry.w + "?", answer, choices: shuffle([answer, ...wrong], answer) };
}

function askChoices({ promptLine, question, answer, choices, onDone }) {
  let misses = 0, usedHelp = false;
  const render = () => {
    const buttons = choices.map((choice) => {
      const b = btn(choice, async () => {
        if (choice === answer) {
          b.classList.add("right");
          await say("That's right.");
          onDone(misses > 0 || usedHelp ? "help" : "ok");
          return;
        }
        misses++;
        b.disabled = true;
        if (misses >= STUCK_AT) {
          const good = buttons.find((x) => x.textContent === answer);
          if (good) good.classList.add("right");
          await say(answer);
          onDone("help");
        }
      });
      b.style.textAlign = "left";
      b.style.whiteSpace = "normal";
      return b;
    });
    stage([
      promptLine ? p("small muted center", promptLine) : null,
      question,
      el("div", { class: "stack" }, buttons),
      btn("Read it to me", async () => {
        // Hearing a choice only counts as help when she could have read it herself.
        if (choices.every(readable)) usedHelp = true;
        for (const choice of choices) await say(choice);
      }, "quiet"),
    ]);
  };
  render();
}

function stepMean(entry) {
  return new Promise(async (resolve) => {
    const word = entry.w;

    const askOrder = (soFar) => {
      const order = entry.cat && ["month", "day", "number"].includes(entry.cat) ? orderQuestion(entry) : null;
      if (!order) return resolve(soFar);
      askChoices({
        promptLine: null,
        question: div("center", [el("p", { class: "reading", text: order.ask })]),
        answer: order.answer, choices: order.choices,
        onDone: (r) => resolve(r === "ok" && soFar === "ok" ? "ok" : "help"),
      });
    };

    const byChoices = () => {
      if (entry.kind === "little") {
        const parts = entry.fill.split("___");
        const sentence = el("p", { class: "reading center" }, [parts[0], el("strong", { text: " ___ " }), parts[1] || ""]);
        askChoices({
          promptLine: "Which word fits?",
          question: sentence,
          answer: word, choices: shuffle([word, ...entry.alts], word),
          onDone: resolve,
        });
        return;
      }
      askChoices({
        promptLine: "What is it?",
        question: div("center", [wordEl(word, [], "word")]),
        answer: entry.mean, choices: shuffle([entry.mean, ...distractors(entry)], word),
        onDone: (r) => askOrder(r),
      });
    };

    // When she can talk to it, let her explain in her own words first.
    if (state.listener && state.listener.available && state.ai && state.ai.available && entry.kind !== "little") {
      const question = entry.kind === "everyday" ? "What is " + word + "?" : "What does " + word + " mean?";
      const frame = (note, controls) => stage([
        p("small muted center", "Tell me what it means"),
        div("center", [wordEl(word, [], "word")]),
        el("p", { class: "center", text: note || question }),
        el("div", { class: "row", style: "justify-content:center" }, controls),
      ]);
      frame(null, [btn("Start", async () => {
        frame("Listening…", []);
        // She may start by saying the word itself, so let her finish the whole explanation.
        const said = await state.listener.listenForWord(word, { timeoutMs: 12000, settleMs: 2200, stopOnMatch: false });
        const verdict = said ? await state.ai.checkExplain({ word, mean: entry.mean, said }) : false;
        if (verdict === true) { await say("Yes! " + entry.mean + "."); askOrder("ok"); return; }
        byChoices();
      }, "primary big"), btn("Show me choices", () => byChoices(), "quiet")]);
      return;
    }
    byChoices();
  });
}

// ---------- Reading a passage, with the app following along ----------

export function readAlong(text, { label = "Read it out loud" } = {}) {
  return new Promise((resolve) => {
    const words = E.tokens(text);
    let helps = 0, matched = 0, started = 0, session = null, finished = false;
    const spans = [];

    const panel = tappableText(text, async (bare, span) => {
      if (!bare) return;
      helps++;
      span.style.background = "var(--hi-bg)";
      span.style.color = "var(--hi-ink)";
      await say(bare);
    });
    panel.querySelectorAll(".tap").forEach((s) => spans.push(s));

    const markRead = (count) => {
      for (let i = matched; i < count && i < spans.length; i++) {
        spans[i].style.borderBottomColor = "var(--good)";
        spans[i].style.opacity = "0.75";
      }
      matched = Math.max(matched, count);
      if (matched >= words.length) finish();
    };

    async function finish() {
      if (finished) return;
      finished = true;
      const ms = started ? Date.now() - started : 0;
      if (session) await session.stop();
      resolve({ helps, ms, words: words.length });
    }

    const controls = el("div", { class: "row", style: "justify-content:center" }, []);
    const canListen = () => state.listener && state.listener.available;

    const startReading = () => {
      started = Date.now();
      if (canListen()) {
        session = state.listener.listenAlong((heard) => {
          markRead(E.matchReadAlong(words, E.tokens(heard), C.HOMOPHONES));
        });
      }
      controls.replaceChildren(btn("I read it", () => finish(), "primary big"));
    };

    controls.replaceChildren(btn("Start reading", () => startReading(), "primary big"));
    stage([
      p("small muted center", label),
      panel,
      controls,
      p("tiny muted center", "Tap any word you get stuck on."),
    ]);
  });
}

// ---------- Step 4: Her own two sentences ----------

function fallbackMini(entry) {
  const word = entry.w;
  const first = entry.kind === "little"
    ? "We use the word " + word + " a lot."
    : cap(word) + " is " + entry.mean + ".";
  let second = withName(entry.ex);
  if (entry.cat === "month" && state.profile && C.EVERYDAY.filter((e) => e.cat === "month").findIndex((e) => e.w === word) + 1 === state.profile.birthMonth) {
    second = "It is " + state.profile.name + "'s birthday month!";
  }
  return first + " " + second;
}

async function stepStory(entry) {
  let text = null;
  if (state.ai && state.ai.available) {
    text = await state.ai.mini({
      word: entry.w, mean: entry.mean || entry.ex, name: state.profile.name,
      favorites: state.profile.favorites || [], allowed: [...taughtSet()],
    });
  }
  const passage = text || fallbackMini(entry);
  const { helps } = await readAlong(passage, { label: "Read these two sentences" });
  await say(passage);
  return helps > 0 ? "help" : "ok";
}

// ---------- The whole routine ----------

/** mode "new" runs all four steps, "review" runs Say + Spell, "warmup" is Fast Words: Say only, against a clock.
 *  A step that breaks counts as help and the lesson carries on: she is on her own here. */
export async function runWord(entry, { mode = "new", pats = [] } = {}) {
  const result = {};
  const run = async (name, fn) => { try { result[name] = await fn(); } catch { result[name] = "help"; } };
  await run("say", () => stepSay(entry, pats, { fast: mode === "warmup" }, result));
  if (mode === "warmup") return result;
  await run("spell", () => stepSpell(entry));
  if (mode === "review") return result;
  await run("mean", () => stepMean(entry));
  await run("story", () => stepStory(entry));
  return result;
}
