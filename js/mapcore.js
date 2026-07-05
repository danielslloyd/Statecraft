// Map core: schema validation and graph utilities shared by both game modes.
// The rules enforced here are the machine-checkable half of MAP_REQUIREMENTS.md.

const MapCore = (() => {

    const ID_RE = /^[a-z][a-z0-9_]*$/

    // ---- geometry helpers ----

    function pointInPolygon(x, y, poly) {
        let inside = false
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, yi] = poly[i]
            const [xj, yj] = poly[j]
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                inside = !inside
            }
        }
        return inside
    }

    function segmentsIntersect(a, b, c, d) {
        const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
        const d1 = cross(c, d, a)
        const d2 = cross(c, d, b)
        const d3 = cross(a, b, c)
        const d4 = cross(a, b, d)
        return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
    }

    function polygonIsSimple(poly) {
        const n = poly.length
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                // skip adjacent edges (share a vertex)
                if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
                if (segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) {
                    return false
                }
            }
        }
        return true
    }

    function polygonsTouch(a, b, tolerance = 1.5) {
        // Heuristic used only for rendering (deciding whether an adjacency needs
        // a drawn route line). Checks whether any vertex of one polygon lies on
        // or near an edge of the other.
        const nearEdge = (p, poly) => {
            for (let i = 0; i < poly.length; i++) {
                const q = poly[i]
                const r = poly[(i + 1) % poly.length]
                const dx = r[0] - q[0], dy = r[1] - q[1]
                const len2 = dx * dx + dy * dy
                if (len2 === 0) continue
                let t = ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / len2
                t = Math.max(0, Math.min(1, t))
                const px = q[0] + t * dx - p[0]
                const py = q[1] + t * dy - p[1]
                if (px * px + py * py <= tolerance * tolerance) return true
            }
            return false
        }
        return a.some(p => nearEdge(p, b)) || b.some(p => nearEdge(p, a))
    }

    // ---- graph helpers ----

    function buildAdjacency(map) {
        const adj = {}
        for (const id of Object.keys(map.territories)) adj[id] = []
        for (const [a, b] of map.edges) {
            adj[a].push(b)
            adj[b].push(a)
        }
        return adj
    }

    function connectedComponent(adj, start) {
        const seen = new Set([start])
        const queue = [start]
        while (queue.length) {
            const cur = queue.pop()
            for (const next of adj[cur] || []) {
                if (!seen.has(next)) {
                    seen.add(next)
                    queue.push(next)
                }
            }
        }
        return seen
    }

    // BFS shortest path over territories passing a filter; returns list of
    // territory ids from start to goal inclusive, or null.
    function shortestPath(adj, start, goal, canEnter) {
        if (start === goal) return [start]
        const prev = { [start]: null }
        const queue = [start]
        while (queue.length) {
            const cur = queue.shift()
            for (const next of adj[cur] || []) {
                if (next in prev) continue
                if (next !== goal && !canEnter(next)) continue
                prev[next] = cur
                if (next === goal) {
                    const path = [goal]
                    let p = cur
                    while (p !== null) { path.push(p); p = prev[p] }
                    return path.reverse()
                }
                queue.push(next)
            }
        }
        return null
    }

    // ---- validation ----

    function validateMap(map) {
        const errors = []
        const warnings = []
        const err = m => errors.push(m)
        const warn = m => warnings.push(m)

        if (!map || typeof map !== 'object') return { ok: false, errors: ['map is not an object'], warnings }
        for (const field of ['id', 'name', 'width', 'height', 'territories', 'edges', 'modes']) {
            if (!(field in map)) err(`missing field: ${field}`)
        }
        if (errors.length) return { ok: false, errors, warnings }

        const ids = Object.keys(map.territories)
        if (ids.length < 2) err('map needs at least 2 territories')

        for (const id of ids) {
            const t = map.territories[id]
            if (!ID_RE.test(id)) err(`territory id '${id}' must match ${ID_RE}`)
            if (!t.name) err(`territory '${id}' missing name`)
            if (!Array.isArray(t.polygon) || t.polygon.length < 3) {
                err(`territory '${id}' polygon needs >= 3 points`)
                continue
            }
            for (const p of t.polygon) {
                if (!Array.isArray(p) || p.length !== 2 || !isFinite(p[0]) || !isFinite(p[1])) {
                    err(`territory '${id}' has a malformed polygon point`)
                } else if (p[0] < 0 || p[0] > map.width || p[1] < 0 || p[1] > map.height) {
                    err(`territory '${id}' polygon point outside map bounds`)
                }
            }
            if (!Array.isArray(t.center) || !pointInPolygon(t.center[0], t.center[1], t.polygon)) {
                err(`territory '${id}' center must lie inside its polygon`)
            }
            if (!polygonIsSimple(t.polygon)) warn(`territory '${id}' polygon self-intersects`)
        }

        const seenEdges = new Set()
        for (const e of map.edges) {
            if (!Array.isArray(e) || e.length !== 2) { err('malformed edge entry'); continue }
            const [a, b] = e
            if (!(a in map.territories)) err(`edge references unknown territory '${a}'`)
            if (!(b in map.territories)) err(`edge references unknown territory '${b}'`)
            if (a === b) err(`self-loop edge on '${a}'`)
            const key = a < b ? `${a}|${b}` : `${b}|${a}`
            if (seenEdges.has(key)) err(`duplicate edge ${a}-${b}`)
            seenEdges.add(key)
        }

        if (!errors.length) {
            const adj = buildAdjacency(map)
            const component = connectedComponent(adj, ids[0])
            if (component.size !== ids.length) {
                err(`graph is not connected (${component.size}/${ids.length} reachable from '${ids[0]}')`)
            }
            for (const id of ids) {
                if (!adj[id].length) err(`territory '${id}' has no connections`)
            }
        }

        if (map.modes.includes('diplomacy')) validateDiplomacyLayer(map, err, warn)
        if (map.modes.includes('risk')) validateRiskLayer(map, err, warn)

        return { ok: errors.length === 0, errors, warnings }
    }

    function validateDiplomacyLayer(map, err, warn) {
        const d = map.diplomacy
        if (!d) return err("mode 'diplomacy' declared but no diplomacy layer")
        const ids = Object.keys(map.territories)

        for (const id of ids) {
            const terrain = map.territories[id].terrain
            if (!['land', 'coast', 'sea'].includes(terrain)) {
                err(`territory '${id}' needs terrain land|coast|sea for diplomacy`)
            }
        }
        if (!d.powers || Object.keys(d.powers).length < 2) err('diplomacy needs >= 2 powers')
        const scSet = new Set(d.supplyCenters || [])
        for (const sc of scSet) {
            if (!(sc in map.territories)) err(`supply center '${sc}' is not a territory`)
            else if (map.territories[sc].terrain === 'sea') err(`supply center '${sc}' cannot be a sea territory`)
        }
        for (const power of Object.keys(d.powers || {})) {
            const homes = (d.homeCenters || {})[power] || []
            if (!homes.length) err(`power '${power}' has no home supply centers`)
            for (const h of homes) {
                if (!scSet.has(h)) err(`home center '${h}' of ${power} is not in supplyCenters`)
            }
            for (const u of (d.startingUnits || {})[power] || []) {
                const t = map.territories[u.territory]
                if (!t) { err(`${power} starting unit on unknown territory '${u.territory}'`); continue }
                if (u.type === 'fleet' && t.terrain === 'land') err(`${power} fleet cannot start on inland '${u.territory}'`)
                if (u.type === 'army' && t.terrain === 'sea') err(`${power} army cannot start at sea '${u.territory}'`)
            }
        }
        if (!d.victorySupplyCenters || d.victorySupplyCenters > scSet.size) {
            err('victorySupplyCenters must be set and <= total supply centers')
        }
        if (d.victorySupplyCenters <= scSet.size / 2) {
            warn('victorySupplyCenters is not a majority of supply centers')
        }
    }

    function validateRiskLayer(map, err, warn) {
        const r = map.risk
        if (!r) return err("mode 'risk' declared but no risk layer")
        const assigned = new Map()
        for (const cid of Object.keys(r.continents || {})) {
            const c = r.continents[cid]
            if (typeof c.bonus !== 'number' || c.bonus < 0) err(`continent '${cid}' needs bonus >= 0`)
            if (!c.territories || !c.territories.length) err(`continent '${cid}' has no territories`)
            for (const t of c.territories || []) {
                if (!(t in map.territories)) err(`continent '${cid}' references unknown territory '${t}'`)
                if (assigned.has(t)) err(`territory '${t}' is in continents '${assigned.get(t)}' and '${cid}'`)
                assigned.set(t, cid)
            }
        }
        for (const id of Object.keys(map.territories)) {
            if (map.territories[id].terrain === 'sea') continue // sea territories are not conquerable
            if (!assigned.has(id)) err(`territory '${id}' belongs to no continent`)
        }
        if (Object.keys(map.territories).filter(id => map.territories[id].terrain !== 'sea').length < 12) {
            warn('fewer than 12 conquerable territories; risk games will be very short')
        }
    }

    return {
        validateMap,
        buildAdjacency,
        shortestPath,
        pointInPolygon,
        polygonsTouch,
        connectedComponent
    }
})()

if (typeof module !== 'undefined' && module.exports) module.exports = MapCore
