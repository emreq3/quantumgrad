import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultApiBase } from "./config";
import {
  canAfford, canGo, charge, creditCost, emptyProgress, evaluateCorrection, isUnlocked, loadProgress, newWallet, outcomeUnits,
  safeStorage, saveProgress, SAVE_KEY, validateProgress, type GameState, type Json, type Progress, type Wallet,
} from "./engine";

export interface Run { key: string; outcome: Json; n: number }
export type ApiState = "unknown" | "online" | "offline" | "disabled";

interface Ctx {
  data: Json | null;
  error: string | null;
  apiBase: string | null;
  apiState: ApiState;
  apiAvailable: boolean;
  recheckApi: (base?: string | null) => Promise<boolean>;
  state: GameState;
  progress: Progress;
  mission: Json | null;
  wallet: Wallet | null;
  history: Run[];
  last: Json | null;
  solved: Record<string, boolean>;
  notice: string | null;
  lastSpend: { n: number; credits: number; units: Record<string, number> } | null;
  go: (to: GameState) => void;
  selectMission: (id: string) => void;
  begin: () => void;
  run: (key: string) => Json | null;
  submitCorrection: (instanceId: string, chosen: number[]) => Json | null;
  submitDiagnosis: (selected: string[]) => Json | null;
  continuePlaying: () => void;
  finish: () => void;
  restart: () => void;
  leaveMission: () => void;
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
  const [apiBase, setApiBase] = useState<string | null>(() => defaultApiBase());
  const [apiState, setApiState] = useState<ApiState>(() => (defaultApiBase() === null ? "disabled" : "unknown"));
  const [state, setState] = useState<GameState>("main_menu");
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [mission, setMission] = useState<Json | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [last, setLast] = useState<Json | null>(null);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSpend, setLastSpend] = useState<Ctx["lastSpend"]>(null);

  // Synchronous mirrors of the authoritative game state. React state updates are batched, so two calls in the same tick
  // (double click, key repeat, an animation callback firing twice) would otherwise both read the stale snapshot and
  // both execute / both charge. All guards read these refs, which are updated before anything else happens.
  const stateRef = useRef<GameState>("main_menu");
  const walletRef = useRef<Wallet | null>(null);
  const missionRef = useRef<Json | null>(null);
  const solvedRef = useRef<Record<string, boolean>>({});
  const nRef = useRef(0);
  const setS = (s: GameState) => { stateRef.current = s; setState(s); };
  const setW = (w: Wallet | null) => { walletRef.current = w; setWallet(w); };
  const setSolvedBoth = (v: Record<string, boolean>) => { solvedRef.current = v; setSolved(v); };

  useEffect(() => {
    if (initialData) return;
    let live = true;
    fetch(dataUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`campaign data HTTP ${r.status}`))))
      .then((j) => { if (live) setData(j); }).catch((e) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [dataUrl, initialData]);

  const recheckApi = useCallback(async (base: string | null = apiBase): Promise<boolean> => {
    if (base === null) { setApiBase(null); setApiState("disabled"); return false; }
    setApiBase(base);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2000);
    try {
      const r = await fetch(`${base}/api/health`, { signal: ctl.signal });
      const ok = r.ok && !!(await r.json())?.status;
      setApiState(ok ? "online" : "offline");
      return ok;
    } catch {
      setApiState("offline"); // one quiet probe; no retry loop
      return false;
    } finally { clearTimeout(timer); }
  }, [apiBase]);
  useEffect(() => { if (apiBase !== null) void recheckApi(apiBase); /* single startup probe */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => { // multi-tab: adopt a valid save written by another tab (a reset in one tab wins everywhere)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SAVE_KEY && e.key !== null) return;
      try { const raw = safeStorage()?.getItem(SAVE_KEY); setProgress(raw ? validateProgress(JSON.parse(raw)) : emptyProgress()); } catch { /* ignore corrupt writes */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const go = useCallback((to: GameState) => {
    if (canGo(stateRef.current, to)) setS(to); else console.error(`illegal transition ${stateRef.current} -> ${to}`);
  }, []);

  const resetAttempt = (m: Json | null) => {
    setW(m ? newWallet(m) : null); setHistory([]); setLast(null); setSolvedBoth({}); setNotice(null); setLastSpend(null); nRef.current = 0;
  };

  const selectMission = (id: string) => {
    const m = data?.missions.find((x: Json) => x.id === id);
    if (!m || !isUnlocked(progress, m)) { setNotice(`Mission ${id} is locked`); return; }
    if (!canGo(stateRef.current, "mission_briefing")) return;
    setS("mission_briefing");
    missionRef.current = m; setMission(m); resetAttempt(m);
  };
  const begin = () => { if (walletRef.current) go("strategy_configuration"); };

  const reject = (msg: string): null => { setNotice(msg); return null; };

  /** Atomically (a) validate (b) charge (c) record. Re-entrancy safe: the state flips before any other work. */
  const execute = (key: string, build: () => { out: Json; units: Record<string, number> } | string): Json | null => {
    const m = missionRef.current, w = walletRef.current;
    if (!m || !w || stateRef.current !== "strategy_configuration") return reject("Start the mission first.");
    const built = build();
    if (typeof built === "string") return reject(built);
    let credits: number;
    try { credits = creditCost(built.units); } catch (e) { return reject(String(e instanceof Error ? e.message : e)); }
    const err = canAfford(w, built.units, credits);
    if (err) return reject(err);
    setS("experiment_execution"); // lock: any second call in this tick is refused above
    setW(charge(w, built.units, credits));
    setNotice(null);
    nRef.current += 1;
    const n = nRef.current;
    setLastSpend({ n, credits, units: built.units });
    setHistory((h) => [...h, { key, outcome: built.out, n }]);
    setLast(built.out);
    setS("scientific_analysis");
    return built.out;
  };

  const run = (key: string): Json | null => {
    const m = missionRef.current;
    if (!m) return reject("Start the mission first.");
    return execute(key, () => {
      const out = m.outcomes[key];
      if (!out) return `Action '${key}' is not part of this mission's executed action space`;
      if (out.feasible === false) return out.reason ?? "infeasible action";
      let result = out;
      if (m.kind === "repetition") {
        const s: Record<string, boolean> = { ...solvedRef.current, [out.instance]: !!out.success || !!solvedRef.current[out.instance] };
        setSolvedBoth(s);
        const req = m.ui.instances.filter((i: Json) => i.required).map((i: Json) => i.id);
        result = { ...out, mission_success: req.every((i: string) => s[i]) };
      }
      return { out: result, units: outcomeUnits(m, out) };
    });
  };

  const submitCorrection = (instanceId: string, chosen: number[]): Json | null => {
    const m = missionRef.current;
    if (!m) return null;
    return execute(`decode:${instanceId}`, () => {
      const inst = m.ui.instances.find((i: Json) => i.id === instanceId);
      const ref = m.reference.instances.find((i: Json) => i.id === instanceId);
      if (!inst || !ref) return `unknown instance ${instanceId}`;
      const ev = evaluateCorrection(inst.edges, inst.events, chosen, ref.hidden_logical_flip);
      const mode = m.ui.mode;
      const res: Json = { ...ev, mwpm_cost: ref.mwpm_cost, mwpm_logical_correct: ref.mwpm_logical === ref.hidden_logical_flip, instance: instanceId };
      res.success = mode === "reproduce" ? ev.valid && ev.clears_syndrome && (ev.path_cost ?? 1e9) <= ref.mwpm_cost + 1e-9 : ev.valid && !!ev.logically_correct;
      res.score = ev.valid
        ? Math.round(10 * 100 * (0.6 * (ev.logically_correct ? 1 : 0) + 0.2 * (ev.clears_syndrome ? 1 : 0) + 0.2 * Math.max(0, 1 - Math.max(0, (ev.path_cost ?? 0) - ref.mwpm_cost) / 3))) / 10
        : 0;
      res.explanation = correctionFeedback(res);
      res.reference_revealed = { hidden_logical_flip: ref.hidden_logical_flip, mwpm_edges: ref.mwpm_edges, equivalent: ref.equivalent_correct_example,
                                 logical_trap: ref.syndrome_clearing_but_logically_wrong_example, class_probabilities: ref.class_probabilities };
      const s: Record<string, boolean> = { ...solvedRef.current, [instanceId]: !!res.success || !!solvedRef.current[instanceId] };
      setSolvedBoth(s);
      res.mission_success = m.ui.instances.map((i: Json) => i.id).every((i: string) => s[i]);
      return { out: res, units: {} };
    });
  };

  const submitDiagnosis = (selected: string[]): Json | null => {
    const m = missionRef.current;
    if (!m) return null;
    return execute("diagnose", () => {
      const cons: Record<string, boolean> = m.reference.consistent;
      const truth = Object.keys(cons).filter((k) => cons[k]);
      const tp = selected.filter((s) => cons[s]).length;
      const precision = selected.length ? tp / selected.length : 0;
      const recall = truth.length ? tp / truth.length : 1;
      const ok = selected.length === truth.length && tp === truth.length;
      return {
        units: {}, out: {
          precision, recall, success: ok, score: Math.round(10 * 100 * (precision + recall) / 2) / 10,
          revealed: { hidden_fault: m.reference.hidden_fault_id, hidden_outcome: m.reference.hidden_outcome, syndromes: m.reference.syndromes },
          explanation: {
            plain: ok ? "Every location whose fault flips exactly the fired checks is consistent with the alarm." : "Some selected locations do not produce this syndrome, or some consistent locations were missed.",
            scientific: "A fault flips a check iff it anticommutes with that check's flow at that spacetime location.",
            math: "Syndrome bit j = x-component (final Pauli) on ancilla j after Pauli propagation.", refs: ["research/03_error_detection.md"],
          },
        },
      };
    });
  };

  const continuePlaying = () => { if (stateRef.current === "scientific_analysis") go("strategy_configuration"); };

  const finish = () => {
    const m = missionRef.current;
    if (stateRef.current !== "scientific_analysis" || !m) return;
    const lastOut = last;
    if (!lastOut) return;
    const multi = m.kind === "decoding" || m.kind === "repetition";
    const ok = multi ? !!lastOut.mission_success : !!lastOut.success;
    if (multi && !ok) { go("strategy_configuration"); return; }
    setProgress((p) => {
      const rec = p.completed[m.id] ?? { best_score: 0, attempts: 0 };
      const next = { ...rec, attempts: rec.attempts + 1, best_score: ok ? Math.max(rec.best_score, lastOut.score ?? 0) : rec.best_score };
      if (!ok) return { ...p, failures: { ...p.failures, [m.id]: (p.failures[m.id] ?? 0) + 1 } };
      return { ...p, completed: { ...p.completed, [m.id]: next }, tutorial_done: p.tutorial_done || m.id === "A4" };
    });
    go(ok ? "mission_success" : "mission_failure");
  };

  const restart = () => {
    const m = missionRef.current;
    if (!m) return;
    resetAttempt(m);
    const cur = stateRef.current;
    if (cur === "mission_success" || cur === "mission_failure" || cur === "scientific_analysis") setS("strategy_configuration");
  };

  /** Leave the current mission for the map (confirmation is the UI's job); attempt state is dropped. */
  const leaveMission = () => {
    const cur = stateRef.current;
    if (cur === "mission_briefing" || cur === "mission_success" || cur === "mission_failure" || cur === "replay") setS("district_selection");
    else if (cur === "strategy_configuration") { setS("mission_briefing"); setS("district_selection"); }
    else if (cur === "scientific_analysis") { setS("strategy_configuration"); setS("mission_briefing"); setS("district_selection"); }
    missionRef.current = null; setMission(null); resetAttempt(null);
  };

  const resetCampaign = () => {
    const fresh = emptyProgress();
    setProgress(fresh);
    saveProgress(fresh, safeStorage(), true); // an explicit reset replaces the stored save instead of merging
    missionRef.current = null; setMission(null); resetAttempt(null); setS("main_menu");
  };
  const setDifficulty = (d: Progress["difficulty"]) => setProgress((p) => ({ ...p, difficulty: d }));
  const unlocked = useCallback((m: Json) => isUnlocked(progress, m), [progress]);

  const value = useMemo<Ctx>(() => ({
    data, error, apiBase, apiState, apiAvailable: apiState === "online", recheckApi, state, progress, mission, wallet, history, last, solved, notice, lastSpend,
    go, selectMission, begin, run, submitCorrection, submitDiagnosis, continuePlaying, finish, restart, leaveMission, resetCampaign, setDifficulty, isUnlocked: unlocked,
  }), [data, error, apiBase, apiState, recheckApi, state, progress, mission, wallet, history, last, solved, notice, lastSpend, go, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
