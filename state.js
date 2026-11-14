// Word by Word: what the app knows right now, and how screens reach each other.

import * as E from "./engine.js";

export const state = {
  caps: {}, voice: null, listener: null, store: null, ai: null,
  profile: null, words: {}, days: {},
  todayOverride: null,
  lesson: null,
};

export function today() {
  return state.todayOverride || E.todayKey(new Date());
}

/** Today's log, created on first use. */
export function dayLog() {
  const key = today();
  if (!state.days[key]) state.days[key] = { minutes: 0, practiced: [], learned: [], helps: 0, storyWpm: [] };
  return state.days[key];
}

export function practiceDays() {
  return Object.keys(state.days).filter((k) => (state.days[k].practiced || []).length || state.days[k].minutes);
}

let saving = Promise.resolve();
/** Save what changed. Device first, then her account; never two writes of one thing at once. */
export function save({ profile = false, words = false, day = false } = {}) {
  const run = async () => {
    if (!state.store) return;
    if (profile && state.profile) await state.store.saveProfile({ ...state.profile, updatedAt: Date.now() });
    if (words) await state.store.saveWords({ ...state.words, updatedAt: Date.now() });
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
