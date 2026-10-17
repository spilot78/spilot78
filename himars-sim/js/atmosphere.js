// Atmosphere model: ISA baseline plus a measured/forecast met profile.
// A profile is a list of levels { h, T, p, wu, wv } sorted by height, where
// h = altitude MSL (m), T = temperature (K), p = pressure (Pa) and
// wu/wv = wind vector components the air moves TOWARD (east/north, m/s).

export const R_AIR = 287.05;
export const GAMMA = 1.4;
export const G0 = 9.80665;

const ISA_LAYERS = [
  // base altitude (m), base temp (K), lapse rate (K/m), base pressure (Pa)
  [0, 288.15, -0.0065, 101325],
  [11000, 216.65, 0, 22632.06],
  [20000, 216.65, 0.001, 5474.889],
  [32000, 228.65, 0.0028, 868.0187],
  [47000, 270.65, 0, 110.9063],
  [51000, 270.65, -0.0028, 66.93887],
  [71000, 214.65, -0.002, 3.956420],
];

export function isa(h) {
  let L = ISA_LAYERS[0];
  for (const layer of ISA_LAYERS) if (h >= layer[0]) L = layer;
  const [hb, Tb, lapse, pb] = L;
  const dh = h - hb;
  const T = Tb + lapse * dh;
  const p = lapse === 0
    ? pb * Math.exp(-G0 * dh / (R_AIR * Tb))
    : pb * Math.pow(T / Tb, -G0 / (lapse * R_AIR));
  return { T, p };
}

// Wind "from" direction (deg) + speed -> components the air moves toward.
export function windComponents(fromDeg, speed) {
  const toRad = (fromDeg + 180) * Math.PI / 180;
  return { wu: speed * Math.sin(toRad), wv: speed * Math.cos(toRad) };
}

export function windFrom(wu, wv) {
  const speed = Math.hypot(wu, wv);
  const dir = (Math.atan2(-wu, -wv) * 180 / Math.PI + 360) % 360;
  return { dir, speed };
}

// Build a profile from surface observations only: standard lapse rate,
// hydrostatic pressure, 1/7 power-law wind up to 1 km then constant.
export function standardProfile({ elevation = 0, T = null, p = null, windDir = 0, windSpeed = 0 } = {}) {
  const base = isa(elevation);
  const T0 = T ?? base.T;
  const p0 = p ?? base.p;
  const levels = [];
  for (let agl = 0; agl <= 30000; agl += agl < 2000 ? 250 : 1000) {
    const h = elevation + agl;
    const Tisa = isa(h).T - isa(elevation).T; // ISA shape, offset to surface temp
    const Tl = T0 + Tisa;
    const pl = p0 * isa(h).p / base.p;
    const scale = agl <= 10 ? 1 : Math.pow(Math.min(agl, 1000) / 10, 1 / 7);
    const { wu, wv } = windComponents(windDir, windSpeed * scale);
    levels.push({ h, T: Tl, p: pl, wu, wv });
  }
  return levels;
}

// Returns at(h) -> { T, p, rho, a, wu, wv } interpolating the profile,
// extending with ISA shape above the top and below the bottom level.
export function makeAtmosphere(levels) {
  const L = [...levels].sort((x, y) => x.h - y.h);
  if (L.length === 0) throw new Error('empty met profile');
  const top = L[L.length - 1];
  const bot = L[0];
  const isaTop = isa(top.h);
  const isaBot = isa(bot.h);
  const hs = L.map((l) => l.h);

  function find(h) {
    let lo = 0, hi = hs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (hs[mid] <= h) lo = mid; else hi = mid;
    }
    return lo;
  }

  return function at(h) {
    let T, p, wu, wv;
    if (h >= top.h) {
      const s = isa(h);
      T = top.T + (s.T - isaTop.T);
      p = top.p * s.p / isaTop.p;
      wu = top.wu; wv = top.wv;
    } else if (h <= bot.h) {
      const s = isa(h);
      T = bot.T + (s.T - isaBot.T);
      p = bot.p * s.p / isaBot.p;
      wu = bot.wu; wv = bot.wv;
    } else {
      const i = find(h);
      const a = L[i], b = L[i + 1];
      const f = (h - a.h) / (b.h - a.h);
      T = a.T + f * (b.T - a.T);
      p = Math.exp(Math.log(a.p) + f * (Math.log(b.p) - Math.log(a.p)));
      wu = a.wu + f * (b.wu - a.wu);
      wv = a.wv + f * (b.wv - a.wv);
    }
    const rho = p / (R_AIR * T);
    const sound = Math.sqrt(GAMMA * R_AIR * T);
    return { T, p, rho, a: sound, wu, wv };
  };
}
