# HIMARS Trajectory Trainer

A browser-based training simulator for a HIMARS-style 227 mm rocket. It models
the flight path, uses live weather at the launch site, presents the results in a
fire-control-style console and plots the predicted impact area on a map.

> **Educational simulation only.** Rocket parameters are approximations built
> from openly published figures (calibre, launch mass, nominal max range). They
> are not firing-table data. Guided munitions are not modelled.

## Running it

ES modules and a Web Worker need an HTTP origin (not `file://`):

```sh
cd himars-sim
python3 -m http.server 8000
# open http://localhost:8000
```

The map offers topographic, street and imagery tiles, plus a **GRID** layer: a
UTM/MGRS grid drawn locally that needs no tile server.

Setting `window.HIMARS_OFFLINE = true` before `js/app.js` loads switches to a
build for sandboxed hosts with no outside network. It uses the grid map only,
and takes live met as Open-Meteo JSON that you open via a link and paste in.
Ground altitude is then entered by hand.

Tests (Node 20+, no dependencies):

```sh
npm test
```

## Using the console

| Key | Action |
| --- | --- |
| **F1 LCHR** | next map click places the launcher |
| **F2 TGT** | next map click places the target (a plain click also does this) |
| **F3 MET** | refresh the met data |
| **F4 COMPUTE** | compute firing data, then run the Monte-Carlo impact area |
| **F5 FIT** | switch the map between the whole mission and the impact area |
| **F6 CLEAR** | clear the solution |

Positions can be typed as MGRS (`33V VH 31961 69011`) or as `lat, lon`. You can
drag the markers. Ground altitude is looked up automatically and can be
overwritten by hand.

**Met sources**
- **LIVE**: the [Open-Meteo](https://open-meteo.com) forecast column above the
  launcher for the current hour. That is surface temperature, pressure and wind,
  plus 19 pressure levels from 1000 to 30 hPa, each with geopotential height,
  temperature and wind. No API key is needed.
- **STD**: ICAO standard atmosphere with no wind.
- **MANUAL**: you enter surface values, which are extended upward using the
  standard lapse rate and a 1/7 power-law wind profile.

## Model

`js/ballistics.js` is a point-mass (3-DOF) model integrated with RK4. It uses
1 ms steps during the burn and 50 ms steps in the coast phase, which converge
to within a few metres. The model includes:

- **Launch rail:** the rocket is held to the launcher axis for the first 3.9 m.
- **Motor:** constant thrust from the rocket's Isp and burn time, with linear
  mass depletion.
- **Weathercocking:** while the motor burns, the fins turn the body axis (and
  so the thrust) toward the relative wind, over a distance of about 60 m.
- **Drag:** a Mach-dependent drag table, with base drag reduced while the motor
  burns. Drag acts on the velocity relative to the air, so wind is applied
  through drag.
- **Atmosphere:** density and speed of sound come from the met profile.
  Pressure is interpolated on a log scale; temperature and wind linearly. Above
  the highest level the ISA shape is used.
- **Gravity:** inverse-square on a spherical Earth, so Earth curvature is
  included.
- **Coriolis:** acceleration from Earth's rotation at the launcher latitude.

**Fire-control solution** (`solveFiringData`)
- Finds the max-range elevation by golden-section search, which gives the
  firing envelope.
- Solves quadrant elevation by regula falsi on the low- or high-angle branch.
- Iterates azimuth until the simulated impact is within about 0.5 m of the
  target.
- Repeats the solution in a standard atmosphere and reports the difference as
  the met correction.

**Impact area** (`dispersion`): a seeded Monte-Carlo run over these 1σ errors:

| Error source | 1σ |
| --- | --- |
| Total impulse | 0.6 % |
| Burn time | 1 % |
| Mass | 0.3 % |
| Drag | 2 % |
| Air density | 1 % |
| Wind | 1.5 m/s per component |
| Tip-off | 1.5 mil |

The run reports:
- mean point of impact (MPI)
- CEP about the MPI and about the aim point
- range and deflection probable errors
- 50 % and 95 % containment ellipses, which are drawn on the map

## Files

```
index.html        console layout
css/style.css     display styling
js/app.js         UI, Leaflet map, profile chart
js/worker.js      solver + Monte-Carlo off the UI thread
js/ballistics.js  rocket data, integrator, solver, dispersion
js/atmosphere.js  ISA, met profile interpolation
js/weather.js     Open-Meteo client
js/geo.js         great-circle, UTM/MGRS, mils
test/             node:test suite
```
