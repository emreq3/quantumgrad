// Single entry point for LaTeX rendering. KaTeX is loaded on demand (a separate chunk) so that the title screen and every
// screen without mathematics pay nothing for it. Only KaTeX's own sanitised output ever reaches the DOM: `trust` is off, so
// \href, \url, \includegraphics and \html* are refused, and macro expansion is capped.
import type { KatexOptions } from "katex";

type Katex = typeof import("katex").default;

/** Quantum-notation shorthands. Plain LaTeX equivalents are used everywhere else so every formula also renders in any other TeX tool. */
export const MACROS: Record<string, string> = {
  "\\ket": "\\left|#1\\right\\rangle",
  "\\bra": "\\left\\langle#1\\right|",
  "\\braket": "\\left\\langle#1\\middle|#2\\right\\rangle",
  "\\ev": "\\left\\langle#1\\right\\rangle",
  "\\E": "\\mathbb{E}",
  "\\Tr": "\\operatorname{Tr}",
};

export const baseOptions = (displayMode: boolean, strict: KatexOptions["strict"] = "ignore"): KatexOptions => ({
  displayMode, throwOnError: true, trust: false, strict, maxExpand: 200, maxSize: 20, output: "htmlAndMathml", macros: { ...MACROS },
});

let loaded: { katex: Katex } | null = null;
let pending: Promise<{ katex: Katex }> | null = null;

export const katexReady = (): boolean => loaded !== null;
export function loadKatex(): Promise<{ katex: Katex }> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= Promise.all([import("katex"), import("./katex.css")])
    .then(([k]) => (loaded = { katex: k.default }))
    .catch((e) => { pending = null; throw e; });
  return pending;
}

/** `html` is KaTeX's own output: a visual layer (aria-hidden by the library) plus a MathML layer that assistive technology reads. */
export interface Rendered { html: string }
export interface RenderError { error: string }
const cache = new Map<string, Rendered | RenderError>();
/** Dev-visible record of every formula that failed to render (read by the browser audit; also logged in development builds). */
export const mathErrors: { tex: string; error: string }[] = [];
if (typeof window !== "undefined") (window as unknown as { __qta6MathErrors?: typeof mathErrors }).__qta6MathErrors = mathErrors;

/** Synchronous render; call only after `loadKatex()` resolved. A malformed formula yields `{error}` — it never throws. */
export function renderTex(tex: string, display: boolean): Rendered | RenderError | null {
  if (!loaded) return null;
  const key = (display ? "D" : "I") + tex;
  const hit = cache.get(key);
  if (hit) return hit;
  let out: Rendered | RenderError;
  try {
    out = { html: loaded.katex.renderToString(tex, baseOptions(display)) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    out = { error };
    if (cache.size < 2000) mathErrors.push({ tex, error });
    if (import.meta.env?.DEV) console.warn(`[math] cannot render ${JSON.stringify(tex)}: ${error}`);
  }
  if (cache.size < 2000) cache.set(key, out);
  return out;
}

/** Split a string into text / inline-math / display-math parts. `$…$` is inline, `$$…$$` is display, `\$` is a literal dollar sign. */
export type Part = { kind: "text" | "inline" | "display"; value: string };
export function splitMath(src: string): Part[] {
  const parts: Part[] = [];
  let text = "";
  const flush = () => { if (text) { parts.push({ kind: "text", value: text }); text = ""; } };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\" && src[i + 1] === "$") { text += "$"; i += 2; continue; }
    if (c === "$") {
      const display = src[i + 1] === "$";
      const open = display ? 2 : 1;
      let j = i + open, close = -1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "$" && (!display || src[j + 1] === "$")) { close = j; break; }
        j += 1;
      }
      if (close < 0) { text += src.slice(i); break; } // an unmatched `$` is plain text, never an exception
      flush();
      parts.push({ kind: display ? "display" : "inline", value: src.slice(i + open, close) });
      i = close + open;
      continue;
    }
    text += c; i += 1;
  }
  flush();
  return parts;
}
