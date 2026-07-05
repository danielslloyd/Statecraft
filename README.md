# Statecraft

Two classic grand-strategy board games in one vanilla-JS app, playable on
**arbitrary polygon maps** with an explicit **connection graph**:

- **Diplomacy** — 7 powers, simultaneous orders, supports, convoys, retreats
  and winter builds. First to a majority of supply centers wins.
- **Risk** — territory deal, reinforcements, continent bonuses, card sets,
  3v2 dice combat, fortify. Last player standing wins.

No build step, no dependencies: open `index.html` in a browser.

## Playing

- Pick a mode on the menu. Diplomacy: choose your power (or spectate an
  all-bot game). Risk: choose player count and how many are human (hotseat);
  the rest are bots.
- **Show connection graph** (top right) overlays the adjacency graph — the
  authoritative view of which territories connect. Connections whose polygons
  don't touch (sea routes like Brazil–North Africa or Alaska–Kamchatka) are
  always drawn as dashed lines.
- Diplomacy: click a unit, pick an order type, click the highlighted
  targets. Unordered units hold. Submit to resolve the turn.
- Risk: reinforce by clicking your territories, attack by clicking source
  then adjacent enemy (one roll per click), fortify once, end your turn.

## Maps

Both modes run on the same map format: polygon territories (rendered as SVG)
plus an edge list. Geometry is presentation only — adjacency comes solely
from the graph. The format and its requirements are specified in
[MAP_REQUIREMENTS.md](MAP_REQUIREMENTS.md).

The shipped maps (`maps/`) are generated from seed points + adjacency lists
by `node tools/gen-maps.js` (polygons are Voronoi cells).

## Development

```
node tools/gen-maps.js   # regenerate maps/*.js
node tests/smoke.js      # validate maps, run bot-vs-bot games of both modes
```

Layout:

```
index.html, styles.css     UI shell
js/mapcore.js              map validation + graph utilities
js/board.js                SVG board renderer (polygons, graph layer, pieces)
js/diplomacy.js            Diplomacy engine + bot
js/risk.js                 Risk engine + bot
js/dip-ui.js, js/risk-ui.js, js/main.js   mode UIs and app shell
maps/                      generated map data
tools/gen-maps.js          map generator
tests/smoke.js             headless smoke tests
legacy/                    previous implementation (client + servers)
```

Known simplifications: Diplomacy has no split coasts (St Petersburg, Spain,
Bulgaria are single-coast) and fleets may move between any two adjacent
non-inland territories; convoy paradoxes resolve by disrupting the convoy.
Risk skips the 2-player neutral-army variant and mid-battle forced trades.

## License

MIT
