# CLAUDE.md - AI Assistant Guide for Statecraft

## Project Overview

**Statecraft** hosts two board-game modes — a **Diplomacy** clone and a
**Risk** clone — that both run on arbitrary polygon maps with an explicit
connection graph. Vanilla JavaScript + SVG, no build tools, no dependencies.
Open `index.html` in a browser to play.

The previous (canvas-based, Diplomacy-only) implementation lives untouched in
`legacy/`, including its web/SMS servers. Don't extend it; it exists for
reference only.

## Architecture

Two ironclad design rules:

1. **The graph is the source of truth.** All legality (moves, attacks,
   supports, convoys, fortify paths) is decided by the map's `edges` list.
   Polygons are presentation only; nothing is ever inferred from geometry.
2. **Engines are UI-free and browser-free.** `js/diplomacy.js` and
   `js/risk.js` (plus `js/mapcore.js`) run headless under Node — that's how
   the tests work. Keep DOM code in `js/board.js`, `js/*-ui.js`, `js/main.js`.

### Files

| File | Role |
|------|------|
| `js/mapcore.js` | `MapCore.validateMap` (enforces MAP_REQUIREMENTS.md), adjacency building, BFS, point-in-polygon |
| `js/board.js` | `Board`: SVG renderer. Static layers (polygons, dashed route lines, labels, graph overlay) built once; dynamic scene (`fills/highlights/markers/units/badges/arrows`) re-rendered declaratively via `board.render(scene)` |
| `js/diplomacy.js` | `DiplomacyGame` (state machine: orders → retreats → builds), iterative adjudicator, `DiplomacyBot` |
| `js/risk.js` | `RiskGame` (reinforce → attack → fortify), dice, cards, continents, `RiskBot` |
| `js/dip-ui.js`, `js/risk-ui.js` | Mode controllers: click state machines + side-panel rendering |
| `js/main.js` | Menu, screen switching, `app` shell object passed to mode UIs |
| `maps/*.js` | **Generated** map data — never edit by hand |
| `tools/gen-maps.js` | Map generator: seeds + adjacency → Voronoi polygons → `maps/*.js` |
| `tests/smoke.js` | Headless tests: map validation, adjudication cases, full bot-vs-bot games with invariant checks |
| `MAP_REQUIREMENTS.md` | Map format spec (the MUSTs are what `validateMap` enforces) |

### Map format (summary — full spec in MAP_REQUIREMENTS.md)

```js
{ id, name, modes: ['diplomacy'|'risk'], width, height,
  territories: { tid: { name, terrain: 'land'|'coast'|'sea', center, polygon } },
  edges: [[a, b], ...],              // undirected, deduped, connected
  diplomacy: { powers, supplyCenters, homeCenters, startingUnits,
               victorySupplyCenters, startYear },
  risk: { continents: { cid: { name, bonus, color, territories } } } }
```

Maps register themselves in `window.STATECRAFT_MAPS` (and `module.exports`
for Node). To change a shipped map, edit the data tables in
`tools/gen-maps.js` and rerun it — `maps/*.js` files carry a generated-file
header for a reason.

## Development workflow

```bash
node tools/gen-maps.js   # regenerate maps after editing generator data
node tests/smoke.js      # MUST pass before committing engine/map changes
```

Then open `index.html` (hard refresh) and check the browser console — maps
are re-validated at startup and failures are logged there.

There is no test framework; `tests/smoke.js` is plain Node with a local
`assert`. Extend it when you touch adjudication or engine rules — the
existing style is: set up a `DiplomacyGame` with a seeded RNG, issue orders,
resolve, assert territories.

## Rules fidelity notes

Diplomacy adjudicator (`_adjudicateOnce`) implements: strength comparison
with supports, support cutting (not from the attacked province, never by own
power), no self-dislodgement, supports-from-defender's-power don't count
toward dislodging it, head-to-head battles, movement cycles (rotations
succeed), convoy path BFS + disruption re-runs, retreat exclusions (attacker
origin + standoff provinces), builds only in owned vacant home centers.

Deliberate simplifications — keep them unless asked: no split coasts;
fleet movement allowed between any two adjacent non-inland territories;
convoy paradoxes resolve by disrupting the convoy; no forced mid-battle card
trades in Risk; no 2-player Risk neutral armies.

## Conventions

- ES6+, no semicolons, single quotes, 4-space indent
- `SCREAMING_SNAKE_CASE` constants, `camelCase` functions, `PascalCase` classes
- Engines throw `Error` on illegal API calls (UI is expected to pre-filter
  with `canAttack`/`legalOrders`/etc.)
- UI color scheme: background `#1a1a2e`, panels `#16213e`, accent `#e94560`,
  borders `#0f3460`
- No frameworks, no npm dependencies, no build step — keep it vanilla

## What NOT to do

- Don't edit `maps/*.js` by hand (regenerate via `tools/gen-maps.js`)
- Don't let engines touch the DOM or `window`
- Don't infer adjacency from polygon geometry
- Don't add build tooling or frameworks unless explicitly requested
- Don't resurrect `legacy/` code paths
