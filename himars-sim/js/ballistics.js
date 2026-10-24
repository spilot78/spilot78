// Point-mass (3-DOF) trajectory model for an unguided, fin-stabilised 227 mm
// artillery rocket, with thrust phase, mass depletion, Mach-dependent drag,
// first-order weathercocking into the relative wind during burn, inverse-square gravity
// on a spherical Earth and Coriolis acceleration.
//
// The rocket figures below are approximations built from openly published
// values (calibre, launch mass, nominal max range) with the motor and drag
// scale tuned so the standard-atmosphere max range matches the published
// figure. They are NOT official firing table data.

import { G0 } from './atmosphere.js';
import { R_EARTH, distanceBearing, destination } from './geo.js';

const DEG = Math.PI / 180;
const OMEGA_EARTH = 7.2921159e-5;

export const ROCKETS = {
  std: {
    id: 'std',
    name: '227MM UNGUIDED — STD',
    description: 'Unguided 227 mm rocket, ~32 km nominal max range (approximate public figures)',
    diameter: 0.227,
    massLaunch: 306,
    massProp: 102,
    burnTime: 1.8,
    isp: 235,
    cdScale: 1.25,
    railLength: 3.9,
  },
  er: {
    id: 'er',
    name: '227MM UNGUIDED — ER',
    description: 'Extended-range variant, ~45 km nominal max range (approximate public figures)',
    diameter: 0.227,
    massLaunch: 296,
    massProp: 118,
    burnTime: 2.2,
    isp: 240,
    cdScale: 1.32,
    railLength: 3.9,
  },
  prac: {
    id: 'prac',
    name: '227MM REDUCED-RANGE PRACTICE',
    description: 'Reduced-range training rocket, ~15 km max range (approximate)',
    diameter: 0.227,
    massLaunch: 290,
    massProp: 66,
    burnTime: 1.2,
    isp: 220,
    cdScale: 1.5,
    railLength: 3.9,
  },
};

// Zero-lift drag coefficient vs Mach for a slender finned rocket.
const CD_TABLE = [
  [0, 0.30], [0.6, 0.30], [0.8, 0.32], [0.95, 0.42], [1.05, 0.55], [1.2, 0.52],
  [1.5, 0.46], [2.0, 0.39], [2.5, 0.34], [3.0, 0.31], [4.0, 0.28], [6.0, 0.26],
];

export function dragCoefficient(mach) {
  if (mach <= CD_TABLE[0][0]) return CD_TABLE[0][1];
  for (let i = 1; i < CD_TABLE.length; i++) {
    if (mach <= CD_TABLE[i][0]) {
      const [m0, c0] = CD_TABLE[i - 1], [m1, c1] = CD_TABLE[i];
      return c0 + (mach - m0) / (m1 - m0) * (c1 - c0);
    }
  }
  return CD_TABLE[CD_TABLE.length - 1][1];
}

// Base drag drops while the motor is burning (exhaust fills the base wake).
const POWER_ON_DRAG_FACTOR = 0.85;

// Distance over which the fins swing the body axis into the relative wind
// (first-order model of the weathercocking response).
const WEATHERCOCK_LENGTH = 60;

function axpy(s, h, k) {
  const out = new Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s[i] + h * k[i];
  return out;
}

/**
 * Integrate one flight. Frame: local East-North-Up at the launcher, origin at
 * the launcher, Earth centre at (0, 0, -(R + launchAlt)).
 *
 * perturb (all optional) lets Monte-Carlo runs vary the round and conditions:
 *   impulse, burn, mass, cd, rho: multiplicative factors
 *   dAz, dEl: launch angle errors (rad)
 *   du, dv: wind offset (m/s, toward east/north)
 */
export function simulate({
  rocket, atmosphere, lat, launchAlt, az, el, targetAlt = launchAlt,
  perturb = {}, record = false, dtBurn = 0.001, dtCoast = 0.05, maxTime = 400,
}) {
  const impulseF = perturb.impulse ?? 1;
  const burnF = perturb.burn ?? 1;
  const massF = perturb.mass ?? 1;
  const cdF = perturb.cd ?? 1;
  const rhoF = perturb.rho ?? 1;
  const du = perturb.du ?? 0, dv = perturb.dv ?? 0;

  const area = Math.PI * rocket.diameter ** 2 / 4;
  const m0 = rocket.massLaunch * massF;
  const mp = rocket.massProp;
  const tb = rocket.burnTime * burnF;
  const thrust = rocket.isp * G0 * mp * impulseF / tb;
  const mdot = mp / tb;
  const cdScale = rocket.cdScale * cdF;
  const Rc = R_EARTH + launchAlt;

  const azR = az * DEG + (perturb.dAz ?? 0);
  const elR = el * DEG + (perturb.dEl ?? 0);
  const axis = [Math.cos(elR) * Math.sin(azR), Math.cos(elR) * Math.cos(azR), Math.sin(elR)];

  const phi = lat * DEG;
  const Oy = OMEGA_EARTH * Math.cos(phi), Oz = OMEGA_EARTH * Math.sin(phi);

  const altitude = (x, y, z) => Math.sqrt(x * x + y * y + (z + Rc) ** 2) - R_EARTH;

  function deriv(t, s, onRail) {
    const [x, y, z, vx, vy, vz, bx, by, bz] = s;
    const r = Math.sqrt(x * x + y * y + (z + Rc) ** 2);
    const h = r - R_EARTH;
    const air = atmosphere(h);
    const rho = air.rho * rhoF;
    const rvx = vx - air.wu - du, rvy = vy - air.wv - dv, rvz = vz;
    const vr = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
    const burning = t < tb;
    const m = m0 - mdot * Math.min(t, tb);
    const cd = dragCoefficient(vr / air.a) * cdScale * (burning ? POWER_ON_DRAG_FACTOR : 1);
    const dragK = vr > 0 ? 0.5 * rho * vr * cd * area / m : 0; // a_drag = -dragK * v_rel
    const g = G0 * (R_EARTH / r) ** 2;
    const gx = -g * x / r, gy = -g * y / r, gz = -g * (z + Rc) / r;
    const T = burning ? thrust / m : 0;

    let ax, ay, az_, dbx = 0, dby = 0, dbz = 0;
    if (onRail) {
      // Constrained to the launcher axis; launcher reacts everything else.
      const fx = T * axis[0] - dragK * rvx + gx;
      const fy = T * axis[1] - dragK * rvy + gy;
      const fz = T * axis[2] - dragK * rvz + gz;
      const along = Math.max(0, fx * axis[0] + fy * axis[1] + fz * axis[2]);
      ax = along * axis[0]; ay = along * axis[1]; az_ = along * axis[2];
    } else {
      // Thrust acts along the body axis b, which the fins turn toward the
      // relative wind at a rate proportional to airspeed.
      const bn = Math.sqrt(bx * bx + by * by + bz * bz);
      const tx = bx / bn, ty = by / bn, tz = bz / bn;
      if (burning && vr > 0) {
        const ux = rvx / vr, uy = rvy / vr, uz = rvz / vr;
        const dot = ux * tx + uy * ty + uz * tz;
        const k = vr / WEATHERCOCK_LENGTH;
        dbx = k * (ux - dot * tx); dby = k * (uy - dot * ty); dbz = k * (uz - dot * tz);
      }
      // Coriolis: -2 Omega x v, Omega = (0, Oy, Oz) in ENU.
      const cx = -2 * (Oy * vz - Oz * vy);
      const cy = -2 * (Oz * vx);
      const cz = -2 * (-Oy * vx);
      ax = T * tx - dragK * rvx + gx + cx;
      ay = T * ty - dragK * rvy + gy + cy;
      az_ = T * tz - dragK * rvz + gz + cz;
    }
    return [vx, vy, vz, ax, ay, az_, dbx, dby, dbz];
  }

  let s = [0, 0, 0, 0, 0, 0, axis[0], axis[1], axis[2]];
  let t = 0;
  let apogee = launchAlt, maxMach = 0, burnout = null;
  const path = record ? [{ t: 0, x: 0, y: 0, h: launchAlt, v: 0, mach: 0 }] : null;
  let recordTimer = 0;

  while (t < maxTime) {
    const onRail = (s[0] * axis[0] + s[1] * axis[1] + s[2] * axis[2]) < rocket.railLength && t < tb;
    // Land the step exactly on burnout so the thrust cut-off is resolved.
    let dt = t < tb ? Math.min(onRail ? dtBurn / 10 : dtBurn, tb - t) : dtCoast;
    if (dt < 1e-9) dt = dtBurn;

    const k1 = deriv(t, s, onRail);
    const k2 = deriv(t + 0.5 * dt, axpy(s, 0.5 * dt, k1), onRail);
    const k3 = deriv(t + 0.5 * dt, axpy(s, 0.5 * dt, k2), onRail);
    const k4 = deriv(t + dt, axpy(s, dt, k3), onRail);
    const next = new Array(9);
    for (let i = 0; i < 9; i++) next[i] = s[i] + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    const tNext = t + dt;

    const hPrev = altitude(s[0], s[1], s[2]);
    const hNext = altitude(next[0], next[1], next[2]);
    const speed = Math.hypot(next[3], next[4], next[5]);
    const air = atmosphere(hNext);
    maxMach = Math.max(maxMach, speed / air.a);
    if (hNext > apogee) apogee = hNext;
    if (burnout === null && tNext >= tb - 1e-9) {
      burnout = { t: tNext, v: speed, h: hNext };
    }

    // Impact: crossing the target altitude on the way down, after burnout.
    if (tNext > tb && hNext <= targetAlt && hNext < hPrev) {
      const f = (hPrev - targetAlt) / (hPrev - hNext);
      const fin = s.map((v, i) => v + f * (next[i] - v));
      const tof = t + f * dt;
      if (record) path.push(pathPoint(tof, fin, targetAlt, air.a));
      return finish(fin, tof);
    }
    s = next;
    t = tNext;
    if (record) {
      recordTimer += dt;
      if (recordTimer >= (t <= tb ? 0.05 : 0.25)) {
        recordTimer = 0;
        path.push(pathPoint(t, s, hNext, air.a));
      }
    }
  }
  return null; // did not come down within maxTime

  function pathPoint(time, st, h, a) {
    const v = Math.hypot(st[3], st[4], st[5]);
    return { t: time, x: st[0], y: st[1], h, v, mach: v / a };
  }

  function finish(st, tof) {
    const [x, y, z, vx, vy, vz] = st;
    const horiz = Math.hypot(x, y);
    const theta = Math.atan2(horiz, z + Rc);
    const ground = R_EARTH * theta;
    const bearing = (Math.atan2(x, y) / DEG + 360) % 360;
    const r = Math.sqrt(x * x + y * y + (z + Rc) ** 2);
    const up = [x / r, y / r, (z + Rc) / r];
    const v = Math.hypot(vx, vy, vz);
    const fall = Math.asin(-(vx * up[0] + vy * up[1] + vz * up[2]) / v) / DEG;
    return {
      ground, bearing, tof, apogee, maxMach, burnout,
      impactVelocity: v, angleOfFall: fall, path,
    };
  }
}

// ---------------------------------------------------------------------------
// Fire-control solution: find azimuth and quadrant elevation that put the
// mean trajectory on the target, accounting for met, Earth curvature/rotation.

function goldenMax(f, a, b, tol) {
  const gr = (Math.sqrt(5) - 1) / 2;
  let c = b - gr * (b - a), d = a + gr * (b - a);
  let fc = f(c), fd = f(d);
  while (b - a > tol) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
  }
  const x = (a + b) / 2;
  return { x, fx: f(x) };
}

// Illinois-modified regula falsi on a bracketed root.
function solveRoot(f, a, b, fa, fb, tolX, maxIter = 40) {
  let side = 0;
  for (let i = 0; i < maxIter; i++) {
    const c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c);
    if (Math.abs(fc) < 0.25 || Math.abs(b - a) < tolX) return c;
    if (fc * fb > 0) {
      b = c; fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c; fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
  }
  return (a * fb - b * fa) / (fb - fa);
}

export const EL_LIMITS = { min: 8, max: 80 };

export function solveFiringData({ rocket, atmosphere, launcher, target, angle = 'low' }) {
  const geo = distanceBearing(launcher.lat, launcher.lon, target.lat, target.lon);
  const base = { rocket, atmosphere, lat: launcher.lat, launchAlt: launcher.alt, targetAlt: target.alt };
  const shoot = (az, el) => simulate({ ...base, az, el });
  const rangeAt = (az, el) => {
    const r = shoot(az, el);
    return r ? r.ground : 0;
  };

  const best = goldenMax((el) => rangeAt(geo.bearing, el), 20, 65, 0.05);
  const elMaxRange = best.x;
  const maxRange = best.fx;
  const minRange = angle === 'low'
    ? rangeAt(geo.bearing, EL_LIMITS.min)
    : rangeAt(geo.bearing, EL_LIMITS.max);

  const envelope = { maxRange, minRange, elMaxRange };
  if (geo.distance > maxRange) {
    return { ok: false, reason: 'TARGET BEYOND MAX RANGE', geo, envelope };
  }
  if (geo.distance < minRange) {
    return { ok: false, reason: 'TARGET INSIDE MIN RANGE', geo, envelope };
  }

  const [elLo, elHi] = angle === 'low' ? [EL_LIMITS.min, elMaxRange] : [elMaxRange, EL_LIMITS.max];
  const solveEl = (az) => {
    const f = (el) => rangeAt(az, el) - geo.distance;
    const fa = f(elLo), fb = f(elHi);
    if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? elLo : elHi;
    return solveRoot(f, elLo, elHi, fa, fb, 1e-5);
  };

  let az = geo.bearing;
  let el = solveEl(az);
  let result = null;
  for (let iter = 0; iter < 10; iter++) {
    result = shoot(az, el);
    let dBearing = ((geo.bearing - result.bearing + 540) % 360) - 180;
    const cross = dBearing * DEG * geo.distance;
    const along = result.ground - geo.distance;
    if (Math.abs(cross) < 0.5 && Math.abs(along) < 0.5) break;
    az = (az + dBearing + 360) % 360;
    el = solveEl(az);
  }

  result = simulate({ ...base, az, el, record: true });
  const impact = destination(launcher.lat, launcher.lon, result.bearing, result.ground);
  const miss = distanceBearing(target.lat, target.lon, impact.lat, impact.lon).distance;
  return { ok: true, az, el, geo, envelope, trajectory: result, impact, miss };
}

// ---------------------------------------------------------------------------
// Monte-Carlo dispersion about a firing solution.

export const DEFAULT_ERRORS = {
  impulse: 0.006,   // 1-sigma fractional total impulse
  burn: 0.01,       // burn time
  mass: 0.003,      // launch mass
  cd: 0.02,         // drag coefficient
  rho: 0.01,        // air density error of the met message
  wind: 1.5,        // wind error per component (m/s)
  tipOff: 1.5,      // launch tip-off / pointing error (mils)
};

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export function dispersion({
  rocket, atmosphere, launcher, target, az, el, n = 200, seed = 1, errors = DEFAULT_ERRORS, onProgress,
}) {
  const rand = mulberry32(seed);
  const mil = 2 * Math.PI / 6400;
  const impacts = [];
  for (let i = 0; i < n; i++) {
    const perturb = {
      impulse: 1 + errors.impulse * gaussian(rand),
      burn: 1 + errors.burn * gaussian(rand),
      mass: 1 + errors.mass * gaussian(rand),
      cd: 1 + errors.cd * gaussian(rand),
      rho: 1 + errors.rho * gaussian(rand),
      du: errors.wind * gaussian(rand),
      dv: errors.wind * gaussian(rand),
      dAz: errors.tipOff * mil * gaussian(rand),
      dEl: errors.tipOff * mil * gaussian(rand),
    };
    const r = simulate({
      rocket, atmosphere, lat: launcher.lat, launchAlt: launcher.alt, targetAlt: target.alt, az, el, perturb,
    });
    if (!r) continue;
    const p = destination(launcher.lat, launcher.lon, r.bearing, r.ground);
    const off = distanceBearing(target.lat, target.lon, p.lat, p.lon);
    impacts.push({
      lat: p.lat, lon: p.lon,
      e: off.distance * Math.sin(off.bearing * DEG),
      n: off.distance * Math.cos(off.bearing * DEG),
    });
    if (onProgress && i % 20 === 0) onProgress(i / n);
  }
  return { impacts, stats: dispersionStats(impacts, target, launcher) };
}

export function dispersionStats(impacts, target, launcher) {
  const N = impacts.length;
  const me = impacts.reduce((s, p) => s + p.e, 0) / N;
  const mn = impacts.reduce((s, p) => s + p.n, 0) / N;
  let see = 0, snn = 0, sen = 0;
  for (const p of impacts) {
    see += (p.e - me) ** 2; snn += (p.n - mn) ** 2; sen += (p.e - me) * (p.n - mn);
  }
  see /= N - 1; snn /= N - 1; sen /= N - 1;
  // Principal axes of the covariance ellipse.
  const tr = see + snn, det = see * snn - sen * sen;
  const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  const rot = 0.5 * Math.atan2(2 * sen, see - snn); // angle of major axis from east, CCW
  const majorBearing = ((90 - rot / DEG) % 180 + 180) % 180;

  // Range / deflection components in the line of fire at the target.
  const back = distanceBearing(target.lat, target.lon, launcher.lat, launcher.lon).bearing;
  const lof = ((back + 180) % 360) * DEG;
  const ux = Math.sin(lof), uy = Math.cos(lof);
  let sr = 0, sd = 0;
  for (const p of impacts) {
    const de = p.e - me, dn = p.n - mn;
    sr += (de * ux + dn * uy) ** 2;
    sd += (de * uy - dn * ux) ** 2;
  }
  const sigRange = Math.sqrt(sr / (N - 1)), sigDefl = Math.sqrt(sd / (N - 1));
  const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  const cepMpi = median(impacts.map((p) => Math.hypot(p.e - me, p.n - mn)));
  const cepAim = median(impacts.map((p) => Math.hypot(p.e, p.n)));
  return {
    count: N,
    mpi: { e: me, n: mn },
    sigmaMajor: Math.sqrt(l1), sigmaMinor: Math.sqrt(l2),
    majorBearing, rotation: rot,
    sigRange, sigDefl,
    peRange: 0.6745 * sigRange, peDefl: 0.6745 * sigDefl,
    cepMpi, cepAim,
  };
}
