// Pure game logic that is shared by components and tests. Scientific numbers are NEVER computed here:
// they come from the precomputed campaign data (produced by the Python engine). The only arithmetic is
// set algebra for manual decoding, which is verified against Python-generated conformance vectors.

export type Json = any; // campaign data is schema-validated on the Python side

export const SAVE_SCHEMA = "qta6.save/1";

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

export interface Progress {
  schema: string;
  completed: Record<string, { best_score: number; attempts: number }>;
  difficulty: "beginner" | "intermediate" | "advanced";
  tutorial_done: boolean;
}

export const emptyProgress = (): Progress => ({ schema: SAVE_SCHEMA, completed: {}, difficulty: "beginner", tutorial_done: false });

export function validateProgress(raw: unknown): Progress {
  const d = raw as Json;
  if (!d || typeof d !== "object" || d.schema !== SAVE_SCHEMA) throw new Error(`unsupported save schema ${d?.schema}`);
  const comp = d.completed;
  if (!comp || typeof comp !== "object") throw new Error("malformed save data");
  for (const v of Object.values(comp) as Json[]) {
    if (typeof v?.best_score !== "number" || typeof v?.attempts !== "number") throw new Error("malformed save data");
  }
  return { schema: SAVE_SCHEMA, completed: comp, difficulty: d.difficulty ?? "beginner", tutorial_done: !!d.tutorial_done };
}

export function loadProgress(storage: Pick<Storage, "getItem"> = localStorage): Progress {
  try {
    const s = storage.getItem("qta6.save");
    return s ? validateProgress(JSON.parse(s)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress, storage: Pick<Storage, "setItem"> = localStorage): void {
  try { storage.setItem("qta6.save", JSON.stringify(p)); } catch { /* storage unavailable: progress is kept in memory only */ }
}

export function isUnlocked(progress: Progress, mission: Json): boolean {
  return (mission.unlock_requires as string[]).every((r) => r in progress.completed);
}

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

export function outcomeUnits(mission: Json, out: Json): Record<string, number> {
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

export const creditCost = (units: Record<string, number>) =>
  Object.entries(units).reduce((s, [k, v]) => s + (CREDIT_PRICES[k] ?? 0) * v, 0);

export const popcount = (x: number) => x.toString(2).split("1").length - 1;
