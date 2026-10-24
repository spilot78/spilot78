import test from 'node:test';
import assert from 'node:assert/strict';

import { isa, makeAtmosphere, standardProfile, windComponents, windFrom } from '../js/atmosphere.js';
import { toMGRS, fromMGRS, parsePosition, distanceBearing, destination } from '../js/geo.js';
import { ROCKETS, simulate, solveFiringData, dispersion } from '../js/ballistics.js';
import { parseForecast, PRESSURE_LEVELS } from '../js/weather.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('ISA matches reference values', () => {
  near(isa(0).T, 288.15, 1e-9);
  near(isa(0).p, 101325, 1e-6);
  near(isa(11000).T, 216.65, 1e-9);
  near(isa(11000).p, 22632, 2);
  near(isa(20000).p, 5474.9, 1);
});

test('wind conventions round-trip (from-direction)', () => {
  const w = windComponents(270, 10); // wind from the west blows toward east
  near(w.wu, 10, 1e-9); near(w.wv, 0, 1e-9);
  const back = windFrom(w.wu, w.wv);
  near(back.dir, 270, 1e-9); near(back.speed, 10, 1e-9);
});

test('atmosphere interpolates and extends a profile', () => {
  const atm = makeAtmosphere(standardProfile({ elevation: 300 }));
  near(atm(300).p, isa(300).p, 1);
  near(atm(5000).T, isa(5000).T, 0.01);
  near(atm(40000).T, isa(40000).T, 0.01);
});

test('MGRS known point and round trips', () => {
  // Washington Monument, a standard USNG example.
  const wm = fromMGRS('18S UJ 23487 06483');
  assert.ok(distanceBearing(38.8895, -77.0352, wm.lat, wm.lon).distance < 3);
  assert.match(toMGRS(38.8895, -77.0352), /^18S UJ 2348\d 0648\d$/);
  for (const [lat, lon] of [[61.05, 13.74], [-33.86, 151.21], [0.5, 0.5], [64.1, -21.9], [-54.8, -68.3], [71.0, 25.8]]) {
    const p = fromMGRS(toMGRS(lat, lon));
    assert.ok(distanceBearing(lat, lon, p.lat, p.lon).distance < 1.5, `round trip ${lat},${lon}`);
  }
  const ll = parsePosition('61.05, 13.74');
  assert.deepEqual(ll, { lat: 61.05, lon: 13.74 });
  assert.throws(() => parsePosition('not a grid'));
});

test('great-circle destination inverts distance/bearing', () => {
  const d = destination(61, 14, 37, 30000);
  const g = distanceBearing(61, 14, d.lat, d.lon);
  near(g.distance, 30000, 0.01); near(g.bearing, 37, 1e-6);
});

const stdAtm = makeAtmosphere(standardProfile({ elevation: 0 }));

test('standard rocket max range is near its nominal 32 km', () => {
  let best = 0;
  for (let el = 40; el <= 60; el += 1) {
    best = Math.max(best, simulate({ rocket: ROCKETS.std, atmosphere: stdAtm, lat: 45, launchAlt: 0, az: 0, el }).ground);
  }
  near(best, 32000, 1000, 'max range');
});

test('tailwind extends range, headwind shortens it', () => {
  const run = (dir) => simulate({
    rocket: ROCKETS.std, lat: 45, launchAlt: 0, az: 0, el: 45,
    atmosphere: makeAtmosphere(standardProfile({ elevation: 0, windDir: dir, windSpeed: 10 })),
  }).ground;
  const calm = simulate({ rocket: ROCKETS.std, atmosphere: stdAtm, lat: 45, launchAlt: 0, az: 0, el: 45 }).ground;
  assert.ok(run(180) > calm, 'tailwind (from south, firing north)');
  assert.ok(run(0) < calm, 'headwind');
});

test('solver hits the target with live-like crosswind, low and high angle', () => {
  const atmosphere = makeAtmosphere(standardProfile({ elevation: 400, windDir: 270, windSpeed: 12 }));
  const launcher = { lat: 61.05, lon: 13.74, alt: 400 };
  const target = { lat: 61.26, lon: 13.86, alt: 520 };
  for (const angle of ['low', 'high']) {
    const sol = solveFiringData({ rocket: ROCKETS.std, atmosphere, launcher, target, angle });
    assert.ok(sol.ok, angle);
    assert.ok(sol.miss < 3, `${angle} miss ${sol.miss}`);
    assert.ok(Math.abs(sol.az - sol.geo.bearing) > 0.01, 'crosswind needs an azimuth correction');
  }
});

test('solver reports out-of-range targets', () => {
  const launcher = { lat: 61.05, lon: 13.74, alt: 400 };
  const far = { ...destination(61.05, 13.74, 10, 60000), alt: 400 };
  const sol = solveFiringData({ rocket: ROCKETS.std, atmosphere: stdAtm, launcher, target: far });
  assert.equal(sol.ok, false);
  assert.match(sol.reason, /MAX RANGE/);
});

test('Monte-Carlo dispersion is centred near the aimpoint and plausible in size', () => {
  const launcher = { lat: 61.05, lon: 13.74, alt: 0 };
  const target = { ...destination(61.05, 13.74, 20, 25000), alt: 0 };
  const sol = solveFiringData({ rocket: ROCKETS.std, atmosphere: stdAtm, launcher, target });
  const { stats } = dispersion({ rocket: ROCKETS.std, atmosphere: stdAtm, launcher, target, az: sol.az, el: sol.el, n: 120, seed: 7 });
  assert.equal(stats.count, 120);
  assert.ok(Math.hypot(stats.mpi.e, stats.mpi.n) < 0.4 * stats.sigmaMajor + 50, 'MPI near aim');
  assert.ok(stats.cepMpi > 20 && stats.cepMpi < 1500, `CEP ${stats.cepMpi}`);
  assert.ok(stats.sigRange > stats.sigDefl, 'range error dominates for an unguided rocket');
});

test('parses an Open-Meteo pressure-level response', () => {
  const hourly = {
    time: ['2026-10-17T11:00', '2026-10-17T12:00'],
    temperature_2m: [8, 9], surface_pressure: [960, 961], wind_speed_10m: [3, 4],
    wind_direction_10m: [250, 260], relative_humidity_2m: [70, 72],
  };
  PRESSURE_LEVELS.forEach((p, i) => {
    const h = 44330 * (1 - (p / 1013.25) ** 0.1903);
    hourly[`geopotential_height_${p}hPa`] = [h, h];
    hourly[`temperature_${p}hPa`] = [10 - h * 0.0065, 10 - h * 0.0065];
    hourly[`wind_speed_${p}hPa`] = [5 + i, 5 + i];
    hourly[`wind_direction_${p}hPa`] = [270, 270];
  });
  const met = parseForecast({ elevation: 420, hourly }, new Date('2026-10-17T12:10:00Z'));
  assert.equal(met.validTime, '2026-10-17T12:00Z');
  near(met.surface.p, 96100, 1e-9);
  assert.equal(met.levels[0].source, 'SFC');
  assert.ok(met.levels.every((l, i) => i === 0 || l.h > met.levels[i - 1].h), 'sorted');
  assert.ok(!met.levels.some((l) => l.source === '1000hPa'), 'below-ground level dropped');
  const atm = makeAtmosphere(met.levels);
  assert.ok(atm(5000).rho > 0.5 && atm(5000).rho < 0.9);
});
