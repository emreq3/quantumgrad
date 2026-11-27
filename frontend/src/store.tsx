import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  canAfford, canGo, charge, creditCost, emptyProgress, evaluateCorrection, isUnlocked, loadProgress, newWallet, outcomeUnits,
  saveProgress, type GameState, type Json, type Progress, type Wallet,
} from "./engine";

export interface Run { key: string; outcome: Json; n: number }

interface Ctx {
  data: Json | null;
  error: string | null;
  apiAvailable: boolean;
  state: GameState;
  progress: Progress;
  mission: Json | null;
  wallet: Wallet | null;
  history: Run[];
  last: Json | null;
  solved: Record<string, boolean>;
  notice: string | null;
  go: (to: GameState) => void;
  selectMission: (id: string) => void;
  begin: () => void;
  run: (key: string) => Json | null;
  submitCorrection: (instanceId: string, chosen: number[]) => Json | null;
  submitDiagnosis: (selected: string[]) => Json | null;
  continuePlaying: () => void;
  finish: () => void;
  restart: () => void;
  resetCampaign: () => void;
  setDifficulty: (d: Progress["difficulty"]) => void;
  isUnlocked: (m: Json) => boolean;
}

const GameContext = createContext<Ctx | null>(null);
export const useGame = (): Ctx => {
  const c = useContext(GameContext);
  if (!c) throw new Error("useGame outside GameProvider");
  return c;
};

export function correctionFeedback(res: Json): Json {
  const refs = ["research/05_error_correction.md", "research/06_surface_code_decoders.md"];
  if (!res.valid) return { plain: "Some chosen edges are not allowed in this code.", scientific: "Only edges of the decoding graph are valid.", math: "", refs };
  const plain = res.logically_correct
    ? "Success: the syndrome is cleared and the logical qubit is preserved."
    : res.clears_syndrome
      ? "The syndrome is cleared but the logical state is damaged: your correction differs from the true error by a logical operator, which no stabilizer can detect."
      : "The correction leaves defects, so the syndrome is not cleared.";
  return {
    plain,
    scientific: `Path cost ${res.path_cost.toFixed(2)} vs MWPM reference ${res.mwpm_cost.toFixed(2)}; MWPM was ${res.mwpm_logical_correct ? "right" : "wrong"} on this instance. Corrections equivalent up to stabilizers are all accepted.`,
    math: "Weight w_e = ln((1-p_e)/p_e); logical success requires XOR of chosen edges' observable flips = true observable flip.",
    refs,
  };
}

export function GameProvider({ children, dataUrl = "data/campaign.json", initialData }: { children: ReactNode; dataUrl?: string; initialData?: Json }) {
  const [data, setData] = useState<Json | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApi] = useState(false);
  const [state, setState] = useState<GameState>("main_menu");
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [mission, setMission] = useState<Json | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [last, setLast] = useState<Json | null>(null);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    fetch(dataUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`campaign data HTTP ${r.status}`))))
      .then(setData).catch((e) => setError(String(e)));
  }, [dataUrl, initialData]);
  useEffect(() => {
    fetch("/api/health").then((r) => r.ok ? r.json() : null).then((j) => setApi(!!j?.status)).catch(() => setApi(false));
  }, []);
  useEffect(() => saveProgress(progress), [progress]);

  const go = useCallback((to: GameState) => {
    setState((cur) => (canGo(cur, to) ? to : (console.error(`illegal transition ${cur} -> ${to}`), cur)));
  }, []);

  const selectMission = (id: string) => {
    const m = data?.missions.find((x: Json) => x.id === id);
    if (!m || !isUnlocked(progress, m)) { setNotice(`Mission ${id} is locked`); return; }
    go("mission_briefing");
    setMission(m); setWallet(newWallet(m)); setHistory([]); setLast(null); setSolved({}); setNotice(null);
  };
  const begin = () => go("strategy_configuration");

  const enter = (out: Json) => {
    setState("experiment_execution");
    setLast(out);
    setState("scientific_analysis");
  };

  const run = (key: string): Json | null => {
    if (!mission || !wallet || state !== "strategy_configuration") { setNotice("Start the mission first."); return null; }
    const out = mission.outcomes[key];
    if (!out) { setNotice(`Action '${key}' is not part of this mission's executed action space`); return null; }
    if (out.feasible === false) { setNotice(out.reason ?? "infeasible action"); return null; }
    const units = outcomeUnits(mission, out);
    const credits = creditCost(units);
    const err = canAfford(wallet, units, credits);
    if (err) { setNotice(err); return null; }
    setWallet(charge(wallet, units, credits));
    setNotice(null);
    let result = out;
    if (mission.kind === "repetition") {
      const s: Record<string, boolean> = { ...solved, [out.instance]: !!out.success || !!solved[out.instance] };
      setSolved(s);
      const req = mission.ui.instances.filter((i: Json) => i.required).map((i: Json) => i.id);
      result = { ...out, mission_success: req.every((i: string) => s[i]) };
    }
    setHistory((h) => [...h, { key, outcome: result, n: h.length + 1 }]);
    enter(result);
    return result;
  };

  const submitCorrection = (instanceId: string, chosen: number[]): Json | null => {
    if (!mission || state !== "strategy_configuration") return null;
    const inst = mission.ui.instances.find((i: Json) => i.id === instanceId);
    const ref = mission.reference.instances.find((i: Json) => i.id === instanceId);
    if (!inst || !ref) return null;
    const ev = evaluateCorrection(inst.edges, inst.events, chosen, ref.hidden_logical_flip);
    const mode = mission.ui.mode;
    const res: Json = { ...ev, mwpm_cost: ref.mwpm_cost, mwpm_logical_correct: ref.mwpm_logical === ref.hidden_logical_flip, instance: instanceId };
    res.success = mode === "reproduce" ? ev.valid && ev.clears_syndrome && (ev.path_cost ?? 1e9) <= ref.mwpm_cost + 1e-9 : ev.valid && !!ev.logically_correct;
    res.score = ev.valid
      ? Math.round(10 * 100 * (0.6 * (ev.logically_correct ? 1 : 0) + 0.2 * (ev.clears_syndrome ? 1 : 0) + 0.2 * Math.max(0, 1 - Math.max(0, (ev.path_cost ?? 0) - ref.mwpm_cost) / 3))) / 10
      : 0;
    res.explanation = correctionFeedback(res);
    res.reference_revealed = { hidden_logical_flip: ref.hidden_logical_flip, mwpm_edges: ref.mwpm_edges, equivalent: ref.equivalent_correct_example,
                               logical_trap: ref.syndrome_clearing_but_logically_wrong_example, class_probabilities: ref.class_probabilities };
    const s: Record<string, boolean> = { ...solved, [instanceId]: !!res.success || !!solved[instanceId] };
    setSolved(s);
    const req = mission.ui.instances.map((i: Json) => i.id);
    res.mission_success = req.every((i: string) => s[i]);
    setHistory((h) => [...h, { key: `decode:${instanceId}`, outcome: res, n: h.length + 1 }]);
    enter(res);
    return res;
  };

  const submitDiagnosis = (selected: string[]): Json | null => {
    if (!mission || state !== "strategy_configuration") return null;
    const cons: Record<string, boolean> = mission.reference.consistent;
    const truth = Object.keys(cons).filter((k) => cons[k]);
    const tp = selected.filter((s) => cons[s]).length;
    const precision = selected.length ? tp / selected.length : 0;
    const recall = truth.length ? tp / truth.length : 1;
    const ok = selected.length === truth.length && tp === truth.length;
    const res: Json = {
      precision, recall, success: ok, score: Math.round(10 * 100 * (precision + recall) / 2) / 10,
      revealed: { hidden_fault: mission.reference.hidden_fault_id, hidden_outcome: mission.reference.hidden_outcome, syndromes: mission.reference.syndromes },
      explanation: {
        plain: ok ? "Every location whose fault flips exactly the fired checks is consistent with the alarm." : "Some selected locations do not produce this syndrome, or some consistent locations were missed.",
        scientific: "A fault flips a check iff it anticommutes with that check's flow at that spacetime location.",
        math: "Syndrome bit j = x-component (final Pauli) on ancilla j after Pauli propagation.", refs: ["research/03_error_detection.md"],
      },
    };
    setHistory((h) => [...h, { key: "diagnose", outcome: res, n: h.length + 1 }]);
    enter(res);
    return res;
  };

  const continuePlaying = () => go("strategy_configuration");

  const finish = () => {
    if (state !== "scientific_analysis" || !mission || !last) return;
    const multi = mission.kind === "decoding" || mission.kind === "repetition";
    const ok = multi ? !!last.mission_success : !!last.success;
    if (multi && !ok) { go("strategy_configuration"); return; }
    setProgress((p) => {
      const rec = p.completed[mission.id] ?? { best_score: 0, attempts: 0 };
      const next = { ...rec, attempts: rec.attempts + 1, best_score: ok ? Math.max(rec.best_score, last.score ?? 0) : rec.best_score };
      return ok ? { ...p, completed: { ...p.completed, [mission.id]: next }, tutorial_done: p.tutorial_done || mission.id === "A4" } : p;
    });
    go(ok ? "mission_success" : "mission_failure");
  };

  const restart = () => {
    if (!mission) return;
    setWallet(newWallet(mission)); setHistory([]); setLast(null); setSolved({}); setNotice(null);
    setState((cur) => {
      if (cur === "mission_success" || cur === "mission_failure") return "strategy_configuration";
      return cur === "scientific_analysis" ? "strategy_configuration" : cur;
    });
  };

  const resetCampaign = () => {
    setProgress(emptyProgress()); setMission(null); setWallet(null); setHistory([]); setLast(null); setSolved({}); setState("main_menu");
  };
  const setDifficulty = (d: Progress["difficulty"]) => setProgress((p) => ({ ...p, difficulty: d }));
  const unlocked = useCallback((m: Json) => isUnlocked(progress, m), [progress]);

  const value = useMemo<Ctx>(() => ({
    data, error, apiAvailable, state, progress, mission, wallet, history, last, solved, notice, go, selectMission, begin, run,
    submitCorrection, submitDiagnosis, continuePlaying, finish, restart, resetCampaign, setDifficulty, isUnlocked: unlocked,
  }), [data, error, apiAvailable, state, progress, mission, wallet, history, last, solved, notice, go, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
