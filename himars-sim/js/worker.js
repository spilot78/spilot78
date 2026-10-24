// Runs the solver and Monte-Carlo off the UI thread.
import { ROCKETS, solveFiringData, dispersion } from './ballistics.js';
import { makeAtmosphere, standardProfile } from './atmosphere.js';

self.onmessage = (ev) => {
  const { id, launcher, target, rocketId, levels, angle, samples } = ev.data;
  try {
    const rocket = ROCKETS[rocketId];
    const atmosphere = makeAtmosphere(levels);
    const t0 = performance.now();
    const sol = solveFiringData({ rocket, atmosphere, launcher, target, angle });
    if (!sol.ok) {
      self.postMessage({ id, type: 'solution', sol });
      return;
    }
    // Same mission in a standard atmosphere (surface pressure/temp kept):
    // the difference is the met correction.
    const std = makeAtmosphere(standardProfile({ elevation: launcher.alt }));
    const solStd = solveFiringData({ rocket, atmosphere: std, launcher, target, angle });
    sol.metCorrection = solStd.ok ? { az: sol.az - solStd.az, el: sol.el - solStd.el } : null;
    sol.computeMs = performance.now() - t0;
    self.postMessage({ id, type: 'solution', sol });

    const disp = dispersion({
      rocket, atmosphere, launcher, target, az: sol.az, el: sol.el, n: samples, seed: 1234,
      onProgress: (f) => self.postMessage({ id, type: 'progress', f }),
    });
    self.postMessage({ id, type: 'dispersion', disp });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err.message || err) });
  }
};
