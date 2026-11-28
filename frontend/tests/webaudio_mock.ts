// A small fake of the Web Audio API: enough surface for the engine, recording what was created and scheduled. Time only moves when a test
// calls ctx.advance(). It checks WIRING and LIFECYCLE (what is scheduled, stopped, closed); it cannot judge sound, which is measured offline.
export class FakeParam {
  value = 0;
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime(v: number) { this.value = v; return this; }
  exponentialRampToValueAtTime(v: number) { this.value = v; return this; }
  setTargetAtTime(v: number) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
export class FakeNode {
  gain = new FakeParam(); frequency = new FakeParam(); detune = new FakeParam(); Q = new FakeParam(); delayTime = new FakeParam();
  threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam();
  type = ""; buffer: unknown = null; loop = false;
  startT: number | null = null; stopT: number | null = null; stopped = false; disconnected = false; kind = "node";
  private ended: (() => void)[] = [];
  connect(n: unknown) { return n; }
  disconnect() { this.disconnected = true; }
  addEventListener(type: string, fn: () => void) { if (type === "ended") this.ended.push(fn); }
  start(t?: number) { this.startT = t ?? 0; }
  stop(t?: number) { this.stopT = t ?? 0; this.stopped = true; }
  fireEnded() { this.ended.forEach((f) => f()); this.ended = []; }
}
export class FakeCtx {
  state = "suspended"; currentTime = 0; sampleRate = 8000; destination = new FakeNode(); closed = false; suspendCalls = 0; resumeCalls = 0;
  all: FakeNode[] = []; sources: FakeNode[] = [];
  private mk(kind: string, source = false) { const n = new FakeNode(); n.kind = kind; this.all.push(n); if (source) this.sources.push(n); return n; }
  createGain() { return this.mk("gain"); } createOscillator() { return this.mk("osc", true); } createBiquadFilter() { return this.mk("filter"); }
  createDynamicsCompressor() { return this.mk("comp"); } createConvolver() { return this.mk("conv"); } createDelay() { return this.mk("delay"); }
  createBufferSource() { return this.mk("bufsrc", true); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  async resume() { this.resumeCalls++; this.state = "running"; }
  async suspend() { this.suspendCalls++; this.state = "suspended"; }
  async close() { this.closed = true; this.state = "closed"; }
  /** Moves the audio clock forward and fires `ended` for every source whose stop time has passed (as a real context would). */
  advance(dt: number) { this.currentTime += dt; for (const s of this.sources) if (s.stopT !== null && s.stopT <= this.currentTime) s.fireEnded(); }
  get running() { return this.sources.filter((s) => s.startT !== null && !(s.stopT !== null && s.stopT <= this.currentTime)); }
}
