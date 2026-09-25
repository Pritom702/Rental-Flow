// ============================================================
//  RentalFlow  |  Language  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: English / বাংলা switch
// ============================================================
// Every page is written in English. When a member picks বাংলা, this file
// swaps each piece of text on screen for its Bangla version from the
// dictionary in i18n/bn/, and swaps it back when they pick English again.
// The choice is remembered on the device.
//
// It works on what the page shows (text, placeholders, tooltips), so no page
// has to change to be translated — a new phrase only needs a dictionary line.
// Text people typed themselves (posts, chat, names) is never exact-matched
// against the dictionary unless the whole piece equals a UI phrase, and
// anything inside translate="no" is always left alone.

import { useEffect, useState } from 'react';
import BN, { patterns as BN_PATTERNS } from './i18n/bn/index.js';

const KEY = 'rentalflow_lang';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
// Never touch text inside these (a text box's placeholder still gets translated).
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);

let lang = 'en';
const dict = BN;                 // English phrase → Bangla
const patterns = BN_PATTERNS;    // [RegExp, (match) => Bangla] for text with numbers in it
let observer = null;
const listeners = new Set();

// What each text node / attribute showed in English, and what we put there.
const textMemo = new WeakMap();   // Text → { src, out }
const attrMemo = new WeakMap();   // Element → { [attr]: { src, out } }
const touched = new Set();        // WeakRefs to everything we changed, for switching back

try { lang = localStorage.getItem(KEY) === 'bn' ? 'bn' : 'en'; } catch { /* private mode */ }

export function getLang() { return lang; }

export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Look a phrase up. Keeps the spaces around it, so "Hello " stays "… ".
export function t(text) {
  if (lang !== 'bn' || typeof text !== 'string') return text;
  const core = text.replace(/\s+/g, ' ').trim();
  if (!core || !/[A-Za-z]/.test(core)) return text;
  let out = Object.hasOwn(dict, core) ? dict[core] : undefined;
  if (out === undefined) {
    for (const [re, fn] of patterns) {
      const m = core.match(re);
      if (m) { out = fn(m); break; }
    }
  }
  if (out === undefined) return text;
  const lead = text.match(/^\s*/)[0] ? ' ' : '';
  const trail = text.match(/\s*$/)[0] ? ' ' : '';
  return lead + out + trail;
}

// Keep a weak link to everything changed; drop the ones React threw away.
function remember(n) {
  if (touched.size > 20000) for (const ref of touched) if (!ref.deref()) touched.delete(ref);
  touched.add(new WeakRef(n));
}

function skipped(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
    if (SKIP.has(n.nodeName) || n.isContentEditable || n.getAttribute('translate') === 'no') return true;
  }
  return false;
}

function doText(node) {
  const value = node.nodeValue;
  const memo = textMemo.get(node);
  if (memo && value === memo.out) return;           // our own change coming back round
  const out = t(value);
  if (out === value) { if (memo) textMemo.delete(node); return; }
  if (node.parentNode && skipped(node.parentNode)) return;
  textMemo.set(node, { src: value, out });
  remember(node);
  node.nodeValue = out;
}

function doAttr(el, name) {
  const value = el.getAttribute(name);
  if (!value) return;
  const memos = attrMemo.get(el) || {};
  if (memos[name] && value === memos[name].out) return;
  const out = t(value);
  if (out === value || (el.parentNode && skipped(el.parentNode)) || el.getAttribute('translate') === 'no') return;
  memos[name] = { src: value, out };
  attrMemo.set(el, memos);
  remember(el);
  el.setAttribute(name, out);
}

function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
  for (const a of ATTRS) if (root.hasAttribute(a)) doAttr(root, a);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === 3) doText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) doAttr(n, a);
  }
}

function start() {
  if (observer) return;
  walk(document.body);
  document.title = t(document.title);
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doAttr(r.target, r.attributeName);
      else r.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// Put every English original back.
function stop() {
  observer?.disconnect();
  observer = null;
  for (const ref of touched) {
    const n = ref.deref();
    if (!n) continue;
    if (n.nodeType === 3) {
      const memo = textMemo.get(n);
      if (memo && n.nodeValue === memo.out) n.nodeValue = memo.src;
      textMemo.delete(n);
    } else {
      const memos = attrMemo.get(n) || {};
      for (const [name, memo] of Object.entries(memos)) if (n.getAttribute(name) === memo.out) n.setAttribute(name, memo.src);
      attrMemo.delete(n);
    }
  }
  touched.clear();
}

export function setLang(next) {
  lang = next === 'bn' ? 'bn' : 'en';
  try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  if (lang === 'bn') start();
  else stop();
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

// Pop-up questions (window.confirm etc.) are not part of the page, so they
// are translated on their way out.
function wrapDialogs() {
  for (const name of ['alert', 'confirm', 'prompt']) {
    const original = window[name].bind(window);
    // (a prompt's suggested answer is translated too, so it reads naturally)
    window[name] = (message, ...rest) => original(t(String(message ?? '')), ...rest.map((r) => (typeof r === 'string' ? t(r) : r)));
  }
}

// Runs before React draws anything, so a Bangla reader never sees English flash first.
export function installLanguage() {
  wrapDialogs();
  document.documentElement.lang = lang;
  if (lang === 'bn') start();
}

// For components that build text in code (e.g. word-by-word animations):
// re-renders them when the language changes.
export function useLang() {
  const [value, set] = useState(lang);
  useEffect(() => onLangChange(set), []);
  return value;
}
