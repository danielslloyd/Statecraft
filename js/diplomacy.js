// Diplomacy engine. Map-agnostic: runs on any map that passes
// MapCore.validateMap with a diplomacy layer.
//
// Rules implemented: move/hold/support/convoy, support cutting, convoy
// disruption, head-to-head battles, movement cycles (rotation), no
// self-dislodgement, retreats (with standoff-territory exclusion), and
// winter builds/disbands. Simplifications vs the full rulebook: no split
// coasts, fleets may move between any two adjacent non-inland territories,
// and convoy paradoxes resolve by disrupting the convoy.

class DiplomacyGame {
    constructor(map, options = {}) {
        const check = MapCore.validateMap(map)
        if (!check.ok) throw new Error('invalid map: ' + check.errors.join('; '))
        if (!map.modes.includes('diplomacy')) throw new Error('map does not support diplomacy')

        this.map = map
        this.adj = MapCore.buildAdjacency(map)
        this.powers = Object.keys(map.diplomacy.powers)
        this.rng = options.rng || Math.random

        this.year = map.diplomacy.startYear || 1901
        this.season = 'spring'
        this.phase = 'orders' // orders | retreats | builds | over
        this.units = []
        this.orders = {} // unitId -> order
        this.dislodged = [] // [{unit, from, options, choice}]
        this.adjustments = {} // power -> {delta, builds:[], disbands:[]}
        this.winner = null
        this.log = []
        this.lastResults = []

        let nextId = 1
        for (const power of this.powers) {
            for (const u of map.diplomacy.startingUnits[power] || []) {
                this.units.push({ id: 'u' + nextId++, power, type: u.type, territory: u.territory })
            }
        }
        this.nextUnitId = nextId

        this.scOwner = {}
        for (const sc of map.diplomacy.supplyCenters) this.scOwner[sc] = null
        for (const [power, homes] of Object.entries(map.diplomacy.homeCenters)) {
            for (const h of homes) this.scOwner[h] = power
        }
    }

    // ---- queries ----

    unitAt(tid) { return this.units.find(u => u.territory === tid) || null }
    unitsOf(power) { return this.units.filter(u => u.power === power) }
    supplyCount(power) { return Object.values(this.scOwner).filter(o => o === power).length }
    turnLabel() {
        const season = this.season === 'spring' ? 'Spring' : 'Fall'
        return this.phase === 'builds' ? `Winter ${this.year}` : `${season} ${this.year}`
    }

    canOccupy(type, tid) {
        const terrain = this.map.territories[tid].terrain
        if (type === 'army') return terrain === 'land' || terrain === 'coast'
        return terrain === 'sea' || terrain === 'coast'
    }

    canReach(unit, tid) {
        return this.adj[unit.territory].includes(tid) && this.canOccupy(unit.type, tid)
    }

    // Territories an army could reach by convoy: coastal destinations connected
    // through sea territories currently occupied by fleets (any power).
    convoyTargets(unit) {
        if (unit.type !== 'army' || this.map.territories[unit.territory].terrain !== 'coast') return []
        const targets = new Set()
        const seen = new Set()
        const queue = this.adj[unit.territory].filter(t =>
            this.map.territories[t].terrain === 'sea' && this.unitAt(t) && this.unitAt(t).type === 'fleet')
        queue.forEach(t => seen.add(t))
        while (queue.length) {
            const sea = queue.shift()
            for (const next of this.adj[sea]) {
                const terr = this.map.territories[next].terrain
                if (terr === 'coast' && next !== unit.territory) targets.add(next)
                if (terr === 'sea' && !seen.has(next)) {
                    const occ = this.unitAt(next)
                    if (occ && occ.type === 'fleet') { seen.add(next); queue.push(next) }
                }
            }
        }
        for (const t of this.adj[unit.territory]) targets.delete(t) // prefer direct moves
        return [...targets]
    }

    legalOrders(unit) {
        const moves = this.adj[unit.territory].filter(t => this.canOccupy(unit.type, t))
        const supports = []
        for (const dest of moves) {
            // support hold on dest
            if (this.unitAt(dest)) supports.push({ from: dest, to: dest })
            // support any move into dest
            for (const other of this.units) {
                if (other.id === unit.id || other.territory === dest) continue
                if (this.canReach(other, dest) || (other.type === 'army' && this.convoyTargets(other).includes(dest))) {
                    supports.push({ from: other.territory, to: dest })
                }
            }
        }
        const convoys = []
        if (unit.type === 'fleet' && this.map.territories[unit.territory].terrain === 'sea') {
            for (const other of this.units) {
                if (other.type !== 'army') continue
                for (const dest of this.convoyTargets(other)) convoys.push({ from: other.territory, to: dest })
            }
        }
        return { moves, convoyMoves: this.convoyTargets(unit), supports, convoys }
    }

    setOrder(unitId, order) {
        if (this.phase !== 'orders') throw new Error('not in orders phase')
        this.orders[unitId] = order
    }

    // ---- adjudication ----

    resolve() {
        if (this.phase !== 'orders') throw new Error('not in orders phase')
        const outcome = this._adjudicate()
        this.lastResults = outcome.results
        this.log.push({ turn: this.turnLabel(), entries: outcome.results.map(r => r.text) })

        for (const mv of outcome.applied) mv.unit.territory = mv.to

        this.dislodged = outcome.dislodged.map(d => ({
            unit: d.unit,
            from: d.unit.territory,
            options: this._retreatOptions(d.unit, d.attackerOrigin, outcome.standoffs),
            choice: undefined
        }))
        this.orders = {}

        if (this.dislodged.length) {
            this.phase = 'retreats'
        } else {
            this._afterMovement()
        }
        return outcome.results
    }

    _adjudicate() {
        const orders = {}
        const results = []
        for (const u of this.units) {
            orders[u.id] = this._validatedOrder(u, this.orders[u.id], results)
        }

        const disruptedConvoyers = new Set()
        let outcome = null
        for (let round = 0; round < 4; round++) {
            outcome = this._adjudicateOnce(orders, disruptedConvoyers)
            const newlyDisrupted = outcome.dislodged
                .filter(d => orders[d.unit.id].type === 'convoy' && !disruptedConvoyers.has(d.unit.id))
                .map(d => d.unit.id)
            if (!newlyDisrupted.length) break
            newlyDisrupted.forEach(id => disruptedConvoyers.add(id))
        }

        for (const u of this.units) {
            const o = orders[u.id]
            const name = t => this.map.territories[t].name
            const tag = `${u.power} ${u.type === 'army' ? 'A' : 'F'} ${name(u.territory)}`
            if (o.type === 'move') {
                const ok = outcome.moveStatus[u.id] === 'succeeds'
                results.push({ unit: u, ok, text: `${tag} -> ${name(o.to)}: ${ok ? 'moves' : 'bounces'}` })
            } else if (o.type === 'support') {
                const cut = outcome.cutSupports.has(u.id)
                const what = o.from === o.to ? `holds ${name(o.to)}` : `${name(o.from)} -> ${name(o.to)}`
                results.push({ unit: u, ok: !cut, text: `${tag} supports ${what}${cut ? ' (cut)' : ''}` })
            } else if (o.type === 'convoy') {
                const broken = disruptedConvoyers.has(u.id)
                results.push({ unit: u, ok: !broken, text: `${tag} convoys ${name(o.from)} -> ${name(o.to)}${broken ? ' (disrupted)' : ''}` })
            } else {
                results.push({ unit: u, ok: true, text: `${tag} holds` })
            }
        }
        for (const d of outcome.dislodged) {
            results.push({ unit: d.unit, ok: false, dislodged: true, text: `${d.unit.power} unit in ${this.map.territories[d.unit.territory].name} is dislodged` })
        }

        const applied = this.units
            .filter(u => orders[u.id].type === 'move' && outcome.moveStatus[u.id] === 'succeeds')
            .map(u => ({ unit: u, to: orders[u.id].to }))

        return { results, applied, dislodged: outcome.dislodged, standoffs: outcome.standoffs }
    }

    _validatedOrder(unit, order, results) {
        const hold = { type: 'hold' }
        if (!order || order.type === 'hold') return hold
        if (order.type === 'move') {
            if (this.canReach(unit, order.to)) return { type: 'move', to: order.to }
            if (unit.type === 'army' && this.convoyTargets(unit).includes(order.to)) {
                return { type: 'move', to: order.to, viaConvoy: true }
            }
            return hold
        }
        if (order.type === 'support') {
            if (order.to === unit.territory || !this.canReach(unit, order.to)) return hold
            if (!this.unitAt(order.from)) return hold
            return { type: 'support', from: order.from, to: order.to }
        }
        if (order.type === 'convoy') {
            if (unit.type !== 'fleet' || this.map.territories[unit.territory].terrain !== 'sea') return hold
            const army = this.unitAt(order.from)
            if (!army || army.type !== 'army') return hold
            return { type: 'convoy', from: order.from, to: order.to }
        }
        return hold
    }

    _convoyPathExists(from, to, orders, disrupted) {
        const isConvoyer = tid => {
            const f = this.unitAt(tid)
            if (!f || f.type !== 'fleet' || disrupted.has(f.id)) return false
            const o = orders[f.id]
            return o.type === 'convoy' && o.from === from && o.to === to
        }
        const seen = new Set()
        const queue = this.adj[from].filter(t => this.map.territories[t].terrain === 'sea' && isConvoyer(t))
        queue.forEach(t => seen.add(t))
        while (queue.length) {
            const sea = queue.shift()
            if (this.adj[sea].includes(to)) return true
            for (const next of this.adj[sea]) {
                if (this.map.territories[next].terrain === 'sea' && !seen.has(next) && isConvoyer(next)) {
                    seen.add(next)
                    queue.push(next)
                }
            }
        }
        return false
    }

    _adjudicateOnce(orders, disruptedConvoyers) {
        const byId = {}
        this.units.forEach(u => { byId[u.id] = u })
        const occupant = {}
        this.units.forEach(u => { occupant[u.territory] = u })

        // effective move set (convoyed moves need an intact convoy path)
        const moving = {} // uid -> {to, convoyed}
        for (const u of this.units) {
            const o = orders[u.id]
            if (o.type !== 'move') continue
            if (o.viaConvoy || !this.canReach(u, o.to)) {
                if (this._convoyPathExists(u.territory, o.to, orders, disruptedConvoyers)) {
                    moving[u.id] = { to: o.to, convoyed: true }
                }
                // convoyed move with no path: unit just holds this round
            } else {
                moving[u.id] = { to: o.to, convoyed: false }
            }
        }

        // support cutting: support aimed at province P is cut by any attack on
        // the supporter from a foreign unit, except an attack from P itself
        const cutSupports = new Set()
        for (const u of this.units) {
            const o = orders[u.id]
            if (o.type !== 'support') continue
            for (const [aid, mv] of Object.entries(moving)) {
                const attacker = byId[aid]
                if (mv.to !== u.territory) continue
                if (attacker.power === u.power) continue
                if (attacker.territory === o.to && !mv.convoyed) continue
                cutSupports.add(u.id)
                break
            }
        }

        // valid supports grouped by what they support
        const moveSupports = {} // "from|to" -> [supporting units]
        const holdSupports = {} // tid -> [supporting units]
        for (const u of this.units) {
            const o = orders[u.id]
            if (o.type !== 'support' || cutSupports.has(u.id)) continue
            const target = occupant[o.from]
            if (!target) continue
            if (o.from === o.to) {
                if (moving[target.id]) continue // can't support-hold a moving unit
                ;(holdSupports[o.from] = holdSupports[o.from] || []).push(u)
            } else {
                if (!moving[target.id] || moving[target.id].to !== o.to) continue
                const key = `${o.from}|${o.to}`
                ;(moveSupports[key] = moveSupports[key] || []).push(u)
            }
        }

        const attackStrength = uid => {
            const u = byId[uid]
            const sup = moveSupports[`${u.territory}|${moving[uid].to}`] || []
            return 1 + sup.length
        }
        // strength counted against a specific defender: supports from the
        // defender's own power never help dislodge it
        const strengthVs = (uid, defenderPower) => {
            const u = byId[uid]
            const sup = moveSupports[`${u.territory}|${moving[uid].to}`] || []
            return 1 + sup.filter(s => s.power !== defenderPower).length
        }
        const holdStrength = tid => {
            const u = occupant[tid]
            if (!u) return 0
            if (moving[u.id]) return 1 // trying to leave; supports-to-hold invalid
            return 1 + (holdSupports[tid] || []).length
        }

        const status = {} // uid -> succeeds | fails
        const movers = Object.keys(moving)
        const moversTo = tid => movers.filter(id => moving[id].to === tid)

        const evaluate = uid => {
            const u = byId[uid]
            const dest = moving[uid].to
            const myStrength = attackStrength(uid)

            // competitors: every other move aimed at the same destination
            for (const other of moversTo(dest)) {
                if (other === uid) continue
                if (attackStrength(other) >= myStrength) return 'fails'
            }

            const defender = occupant[dest]
            if (!defender) return 'succeeds'

            // head-to-head: defender moving straight back at us (no convoy)
            const dMove = moving[defender.id]
            const headToHead = dMove && dMove.to === u.territory && !dMove.convoyed && !moving[uid].convoyed
            if (headToHead) {
                if (defender.power === u.power) return 'fails'
                return strengthVs(uid, defender.power) > attackStrength(defender.id) ? 'succeeds' : 'fails'
            }

            if (dMove) {
                if (status[defender.id] === 'succeeds') return 'succeeds'
                if (status[defender.id] === 'fails') {
                    if (defender.power === u.power) return 'fails'
                    return strengthVs(uid, defender.power) > 1 ? 'succeeds' : 'fails'
                }
                return undefined // defender unresolved; try next pass
            }

            if (defender.power === u.power) return 'fails'
            return strengthVs(uid, defender.power) > holdStrength(dest) ? 'succeeds' : 'fails'
        }

        // iterate to fixpoint
        for (let pass = 0; pass < movers.length + 2; pass++) {
            let progress = false
            for (const uid of movers) {
                if (status[uid]) continue
                const s = evaluate(uid)
                if (s) { status[uid] = s; progress = true }
            }
            if (!progress) break
        }

        // remaining undecided moves form dependency cycles (A->B->C->A):
        // rotations succeed as a group
        const undecided = movers.filter(id => !status[id])
        for (const startId of undecided) {
            if (status[startId]) continue
            const chain = []
            let cur = startId
            let isCycle = false
            const chainSet = new Set()
            while (cur && !status[cur] && !chainSet.has(cur)) {
                chain.push(cur)
                chainSet.add(cur)
                const next = occupant[moving[cur].to]
                cur = next && moving[next.id] ? next.id : null
                if (cur === startId) { isCycle = true; break }
            }
            const verdict = isCycle ? 'succeeds' : 'fails'
            for (const id of chain) if (!status[id]) status[id] = verdict
        }
        for (const uid of movers) if (!status[uid]) status[uid] = 'fails'

        // dislodgements: a unit that stays put in a territory entered by a
        // successful foreign move
        const dislodged = []
        for (const uid of movers) {
            if (status[uid] !== 'succeeds') continue
            const dest = moving[uid].to
            const defender = occupant[dest]
            if (!defender) continue
            if (moving[defender.id] && status[defender.id] === 'succeeds') continue
            dislodged.push({ unit: defender, attackerOrigin: byId[uid].territory })
        }

        // standoffs: destinations attacked by failed moves and left vacant —
        // dislodged units may not retreat there
        const standoffs = new Set()
        for (const uid of movers) {
            if (status[uid] !== 'fails') continue
            const dest = moving[uid].to
            const stays = occupant[dest] && !(moving[occupant[dest].id] && status[occupant[dest].id] === 'succeeds')
            const taken = moversTo(dest).some(id => status[id] === 'succeeds')
            if (!stays && !taken) standoffs.add(dest)
        }

        return { moveStatus: status, dislodged, standoffs, cutSupports }
    }

    // ---- retreats ----

    _retreatOptions(unit, attackerOrigin, standoffs) {
        return this.adj[unit.territory].filter(t =>
            t !== attackerOrigin &&
            !standoffs.has(t) &&
            this.canOccupy(unit.type, t) &&
            !this.unitAt(t))
    }

    setRetreat(unitId, territoryOrNull) {
        const d = this.dislodged.find(x => x.unit.id === unitId)
        if (!d) throw new Error('unit is not dislodged')
        if (territoryOrNull !== null && !d.options.includes(territoryOrNull)) throw new Error('illegal retreat')
        d.choice = territoryOrNull
    }

    resolveRetreats() {
        if (this.phase !== 'retreats') throw new Error('not in retreats phase')
        const counts = {}
        for (const d of this.dislodged) {
            if (d.choice) counts[d.choice] = (counts[d.choice] || 0) + 1
        }
        for (const d of this.dislodged) {
            const name = this.map.territories[d.from].name
            if (d.choice && counts[d.choice] === 1) {
                d.unit.territory = d.choice
                this.log.push({ turn: this.turnLabel(), entries: [`${d.unit.power} retreats ${name} -> ${this.map.territories[d.choice].name}`] })
            } else {
                this.units = this.units.filter(u => u.id !== d.unit.id)
                this.log.push({ turn: this.turnLabel(), entries: [`${d.unit.power} unit in ${name} disbands`] })
            }
        }
        this.dislodged = []
        this._afterMovement()
    }

    // ---- season / build flow ----

    _afterMovement() {
        if (this.season === 'spring') {
            this.season = 'fall'
            this.phase = 'orders'
            return
        }
        // fall: capture supply centers, then adjust
        for (const sc of Object.keys(this.scOwner)) {
            const u = this.unitAt(sc)
            if (u) this.scOwner[sc] = u.power
        }
        const victory = this.map.diplomacy.victorySupplyCenters
        for (const p of this.powers) {
            if (this.supplyCount(p) >= victory) {
                this.winner = p
                this.phase = 'over'
                this.log.push({ turn: this.turnLabel(), entries: [`${p} controls ${this.supplyCount(p)} supply centers and wins!`] })
                return
            }
        }
        this.adjustments = {}
        let any = false
        for (const p of this.powers) {
            const delta = this.supplyCount(p) - this.unitsOf(p).length
            this.adjustments[p] = { delta, builds: [], disbands: [] }
            if (delta !== 0) any = true
        }
        if (any) {
            this.phase = 'builds'
        } else {
            this._nextYear()
        }
    }

    buildOptions(power) {
        return (this.map.diplomacy.homeCenters[power] || []).filter(h =>
            this.scOwner[h] === power && !this.unitAt(h))
    }

    setAdjustments(power, { builds = [], disbands = [] } = {}) {
        if (this.phase !== 'builds') throw new Error('not in builds phase')
        const a = this.adjustments[power]
        if (a.delta > 0) {
            const options = this.buildOptions(power)
            const seen = new Set()
            for (const b of builds) {
                if (!options.includes(b.territory) || seen.has(b.territory)) throw new Error('illegal build site')
                if (!this.canOccupy(b.type, b.territory)) throw new Error(`cannot build ${b.type} there`)
                seen.add(b.territory)
            }
            a.builds = builds.slice(0, a.delta)
        } else if (a.delta < 0) {
            const mine = new Set(this.unitsOf(power).map(u => u.id))
            a.disbands = [...new Set(disbands)].filter(id => mine.has(id)).slice(0, -a.delta)
        }
    }

    resolveBuilds() {
        if (this.phase !== 'builds') throw new Error('not in builds phase')
        const entries = []
        for (const p of this.powers) {
            const a = this.adjustments[p]
            for (const b of a.builds) {
                this.units.push({ id: 'u' + this.nextUnitId++, power: p, type: b.type, territory: b.territory })
                entries.push(`${p} builds ${b.type} in ${this.map.territories[b.territory].name}`)
            }
            if (a.delta < 0) {
                let toRemove = a.disbands.slice()
                // auto-disband if the player under-specified
                while (toRemove.length < -a.delta) {
                    const rest = this.unitsOf(p).filter(u => !toRemove.includes(u.id))
                    if (!rest.length) break
                    toRemove.push(rest[rest.length - 1].id)
                }
                for (const id of toRemove) {
                    const u = this.units.find(x => x.id === id)
                    if (!u) continue
                    entries.push(`${p} disbands ${u.type} in ${this.map.territories[u.territory].name}`)
                    this.units = this.units.filter(x => x.id !== id)
                }
            }
        }
        if (entries.length) this.log.push({ turn: this.turnLabel(), entries })
        this._nextYear()
    }

    _nextYear() {
        this.year += 1
        this.season = 'spring'
        this.phase = 'orders'
        this.adjustments = {}
    }
}

// ---- bot ----

class DiplomacyBot {
    constructor(game, power) {
        this.game = game
        this.power = power
    }

    submitOrders() {
        const g = this.game
        const claimed = new Set() // destinations already taken this turn
        const planned = {} // territory -> planned destination

        const units = g.unitsOf(this.power)
        const plans = units.map(u => ({ unit: u, path: this._pathToNearestTarget(u) }))
        // let units with the shortest route to a target pick first
        plans.sort((a, b) => (a.path ? a.path.length : 99) - (b.path ? b.path.length : 99))

        for (const { unit, path } of plans) {
            // capture: standing on an unowned supply center in fall — stay put
            const onSc = unit.territory in g.scOwner && g.scOwner[unit.territory] !== this.power
            if (onSc && g.season === 'fall') {
                g.setOrder(unit.id, { type: 'hold' })
                planned[unit.territory] = unit.territory
                continue
            }
            const step = path && path[1]
            if (step && !claimed.has(step) && this._stepIsSane(unit, step, planned)) {
                g.setOrder(unit.id, { type: 'move', to: step })
                claimed.add(step)
                planned[unit.territory] = step
                continue
            }
            // try to support a neighbour's planned move into an adjacent spot
            const support = this._findSupport(unit, planned)
            if (support) {
                g.setOrder(unit.id, { type: 'support', from: support.from, to: support.to })
            } else {
                g.setOrder(unit.id, { type: 'hold' })
            }
            planned[unit.territory] = unit.territory
        }
    }

    _pathToNearestTarget(unit) {
        const g = this.game
        const targets = Object.keys(g.scOwner).filter(sc => g.scOwner[sc] !== this.power)
        let best = null
        for (const target of targets) {
            if (!g.canOccupy(unit.type, target)) continue
            const path = MapCore.shortestPath(g.adj, unit.territory, target,
                t => g.canOccupy(unit.type, t))
            if (path && (!best || path.length < best.length)) best = path
        }
        return best
    }

    _stepIsSane(unit, step, planned) {
        const g = this.game
        if (!g.canReach(unit, step)) return false
        const occ = g.unitAt(step)
        // don't bump into our own unit unless it's planned to vacate
        if (occ && occ.power === this.power && (!planned[step] || planned[step] === step)) return false
        return true
    }

    _findSupport(unit, planned) {
        const g = this.game
        for (const [from, to] of Object.entries(planned)) {
            if (from === to) continue
            if (from !== unit.territory && g.canReach(unit, to)) return { from, to }
        }
        return null
    }

    submitRetreats() {
        const g = this.game
        for (const d of g.dislodged) {
            if (d.unit.power !== this.power) continue
            const scored = d.options.slice().sort((a, b) => {
                const score = t => (t in g.scOwner ? -2 : 0) + (g.map.territories[t].terrain !== 'sea' ? -1 : 0)
                return score(a) - score(b)
            })
            g.setRetreat(d.unit.id, scored[0] || null)
        }
    }

    submitAdjustments() {
        const g = this.game
        const a = g.adjustments[this.power]
        if (!a || a.delta === 0) return
        if (a.delta > 0) {
            const builds = []
            for (const site of g.buildOptions(this.power).slice(0, a.delta)) {
                const wantFleet = g.map.territories[site].terrain === 'coast' &&
                    g.unitsOf(this.power).filter(u => u.type === 'fleet').length <
                    g.unitsOf(this.power).filter(u => u.type === 'army').length
                builds.push({ territory: site, type: wantFleet ? 'fleet' : 'army' })
            }
            g.setAdjustments(this.power, { builds })
        } else {
            // disband units farthest from any owned supply center
            const dist = u => {
                let best = 99
                for (const sc of Object.keys(g.scOwner)) {
                    if (g.scOwner[sc] !== this.power) continue
                    const p = MapCore.shortestPath(g.adj, u.territory, sc, t => g.canOccupy(u.type, t))
                    if (p) best = Math.min(best, p.length)
                }
                return best
            }
            const ordered = g.unitsOf(this.power).slice().sort((x, y) => dist(y) - dist(x))
            g.setAdjustments(this.power, { disbands: ordered.slice(0, -a.delta).map(u => u.id) })
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DiplomacyGame, DiplomacyBot }
}
