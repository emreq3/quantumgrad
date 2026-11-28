// Narrative layer of QTA6. Everything here is ORIGINAL fiction written for this project. Quantum City is a work of science fiction:
// contemporary quantum computers do not run cities. The physics behind each mission is real (see the scientific documentation);
// the characters and events are not. Mission data (numbers, outcomes) never comes from this file.

export type CharacterId = "valcourt" | "vale" | "castellanos" | "ndiaye" | "brandt" | "tessaly";

export interface Character {
  id: CharacterId; name: string; title: string; district: string; color: string; accent: string; style: string; specialty: string;
  intro: string[]; campaign: string[]; hair: "short" | "bun" | "curls" | "cap" | "bald" | "long"; glasses: boolean;
}

export const CAST: Record<CharacterId, Character> = {
  valcourt: { id: "valcourt", name: "Prof. Inés Valcourt", title: "Quantum Academy instructor", district: "academy", color: "#FFC3A0", accent: "#FF8A45",
    style: "Patient and Socratic; answers questions with better questions.", specialty: "Measurement, statistics and the three-qubit repetition code.",
    intro: ["Welcome to the Academy, engineer. The network is failing district by district, and nobody trusts a repair that nobody understands.",
            "We start small: one qubit, one measurement. Ask the data what it knows — and how sure it is."],
    campaign: ["Good. You are asking about uncertainty before asking for answers. Keep that habit.", "The Academy lights are back. The other districts need you more than I do."],
    hair: "bun", glasses: true },
  vale: { id: "vale", name: "Dr. Soren Vale", title: "Neon Labs research director", district: "neon_labs", color: "#00E5FF", accent: "#8B5CF6",
    style: "Dry, precise, allergic to hand-waving. Quotes numbers, not adjectives.", specialty: "Spacetime Pauli checks, post-selection and Clifford+T circuits.",
    intro: ["Neon Labs runs circuits that cannot afford a silent fault. We add sentinel qubits that watch the computation and veto it when they disagree.",
            "A veto costs shots. Always read the acceptance next to the fidelity."],
    campaign: ["Fidelity without acceptance is a magic trick. You reported both. Acceptable.", "Detection holds. Whatever slips past my sentinels, the next district has to measure honestly."],
    hair: "short", glasses: true },
  castellanos: { id: "castellanos", name: "Mira “Dial” Castellanos", title: "Sunset Bay calibration specialist", district: "sunset_bay", color: "#FF2D95", accent: "#FFC3A0",
    style: "Warm, quick, a little irreverent. Talks about shots like groceries.", specialty: "Readout calibration, zero-noise extrapolation and shot budgets.",
    intro: ["Sunset Bay is where the readings come in — and where they get corrupted. We do not repair the state here; we get a better estimate out of what we have.",
            "Every calibration shot is a signal shot you do not get. Spend wisely."],
    campaign: ["Nice. You noticed that a clever method can lose to doing nothing. That is not a failure, that is calibration.", "The bay is reading clean. Take the estimates north to Quantum Core."],
    hair: "curls", glasses: false },
  ndiaye: { id: "ndiaye", name: "Axel Ndiaye", title: "Quantum Core decoder engineer", district: "quantum_core", color: "#B69CFF", accent: "#00E5FF",
    style: "Terse; loves puzzles; will not say the answer first.", specialty: "Surface-code syndromes, matching decoders and logical errors.",
    intro: ["The Core keeps the city's logical memory. Physical qubits fail all the time; the code only needs us to find the pattern.",
            "Defects come in pairs, or they escape through a boundary. Connect them. Then check the logical qubit — a quiet alarm is not the same as a saved qubit."],
    campaign: ["You connected defects and still checked the logical outcome. Good instincts.", "The Core is stable. Distance, time and decoder speed — all costs. The Harbor will tell you how to pay."],
    hair: "cap", glasses: false },
  brandt: { id: "brandt", name: "Capt. Odalys Brandt", title: "Circuit Harbor resource coordinator", district: "circuit_harbor", color: "#FF8A45", accent: "#00E5FF",
    style: "Gruff, logistical, fair. Everything is a manifest.", specialty: "Resource budgets, Pareto fronts and calibration drift.",
    intro: ["Harbor rules: nothing is free, nothing is stored forever, and last week's calibration is last week's.",
            "You will get a budget of qubits, gates and shots. Spend it on the plan that dominates — or explain why you did not."],
    campaign: ["You priced the plan before running it. That is what keeps ships afloat.", "Manifest signed. Nexus Central is calling — they want all three pillars on one budget."],
    hair: "long", glasses: false },
  tessaly: { id: "tessaly", name: "Commander Ravi Tessaly", title: "Nexus Central operations commander", district: "nexus_central", color: "#FF6B8B", accent: "#FFC3A0",
    style: "Calm under pressure; speaks in short, ordered sentences.", specialty: "Integrated operations across detection, mitigation and correction.",
    intro: ["Network status: unstable. Six districts, one shared budget, no second attempt on the same budget.",
            "Detection for the first subsystem. Mitigation for the second. A code for the logical memory. Then we execute — once."],
    campaign: ["Whatever happens next, the numbers you produced are real simulation results. Read them before you celebrate or despair."],
    hair: "short", glasses: false },
};

export interface DistrictArt { id: string; tagline: string; color: string; accent: string; character: CharacterId; arc: string; }
export const DISTRICT_ART: Record<string, DistrictArt> = {
  academy: { id: "academy", tagline: "Warm evening light over the campus where every engineer starts.", color: "#FFC3A0", accent: "#FF8A45", character: "valcourt", arc: "Learn to read noisy measurements." },
  neon_labs: { id: "neon_labs", tagline: "Laboratory towers humming in cyan and violet.", color: "#00E5FF", accent: "#8B5CF6", character: "vale", arc: "Detect faults you cannot see." },
  sunset_bay: { id: "sunset_bay", tagline: "A pink-and-orange waterfront of measurement stations.", color: "#FF2D95", accent: "#FF8A45", character: "castellanos", arc: "Recover clean estimates from corrupted readings." },
  quantum_core: { id: "quantum_core", tagline: "Server towers behind a lattice of stabilizers.", color: "#B69CFF", accent: "#00E5FF", character: "ndiaye", arc: "Protect a logical qubit by decoding syndromes." },
  circuit_harbor: { id: "circuit_harbor", tagline: "Neon cargo cranes and a very strict ledger.", color: "#FF8A45", accent: "#00E5FF", character: "brandt", arc: "Spend limited qubits, gates and shots wisely." },
  nexus_central: { id: "nexus_central", tagline: "The downtown tower that ties the network together.", color: "#FF6B8B", accent: "#FFC3A0", character: "tessaly", arc: "Restore the whole network on one budget." },
};

export const WORLD = {
  city: "Quantum City",
  prologue: "Quantum City runs on a distributed network of experimental quantum processors. Tonight the network shows nonsense: corrupted readings, faults nobody can locate, memories that decay. Six districts. One failing quantum network. You are the engineer who has to understand why — and fix it with the budget you are given.",
  disclaimer: "QTA6 is a work of science fiction. No contemporary quantum computer operates a city's infrastructure. The characters, places and events are fictional; the noise models are synthetic game scenarios and are not measurements of any real device; every number you see comes from a simulation run by the project's scientific engine.",
  broadcast: ["QUANTUM NETWORK OFFLINE", "Six districts. One failing quantum network."],
};

export interface MissionNarrative { speaker: CharacterId; scenario: string; brief: string; success: string; failure: string; hint?: string }
const N = (speaker: CharacterId, scenario: string, brief: string, success: string, failure: string, hint?: string): MissionNarrative => ({ speaker, scenario, brief, success, failure, hint });

export const MISSION_NARRATIVE: Record<string, MissionNarrative> = {
  A1: N("valcourt", "A street-light controller in the Academy courtyard keeps reporting the wrong state.", "One qubit, one question: how often does it flip? A single measurement proves nothing — but how many do you need before you can trust the answer?", "You asked the data for evidence and got it. That is the whole craft.", "Not enough shots, or too many wasted. Measure, then ask how wide your uncertainty is.", "Statistical error shrinks like 1/√shots: ten times the shots, about three times narrower."),
  A2: N("valcourt", "A lab qubit in superposition is quietly losing its phase.", "Some errors are invisible in the basis you are looking at. Choose where to look.", "Right basis, right conclusion. A Z-readout cannot see a Z error on |+⟩.", "Your readout was blind to the error you were hunting. Try the other basis.", "A phase (Z) error flips |+⟩ to |−⟩, which only an X-basis measurement distinguishes."),
  A3: N("valcourt", "Two entangled qubits that should always agree have started to disagree.", "Entangled qubits agree in several bases at once. Find the correlation that noise broke.", "You found which correlation noise damaged — and quantified it.", "The correlation you measured is not the one that carries the damage. Compare ZZ, XX and YY.", "A perfect Bell pair has ⟨ZZ⟩ = 1, ⟨XX⟩ = 1 and ⟨YY⟩ = −1."),
  A4: N("valcourt", "A message is stored in three qubits and one of them has been hit.", "Read the syndrome — two parity checks — and decide which qubit to flip back. The code corrects one bit-flip, not everything.", "Recovered. The code worked because it measured parities, not the message itself.", "Your recovery did not match what the syndrome pointed at.", "The syndrome (Z0Z1, Z1Z2) = (1,0) points at qubit 0; (1,1) at qubit 1; (0,1) at qubit 2."),
  D1: N("vale", "A four-qubit core circuit in Neon Labs must run without silent faults.", "Pick which qubits get a sentinel. The Paulice search builds the checks; we discard any shot where a sentinel fires.", "Sentinels placed, fidelity up, acceptance acceptable. Note what the veto cost you.", "Either the checks did not beat the unprotected circuit, or too many shots were vetoed.", "Doing nothing is a legitimate configuration — but this mission asks for a measurable gain."),
  D2: N("vale", "The lab's ancilla stock is limited and every check costs two-qubit gates.", "More sentinels are not automatically better. Find the point where one more stops paying for itself.", "Enough protection, not too much. The budget thanks you.", "You overspent resources or lost too many shots for too little fidelity.", "Compare added gates and acceptance, not just the fidelity."),
  D3: N("vale", "An alarm fired, one sentinel reads FIRED and nobody knows why.", "A fault hit the circuit somewhere. Which single faults would raise exactly this alarm? There may be several.", "Every consistent location identified. Detection tells you something fired — not always where.", "Your list included a location that cannot cause this alarm, or missed one that can.", "A fault trips a check only if it anticommutes with what that check monitors at that point in time."),
  D4: N("vale", "Non-Clifford T gates have been added to the circuit.", "Checks that are valid for Clifford circuits can break once T gates arrive. Place them where the checks still make sense.", "Compatible placement, valid checks, real gain. Do not generalise beyond this circuit.", "A check was invalidated by an incompatible T gate, or the gain vanished.", "The invalid-check case is shown on purpose: an arbitrary Clifford check does not protect an arbitrary non-Clifford circuit."),
  D5: N("vale", "A very shallow circuit and a tempting set of sentinels.", "Protection is not free: the checks run on noisy hardware too. In a shallow circuit they can add more noise than they remove.", "You declined to intervene when intervention hurt. That is an engineering result, not a defeat.", "Your protection lowered the fidelity or cost too much acceptance. Compare it with doing nothing.", "The fidelity of the checks themselves is part of the experiment."),
  D6: N("vale", "The final detection brief: high fidelity, decent acceptance, tight budget.", "Hit the fidelity target without discarding more than half of your shots, within three ancillas.", "Target met inside the budget. Report the acceptance, always.", "One of three limits failed: fidelity, acceptance, or budget.", "Use the Pareto view: not every configuration trades fidelity for acceptance equally."),
  M1: N("castellanos", "Readings from the bay stations are consistently biased.", "The readout itself lies: sometimes a 0 is read as 1 and vice versa. Calibrate it and invert the lie.", "Calibration paid for itself. The estimate is closer to the truth.", "The calibration cost more than it gave, or it was too thin to trust.", "More calibration shots means a better matrix but fewer signal shots."),
  M2: N("castellanos", "A fixed budget of 8000 shots at a measurement station.", "Split it between calibration and signal. Too little calibration and the correction is noise; too much and the signal starves.", "A well-balanced split. Estimation error is the target, not the state.", "Your split left the estimate noisier than needed.", "Look for the sweet spot — the best share is neither the smallest nor the largest."),
  M3: N("castellanos", "Gate noise biases the result in a way readout calibration cannot touch.", "Amplify the noise on purpose, measure at several strengths, and extrapolate back to zero noise.", "Bias down. Remember what you paid for it: variance.", "Not enough noise points, or an extrapolation that did not cut the bias.", "Mitigation improves the estimate; it does not repair the quantum state."),
  M4: N("castellanos", "Only 2000 shots, and a tempting high-order extrapolation.", "With few shots, a fancy extrapolation amplifies statistical noise. Sometimes the best strategy is the plain one.", "You chose the strategy the budget could afford. Restraint is a technique.", "Your extrapolation cost more variance than it removed bias.", "Compare MSE, not bias alone: MSE = bias² + variance."),
  M5: N("castellanos", "You do not know how noisy each circuit variant is.", "Spend a small pilot to learn where the variance lives, then allocate the rest. The pilot is not free.", "Adaptive allocation earned its pilot cost this time. It does not always.", "The pilot cost more than the allocation saved. Try a different pilot size.", "At small budgets adaptive allocation can lose to plain uniform allocation."),
  M6: N("castellanos", "The bay's most demanding estimation job.", "Combine calibration, extrapolation and allocation under one shot budget — and beat the target error.", "Precision target met on a fair budget. Well calibrated.", "The combination did not beat the unmitigated baseline by enough.", "Every strategy here gets exactly the same total shots; compare like with like."),
  C1: N("ndiaye", "A repetition-code memory in the Core's test rack, damaged again.", "Read each syndrome and choose the recovery. Warm-up for the real code.", "Clean recoveries. Now for the surface code.", "A recovery did not match its syndrome.", "Same table as the Academy: the syndrome points at the flipped qubit."),
  C2: N("ndiaye", "A distance-3 rotated surface code, drawn as a lattice.", "Data qubits flip; neighbouring stabilizers light up. Reproduce the alarm pattern with the fewest flips.", "Alarm reproduced. You see how errors become defects.", "The alarm pattern is not reproduced, or it costs more flips than needed.", "Each data-qubit flip toggles the stabilizers next to it; boundary qubits touch only one."),
  C3: N("ndiaye", "Stabilizers have fired and nobody knows which qubits flipped.", "Connect the defects with corrections. You do not need the exact error — only an equivalent one.", "Syndrome cleared and the logical qubit survived.", "Either defects remain, or your correction changed the logical qubit.", "Clearing the syndrome is necessary, not sufficient."),
  C4: N("ndiaye", "Only one defect is visible. Where is its partner?", "A defect can escape through a boundary. Use the edges that leave the lattice.", "Boundary used correctly.", "The correction left the lone defect or flipped the logical qubit.", "Boundary edges connect a defect to the outside of the lattice."),
  C5: N("ndiaye", "Two corrections both silence every alarm. Only one saves the qubit.", "A quiet syndrome is not a saved logical qubit. Pick the correction in the right logical class.", "You picked the class that preserved the logical state.", "Syndrome cleared, logical qubit destroyed — the trap.", "Corrections that differ by a logical operator cannot be told apart by the syndrome."),
  C6: N("ndiaye", "A bigger code protects better — and costs more qubits and more time.", "Pick the distance that meets the logical-error target inside the qubit budget.", "The smallest code that does the job, inside the budget.", "Too small to protect, or too big to afford.", "Compare logical failure with its confidence interval, not just the point estimate."),
  C7: N("ndiaye", "Measurements can lie, so defects now live in space and time.", "A flipped measurement creates two defects in consecutive rounds. Connect them across time.", "Space and time connected.", "A time-like error was left unmatched.", "Vertical edges are measurement errors; horizontal edges are data-qubit errors."),
  C8: N("ndiaye", "A distance-5 code and the decoder everyone relies on.", "Submit your correction, then compare it with minimum-weight perfect matching.", "You and the decoder agree on the logical outcome.", "Your correction changed the logical qubit.", "MWPM is not infallible; compare costs and outcomes."),
  O1: N("brandt", "Two spare qubits and a fidelity target.", "Choose the protection that meets the target without exceeding the manifest.", "Within budget, on the front.", "Over budget or below target.", "Only Pareto-efficient plans are worth shipping."),
  O2: N("brandt", "Last week's calibration is on the ledger. Today the device has drifted.", "Strategies ranked on old data may no longer be the best. Decide whether a fresh calibration is worth its shots.", "Your choice held up under the true noise.", "Your plan was far from the best available under today's noise.", "A robust choice is rarely the winner on stale data and rarely the loser either."),
  O3: N("brandt", "Sixteen candidate protections, one manifest.", "Select a candidate that no other candidate dominates.", "Efficient. Nothing on the list beats you on every axis.", "A candidate on the list dominates your choice.", "Dominated means worse or equal on every objective and strictly worse on one."),
  O4: N("brandt", "Two systems, one budget: detection and mitigation.", "Pick a plan for both under the same shots and credits.", "Both systems served.", "One of the two systems misses its target, or the plan exceeds the budget.", "Detection shots grow as acceptance falls: fewer vetoes leave more shots for the lab."),
  N1: N("tessaly", "Nexus Central. City-wide blackout in progress.", "Detection, mitigation, error correction — one shared budget and one execution. Plan carefully.", "The network is restored. The numbers behind it are real; study them.", "The network is only partly restored. Review which subsystem fell short and try again.", "Each subsystem is scored by its own metric; the shared budget is what couples them."),
};

export interface N1Stage { id: string; title: string; text: string }
export const N1_STAGES: N1Stage[] = [
  { id: "alert", title: "Emergency briefing", text: "Quantum network instability is spreading from the downtown tower. Inspect the available hardware and the shared budget before committing anything." },
  { id: "detect", title: "Subsystem 1 — detection", text: "Choose how many sentinels guard the first subsystem and on which qubits. More sentinels raise fidelity and lower acceptance." },
  { id: "mitigate", title: "Subsystem 2 — mitigation", text: "Choose a mitigation strategy and a shot allocation for the estimation task. It must fit what detection leaves over." },
  { id: "correct", title: "Subsystem 3 — logical memory", text: "Choose the surface-code distance that protects the logical memory within the qubit budget." },
  { id: "review", title: "Review and execute", text: "One execution per budget. Each subsystem is evaluated separately against its own scientific target." },
  { id: "outcome", title: "Network status", text: "" },
];

export const ENDINGS = {
  success: "All three subsystems met their targets inside the shared budget. Quantum City's network comes back district by district.",
  partial: "Part of the network is back. At least one subsystem missed its scientific target — the status board shows which one.",
  failure: "The shared budget did not stretch far enough. Review the per-subsystem results, then retry with a different plan.",
};

export const speaker = (missionId: string): Character => CAST[MISSION_NARRATIVE[missionId]?.speaker ?? "valcourt"];
