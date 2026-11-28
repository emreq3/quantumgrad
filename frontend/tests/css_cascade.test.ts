// Regression guard for a bug the cross-browser audits found: a responsive override written BEFORE the base rule of the same selector
// is silently ignored (equal specificity, later rule wins). It left the mission HUD sticky on phones, covering the circuit and lattice targets.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rule = { selector: string; props: Set<string>; important: Set<string>; pos: number; media: string | null };

function parse(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length)); // keep offsets stable
  const rules: Rule[] = [];
  let i = 0;
  const readBlock = (from: number): number => { let depth = 0, j = from; do { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; } while (depth > 0 && j < src.length); return j; };
  const parseRules = (text: string, offset: number, media: string | null) => {
    const re = /([^{}]+)\{([^{}]*)\}/g; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const selector = m[1].trim();
      if (selector.startsWith("@")) continue;
      const decls = m[2].split(";").map((d) => d.trim()).filter(Boolean);
      const props = new Set(decls.map((d) => d.split(":")[0].trim()));
      const important = new Set(decls.filter((d) => /!important\s*$/.test(d)).map((d) => d.split(":")[0].trim())); // !important wins regardless of order
      rules.push({ selector, props, important, pos: offset + m.index, media });
    }
  };
  while (i < src.length) {
    const at = src.indexOf("@media", i);
    const next = at === -1 ? src.length : at;
    parseRules(src.slice(i, next), i, null);
    if (at === -1) break;
    const open = src.indexOf("{", at); const end = readBlock(open);
    parseRules(src.slice(open + 1, end - 1), open + 1, src.slice(at + 6, open).trim());
    i = end;
  }
  return rules;
}

describe("stylesheet cascade", () => {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const rules = parse(css);

  it("parses a plausible number of rules", () => { expect(rules.length).toBeGreaterThan(200); });

  it("no responsive override is placed before the base rule it is meant to override", () => {
    const lost: string[] = [];
    for (const r of rules.filter((x) => x.media && /max-(width|height)/.test(x.media))) {
      for (const sel of r.selector.split(",").map((s) => s.trim())) {
        for (const base of rules.filter((b) => !b.media && b.selector.split(",").map((s) => s.trim()).includes(sel) && b.pos > r.pos)) {
          for (const p of r.props) if (base.props.has(p) && !r.important.has(p)) lost.push(`${sel} { ${p} } inside "@media ${r.media}" is overridden by the later base rule`);
        }
      }
    }
    expect(lost).toEqual([]);
  });

  it("the mission HUD only sticks when there is room", () => {
    const hudOverrides = rules.filter((r) => r.selector === ".hud" && r.media && r.props.has("position"));
    expect(hudOverrides.some((r) => /max-width:\s*700px/.test(r.media!) && /max-height:\s*560px/.test(r.media!))).toBe(true);
  });
});
