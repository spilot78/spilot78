// Geodesy helpers: spherical great-circle math, WGS84 UTM and MGRS.

export const R_EARTH = 6371008.8;
const DEG = Math.PI / 180;

export const MILS = 6400; // NATO mils per circle
export const degToMils = (d) => d * MILS / 360;
export const milsToDeg = (m) => m * 360 / MILS;

export function distanceBearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const bearing = (Math.atan2(y, x) / DEG + 360) % 360;
  return { distance, bearing };
}

export function destination(lat, lon, bearingDeg, distance) {
  const d = distance / R_EARTH, b = bearingDeg * DEG, p1 = lat * DEG, l1 = lon * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 / DEG, lon: ((l2 / DEG + 540) % 360) - 180 };
}

// Local east/north offsets (m) around a point -> lat/lon (small areas only).
export function offsetToLatLon(lat, lon, east, north) {
  const dist = Math.hypot(east, north);
  if (dist === 0) return { lat, lon };
  return destination(lat, lon, Math.atan2(east, north) / DEG, dist);
}

// ---- WGS84 UTM (Snyder series, sub-metre within a zone) ----
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), EP2 = E2 / (1 - E2), K0 = 0.9996;

function utmZone(lat, lon) {
  let zone = Math.floor((lon + 180) / 6) + 1;
  if (zone > 60) zone = 60;
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
  if (lat >= 72 && lat < 84) {
    if (lon >= 0 && lon < 9) zone = 31;
    else if (lon >= 9 && lon < 21) zone = 33;
    else if (lon >= 21 && lon < 33) zone = 35;
    else if (lon >= 33 && lon < 42) zone = 37;
  }
  return zone;
}

function meridionalArc(phi) {
  const e4 = E2 * E2, e6 = e4 * E2;
  return A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
}

export function toUTM(lat, lon, forceZone = null) {
  const zone = forceZone ?? utmZone(lat, lon);
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const phi = lat * DEG;
  const N = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = EP2 * Math.cos(phi) ** 2;
  const Aa = Math.cos(phi) * (lon - lon0) * DEG;
  const M = meridionalArc(phi);
  const easting = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
  let northing = K0 * (M + N * Math.tan(phi) * (Aa * Aa / 2
    + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
  if (lat < 0) northing += 10000000;
  return { zone, easting, northing, south: lat < 0 };
}

export function fromUTM(zone, easting, northing, south) {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const M = (northing - (south ? 10000000 : 0)) / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - E2 * s * s);
  const T1 = t * t;
  const C1 = EP2 * c * c;
  const R1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5);
  const D = (easting - 500000) / (N1 * K0);
  const lat = phi1 - (N1 * t / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const lon = lon0 * DEG + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / c;
  return { lat: lat / DEG, lon: lon / DEG };
}

// ---- MGRS ----
const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
const COL_SETS = ['STUVWXYZ', 'ABCDEFGH', 'JKLMNPQR']; // index = zone % 3
const ROWS = 'ABCDEFGHJKLMNPQRSTUV';

export function toMGRS(lat, lon, digits = 5) {
  if (lat < -80 || lat > 84) throw new Error('MGRS polar regions (UPS) not supported');
  const { zone, easting, northing } = toUTM(lat, lon);
  const band = BANDS[Math.min(Math.floor((lat + 80) / 8), 19)];
  const col = COL_SETS[zone % 3][Math.floor(easting / 100000) - 1];
  const row = ROWS[(Math.floor(northing / 100000) + (zone % 2 === 0 ? 5 : 0)) % 20];
  const div = 10 ** (5 - digits);
  const e = String(Math.floor((easting % 100000) / div)).padStart(digits, '0');
  const n = String(Math.floor((northing % 100000) / div)).padStart(digits, '0');
  return `${zone}${band} ${col}${row} ${e} ${n}`;
}

export function fromMGRS(str) {
  const s = str.toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/);
  if (!m) throw new Error('invalid MGRS');
  const zone = parseInt(m[1], 10);
  const band = m[2];
  const digits = m[5];
  if (digits.length % 2 !== 0 || digits.length > 10) throw new Error('invalid MGRS digits');
  const half = digits.length / 2;
  const scale = 10 ** (5 - half);
  // Centre of the stated precision square.
  const eIn = half ? parseInt(digits.slice(0, half), 10) * scale + scale / 2 : 50000;
  const nIn = half ? parseInt(digits.slice(half), 10) * scale + scale / 2 : 50000;
  const colIdx = COL_SETS[zone % 3].indexOf(m[3]);
  const rowIdx = ROWS.indexOf(m[4]);
  if (colIdx < 0 || rowIdx < 0) throw new Error('invalid MGRS square');
  const easting = (colIdx + 1) * 100000 + eIn;
  let northing = ((rowIdx - (zone % 2 === 0 ? 5 : 0) + 20) % 20) * 100000 + nIn;
  const bandIdx = BANDS.indexOf(band);
  const south = bandIdx < 10;
  const bandLat = -80 + bandIdx * 8;
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const minN = toUTM(bandLat, lon0, zone).northing;
  while (northing < minN - 100000) northing += 2000000;
  return fromUTM(zone, easting, northing, south);
}

// Accept "lat, lon" decimal degrees or an MGRS string.
export function parsePosition(text) {
  const t = text.trim();
  const ll = t.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (ll) {
    const lat = parseFloat(ll[1]), lon = parseFloat(ll[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('lat/lon out of range');
    return { lat, lon };
  }
  return fromMGRS(t);
}
