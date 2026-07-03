# Statecraft Map Requirements

Both game modes (Diplomacy and Risk) run on the same map format: a set of
**polygon territories** rendered as SVG, plus an explicit **connection graph**
that says which territories border each other. The two layers are independent
on purpose:

- The **polygon layer** is presentation. Polygons *should* share borders where
  territories touch, but nothing is inferred from geometry.
- The **graph layer** is the single source of truth for legality: movement,
  attacks, supports, convoys, and fortify paths all consult the edge list and
  nothing else. Two territories whose polygons touch but have no edge are NOT
  adjacent in play; two territories an ocean apart WITH an edge are.

`MapCore.validateMap(map)` (js/mapcore.js) machine-checks every MUST rule
below and is run by the app at startup and by `node tests/smoke.js`.

## 1. Top-level format

Maps are plain JSON-compatible objects registered in
`window.STATECRAFT_MAPS[id]` (ship one `maps/<id>.js` file per map):

```js
{
  id: 'classic-world',        // unique, lowercase [a-z][a-z0-9_]*
  name: 'Classic World',
  modes: ['risk'],            // any of: 'diplomacy', 'risk'
  width: 1200, height: 800,   // coordinate space (SVG viewBox)
  territories: { <tid>: Territory, ... },
  edges: [ ['alaska','kamchatka'], ... ],
  diplomacy: { ... },         // required iff modes includes 'diplomacy'
  risk: { ... }               // required iff modes includes 'risk'
}
```

## 2. Territory requirements

```js
territories: {
  brazil: {
    name: 'Brazil',
    terrain: 'land',          // 'land' | 'coast' | 'sea'
    center: [395, 550],
    polygon: [[x,y], [x,y], ...]
  }
}
```

- **MUST**: ids match `[a-z][a-z0-9_]*` and are unique; at least 2 territories.
- **MUST**: `polygon` is a closed simple ring of ≥ 3 finite `[x,y]` points,
  all inside `[0,width] × [0,height]`. (Self-intersection is reported as a
  warning; fix it — hit testing and fills misbehave on figure-eights.)
- **MUST**: `center` lies **inside** the polygon. It anchors units, army
  badges, labels, graph nodes, and arrow endpoints.
- **SHOULD**: polygons of territories that are graph-adjacent share a border
  visually. When they don't (sea routes, straits, tunnels), the renderer
  automatically draws a dashed route line between the two centers — budget
  for that visual noise; don't rely on it for dozens of edges.
- **SHOULD**: polygons don't overlap each other. Gaps are fine (they render
  as background "ocean"); overlaps make click hit-testing ambiguous.
- `terrain` is required for Diplomacy maps (`sea` = fleets only,
  `land` = armies only, `coast` = both). Risk ignores terrain except that
  `sea` territories are not conquerable and need no continent.

## 3. Graph requirements

- **MUST**: every edge references two existing, distinct territories; no
  duplicate edges (the list is undirected — one entry per pair).
- **MUST**: the graph is **connected** — every territory reachable from every
  other. (For Diplomacy this includes sea territories: fleets must be able to
  reach them.)
- **MUST**: no isolated territories (degree ≥ 1).
- **SHOULD**: keep degree in the 2–7 range. Degree-1 territories are
  dead-end pockets (fine sparingly: Portugal, Madagascar); degree > 8 makes
  a territory dominate the map.
- **SHOULD (Diplomacy)**: every `sea`/`coast` region belongs to a contiguous
  body of water so fleets have sensible cruising routes, and every supply
  center is reachable by armies of at least two different powers — otherwise
  the map can stalemate trivially.

## 4. Diplomacy layer

```js
diplomacy: {
  powers: { AUSTRIA: { name: 'Austria-Hungary', color: '#c0392b' }, ... },
  supplyCenters: ['vie', 'bud', ...],       // land/coast only
  homeCenters: { AUSTRIA: ['vie','bud','tri'], ... },
  startingUnits: { AUSTRIA: [{ territory:'vie', type:'army' }, ...], ... },
  victorySupplyCenters: 18,
  startYear: 1901
}
```

- **MUST**: ≥ 2 powers; every power has ≥ 1 home center; home centers are
  supply centers; supply centers are not `sea`.
- **MUST**: starting armies are not at `sea`; starting fleets are not inland.
- **MUST**: `victorySupplyCenters` ≤ total supply centers. **SHOULD** be a
  strict majority (the validator warns otherwise).
- **SHOULD**: 3–4 starting units and home centers per power, roughly one
  supply center per ~2 territories overall, and neutral supply centers spread
  between powers so the opening isn't a coin flip.

## 5. Risk layer

```js
risk: {
  continents: {
    europe: { name: 'Europe', bonus: 5, color: '#4a7fb5',
              territories: ['iceland', 'gbr', ...] }
  }
}
```

- **MUST**: every non-`sea` territory belongs to **exactly one** continent;
  continent bonuses ≥ 0; continents are non-empty and reference real
  territories.
- **SHOULD**: ≥ 12 conquerable territories (warned below that), and
  territory count comfortably above the player count so the initial deal
  isn't degenerate. Continent bonus rule of thumb: roughly
  `#border territories of the continent`, so remote 4-territory continents
  (Australia) pay 2 and sprawling ones (Asia) pay 7.

## 6. Rendering contract

Things a map author gets for free and shouldn't duplicate:

- Territory fill: terrain default (paper for land/coast, blue for sea),
  tinted by owner color during play.
- Dashed **route lines** for graph edges whose polygons don't touch.
- The **graph overlay** (toggle in the game header): a node at every
  `center`, a line for every edge — this is the authoritative adjacency
  view for players.
- Labels (`name` at `center`), supply-center stars, unit/army markers,
  order arrows.

## 7. Authoring workflow

The shipped maps are *generated*: territories are authored as seed points +
edge list in `tools/gen-maps.js`, and polygons are derived as Voronoi cells,
which satisfies the polygon rules by construction. To add a map that way:

1. Add seed coordinates, adjacency, and mode layer(s) in `tools/gen-maps.js`.
2. `node tools/gen-maps.js` — writes `maps/<id>.js`.
3. Add a `<script src="maps/<id>.js">` tag to `index.html`.
4. `node tests/smoke.js` — validation must pass.

Hand-drawn polygon maps (e.g. traced from real geography) are equally valid:
produce the same object shape by any means, keep every MUST above, and
register it the same way.
