// Pure game logic that is shared by components and tests. Scientific numbers are NEVER computed here:
// they come from the precomputed campaign data (produced by the Python engine). The only arithmetic is
// set algebra for manual decoding, which is verified against Python-generated conformance vectors.

export type Json = any; // campaign data is schema-validated on the Python side

export const SAVE_SCHEMA = "qta6.save/2";
export const LEGACY_SAVE_SCHEMAS = ["qta6.save/1"]; // migrated on load: v2 only adds the failure counter
export const SAVE_KEY = "qta6.save";
export const DEMO_KEY = "qta6.demo.save"; // Quick Demo progress lives under its own key and never touches the campaign save

export type GameState =
  | "main_menu" | "district_selection" | "mission_briefing" | "strategy_configuration"
  | "resource_allocation" | "experiment_execution" | "scientific_analysis"
  | "mission_success" | "mission_failure" | "replay" | "campaign_complete";

// Mirrors qta6.game.engine.TRANSITIONS (the exported campaign data carries the Python table for conformance checks).
export const TRANSITIONS: Record<GameState, GameState[]> = {
  main_menu: ["district_selection"],
  district_selection: ["mission_briefing", "main_menu", "campaign_complete"],
  mission_briefing: ["strategy_configuration", "district_selection"],
  strategy_configuration: ["resource_allocation", "experiment_execution", "mission_briefing"],
  resource_allocation: ["experiment_execution", "strategy_configuration"],
  experiment_execution: ["scientific_analysis"],
  scientific_analysis: ["strategy_configuration", "mission_success", "mission_failure"],
  mission_success: ["district_selection", "replay", "campaign_complete"],
  mission_failure: ["strategy_configuration", "district_selection", "replay"],
  replay: ["strategy_configuration", "district_selection"],
  campaign_complete: ["main_menu", "district_selection"],
};

export function canGo(from: GameState, to: GameState): boolean {
  return TRANSITIONS[from].includes(to);
}

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Progress {
  schema: string;
  completed: Record<string, { best_score: number; attempts: number }>;
  failures: Record<string, number>;
  difficulty: Difficulty;
  tutorial_done: boolean;
}

export const emptyProgress = (): Progress => ({ schema: SAVE_SCHEMA, completed: {}, failures: {}, difficulty: "beginner", tutorial_done: false });

const MISSION_ID = /^[A-Z][0-9]{1,2}$/;
const finiteNonNeg = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;

/** Strict validation + migration. Throws on anything that is not a well-formed save of a supported version. */
export function validateProgress(raw: unknown): Progress {
  const d = raw as Json;
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("malformed save data");
  const legacy = LEGACY_SAVE_SCHEMAS.includes(d.schema);
  if (d.schema !== SAVE_SCHEMA && !legacy) throw new Error(`unsupported save schema ${d?.schema}`);
  const comp = d.completed;
  if (!comp || typeof comp !== "object" || Array.isArray(comp)) throw new Error("malformed save data");
  const completed: Progress["completed"] = {};
  for (const [id, v] of Object.entries(comp) as [string, Json][]) {
    if (!MISSION_ID.test(id) || !finiteNonNeg(v?.best_score) || !finiteNonNeg(v?.attempts)) throw new Error("malformed save data");
    completed[id] = { best_score: v.best_score, attempts: Math.floor(v.attempts) };
  }
  const failures: Progress["failures"] = {};
  if (!legacy && d.failures !== undefined) {
    if (!d.failures || typeof d.failures !== "object" || Array.isArray(d.failures)) throw new Error("malformed save data");
    for (const [id, n] of Object.entries(d.failures)) {
      if (!MISSION_ID.test(id) || !finiteNonNeg(n)) throw new Error("malformed save data");
      failures[id] = Math.floor(n as number);
    }
  }
  const difficulty = (DIFFICULTIES as readonly string[]).includes(d.difficulty) ? (d.difficulty as Difficulty) : "beginner";
  return { schema: SAVE_SCHEMA, completed, failures, difficulty, tutorial_done: d.tutorial_done === true };
}

/** localStorage can throw on access (blocked cookies, sandboxed iframes); every access goes through here. */
export function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem(SAVE_KEY); // may throw SecurityError
    return s;
  } catch {
    return null;
  }
}

export function loadProgress(storage: Pick<Storage, "getItem"> | null = safeStorage(), key: string = SAVE_KEY): Progress {
  try {
    const s = storage?.getItem(key);
    return s ? validateProgress(JSON.parse(s)) : emptyProgress();
  } catch {
    return emptyProgress(); // corrupted or unsupported data never crashes the game
  }
}

/** Union of two saves: no completion or best score is ever lost (used for multi-tab and safe writes). */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const completed = { ...a.completed };
  for (const [id, r] of Object.entries(b.completed)) {
    const c = completed[id];
    completed[id] = c ? { best_score: Math.max(c.best_score, r.best_score), attempts: Math.max(c.attempts, r.attempts) } : r;
  }
  const failures = { ...a.failures };
  for (const [id, n] of Object.entries(b.failures)) failures[id] = Math.max(failures[id] ?? 0, n);
  return { ...a, completed, failures, tutorial_done: a.tutorial_done || b.tutorial_done };
}

export function saveProgress(p: Progress, storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage(), replace = false, key: string = SAVE_KEY): void {
  try {
    if (!storage) return; // progress stays in memory only
    let out = p;
    if (!replace) { try { const cur = storage.getItem(key); if (cur) out = mergeProgress(p, validateProgress(JSON.parse(cur))); } catch { /* overwrite unreadable data */ } }
    storage.setItem(key, JSON.stringify(out));
  } catch { /* quota or privacy mode: keep playing without persistence */ }
}

export function isUnlocked(progress: Progress, mission: Json): boolean {
  return (mission.unlock_requires as string[]).every((r) => r in progress.completed);
}

/** Why a mission is locked, in words: the prerequisite missions that are not completed yet (empty when it is open). */
export function lockReason(progress: Progress, mission: Json, data: Json): string[] {
  return (mission.unlock_requires as string[]).filter((r) => !(r in progress.completed)).map((r) => {
    const m = (data.missions as Json[]).find((x) => x.id === r);
    return m ? `${m.id} · ${m.title}` : r;
  });
}

// ---- Quick Demo ---------------------------------------------------------------------------------------
// A curated path through six of the campaign's own missions (nothing is re-simulated or re-labelled). Each has a verified winning
// strategy (tests/gameplay/test_campaign_solvability.py plays all 29), and demo progress is stored apart from the campaign save.
export interface DemoStep { id: string; concept: string }
export const DEMO_STEPS: DemoStep[] = [
  { id: "A2", concept: "A simple error: some noise is invisible in the wrong measurement basis." },
  { id: "D1", concept: "Detection: sentinel qubits flag faults in spacetime, at the cost of discarded shots." },
  { id: "M2", concept: "Mitigation: split a fixed shot budget between calibration and signal." },
  { id: "C3", concept: "Correction: decode surface-code defects by hand and check the logical qubit." },
  { id: "C6", concept: "Decision: the code distance that fits a qubit budget and a failure target." },
  { id: "N1", concept: "Integrated challenge: detection, mitigation and correction on one shared budget." },
];
export const DEMO_IDS: string[] = DEMO_STEPS.map((s) => s.id);

// ---- wallet -----------------------------------------------------------------------------------------
export interface Wallet { credits: number; caps: Record<string, number>; usedCredits: number; used: Record<string, number>; }

export function newWallet(mission: Json): Wallet {
  return { credits: mission.resources.credits, caps: { ...mission.resources.caps }, usedCredits: 0, used: {} };
}

export function canAfford(w: Wallet, units: Record<string, number>, credits: number): string | null {
  if (w.usedCredits + credits > w.credits + 1e-9) return `not enough credits (${(w.credits - w.usedCredits).toFixed(1)} left, need ${credits.toFixed(1)})`;
  for (const [k, v] of Object.entries(units)) {
    if (k in w.caps && (w.used[k] ?? 0) + v > w.caps[k] + 1e-9) return `exceeds the ${k.replace(/_/g, " ")} budget (${w.caps[k] - (w.used[k] ?? 0)} left)`;
  }
  return null;
}

export function charge(w: Wallet, units: Record<string, number>, credits: number): Wallet {
  const err = canAfford(w, units, credits);
  if (err) throw new Error(err);
  const used = { ...w.used };
  for (const [k, v] of Object.entries(units)) used[k] = (used[k] ?? 0) + v;
  return { ...w, usedCredits: w.usedCredits + credits, used };
}

// ---- manual decoding (conformance-tested against qta6.correction.manual.evaluate_correction) -------
export interface Edge { id: number; u: number; v: number | null; p: number; weight: number; obs: number; }

export interface DecodeEval {
  valid: boolean; unknown: number[]; clears_syndrome: boolean; logically_correct: boolean | null;
  path_cost: number | null; predicted_logical_flip: number | null; residual: number[];
}

export function evaluateCorrection(edges: Edge[], events: number[], chosen: number[], hiddenFlip: number | null): DecodeEval {
  const byId = new Map(edges.map((e) => [e.id, e] as const));
  const unknown = chosen.filter((i) => !byId.has(i));
  if (unknown.length) return { valid: false, unknown, clears_syndrome: false, logically_correct: false, path_cost: null, predicted_logical_flip: null, residual: [] };
  const mult = new Map<number, number>();
  for (const i of chosen) mult.set(i, (mult.get(i) ?? 0) ^ 1); // an edge chosen twice cancels
  const eff = [...mult].filter(([, m]) => m).map(([i]) => i);
  const syn = new Set<number>();
  let obs = 0, cost = 0;
  const flip = (n: number) => (syn.has(n) ? syn.delete(n) : syn.add(n));
  for (const i of eff) {
    const e = byId.get(i)!;
    flip(e.u);
    if (e.v !== null) flip(e.v);
    obs ^= e.obs;
    cost += e.weight;
  }
  const ev = new Set(events);
  const residual = [...new Set([...syn, ...ev])].filter((n) => syn.has(n) !== ev.has(n)).sort((a, b) => a - b);
  const clears = residual.length === 0;
  return { valid: true, unknown: [], clears_syndrome: clears, logically_correct: hiddenFlip === null ? null : clears && obs === hiddenFlip,
           path_cost: cost, predicted_logical_flip: obs, residual };
}

// ---- action keys -----------------------------------------------------------------------------------
export const keyOf = (parts: (string | number)[]) => parts.join("|");

/** Resource units an executed action consumes. Exported outcomes carry their own `units` (single source of truth). */
export function outcomeUnits(mission: Json, out: Json): Record<string, number> {
  if (out.units) return { ...out.units };
  switch (mission.kind) {
    case "detection": case "optimization": return { ancilla_qubits: out.ancilla_qubits, extra_two_qubit_gates: out.extra_two_qubit_gates };
    case "experiment": return { shots: out.shots };
    case "mitigation": return { shots: out.resources.raw_shots + out.resources.calibration_shots + out.resources.pilot_shots };
    case "distance": return { physical_qubits: out.physical_qubits };
    default: return {};
  }
}

// pedagogical credit prices; MUST equal qta6.game.economy.CREDIT_PRICES (checked in tests)
export const CREDIT_PRICES: Record<string, number> = {
  ancilla_qubits: 4.0, extra_two_qubit_gates: 0.5, shots: 0.002, qubit_rounds: 0.1, physical_qubits: 0.5, calibration_refresh: 5.0,
};

export function creditCost(units: Record<string, number>): number {
  let total = 0;
  for (const [k, v] of Object.entries(units)) {
    if (!(k in CREDIT_PRICES)) throw new Error(`resource '${k}' has no price`); // no hidden free resources
    if (!Number.isFinite(v) || v < 0) throw new Error(`invalid quantity for '${k}'`);
    total += CREDIT_PRICES[k] * v;
  }
  return Math.round(total * 1e6) / 1e6;
}

export const popcount = (x: number) => x.toString(2).split("1").length - 1;
