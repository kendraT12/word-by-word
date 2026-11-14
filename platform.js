// Word by Word: the only file that talks to Claude capabilities or the browser.
// Everything here has a fallback, so the app still works with none of them.
// Replace this file to move the app off Claude.

import { matchSpoken, offListWords, tokens } from "./engine.js";

// The test engine has setTimeout but no clearTimeout; every timer also checks a done flag.
const clearTimer = (t) => { if (t !== null && typeof globalThis.clearTimeout === "function") globalThis.clearTimeout(t); };

const RATE_NORMAL = 0.85;
const RATE_SLOW = 0.7;
const STORE_KEY = "wbw:v1";

/** Which capabilities this view has. Each one is a namespace or null. */
export async function detect(root = globalThis) {
  const names = ["tts", "dictation", "sample", "db", "user"];
  const use = root && root.claude && typeof root.claude.use === "function" ? root.claude.use.bind(root.claude) : null;
  if (!use) return Object.fromEntries(names.map((n) => [n, null]));
  const got = await Promise.all(names.map((n) => Promise.resolve().then(() => use(n)).catch(() => null)));
  return Object.fromEntries(names.map((n, i) => [n, got[i]]));
}

// ---------- Speaking ----------

/** Reads text to her: a Claude voice when there is one, else the device's own. */
export function makeVoice(caps, root = globalThis) {
  const tts = caps.tts || null;
  const synth = !tts && root && root.speechSynthesis ? root.speechSynthesis : null;
  const v = { kind: tts ? "claude" : synth ? "browser" : "none" };

  function pickVoice() {
    const all = synth.getVoices ? synth.getVoices() : [];
    return all.find((x) => x.lang === "en-US" && x.localService) || all.find((x) => x.lang === "en-US")
      || all.find((x) => (x.lang || "").startsWith("en")) || null;
  }

  v.say = async (text, { slow = false } = {}) => {
    const str = String(text || "").trim();
    if (!str || v.kind === "none") return;
    const rate = slow ? RATE_SLOW : RATE_NORMAL;
    if (v.kind === "claude") {
      try { await tts.speak(str.slice(0, 2000), { rate, language: "en" }); }
      catch (e) {
        // The viewer turned speech off: stay quiet rather than using another voice.
        if (e && (e.code === "not_granted" || e.code === "unavailable")) v.kind = "none";
      }
      return;
    }
    await new Promise((resolve) => {
      try {
        synth.cancel();
        const u = new root.SpeechSynthesisUtterance(str);
        u.rate = rate; u.lang = "en-US";
        const voice = pickVoice(); if (voice) u.voice = voice;
        u.onend = () => resolve(); u.onerror = () => resolve();
        synth.speak(u);
        setTimeout(resolve, Math.min(20000, 1200 + str.length * 90));
      } catch { resolve(); }
    });
  };

  v.stop = () => {
    try { if (v.kind === "claude") Promise.resolve(tts.stop()).catch(() => {}); else if (synth) synth.cancel(); }
    catch { /* nothing to stop */ }
  };
  return v;
}

// ---------- Listening ----------

/** Wraps the browser's own speech recognition (Safari on an iPad, Chrome on a computer)
 *  in the same shape as Claude's dictation, so nothing else in the app has to care which it is.
 *  Returns null where the browser has none. */
export function speechToDictation(api = globalThis) {
  const SR = api && (api.SpeechRecognition || api.webkitSpeechRecognition);
  if (!SR) return null;

  const subs = { final: new Set(), partial: new Set(), state: new Set() };
  let rec = null, state = "idle";
  const emit = (kind, payload) => { for (const fn of [...subs[kind]]) { try { fn(payload); } catch { /* the page moved on */ } } };
  const setState = (next, reason) => {
    if (state === next) return;
    state = next;
    emit("state", reason ? { state: next, reason } : { state: next });
  };
  const on = (kind) => (fn) => { subs[kind].add(fn); return () => subs[kind].delete(fn); };

  const ERRORS = {
    "not-allowed": "not_granted", "service-not-allowed": "not_granted",
    "audio-capture": "unavailable", "language-not-supported": "unavailable",
    "no-speech": "stopped", aborted: "stopped", network: "upstream_error",
  };

  return {
    active: () => state !== "idle",
    onFinal: on("final"),
    onPartial: on("partial"),
    onState: on("state"),
    async start(options = {}) {
      if (state !== "idle") return;
      setState("starting");
      rec = new SR();
      rec.lang = options.language === "en" || !options.language ? "en-US" : options.language;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        for (let i = event.resultIndex || 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0] && result[0].transcript ? result[0].transcript : "";
          if (!text) continue;
          // A final piece arrives ready to append, exactly as Claude's dictation sends it.
          if (result.isFinal) emit("final", { text: " " + text.trim() });
          else emit("partial", { text });
        }
      };
      rec.onerror = (event) => {
        const code = ERRORS[(event && event.error) || ""] || "upstream_error";
        setState("idle", code);
      };
      rec.onend = () => setState("idle", "stopped");
      try { rec.start(); } catch { setState("idle", "upstream_error"); return; }
      setState("listening");
    },
    async stop() {
      if (!rec) { setState("idle", "stopped"); return; }
      const r = rec;
      rec = null;
      try { r.stop(); } catch { /* already stopped */ }
      setState("idle", "stopped");
    },
  };
}

/** Hears her read a word. Resolves with what it heard, or null if it could not tell.
 *  Uses Claude's dictation where it exists, otherwise the browser's own. */
export function makeListener(caps, { speech } = {}) {
  const d = caps.dictation || speechToDictation(speech || globalThis) || null;
  const homophones = caps.homophones || {};
  const l = { available: !!d };

  l.listenForWord = (target, { timeoutMs = 6000, settleMs = 1200, stopOnMatch = true } = {}) => {
    if (!l.available) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false, finalText = "", partialText = "";
      let settleTimer = null, hardTimer = null, settleId = 0;
      const offs = [];
      const heard = () => (finalText + " " + partialText).replace(/\s+/g, " ").trim();

      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimer(settleTimer); clearTimer(hardTimer);
        for (const off of offs) { try { off(); } catch { /* already gone */ } }
        try { Promise.resolve(d.stop()).catch(() => {}); } catch { /* already stopped */ }
        resolve(value);
      };
      const check = () => {
        if (!stopOnMatch) return false;
        const text = heard();
        if (text && matchSpoken(text, target, homophones)) { finish(text); return true; }
        return false;
      };
      const bump = () => {
        clearTimer(settleTimer);
        const mine = ++settleId;
        settleTimer = setTimeout(() => { if (mine === settleId) finish(heard() || null); }, settleMs);
      };

      offs.push(d.onFinal(({ text }) => {
        finalText = (finalText + " " + text).replace(/\s+/g, " ").trim();
        partialText = "";
        if (!check()) bump();
      }));
      offs.push(d.onPartial(({ text }) => { partialText = text || ""; if (!check()) bump(); }));
      offs.push(d.onState(({ state, reason }) => {
        if (state !== "idle") return;
        if (reason === "not_granted" || reason === "unavailable") l.available = false;
        finish(heard() || null);
      }));

      hardTimer = setTimeout(() => finish(heard() || null), timeoutMs);

      // start() must come straight from her tap, with nothing awaited before it.
      Promise.resolve().then(() => d.start({ language: "en" })).catch((e) => {
        if (e && (e.code === "not_granted" || e.code === "unavailable")) l.available = false;
        finish(null);
      });
    });
  };
  /** Follows her through a whole story: hands back everything heard so far. */
  l.listenAlong = (onText, { timeoutMs = 180000 } = {}) => {
    if (!l.available) return { stop: () => Promise.resolve(null) };
    let finalText = "", partialText = "", stopped = false, hardTimer = null;
    const offs = [];
    const heard = () => (finalText + " " + partialText).replace(/\s+/g, " ").trim();
    const push = () => { try { onText(heard()); } catch { /* the page moved on */ } };

    const end = () => {
      if (stopped) return Promise.resolve(heard());
      stopped = true;
      clearTimer(hardTimer);
      for (const off of offs) { try { off(); } catch { /* already gone */ } }
      const text = heard();
      return Promise.resolve(d.stop()).catch(() => {}).then(() => text);
    };

    offs.push(d.onFinal(({ text }) => {
      finalText = (finalText + " " + text).replace(/\s+/g, " ").trim();
      partialText = ""; push();
    }));
    offs.push(d.onPartial(({ text }) => { partialText = text || ""; push(); }));
    offs.push(d.onState(({ state, reason }) => {
      if (state !== "idle") return;
      if (reason === "not_granted" || reason === "unavailable") l.available = false;
      end();
    }));
    hardTimer = setTimeout(end, timeoutMs);
    Promise.resolve().then(() => d.start({ language: "en" })).catch((e) => {
      if (e && (e.code === "not_granted" || e.code === "unavailable")) l.available = false;
      end();
    });
    return { stop: end };
  };

  return l;
}

// ---------- Saving her progress ----------

const emptyLocal = () => ({ profile: null, words: {}, days: {} });

/** Keeps her progress on the device always, and in her Claude account when it can. */
export function makeStore(caps, uid, storage = (globalThis.localStorage || null)) {
  const db = caps.db || null;
  const online = !!(db && uid);
  const s = { mode: online ? "online" : "device" };
  const base = uid ? "data/users/" + uid : null;
  const queues = {};

  const readLocal = () => {
    try { return { ...emptyLocal(), ...JSON.parse(storage.getItem(STORE_KEY) || "{}") }; }
    catch { return emptyLocal(); }
  };
  const writeLocal = (patch) => {
    const next = { ...readLocal(), ...patch };
    try { storage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* private browsing */ }
    return next;
  };
  const stamp = (data) => ({ ...data, updatedAt: data && data.updatedAt ? data.updatedAt : Date.now() });

  function dbSet(name, data) {
    if (!online || s.mode === "device") return Promise.resolve();
    const path = base + "/" + name;
    const run = () => Promise.resolve(db.doc(path).set(data)).catch(() => { s.mode = "device"; });
    queues[path] = (queues[path] || Promise.resolve()).then(run, run);
    return queues[path];
  }

  s.saveProfile = async (profile) => { const p = stamp(profile); writeLocal({ profile: p }); await dbSet("profile", p); };
  s.saveWords = async (words) => { const w = stamp(words); writeLocal({ words: w }); await dbSet("words", w); };
  s.saveDay = async (dayKey, log) => {
    const entry = stamp(log);
    writeLocal({ days: { ...readLocal().days, [dayKey]: entry } });
    await dbSet("day-" + dayKey, entry);
  };

  s.load = async () => {
    const local = readLocal();
    const out = { profile: local.profile, words: { ...local.words }, days: { ...local.days } };
    if (online) {
      try {
        const [profileSnap, wordsSnap, all] = await Promise.all([
          db.doc(base + "/profile").get(), db.doc(base + "/words").get(), db.collection(base).get(),
        ]);
        const remoteProfile = profileSnap && profileSnap.data ? profileSnap.data() : null;
        if (remoteProfile && (remoteProfile.updatedAt || 0) >= ((local.profile && local.profile.updatedAt) || 0)) {
          out.profile = remoteProfile;
        }
        const remoteWords = wordsSnap && wordsSnap.data ? wordsSnap.data() : null;
        if (remoteWords && (remoteWords.updatedAt || 0) >= (local.words.updatedAt || 0)) out.words = { ...remoteWords };
        for (const doc of (all && all.docs) || []) {
          if (!String(doc.id).startsWith("day-")) continue;
          const key = String(doc.id).slice(4);
          const entry = doc.data();
          const mine = out.days[key];
          if (!mine || (entry.updatedAt || 0) >= (mine.updatedAt || 0)) out.days[key] = entry;
        }
      } catch { s.mode = "device"; }
    }
    delete out.words.updatedAt;
    return out;
  };
  return s;
}

// ---------- Claude-written stories ----------

const NO_PICTURES = "Use plain words only: no emoji, no pictures, no symbols, no formatting marks.";

function sentenceCount(text) {
  return String(text).split(/[.!?]+/).filter((x) => x.trim()).length;
}

function validStory(r) {
  if (!r || typeof r.text !== "string" || typeof r.title !== "string" || !r.text.trim() || !r.title.trim()) return false;
  if (!Array.isArray(r.q) || r.q.length < 1 || r.q.length > 2) return false;
  return r.q.every((q) => q && typeof q.ask === "string" && typeof q.answer === "string"
    && Array.isArray(q.choices) && q.choices.length === 3 && q.choices.includes(q.answer));
}

/** Asks Claude for reading material at her exact level. null means "use a built-in one". */
export function makeAI(caps) {
  const sample = caps.sample && typeof caps.sample.json === "function" ? caps.sample : null;
  const ai = { available: !!sample };

  const ask = (prompt) => sample.json(prompt, { modelTier: "quick" });

  ai.story = async ({ name, favorites = [], allowed = [], stepWords = [], sentences = 5 }) => {
    if (!sample) return null;
    const allow = new Set(allowed.map((w) => String(w).toLowerCase()));
    const prompt = [
      "You write tiny practice stories for a 7-year-old learning to read.",
      'Her name is ' + name + (favorites.length ? ". She loves: " + favorites.join(", ") + "." : "."),
      "Write a story of exactly " + sentences + " short sentences.",
      "Use ONLY words from this list (any form of her name is fine): " + [...allow].join(" "),
      "Try to use these words she is practicing: " + stepWords.join(", ") + ".",
      "Keep every sentence under 8 words.",
      NO_PICTURES,
      'Reply with only JSON: {"title": "...", "text": "...", "q": [{"ask": "...", "answer": "...", "choices": ["...","...","..."]}]}',
      "The answer must be one of the three choices. Ask 1 or 2 questions about the story.",
    ].join("\n");
    for (let attempt = 0; attempt < 2; attempt++) {
      let r;
      try { r = await ask(prompt); } catch { return null; }
      if (!validStory(r)) continue;
      if (offListWords(r.text, allow).length <= 2) {
        return { title: r.title.trim(), text: r.text.trim(), q: r.q };
      }
    }
    return null;
  };

  ai.mini = async ({ word, mean, name, favorites = [], allowed = [] }) => {
    if (!sample) return null;
    const allow = new Set(allowed.map((w) => String(w).toLowerCase()));
    tokens(word).forEach((t) => allow.add(t));
    const prompt = [
      "You write two tiny sentences that teach one word to a 7-year-old.",
      'The word is "' + word + '". It means: ' + mean + ".",
      "Sentence 1 says what the word means. Sentence 2 uses the word with her name, " + name + ".",
      favorites.length ? "She loves: " + favorites.join(", ") + "." : "",
      "Use ONLY words from this list, plus the word itself: " + [...allow].join(" "),
      "Keep both sentences under 8 words. " + NO_PICTURES,
      'Reply with only JSON: {"text": "First sentence. Second sentence."}',
    ].filter(Boolean).join("\n");
    for (let attempt = 0; attempt < 2; attempt++) {
      let r;
      try { r = await ask(prompt); } catch { return null; }
      if (!r || typeof r.text !== "string" || !r.text.trim()) continue;
      const text = r.text.trim();
      if (sentenceCount(text) === 2 && offListWords(text, allow).length === 0) return text;
    }
    return null;
  };

  ai.checkExplain = async ({ word, mean, said }) => {
    if (!sample) return null;
    if (!String(said || "").trim()) return false;
    try {
      const r = await ask([
        "A 7-year-old was asked what a word means. Decide kindly whether she understands it.",
        'Word: "' + word + '". A correct meaning is: ' + mean,
        'She said: "' + said + '"',
        "Accept any answer that shows she knows what it is, even in her own rough words or with speech-to-text mistakes.",
        'Reply with only JSON: {"understands": true} or {"understands": false}',
      ].join("\n"));
      return !!(r && r.understands);
    } catch { return null; }
  };
  return ai;
}

// ---------- Parent code ----------

/** A 4-digit code is a lock against a 7-year-old, not a secret: a plain digest is enough. */
export async function hashCode(code, root = globalThis) {
  const text = "wbw:" + String(code);
  if (root.crypto && root.crypto.subtle && root.TextEncoder) {
    const buf = await root.crypto.subtle.digest("SHA-256", new root.TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return "x" + h.toString(16);
}
