import { useEffect, useState, type ReactNode } from "react";
import { katexReady, loadKatex, renderTex, splitMath } from "./katex";

export { loadKatex, splitMath } from "./katex";

/** Warm the KaTeX chunk in the background (called when a screen that usually shows formulas mounts). */
export function preloadMath(): void { void loadKatex().catch(() => undefined); }

function useReady(): boolean {
  const [ready, setReady] = useState(katexReady());
  useEffect(() => {
    if (ready) return;
    let live = true;
    loadKatex().then(() => { if (live) setReady(true); }).catch(() => undefined);
    return () => { live = false; };
  }, [ready]);
  return ready;
}

/** Readable fallback for a formula that cannot be rendered (or while the renderer is unavailable): the source is shown as text. */
function Fallback({ tex, display, failed }: { tex: string; display: boolean; failed: boolean }) {
  return <code className={`math-fallback ${display ? "display" : ""}`} data-math-error={failed ? "1" : undefined} title={failed ? "This formula could not be rendered; its source is shown instead." : undefined}>{tex}</code>;
}

function Formula({ tex, display }: { tex: string; display: boolean }) {
  const ready = useReady();
  const r = ready ? renderTex(tex, display) : null;
  if (!r) return <span className="math-pending" aria-hidden="true" style={{ minWidth: `${Math.min(tex.length, 24) * 0.55}em` }} />;
  if ("error" in r) return <Fallback tex={tex} display={display} failed />;
  // KaTeX output = aria-hidden visual layer + a real <math> (MathML) element for assistive technology; no extra ARIA is layered on top
  return <span className={display ? "math-display-inner" : "math-inline"} dangerouslySetInnerHTML={{ __html: r.html }} />;
}

export function InlineMath({ tex }: { tex: string }) { return <Formula tex={tex} display={false} />; }

/** A centred block formula. Long formulas scroll horizontally inside the block instead of overflowing the page. */
export function DisplayMath({ tex }: { tex: string }) {
  return <div className="math-display" tabIndex={0} role="group" aria-label="Equation (scrollable)"><Formula tex={tex} display /></div>;
}

/** Text with `$inline$` and `$$display$$` mathematics. All non-math text is rendered as text (React-escaped); there is no HTML pass-through. */
export function ScientificText({ text, as: Tag = "span" }: { text?: string | null; as?: "span" | "p" | "div" }) {
  if (!text) return null;
  const parts = splitMath(text);
  if (parts.length === 1 && parts[0].kind === "text") return <Tag>{parts[0].value}</Tag>;
  const nodes: ReactNode[] = parts.map((p, i) => (p.kind === "text" ? <span key={i}>{p.value}</span> : p.kind === "inline" ? <InlineMath key={i} tex={p.value} /> : <DisplayMath key={i} tex={p.value} />));
  // block formulas are not valid inside <p>/<span> phrasing content, so use a div when any display math is present
  const T = parts.some((p) => p.kind === "display") && Tag !== "div" ? "div" : Tag;
  return <T className="sci-text">{nodes}</T>;
}

/** A titled formula with a caption and a stable id for cross-references. */
export function EquationBlock({ tex, title, caption }: { tex: string; title?: string; caption?: ReactNode }) {
  return (
    <figure className="equation-block">
      {title && <figcaption className="eq-title">{title}</figcaption>}
      <DisplayMath tex={tex} />
      {caption && <p className="small muted">{caption}</p>}
    </figure>
  );
}
