import { ROCKETS } from './ballistics.js';
import { standardProfile, windFrom } from './atmosphere.js';
import {
  distanceBearing, offsetToLatLon, toMGRS, toUTM, fromUTM, parsePosition, degToMils,
} from './geo.js';
import { fetchMet, fetchElevation, forecastUrl, parseForecast } from './weather.js';

// Offline builds (e.g. a sandboxed page with no outside network) use the
// built-in grid map and take met as pasted Open-Meteo JSON.
const OFFLINE = Boolean(window.HIMARS_OFFLINE);

const $ = (id) => document.getElementById(id);

const state = {
  launcher: { lat: 61.0500, lon: 13.7400, alt: 420 },
  target: { lat: 61.2600, lon: 13.8600, alt: 520 },
  metSource: 'live',
  liveMet: null,
  pick: null, // 'launcher' | 'target' | null
  solution: null,
  dispersion: null,
  jobId: 0,
};

// ---------------------------------------------------------------- map
const map = L.map('map', { zoomControl: true, attributionControl: true });
const layers = {
  'TOPO': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
  }),
  'STREET': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors',
  }),
  'IMAGERY': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Tiles © Esri',
  }),
};
// UTM grid drawn locally on canvas tiles: works with no tile server at all.
const UtmGrid = L.GridLayer.extend({
  createTile(coords) {
    const size = this.getTileSize();
    const tile = document.createElement('canvas');
    tile.width = size.x; tile.height = size.y;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#0b130c';
    ctx.fillRect(0, 0, size.x, size.y);
    const origin = coords.scaleBy(size);
    const z = coords.z;
    const toLL = (px, py) => map.unproject([origin.x + px, origin.y + py], z);
    const toPx = (lat, lon) => map.project([lat, lon], z).subtract(origin);
    const c = toLL(size.x / 2, size.y / 2);
    if (Math.abs(c.lat) > 80) return tile;
    const zone = toUTM(c.lat, c.lng).zone;
    const south = c.lat < 0;
    const corners = [[0, 0], [size.x, 0], [0, size.y], [size.x, size.y]]
      .map(([x, y]) => { const ll = toLL(x, y); return toUTM(ll.lat, ll.lng, zone); });
    const minE = Math.min(...corners.map((u) => u.easting)), maxE = Math.max(...corners.map((u) => u.easting));
    const minN = Math.min(...corners.map((u) => u.northing)), maxN = Math.max(...corners.map((u) => u.northing));
    const step = z >= 12 ? 1000 : z >= 9 ? 10000 : 100000;
    const line = (pts, major) => {
      ctx.strokeStyle = major ? '#2f6b36' : '#183a1c';
      ctx.lineWidth = major ? 1.2 : 1;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    };
    const pt = (e, n) => { const ll = fromUTM(zone, e, n, south); return toPx(ll.lat, ll.lon); };
    const label = (v) => String(Math.round(v / 1000) % 100).padStart(2, '0');
    ctx.font = '10px IBM Plex Mono, monospace';
    ctx.fillStyle = '#4f8f55';
    for (let e = Math.floor(minE / step) * step; e <= maxE; e += step) {
      const pts = [0, 0.25, 0.5, 0.75, 1].map((f) => pt(e, minN + f * (maxN - minN)));
      line(pts, e % (step * 10) === 0);
      const top = pts.reduce((a, p) => (p.y < a.y ? p : a));
      if (step <= 10000) ctx.fillText(label(e), top.x + 2, 10);
    }
    for (let n = Math.floor(minN / step) * step; n <= maxN; n += step) {
      const pts = [0, 0.25, 0.5, 0.75, 1].map((f) => pt(minE + f * (maxE - minE), n));
      line(pts, n % (step * 10) === 0);
      const left = pts.reduce((a, p) => (p.x < a.x ? p : a));
      if (step <= 10000) ctx.fillText(label(n), 2, left.y - 2);
    }
    return tile;
  },
});
const grid = new UtmGrid({ attribution: 'UTM grid' });
if (OFFLINE) {
  grid.addTo(map);
} else {
  layers.GRID = grid;
  layers.TOPO.addTo(map);
  L.control.layers(layers, null, { position: 'topright' }).addTo(map);
}
L.control.scale({ imperial: false }).addTo(map);

const icon = (color) => L.divIcon({
  className: '',
  html: `<svg width="22" height="22" viewBox="0 0 22 22"><rect x="4" y="4" width="14" height="14" fill="none" stroke="${color}" stroke-width="2"/><circle cx="11" cy="11" r="2" fill="${color}"/></svg>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const lchrMarker = L.marker([0, 0], { icon: icon('#59d8ff'), draggable: true }).addTo(map)
  .bindTooltip('LCHR', { permanent: true, direction: 'right', className: 'lbl', offset: [10, 0] });
const tgtMarker = L.marker([0, 0], { icon: icon('#ff5a4a'), draggable: true }).addTo(map)
  .bindTooltip('TGT', { permanent: true, direction: 'right', className: 'lbl', offset: [10, 0] });
const lineOfFire = L.polyline([], { color: '#9cff9c', weight: 1, dashArray: '4 6', opacity: 0.7 }).addTo(map);
const overlay = L.layerGroup().addTo(map);

lchrMarker.on('dragend', () => setPoint('launcher', lchrMarker.getLatLng()));
tgtMarker.on('dragend', () => setPoint('target', tgtMarker.getLatLng()));
map.on('click', (e) => {
  const which = state.pick ?? 'target';
  setPick(null);
  setPoint(which, e.latlng);
});

// ---------------------------------------------------------------- ui helpers
function status(msg, kind = 'ok') {
  $('status').textContent = msg;
  $('led').className = 'led' + (kind === 'busy' ? ' busy' : kind === 'err' ? ' err' : '');
}

function setPick(which) {
  state.pick = which;
  $('kLchr').classList.toggle('armed', which === 'launcher');
  $('kTgt').classList.toggle('armed', which === 'target');
  map.getContainer().style.cursor = which ? 'crosshair' : '';
  if (which) status(`SELECT ${which === 'launcher' ? 'LAUNCHER' : 'TARGET'} POSITION ON MAP`);
}

const fmt = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v)) ? '--' : v.toFixed(d);
const mils = (deg) => fmt(((degToMils(deg) % 6400) + 6400) % 6400, 0).padStart(4, '0');
const signedMils = (deg) => { const m = degToMils(deg); return (m >= 0 ? '+' : '') + m.toFixed(1); };

function safeMGRS(p) {
  try { return toMGRS(p.lat, p.lon); } catch { return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`; }
}

function renderPoints() {
  const { launcher, target } = state;
  $('lchrPos').value = safeMGRS(launcher);
  $('tgtPos').value = safeMGRS(target);
  $('lchrAlt').value = Math.round(launcher.alt);
  $('tgtAlt').value = Math.round(target.alt);
  $('lchrLL').textContent = `${launcher.lat.toFixed(5)}, ${launcher.lon.toFixed(5)}`;
  $('tgtLL').textContent = `${target.lat.toFixed(5)}, ${target.lon.toFixed(5)}`;
  lchrMarker.setLatLng([launcher.lat, launcher.lon]);
  tgtMarker.setLatLng([target.lat, target.lon]);
  lineOfFire.setLatLngs([[launcher.lat, launcher.lon], [target.lat, target.lon]]);
  const g = distanceBearing(launcher.lat, launcher.lon, target.lat, target.lon);
  $('tgtRange').textContent = `${(g.distance / 1000).toFixed(2)} km`;
  $('tgtDir').textContent = `${mils(g.bearing)} mil`;
}

async function setPoint(which, latlng, { keepAlt = false } = {}) {
  const p = state[which];
  p.lat = latlng.lat;
  p.lon = ((latlng.lng ?? latlng.lon) + 540) % 360 - 180;
  clearSolution();
  renderPoints();
  if (!keepAlt && !OFFLINE) {
    try {
      p.alt = await fetchElevation(p.lat, p.lon);
      renderPoints();
    } catch {
      status('ELEVATION SERVICE UNAVAILABLE — ENTER ALT MANUALLY', 'err');
    }
  }
  if (which === 'launcher' && state.metSource === 'live') loadLiveMet();
}

function bindPositionInput(inputId, which) {
  const el = $(inputId);
  el.addEventListener('change', () => {
    try {
      const p = parsePosition(el.value);
      el.classList.remove('bad');
      setPoint(which, { lat: p.lat, lon: p.lon });
      if (!map.getBounds().contains([p.lat, p.lon])) fitMission();
    } catch (err) {
      el.classList.add('bad');
      status(`INVALID GRID: ${err.message.toUpperCase()}`, 'err');
    }
  });
}
bindPositionInput('lchrPos', 'launcher');
bindPositionInput('tgtPos', 'target');
$('lchrAlt').addEventListener('change', (e) => { state.launcher.alt = +e.target.value; clearSolution(); });
$('tgtAlt').addEventListener('change', (e) => { state.target.alt = +e.target.value; clearSolution(); });

// F5 alternates between the whole mission and the computed impact area.
function fitMission({ toggle = false } = {}) {
  if (toggle && state.dispersion && !state.fitImpact) {
    state.fitImpact = true;
    map.fitBounds(L.latLngBounds(ellipse(state.dispersion.stats, K95)).pad(0.3));
    return;
  }
  state.fitImpact = false;
  const b = L.latLngBounds([[state.launcher.lat, state.launcher.lon], [state.target.lat, state.target.lon]]);
  map.fitBounds(b.pad(0.25));
}

// ---------------------------------------------------------------- munition
for (const r of Object.values(ROCKETS)) {
  const o = document.createElement('option');
  o.value = r.id; o.textContent = r.name;
  $('munition').appendChild(o);
}
const updateMunitionNote = () => { $('munitionNote').textContent = ROCKETS[$('munition').value].description; };
$('munition').addEventListener('change', () => { updateMunitionNote(); clearSolution(); });
$('angle').addEventListener('change', clearSolution);
updateMunitionNote();

// ---------------------------------------------------------------- met
function currentLevels() {
  if (state.metSource === 'live' && state.liveMet) return state.liveMet.levels;
  if (state.metSource === 'manual') {
    return standardProfile({
      elevation: state.launcher.alt,
      T: +$('mT').value + 273.15,
      p: +$('mP').value * 100,
      windDir: +$('mWd').value,
      windSpeed: +$('mWs').value,
    });
  }
  return standardProfile({ elevation: state.launcher.alt });
}

function metTag() {
  const tag = $('metStatus');
  if (state.metSource === 'live' && state.liveMet) {
    tag.textContent = `MET: LIVE ${state.liveMet.validTime.slice(11, 16).replace(':', '')}Z`;
    tag.className = 'tag ok';
  } else if (state.metSource === 'manual') {
    tag.textContent = 'MET: MANUAL'; tag.className = 'tag warn';
  } else if (state.metSource === 'live') {
    tag.textContent = 'MET: NO DATA (STD)'; tag.className = 'tag err';
  } else {
    tag.textContent = 'MET: STD'; tag.className = 'tag warn';
  }
}

function renderMetTable() {
  const levels = currentLevels();
  const shown = state.metSource === 'live' && state.liveMet
    ? levels
    : levels.filter((l, i) => i % 2 === 0 || l.h - levels[0].h < 2000).slice(0, 24);
  $('metTable').querySelector('tbody').innerHTML = shown.map((l) => {
    const w = windFrom(l.wu, l.wv);
    return `<tr><td>${Math.round(l.h)}</td><td>${(l.T - 273.15).toFixed(1)}</td>`
      + `<td>${(l.p / 100).toFixed(1)}</td><td>${mils(w.dir)}</td><td>${w.speed.toFixed(1)}</td></tr>`;
  }).join('');
  $('metValid').textContent = state.metSource === 'live' && state.liveMet
    ? `VALID ${state.liveMet.validTime.replace('T', ' ')}` : state.metSource.toUpperCase();
  metTag();
}

async function loadLiveMet() {
  if (OFFLINE) {
    $('metLink').href = forecastUrl(state.launcher.lat, state.launcher.lon);
    return;
  }
  status('REQUESTING MET DATA…', 'busy');
  const { lat, lon } = state.launcher;
  try {
    state.liveMet = await fetchMet(lat, lon);
    const s = state.liveMet.surface;
    $('metNote').textContent = `Open-Meteo column, ${state.liveMet.levels.length} levels. `
      + `SFC ${(s.T - 273.15).toFixed(1)}°C ${(s.p / 100).toFixed(1)} hPa, wind ${Math.round(s.windDir)}° ${s.windSpeed.toFixed(1)} m/s.`;
    status('MET DATA RECEIVED');
  } catch (err) {
    state.liveMet = null;
    $('metNote').textContent = 'Live met unavailable — standard atmosphere in use.';
    status(`MET REQUEST FAILED: ${String(err.message).toUpperCase()}`, 'err');
  }
  clearSolution();
  renderMetTable();
}

$('metSource').addEventListener('click', (e) => {
  const src = e.target.dataset?.src;
  if (!src) return;
  state.metSource = src;
  for (const b of $('metSource').querySelectorAll('button')) b.classList.toggle('on', b.dataset.src === src);
  $('manualMet').classList.toggle('hidden', src !== 'manual');
  $('pasteMet').classList.toggle('hidden', !OFFLINE || src !== 'live');
  $('metNote').textContent = src === 'std' ? 'ICAO standard atmosphere, no wind.'
    : src === 'manual' ? 'Surface values extrapolated aloft (std lapse, 1/7 power-law wind).' : $('metNote').textContent;
  clearSolution();
  if (src === 'live' && !state.liveMet) loadLiveMet(); else renderMetTable();
});
for (const id of ['mT', 'mP', 'mWd', 'mWs']) {
  $(id).addEventListener('change', () => { clearSolution(); renderMetTable(); });
}

// ---------------------------------------------------------------- compute
function createWorker() {
  // A bundled single-file build carries the worker source inline.
  const inline = document.getElementById('worker-src');
  if (inline) {
    return new Worker(URL.createObjectURL(new Blob([inline.textContent], { type: 'text/javascript' })));
  }
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
const worker = createWorker();

function compute() {
  clearSolution(); // invalidates any job still running in the worker
  const id = ++state.jobId;
  status('COMPUTING FIRING DATA…', 'busy');
  $('kCompute').disabled = true;
  worker.postMessage({
    id,
    launcher: { ...state.launcher },
    target: { ...state.target },
    rocketId: $('munition').value,
    angle: $('angle').value,
    samples: +$('samples').value,
    levels: currentLevels(),
  });
}

worker.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.id !== state.jobId) return;
  if (msg.type === 'error') {
    $('kCompute').disabled = false;
    status(`COMPUTE ERROR: ${msg.message}`, 'err');
  } else if (msg.type === 'solution') {
    state.solution = msg.sol;
    renderSolution();
    if (!msg.sol.ok) $('kCompute').disabled = false;
  } else if (msg.type === 'progress') {
    $('mcProgress').textContent = `MC ${Math.round(msg.f * 100)}%`;
  } else if (msg.type === 'dispersion') {
    state.dispersion = msg.disp;
    $('kCompute').disabled = false;
    $('mcProgress').textContent = `${msg.disp.stats.count} RDS`;
    renderDispersion();
    status('MISSION COMPUTED — IMPACT AREA PLOTTED (F5 TO ZOOM)');
  }
};

function kv(el, rows) {
  el.innerHTML = rows.map(([k, v, hl]) => `<dt>${k}</dt><dd${hl ? ' class="hl"' : ''}>${v}</dd>`).join('');
}

function renderSolution() {
  const sol = state.solution;
  const env = sol.envelope;
  if (!sol.ok) {
    $('rAz').textContent = '----'; $('rQe').textContent = '----';
    $('alert').textContent = `${sol.reason} — ENVELOPE ${(env.minRange / 1000).toFixed(1)}–${(env.maxRange / 1000).toFixed(1)} km`;
    $('alert').classList.remove('hidden');
    kv($('firing'), [['RANGE', `${(sol.geo.distance / 1000).toFixed(2)} km`]]);
    status(sol.reason, 'err');
    return;
  }
  const t = sol.trajectory;
  $('alert').classList.add('hidden');
  $('rAz').textContent = mils(sol.az);
  $('rQe').textContent = mils(sol.el);
  $('solveTime').textContent = `${Math.round(sol.computeMs)} ms`;
  const mc = sol.metCorrection;
  kv($('firing'), [
    ['AZ / QE deg', `${sol.az.toFixed(2)}° / ${sol.el.toFixed(2)}°`],
    ['RANGE', `${(sol.geo.distance / 1000).toFixed(2)} km`],
    ['TIME OF FLIGHT', `${t.tof.toFixed(1)} s`, true],
    ['APOGEE', `${Math.round(t.apogee)} m MSL`],
    ['BURNOUT', `${Math.round(t.burnout.v)} m/s @ ${t.burnout.t.toFixed(2)} s`],
    ['MAX MACH', t.maxMach.toFixed(2)],
    ['IMPACT VEL', `${Math.round(t.impactVelocity)} m/s`],
    ['ANGLE OF FALL', `${t.angleOfFall.toFixed(1)}°`],
    ['MET CORR AZ', mc ? `${signedMils(mc.az)} mil` : '--'],
    ['MET CORR QE', mc ? `${signedMils(mc.el)} mil` : '--'],
    ['ENVELOPE', `${(env.minRange / 1000).toFixed(1)}–${(env.maxRange / 1000).toFixed(1)} km`],
    ['SOLUTION MISS', `${sol.miss.toFixed(1)} m`],
  ]);

  // Ground track on the map.
  const track = t.path.map((p) => {
    const ll = offsetToLatLon(state.launcher.lat, state.launcher.lon, p.x, p.y);
    return [ll.lat, ll.lon];
  });
  L.polyline(track, { color: '#ffb43b', weight: 2 }).addTo(overlay);
  drawProfile();
}

function ellipse(stats, k) {
  const pts = [];
  const a = stats.sigmaMajor * k, b = stats.sigmaMinor * k, rot = stats.rotation;
  for (let i = 0; i <= 72; i++) {
    const th = i / 72 * 2 * Math.PI;
    const x = a * Math.cos(th), y = b * Math.sin(th);
    const e = stats.mpi.e + x * Math.cos(rot) - y * Math.sin(rot);
    const n = stats.mpi.n + x * Math.sin(rot) + y * Math.cos(rot);
    const ll = offsetToLatLon(state.target.lat, state.target.lon, e, n);
    pts.push([ll.lat, ll.lon]);
  }
  return pts;
}

// Scale factors from 1-sigma to 50 % / 95 % containment of a 2-D normal.
const K50 = Math.sqrt(-2 * Math.log(0.5));
const K95 = Math.sqrt(-2 * Math.log(0.05));

function renderDispersion() {
  const { impacts, stats } = state.dispersion;
  for (const p of impacts) {
    L.circleMarker([p.lat, p.lon], { radius: 1.5, color: '#9cff9c', weight: 0, fillOpacity: 0.8 }).addTo(overlay);
  }
  L.polygon(ellipse(stats, K95), { color: '#ffb43b', weight: 1, dashArray: '5 4', fill: false }).addTo(overlay);
  L.polygon(ellipse(stats, K50), { color: '#ff5a4a', weight: 2, fillOpacity: 0.25 }).addTo(overlay);
  const mpi = offsetToLatLon(state.target.lat, state.target.lon, stats.mpi.e, stats.mpi.n);
  L.circleMarker([mpi.lat, mpi.lon], { radius: 4, color: '#ffb43b', weight: 2, fill: false })
    .bindTooltip('MPI', { permanent: true, direction: 'left', className: 'lbl', offset: [-6, 0] })
    .addTo(overlay);

  const mpiDist = Math.hypot(stats.mpi.e, stats.mpi.n);
  kv($('impact'), [
    ['MPI GRID', safeMGRS(mpi), true],
    ['MPI OFFSET', `${mpiDist.toFixed(0)} m`],
    ['CEP (ABOUT MPI)', `${stats.cepMpi.toFixed(0)} m`, true],
    ['CEP (ABOUT AIM)', `${stats.cepAim.toFixed(0)} m`],
    ['PE RANGE / DEFL', `${stats.peRange.toFixed(0)} / ${stats.peDefl.toFixed(0)} m`],
    ['50% ELLIPSE', `${(2 * K50 * stats.sigmaMajor).toFixed(0)} × ${(2 * K50 * stats.sigmaMinor).toFixed(0)} m`],
    ['95% ELLIPSE', `${(2 * K95 * stats.sigmaMajor).toFixed(0)} × ${(2 * K95 * stats.sigmaMinor).toFixed(0)} m`],
    ['MAJOR AXIS DIR', `${mils(stats.majorBearing)} mil`],
  ]);
}

function clearSolution() {
  state.jobId++;
  state.solution = null;
  state.dispersion = null;
  state.fitImpact = false;
  overlay.clearLayers();
  $('rAz').textContent = '----';
  $('rQe').textContent = '----';
  $('firing').innerHTML = '';
  $('impact').innerHTML = '';
  $('solveTime').textContent = '';
  $('mcProgress').textContent = '';
  $('alert').classList.add('hidden');
  $('kCompute').disabled = false;
  drawProfile();
}

// ---------------------------------------------------------------- profile chart
function drawProfile() {
  const cv = $('profile');
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px IBM Plex Mono, monospace';

  const sol = state.solution;
  const path = sol?.ok ? sol.trajectory.path : null;
  const maxX = path ? Math.max(...path.map((p) => Math.hypot(p.x, p.y))) / 1000 : 40;
  const maxY = path ? sol.trajectory.apogee / 1000 : 15;
  const niceStep = (span) => { const r = span / 6, p = 10 ** Math.floor(Math.log10(r)); return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= r); };
  const sx = niceStep(maxX), sy = niceStep(maxY);
  const xMax = Math.ceil(maxX / sx) * sx || 1, yMax = Math.ceil(maxY * 1.1 / sy) * sy || 1;
  const pad = { l: 40, r: 12, t: 10, b: 22 };
  const X = (v) => pad.l + v / xMax * (w - pad.l - pad.r);
  const Y = (v) => h - pad.b - v / yMax * (h - pad.t - pad.b);

  ctx.strokeStyle = '#163018'; ctx.fillStyle = '#4f8f55'; ctx.lineWidth = 1;
  for (let v = 0; v <= xMax + 1e-9; v += sx) {
    ctx.beginPath(); ctx.moveTo(X(v), Y(0)); ctx.lineTo(X(v), Y(yMax)); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText(`${+v.toFixed(1)}`, X(v), h - 8);
    ctx.textAlign = 'left';
  }
  for (let v = 0; v <= yMax + 1e-9; v += sy) {
    ctx.beginPath(); ctx.moveTo(X(0), Y(v)); ctx.lineTo(X(xMax), Y(v)); ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`${+v.toFixed(1)}`, pad.l - 6, Y(v) + 3);
    ctx.textAlign = 'left';
  }
  ctx.fillText('ALT km', pad.l + 4, pad.t + 10);
  ctx.textAlign = 'right';
  ctx.fillText('DOWNRANGE km', w - pad.r - 2, Y(0) - 4);
  ctx.textAlign = 'left';

  if (!path) {
    ctx.fillStyle = '#4f8f55';
    ctx.textAlign = 'center';
    ctx.fillText(sol && !sol.ok ? sol.reason : 'NO SOLUTION — PRESS COMPUTE', X(xMax / 2), Y(yMax / 2));
    ctx.textAlign = 'left';
    return;
  }
  // Burn phase in amber, coast in green.
  const tb = sol.trajectory.burnout.t;
  ctx.lineWidth = 2;
  for (const [color, sel] of [['#9cff9c', (p) => p.t >= tb - 0.06], ['#ffb43b', (p) => p.t <= tb + 0.06]]) {
    ctx.strokeStyle = color; ctx.beginPath();
    let started = false;
    for (const p of path) {
      if (!sel(p)) continue;
      const x = X(Math.hypot(p.x, p.y) / 1000), y = Y(p.h / 1000);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const apex = path.reduce((a, p) => (p.h > a.h ? p : a), path[0]);
  ctx.fillStyle = '#ffb43b';
  const ax = X(Math.hypot(apex.x, apex.y) / 1000), ay = Y(apex.h / 1000);
  ctx.beginPath(); ctx.arc(ax, ay, 3, 0, 2 * Math.PI); ctx.fill();
  ctx.fillText(`APOGEE ${Math.round(apex.h)} m  T+${apex.t.toFixed(0)} s`, Math.min(ax + 6, w - 190), ay - 6);
}
new ResizeObserver(drawProfile).observe($('profile'));

// ---------------------------------------------------------------- soft keys & clock
$('kLchr').addEventListener('click', () => setPick(state.pick === 'launcher' ? null : 'launcher'));
$('kTgt').addEventListener('click', () => setPick(state.pick === 'target' ? null : 'target'));
$('kMet').addEventListener('click', () => (state.metSource === 'live' ? loadLiveMet() : renderMetTable()));
$('kCompute').addEventListener('click', compute);
$('kFit').addEventListener('click', () => fitMission({ toggle: true }));
$('kClear').addEventListener('click', () => { clearSolution(); status('READY'); });

function tick() {
  const d = new Date();
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()];
  const p = (n) => String(n).padStart(2, '0');
  $('dtg').textContent = `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z ${mon} ${d.getUTCFullYear()}`;
}
setInterval(tick, 1000);
tick();

// ---------------------------------------------------------------- init
renderPoints();
fitMission();
if (OFFLINE) {
  $('pasteMet').classList.remove('hidden');
  $('metNote').textContent = 'Open the forecast link for the launcher position, copy the whole JSON page, and paste it below.';
  $('lchrAlt').title = $('tgtAlt').title = 'Enter ground altitude by hand in this build';
  $('metJson').addEventListener('input', () => {
    const text = $('metJson').value.trim();
    if (!text) return;
    try {
      state.liveMet = parseForecast(JSON.parse(text));
      if (state.liveMet.levels.length < 3) throw new Error('no pressure-level data');
      // The forecast grid cell's elevation is a good launcher altitude.
      state.launcher.alt = state.liveMet.surface.elevation;
      renderPoints();
      $('metJson').classList.remove('bad');
      status(`MET DATA LOADED — VALID ${state.liveMet.validTime.slice(11, 16).replace(':', '')}Z`);
    } catch (err) {
      state.liveMet = null;
      $('metJson').classList.add('bad');
      status(`MET JSON NOT RECOGNISED: ${String(err.message).toUpperCase()}`, 'err');
    }
    clearSolution();
    renderMetTable();
  });
}
renderMetTable();
loadLiveMet();
