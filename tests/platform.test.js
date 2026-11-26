import { test, eq, ok } from "./t.js";
import * as P from "../platform.js";

// --- fakes -------------------------------------------------------------
function fakeDictation(script = []) {
  const subs = { final: [], partial: [], state: [] };
  const d = {
    started: 0, stopped: 0, rejectWith: null,
    async start() { d.started++; if (d.rejectWith) throw { code: d.rejectWith, message: "no" };
      for (const s of script) setTimeout(() => d.emit(s.kind, s.text), s.at); },
    async stop() { d.stopped++; },
    active: () => false,
    onFinal(fn) { subs.final.push(fn); return () => {}; },
    onPartial(fn) { subs.partial.push(fn); return () => {}; },
    onState(fn) { subs.state.push(fn); return () => {}; },
    emit(kind, text) { subs[kind].forEach((fn) => fn({ text })); },
  };
  return d;
}
function fakeTts() {
  const t = { spoken: [], rejectWith: null, stopped: 0,
    async speak(what, opts) { if (t.rejectWith) throw { code: t.rejectWith, message: "no" }; t.spoken.push({ what, opts }); return { playedMs: 10 }; },
    async stop() { t.stopped++; }, active: () => false, onState() { return () => {}; } };
  return t;
}
function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}
function fakeDb(opts = {}) {
  const docs = opts.docs || {};
  const db = { writes: [], failSet: opts.failSet || false,
    doc(path) { return {
      async get() { return { exists: path in docs, data: () => docs[path] }; },
      async set(data) { if (db.failSet) throw new Error("denied"); db.writes.push({ path, data }); docs[path] = data; },
    }; },
    collection(path) { return { async get() {
      const out = Object.keys(docs).filter((p) => p.startsWith(path + "/")).map((p) => ({ id: p.slice(path.length + 1), data: () => docs[p] }));
      return { docs: out };
    } }; } };
  return db;
}

// --- voice -------------------------------------------------------------
test("voice: uses the Claude voice when it is available", async () => {
  const tts = fakeTts();
  const v = P.makeVoice({ tts });
  eq(v.kind, "claude");
  await v.say("Hello");
  eq(tts.spoken[0].what, "Hello"); eq(tts.spoken[0].opts.rate, 0.85);
});
test("voice: slow speech uses the slower rate", async () => {
  const tts = fakeTts();
  await P.makeVoice({ tts }).say("January", { slow: true });
  eq(tts.spoken[0].opts.rate, 0.7);
});
test("voice: a viewer who turned speech off stops the app speaking", async () => {
  const tts = fakeTts(); tts.rejectWith = "not_granted";
  const v = P.makeVoice({ tts });
  await v.say("Hi");
  eq(v.kind, "none"); eq(tts.spoken.length, 0);
});
test("voice: busy and stopped errors do not turn speech off", async () => {
  const tts = fakeTts(); tts.rejectWith = "busy";
  const v = P.makeVoice({ tts });
  await v.say("Hi");
  eq(v.kind, "claude");
});
test("voice: no voice at all is still safe to call", async () => {
  const v = P.makeVoice({});
  eq(v.kind, "none");
  await v.say("Hi");
  v.stop();
});

// --- listener ----------------------------------------------------------
test("listener: silence gives up instead of hanging", async () => {
  const l = P.makeListener({ dictation: fakeDictation([]) });
  eq(l.available, true);
  eq(await l.listenForWord("ship", { timeoutMs: 60 }), null);
});
test("listener: returns what she said", async () => {
  const d = fakeDictation([{ kind: "final", text: " ship", at: 5 }]);
  eq(await P.makeListener({ dictation: d }).listenForWord("ship", { timeoutMs: 300, settleMs: 20 }), "ship");
});
test("listener: stops as soon as the word matches", async () => {
  const d = fakeDictation([{ kind: "partial", text: "ship", at: 5 }]);
  const l = P.makeListener({ dictation: d });
  eq(await l.listenForWord("ship", { timeoutMs: 2000, settleMs: 1000 }), "ship");
  eq(d.stopped >= 1, true);
});
test("listener: keeps listening while she is still talking", async () => {
  const d = fakeDictation([{ kind: "final", text: "um", at: 5 }, { kind: "final", text: " ship", at: 30 }]);
  eq(await P.makeListener({ dictation: d }).listenForWord("ship", { timeoutMs: 400, settleMs: 40 }), "um ship");
});
test("listener: a viewer who says no to the microphone turns listening off", async () => {
  const d = fakeDictation([]); d.rejectWith = "not_granted";
  const l = P.makeListener({ dictation: d });
  eq(await l.listenForWord("ship", { timeoutMs: 60 }), null);
  eq(l.available, false);
});
test("listener: no dictation at all is not available", async () => {
  const l = P.makeListener({});
  eq(l.available, false);
  eq(await l.listenForWord("ship"), null);
});

// --- store -------------------------------------------------------------
const PROFILE = { name: "Zoe", step: 1, updatedAt: 5 };
test("store: saves online and on the device when it can", async () => {
  const storage = fakeStorage(), db = fakeDb();
  const s = P.makeStore({ db }, "u1", storage);
  await s.saveWords({ cat: { status: "learned" } });
  eq(s.mode, "online");
  eq(db.writes[0].path, "data/users/u1/words");
  ok(storage.getItem("wbw:v1").includes("learned"));
});
test("store: a refused save keeps the lesson going on this device", async () => {
  const storage = fakeStorage(), db = fakeDb({ failSet: true });
  const s = P.makeStore({ db }, "u1", storage);
  await s.saveWords({ cat: { status: "learned" } });
  eq(s.mode, "device");
  ok(storage.getItem("wbw:v1").includes("learned"));
});
test("store: signed out saves on the device only", async () => {
  const storage = fakeStorage();
  const s = P.makeStore({}, null, storage);
  eq(s.mode, "device");
  await s.saveProfile(PROFILE);
  eq(JSON.parse(storage.getItem("wbw:v1")).profile.name, "Zoe");
});
test("store: the newer copy wins when a device and the account disagree", async () => {
  const storage = fakeStorage();
  storage.setItem("wbw:v1", JSON.stringify({ profile: { name: "Old", updatedAt: 1 }, words: { cat: { status: "new" } }, days: {} }));
  const db = fakeDb({ docs: { "data/users/u1/profile": { name: "New", updatedAt: 9 }, "data/users/u1/words": { map: { status: "learned" }, updatedAt: 9 } } });
  const got = await P.makeStore({ db }, "u1", storage).load();
  eq(got.profile.name, "New");
  ok(got.words.map && !got.words.updatedAt);
});
test("store: the device copy wins when it is newer than the account", async () => {
  const storage = fakeStorage();
  storage.setItem("wbw:v1", JSON.stringify({ profile: { name: "Fresh", updatedAt: 20 }, words: {}, days: {} }));
  const db = fakeDb({ docs: { "data/users/u1/profile": { name: "Stale", updatedAt: 2 } } });
  eq((await P.makeStore({ db }, "u1", storage).load()).profile.name, "Fresh");
});
test("store: her facts save and load back beside her words", async () => {
  const storage = fakeStorage(), db = fakeDb();
  const s = P.makeStore({ db }, "u1", storage);
  await s.saveFacts({ "3+4": { status: "learned" } });
  eq(db.writes[0].path, "data/users/u1/facts");
  const got = await s.load();
  eq(got.facts["3+4"].status, "learned");
  eq(got.facts.updatedAt, undefined);
});
test("store: an account with no maths yet loads an empty set of facts", async () => {
  const s = P.makeStore({}, null, fakeStorage());
  eq((await s.load()).facts, {});
});
test("store: day logs load back by date", async () => {
  const storage = fakeStorage(), db = fakeDb();
  const s = P.makeStore({ db }, "u1", storage);
  await s.saveDay("2026-11-12", { minutes: 15, updatedAt: 3 });
  eq((await s.load()).days["2026-11-12"].minutes, 15);
});

// --- Claude-written stories -------------------------------------------
function fakeSample(replies) {
  let i = 0;
  const fn = async () => ({ text: "" });
  fn.calls = 0;
  fn.json = async () => { fn.calls++; const r = replies[Math.min(i++, replies.length - 1)]; if (r instanceof Error) throw r; return r; };
  return fn;
}
const ALLOWED = ["zoe", "the", "cat", "sat", "on", "a", "mat", "and", "ran"];
const okStory = { title: "The Cat", text: "The cat sat on a mat. The cat ran. Zoe sat. The cat sat on Zoe.", q: [{ ask: "Who sat?", answer: "the cat", choices: ["the cat", "a dog", "Zoe"] }] };

test("story: a story she can read comes through", async () => {
  const sample = fakeSample([okStory]);
  const got = await P.makeAI({ sample }).story({ name: "Zoe", favorites: [], allowed: ALLOWED, stepWords: ["cat"], sentences: 4 });
  eq(got.title, "The Cat"); eq(sample.calls, 1);
});
test("story: one tricky word is allowed", async () => {
  const s = { ...okStory, text: "The cat sat on a mat. The cat ran to the tree. Zoe sat. The cat sat." };
  const got = await P.makeAI({ sample: fakeSample([s]) }).story({ name: "Zoe", favorites: [], allowed: ALLOWED, stepWords: ["cat"], sentences: 4 });
  ok(got && got.text.includes("tree"));
});
test("story: too many hard words twice falls back to a built-in story", async () => {
  const hard = { ...okStory, text: "The elephant walked through the enormous jungle. Zoe sat. The cat ran. The cat sat." };
  const sample = fakeSample([hard, hard]);
  eq(await P.makeAI({ sample }).story({ name: "Zoe", favorites: [], allowed: ALLOWED, stepWords: ["cat"], sentences: 4 }), null);
  eq(sample.calls, 2);
});
test("story: a bad reply falls back instead of breaking the lesson", async () => {
  eq(await P.makeAI({ sample: fakeSample([new Error("invalid_json")]) }).story({ name: "Zoe", favorites: [], allowed: ALLOWED, stepWords: ["cat"], sentences: 4 }), null);
});
test("story: no Claude at all falls back", async () => {
  eq(await P.makeAI({}).story({ name: "Zoe", favorites: [], allowed: ALLOWED, stepWords: ["cat"], sentences: 4 }), null);
});
test("story: a story missing its question falls back", async () => {
  eq(await P.makeAI({ sample: fakeSample([{ title: "X", text: "The cat sat. The cat ran. Zoe sat. The cat sat." }]) })
    .story({ name: "Zoe", favorites: [], allowed: ALLOWED, stepWords: ["cat"], sentences: 4 }), null);
});
test("mini story: two sentences she can read", async () => {
  const got = await P.makeAI({ sample: fakeSample([{ text: "The cat sat. Zoe ran." }]) })
    .mini({ word: "cat", mean: "a pet", name: "Zoe", favorites: [], allowed: ALLOWED });
  eq(got, "The cat sat. Zoe ran.");
});
test("mini story: a hard reply falls back to the written sentences", async () => {
  eq(await P.makeAI({ sample: fakeSample([{ text: "The elephant wandered everywhere." }, { text: "Another enormous elephant." }]) })
    .mini({ word: "cat", mean: "a pet", name: "Zoe", favorites: [], allowed: ALLOWED }), null);
});
test("explaining: Claude says whether her answer shows she understands", async () => {
  const ai = P.makeAI({ sample: fakeSample([{ understands: true }]) });
  eq(await ai.checkExplain({ word: "January", mean: "the first month of the year", said: "its the first month" }), true);
});
test("explaining: an unclear answer is not counted right", async () => {
  eq(await P.makeAI({ sample: fakeSample([{ understands: false }]) }).checkExplain({ word: "January", mean: "m", said: "um" }), false);
});
test("explaining: empty speech is not sent to Claude", async () => {
  const sample = fakeSample([{ understands: true }]);
  eq(await P.makeAI({ sample }).checkExplain({ word: "January", mean: "m", said: "  " }), false);
  eq(sample.calls, 0);
});
test("explaining: no Claude means the app asks her to tap instead", async () => {
  eq(await P.makeAI({}).checkExplain({ word: "January", mean: "m", said: "the first month" }), null);
});

// --- listening while she reads a whole story ---
test("read-along: hands over what she has read so far", async () => {
  const d = fakeDictation([{ kind: "final", text: "the cat", at: 5 }, { kind: "final", text: " sat", at: 20 }]);
  const seen = [];
  const l = P.makeListener({ dictation: d });
  const run = l.listenAlong((text) => seen.push(text), { timeoutMs: 120 });
  await new Promise((r) => setTimeout(r, 60));
  await run.stop();
  eq(seen[seen.length - 1], "the cat sat");
  eq(d.stopped >= 1, true);
});
test("read-along: without dictation it simply does nothing", async () => {
  const run = P.makeListener({}).listenAlong(() => { throw new Error("should not be called"); }, { timeoutMs: 50 });
  await run.stop();
});
test("listener: an explanation is not cut off when she starts with the word itself", async () => {
  const d = fakeDictation([{ kind: "final", text: "January", at: 5 }, { kind: "final", text: " is the first month", at: 30 }]);
  const heard = await P.makeListener({ dictation: d }).listenForWord("January", { timeoutMs: 400, settleMs: 40, stopOnMatch: false });
  eq(heard, "January is the first month");
});

// --- the iPad's own speech recognition, wrapped to look like Claude's dictation ---
function fakeSpeechApi() {
  const made = [];
  class SR {
    constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; made.push(this); this.started = 0; this.stopped = 0; }
    start() { this.started++; }
    stop() { this.stopped++; if (this.onend) this.onend(); }
    abort() { this.stopped++; }
    say(text, isFinal) {
      this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal, length: 1 })] });
    }
  }
  return { SpeechRecognition: SR, made };
}

test("iPad speech: wrapped so the rest of the app cannot tell the difference", async () => {
  const api = fakeSpeechApi();
  const d = P.speechToDictation(api);
  ok(d, "an engine should be built when the browser has speech recognition");
  const finals = [];
  d.onFinal(({ text }) => finals.push(text));
  await d.start({ language: "en" });
  api.made[0].say("ship", true);
  eq(finals, [" ship"]);
  await d.stop();
  eq(api.made[0].stopped >= 1, true);
});
test("iPad speech: a half-heard guess arrives as a partial", async () => {
  const api = fakeSpeechApi();
  const d = P.speechToDictation(api);
  const partials = [];
  d.onPartial(({ text }) => partials.push(text));
  await d.start();
  api.made[0].say("shi", false);
  eq(partials, ["shi"]);
});
test("iPad speech: the listener uses it when there is no Claude dictation", async () => {
  const api = fakeSpeechApi();
  const l = P.makeListener({}, { speech: api });
  eq(l.available, true);
  const heard = l.listenForWord("ship", { timeoutMs: 400, settleMs: 40 });
  await new Promise((r) => setTimeout(r, 30));
  api.made[0].say("ship", true);
  eq(await heard, "ship");
});
test("iPad speech: a browser without it is simply not available", () => {
  eq(P.speechToDictation({}), null);
  eq(P.makeListener({}, { speech: {} }).available, false);
});
test("iPad speech: Claude dictation still wins when it is there", async () => {
  const api = fakeSpeechApi();
  const d = fakeDictation([{ kind: "final", text: " ship", at: 5 }]);
  const l = P.makeListener({ dictation: d }, { speech: api });
  eq(await l.listenForWord("ship", { timeoutMs: 300, settleMs: 20 }), "ship");
  eq(api.made.length, 0);
});
