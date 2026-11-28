// The extrapolation MODEL that the engine applied, re-evaluated for drawing only. The reported estimate always comes from the
// Python engine; a unit test checks that these curves pass through that estimate at zero noise for every exported outcome.
export function lagrange(xs: number[], ys: number[], x: number): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    let t = ys[i];
    for (let j = 0; j < xs.length; j++) if (j !== i) t *= (x - xs[j]) / (xs[i] - xs[j]);
    s += t;
  }
  return s;
}

export function leastSquaresLine(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** Richardson = polynomial interpolation through all measured points; "linear" = least-squares line through them. */
export function modelAt(extrap: string, xs: number[], ys: number[], x: number): number {
  if (xs.length === 1) return ys[0];
  if (extrap === "linear") { const { a, b } = leastSquaresLine(xs, ys); return a + b * x; }
  return lagrange(xs, ys, x);
}
export const modelName = (extrap: string, n: number): string =>
  n === 1 ? "single noise level — no extrapolation" : extrap === "linear" ? "least-squares line through the measured points" : `degree-${n - 1} polynomial through the measured points (Richardson)`;
