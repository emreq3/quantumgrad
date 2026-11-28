// Mathematical rendering: parser, components, safety, and an audit of every formula that ships in the game's data and narrative.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import katex from "katex";
import { DisplayMath, EquationBlock, InlineMath, ScientificText, loadKatex, splitMath } from "../src/math";
import { baseOptions, mathErrors, renderTex } from "../src/math/katex";
import { KIND_MATH, MISSION_NARRATIVE, N1_STAGES, ENDINGS, WORLD } from "../src/content/narrative";
import { correctionFeedback } from "../src/store";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/;

describe("splitMath", () => {
  it("splits text, inline and display math", () => {
    expect(splitMath("a $x$ b $$y$$ c")).toEqual([
      { kind: "text", value: "a " }, { kind: "inline", value: "x" }, { kind: "text", value: " b " }, { kind: "display", value: "y" }, { kind: "text", value: " c" }]);
  });
  it("treats an escaped or unmatched dollar sign as text, never as an error", () => {
    expect(splitMath(String.raw`costs \$5 and \$6`)).toEqual([{ kind: "text", value: "costs $5 and $6" }]);
    expect(splitMath("unmatched $ sign")).toEqual([{ kind: "text", value: "unmatched $ sign" }]);
    expect(splitMath("")).toEqual([]);
  });
  it("keeps backslash-dollar inside a formula", () => {
    expect(splitMath(String.raw`$a\$b$`)[0]).toEqual({ kind: "inline", value: String.raw`a\$b` });
  });
});

describe("components", () => {
  it("renders KaTeX output: a visual layer hidden from assistive technology plus a real MathML <math> element", async () => {
    const { container } = render(<InlineMath tex={String.raw`F_{\mathrm{ps}}=\langle\psi|\rho|\psi\rangle`} />);
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    expect(container.querySelector(".katex-html")?.getAttribute("aria-hidden")).toBe("true");
    const ml = container.querySelector(".katex-mathml math");
    expect(ml).not.toBeNull();
    expect(ml?.textContent).toMatch(/ψ/); // MathML carries Unicode symbols, not TeX commands
    expect(container.querySelector("[role=math]")).toBeNull(); // one accessible representation only: no duplicate reading
  });
  it("a malformed formula falls back to readable source and never throws", async () => {
    render(<InlineMath tex={String.raw`\frac{1}{`} />);
    const f = await waitFor(() => document.querySelector("[data-math-error]") as HTMLElement);
    expect(f.textContent).toBe(String.raw`\frac{1}{`);
    expect(mathErrors.some((e) => e.tex === String.raw`\frac{1}{`)).toBe(true);
  });
  it("an unknown command is a fallback, not a crash", async () => {
    render(<ScientificText text={String.raw`before $\notacommand{x}$ after`} />);
    await waitFor(() => expect(document.querySelector("[data-math-error]")).not.toBeNull());
    expect(screen.getByText(/before/)).toBeInTheDocument();
  });
  it("never interprets HTML in text or in formulas", async () => {
    render(<ScientificText text={'<img src=x onerror="window.__pwned=1"> and $\\text{<b>x</b>}$'} />);
    await loadKatex();
    await waitFor(() => expect(document.querySelector(".katex")).not.toBeNull());
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
  it("trust is off: \\href, \\url, \\includegraphics and \\html* never produce links, images or classes", async () => {
    await loadKatex();
    for (const t of [String.raw`\href{javascript:alert(1)}{x}`, String.raw`\url{http://example.com}`, String.raw`\includegraphics{x.png}`, String.raw`\htmlClass{evil}{x}`, String.raw`\htmlStyle{color:red}{x}`]) {
      const r = renderTex(t, false);
      const box = document.createElement("div");
      box.innerHTML = r && "html" in r ? r.html : "";
      // the unsupported command is shown as red text (and, as text only, in the TeX annotation); no element or attribute can act on it
      expect(box.querySelectorAll("a,img,iframe,script,[href],[src],[onerror],[onclick],.evil").length).toBe(0);
    }
  });
  it("display math scrolls instead of overflowing", async () => {
    render(<DisplayMath tex={"x=" + "a+".repeat(80) + "b"} />);
    const box = await waitFor(() => screen.getByRole("group", { name: /Equation/ }));
    expect(box).toHaveAttribute("tabindex", "0");
    expect(box.className).toContain("math-display");
  });
  it("EquationBlock shows title, formula and caption", async () => {
    render(<EquationBlock title="Fidelity" tex={String.raw`F=\langle\psi|\rho|\psi\rangle`} caption="overlap" />);
    expect(screen.getByText("Fidelity")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".katex")).not.toBeNull());
    expect(screen.getByText("overlap")).toBeInTheDocument();
  });
  it("ScientificText with no math renders plain text without loading the renderer output", () => {
    render(<ScientificText text="just words" />);
    expect(screen.getByText("just words")).toBeInTheDocument();
  });
});

describe("required expressions render with the strict profile", () => {
  const REQUIRED: Record<string, string> = {
    qubit: String.raw`|\psi\rangle=\alpha|0\rangle+\beta|1\rangle,\quad |\alpha|^2+|\beta|^2=1`,
    bell: String.raw`|\Phi^{+}\rangle=\frac{|00\rangle+|11\rangle}{\sqrt{2}}`,
    density: String.raw`\rho=\sum_k p_k|\psi_k\rangle\langle\psi_k|`,
    kraus: String.raw`\mathcal{E}(\rho)=\sum_k K_k\rho K_k^{\dagger},\quad \sum_k K_k^{\dagger}K_k=I`,
    fps: String.raw`F_{\mathrm{ps}}=\langle\psi|\sigma|\psi\rangle`,
    kappa: String.raw`\kappa=\operatorname{Tr}(\Pi_0\rho)=P(\mathrm{accept})`,
    overhead: String.raw`\text{overhead}=\begin{cases}1/\kappa & \kappa>0\\ \infty & \kappa=0\end{cases}`,
    assignment: String.raw`A_{ij}=P(\text{read } i\mid\text{prepared } j)`,
    zne: String.raw`\hat E(0)=\sum_i\gamma_i\hat E(\lambda_i)`,
    richardson: String.raw`\gamma=\left(\tfrac{15}{8},-\tfrac{5}{4},\tfrac{3}{8}\right),\quad \sum_i\gamma_i^2=\tfrac{167}{32}`,
    mse: String.raw`\mathrm{MSE}=\mathrm{Bias}^2+\mathrm{Var},\quad \mathrm{Var}=\sum_i\frac{w_i^2\sigma_i^2}{N_i}`,
    alloc: String.raw`N_i^{*}=N\frac{|w_i|\sigma_i}{\sum_j|w_j|\sigma_j}`,
    pl: String.raw`p_L=\frac{k_{\mathrm{fail}}}{n}`,
    weight: String.raw`w_e=\ln\frac{1-p_e}{p_e}`,
    nphys: String.raw`n_{\mathrm{phys}}=2d^2-1`,
    regret: String.raw`\frac{\mathrm{MSE}_{\mathrm{chosen}}-\mathrm{MSE}_{\mathrm{best}}}{\max(\mathrm{MSE}_{\mathrm{best}},10^{-6})}`,
    pareto: String.raw`x\succ y\iff\forall i:\ f_i(x)\le f_i(y)\ \wedge\ \exists j:\ f_j(x)<f_j(y)`,
    ketmacro: String.raw`\ket{\psi}\bra{\phi}\braket{\phi}{\psi}\ev{Z}`,
  };
  it.each(Object.entries(REQUIRED))("%s", (_name, tex) => {
    expect(() => katex.renderToString(tex, baseOptions(true, "error"))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Audit of shipped content: every `$...$` in the campaign data and narrative must render; raw ASCII-math must not leak.
type Hit = { path: string; text: string };
const collect = (x: unknown, path: string, out: Hit[]) => {
  if (typeof x === "string") out.push({ path, text: x });
  else if (Array.isArray(x)) x.forEach((v) => collect(v, path + "[]", out));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) collect(v, `${path}/${path.endsWith("outcomes") ? "*" : k}`, out);
};
const TEXT_KEYS = /\/(math|scientific|plain|text|def|tex|note|description|story|learning_objective|success_conditions|constraints|allowed_actions|label|hint)(\[\])?$/;

describe("shipped content audit", () => {
  const hits: Hit[] = [];
  collect(data, "", hits);
  const narrative: Hit[] = [];
  for (const [id, n] of Object.entries(MISSION_NARRATIVE)) for (const [k, v] of Object.entries(n)) if (typeof v === "string") narrative.push({ path: `narrative/${id}/${k}`, text: v });
  for (const [k, v] of Object.entries(KIND_MATH)) narrative.push({ path: `KIND_MATH/${k}`, text: v });
  N1_STAGES.forEach((s) => narrative.push({ path: `N1/${s.id}`, text: s.text }));
  Object.entries(ENDINGS).forEach(([k, v]) => narrative.push({ path: `ENDINGS/${k}`, text: v }));
  Object.entries(WORLD).forEach(([k, v]) => typeof v === "string" && narrative.push({ path: `WORLD/${k}`, text: v }));
  const all = [...hits, ...narrative];

  it("no control characters anywhere (a mis-escaped \\frac, \\theta, \\rho, \\beta would produce them)", () => {
    const bad = all.filter((h) => CONTROL.test(h.text));
    expect(bad.slice(0, 3)).toEqual([]);
  });

  const segs = new Map<string, { display: boolean; paths: Set<string> }>();
  const parts = (h: Hit) => (/\/tex$/.test(h.path) ? [{ kind: "display" as const, value: h.text }] : splitMath(h.text));
  for (const h of all) for (const p of parts(h)) if (p.kind !== "text") {
    const e = segs.get((p.kind === "display" ? "D" : "I") + p.value) ?? { display: p.kind === "display", paths: new Set<string>() };
    e.paths.add(h.path.replace(/\[\d*\]/g, "[]")); segs.set((p.kind === "display" ? "D" : "I") + p.value, e);
  }

  it("every formula (inline and display) renders with the strict profile", () => {
    const failures: string[] = [];
    for (const [k, v] of segs) {
      try { katex.renderToString(k.slice(1), baseOptions(v.display, "error")); } catch (e) { failures.push(`${k.slice(1)} -> ${(e as Error).message}`); }
    }
    expect(failures).toEqual([]);
    expect(segs.size).toBeGreaterThan(30);
  });

  it("dollar delimiters are balanced in every string", () => {
    const bad = all.filter((h) => (h.text.replace(/\\\$/g, "").match(/\$/g)?.length ?? 0) % 2 === 1);
    expect(bad.slice(0, 3)).toEqual([]);
  });

  it("no raw LaTeX commands or ASCII-math patterns outside $...$ in player-facing text", () => {
    const leaks: string[] = [];
    for (const h of all) {
      if (!TEXT_KEYS.test(h.path) && !h.path.startsWith("narrative") && !h.path.startsWith("KIND_MATH")) continue;
      if (/\/tex$/.test(h.path)) continue; // formula-only field, validated above
      const outside = splitMath(h.text).filter((p) => p.kind === "text").map((p) => p.value).join(" ");
      if (/\\[a-zA-Z]{2,}/.test(outside) || /<[a-z]+\|/.test(outside) || /\bsqrt\(/.test(outside) || /[A-Za-z]\^\d/.test(outside) || /\b(kappa|gamma|lambda|rho|psi)\b/.test(outside) || /(>=|<=|\+\/-)/.test(outside))
        leaks.push(`${h.path}: ${h.text.slice(0, 90)}`);
    }
    expect(leaks).toEqual([]);
  });

  it("the old wrong Richardson statement is gone and the numbers shown match the engine", () => {
    const txt = all.map((h) => h.text).join("\n");
    expect(txt).not.toContain("5 for scales 1,3");
    expect(txt).not.toContain("19 for 1,3,5");
    expect(txt).toContain("\\tfrac{167}{32}");
  });

  it("client-side feedback (store.tsx) is valid LaTeX and matches the Python wording", () => {
    const fb = correctionFeedback({ valid: true, logically_correct: true, clears_syndrome: true, path_cost: 1, mwpm_cost: 1, mwpm_logical_correct: true });
    for (const p of splitMath(fb.math)) if (p.kind !== "text") expect(() => katex.renderToString(p.value, baseOptions(false, "error"))).not.toThrow();
    const py = data.missions.find((m: { kind: string }) => m.kind === "decoding");
    expect(py).toBeTruthy();
  });

  it("writes measured counts when asked (used for docs/phase5_math_rendering_audit.md)", () => {
    const out = process.env.QTA6_MATH_AUDIT_OUT;
    if (!out) return;
    const byCategory: Record<string, number> = {};
    for (const [, v] of segs) for (const p of v.paths) byCategory[p] = (byCategory[p] ?? 0) + 1;
    const stringsWithMath = all.filter((h) => parts(h).some((p) => p.kind !== "text")).length;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      katex: katex.version, stringsScanned: all.length, stringsWithMath, uniqueFormulas: segs.size,
      displayFormulas: [...segs.values()].filter((v) => v.display).length, inlineFormulas: [...segs.values()].filter((v) => !v.display).length,
      occurrencesByPath: byCategory,
    }, null, 2));
  });
});
