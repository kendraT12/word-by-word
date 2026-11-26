// Word by Word: what the app knows right now, and how screens reach each other.

import * as E from "./engine.js";

export const state = {
  caps: {}, voice: null, listener: null, store: null, ai: null,
  profile: null, words: {}, facts: {}, days: {},
  todayOverride: null,
  lesson: null, mathLesson: null,
};

export function today() {
  return state.todayOverride || E.todayKey(new Date());
}

/** Today's log, created on first use. The maths fields are filled in on a log that may
 *  have been written before there was a maths side. */
export function dayLog() {
  const key = today();
  if (!state.days[key]) state.days[key] = { minutes: 0, practiced: [], learned: [], helps: 0, storyWpm: [] };
  const log = state.days[key];
  if (log.mathMinutes === undefined) log.mathMinutes = 0;
  if (log.mathAnswered === undefined) log.mathAnswered = 0;
  if (log.mathHelps === undefined) log.mathHelps = 0;
  if (!log.mathTrace) log.mathTrace = [];
  return log;
}

/** Days she practised. `kind` is "reading" (the default, so the reading side counts the
 *  same days it always did), "maths", or "any". */
export function practiceDays(kind = "reading") {
  return Object.keys(state.days).filter((k) => {
    const d = state.days[k];
    const read = !!((d.practiced || []).length || d.minutes);
    const maths = !!(d.mathMinutes || d.mathAnswered);
    if (kind === "maths") return maths;
    if (kind === "any") return read || maths;
    return read;
  });
}

let saving = Promise.resolve();
/** Save what changed. Device first, then her account; never two writes of one thing at once. */
export function save({ profile = false, words = false, facts = false, day = false } = {}) {
  const run = async () => {
    if (!state.store) return;
    if (profile && state.profile) await state.store.saveProfile({ ...state.profile, updatedAt: Date.now() });
    if (words) await state.store.saveWords({ ...state.words, updatedAt: Date.now() });
    if (facts) await state.store.saveFacts({ ...state.facts, updatedAt: Date.now() });
    if (day) await state.store.saveDay(today(), { ...dayLog(), updatedAt: Date.now() });
  };
  saving = saving.then(run, run);
  return saving;
}

export function say(text, opts) {
  return state.voice ? state.voice.say(text, opts) : Promise.resolve();
}

/** Says a word she got wrong, slowly and then at normal speed. */
export async function modelWord(word) {
  await say("Good try! This is how we say it:");
  await say(word, { slow: true });
  await say(word);
}

const screens = {};
export function screen(name, render) { screens[name] = render; }
export function show(name, params = {}) {
  const render = screens[name];
  if (!render) throw new Error("no screen named " + name);
  if (state.voice) state.voice.stop();
  return render(params);
}
