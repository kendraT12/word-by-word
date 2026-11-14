// Word by Word: small DOM helpers. No app state and no Claude calls live here.

import { highlightParts } from "./engine.js";

export function el(tag, props = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    // Text only, never innerHTML: story text can come from Claude.
    else if (k === "text") node.textContent = v;
    else if (k === "onClick") node.addEventListener("click", v);
    else if (k === "onInput") node.addEventListener("input", v);
    else if (k === "onKeyDown") node.addEventListener("keydown", v);
    else if (k === "style") node.setAttribute("style", v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k in node && k !== "list" && k !== "form") node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const div = (cls, kids) => el("div", { class: cls }, kids);
export const p = (cls, text) => el("p", { class: cls, text });
export const h = (level, text) => el("h" + level, { text });

/** Every control on the page is a word, never an icon. */
export function btn(label, onClick, cls = "") {
  return el("button", { class: ("btn " + cls).trim(), type: "button", text: label, onClick });
}

/** The word she reads, with the lesson's new letters highlighted. */
export function wordEl(word, pats = [], cls = "word") {
  const node = el("span", { class: cls });
  for (const part of highlightParts(word, (pats || []).filter(Boolean))) {
    node.append(part.hi ? el("mark", { class: "hi", text: part.t }) : document.createTextNode(part.t));
  }
  return node;
}

/** A sentence whose every word can be tapped to hear it. */
export function tappableText(text, onWord) {
  const node = el("p", { class: "reading" });
  for (const piece of String(text).split(/(\s+)/)) {
    if (!piece.trim()) { node.append(document.createTextNode(piece)); continue; }
    const bare = piece.replace(/[^A-Za-z'-]/g, "");
    const span = el("span", { class: "tap", text: piece, role: "button", tabindex: "0", style: "cursor:pointer;border-bottom:2px dotted var(--line)" });
    const fire = () => onWord(bare, span);
    span.addEventListener("click", fire);
    span.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } });
    node.append(span);
  }
  return node;
}

export function mount(nodes) {
  const app = document.getElementById("app");
  app.replaceChildren(...[].concat(nodes).filter(Boolean));
  window.scrollTo(0, 0);
  return app;
}

export function card(kids) { return div("card", kids); }

export function field(labelText, input) {
  return el("label", {}, [labelText, input]);
}

export function bar(fraction) {
  const outer = div("bar");
  outer.append(el("span", { style: "width:" + Math.round(Math.max(0, Math.min(1, fraction)) * 100) + "%" }));
  return outer;
}

/** Shuffle, with an optional seed word so the same question keeps the same order. */
export function shuffle(list, seed = "") {
  const out = list.slice();
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => { n = (n * 1103515245 + 12345) >>> 0; return seed ? n / 4294967296 : Math.random(); };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
