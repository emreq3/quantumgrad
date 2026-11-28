import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { creditCost, outcomeUnits } from "../src/engine";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));
const save = (completed: string[] | "all" = "all") => ({
  schema: "qta6.save/2", failures: {}, difficulty: "beginner", tutorial_done: true,
  completed: Object.fromEntries((completed === "all" ? data.missions.map((m: any) => m.id) : completed).map((id: string) => [id, { best_score: 50, attempts: 1 }])),
});
const mission = (id: string) => data.missions.find((m: any) => m.id === id);
const cheapestWin = (id: string) => {
  const m = mission(id);
  return Object.keys(m.outcomes).filter((k) => m.outcomes[k].success && m.outcomes[k].feasible !== false)
    .sort((a, b) => creditCost(outcomeUnits(m, m.outcomes[a])) - creditCost(outcomeUnits(m, m.outcomes[b])))[0] as string;
};

function boot() { render(<App initialData={data} skipIntro />); }
function openMission(id: string, completed: string[] | "all" = "all") {
  localStorage.setItem("qta6.save", JSON.stringify(save(completed)));
  boot();
  fireEvent.click(screen.getByRole("button", { name: /Continue Campaign/ }));
  fireEvent.click(missionBtn(id)[0]);
  fireEvent.click(screen.getByRole("button", { name: /Begin mission/ }));
}
const missionBtn = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-mission="${id}"]`));
const qubit = (q: number) => screen.getByLabelText(new RegExp(`toggle sentinel on qubit ${q}$`));
const toggleEdges = (ids: number[]) => ids.forEach((id) => fireEvent.click(document.querySelector(`[data-edge="${id}"]`)!));

describe("navigation and menu", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("a first visit offers New Game but not Continue; then menu → map → briefing → mission works", () => {
    boot();
    expect(screen.queryByRole("button", { name: /Continue Campaign/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New Game/ }));
    expect(screen.getByRole("heading", { name: "Quantum City", level: 2 })).toBeInTheDocument();
    fireEvent.click(missionBtn("A1")[0]);
    expect(screen.getByText("Scientific problem")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Begin mission/ }));
    expect(screen.getByText("Experiment bench")).toBeInTheDocument();
  });

  it("Continue Campaign appears only when valid saved progress exists; corrupt data is ignored", () => {
    localStorage.setItem("qta6.save", "{broken");
    boot();
    expect(screen.queryByRole("button", { name: /Continue Campaign/ })).not.toBeInTheDocument();
  });

  it("New Game asks for confirmation before erasing an existing save", () => {
    localStorage.setItem("qta6.save", JSON.stringify(save(["A1"])));
    boot();
    fireEvent.click(screen.getByRole("button", { name: /New Game/ }));
    const dlg = screen.getByRole("dialog", { name: /Start a new campaign/ });
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed.A1).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /New Game/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Erase progress/ }));
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed).toEqual({});
  });

  it("locked missions cannot be opened and the map has a keyboard-reachable list of districts", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: /New Game/ }));
    expect(missionBtn("D1").length).toBeGreaterThan(0);
    for (const b of missionBtn("D1")) expect(b).toBeDisabled();
    const districts = screen.getAllByRole("button", { name: /missions completed/ });
    expect(districts).toHaveLength(6);
    for (const d of districts) expect(d.getAttribute("tabindex")).toBe("0");
    fireEvent.click(districts[1]); // select Neon Labs; it is locked at the start
    expect(screen.getAllByText(/Neon Labs/).length).toBeGreaterThan(0);
  });

  it("district selection works from the keyboard", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: /New Game/ }));
    const sunset = screen.getByRole("button", { name: /^Sunset Bay:/ });
    fireEvent.keyDown(sunset, { key: "Enter" });
    expect(screen.getByRole("button", { name: /^Sunset Bay:.*selected/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("states that results are replayed from precomputed simulations rather than live", () => {
    boot();
    expect(screen.getByRole("status")).toHaveTextContent(/replayed from precomputed experiment data/);
    expect(document.body.textContent).not.toMatch(/Every outcome is a real simulation/);
  });
});

describe("mission workspaces", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("A1: measuring spends the shot budget (HUD) and shows counts; success shows the result screen", () => {
    localStorage.setItem("qta6.save", JSON.stringify(save([])));
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Continue Campaign|New Game/ }));
    fireEvent.click(missionBtn("A1")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Begin mission/ }));
    fireEvent.click(screen.getByRole("button", { name: "10000" }));
    fireEvent.click(screen.getByRole("button", { name: /Measure/ }));
    expect(screen.getByText(/Measured counts \(Qiskit Aer\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shots: 2000 left of 12000/)).toBeInTheDocument();
    expect(screen.getByText(/Goal met/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete mission" }));
    expect(screen.getByText("MISSION COMPLETE")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed.A1.attempts).toBe(1);
    expect(screen.getByText(/Unlocked/)).toBeInTheDocument();
  });

  it("a failed mission shows an evidence-based explanation and allows a retry with a fresh budget", () => {
    openMission("D1");
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ })); // zero sentinels: no gain, so the goal is not met
    expect(screen.getByText(/Goal not met/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "End attempt" }));
    expect(screen.getByText("MISSION INCOMPLETE")).toBeInTheDocument();
    expect(screen.getByText("What to try next")).toBeInTheDocument();
    expect(screen.getByText(/executed configurations meet every goal/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("qta6.save")!).failures.D1).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /Retry mission/ }));
    expect(screen.getByLabelText(/Quantum credits: 60\.0 left of 60\.0/)).toBeInTheDocument();
  });

  it("D1: before the run only costs are shown; after the run the four fidelity baselines are labelled and acceptance is stated", () => {
    openMission("D1");
    expect(screen.queryByText(/Before and after/)).not.toBeInTheDocument();
    fireEvent.click(qubit(0));
    fireEvent.click(qubit(2));
    expect(screen.getByText(/extra 2-qubit gates \(cost preview\)/)).toBeInTheDocument();
    expect(screen.queryByText("acceptance κ (shots kept)")).not.toBeInTheDocument(); // not leaked before running
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    for (const t of [/1 · Original unprotected circuit/, /2 · Matched unprotected gate skeleton/, /3 · Protected circuit, all shots kept/, /4 · Protected circuit, post-selected/])
      expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText("acceptance κ (shots kept)")).toBeInTheDocument();
    expect(screen.getByText("shots discarded")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Of 500 raw shots/ })).toBeInTheDocument();
  });

  it("D1: an over-budget selection cannot be run", () => {
    openMission("D1");
    for (const q of [0, 1, 2, 3]) fireEvent.click(qubit(q));
    expect(screen.getByRole("button", { name: /Run experiment/ })).toBeDisabled();
    expect(screen.getByText(/Over the ancilla budget/)).toBeInTheDocument();
  });

  it("D5: the negative result is stated plainly when protection does not help", () => {
    openMission("D5");
    const m = mission("D5");
    const worse = Object.values<any>(m.outcomes).find((o) => o.feasible && o.n_checks > 0 && o.postselected_fidelity <= o.baseline_fidelity);
    expect(worse, "D5 must contain a configuration where protection hurts").toBeTruthy();
    for (const q of worse.targets) fireEvent.click(qubit(q));
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    expect(screen.getByText(/Negative result:/)).toBeInTheDocument();
  });

  it("M3: the zero-noise chart separates measured points from the fitted model and names the model", () => {
    openMission("M3");
    fireEvent.change(screen.getByLabelText("Noise scale factors"), { target: { value: "1,3,5" } });
    fireEvent.change(screen.getByLabelText("Extrapolation"), { target: { value: "richardson" } });
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    expect(screen.getByRole("img", { name: /Zero-noise extrapolation: measured values at noise scales 1, 3, 5/ })).toBeInTheDocument();
    expect(screen.getAllByText(/degree-2 polynomial through the measured points \(Richardson\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/No points are added to smooth the curve/)).toBeInTheDocument();
    expect(screen.getByText("MSE (repeated trials)")).toBeInTheDocument();
  });

  it("M2: the calibration slider snaps to executed configurations and the budget split is charged in full", () => {
    openMission("M2");
    fireEvent.change(screen.getByLabelText("Calibration share (%)"), { target: { value: "5" } });
    expect(screen.getByText(/snaps to one of the 6 settings that were actually simulated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    expect(screen.getByLabelText(/Shots: 0 left of 8000/)).toBeInTheDocument();
  });

  it("C3: lattice edges toggle from mouse and keyboard, undo works and submission separates the three verdicts", () => {
    openMission("C3");
    const ref = mission("C3").reference.instances[0];
    const first = ref.mwpm_edges[0];
    const el = document.querySelector(`[data-edge="${first}"]`)!;
    fireEvent.keyDown(el, { key: "Enter" });
    expect(el).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(el).toHaveAttribute("aria-pressed", "false");
    toggleEdges(ref.mwpm_edges);
    expect(screen.getByText("defects remaining (live check)").previousSibling?.textContent).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: /Submit correction/ }));
    expect(screen.getByText("Evaluation")).toBeInTheDocument();
    expect(screen.getByText("logical state preserved")).toBeInTheDocument();
    expect(screen.getByText(/Syndrome cleared and the logical qubit preserved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show the MWPM correction/ }));
    expect(screen.getByRole("button", { name: /Hide the MWPM correction/ })).toBeInTheDocument();
  });

  it("C3: states which decoding model is in play and labels X and Z stabilizers", () => {
    openMission("C3");
    expect(screen.getByText(/model: Code-capacity model/)).toBeInTheDocument();
    expect(screen.getByText(/Z-type stabilizer \(decoded here\)/)).toBeInTheDocument();
    expect(screen.getByText(/X-type stabilizer/)).toBeInTheDocument();
  });

  it("C5: a correction that clears the syndrome but flips the logical qubit is NOT presented as a success", () => {
    openMission("C5");
    const m = mission("C5");
    const ref = m.reference.instances[0];
    toggleEdges(ref.syndrome_clearing_but_logically_wrong_example);
    fireEvent.click(screen.getByRole("button", { name: /Submit correction/ }));
    expect(screen.getByText(/Syndrome cleared, but the logical qubit was flipped/)).toBeInTheDocument();
    expect(screen.getByText(/Logical trap:/)).toBeInTheDocument();
    expect(screen.queryByText(/Syndrome cleared and the logical qubit preserved/)).not.toBeInTheDocument();
  });

  it("C7: the phenomenological model is named and time-like edges are offered", () => {
    openMission("C7");
    expect(screen.getByText(/model: Phenomenological model/)).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-label^="measurement error edge"]').length).toBeGreaterThan(0);
  });

  it("C6: reports the interval and warns when few failures were observed", () => {
    openMission("C6");
    expect(screen.getByText(/model: Full circuit-level model/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simulate d = 7" })); // 97 qubits exceed the 60-qubit budget: refused, nothing charged
    expect(screen.getByRole("alert")).toHaveTextContent(/physical qubits budget/);
    expect(screen.queryByText("95% Wilson interval")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simulate d = 5" }));
    expect(screen.getByText("95% Wilson interval")).toBeInTheDocument();
    expect(screen.getByText("p_L (point estimate)")).toBeInTheDocument();
  });

  it("O2: spending is charged and the hidden true noise is only revealed after execution", () => {
    openMission("O2");
    expect(screen.queryByText(/Hidden TRUE/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Run on today's device/ })[0]);
    expect(screen.getByText(/Hidden TRUE \(drifted\) noise/)).toBeInTheDocument();
    expect(screen.getByText("absolute regret (MSE)")).toBeInTheDocument();
  });

  it("A4: choosing the right recovery restores the logical state", () => {
    openMission("A4");
    fireEvent.click(screen.getAllByText("flip q0")[0]);
    expect(screen.getByText(/Goal met/)).toBeInTheDocument();
  });
});

describe("N1 — the integrated final mission", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  const planKey = (win: boolean) => {
    const m = mission("N1");
    const keys = Object.keys(m.outcomes).filter((k) => m.outcomes[k].feasible && !!m.outcomes[k].success === win)
      .sort((a, b) => m.outcomes[a].units.shots - m.outcomes[b].units.shots);
    return { key: keys[0], row: m.outcomes[keys[0]] };
  };
  const walk = (row: any) => {
    fireEvent.click(screen.getByRole("button", { name: /Continue/ })); // → stage 2
    const m = mission("N1");
    const dOpt = m.ui.detection_options[row.detection_key];
    fireEvent.click(screen.getByLabelText(`${dOpt.ancillas} sentinels on qubits ${dOpt.targets.join(",") || "none"}`));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ })); // → stage 3
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${row.mitigation.replace("+", "\\+")} —`) }));
    fireEvent.change(screen.getByLabelText("Shots for the lab"), { target: { value: String(row.mitigation_total) } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ })); // → stage 4
    fireEvent.click(screen.getByLabelText(`distance ${row.distance}`));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ })); // → stage 5 (review)
  };

  it("N1 has 768 executed plans, 512 feasible and 36 successful (current data)", () => {
    const outs = Object.values<any>(mission("N1").outcomes);
    expect([outs.length, outs.filter((o) => o.feasible).length, outs.filter((o) => o.success).length]).toEqual([768, 512, 36]);
  });

  it("walks through all stages, executes a winning plan once, charges the wallet and restores every subsystem", () => {
    openMission("N1");
    const { key, row } = planKey(true);
    expect(screen.getByText(/Stage 1 — Emergency briefing/)).toBeInTheDocument();
    walk(row);
    expect(screen.getByText(/Stage 5 — Review and execute/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantum credits: 150\.0 left of 150\.0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Execute integrated plan/ }));
    expect(screen.getByText(/Stage 6 — Network status/)).toBeInTheDocument();
    expect(screen.getAllByText(/✔ restored/)).toHaveLength(3);
    expect(screen.getByLabelText(/Quantum credits: .* left of 150\.0/).getAttribute("aria-label")).not.toMatch(/150\.0 left of 150\.0/); // the plan was charged
    expect(mission("N1").outcomes[key].units.shots).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Complete mission" }));
    expect(screen.getByText("NETWORK RESTORED")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed.N1).toBeDefined();
    expect(screen.getByText(/Random feasible plan/)).toBeInTheDocument();
  });

  it("an unsuccessful plan gives the alternate ending, shows which subsystem failed and can be retried", () => {
    openMission("N1", data.missions.map((m: any) => m.id).filter((id: string) => id !== "N1"));
    const { row } = planKey(false);
    walk(row);
    fireEvent.click(screen.getByRole("button", { name: /Execute integrated plan/ }));
    expect(screen.getAllByText(/✘ not restored/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "End attempt" }));
    expect(screen.getByText(/NETWORK STILL DOWN|PARTIAL RESTORATION/)).toBeInTheDocument();
    expect(screen.getByText("What to try next")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry mission/ }));
    expect(screen.getByLabelText(/Quantum credits: 150\.0 left of 150\.0/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed.N1).toBeUndefined();
  });

  it("an over-budget plan cannot be executed", () => {
    openMission("N1");
    const m = mission("N1");
    const bad = Object.values<any>(m.outcomes).find((o) => !o.feasible);
    walk(bad);
    expect(screen.getByText(/exceeds the shared budget/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Execute integrated plan/ })).toBeDisabled();
  });
});

describe("shell, settings and sandbox", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

  it("Quantum Codex lists the glossary and the key distinctions", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: "Quantum Codex" }));
    expect(screen.getByRole("heading", { name: "Quantum Codex" })).toBeInTheDocument();
    expect(screen.getByText("Pareto front")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Key distinctions" }));
    expect(screen.getByText("Mitigation is not correction")).toBeInTheDocument();
  });

  it("the sandbox explains that it is unavailable and does not send requests while no API is reachable", () => {
    const f = vi.spyOn(globalThis, "fetch");
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Scientific Sandbox/ }));
    expect(screen.getAllByText(/Live sandbox unavailable/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Run live" })).toBeDisabled();
    expect(f.mock.calls.filter((c) => String(c[0]).includes("/api/")).length).toBeLessThanOrEqual(1); // at most the single startup probe
  });

  it("the sandbox posts to the configured API once it is online and validates the connection", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, init?: any) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (String(url).endsWith("/api/health")) return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      return new Response(JSON.stringify({ experiment_id: "abc", provenance: { kind: "exact_numerical", runtime_s: 0.1 }, result: { ok: true } }), { status: 200 });
    });
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Scientific Sandbox/ }));
    fireEvent.change(screen.getByLabelText("API base URL"), { target: { value: "http://127.0.0.1:8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
    expect(await screen.findByText(/live computation via the Python API/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run live" }));
    expect(await screen.findByText(/computed live · experiment abc/)).toBeInTheDocument();
    expect(calls).toContain("POST http://127.0.0.1:8000/api/detection/evaluate");
  });

  it("the campaign works with the API absent (offline) and loads its data from a relative path", () => {
    boot();
    expect(screen.getByText(/precomputed campaign is fully playable offline/)).toBeInTheDocument();
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<App skipIntro />);
    expect(f).toHaveBeenCalledWith("data/campaign.json"); // no leading slash: works under a sub-path such as /quantumgrad/
  });

  it("sound and display settings persist and are validated", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const slider = screen.getByLabelText("Master volume");
    fireEvent.change(slider, { target: { value: "0.3" } });
    fireEvent.click(screen.getByRole("switch", { name: "Sound" }));
    fireEvent.change(screen.getByLabelText("Animation"), { target: { value: "reduced" } });
    fireEvent.change(screen.getByLabelText("Text size"), { target: { value: "large" } });
    const s = JSON.parse(localStorage.getItem("qta6.settings")!);
    expect(s).toMatchObject({ master: 0.3, muted: false, motion: "reduced", text: "large" });
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(document.documentElement.dataset.text).toBe("large");
  });

  it("corrupt settings fall back to safe defaults (muted, system motion)", () => {
    localStorage.setItem("qta6.settings", JSON.stringify({ master: 9, muted: "no", motion: "wild" }));
    boot();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Master volume")).toHaveValue("1");
    expect(screen.getByRole("switch", { name: "Sound" })).toHaveAttribute("aria-checked", "false");
  });

  it("Credits states the competition, the AI assistance and that the project is not affiliated with Rockstar/GTA", () => {
    boot();
    fireEvent.click(screen.getByRole("button", { name: /Credits/ }));
    expect(screen.getByText(/McGill University Advanced Challenge/)).toBeInTheDocument();
    expect(screen.getByText(/AI assistance disclosure/)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with, endorsed by or derived from Rockstar Games/)).toBeInTheDocument();
    expect(screen.getByText(/SIL Open Font License/)).toBeInTheDocument();
  });

  it("leaving a mission with runs asks for confirmation; a dialog traps focus and closes on Escape", () => {
    openMission("D1");
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    fireEvent.click(screen.getByRole("button", { name: /Exit/ }));
    const dlg = screen.getByRole("dialog", { name: /Leave this mission/ });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("D1 · Sentinel Deployment")).toBeInTheDocument(); // still in the mission
  });

  it("the HUD announces resources and updates the actual wallet after spending", () => {
    openMission("D1");
    expect(screen.getByLabelText(/Ancillas: 3 left of 3/)).toBeInTheDocument();
    fireEvent.click(qubit(0));
    fireEvent.click(screen.getByRole("button", { name: /Run experiment/ }));
    expect(screen.getByLabelText(/Ancillas: 2 left of 3/)).toBeInTheDocument();
  });
});
