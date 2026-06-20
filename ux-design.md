# UX Design Document — MIL-STD-2525 Military Map Web Application
## Next Iteration: Phase 1 Feature Design

**Prepared by:** Senior UX Designer, Military C2 / GIS  
**Date:** 2026-05-30  
**Reference application:** `index.html` (Google Maps JS + milsymbol.js v2.2)  
**Gap analysis source:** `gap-analysis.md` (45-gap analysis, 2026-05-30)  
**Scope:** HIGH-priority gaps only; browser-based SPA, no backend required

---

## Document Map

| Section | Feature | Gap IDs Addressed |
|---|---|---|
| 1 | Symbol Attribute Panel | 3, 7, 13, 40 |
| 2 | Object / Layer Manager Panel | 11, 5 (partial) |
| 3 | Reshaping Placed Lines and Areas | 1 |
| 4 | Global Undo / Redo | 2 |
| 5 | Export Dialog (GeoJSON) | 4 |
| 6 | Expanded Symbol Palette | — (scalability prerequisite) |
| 7 | Coordinate Entry Toolbar | 6, 29 |

---

## 1. Symbol Attribute Panel

### 1.1 Interaction Flow

When a user clicks on any placed unit marker on the map, the application enters **symbol-selected state**. The right side of the viewport slides open a 280 px attribute panel (hereafter "Attr Panel"). This replaces the current Google Maps InfoWindow for unit symbols; InfoWindows are retained only for tactical graphics (lines/areas) where the panel approach is less applicable.

The Attr Panel is **non-modal and docked**. The user can continue panning and zooming the map while the panel is open. Clicking a different unit marker switches the panel content to that unit. Clicking empty map space (no unit) closes the panel with a slide-out animation. Pressing Escape also closes it.

All changes made in the Attr Panel are applied **live** — the map symbol re-renders immediately as each field is changed, without a Save button. This mirrors the interaction model of Google Docs or Figma: changes are immediate and the undo stack records every discrete change. There is a single "Remove Symbol" button at the bottom of the panel that triggers a confirmation before deleting.

The panel is divided into four collapsible sections using disclosure triangles:

1. **Identity** — echelon, task force flag, HQ flag, status (planned/present)
2. **Labels** — unique designation (T field), higher formation (M field), additional info (H field)
3. **Activity** — direction of movement (Q field), speed (Z field)
4. **Symbol Info** — read-only: SIDC string, affiliation, category — for developer/analyst reference

The milsymbol.js library accepts modifier fields directly in its options object (e.g., `{ uniqueDesignation, higherFormation, reinforcedReduced, echelon }`). Every change in the panel rebuilds the `ms.Symbol` with the updated options and re-renders the SVG data-URI on the marker icon. No SIDC string mutation is required for the amplifier fields; echelon and modifier character changes do require a SIDC rebuild at positions 11–12.

### 1.2 Panel Layout (ASCII Wireframe)

```
┌─────────────────────────────────────────┐  ← 280 px wide, docked right
│  ╔═══════════════════════════════════╗  │
│  ║  [SVG icon 48px]  Infantry        ║  │  ← Symbol name, read-only
│  ║                   3rd Plt, A Co   ║  │  ← Unique designation (live)
│  ╚═══════════════════════════════════╝  │
│                                         │
│  ▾ IDENTITY                             │  ← Collapsible section header
│  ┌─────────────────────────────────┐   │
│  │ Status                          │   │
│  │  ○ Present (solid frame)        │   │  ← Radio: SIDC pos 4 = 'P'
│  │  ○ Planned (dashed frame)       │   │  ← Radio: SIDC pos 4 = 'A'
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Echelon                         │   │
│  │  [Team ▾────────────────────]   │   │  ← <select> dropdown
│  │   Team · Squad · Section        │   │
│  │   Platoon · Company · Battalion │   │
│  │   Regiment · Brigade · Division │   │
│  │   Corps · Army · Army Group     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Modifiers          [ ] Task Force│   │  ← Checkbox
│  │                    [ ] HQ        │   │  ← Checkbox
│  │                    [ ] Feint/Dummy│  │  ← Checkbox
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Reinforced / Reduced            │   │
│  │  [None ▾──────────────────────] │   │  ← <select>: None · (+) · (-) · (±)
│  └─────────────────────────────────┘   │
│                                         │
│  ▾ LABELS                               │
│  ┌─────────────────────────────────┐   │
│  │ Unique Designation (top label)  │   │
│  │  [________________________]     │   │  ← text input, max 20 chars
│  │  e.g.  3-69 AR                  │   │  ← placeholder
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Higher Formation (bottom label) │   │
│  │  [________________________]     │   │  ← text input, max 20 chars
│  │  e.g.  1st ABCT                 │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Additional Info                 │   │
│  │  [________________________]     │   │  ← text input, max 30 chars
│  └─────────────────────────────────┘   │
│                                         │
│  ▾ ACTIVITY                             │
│  ┌─────────────────────────────────┐   │
│  │ Direction of Movement           │   │
│  │  [___°]  0–359  (blank = none)  │   │  ← number input, shows arrow on symbol
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Speed                           │   │
│  │  [_______] km/h                 │   │  ← number input, displays as Z-field
│  └─────────────────────────────────┘   │
│                                         │
│  ▾ SYMBOL INFO  (collapsed by default) │
│    SIDC: SFGPUCI--*****                 │  ← monospace, read-only
│    Affiliation: Friendly                │
│    Category: Ground Combat              │
│                                         │
│  ─────────────────────────────────────  │
│  [  Remove Symbol  ]                    │  ← danger-style button, bottom
└─────────────────────────────────────────┘
```

The panel slides in from the right edge over the map. It does not push the map left; it overlays the rightmost portion. A semi-transparent backdrop strip (4 px) on the panel's left border provides visual separation from the map.

### 1.3 Field Definitions

| Widget | Field Name | milsymbol.js option | SIDC position | Notes |
|---|---|---|---|---|
| Radio group | Status — Present / Planned | — | pos 4: `P` / `A` | Rebuilds SIDC; dashed frame = Planned |
| Select dropdown | Echelon | `echelon` | pos 11–12 | See echelon map table below |
| Checkbox | Task Force | `taskForce: true` | pos 11: `B`/`D`/`E` | Combined with echelon |
| Checkbox | HQ | `headquartersElement: true` | pos 11: `A`/`C`/`D` | Combined with TF |
| Checkbox | Feint / Dummy | `feintDummy: true` | pos 11: `F`/`G` | |
| Select dropdown | Reinforced / Reduced | `reinforcedReduced` | — | Options: `''`, `'+'`, `'-'`, `'+-'` |
| Text input | Unique Designation | `uniqueDesignation` | — | Renders as top label (T-field) |
| Text input | Higher Formation | `higherFormation` | — | Renders as bottom label (M-field) |
| Text input | Additional Info | `additionalInformation` | — | H-field |
| Number input | Direction of Movement | `directionOfMovement` | — | 0–359 deg; renders arrow on symbol |
| Number input | Speed | `speed` | — | Numeric; appended as Z-field text |

**Echelon dropdown values and milsymbol codes:**

| Display label | `echelon` value |
|---|---|
| (None) | `''` |
| Team / Crew | `'A'` |
| Squad | `'B'` |
| Section | `'C'` |
| Platoon / Detachment | `'D'` |
| Company / Battery / Troop | `'E'` |
| Battalion / Squadron | `'F'` |
| Regiment / Group | `'G'` |
| Brigade | `'H'` |
| Division | `'I'` |
| Corps / MEF | `'J'` |
| Army | `'K'` |
| Army Group / Front | `'L'` |
| Region | `'M'` |
| Command | `'N'` |

### 1.4 Key Design Decisions and Rationale

**Live re-render, no Save button.** Military operators work under time pressure. Requiring a Save step for every attribute change adds cognitive friction and creates a mismatch between what is shown in the panel and what is on the map. Immediate feedback means operators can iterate quickly and trust the display. The undo stack (Section 4) provides a safety net against unintended changes.

**Panel overlays the map rather than pushing it.** The map occupies the primary cognitive space in a C2 tool. Shrinking it to accommodate a panel reduces situational awareness. At 280 px the panel obscures roughly 20–25% of a 1280 px display, which is acceptable. A future collapse-to-icon button on the panel's left edge can reclaim that space.

**Symbol Info section collapsed by default.** The raw SIDC string is a developer/analyst tool, not an operator concern. Hiding it by default reduces clutter while keeping it accessible for troubleshooting or copy-paste into external tools.

**Direction of movement as a plain numeric input rather than a compass rose widget.** Compass rose widgets are visually appealing but imprecise for operational use. Military operators reference bearings in numeric degrees (grid azimuth). A number input with a 0–359 constraint is faster to enter, consistent with how operators communicate (e.g., "bearing 270"), and directly maps to the milsymbol `directionOfMovement` parameter.

**Reinforced/Reduced as a four-way select rather than two checkboxes.** The four states (none, reinforced, reduced, both) are mutually exclusive in MIL-STD-2525C. Presenting them as two independent checkboxes would allow an invalid combination. A select enforces the constraint without explanation.

---

## 2. Object / Layer Manager Panel

### 2.1 Interaction Flow

The Object Manager is a **collapsible panel anchored to the left sidebar**, appearing as a new tab alongside the existing "Units" and "Graphics" palette tabs. It is labelled "Objects" and uses a list icon. Switching to this tab does not cancel any active drawing session — the drawing bar remains visible at the bottom if a graphic is being drawn.

The panel displays every placed item (both units and tactical graphics) in a flat list grouped by object type. Groups are:

- **Unit Symbols** — all entries from `placedUnits[]`
- **Tactical Graphics — Points** — point-type TGs
- **Tactical Graphics — Lines** — line-type TGs
- **Tactical Graphics — Areas** — area-type TGs

Each group header shows a count badge ("Unit Symbols (7)") and a group-level visibility toggle (eye icon). Groups are always shown; they collapse to show only the header row when the disclosure arrow is clicked.

Each row in the list represents one placed object and displays:

- A small affiliation-coloured dot (6 px) or a 20 px miniature symbol SVG thumbnail
- The object's display name (truncated with ellipsis at 140 px)
- A visibility toggle button (eye icon, toggles show/hide on the map)
- A delete button (trash icon, triggers a brief confirmation toast rather than a modal, see below)

Row order within a group matches placement order by default (oldest at top). Drag handles on the left of each row allow reordering within the group. Reordering changes only the panel list order and the `zIndex` of the corresponding map overlays — it does not change group membership.

**Selecting an item** in the Object Manager selects it on the map (the map pans to centre the object, and for unit symbols the Attr Panel opens on the right). The selected row is highlighted with a blue left-border accent. Only one object is selected at a time in this iteration.

**Renaming** is triggered by double-clicking a row name. The name text becomes an inline `<input>` field. Pressing Enter or clicking outside commits the new name. Pressing Escape cancels. The new name updates the map label immediately.

**Deleting** a row shows a brief 3-second undo toast at the bottom of the panel ("Infantry removed — Undo") rather than a blocking confirmation dialog. This keeps the workflow fast while providing a recovery path. If the undo button in the toast is clicked, the object is restored. The toast undo is separate from the global Ctrl+Z undo stack (see Section 4) but the same operation is also pushed onto that stack.

**Hiding** an object (eye toggle OFF) calls `.setMap(null)` on all associated map overlays and stores a `hidden: true` flag on the object record. The row remains visible in the Object Manager with a strikethrough name and reduced opacity. Re-enabling calls `.setMap(map)` to restore all overlays. Hidden objects are included in GeoJSON export with a `"visible": false` property.

### 2.2 Panel Layout (ASCII Wireframe)

The Object Manager replaces the palette area inside the existing left sidebar (264 px wide) when the "Objects" tab is active.

```
┌──────────────────────────────────────────────────┐
│  [✚ Units]  [✚ Graphics]  [≡ Objects]            │  ← mode tabs (3rd tab added)
├──────────────────────────────────────────────────┤
│  🔍 [Filter by name...              ]             │  ← search input, full width
├──────────────────────────────────────────────────┤
│                                                  │
│  ▾ UNIT SYMBOLS  (7)                [👁 all]      │  ← group header + group hide
│  ┌────────────────────────────────────────────┐  │
│  │ ⠿ ● Infantry        3rd Plt A Co  [👁] [🗑] │  │  ← row: handle · dot · name
│  │ ⠿ ● HQ Infantry     TAC CP        [👁] [🗑] │  │     · label · vis · del
│  │ ⠿ ● Armor           A/1-68 AR     [👁] [🗑] │  │
│  │ ⠿ ╌ Recon           2nd Plt       [👁] [🗑] │  │  ← ╌ = hidden (strikethrough)
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ▾ TACTICAL GRAPHICS — LINES  (3)   [👁 all]     │
│  ┌────────────────────────────────────────────┐  │
│  │ ⠿ ─ Phase Line     PL ALPHA        [👁] [🗑] │  │  ← ─ = line type icon
│  │ ⠿ ─ FLOT           FLOT            [👁] [🗑] │  │
│  │ ⠿ ─ Boundary       BDY N           [👁] [🗑] │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ▾ TACTICAL GRAPHICS — AREAS  (2)   [👁 all]     │
│  ┌────────────────────────────────────────────┐  │
│  │ ⠿ ▭ Assembly Area  AA STRIKER      [👁] [🗑] │  │  ← ▭ = area type icon
│  │ ⠿ ▭ Battle Position BP 3-69AR      [👁] [🗑] │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ▸ TACTICAL GRAPHICS — POINTS  (0)  [👁 all]     │  ← collapsed, 0 items
│                                                  │
├──────────────────────────────────────────────────┤
│  [Export GeoJSON]          Total: 12 objects      │  ← footer row
└──────────────────────────────────────────────────┘
```

**Row anatomy (expanded):**

```
⠿  ●  Infantry 3rd Plt A Co               [👁]  [🗑]
│   │  │                                    │     │
│   │  └─ display name (click to select,    │     └─ delete (shows toast)
│   │     dblclick to rename)               └─ visibility toggle
│   └─ affil dot (6px, colour-coded: blue/red/yellow/grey)
└─ drag handle (8px dots, cursor:grab on hover)
```

### 2.3 Expand / Collapse Behaviour

- Each group header has a disclosure triangle (▾ = open, ▸ = collapsed).
- Clicking the header triangle toggles the list. The group height animates over 120 ms (CSS `max-height` transition).
- The group count badge always remains visible even when collapsed, so the operator knows what is in the group without expanding.
- All groups start expanded on initial load. The collapse state is saved in `localStorage` so it persists across sessions.
- When an item is selected via the map (clicking a unit), the Objects tab switches to active, the relevant group expands if collapsed, and the row scrolls into view.

### 2.4 Key Design Decisions and Rationale

**Flat list with type groups rather than a tree of named layers.** Named layers (Gap 15) are a Phase 2 feature. For Phase 1, grouping by object type (units / lines / areas / points) provides the most immediately useful classification with zero configuration burden. Operators can find their placed objects by type without having to manage layer naming conventions.

**Inline rename via double-click rather than a modal.** Modals block the map view and interrupt flow. An inline edit field is consistent with file-manager conventions that operators are already familiar with. The Enter/Escape contract is universal.

**Toast confirmation for delete rather than modal.** Modal delete confirmations on individual objects slow high-tempo planning sessions. The 3-second undo toast is borrowed from Gmail's "Message deleted — Undo" pattern, which has proven effective at providing a safety net without blocking the workflow. Since the global undo stack also captures deletes, recovery is possible even after the toast expires.

**Export button in the panel footer.** Placing the export trigger in the Object Manager rather than a top toolbar creates a clear mental model: "I can see all my objects, and from here I can export them." It also avoids adding another button to an already-sparse top-bar area.

---

## 3. Reshaping Placed Lines and Areas

### 3.1 Interaction Flow

After a polyline or polygon has been placed and committed, the user can re-enter **edit mode** for that graphic. Edit mode is entered by one of:

- Clicking the placed graphic on the map (click on the line stroke or polygon fill/border) — the graphic is selected and a small toolbar appears at the top of the drawing bar area.
- Selecting the object in the Object Manager panel (Section 2) and pressing the Enter key or a dedicated "Edit Shape" button that appears in the panel row on hover.

On entering edit mode the drawing bar at the bottom changes to show the **reshape toolbar**:

```
[Drawing bar — reshape mode]
  Graphic: Phase Line PL ALPHA   |   Click vertex to select · Drag to move · Del to remove   |  [+ Add Vertex]  [Done]  [Cancel]
```

Visual changes on the map when edit mode activates:

1. The line/polygon stroke becomes slightly thicker and changes to a dashed-highlight colour (same affiliation colour, increased opacity).
2. **Vertex handles** appear at every existing vertex: filled white circles, 10 px diameter, with a 2 px border in the affiliation colour.
3. **Midpoint handles** appear at the midpoint between each pair of adjacent vertices: filled grey circles, 8 px diameter, slightly transparent. Dragging a midpoint handle inserts a new vertex at that midpoint and begins moving it.

**Moving a vertex:** The user hovers over a vertex handle (cursor changes to `move`). They click and drag the handle to the new position. The polyline/polygon path updates in real time as the handle moves. On `mouseup` the new position is committed and an undo record is pushed.

**Adding a vertex:** The user can either drag a midpoint handle (most common) or click the "Add Vertex" button in the reshape toolbar and then click any point on the line stroke itself. The click-on-stroke method uses a proximity test: if the user clicks within 8 px of the line path, a new vertex is inserted at the nearest point on the path and the line immediately enters drag-vertex mode for that new point.

**Deleting a vertex:** The user clicks a vertex handle to select it (the handle turns red and grows to 14 px). Then presses the Delete or Backspace key to remove it. Alternatively, a right-click on a vertex handle shows a tiny context menu with a single "Remove vertex" option. The graphic must retain its minimum vertex count (2 for lines, 3 for polygons); if removing would violate this, the vertex handle is not selectable and shows a red-X cursor on hover.

**Finishing edit:** Click "Done" in the reshape toolbar, or press Enter, or click any empty area of the map outside the graphic. Edit mode exits, vertex handles disappear, and the reshape operation is recorded as a single undo entry.

**Cancelling edit:** Click "Cancel" in the reshape toolbar or press Escape. All vertex movements made during this edit session are reverted, and the graphic returns to its pre-edit geometry.

### 3.2 Technical Implementation Notes (for developer)

Google Maps `Polyline` and `Polygon` objects support `setEditable(true)` which adds built-in vertex handles. However, the built-in editable mode uses fixed blue squares that do not match the application visual design, and it does not support midpoint-add handles.

**Recommended approach:** Do not use `setEditable(true)`. Instead implement custom vertex handles as `google.maps.Marker` objects positioned at each vertex of the path. This gives full control over handle appearance and event handling.

Implementation pattern:

1. On edit mode enter: iterate `polyline.getPath().getArray()` (or `polygon.getPath().getArray()`), create one marker per vertex at each `LatLng`.
2. Handle marker `dragstart` / `drag` / `dragend`: on `drag`, call `path.setAt(index, event.latLng)` to update the underlying path in real time.
3. Midpoint markers: calculate midpoint between vertex[i] and vertex[i+1], place a smaller marker. On `dragstart` of midpoint marker: insert a new `LatLng` into the path at position `i+1`, replace the midpoint marker with a full vertex marker, and recalculate all midpoint positions.
4. Vertex selection for delete: `click` on a vertex marker sets a `selectedVertexIndex` state variable. Keyboard `keydown` listener checks for Delete/Backspace and calls `path.removeAt(selectedVertexIndex)`, then refreshes all handles.
5. On `Done` / Enter: collect final path, destroy all handle markers, call `polyline.setPath(finalPath)`, push undo record.

The path manipulation must mirror changes to any associated label markers (centroid recalculation for areas, midpoint recalculation for lines) so that labels track correctly during editing.

### 3.3 Keyboard Shortcuts for Edit Mode

| Key | Action |
|---|---|
| Delete / Backspace | Remove selected vertex |
| Escape | Cancel all edits, restore original geometry |
| Enter | Confirm edits (exit edit mode) |
| Tab | Cycle selection through vertices (forward) |
| Shift + Tab | Cycle selection through vertices (backward) |

### 3.4 ASCII Sketch — Vertex Edit State

```
Map view — Phase Line in edit mode:

  ○──────────●──────────○──────────●──────────○
  │                     │                     │
 [v0]     [mid01]      [v1]     [mid12]      [v2]
  ↑                     ↑                     ↑
white 10px           selected:             white 10px
vertex handle        red 14px             vertex handle
                     vertex handle
                     (Del to remove)

  ○ = white vertex handle (unselected)
  ● = red vertex handle (selected, Delete key active)
  midpoint handles (grey 8px) shown between vertices

Drawing bar:
┌──────────────────────────────────────────────────────────────────┐
│ Editing: Phase Line PL ALPHA  │ Drag vertex · Del to remove · Tab cycles  │ [Done]  [Cancel] │
└──────────────────────────────────────────────────────────────────┘
```

### 3.5 Key Design Decisions and Rationale

**Custom handle markers instead of Google Maps `setEditable(true)`.** The built-in editable mode cannot be styled to match the application's dark theme and affiliation colour coding, and it does not support midpoint insert handles. Custom markers are more code but give complete design control and allow midpoint insertion, which is a critical workflow for tactical graphic refinement (e.g., adding a dogleg to a phase line to reflect terrain).

**Midpoint handles for insert rather than a separate "insert" tool mode.** Requiring the user to switch to an "insert vertex" tool breaks flow. Dragging a midpoint handle is a single gesture that discovers naturally — users hover over the line looking for something to grab and find the midpoint handle. This is the same pattern used in vector drawing tools such as Adobe Illustrator's direct selection tool.

**Enter to confirm, Escape to cancel.** This keyboard contract is universal across drawing and editing tools. In a military C2 context where stress and time pressure are real, relying on muscle memory rather than requiring the user to read button labels is critical.

**Single undo record for the entire edit session.** If every individual vertex drag produced an undo entry, Ctrl+Z during editing would produce unexpected intermediate states. Recording the edit as a single delta (from original path to final path) means that Ctrl+Z after exiting edit mode cleanly restores the entire pre-edit geometry.

---

## 4. Global Undo / Redo

### 4.1 Interaction Flow

Ctrl+Z undoes the most recent tracked operation. Ctrl+Y (and Ctrl+Shift+Z) redoes the most recently undone operation. These shortcuts work at all times except when a text input field has focus (where they should operate on the text field instead). The application intercepts `keydown` on `document`, checks `event.ctrlKey` (or `event.metaKey` on Mac), and suppresses the default browser undo if the active element is not an input/textarea.

An **Undo / Redo indicator** strip appears below the mode tabs and above the palette area whenever there are items on either stack. It shows:

```
  ↩ Undo: Placed Infantry         Redo: Renamed PL ALPHA ↪
```

The left side shows the most recent undoable action label. The right side shows the most recent redoable action label (greyed if empty). Both sides are clickable as an alternative to keyboard shortcuts. This strip collapses to zero height (CSS `max-height` transition) when both stacks are empty, preserving vertical palette space.

The undo stack is a **capped array** of operation records with a maximum depth of 50. When the stack exceeds 50 entries, the oldest entry is discarded. The redo stack is cleared whenever a new operation is committed (standard undo model).

### 4.2 Tracked Operations

Every operation that modifies the application state is tracked. The operation record includes enough data to reverse the action completely.

| Operation | Undo action | Record contents |
|---|---|---|
| Place unit symbol | Remove marker from map; remove from `placedUnits[]` | uid, latLng, sidc, label, all modifier fields |
| Delete unit symbol | Restore marker at original position with all attributes | uid, latLng, sidc, label, all modifier fields |
| Move unit symbol (dragend) | Move marker back to previous position | uid, previousLatLng, newLatLng |
| Place tactical graphic (point) | Remove from map and `placedTGs[]` | uid, latLng, def, affil, name |
| Place tactical graphic (line) | Remove polyline + label from map | uid, path[], def, affil, name |
| Place tactical graphic (area) | Remove polygon + label from map | uid, paths[], def, affil, name |
| Delete tactical graphic | Restore all overlays to map | uid, full TG record snapshot |
| Reshape line/area (edit mode exit) | Restore previous path | uid, previousPath[], newPath[] |
| Rename object | Restore old name on map label and in Object Manager | uid, previousName, newName |
| Toggle visibility | Restore previous visibility state | uid, previousVisible, newVisible |
| Modify symbol attribute (echelon, labels, etc.) | Restore previous attribute set | uid, previousAttrs{}, newAttrs{} |

### 4.3 State Model

The undo stack is stored as a module-level variable:

```
undoStack = []          // Array of operation records, index 0 = oldest
redoStack = []          // Array of operation records, index 0 = most-recently-undone
MAX_STACK_DEPTH = 50
```

**Pushing a new operation:**
1. Create an operation record object with `{ type, description, undoData, redoData }`.
2. Push onto `undoStack`.
3. If `undoStack.length > MAX_STACK_DEPTH`, shift (discard) the oldest entry.
4. Clear `redoStack` entirely.
5. Update the undo/redo indicator strip.

**Ctrl+Z (undo):**
1. If `undoStack` is empty, do nothing (optionally flash the indicator).
2. Pop the last record from `undoStack`.
3. Apply the `undoData` to reverse the operation.
4. Push the record onto `redoStack`.
5. Update the indicator strip.

**Ctrl+Y (redo):**
1. If `redoStack` is empty, do nothing.
2. Pop the last record from `redoStack`.
3. Apply the `redoData` to re-apply the operation.
4. Push the record onto `undoStack`.
5. Update the indicator strip.

**Symbol attribute changes** from the Attr Panel (Section 1) are coalesced: if the same attribute on the same uid is changed again within 800 ms, the previous pending record is replaced rather than appended. This prevents the undo stack from filling up with individual character-by-character text input changes. The coalesce timer is reset on each keystroke; the record is committed when the 800 ms timer fires or when focus leaves the field.

### 4.4 ASCII Sketch — Undo/Redo Strip

```
┌─────────────────────────────────────────────────┐
│  [✚ Units]  [✚ Graphics]  [≡ Objects]           │  ← mode tabs
├─────────────────────────────────────────────────┤
│  ↩ Placed Infantry    ················    Redo ↪ │  ← undo strip (greyed redo = empty)
├─────────────────────────────────────────────────┤
│  [palette content below]                        │
```

When both stacks are empty:
```
├─────────────────────────────────────────────────┤
│  (strip collapses — height: 0)                  │
├─────────────────────────────────────────────────┤
```

### 4.5 Key Design Decisions and Rationale

**50-operation cap.** An unbounded stack risks excessive memory usage in long planning sessions. 50 operations is sufficient to recover from any plausible planning mistake. Military map overlays are built incrementally; a session rarely involves more than 20–30 discrete placement actions before review.

**Attribute change coalescing.** Without coalescing, typing a 10-character designation into the Attr Panel would push 10 undo records, and Ctrl+Z would step backwards one character at a time — frustrating behaviour. Coalescing treats the completed field edit as a single operation, which matches user intent.

**No undo of drawing-session vertex operations.** The in-session "Undo Point" button (already implemented) handles vertex removal during drawing. The global undo stack only tracks placement/deletion/reshape at the committed-object level. Mixing these two undo contexts would produce confusing behaviour.

**Redo stack cleared on new action.** This is the standard undo model behaviour. Deviating from it (e.g., tree-based undo) would require a significantly more complex UI to navigate branching history, which is not warranted for a mapping tool.

---

## 5. Export Dialog (GeoJSON)

### 5.1 Interaction Flow

The Export dialog is opened from either:
- The "Export GeoJSON" button in the Object Manager panel footer (Section 2)
- A keyboard shortcut: Ctrl+Shift+E

The dialog is a **centred modal overlay** with a semi-transparent dark backdrop. It is small — approximately 480 px wide × 380 px tall — because the export operation is essentially one click once the options are understood.

On open, the dialog auto-generates a preview of the GeoJSON filename using the current date-time in the format `mil-overlay-YYYYMMDD-HHMMSS.geojson`. The user can edit the filename.

The dialog offers three options presented as labelled checkboxes:

1. **Include hidden objects** (default: unchecked) — if unchecked, objects with `visible: false` are omitted from export.
2. **Include SIDC strings** (default: checked) — embeds the full current SIDC string in each feature's `properties` object.
3. **Pretty-print JSON** (default: checked) — exports indented JSON for human readability; unchecked produces minified JSON for machine consumption.

A read-only **preview pane** (a `<pre>` block, 180 px tall, scrollable) shows the first 20 lines of the generated GeoJSON so the user can verify content before downloading.

Clicking **Download** triggers a `Blob` download via a programmatically created `<a>` element. The download occurs entirely in-browser; no network request is made. After download begins the dialog auto-closes after 600 ms.

Pressing Escape or clicking the backdrop closes the dialog without downloading.

### 5.2 Dialog Layout (ASCII Wireframe)

```
                  ┌───────────────────────────────────────────────────┐
                  │  Export as GeoJSON                            [✕] │
                  ├───────────────────────────────────────────────────┤
                  │                                                   │
                  │  Filename                                         │
                  │  [mil-overlay-20260530-143022.geojson         ]   │
                  │                                                   │
                  │  Options                                          │
                  │  [✓] Include SIDC strings                        │
                  │  [ ] Include hidden objects  (2 hidden)           │
                  │  [✓] Pretty-print JSON                           │
                  │                                                   │
                  │  Preview (first 20 lines)                         │
                  │  ┌─────────────────────────────────────────────┐  │
                  │  │ {                                           │  │
                  │  │   "type": "FeatureCollection",              │  │
                  │  │   "features": [                             │  │
                  │  │     {                                       │  │
                  │  │       "type": "Feature",                    │  │
                  │  │       "geometry": {                         │  │
                  │  │         "type": "Point",                    │  │
                  │  │         "coordinates": [-76.291, 36.851]    │  │
                  │  │       },                                    │  │
                  │  │       "properties": {                       │  │
                  │  │         "uid": 1,                           │  │
                  │  │         "objectType": "unit",               │  │
                  │  │  ...                                        │  │
                  │  └─────────────────────────────────────────────┘  │
                  │                                                   │
                  │  12 objects total  ·  2 hidden (excluded)         │
                  │                                                   │
                  │           [Cancel]          [Download ↓]          │
                  └───────────────────────────────────────────────────┘
```

### 5.3 Exported GeoJSON Structure

The root object is a GeoJSON `FeatureCollection` with two top-level extension fields: `milOverlayVersion` (to allow future parsers to handle schema evolution) and `exportedAt` (ISO 8601 timestamp).

```
{
  "type": "FeatureCollection",
  "milOverlayVersion": "1.0",
  "exportedAt": "2026-05-30T14:30:22Z",
  "features": [ ... ]
}
```

#### 5.3.1 Unit Symbol Feature

Each entry in `placedUnits[]` becomes a GeoJSON `Feature` with geometry type `Point`.

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [ -76.2914, 36.8512 ]
  },
  "properties": {
    "uid": 1,
    "objectType": "unit",
    "sidc": "SFGPUCI--------",
    "label": "3rd Plt A Co",
    "affiliation": "F",
    "visible": true,
    "modifiers": {
      "echelon": "D",
      "taskForce": false,
      "headquartersElement": false,
      "feintDummy": false,
      "reinforcedReduced": "+",
      "uniqueDesignation": "3-69 AR",
      "higherFormation": "1st ABCT",
      "additionalInformation": "",
      "directionOfMovement": 270,
      "speed": null,
      "status": "P"
    }
  }
}
```

#### 5.3.2 Tactical Graphic Feature — Point

Each TG point becomes a GeoJSON `Feature` with `geometry.type = "Point"`.

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [ -76.310, 36.860 ]
  },
  "properties": {
    "uid": 4,
    "objectType": "tg-point",
    "sidc": "GFGPGPC-------",
    "label": "CP 5",
    "graphicType": "Contact Point",
    "affiliation": "F",
    "visible": true
  }
}
```

#### 5.3.3 Tactical Graphic Feature — Line

Each TG line becomes a GeoJSON `Feature` with `geometry.type = "LineString"`. Coordinates are ordered from start to finish (first clicked vertex to last).

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [ -76.320, 36.840 ],
      [ -76.295, 36.855 ],
      [ -76.270, 36.840 ]
    ]
  },
  "properties": {
    "uid": 7,
    "objectType": "tg-line",
    "sidc": null,
    "label": "PL ALPHA",
    "graphicType": "Phase Line",
    "affiliation": "F",
    "dash": [10, 6],
    "weight": 2,
    "arrow": false,
    "forceColor": null,
    "visible": true
  }
}
```

#### 5.3.4 Tactical Graphic Feature — Area

Each TG area becomes a GeoJSON `Feature` with `geometry.type = "Polygon"`. The coordinate ring is closed (last coordinate equals first).

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ -76.310, 36.830 ],
        [ -76.280, 36.825 ],
        [ -76.285, 36.845 ],
        [ -76.310, 36.830 ]
      ]
    ]
  },
  "properties": {
    "uid": 9,
    "objectType": "tg-area",
    "sidc": null,
    "label": "AA STRIKER",
    "graphicType": "Assembly Area",
    "affiliation": "F",
    "dash": null,
    "visible": true
  }
}
```

### 5.4 Key Design Decisions and Rationale

**GeoJSON over KML as the first export format.** GeoJSON is the de facto standard for web GIS interchange and is directly consumable by QGIS, ArcGIS Pro, Leaflet, OpenLayers, and most modern C2 web applications without conversion. It is plain JSON, making it easy to inspect, version-control, and re-import. KML is valuable (Gap 12, Phase 2) but GeoJSON is the correct first target for a web-native application.

**SIDC embedded in `properties`.** This allows a future import function to reconstruct the full milsymbol rendering without any lookup. Tools that do not understand the `sidc` field simply ignore it and treat the feature as plain geometry — backward-compatible with generic GIS tools.

**`uid` field preserved in export.** If the exported file is later re-imported (Phase 2 feature), preserving the uid allows the application to detect duplicate imports and avoid creating duplicate objects. It also aids in correlating export data with external reports or databases.

**All modifier fields nested under a `modifiers` sub-object.** This keeps the `properties` object clean and makes it unambiguous which fields are milsymbol-specific versus geometric metadata. An importing tool can consume just the geometry and label without needing to understand any `modifiers` fields.

**No server required.** The entire export is performed client-side using the Blob API and a programmatic anchor click. This preserves the offline-capable nature of the application and avoids any network dependency for what is fundamentally a local data operation.

---

## 6. Expanded Symbol Palette Organisation

### 6.1 Context and Problem Statement

The current palette holds 25 unit symbols in 5 hard-coded categories rendered as a flat scrollable list. Adding 100+ symbols without structural change would produce an unusable wall of items. The new palette must support:

- Fast discovery of a known symbol ("I know I want an IFV")
- Browsing by category for exploratory placement
- Quick re-access to recently used symbols
- Filtering by search term and/or affiliation (already supported by existing tab strip)

### 6.2 Interaction Flow

The Units and Graphics panels each gain the following structure above their palette scroll area:

1. **Recently Used strip** — a horizontal row of up to 8 symbol thumbnails at the top of the palette, before any category. This strip is always visible regardless of search or category filter state. Clicking a recent item initiates placement exactly as clicking a palette item does. The strip is populated from the most recently placed unique symbols and persists in `localStorage`.

2. **Search / Filter bar** — a text input with a magnifier icon. As the user types, the palette filters in real time (no submit required) to show only items whose label contains the typed string (case-insensitive). Category headers are hidden if they would be empty after filtering. The search clears on tab switch. Clearing the input (× button or Escape when focused) restores the full palette.

3. **Category sections** — each category is a collapsible section with a disclosure triangle. The category header shows the category name and a count of items ("Ground Combat (8)"). Each category starts expanded. The user can click a category header to collapse/expand it. Collapse state persists per tab in `localStorage`.

4. **Symbol rows** — unchanged from current design: drag-to-place for units, click-to-draw for graphics. Row contains: icon SVG thumbnail + label + (for graphics) type badge.

### 6.3 Panel Layout (ASCII Wireframe) — Expanded Units Panel

```
┌──────────────────────────────────────────────────┐
│  [✚ Units]  [✚ Graphics]  [≡ Objects]            │  ← mode tabs
├──────────────────────────────────────────────────┤
│  [F] Friendly  [H] Hostile  [N] Neutral  [U] Unk │  ← affil tabs (unchanged)
├──────────────────────────────────────────────────┤
│  RECENTLY USED                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  [inf][arm][hq][fa][recon][apc][medev][uav]│  │  ← 8 icon thumbnails, scrolls if >8
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  🔍 [Filter symbols...                    ] [×]  │  ← search bar
├──────────────────────────────────────────────────┤
│  ↓ GROUND COMBAT (8)                             │  ← category header, click to collapse
│    [icon] Infantry                               │
│    [icon] Armor                                  │
│    [icon] Field Artillery                        │
│    [icon] Mechanised Infantry                    │
│    [icon] Anti-Tank                              │
│    [icon] Air Defense Artillery                  │
│    [icon] Mortar                                 │
│    [icon] Reconnaissance                         │
│                                                  │
│  ↓ GROUND EQUIPMENT (12)                         │
│    [icon] Infantry Fighting Vehicle              │
│    [icon] Armoured Personnel Carrier             │
│    [icon] Main Battle Tank                       │
│    [icon] Self-Propelled Howitzer                │
│    [icon] Towed Howitzer                         │
│    [icon] MLRS / HIMARS                          │
│    [icon] Engineering Vehicle                    │
│    [icon] MANPADS                                │
│    [icon] SHORAD System                          │
│    [icon] EW / SIGINT                            │
│    [icon] EOD                                    │
│    [icon] Military Police                        │
│                                                  │
│  ↓ COMMAND & CONTROL (6)                         │
│    [icon] HQ / Command Post                      │
│    [icon] HQ Infantry                            │
│    [icon] HQ Armor                               │
│    [icon] TAC CP                                 │
│    [icon] Main CP                                │
│    [icon] Support CP                             │
│                                                  │
│  ▸ AVIATION (8)                          [▸ show]│  ← collapsed
│  ▸ COMBAT SERVICE SUPPORT (10)                   │
│  ▸ INTELLIGENCE / ISR (8)                        │
│  ▸ MARITIME / NAVAL (10)                         │
│  ▸ SPECIAL OPERATIONS (6)                        │
│  ▸ CBRN / NBC (4)                                │
└──────────────────────────────────────────────────┘
```

### 6.4 Search State (typed "arty")

```
├──────────────────────────────────────────────────┤
│  RECENTLY USED  (always shown)                   │
│  ┌────────────────────────────────────────────┐  │
│  │  [inf][arm][hq][fa][recon][apc][medev][uav]│  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  🔍 [arty                              ] [×]     │
├──────────────────────────────────────────────────┤
│  Showing 3 results for "arty"                    │
│                                                  │
│  GROUND COMBAT                                   │
│    [icon] Field Artillery                        │
│    [icon] Air Defense Artillery                  │
│                                                  │
│  GROUND EQUIPMENT                                │
│    [icon] Self-Propelled Howitzer                │
│                                                  │
│  (no other categories shown — empty after filter)│
└──────────────────────────────────────────────────┘
```

When search is active, all category headers are shown only if they contain at least one match. The "Recently Used" strip remains visible and unfiltered — it is a quick-access mechanism, not a search result list.

### 6.5 Recently Used Strip Detail

```
RECENTLY USED
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│[inf] │[arm] │ [hq] │ [fa] │[recon│[apc] │[med] │[uav] │
│Inf.  │Armor │  HQ  │  FA  │Recon │ APC  │ Med. │ UAV  │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
 ↑ Each cell: 28px SVG icon + 9px label below, 36px wide total
 ↑ Horizontal scroll if list exceeds panel width
 ↑ Tooltip on hover: full symbol name
 ↑ Click → same as clicking in main palette
```

Storage: `localStorage.milOverlay_recentUnits` — an array of up to 8 SIDC strings in most-recently-used order. Each time a symbol is placed, its SIDC is prepended to the array; if already present, it is moved to the front. If the array exceeds 8 entries, the last entry is discarded.

### 6.6 Proposed Category Structure for 100+ Symbols

The categories are designed to align with the warfighting function structure used in US Army doctrine (FM 3-0) and MIL-STD-2525C scheme groupings:

| Category | Approx. count | MIL-STD-2525C reference |
|---|---|---|
| Ground Combat | 8–10 | S, G, U, C (combat arms) |
| Ground Equipment | 10–15 | S, G, E (equipment) |
| Command & Control | 6–8 | S, G, U, H |
| Aviation | 8–10 | S, A (air) |
| Combat Service Support | 10–12 | S, G, U, S (CSS) |
| Intelligence / ISR | 8–10 | S, G, I (intelligence) |
| Maritime / Naval | 10–12 | S, W (sea surface) + S, U (subsurface) |
| Special Operations | 6–8 | S, G, U, F (SOF) |
| CBRN / NBC | 4–6 | S, G, U, N (NBC) |
| Emergency Management | 6–8 | E scheme |

This structure deliberately avoids replicating the MIL-STD-2525C appendix hierarchy exactly (which is organised by battle dimension), in favour of the warfighter's mental model: "What mission function am I planning for?" This aligns with how operators build an overlay — they think "I need to place CSS elements" not "I need to find something in scheme S, battle dimension G, function U, sub S."

### 6.7 Key Design Decisions and Rationale

**Recently Used strip always visible, never filtered.** Operators developing a plan repeatedly place the same 3–5 symbol types. The "Recently Used" strip provides a shortcut to these without navigation. It must always be visible because it is a navigation aid, not a search result. Filtering it out when search is active would break the shortcut function at the exact moment the operator is already struggling to find something.

**Search filters the palette in real time, no submit.** Real-time filtering removes the round-trip friction of submitting a search query. In a C2 tool context, operators typically know the symbol name or abbreviation they need; a 2–3 character prefix is usually sufficient to narrow a 100-item list to 3–5 results.

**Category collapse persisted in localStorage.** Experienced operators will develop a preference for which categories they leave open. Persisting this preference avoids the need to re-collapse the same categories on every session.

**Category names aligned to warfighter mission function, not MIL-STD appendix structure.** The standard's organisational hierarchy (battle dimension → function → sub-function) is correct for a reference document but not for a tool where the user is thinking operationally. "Ground Equipment" is more intuitive than "Warfighting — Ground — Equipment" as a palette category label.

---

## 7. Coordinate Entry Toolbar

### 7.1 Interaction Flow

The Coordinate Entry toolbar is a **floating input strip** positioned at the top-centre of the map canvas. It is visible at all times and does not collapse by default, but can be hidden by the user with a close button (state persisted in `localStorage`). It is positioned to avoid overlapping the existing Google Maps map type control (top-right).

The toolbar has two modes, toggled by a small format button:

- **MGRS mode** (default for land operations) — accepts a standard MGRS grid reference string (e.g., `37TGH 12345 67890`)
- **Lat/Long mode** — accepts decimal degrees (e.g., `36.8512, -76.2914`) or degrees/minutes/seconds (e.g., `36°51'04"N 76°17'29"W`)

The mode toggle button cycles between these two modes and updates the input placeholder accordingly.

**Fly to / Go to:** After typing a coordinate and pressing Enter (or clicking the Go button), the map pans and zooms to centre the coordinate. A temporary crosshair marker (a simple `+` SVG) appears at the coordinate for 4 seconds and then fades. No object is placed.

**Place symbol at coordinate:** If the user has a symbol selected in the palette (unit or graphic), pressing Shift+Enter (or clicking the "Place Here" button that appears alongside Go when a palette item is selected) places the currently selected symbol at the entered coordinate and immediately opens the Attr Panel or name modal as appropriate. This satisfies the operational workflow: "I have a grid reference from a report — place this unit at that location."

**MGRS parsing:** The application integrates a client-side MGRS library (e.g., `mgrs` npm package, available as a CDN script). The library converts MGRS strings to WGS-84 lat/lng. Parsing errors show an inline validation message below the input field ("Invalid MGRS — check grid zone designator").

**Validation feedback** is inline, below the input:
- Valid coordinate: green underline on input + "Go" button becomes active
- Malformed input: red underline + error message (e.g., "Invalid MGRS — expected format: 37TGH 12345 67890")
- Out-of-bounds: orange underline + "Coordinate is outside map coverage area"

### 7.2 Toolbar Layout (ASCII Wireframe)

```
Map canvas — top-centre, z-index above map controls:

     ┌─────────────────────────────────────────────────────────────┐
     │ 📍 [MGRS ▾]  [37TGH 12345 67890               ] [Go] [×] │
     └─────────────────────────────────────────────────────────────┘
              ↑             ↑                           ↑    ↑
          format           input field               action close
          toggle      (placeholder shown in grey)    button button

Validation state — invalid MGRS:
     ┌─────────────────────────────────────────────────────────────┐
     │ 📍 [MGRS ▾]  [37TGH 123XX 67890    ← Invalid MGRS  ] [Go] │
     └────────────────────────────────────── ↑ ───────────────────┘
                                   inline validation (red text)

When a palette item is active (user clicked a symbol in palette):
     ┌──────────────────────────────────────────────────────────────────────┐
     │ 📍 [MGRS ▾]  [37TGH 12345 67890               ] [Go] [Place Here ✦] │
     └──────────────────────────────────────────────────────────────────────┘
                                                             ↑
                                                  "Place Here" appears only when
                                                  a palette item is selected
```

**Lat/Long mode appearance:**
```
     ┌─────────────────────────────────────────────────────────────┐
     │ 📍 [Lat/Lon▾]  [36.8512, -76.2914                ] [Go] [×] │
     └─────────────────────────────────────────────────────────────┘
```

### 7.3 Toolbar Positioning and Layering

The toolbar is a `position: absolute` `div` placed inside `#map-wrap`, centred horizontally with `left: 50%; transform: translateX(-50%)`, and positioned `top: 10px`. It has `z-index: 15` (above map controls but below modals). A subtle drop shadow provides separation from the map tile surface. Background is the same dark panel colour as the sidebar (`#161b22`) with `rgba` opacity so the map is faintly visible behind it.

Width: `min-content` but clamped to a maximum of 520 px and a minimum of 320 px (responsive). The toolbar wraps gracefully at 320 px by placing the Go / Place Here buttons on a second row.

### 7.4 MGRS Input Parsing Rules

The input parser must accept MGRS strings with or without spaces and in both uppercase and lowercase:

| Input form | Example |
|---|---|
| Standard with spaces | `37TGH 12345 67890` |
| Compact no spaces | `37TGH1234567890` |
| Partial precision (4-digit) | `37TGH 1234 6789` |
| Partial precision (2-digit) | `37TGH 12 67` |
| Lowercase | `37tgh 12345 67890` |

The parser returns a `{ lat, lng }` object. If parsing fails, it returns `null` and the validation message is shown.

For Lat/Long mode, the parser accepts:
- Decimal degrees with comma separator: `36.8512, -76.2914`
- Decimal degrees with space separator: `36.8512 -76.2914`
- DMS format: `36°51'04"N 76°17'29"W`

### 7.5 "Go" Behaviour (fly-to)

On valid coordinate submission:

1. Call `map.panTo({ lat, lng })`.
2. If current zoom < 12, call `map.setZoom(12)` to bring the user to a useful scale for the coordinate (this prevents the user entering a grid and seeing a dot in the middle of a continent-scale view).
3. Place a temporary crosshair overlay: an `OverlayView` subclass that draws a `+` symbol (20 px arms) at the target coordinate using a `<canvas>` or SVG. The crosshair is removed after 4 000 ms with a CSS opacity fade.
4. If the input is an MGRS with precision less than 4 digits (i.e., the referenced area is > 1 km²), draw a faint rectangle bounding box around the referenced grid square instead of a crosshair point.

### 7.6 Key Design Decisions and Rationale

**MGRS default, not decimal degrees.** Land warfare operations are planned and communicated in MGRS. Defaulting to decimal degrees would force operators to mentally convert every grid reference they receive. The format toggle is present for joint operations contexts (aviation, naval) where lat/lng may be more natural.

**Top-centre position on the map canvas rather than in the sidebar.** The coordinate entry is a map navigation tool, not a symbol tool. Placing it on the map canvas keeps it contextually co-located with the map, and the top-centre position makes it visible without interfering with the left sidebar symbol workflow.

**Fly-to without placement as the default Enter action.** Operators often need to navigate to a location before deciding what to place there. Separating navigation (Go) from placement (Place Here) avoids accidental symbol placement when the user is only trying to navigate. The "Place Here" button appearing only when a symbol is already selected in the palette makes the combined flow explicit.

**Inline validation, not alert dialogs.** Alert dialogs (`window.alert()`) block the browser. Inline validation is non-blocking, contextual, and dismissible without action. MGRS errors are common — a wrong grid zone designator letter, a transposed digit — and the operator must be able to correct the input quickly without dismissing an alert.

**4-second crosshair fade.** A permanent marker placed at every navigation target would pollute the map. A fading temporary crosshair communicates "this is where you navigated to" without adding a permanent object that the operator must then remove.

---

## Appendix A: Application State Extensions Required

To support all seven design areas, the following additions to the application state model are needed:

| Addition | Location | Notes |
|---|---|---|
| `modifiers` object on each `placedUnits[]` entry | In-memory + `localStorage` | Holds all Attr Panel fields; used for GeoJSON export and milsymbol re-render |
| `visible` boolean on each placed object | In-memory + `localStorage` | Default `true`; toggled by Object Manager |
| `name` string on each placed object | In-memory (already exists as `label`) | Rename via Object Manager writes back to this field and updates map label |
| `undoStack[]` and `redoStack[]` | Module-level variables | Max 50 entries each |
| `recentUnits[]` | `localStorage` key `milOverlay_recentUnits` | Array of up to 8 SIDC strings |
| `recentGraphics[]` | `localStorage` key `milOverlay_recentGraphics` | Array of up to 8 TG def labels |
| `coordMode` | `localStorage` key `milOverlay_coordMode` | `'mgrs'` or `'latlng'` |
| `paletteCollapseState` | `localStorage` key `milOverlay_paletteCollapse` | Object mapping category name → boolean |
| `objectManagerCollapseState` | `localStorage` key `milOverlay_omCollapse` | Object mapping group name → boolean |

---

## Appendix B: Interaction State Machine

The application requires a clear state machine to manage the different cursor modes and input contexts. The states and legal transitions are:

```
         ┌──────────┐
         │   IDLE   │◄──────────────────────────────────────┐
         └────┬─────┘                                       │
              │ drag unit from palette       Escape / Done / Cancel
              ▼                                             │
         ┌──────────┐                                       │
         │ DRAGGING │──► drop on map ──► IDLE (unit placed) │
         └──────────┘                                       │
              │ click TG palette item                       │
              ▼                                             │
         ┌──────────┐                                       │
         │ DRAWING  │──► Escape ──────────────────────────►─┤
         └────┬─────┘                                       │
              │ double-click / Finish button                │
              ▼                                             │
         ┌──────────┐                                       │
         │ NAMING   │──► Enter / Skip ──► IDLE (TG placed) ─┤
         └──────────┘                                       │
              │ click placed unit marker                    │
              ▼                                             │
         ┌──────────┐                                       │
         │ SELECTED │──► click empty map ──────────────────►┤
         │ (Attr    │◄──────────────────────────────────────┘
         │  Panel)  │──► click "Edit Shape" (TG only)
         └────┬─────┘              │
              │ click placed TG    ▼
              │            ┌────────────────┐
              │            │ RESHAPING      │──► Done/Enter ──► SELECTED ──► IDLE
              │            │ (vertex edit)  │──► Cancel ──────► SELECTED ──► IDLE
              │            └────────────────┘
              │ Escape ──► IDLE
```

Only one state is active at a time. Entering DRAWING, DRAGGING, or RESHAPING exits any active SELECTED state (closes Attr Panel). The Object Manager panel is visible in all states.

---

## Appendix C: Colour and Typography Reference

These values extend the existing design language observed in `index.html`:

| Token | Value | Usage |
|---|---|---|
| `--col-bg-panel` | `#161b22` | Sidebar, Attr Panel, Object Manager |
| `--col-bg-deep` | `#0d1117` | Input backgrounds, map area |
| `--col-border` | `#30363d` | Panel borders, dividers |
| `--col-border-active` | `#388bfd` | Active input, selected row accent |
| `--col-text-primary` | `#e6edf3` | Body text |
| `--col-text-secondary` | `#8b949e` | Labels, hints, disabled text |
| `--col-text-muted` | `#484f58` | Category headers, placeholders |
| `--col-accent-blue` | `#58a6ff` | Mode tab active, links |
| `--col-accent-green` | `#3fb950` | Friendly affiliation, success |
| `--col-accent-red` | `#f85149` | Hostile affiliation, delete, error |
| `--col-accent-yellow` | `#e3b341` | Neutral / warning |
| `--col-accent-grey` | `#a5d6ff` | Unknown affiliation |
| `--col-header-bg` | `#0d3750` | Sidebar header |
| `--col-header-border` | `#1f6f8b` | Sidebar header bottom border |
| Font | `'Segoe UI', Arial, sans-serif` | Body |
| Font mono | `'Courier New', monospace` | SIDC display, JSON preview |
| Base font size | `11–13 px` | Panel text |
| Panel animation | `120 ms ease-out` | Slide, collapse transitions |

---

*End of UX Design Document*
