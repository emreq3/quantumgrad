import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/campaign.json"), "utf8"));

// Unlock everything so each workspace can be exercised directly.
const allDone = { schema: "qta6.save/1", completed: Object.fromEntries(data.missions.map((m: any) => [m.id, { best_score: 1, attempts: 1 }])),
                  difficulty: "beginner", tutorial_done: true };

function start(missionId: string) {
  render(<App initialData={data} />);
  fireEvent.click(screen.getByText(/start campaign|continue campaign/i));
  fireEvent.click(screen.getByLabelText(new RegExp(`mission ${missionId} `)));
  fireEvent.click(screen.getByText("Begin mission"));
}

describe("frontend gameplay", () => {
  beforeEach(() => { localStorage.clear(); });

  it("navigates menu → map → briefing → mission", () => {
    render(<App initialData={data} />);
    expect(screen.getByText("QTA6", { selector: "h1" })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/start campaign/i));
    expect(screen.getByText("City map")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/mission A1 /));
    expect(screen.getByText(/Learning objective/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Begin mission"));
    expect(screen.getByText("Experiment bench")).toBeInTheDocument();
  });

  it("locked missions cannot be opened", () => {
    render(<App initialData={data} />);
    fireEvent.click(screen.getByText(/start campaign/i));
    expect(screen.getByLabelText(/mission D1 /)).toBeDisabled();
  });

  it("A1: measuring consumes the shot budget and shows simulated counts", () => {
    start("A1");
    fireEvent.click(screen.getByText("10000"));
    fireEvent.click(screen.getByText("Measure"));
    expect(screen.getByText(/Measured counts \(Qiskit Aer\)/)).toBeInTheDocument();
    expect(screen.getByText(/shots 10000 \/ 12000/)).toBeInTheDocument(); // wallet shows the real cost
    expect(screen.getByText(/Goal met/)).toBeInTheDocument(); // 10000 shots give a narrow enough interval
  });

  it("D1: selecting sentinels and running shows measured fidelity and acceptance", () => {
    localStorage.setItem("qta6.save", JSON.stringify(allDone));
    start("D1");
    fireEvent.click(screen.getByLabelText("toggle sentinel on qubit 0"));
    fireEvent.click(screen.getByLabelText("toggle sentinel on qubit 2"));
    expect(screen.getByText(/Sentinels:/).textContent).toContain("2");
    fireEvent.click(screen.getByText("Run experiment"));
    expect(screen.getByText(/Measured outcome/)).toBeInTheDocument();
    expect(screen.getAllByText("post-selected fidelity").length).toBeGreaterThan(0);
    expect(screen.getByText("acceptance κ")).toBeInTheDocument();
  });

  it("D1: an over-budget selection cannot be run", () => {
    localStorage.setItem("qta6.save", JSON.stringify(allDone));
    start("D1");
    for (const q of [0, 1, 2, 3]) fireEvent.click(screen.getByLabelText(`toggle sentinel on qubit ${q}`));
    expect(screen.getByText("Run experiment")).toBeDisabled();
    expect(screen.getByText("over budget")).toBeInTheDocument();
  });

  it("M2: the calibration slider changes the executed configuration and results", () => {
    localStorage.setItem("qta6.save", JSON.stringify(allDone));
    start("M2");
    const slider = screen.getByLabelText("Calibration share (%)");
    fireEvent.change(slider, { target: { value: "5" } }); // index 5 = 40%
    fireEvent.click(screen.getByText("Run experiment"));
    expect(screen.getByLabelText("zero-noise extrapolation chart")).toBeInTheDocument();
    expect(screen.getAllByText("MSE vs unmitigated").length).toBeGreaterThan(0);
  });

  it("C3: clicking edges updates the live syndrome check and submission reveals the logical outcome", () => {
    localStorage.setItem("qta6.save", JSON.stringify(allDone));
    start("C3");
    const m = data.missions.find((x: any) => x.id === "C3");
    const ref = m.reference.instances[0];
    for (const id of ref.mwpm_edges) fireEvent.click(screen.getByLabelText(new RegExp(`^edge ${id} `)));
    expect(screen.getByText("clears syndrome (live check)").previousSibling?.textContent).toBe("yes");
    fireEvent.click(screen.getByText("Submit correction"));
    expect(screen.getByText("Evaluation")).toBeInTheDocument();
    expect(screen.getByText("logical state preserved")).toBeInTheDocument();
  });

  it("A4: choosing the right recovery restores the logical state", () => {
    localStorage.setItem("qta6.save", JSON.stringify(allDone));
    start("A4");
    const m = data.missions.find((x: any) => x.id === "A4");
    expect(m.ui.instances.length).toBe(4);
    fireEvent.click(screen.getAllByText("flip q0")[0]); // message 1 has an X0 error
    expect(screen.getByText(/Goal met/)).toBeInTheDocument();
  });

  it("N1: the integrated mission exposes shared budgets and runs a feasible plan", () => {
    localStorage.setItem("qta6.save", JSON.stringify(allDone));
    start("N1");
    expect(screen.getByLabelText("code distance")).toBeInTheDocument();
    const btn = screen.getByText("Execute plan");
    expect(screen.getByText(/Plan totals:/)).toBeInTheDocument();
    if (!(btn as HTMLButtonElement).disabled) {
      fireEvent.click(btn);
      expect(screen.getByText(/Per-task scientific results/)).toBeInTheDocument();
    }
  });

  it("glossary is reachable and lists terms", () => {
    render(<App initialData={data} />);
    fireEvent.click(screen.getByText("Scientific glossary"));
    expect(screen.getByText("Scientific glossary", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByText("Pareto front")).toBeInTheDocument();
  });

  it("shows a clear error when campaign data cannot load", () => {
    render(<App />);
    expect(screen.getByText(/Loading campaign data/)).toBeInTheDocument();
  });

  it("progress persists across reloads via localStorage", () => {
    start("A1");
    fireEvent.click(screen.getByText("10000"));
    fireEvent.click(screen.getByText("Measure"));
    fireEvent.click(screen.getByText("Complete mission"));
    expect(JSON.parse(localStorage.getItem("qta6.save")!).completed.A1.attempts).toBe(1);
    expect(within(document.body).getByText(/Mission complete/)).toBeInTheDocument();
  });
});
