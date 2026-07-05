// Board: SVG renderer for polygon maps. Mode-agnostic — game UIs describe
// what to draw (fills, units, badges, arrows, highlights) and the board
// renders it. Adjacency comes from the map's edge list only.

const SVG_NS = 'http://www.w3.org/2000/svg'

class Board {
    constructor(container, map, options = {}) {
        this.map = map
        this.adj = MapCore.buildAdjacency(map)
        this.options = options
        this.clickHandler = null
        this.hoverHandler = null
        this.graphVisible = false

        container.innerHTML = ''
        this.svg = el('svg', {
            viewBox: `0 0 ${map.width} ${map.height}`,
            class: 'board-svg',
            preserveAspectRatio: 'xMidYMid meet'
        })
        container.appendChild(this.svg)

        this.defs = el('defs')
        this.svg.appendChild(this.defs)
        this._buildArrowMarkers()

        // static layers (built once) then dynamic layers (rebuilt per render)
        this.layers = {}
        for (const name of ['base', 'routes', 'highlight', 'markers', 'arrows', 'labels', 'pieces', 'graph']) {
            this.layers[name] = el('g', { class: `layer-${name}` })
            this.svg.appendChild(this.layers[name])
        }

        this.polys = {}
        this._buildBase()
        this._buildRoutes()
        this._buildLabels()
        this._buildGraphLayer()
        this.layers.graph.style.display = 'none'
    }

    terrainFill(tid) {
        const t = this.map.territories[tid]
        if (t.terrain === 'sea') return '#31506e'
        return '#cfc5ad'
    }

    _buildBase() {
        this.svg.insertBefore(
            el('rect', { x: 0, y: 0, width: this.map.width, height: this.map.height, class: 'board-bg' }),
            this.layers.base
        )
        for (const tid of Object.keys(this.map.territories)) {
            const t = this.map.territories[tid]
            const poly = el('polygon', {
                points: t.polygon.map(p => p.join(',')).join(' '),
                class: 'territory' + (t.terrain === 'sea' ? ' territory-sea' : ''),
                fill: this.terrainFill(tid),
                'data-tid': tid
            })
            poly.addEventListener('click', e => {
                e.stopPropagation()
                if (this.clickHandler) this.clickHandler(tid)
            })
            poly.addEventListener('mouseenter', () => this.hoverHandler && this.hoverHandler(tid))
            poly.addEventListener('mouseleave', () => this.hoverHandler && this.hoverHandler(null))
            this.layers.base.appendChild(poly)
            this.polys[tid] = poly
        }
    }

    // Adjacent territories whose polygons do not share a border still connect;
    // draw those connections as dashed sea/air routes so players can see them
    // without the graph layer.
    _buildRoutes() {
        for (const [a, b] of this.map.edges) {
            const ta = this.map.territories[a]
            const tb = this.map.territories[b]
            if (MapCore.polygonsTouch(ta.polygon, tb.polygon)) continue
            const d = curvePath(ta.center, tb.center, 0.18)
            this.layers.routes.appendChild(el('path', { d, class: 'route-line' }))
        }
    }

    _buildLabels() {
        for (const tid of Object.keys(this.map.territories)) {
            const t = this.map.territories[tid]
            const label = el('text', {
                x: t.center[0], y: t.center[1] + 24,
                class: 'territory-label' + (t.terrain === 'sea' ? ' territory-label-sea' : '')
            })
            label.textContent = t.name
            this.layers.labels.appendChild(label)
        }
    }

    _buildGraphLayer() {
        for (const [a, b] of this.map.edges) {
            const [x1, y1] = this.map.territories[a].center
            const [x2, y2] = this.map.territories[b].center
            this.layers.graph.appendChild(el('line', { x1, y1, x2, y2, class: 'graph-edge' }))
        }
        for (const tid of Object.keys(this.map.territories)) {
            const [cx, cy] = this.map.territories[tid].center
            const t = this.map.territories[tid]
            this.layers.graph.appendChild(el('circle', {
                cx, cy, r: 7,
                class: 'graph-node' + (t.terrain === 'sea' ? ' graph-node-sea' : '')
            }))
        }
    }

    _buildArrowMarkers() {
        for (const [id, color] of [
            ['arrow-move', '#e74c3c'], ['arrow-support', '#3498db'],
            ['arrow-convoy', '#9b59b6'], ['arrow-attack', '#e74c3c'],
            ['arrow-fortify', '#27ae60'], ['arrow-neutral', '#f0e8d8']
        ]) {
            const marker = el('marker', {
                id, viewBox: '0 0 10 10', refX: 9, refY: 5,
                markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
            })
            marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }))
            this.defs.appendChild(marker)
        }
    }

    setGraphVisible(visible) {
        this.graphVisible = visible
        this.layers.graph.style.display = visible ? '' : 'none'
    }

    onTerritoryClick(fn) { this.clickHandler = fn }
    onTerritoryHover(fn) { this.hoverHandler = fn }

    // scene: { fills, highlights, markers, units, badges, arrows }
    render(scene = {}) {
        const fills = scene.fills || {}
        for (const tid of Object.keys(this.polys)) {
            this.polys[tid].setAttribute('fill', fills[tid] || this.terrainFill(tid))
            this.polys[tid].classList.toggle('territory-dim', !!scene.dim && !scene.dim.has(tid))
        }

        clear(this.layers.highlight)
        for (const [tid, kind] of Object.entries(scene.highlights || {})) {
            const t = this.map.territories[tid]
            this.layers.highlight.appendChild(el('polygon', {
                points: t.polygon.map(p => p.join(',')).join(' '),
                class: `hl hl-${kind}`
            }))
        }

        clear(this.layers.markers)
        for (const m of scene.markers || []) {
            const [cx, cy] = this.map.territories[m.territory].center
            if (m.type === 'star') {
                this.layers.markers.appendChild(el('path', {
                    d: starPath(cx, cy - 14, 6), class: 'sc-star', fill: m.color || '#f5d76e'
                }))
            }
        }

        clear(this.layers.arrows)
        for (const a of scene.arrows || []) {
            const from = this.map.territories[a.from].center
            const to = this.map.territories[a.to].center
            const d = curvePath(from, to, 0.12, 16)
            this.layers.arrows.appendChild(el('path', {
                d,
                class: `order-arrow order-${a.kind || 'move'}`,
                'marker-end': `url(#arrow-${a.kind || 'move'})`
            }))
        }

        clear(this.layers.pieces)
        for (const u of scene.units || []) {
            const [cx, cy] = this.map.territories[u.territory].center
            const dx = (u.offsetIndex || 0) * 26
            const g = el('g', { class: 'unit' + (u.dim ? ' unit-dim' : '') })
            if (u.shape === 'triangle') {
                g.appendChild(el('path', {
                    d: `M ${cx + dx} ${cy - 12} L ${cx + dx + 11} ${cy + 8} L ${cx + dx - 11} ${cy + 8} Z`,
                    fill: u.color, class: 'unit-shape'
                }))
            } else {
                g.appendChild(el('rect', {
                    x: cx + dx - 10, y: cy - 10, width: 20, height: 20, rx: 3,
                    fill: u.color, class: 'unit-shape'
                }))
            }
            const label = el('text', { x: cx + dx, y: cy + 4, class: 'unit-label', fill: u.textColor || '#fff' })
            label.textContent = u.label || ''
            g.appendChild(label)
            this.layers.pieces.appendChild(g)
        }

        for (const b of scene.badges || []) {
            const [cx, cy] = this.map.territories[b.territory].center
            const g = el('g', { class: 'badge' })
            g.appendChild(el('circle', { cx, cy, r: 13, fill: b.color, class: 'badge-circle' }))
            const label = el('text', { x: cx, y: cy + 4, class: 'badge-label', fill: b.textColor || '#fff' })
            label.textContent = b.text
            g.appendChild(label)
            this.layers.pieces.appendChild(g)
        }
    }
}

// ---- small SVG helpers ----

function el(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
    return node
}

function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild)
}

// Quadratic curve from a to b, bowed sideways by `bow` (fraction of length),
// optionally trimmed `trim` px short of the target so arrowheads sit outside
// units.
function curvePath(a, b, bow = 0.15, trim = 0) {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const mx = (a[0] + b[0]) / 2 - dy * bow
    const my = (a[1] + b[1]) / 2 + dx * bow
    let ex = b[0], ey = b[1]
    if (trim > 0) {
        const tx = b[0] - mx, ty = b[1] - my
        const tlen = Math.hypot(tx, ty) || 1
        ex = b[0] - (tx / tlen) * trim
        ey = b[1] - (ty / tlen) * trim
    }
    return `M ${a[0]} ${a[1]} Q ${mx} ${my} ${ex} ${ey}`
}

function starPath(cx, cy, r) {
    const pts = []
    for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45
        const ang = -Math.PI / 2 + (i * Math.PI) / 5
        pts.push(`${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`)
    }
    return `M ${pts.join(' L ')} Z`
}
