# Gap Analysis Report — MIL-STD-2525 Military Map Web Application

**Date:** 2026-05-30  
**Analyst:** Military GIS / C2 Systems Analyst  
**Application file:** `index.html` (single-page, Google Maps canvas + sidebar)  
**Standard reference:** MIL-STD-2525C (primary), with notes on MIL-STD-2525D / APP-6C/D where applicable

---

## Executive Summary

The current prototype establishes a functional proof-of-concept: it can render a small set of MIL-STD-2525C unit symbols via `milsymbol` v2.2, allow drag-and-drop placement, and draw rudimentary tactical line/area graphics on a Google Maps canvas. However, it falls significantly short of what an operational military map tool requires in every dimension examined. The gaps range from missing the majority of the warfighting symbol catalogue and nearly all Appendix-B tactical graphics, through a complete absence of symbol modifier fields, layer/object management, export, and interoperability support, to deeper architectural concerns around performance, persistence, and map product fidelity. The report below itemises each gap, provides operational context, and prioritises remediation.

---

## 1. Symbol Coverage (Warfighting Symbols)

### 1.1 What Exists

The application exposes **25 unit symbol entries** across five hard-coded categories:

| Category | Symbols listed |
|---|---|
| Ground Combat | 8 (Infantry, Armor, FA, Recon, Engineer, ADA, Mech. Infantry, Anti-Tank, Mortar) |
| Command & Control | 3 (Generic HQ, HQ Infantry, HQ Armor) |
| Aviation | 5 (Fighter, Attack Helo, Utility Helo, Bomber, UAV) |
| Combat Service Support | 4 (Supply, Maintenance, Medical, Transportation) |
| Intelligence / ISR | 2 (OP, Radar) |

The SIDC strings are all from the **S** (Warfighting) scheme, land/air only. Affiliation is correctly parameterised with a `$` placeholder.

### 1.2 Missing Symbol Sets

MIL-STD-2525C Table A-II defines the following warfighting **symbol sets** (coding scheme `S`), none of which are covered beyond a token entry or two:

#### Ground Equipment & Vehicles
- Self-propelled artillery, towed artillery, rocket artillery
- Infantry fighting vehicles (IFV / BMP-class), armoured personnel carriers
- MLRS / HIMARS
- Engineering vehicles (breach, assault bridge, combat earthmover)
- Air defence: MANPADS, short-range SAM, medium-range SAM (SHORAD, FAAD)
- NBC / CBRN units and decontamination assets
- Electronic warfare (ECM/ECCM/SIGINT) — only `Radar` is present
- Military police
- Civil affairs, psychological operations (PSYOP)
- Special operations forces (SOF)
- Explosive ordnance disposal (EOD)

#### Naval / Maritime (Scheme `S`, function `W`)
- Surface combatants, amphibious ships, submarines, mine warfare
- Landing craft, logistics ships
- Naval fires (NGFS) — essential for joint ops overlays

#### Space Assets
- Satellites, satellite ground stations (scheme `S`, dimension `P`)

#### Signals Intelligence / Cyber
- SIGINT collection, jamming, cyber assets

#### Stability / COIN Overlays
- Irregular forces, paramilitary, civilian (scheme `S`, affiliation `J` — Joker, `K` — Faker, etc.)

#### Emergency Management (Scheme `E`)
- Incidents, infrastructure, disaster-response units — relevant for HADR scenarios

**Approximate coverage: ~5 % of the full MIL-STD-2525C warfighting symbol catalogue.**

---

## 2. Tactical Graphic Types (Appendix B)

### 2.1 What Exists

The application defines **16 tactical graphic entries** across three primitive geometry types:

- *Points (5):* Contact Point, Checkpoint, Start Point, Release Point, Rally Point
- *Lines (6):* Phase Line, Line of Departure, FLOT, Boundary, Axis of Advance, Direction of Attack
- *Areas (5):* Battle Position, Assembly Area, Engagement Area, Fire Support Area, Air Defense Area

These are rendered as plain Google Maps `Polyline`/`Polygon` objects with affiliation colour; they are **not** keyed to actual MIL-STD-2525C Appendix B SIDCs except for the five point graphics that attempt SIDC lookup via `milsymbol`.

### 2.2 Missing Tactical Graphics from Appendix B

MIL-STD-2525C Appendix B is organised into six functional groups. The gaps are extensive:

#### 2.2.1 Tasks (Annex B, Table B-I through B-V)
| Missing Graphic | SIDC prefix | Type |
|---|---|---|
| Attack by fire position | `GFTST` | Area |
| Support by fire position | `GFTSS` | Area |
| Limit of advance (LOA) | `GFTLL` | Line |
| Line of contact (LC) | `GFTLC` | Line |
| Final coordination line (FCL) | `GFTLF` | Line |
| Coordinated fire line (CFL) | `GFFSLA` | Line |
| No-fire line (NFL) | `GFFSLN` | Line |
| Restrictive fire line (RFL) | `GFFSLR` | Line |
| Infiltration lane | `GFTLI` | Line |
| Assault position | `GFTPA` | Area |
| Objective | `GFTPO` | Area |
| Consolidation / reorganisation area | `GFTPC` | Area |
| Named area of interest (NAI) | `GFPPIN` | Area |
| Targeted area of interest (TAI) | `GFPPIT` | Area |
| Route reconnaissance | `GFPPR` | Line |
| Zone reconnaissance | `GFPPZ` | Area |
| Area reconnaissance | `GFPPA` | Area |
| Ambush | `GFTMA` | Point / Line |
| Raid | `GFTMR` | Point |
| Direction of attack (rotary-wing) | `GFTDAR` | Line |
| Main attack | `GFTAMA` | Line |
| Supporting attack | `GFTASA` | Line |

#### 2.2.2 Command & Control / Ground Manoeuvre Graphics
| Missing Graphic | Type |
|---|---|
| Passage point | Point |
| Lane / breach | Line + Area |
| Minefield (protective, nuisance, antitank) | Area |
| Wire obstacle | Line |
| Antitank ditch | Line |
| Bridge | Point |
| Axis of advance (aviation) | Line |
| Air corridor / SAAFR | Area / Line |
| Low-level transit route (LLTR) | Line |
| Restricted operations zone (ROZ) | Area |

#### 2.2.3 Fire Support Graphics (Appendix B, Part II)
| Missing Graphic | Type |
|---|---|
| Target (point) | Point |
| Target (linear / area) | Line / Area |
| Fire support coordination measure (FSCM) belt | Area |
| Restrictive fire area (RFA) | Area |
| Free fire area (FFA) | Area |
| No-fire area (NFA) | Area |
| Sensor zone | Area |
| Bomb line | Line |
| Kill box (blue / purple) | Area |
| Call-for-fire zone | Area |
| Artillery target intelligence (ATI) | Point |
| Check point (fire support) | Point |
| Fire support station | Point |

#### 2.2.4 Mobility / Survivability Graphics
- Tank ditch (revetted / unrevetted)
- Minefield gap / breach
- Bypassed obstacle
- Combat outpost (COP)
- Observation post / listening post (OLP)

#### 2.2.5 Special Operations
- Helicopter landing zone (HLZ) / pick-up zone (PUZ)
- Parachute drop zone (DZ)
- Extraction zone (EZ)
- Forward operating base (FOB) — area
- Infiltration / exfiltration lane

#### 2.2.6 Meteorological / CBRN
- Nuclear burst (ground / air)
- Chemical / biological downwind hazard area
- Contaminated area (types 1–4)
- CBRN decontamination line

**Estimated Appendix B coverage: < 8 % (16 of ~200+ defined graphics).**

---

## 3. Symbol Attribute / Modifier Support

### 3.1 What Exists

The application provides **no modifier UI whatsoever**. The SIDC strings are hard-coded at the category level. The name modal captures only a display label string. No modifier fields are written into any SIDC position, and no modifier overlay is rendered on the map symbol.

### 3.2 Missing Modifier Fields

MIL-STD-2525C defines a rich set of modifier fields (symbol attributes). All of the following are absent:

#### SIDC Positional Modifiers
| SIDC Position | Field | Example values |
|---|---|---|
| 3 | Battle dimension | G (ground), A (air), S (sea surface), U (subsurface), F (SOF) |
| 4 | Status | A (anticipated/planned), P (present/actual) |
| 5–10 | Function ID | Determines the symbol shape — currently fixed |
| 11–12 | Echelon / task force / HQ indicator | See below |
| 13–14 | Country code | Two-letter ISO |
| 15 | Order of battle | G (ground), A (air), N (naval), etc. |

#### Modifier Amplifiers (Fields A–Z, AA–AM per Table III)
| Field | Modifier | Operational use |
|---|---|---|
| C | Quantity | Number of vehicles / aircraft |
| F | Reinforced / reduced | (+) reinforced, (–) reduced, (±) both |
| G | Staff comments | Free text note |
| H | Additional information | Free-form field |
| J | Evaluation rating | Reliability × credibility matrix (A1–F6) |
| K | Combat effectiveness | Fully capable → destroyed |
| L | Signature equipment | Specific system type |
| M | Higher formation | Parent unit designator |
| N | Hostile / enemy | ENY label |
| P | IFF / SIF | IFF code or SIF mode |
| Q | Direction of movement | Bearing in degrees |
| R | Mobility indicator | Wheeled, tracked, towed, rail, etc. |
| S | HQ element indicator | NHQ (no HQ), IHQ (independent HQ), etc. |
| T | Unique designation | Unit designation string |
| V | Equipment type | Specific equipment name |
| W | Date-time group | DTG of observation / reporting |
| X | Altitude / depth | MSL or AGL altitude |
| Y | Location | MGRS or lat/lng string |
| Z | Speed | km/h or knots |
| AA | Special C2 headquarters | Specific command name |

#### Echelon Indicators (SIDC positions 11–12)
None of the following echelon overlays can be applied:
- Team/crew, Squad, Section, Platoon/detachment
- Company/battery/troop, Battalion/squadron, Regiment/group
- Brigade, Division, Corps/MEF, Army, Army Group, Region
- Command

#### Task Force / Reinforced / HQ Modifiers (SIDC position 11)
- Task Force (TF)
- Headquarters (HQ)
- Task Force HQ
- Feint / dummy indicator

**All modifier fields are absent — this is a critical operational gap.**

---

## 4. Labeling and Annotation

### 4.1 What Exists

- A basic name modal lets the user type a single free-form string before placing a graphic.
- For unit markers, the label is displayed as the Google Maps marker `title` (tooltip only).
- For line/area graphics, the label is rendered via a `labelMarker` overlay at the midpoint or centroid.
- InfoWindow shows: title, SIDC, lat/lng (units only), and a Remove button.

### 4.2 Missing Labeling Capabilities

#### Per-symbol Label Fields
- No multi-field label layout per MIL-STD-2525C Figure 1 (all modifier amplifier text blocks A–AM are absent).
- No size (echelon) indicator text above the frame.
- No unit designation (T field) displayed on or adjacent to the symbol.
- No date-time group (W field) visible on map.
- No speed/direction vector rendered as a leader line.
- No equipment type text (V field).
- No evaluation / credibility rating displayed.

#### Free-text Annotation Tools
- No ability to place free-standing text labels anywhere on the map.
- No leader-line annotation linking text to a feature.
- No callout boxes, sticky notes, or note anchors.

#### Phase Line / Boundary Labels
- Phase line labels ("PL ALPHA") appear at midpoint only; no repeat labels along the full length of a long line (standard practice for Phase Lines is to label both ends and at intervals).
- No support for directional arrows combined with echelon/unit identity on boundary lines.
- Boundary lines lack the flanking unit designators placed on each side (required by doctrine).

#### Measurement Overlays
- No distance / range ring display.
- No bearing / azimuth lines.
- No circular or sector threat-range rings (e.g., SAM envelope overlay).
- No grid reference system (MGRS grid) overlay.

#### Map Marginalia
- No declination diagram, bar scale, grid zone designator, or standard map legend panel.

---

## 5. Layer / Object Management

### 5.1 What Exists

All placed objects (units in `placedUnits[]`, graphics in `placedTGs[]`) are maintained in flat JavaScript arrays. There is no UI surface for managing placed objects beyond clicking a single item on the map to open an InfoWindow, which offers only a Remove button.

### 5.2 Missing Layer and Object Management Features

#### Object List / Table of Contents
- No panel listing all placed units and graphics by name.
- No ability to select, rename, or inspect an object from a list.
- No indication of how many objects are placed.

#### Layer Groups
- No concept of named layers (e.g., "Blue Force", "Red Force", "Fire Support", "Obstacles").
- No ability to create, rename, or delete layers.
- No layer ordering (z-index is only controlled by uid counter).
- No ability to lock a layer against accidental edits.

#### Visibility (Show/Hide)
- No per-object or per-layer visibility toggle.
- No ability to hide all objects of a given affiliation.
- No temporary hide-all for map printing or declutter.

#### Selection Model
- Only one object can be interacted with at a time (via InfoWindow click).
- No rubber-band / box selection of multiple objects.
- No Ctrl+click multi-selection.
- No Select All / Select by affiliation / Select by type operations.
- No concept of a "selected set" that can be moved, deleted, or styled together.

#### Object Properties Panel
- No docked properties panel; all interaction is through InfoWindow popups.
- No in-place rename without removing and re-placing.
- No ability to change affiliation of a placed symbol.
- No ability to change symbol type after placement.

#### Search / Filter
- No search bar to find a placed unit by name or designation.
- No filter by type, affiliation, echelon, or category.

---

## 6. Interaction Patterns

### 6.1 What Exists

- **Units:** Drag from sidebar → drop on map. Draggable after placement. Click to open InfoWindow.
- **Graphics (point):** Click palette item → click map to place → name modal → placed.
- **Graphics (line/area):** Click palette item → click map to add vertices → double-click or "Finish" to commit → name modal → placed.
- **Drawing toolbar:** "Undo Point" (removes last vertex), "Finish", "Cancel", Escape key.
- **Remove:** Only via InfoWindow popup button.

### 6.2 Missing Interaction Behaviours

#### Drawing
- No snap-to-grid or snap-to-existing-point during drawing.
- No ability to enter coordinates manually (lat/lng or MGRS) for precise placement.
- No freehand drawing mode.
- No auto-close area polygon on click of first vertex.
- No minimum-bounding-geometry tool (e.g., draw a circle by centre + radius).
- No curve / Bezier segment type for tactical graphics that require smoothed paths.
- No parallel-offset tool for corridor graphics (e.g., avenue of approach width).

#### Editing (Post-placement)
- **No vertex editing of placed lines or areas.** Once a graphic is placed, its geometry is fixed. There is no handle-drag to reshape.
- **No move of placed line/area graphics.** Only unit markers have `draggable: true`.
- No node insert / delete on an existing polyline.
- No rotate / scale of area graphics.
- No split / merge of line segments.

#### Undo / Redo
- "Undo Point" exists only during active drawing (removes the last vertex in the current session).
- **No global undo stack** — a placed and committed object cannot be undone.
- No redo capability at all.

#### Context Menu
- No right-click context menu on the map or on placed objects.
- No "Edit properties", "Duplicate", "Move to layer" actions from context.

#### Keyboard Shortcuts
- Escape to cancel drawing is implemented.
- No other keyboard shortcuts (Delete to remove selected, Ctrl+Z undo, Ctrl+Y redo, Ctrl+A select all, arrow keys for nudge, etc.).

#### Ruler / Measurement Mode
- No distance measurement tool.
- No area measurement tool.
- No bearing / azimuth measurement.

---

## 7. Export / Persistence

### 7.1 What Exists

**Nothing.** There is no save, load, export, or share functionality of any kind. Refreshing the page destroys all placed content. There is no session state persistence even in `localStorage`.

### 7.2 Missing Export and Persistence Features

#### Session Persistence
- No auto-save to `localStorage` or `IndexedDB`.
- No explicit "Save" / "Load" from browser storage.
- No session restore on page reload.

#### File Export
| Format | Operational relevance | Missing |
|---|---|---|
| GeoJSON | Standard web-GIS interchange; supported by QGIS, ArcGIS | Yes |
| KML / KMZ | Google Earth interop, widely used in military planning | Yes |
| MIL-STD-2525 SIDC JSON | Symbol-aware exchange preserving all modifier fields | Yes |
| Shape file (.shp) | Legacy C2 system ingest | Yes |
| VMDF / NTDS | Naval / legacy C2 | Yes |
| PDF / PNG export | Briefing-ready map product | Yes |
| MSDL (Military Scenario Definition Language, SISO-STD-007) | Simulation / wargame exchange | Yes |
| C2Core / NIEM | Interoperable command messaging | Yes |

#### File Import
- No ability to load any external file (GeoJSON, KML, etc.) onto the map.
- No capability to ingest a pre-planned overlay from another tool.

#### Collaboration / Sharing
- No URL-based state sharing (deep-link with encoded overlay).
- No real-time collaborative editing (WebSocket / WebRTC).
- No server-side storage or user accounts.

#### Print / Map Product
- No print layout mode with legend, scale bar, north arrow, and classification markings.
- No raster tile caching for offline / disconnected operation.

---

## 8. Interoperability

### 8.1 MIL-STD-2525C vs. MIL-STD-2525D

The application targets 2525C implicitly (SIDC structure, `milsymbol` v2.2 supports both 2525C and 2525D/APP-6D via the same library). The following 2525D changes are unaddressed:

- **Symbol ID format change:** 2525D uses a 20-character SIDC vs. 15-character in 2525C. Hard-coded 15-character SIDCs will not render correctly against a 2525D renderer.
- **Context field:** 2525D replaces "battle dimension" (position 3) with a "context" field (Reality / Exercise / Simulation). No Exercise or Simulation mode is available.
- **Identity / Affiliation rename:** "Hostile" → "Adversary" in 2525D; "Unknown" splits into "Unknown" and "Pending"; "Assumed Friend" and "Suspect" affiliations are absent entirely.
- **Symbol sets:** 2525D reorganises all symbols into named symbol sets (Air, Land Unit, Land Equipment, etc.) — the current SIDC namespace structure is incompatible without translation.
- **Frame shapes:** 2525D changed some frame geometries; rendering via `milsymbol` handles this if the correct version flag is passed, but the app never sets it.
- **SIDC modifier block:** 2525D defines modifier fields differently — the app encodes no modifiers in either standard.

### 8.2 APP-6 (NATO) Support

- **APP-6A/B:** Broadly equivalent to 2525B/C, but with NATO-specific symbols and country-of-origin codes. Not addressed.
- **APP-6C:** Aligned with 2525C. `milsymbol` supports APP-6C rendering but the app does not expose a "standard selection" toggle.
- **APP-6D:** Aligned with 2525D. Same gap as 2525D above.
- **NATO-specific symbols:** STANAG 2019 symbology (NATO Ground Tactical Symbols not in MIL-STD-2525C) is entirely absent.

### 8.3 Coordinate Systems
- The app uses decimal lat/lng throughout; no MGRS, UTM, or grid reference support.
- No coordinate system selector.
- No datum indication (WGS-84 is implied but never stated).
- InfoWindow displays decimal degrees only — MGRS is the operational standard for land warfare.

### 8.4 Map Backgrounds
- Only Google Maps tile layers are used (terrain, satellite, roadmap, hybrid).
- No OGC-compliant WMS / WMTS service support for classified or military-specific basemaps (e.g., TDS, ArcGIS Server, Esri Defense basemaps).
- No offline tile pack (MBTiles) loading for disconnected environments.
- No vector tile (MVT) support for custom map styling.

---

## 9. Performance and Scalability

### 9.1 Current Architecture

Each placed unit is a `google.maps.Marker`; each line/area is a `google.maps.Polyline` / `Polygon` plus a label `Marker`. There is no object pooling, virtualisation, or tile-based rendering. The `milsymbol` library generates an SVG per symbol at placement time; SVGs are stored as data-URIs in marker icons.

### 9.2 Scalability Gaps

#### Symbol Count
- Google Maps Markers degrade noticeably above ~500 simultaneous DOM-rendered markers on most browsers.
- A battalion-size overlay with all vehicles and personnel could easily reach 3,000–10,000 symbols. The current approach will fail.
- No use of `google.maps.OverlayView` with canvas/WebGL rendering (e.g., deck.gl, OpenLayers, Leaflet.canvas) which can handle 100,000+ symbols.

#### Clustering
- No marker clustering. At low zoom levels a dense unit disposition will produce an unreadable overlapping mass with no indication of density.
- No aggregation strategy (cluster → echelon up on zoom out).

#### Dynamic Symbol Refresh
- No concept of a live data feed or position update. All symbols are statically placed and have no update pathway.
- No track history / breadcrumb trail for moving units.

#### Drawing Performance
- `updatePreview` redraws a full Polyline on every `mousemove` event without debouncing or throttling — will cause frame drops at high zoom / large feature counts.
- No use of `requestAnimationFrame` for smooth preview rendering.

#### Memory Management
- Removed objects call `.setMap(null)` but are spliced from flat arrays — no WeakRef or proper lifecycle management. Long sessions will accumulate detached DOM references.

---

## 10. Other Operationally Important Gaps

### 10.1 Classification Handling
- No classification banner (SECRET, UNCLASSIFIED, etc.) on the map display.
- No mechanism to mark individual symbols or graphics with a classification caveat.
- No export redaction for classified content.

### 10.2 Operational Overlays / Intelligence Products
- No ability to load raster imagery (DTED, GeoTIFF, NTF) as a draped layer.
- No imagery footprint / collection timeline overlay.
- No IPB (Intelligence Preparation of the Battlefield) overlay templates.
- No threat rings or engagement zone visualisation based on weapon system parameters.
- No weather overlay (wind, precipitation, visibility) for aviation / NBC planning.

### 10.3 Time / Animation
- No time slider to animate unit movements over a scenario timeline.
- No planned vs. actual track differentiation (SIDC status bit "A" for anticipated never rendered differently from "P" for present).
- No phase-based overlay display (Phase 1, Phase 2, etc.).

### 10.4 Grid and Survey Tools
- No MGRS grid overlay.
- No viewshed / line-of-sight analysis.
- No slope / terrain analysis for route planning.
- No elevation profile tool.

### 10.5 Reporting and Situational Awareness
- No unit status panel or SITREP summary.
- No casualty / equipment status reporting tied to symbol modifiers.
- No alert / notification mechanism for symbol changes.

### 10.6 Accessibility and Usability
- No keyboard-only operation path beyond Escape.
- No screen-reader ARIA labeling on sidebar items.
- No high-contrast mode (ironically the dark theme already partially helps).
- No touch / stylus support for tablet field use — drag-and-drop relies on HTML5 drag API which is poorly supported on touchscreens.
- No responsive layout — fixed 264 px sidebar unusable on small / rotated screens.
- No user preferences persistence (default affiliation, preferred coordinate format, etc.).

### 10.7 Security
- Google Maps API key is left as a placeholder string `YOUR_GOOGLE_MAPS_API_KEY` in the distributed file — any key substituted here will be exposed in source.
- No Content Security Policy header guidance.
- No authentication / authorisation framework.

---

## 11. Priority Gap Table

| # | Gap | Category | Priority | Effort | Operational Impact |
|---|---|---|---|---|---|
| 1 | Post-placement vertex editing (reshape lines/areas) | Interaction | **HIGH** | Medium | Cannot adjust a drawn graphic without deleting and redrawing |
| 2 | Global undo / redo stack | Interaction | **HIGH** | Medium | Unrecoverable errors destroy planning products |
| 3 | Symbol modifier UI (echelon, TF, HQ, modifiers T/W/Q/V) | Modifier support | **HIGH** | High | Non-compliant with MIL-STD-2525C; symbols carry no tactical meaning |
| 4 | GeoJSON export / import | Export / Persistence | **HIGH** | Medium | Zero persistence — refresh destroys all work |
| 5 | Session auto-save (localStorage) | Export / Persistence | **HIGH** | Low | Minimum viable persistence; blocks all operational use |
| 6 | MGRS coordinate display and entry | Interoperability | **HIGH** | Medium | Decimal degrees not operationally acceptable for land warfare |
| 7 | Echelon indicator rendering on all placed symbols | Modifier support | **HIGH** | Medium | Echelon is the single most-read modifier on any tactical map |
| 8 | Fire support graphics (CFL, NFL, NFA, RFA, FFA, target) | Tactical graphic types | **HIGH** | High | Fire support coordination is a primary use case for any overlay tool |
| 9 | Phase line end-label convention (both ends) | Labeling | **HIGH** | Low | Single-point midpoint label does not meet doctrinal standard |
| 10 | Rubber-band / multi-select | Layer management | **HIGH** | Medium | Cannot bulk-edit or move a group of related symbols |
| 11 | Object list panel with visibility toggles | Layer management | **HIGH** | Medium | No awareness of what is on the map without clicking every item |
| 12 | KML / KMZ export | Export / Persistence | **HIGH** | Medium | Most widespread military interchange format (Google Earth) |
| 13 | Planned vs. actual symbol status (SIDC position 4) | Modifier support | **HIGH** | Low | Cannot distinguish planned vs. confirmed positions |
| 14 | Boundary flanking unit designators | Labeling | **MEDIUM** | Medium | Required by FM 3-90 / ATP 3-90.5 for boundary graphics |
| 15 | Named layers / layer groups | Layer management | **MEDIUM** | Medium | Essential for blue/red/green force separation |
| 16 | Canvas/WebGL rendering backend (deck.gl or similar) | Performance | **MEDIUM** | High | Required for >500 symbols without frame-rate collapse |
| 17 | Marker clustering with zoom-level aggregation | Performance | **MEDIUM** | Medium | Unreadable display at battalion+ scale |
| 18 | Axis of advance / avenue of approach corridor graphic | Tactical graphic types | **MEDIUM** | Medium | Core manoeuvre graphic — current arrow is not standards-compliant |
| 19 | Objective area graphic (Appendix B) | Tactical graphic types | **MEDIUM** | Low | One of the most commonly drawn tactical area graphics |
| 20 | NAI / TAI area graphics | Tactical graphic types | **MEDIUM** | Low | Intelligence-driven ops require these overlays |
| 21 | LOA / LC / FCL line graphics | Tactical graphic types | **MEDIUM** | Low | Manoeuvre control measures set missing critical lines |
| 22 | Free-text annotation tool | Labeling | **MEDIUM** | Low | Cannot add map notes without placing a formal symbol |
| 23 | Range / threat rings | Labeling | **MEDIUM** | Low | Fundamental for ADA, artillery, and air threat planning |
| 24 | MIL-STD-2525D / APP-6D standard toggle | Interoperability | **MEDIUM** | High | NATO coalition partners require APP-6 compliance |
| 25 | WMS / WMTS external layer support | Interoperability | **MEDIUM** | High | Military basemaps, imagery, and intelligence layers |
| 26 | CBRN / NBC tactical graphics | Tactical graphic types | **MEDIUM** | Medium | CBRN downwind hazard area is a common overlay type |
| 27 | Special operations graphics (HLZ, DZ, EZ) | Tactical graphic types | **MEDIUM** | Low | Required for SOF integration into OPORD |
| 28 | Snap-to-vertex during drawing | Interaction | **MEDIUM** | Medium | Precision required for connected graphics (e.g., boundary junctions) |
| 29 | Coordinate entry mode for precise placement | Interaction | **MEDIUM** | Low | Operators work from grid references, not mouse clicks |
| 30 | Maritime / naval symbol set | Symbol coverage | **MEDIUM** | High | Joint ops overlays always include naval forces |
| 31 | Ground equipment symbol set (vehicles, systems) | Symbol coverage | **MEDIUM** | High | Ground units are shown as equipment, not just unit frames |
| 32 | SOF / irregular force symbols | Symbol coverage | **MEDIUM** | Medium | Increasingly present in modern operational overlays |
| 33 | Classification banner display | Security | **MEDIUM** | Low | Required before any classified data can be handled |
| 34 | Print / export map product with marginalia | Export / Persistence | **MEDIUM** | High | Briefing products require standardised map layout |
| 35 | Context menu (right-click) on map and objects | Interaction | **LOW** | Medium | Quality-of-life; speeds common operations |
| 36 | Time slider / scenario animation | Time / Animation | **LOW** | High | Phase-based and timeline-driven planning |
| 37 | Viewshed / line-of-sight analysis | Grid / Survey | **LOW** | High | Requires elevation data integration |
| 38 | MGRS grid overlay | Grid / Survey | **LOW** | Medium | Reference grid for operational coordination |
| 39 | Touch / stylus input support | Accessibility | **LOW** | Medium | Field tablets are primary client devices in forward areas |
| 40 | Direction-of-movement vector on unit symbols | Modifier support | **LOW** | Low | Q-field bearing line; useful but not universally required |
| 41 | Offline / disconnected tile caching | Performance | **LOW** | High | Required for expeditionary / comms-denied environments |
| 42 | Real-time collaborative editing | Collaboration | **LOW** | Very High | Enables distributed planning; out of scope for v1 |
| 43 | Unit status / SITREP panel | Reporting | **LOW** | High | Situational awareness dashboard |
| 44 | Weather overlay integration | Intelligence overlays | **LOW** | High | Aviation and NBC planning dependency |
| 45 | Elevation profile / terrain analysis | Grid / Survey | **LOW** | High | Route planning and obstacle assessment |

---

## 12. Recommended Implementation Roadmap

### Phase 1 — Minimum Viable Operational Tool (HIGH priority gaps)

1. **Session persistence:** Serialise `placedUnits` and `placedTGs` to `localStorage` on every placement/removal; restore on load. *(~2 days)*
2. **GeoJSON export/import:** Emit each unit as a GeoJSON `Feature` with `properties.sidc`, `properties.label`, and all modifier fields; re-ingest on load. *(~3 days)*
3. **Symbol modifier panel:** Add a contextual properties drawer that exposes at minimum: echelon (SIDC position 11–12), status (position 4), task force / HQ indicator, unique designation (T), and date-time group (W). *(~5 days)*
4. **MGRS display and entry:** Integrate a `mgrs` JS library; display coordinates in MGRS in all InfoWindows; provide a coordinate-entry dialog as an alternative to map click. *(~2 days)*
5. **Post-placement vertex editing:** On clicking a placed line/area, enter edit mode displaying draggable vertex handles (`google.maps.Polyline` supports `setEditable(true)`). *(~3 days)*
6. **Global undo stack:** Maintain an operation log (add / remove / reshape actions) with Ctrl+Z support. *(~3 days)*
7. **Object list panel:** Add a collapsible panel listing all placed objects with name, type, affiliation colour, and a visibility toggle. *(~3 days)*
8. **Phase line end-labeling:** Label both endpoints and midpoint of every phase line graphic. *(~1 day)*
9. **Core fire support graphics:** Add CFL, NFL, NFA, RFA, FFA, target point, and kill box to the `TG_DEFS` catalogue with correct Appendix B SIDCs. *(~2 days)*
10. **Planned vs. actual status:** Toggle the SIDC status character between `A` (anticipated, dashed frame) and `P` (present, solid frame) per placed unit. *(~1 day)*

### Phase 2 — Operational Completeness (MEDIUM priority gaps)

- Named layers with group show/hide, lock, and z-order controls.
- KML export for Google Earth briefing products.
- Expand tactical graphics to full Appendix B coverage (objective, NAI/TAI, LOA, LC, infiltration lane, HLZ/DZ, CBRN hazard area).
- Canvas/WebGL rendering backend for performance at scale.
- Marker clustering.
- MIL-STD-2525D / APP-6C/D standard toggle.
- WMS/WMTS external basemap support.
- Range rings and threat envelope overlays.
- Free-text annotation tool.
- Rubber-band multi-select.

### Phase 3 — Advanced Capabilities (LOW priority / future)

- Time slider and phase-based overlay animation.
- Offline tile caching (service worker + MBTiles).
- Viewshed / terrain analysis integration.
- Touch / stylus input optimisation.
- Real-time collaborative editing (WebSocket).
- Classification handling framework.
- MSDL / C2Core export for simulation ingest.

---

## 13. Technical Debt Notes

- **SIDC strings are hard-coded character arrays**, not driven by a structured catalogue. Scaling to hundreds of symbols requires a proper SIDC builder that composes functional ID, echelon, modifier, and status bits dynamically.
- **`milsymbol` v2.2 is not being used to its full capability.** The library supports modifier injection via its `options` parameter (e.g., `{ size, uniqueDesignation, higherFormation, quantity, reinforcedReduced }`); none of these are exercised.
- **Drawing state is a single flat object** (`drw`). This will need to become a proper state machine (idle → drawing → editing → selected) to support the interaction patterns required in Phase 1.
- **InfoWindow HTML is built via string concatenation** with direct `window.__milRemove(uid)` calls — this is an XSS vector if any user-supplied label contains HTML. Switch to a DOM-based InfoWindow content builder.
- **Google Maps dependency** ties the app to a commercial, rate-limited, potentially unavailable tile service. Consider an OpenLayers or Leaflet base for flexibility (WMS/WMTS, offline, projection support).
- **No build tooling** — all code is inline in a single HTML file. This will become unmanageable at scale; introduce a module bundler (Vite, Webpack) and split into separate JS/CSS modules.

---

*End of Gap Analysis Report*
