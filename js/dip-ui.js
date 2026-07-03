// Diplomacy mode UI. Drives a DiplomacyGame with one human power (or full
// spectate) against DiplomacyBots, renders the board scene and side panel.

class DiplomacyUI {
    constructor(app, map, humanPower) {
        this.app = app
        this.game = new DiplomacyGame(map)
        this.human = humanPower // power key or null for spectate
        this.bots = this.game.powers
            .filter(p => p !== humanPower)
            .map(p => new DiplomacyBot(this.game, p))

        this.board = new Board(app.boardEl, map)
        this.board.onTerritoryClick(tid => this.onClick(tid))
        this.sel = null // {unit, action, stage, from, targets}
        this.pendingBuilds = []
        this.pendingDisbands = new Set()
        this.buildSite = null

        app.setTitle(`Diplomacy — ${map.name}`)
        this.renderAll()
    }

    powerColor(p) { return this.game.map.diplomacy.powers[p].color }
    powerName(p) { return this.game.map.diplomacy.powers[p].name }

    // ---- interaction ----

    onClick(tid) {
        const g = this.game
        if (g.phase === 'orders' && this.human) this.onOrdersClick(tid)
        else if (g.phase === 'retreats' && this.human) this.onRetreatClick(tid)
        else if (g.phase === 'builds' && this.human) this.onBuildClick(tid)
    }

    onOrdersClick(tid) {
        const g = this.game
        const sel = this.sel
        if (sel && sel.action && sel.targets && sel.targets.includes(tid)) {
            if (sel.action === 'move') {
                g.setOrder(sel.unit.id, { type: 'move', to: tid })
                this.sel = null
            } else if (sel.action === 'support') {
                if (sel.stage === 'from') {
                    this.sel = { ...sel, stage: 'to', from: tid, targets: this.supportDestsFor(sel.unit, tid) }
                } else {
                    g.setOrder(sel.unit.id, { type: 'support', from: sel.from, to: tid })
                    this.sel = null
                }
            } else if (sel.action === 'convoy') {
                if (sel.stage === 'from') {
                    const army = g.unitAt(tid)
                    this.sel = {
                        ...sel, stage: 'to', from: tid,
                        targets: g.convoyTargets(army)
                    }
                } else {
                    g.setOrder(sel.unit.id, { type: 'convoy', from: sel.from, to: tid })
                    this.sel = null
                }
            }
            this.renderAll()
            return
        }
        // (re)select one of our units
        const u = g.unitAt(tid)
        this.sel = (u && u.power === this.human) ? { unit: u, action: null } : null
        this.renderAll()
    }

    setAction(action) {
        const g = this.game
        const unit = this.sel.unit
        if (action === 'hold') {
            g.setOrder(unit.id, { type: 'hold' })
            this.sel = null
        } else if (action === 'move') {
            const legal = g.legalOrders(unit)
            this.sel = { unit, action, targets: [...legal.moves, ...legal.convoyMoves] }
        } else if (action === 'support') {
            const froms = [...new Set(g.legalOrders(unit).supports.map(s => s.from))]
            this.sel = { unit, action, stage: 'from', targets: froms }
        } else if (action === 'convoy') {
            const froms = [...new Set(g.legalOrders(unit).convoys.map(c => c.from))]
            this.sel = { unit, action, stage: 'from', targets: froms }
        }
        this.renderAll()
    }

    supportDestsFor(unit, from) {
        return [...new Set(
            this.game.legalOrders(unit).supports.filter(s => s.from === from).map(s => s.to)
        )]
    }

    onRetreatClick(tid) {
        const d = this.nextHumanRetreat()
        if (!d) return
        if (d.options.includes(tid)) {
            this.game.setRetreat(d.unit.id, tid)
            this.maybeFinishRetreats()
        }
        this.renderAll()
    }

    onBuildClick(tid) {
        const g = this.game
        const a = g.adjustments[this.human]
        if (!a || a.delta === 0) return
        if (a.delta > 0) {
            const options = g.buildOptions(this.human).filter(t => !this.pendingBuilds.some(b => b.territory === t))
            if (this.pendingBuilds.some(b => b.territory === tid)) {
                this.pendingBuilds = this.pendingBuilds.filter(b => b.territory !== tid)
            } else if (options.includes(tid) && this.pendingBuilds.length < a.delta) {
                if (g.map.territories[tid].terrain === 'coast') {
                    this.buildSite = tid // ask army/fleet
                } else {
                    this.pendingBuilds.push({ territory: tid, type: 'army' })
                }
            }
        } else {
            const u = g.unitAt(tid)
            if (u && u.power === this.human) {
                if (this.pendingDisbands.has(u.id)) this.pendingDisbands.delete(u.id)
                else if (this.pendingDisbands.size < -a.delta) this.pendingDisbands.add(u.id)
            }
        }
        this.renderAll()
    }

    chooseBuildType(type) {
        this.pendingBuilds.push({ territory: this.buildSite, type })
        this.buildSite = null
        this.renderAll()
    }

    // ---- phase driving ----

    submitOrders() {
        this.bots.forEach(b => b.submitOrders())
        this.game.resolve()
        this.sel = null
        if (this.game.phase === 'retreats') {
            this.bots.forEach(b => b.submitRetreats())
            this.maybeFinishRetreats()
        } else {
            this.afterPhaseChange()
        }
        this.renderAll()
    }

    nextHumanRetreat() {
        return this.game.dislodged.find(d => d.unit.power === this.human && d.choice === undefined)
    }

    disbandRetreat() {
        const d = this.nextHumanRetreat()
        if (d) {
            this.game.setRetreat(d.unit.id, null)
            this.maybeFinishRetreats()
        }
        this.renderAll()
    }

    maybeFinishRetreats() {
        const pending = this.game.dislodged.some(d => d.choice === undefined)
        if (!pending) this.game.resolveRetreats()
        this.afterPhaseChange()
    }

    afterPhaseChange() {
        if (this.game.phase === 'builds') {
            this.pendingBuilds = []
            this.pendingDisbands = new Set()
            this.buildSite = null
            const a = this.game.adjustments[this.human]
            if (!this.human || !a || a.delta === 0) this.confirmAdjustments(true)
        }
    }

    confirmAdjustments(skipHuman = false) {
        const g = this.game
        if (!skipHuman && this.human) {
            g.setAdjustments(this.human, {
                builds: this.pendingBuilds,
                disbands: [...this.pendingDisbands]
            })
        }
        this.bots.forEach(b => b.submitAdjustments())
        g.resolveBuilds()
        this.renderAll()
    }

    spectateStep() {
        const g = this.game
        if (g.phase === 'orders') {
            this.bots.forEach(b => b.submitOrders())
            g.resolve()
            if (g.phase === 'retreats') {
                this.bots.forEach(b => b.submitRetreats())
                g.resolveRetreats()
            }
            this.afterPhaseChange()
        }
        this.renderAll()
    }

    // ---- rendering ----

    renderAll() {
        this.renderBoard()
        this.renderStatus()
        this.renderControls()
        this.app.renderLog(this.flatLog())
        this.app.setTurnInfo(`${this.game.turnLabel()} — ${this.phaseLabel()}`)
    }

    phaseLabel() {
        const g = this.game
        if (g.winner) return `${this.powerName(g.winner)} wins!`
        return { orders: 'Orders', retreats: 'Retreats', builds: 'Builds & Disbands', over: 'Game over' }[g.phase]
    }

    flatLog() {
        const out = []
        for (const entry of this.game.log.slice(-40)) {
            out.push({ heading: entry.turn })
            for (const line of entry.entries) out.push({ text: line })
        }
        return out
    }

    renderBoard() {
        const g = this.game
        const scene = { fills: {}, highlights: {}, markers: [], units: [], arrows: [] }

        for (const sc of Object.keys(g.scOwner)) {
            const owner = g.scOwner[sc]
            if (owner) scene.fills[sc] = mixColor(this.powerColor(owner), '#cfc5ad', 0.45)
            scene.markers.push({ territory: sc, type: 'star', color: owner ? this.powerColor(owner) : '#b9b2a2' })
        }

        for (const u of g.units) {
            scene.units.push({
                territory: u.territory,
                shape: u.type === 'fleet' ? 'triangle' : 'square',
                label: u.type === 'fleet' ? 'F' : 'A',
                color: this.powerColor(u.power),
                dim: g.dislodged.some(d => d.unit.id === u.id),
                offsetIndex: g.dislodged.some(d => d.unit.id === u.id) ? 1 : 0
            })
        }

        if (g.phase === 'orders' && this.human) {
            for (const [uid, o] of Object.entries(g.orders)) {
                const u = g.units.find(x => x.id === uid)
                if (!u || u.power !== this.human) continue
                if (o.type === 'move') scene.arrows.push({ from: u.territory, to: o.to, kind: 'move' })
                if (o.type === 'support') scene.arrows.push({ from: u.territory, to: o.to, kind: 'support' })
                if (o.type === 'convoy') scene.arrows.push({ from: o.from, to: o.to, kind: 'convoy' })
            }
            if (this.sel) {
                scene.highlights[this.sel.unit.territory] = 'select'
                for (const t of this.sel.targets || []) scene.highlights[t] = 'target'
            }
        }

        if (g.phase === 'retreats' && this.human) {
            const d = this.nextHumanRetreat()
            if (d) {
                scene.highlights[d.unit.territory] = 'danger'
                for (const t of d.options) scene.highlights[t] = 'target'
            }
        }

        if (g.phase === 'builds' && this.human) {
            const a = g.adjustments[this.human]
            if (a && a.delta > 0) {
                for (const t of g.buildOptions(this.human)) scene.highlights[t] = 'option'
                for (const b of this.pendingBuilds) scene.highlights[b.territory] = 'target'
            } else if (a && a.delta < 0) {
                for (const id of this.pendingDisbands) {
                    const u = g.units.find(x => x.id === id)
                    if (u) scene.highlights[u.territory] = 'danger'
                }
            }
        }

        this.board.render(scene)
    }

    renderStatus() {
        const g = this.game
        const rows = g.powers.map(p => {
            const you = p === this.human ? ' (you)' : ''
            return `<div class="status-row">
                <span class="color-chip" style="background:${this.powerColor(p)}"></span>
                <span class="grow">${this.powerName(p)}${you}</span>
                <span>${g.supplyCount(p)} SC / ${g.unitsOf(p).length} units</span>
            </div>`
        })
        this.app.statusEl.innerHTML = rows.join('')
    }

    renderControls() {
        const g = this.game
        const el = this.app.controlsEl
        if (g.winner) {
            el.innerHTML = `<div class="controls-title">${this.powerName(g.winner)} wins in ${g.year}!</div>`
            return
        }
        if (!this.human) {
            el.innerHTML = `<div class="controls-title">Spectating</div>
                <div class="btn-row"><button class="btn btn-primary" id="dip-next">Next Turn</button></div>`
            el.querySelector('#dip-next').onclick = () => this.spectateStep()
            return
        }
        if (g.phase === 'orders') this.renderOrderControls(el)
        else if (g.phase === 'retreats') this.renderRetreatControls(el)
        else if (g.phase === 'builds') this.renderBuildControls(el)
    }

    renderOrderControls(el) {
        const g = this.game
        const mine = g.unitsOf(this.human)
        let html = `<div class="controls-title">Your orders (${Object.keys(g.orders).filter(id => mine.some(u => u.id === id)).length}/${mine.length})</div>`

        if (this.sel && !this.sel.action) {
            const u = this.sel.unit
            const legal = g.legalOrders(u)
            html += `<div class="controls-hint">${u.type === 'fleet' ? 'Fleet' : 'Army'} in ${g.map.territories[u.territory].name}</div>
                <div class="btn-row">
                    <button class="btn btn-small" data-act="move">Move</button>
                    <button class="btn btn-small" data-act="hold">Hold</button>
                    <button class="btn btn-small" data-act="support" ${legal.supports.length ? '' : 'disabled'}>Support</button>
                    <button class="btn btn-small" data-act="convoy" ${legal.convoys.length ? '' : 'disabled'}>Convoy</button>
                </div>`
        } else if (this.sel && this.sel.action) {
            const stage = this.sel.stage === 'from'
                ? (this.sel.action === 'convoy' ? 'Pick the army to convoy' : 'Pick the unit to support')
                : 'Pick the destination'
            html += `<div class="controls-hint">${this.sel.action.toUpperCase()}: ${this.sel.action === 'move' ? 'pick a destination' : stage} (highlighted)</div>
                <div class="btn-row"><button class="btn btn-small" data-act="cancel">Cancel</button></div>`
        } else {
            html += `<div class="controls-hint">Click one of your units to give it an order. Unordered units hold.</div>`
        }

        html += `<div class="order-list">`
        for (const u of mine) {
            const o = g.orders[u.id]
            html += `<div class="order-row"><span class="grow">${this.orderText(u, o)}</span>
                ${o ? `<span class="order-x" data-clear="${u.id}">×</span>` : ''}</div>`
        }
        html += `</div>
            <div class="btn-row"><button class="btn btn-primary" id="dip-submit">Submit Orders</button></div>`
        el.innerHTML = html

        el.querySelectorAll('[data-act]').forEach(b => {
            b.onclick = () => {
                if (b.dataset.act === 'cancel') { this.sel = { unit: this.sel.unit, action: null }; this.renderAll() }
                else this.setAction(b.dataset.act)
            }
        })
        el.querySelectorAll('[data-clear]').forEach(b => {
            b.onclick = () => { delete g.orders[b.dataset.clear]; this.renderAll() }
        })
        el.querySelector('#dip-submit').onclick = () => this.submitOrders()
    }

    orderText(u, o) {
        const g = this.game
        const name = t => g.map.territories[t].name
        const tag = `${u.type === 'fleet' ? 'F' : 'A'} ${name(u.territory)}`
        if (!o) return `${tag} — (hold)`
        if (o.type === 'move') return `${tag} → ${name(o.to)}`
        if (o.type === 'support') return o.from === o.to
            ? `${tag} S ${name(o.to)} holds` : `${tag} S ${name(o.from)} → ${name(o.to)}`
        if (o.type === 'convoy') return `${tag} C ${name(o.from)} → ${name(o.to)}`
        return `${tag} holds`
    }

    renderRetreatControls(el) {
        const d = this.nextHumanRetreat()
        if (!d) {
            el.innerHTML = `<div class="controls-hint">Waiting for retreats…</div>`
            return
        }
        el.innerHTML = `<div class="controls-title">Retreat required</div>
            <div class="controls-hint">Your unit in ${this.game.map.territories[d.unit.territory].name} was dislodged.
            ${d.options.length ? 'Click a highlighted territory to retreat, or disband.' : 'No retreat available — it must disband.'}</div>
            <div class="btn-row"><button class="btn" id="dip-disband">Disband</button></div>`
        el.querySelector('#dip-disband').onclick = () => this.disbandRetreat()
    }

    renderBuildControls(el) {
        const g = this.game
        const a = g.adjustments[this.human]
        let html = `<div class="controls-title">Winter adjustments</div>`
        if (this.buildSite) {
            html += `<div class="controls-hint">Build what in ${g.map.territories[this.buildSite].name}?</div>
                <div class="btn-row">
                    <button class="btn btn-small" id="build-army">Army</button>
                    <button class="btn btn-small" id="build-fleet">Fleet</button>
                </div>`
        } else if (a.delta > 0) {
            html += `<div class="controls-hint">You may build ${a.delta} unit(s) — ${this.pendingBuilds.length} chosen.
                Click highlighted home centers (click again to undo).</div>`
        } else if (a.delta < 0) {
            html += `<div class="controls-hint">You must disband ${-a.delta} unit(s) — ${this.pendingDisbands.size} chosen.
                Click your units to mark them.</div>`
        }
        html += `<div class="btn-row"><button class="btn btn-primary" id="dip-adjust">Confirm</button></div>`
        el.innerHTML = html
        const army = el.querySelector('#build-army')
        if (army) army.onclick = () => this.chooseBuildType('army')
        const fleet = el.querySelector('#build-fleet')
        if (fleet) fleet.onclick = () => this.chooseBuildType('fleet')
        el.querySelector('#dip-adjust').onclick = () => this.confirmAdjustments()
    }
}

// mix two hex colors; t = weight of color a
function mixColor(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
    const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
    const c = pa.map((v, i) => Math.round(v * t + pb[i] * (1 - t)))
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}
