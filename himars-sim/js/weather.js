// Live met from Open-Meteo (free, no API key, CORS enabled): surface
// observations plus the pressure-level forecast column above the launcher,
// turned into a met profile for the atmosphere model.

import { windComponents } from './atmosphere.js';

export const PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100, 70, 50, 30];
const API = 'https://api.open-meteo.com/v1';

export function forecastUrl(lat, lon) {
  const vars = ['temperature_2m', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'relative_humidity_2m'];
  for (const p of PRESSURE_LEVELS) {
    vars.push(`temperature_${p}hPa`, `wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `geopotential_height_${p}hPa`);
  }
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: vars.join(','),
    wind_speed_unit: 'ms',
    timezone: 'GMT',
    past_days: '1',
    forecast_days: '2',
  });
  return `${API}/forecast?${q}`;
}

// Pick the hourly record nearest to `when` and build the profile.
export function parseForecast(json, when = new Date()) {
  const H = json.hourly;
  if (!H || !H.time) throw new Error('unexpected met response');
  const target = when.getTime();
  let idx = 0, bestDt = Infinity;
  H.time.forEach((t, i) => {
    const dt = Math.abs(Date.parse(t + 'Z') - target);
    if (dt < bestDt) { bestDt = dt; idx = i; }
  });
  const elevation = json.elevation ?? 0;
  const surface = {
    elevation,
    T: H.temperature_2m[idx] + 273.15,
    p: H.surface_pressure[idx] * 100,
    windSpeed: H.wind_speed_10m[idx],
    windDir: H.wind_direction_10m[idx],
    rh: H.relative_humidity_2m?.[idx] ?? null,
  };
  const sw = windComponents(surface.windDir, surface.windSpeed);
  const levels = [{ h: elevation, T: surface.T, p: surface.p, wu: sw.wu, wv: sw.wv, source: 'SFC' }];
  for (const p of PRESSURE_LEVELS) {
    const h = H[`geopotential_height_${p}hPa`]?.[idx];
    const T = H[`temperature_${p}hPa`]?.[idx];
    const ws = H[`wind_speed_${p}hPa`]?.[idx];
    const wd = H[`wind_direction_${p}hPa`]?.[idx];
    if ([h, T, ws, wd].some((v) => v === null || v === undefined || Number.isNaN(v))) continue;
    // Skip levels below or too close to the surface (they are extrapolated).
    if (h <= elevation + 20) continue;
    const { wu, wv } = windComponents(wd, ws);
    levels.push({ h, T: T + 273.15, p: p * 100, wu, wv, source: `${p}hPa` });
  }
  levels.sort((a, b) => a.h - b.h);
  return { validTime: H.time[idx] + 'Z', surface, levels };
}

export async function fetchMet(lat, lon, when = new Date()) {
  const res = await fetch(forecastUrl(lat, lon));
  if (!res.ok) throw new Error(`met service HTTP ${res.status}`);
  return parseForecast(await res.json(), when);
}

export async function fetchElevation(lat, lon) {
  const res = await fetch(`${API}/elevation?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}`);
  if (!res.ok) throw new Error(`elevation service HTTP ${res.status}`);
  const json = await res.json();
  return json.elevation?.[0] ?? 0;
}
