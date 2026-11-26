// Word by Word: Fast Facts. One fact, a bar, and a number pad.
// She answers first. The app never shows or says an answer before she has had a go.

import * as MC from "./math-content.js";
import { say } from "./state.js";
import { el, p, btn, bar, sleep } from "./ui.js";
import { stage } from "./word.js";

/** How long she may take to start answering and still have known the fact rather than
 *  worked it out. A guess, like Fast Words' 3.5 seconds, and the parent corner shows
 *  her real times so it can be set from what she actually does. */
export const FACT_MS = 5000;

/** How long after the bar empties before a child sitting alone is offered a way out. */
const STUCK_MS = 8000;

const opWord = (op) => (op === "+" ? "plus" : "take away");
const opSign = (op) => (op === "+" ? "+" : "−");

export function spokenFact(key) {
  const p = MC.partsOf(key);
  if (!p) return "";
  return p.a + " " + opWord(p.op) + " " + p.b + " is " + MC.answerOf(key);
}

/** The fact, big, with a blank where her answer goes. Numerals only — a row of dots
 *  would be a row of things to count, and counting is the habit being broken. */
function sumEl(parts, shown) {
  return el("div", { class: "sum center" }, [
    parts.a + " " + opSign(parts.op) + " " + parts.b + " = ",
    el("span", { class: "slot", text: shown }),
  ]);
}

/** A bar that drains over the time she has. The transition has to be on the element
 *  before the width changes, or the browser jumps straight to the end. */
function drainingBar(ms) {
  const fill = el("span", {
    style: "display:block;height:100%;width:100%;background:var(--accent);transition:width " + ms + "ms linear",
  });
  const outer = el("div", { class: "bar", style: "width:100%;max-width:240px;margin:0 auto;height:12px" }, [fill]);
  outer.start = () => { void fill.getBoundingClientRect().width; fill.style.width = "0%"; };
  return outer;
}

/**
 * Asks one fact and waits for her.
 *
 * The bar stops on her FIRST digit, not on her finished answer: recall is the moment she
 * knows it, and tapping 1 then 7 is her finger moving, not her thinking.
 *
 * Resolves `{ answer, correct, startedMs, quality }` where quality is
 *   "ok"   — right, and she started inside the bar: she knows it
 *   "slow" — right, but she started after the bar: she worked it out
 *   "miss" — wrong, or she asked to be shown
 * An untimed ask never returns "slow".
 */
export function askFact(key, opts = {}) {
  const { timed = true, limitMs = FACT_MS, feedback = true, note = "" } = opts;
  const parts = MC.partsOf(key);
  const want = MC.answerOf(key);

  return new Promise((resolve) => {
    const shownAt = Date.now();
    let typed = "";
    let startedMs = null;
    let settleId = 0;
    let stuckId = 0;
    let offerHelp = false;
    let done = false;

    const finish = (quality, answer) => {
      if (done) return;
      done = true;
      settleId++;
      stuckId++;
      resolve({
        answer,
        correct: quality === "ok" || quality === "slow",
        startedMs: startedMs === null ? Date.now() - shownAt : startedMs,
        quality,
      });
    };

    function draw(view = {}) {
      const { answerShown = false, message = "", controls = null } = view;
      const slot = answerShown ? String(want) : typed || " ";
      let barNode = null;
      if (timed && !answerShown) {
        barNode = startedMs === null
          ? drainingBar(limitMs)
          : bar(Math.max(0, 1 - startedMs / limitMs));
      }
      stage([
        note ? p("small muted center", note) : null,
        sumEl(parts, slot),
        barNode,
        message ? p("center", message) : null,
        controls ? el("div", { class: "row", style: "justify-content:center" }, controls) : pad(),
        !controls && offerHelp ? btn("I do not know this one", () => showMe(), "quiet") : null,
      ]);
      if (barNode && barNode.start) barNode.start();
    }

    function pad() {
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => btn(d, () => tap(d), "key"));
      keys.push(btn("Back", () => back(), "small quiet"));
      keys.push(btn("0", () => tap("0"), "key"));
      keys.push(btn("Check", () => submit(), "small primary"));
      return el("div", { class: "pad" }, keys);
    }

    // No clearTimeout on the test engine, so every timer checks whether it is still
    // the current one instead of being cancelled.
    const armSettle = () => {
      const mine = ++settleId;
      setTimeout(() => { if (!done && mine === settleId) submit(); }, MC.settleDelay(typed));
    };
    const armStuck = () => {
      const mine = ++stuckId;
      setTimeout(() => {
        if (done || mine !== stuckId || typed !== "" || offerHelp) return;
        offerHelp = true;
        draw();
      }, (timed ? limitMs : 0) + STUCK_MS);
    };

    function tap(d) {
      if (done || typed.length >= 2) return;
      if (startedMs === null) startedMs = Date.now() - shownAt; // the bar stops here
      typed += d;
      draw();
      armSettle();
    }

    function back() {
      if (done || !typed) return;
      typed = typed.slice(0, -1);
      settleId++;
      draw();
      if (typed) armSettle();
    }

    function submit() {
      if (done || typed === "") return;
      settleId++;
      const answer = Number(typed);
      if (answer !== want) return reveal("miss", answer);
      reveal(timed && startedMs > limitMs ? "slow" : "ok", answer);
    }

    function showMe() {
      if (!done) reveal("miss", null);
    }

    async function reveal(quality, answer) {
      if (done) return;
      if (!feedback) return finish(quality, answer);
      const right = quality === "ok" || quality === "slow";
      draw({
        answerShown: true,
        message: right ? (quality === "slow" ? "Yes — and soon you will just know it." : "Yes!") : "Have a look.",
        controls: [],
      });
      await say(spokenFact(key));
      if (right) {
        await sleep(500);
        finish(quality, answer);
        return;
      }
      // A wrong answer is not hurried past: she reads the right one and says so herself.
      draw({
        answerShown: true,
        message: "Say it with me, then we go on.",
        controls: [btn("I will remember", () => finish(quality, answer), "primary big")],
      });
    }

    draw();
    armStuck();
  });
}

/** A line of facts in a row, each one asked the same way. Used by Fast Facts and
 *  by the level's drills. Returns one result per fact, in order. */
export async function askFacts(keys, opts = {}) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const note = opts.note || (keys.length > 1 ? "Fast Facts — " + (i + 1) + " of " + keys.length : "");
    let r;
    try { r = await askFact(keys[i], { ...opts, note }); }
    catch { r = { answer: null, correct: false, startedMs: 0, quality: "miss" }; }
    out.push({ key: keys[i], ...r });
    if (opts.onEach) await opts.onEach(out[out.length - 1], i);
  }
  return out;
}
