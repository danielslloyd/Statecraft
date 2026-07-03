// Risk mode UI. Hotseat humans + bots. Bot turns run automatically with a
// short delay so the log and board are readable.

const RISK_PLAYER_PRESETS = [
    { name: 'Red', color: '#c0392b' },
    { name: 'Blue', color: '#2980b9' },
    { name: 'Green', color: '#27ae60' },
    { name: 'Purple', color: '#8e44ad' },
    { name: 'Orange', color: '#d68910' },
    { name: 'Teal', color: '#16a085' }
]

class RiskUI {
    constructor(app, map, playerCount, humanCount) {
        this.app = app
        const players = RISK_PLAYER_PRESETS.slice(0, playerCount).map((p, i) => ({
            ...p, isBot: i >= humanCount
        }))
        this.game = new RiskGame(map, players)
        this.bots = this.game.players.map((p, i) => p.isBot ? new RiskBot(this.game, i) : null)

        this.board = new Board(app.boardEl, map)
        this.board.onTerritoryClick(tid => this.onClick(tid))
        this.sel = null          // selected own territory (attack/fortify source)
        this.moveCount = 1       // amount for occupy/fortify
        this.selectedCards = new Set()
        this.botTimer = null
        this.lastBattle = null

        app.setTitle(`Risk — ${map.name}`)
        this.renderAll()
        this.scheduleBots()
    }

    destroy() { clearTimeout(this.botTimer) }

    isConquerable(tid) { return this.game.territoryIds.includes(tid) }
    humanTurn() { return !this.game.currentPlayer().isBot && !this.game.winner }

    // ---- bot pacing ----

    scheduleBots() {
        clearTimeout(this.botTimer)
        if (this.game.winner || !this.game.currentPlayer().isBot) return
        this.botTimer = setTimeout(() => {
            this.bots[this.game.currentPlayer().id].takeTurn()
            this.renderAll()
            this.scheduleBots()
        }, 450)
    }

    // ---- interaction ----

    onClick(tid) {
        if (!this.humanTurn() || !this.isConquerable(tid)) return
        const g = this.game
        const me = g.currentPlayer().id
        const mine = g.state[tid].owner === me

        if (g.phase === 'reinforce') {
            if (mine && g.toPlace > 0) {
                g.placeArmies(tid, Math.min(this.placeAmount || 1, g.toPlace))
            }
        } else if (g.phase === 'attack') {
            if (g.pendingOccupy) return // must resolve occupation first
            if (mine) {
                this.sel = g.state[tid].armies >= 2 ? tid : null
            } else if (this.sel && g.canAttack(this.sel, tid)) {
                this.lastBattle = g.attack(this.sel, tid)
                if (this.lastBattle.conquered) this.moveCount = g.state[this.sel].armies - 1
                if (g.state[this.sel] && g.state[this.sel].armies < 2 && !g.pendingOccupy) this.sel = null
            }
        } else if (g.phase === 'fortify') {
            if (mine && g.state[tid].armies >= 2 && (!this.sel || this.sel === tid)) {
                this.sel = this.sel === tid ? null : tid
            } else if (mine && this.sel && g.canFortify(this.sel, tid)) {
                g.fortify(this.sel, tid, this.moveCount)
                this.sel = null
                this.endTurn()
                return
            }
        }
        this.renderAll()
    }

    endAttack() {
        this.game.endAttack()
        this.sel = null
        this.renderAll()
    }

    endTurn() {
        this.sel = null
        this.selectedCards.clear()
        this.game.endTurn()
        this.renderAll()
        this.scheduleBots()
    }

    occupyConfirm() {
        this.game.occupy(this.moveCount)
        this.renderAll()
    }

    tradeSelected() {
        try {
            this.game.tradeCards([...this.selectedCards])
            this.selectedCards.clear()
        } catch (e) { /* invalid set: ignore */ }
        this.renderAll()
    }

    // ---- rendering ----

    renderAll() {
        this.renderBoard()
        this.renderStatus()
        this.renderControls()
        this.app.renderLog(this.game.log.slice(-60).map(l => ({ text: l.text })))
        const p = this.game.currentPlayer()
        this.app.setTurnInfo(this.game.winner
            ? `${this.game.winner.name} wins!`
            : `Round ${this.game.round} — ${p.name}${p.isBot ? ' (bot)' : ''} — ${this.game.phase}`)
    }

    renderBoard() {
        const g = this.game
        const scene = { fills: {}, highlights: {}, badges: [] }
        for (const tid of g.territoryIds) {
            const st = g.state[tid]
            scene.fills[tid] = mixColor(g.players[st.owner].color, '#cfc5ad', 0.62)
            scene.badges.push({
                territory: tid,
                text: String(st.armies),
                color: g.players[st.owner].color
            })
        }
        if (this.humanTurn()) {
            const me = g.currentPlayer().id
            if (g.phase === 'reinforce' && g.toPlace > 0) {
                for (const tid of g.territoriesOf(me)) scene.highlights[tid] = 'option'
            } else if (g.phase === 'attack' && this.sel && !g.pendingOccupy) {
                scene.highlights[this.sel] = 'select'
                for (const n of g.adj[this.sel]) {
                    if (this.isConquerable(n) && g.state[n].owner !== me) scene.highlights[n] = 'danger'
                }
            } else if (g.phase === 'attack' && g.pendingOccupy) {
                scene.highlights[g.pendingOccupy.from] = 'select'
                scene.highlights[g.pendingOccupy.to] = 'target'
            } else if (g.phase === 'fortify' && this.sel) {
                scene.highlights[this.sel] = 'select'
                for (const tid of g.territoriesOf(me)) {
                    if (tid !== this.sel && g.canFortify(this.sel, tid)) scene.highlights[tid] = 'target'
                }
            }
        }
        this.board.render(scene)
    }

    renderStatus() {
        const g = this.game
        const rows = g.players.map(p => {
            const terrs = g.territoriesOf(p.id).length
            const armies = g.territoriesOf(p.id).reduce((s, t) => s + g.state[t].armies, 0)
            const cls = ['status-row', p.alive ? '' : 'dead', g.currentPlayer().id === p.id ? 'current' : ''].join(' ')
            return `<div class="${cls}">
                <span class="color-chip" style="background:${p.color}"></span>
                <span class="grow">${p.name}${p.isBot ? ' 🤖' : ''}</span>
                <span>${terrs} terr · ${armies} armies · ${p.cards.length} cards</span>
            </div>`
        })
        const continents = Object.entries(g.map.risk.continents).map(([cid, c]) => {
            const owner = g.players.find(p => g.continentsOf(p.id).includes(cid))
            return `<div class="status-row">
                <span class="color-chip" style="background:${owner ? owner.color : '#444'}"></span>
                <span class="grow">${c.name}</span><span>+${c.bonus}</span>
            </div>`
        })
        this.app.statusEl.innerHTML = rows.join('') +
            `<div style="margin-top:8px;color:#9aa5c4;font-size:12px">Continent bonuses</div>` +
            continents.join('')
    }

    renderControls() {
        const g = this.game
        const el = this.app.controlsEl
        if (g.winner) {
            el.innerHTML = `<div class="controls-title">${g.winner.name} conquers the world!</div>`
            return
        }
        if (!this.humanTurn()) {
            el.innerHTML = `<div class="controls-hint">Bots are playing…</div>`
            return
        }
        const me = g.currentPlayer()
        let html = ''

        if (g.phase === 'reinforce') {
            html += `<div class="controls-title">Reinforce: ${g.toPlace} to place</div>`
            html += this.cardsHtml(me)
            if (g.mustTrade(me.id)) {
                html += `<div class="controls-hint" style="color:#e94560">You hold ${me.cards.length} cards — you must trade a set.</div>`
            }
            html += `<div class="controls-hint">Click your territories to place armies.</div>
                <div class="btn-row">Per click:
                    <button class="btn btn-small ${(!this.placeAmount || this.placeAmount === 1) ? 'active' : ''}" data-amt="1">1</button>
                    <button class="btn btn-small ${this.placeAmount === 3 ? 'active' : ''}" data-amt="3">3</button>
                    <button class="btn btn-small ${this.placeAmount === 99 ? 'active' : ''}" data-amt="99">All</button>
                </div>`
        } else if (g.phase === 'attack') {
            if (g.pendingOccupy) {
                const max = g.state[g.pendingOccupy.from].armies - 1
                html += `<div class="controls-title">Territory conquered!</div>
                    <div class="controls-hint">Move ${g.pendingOccupy.min}–${max} armies in.</div>
                    ${this.countPicker(g.pendingOccupy.min, max)}
                    <div class="btn-row"><button class="btn btn-primary" id="risk-occupy">Move in</button></div>`
            } else {
                html += `<div class="controls-title">Attack</div>`
                if (this.lastBattle) {
                    html += `<div class="controls-hint">Dice: you [${this.lastBattle.aRoll.join(' ')}] vs [${this.lastBattle.dRoll.join(' ')}] —
                        you lost ${this.lastBattle.aLoss}, they lost ${this.lastBattle.dLoss}</div>`
                }
                html += `<div class="controls-hint">${this.sel
                    ? `Attacking from ${g.map.territories[this.sel].name}. Click an adjacent enemy to roll.`
                    : 'Click one of your territories (2+ armies), then an adjacent enemy. Each click is one roll.'}</div>
                    <div class="btn-row"><button class="btn" id="risk-endattack">End Attack Phase</button></div>`
            }
        } else if (g.phase === 'fortify') {
            const max = this.sel ? g.state[this.sel].armies - 1 : 0
            html += `<div class="controls-title">Fortify (optional, one move)</div>
                <div class="controls-hint">${this.sel
                    ? `Moving from ${g.map.territories[this.sel].name} — pick amount, then click a connected territory.`
                    : 'Click a territory with 2+ armies to move from, or end your turn.'}</div>
                ${this.sel ? this.countPicker(1, max) : ''}
                <div class="btn-row"><button class="btn btn-primary" id="risk-endturn">End Turn</button></div>`
        }
        el.innerHTML = html

        el.querySelectorAll('[data-amt]').forEach(b => {
            b.onclick = () => { this.placeAmount = +b.dataset.amt; this.renderControls() }
        })
        el.querySelectorAll('[data-card]').forEach(b => {
            b.onclick = () => {
                const i = +b.dataset.card
                if (this.selectedCards.has(i)) this.selectedCards.delete(i)
                else if (this.selectedCards.size < 3) this.selectedCards.add(i)
                this.renderControls()
            }
        })
        el.querySelectorAll('[data-count]').forEach(b => {
            b.onclick = () => { this.moveCount = +b.dataset.count; this.renderControls() }
        })
        const hook = (id, fn) => { const n = el.querySelector(id); if (n) n.onclick = fn }
        hook('#risk-trade', () => this.tradeSelected())
        hook('#risk-occupy', () => this.occupyConfirm())
        hook('#risk-endattack', () => this.endAttack())
        hook('#risk-endturn', () => this.endTurn())
    }

    cardsHtml(player) {
        if (!player.cards.length) return ''
        const g = this.game
        const cards = player.cards.map((c, i) => {
            const label = c.kind === 'wild' ? '★ wild'
                : `${c.kind}${c.territory ? ' · ' + g.map.territories[c.territory].name : ''}`
            return `<span class="risk-card ${this.selectedCards.has(i) ? 'selected' : ''}" data-card="${i}">${label}</span>`
        }).join('')
        const canTrade = this.selectedCards.size === 3 &&
            g.tradeableSets(player.cards).some(s => s.every(i => this.selectedCards.has(i)))
        return `<div class="controls-section">
            <div class="controls-hint">Cards (select 3 to trade — next set is worth ${g.nextTradeValue()}):</div>
            <div class="card-row">${cards}</div>
            <div class="btn-row"><button class="btn btn-small" id="risk-trade" ${canTrade ? '' : 'disabled'}>Trade set</button></div>
        </div>`
    }

    countPicker(min, max) {
        this.moveCount = Math.max(min, Math.min(this.moveCount, max))
        const options = [...new Set([min, Math.ceil((min + max) / 2), max])].filter(n => n >= min && n <= max)
        return `<div class="btn-row">Amount:
            ${options.map(n => `<button class="btn btn-small ${this.moveCount === n ? 'active' : ''}" data-count="${n}">${n}</button>`).join('')}
        </div>`
    }
}
