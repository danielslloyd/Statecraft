// Risk engine. Map-agnostic: runs on any map that passes MapCore.validateMap
// with a risk layer. Classic rules: territory deal, reinforcements
// (max(3, territories/3) + continent bonuses), card sets with escalating
// values, 3v2 dice combat, one fortify move along a friendly path.

const RISK_CARD_VALUES = [4, 6, 8, 10, 12, 15] // then +5 each

class RiskGame {
    constructor(map, players, options = {}) {
        const check = MapCore.validateMap(map)
        if (!check.ok) throw new Error('invalid map: ' + check.errors.join('; '))
        if (!map.modes.includes('risk')) throw new Error('map does not support risk')
        if (players.length < 2 || players.length > 6) throw new Error('risk needs 2-6 players')

        this.map = map
        this.adj = MapCore.buildAdjacency(map)
        this.rng = options.rng || Math.random
        this.players = players.map((p, i) => ({
            id: i, name: p.name, color: p.color, isBot: !!p.isBot, alive: true, cards: []
        }))

        this.territoryIds = Object.keys(map.territories).filter(t => map.territories[t].terrain !== 'sea')
        this.state = {} // tid -> {owner: playerId, armies}
        this.tradeCount = 0
        this.round = 1
        this.log = []

        this._setup()

        this.currentIndex = 0
        this.phase = 'reinforce' // reinforce | attack | fortify | over
        this.conqueredThisTurn = false
        this.fortified = false
        this.winner = null
        this._startTurn()
    }

    _setup() {
        // deal territories round-robin, then auto-spread remaining armies
        const perPlayer = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 }[this.players.length]
        const shuffled = this._shuffle(this.territoryIds.slice())
        shuffled.forEach((tid, i) => {
            this.state[tid] = { owner: i % this.players.length, armies: 1 }
        })
        for (const p of this.players) {
            const mine = this.territoriesOf(p.id)
            let remaining = perPlayer - mine.length
            while (remaining > 0) {
                const tid = mine[Math.floor(this.rng() * mine.length)]
                this.state[tid].armies += 1
                remaining -= 1
            }
        }
        // card deck: one card per territory (cycling types) + 2 wilds
        const types = ['infantry', 'cavalry', 'artillery']
        this.deck = this._shuffle([
            ...this.territoryIds.map((tid, i) => ({ territory: tid, kind: types[i % 3] })),
            { territory: null, kind: 'wild' }, { territory: null, kind: 'wild' }
        ])
        this.discard = []
    }

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1))
            ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr
    }

    // ---- queries ----

    currentPlayer() { return this.players[this.currentIndex] }
    territoriesOf(pid) { return this.territoryIds.filter(t => this.state[t].owner === pid) }
    continentsOf(pid) {
        return Object.entries(this.map.risk.continents)
            .filter(([, c]) => c.territories.every(t => this.state[t].owner === pid))
            .map(([cid]) => cid)
    }

    reinforcementsFor(pid) {
        const base = Math.max(3, Math.floor(this.territoriesOf(pid).length / 3))
        const bonus = this.continentsOf(pid)
            .reduce((sum, cid) => sum + this.map.risk.continents[cid].bonus, 0)
        return base + bonus
    }

    nextTradeValue() {
        return this.tradeCount < RISK_CARD_VALUES.length
            ? RISK_CARD_VALUES[this.tradeCount]
            : RISK_CARD_VALUES[RISK_CARD_VALUES.length - 1] + 5 * (this.tradeCount - RISK_CARD_VALUES.length + 1)
    }

    tradeableSets(cards) {
        const sets = []
        const n = cards.length
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
            const kinds = [cards[i], cards[j], cards[k]].map(c => c.kind)
            const wilds = kinds.filter(x => x === 'wild').length
            const real = new Set(kinds.filter(x => x !== 'wild'))
            if (wilds >= 1 || real.size === 1 || real.size === 3) sets.push([i, j, k])
        }
        return sets
    }

    mustTrade(pid) { return this.players[pid].cards.length >= 5 }

    // ---- reinforce phase ----

    tradeCards(indices) {
        const p = this.currentPlayer()
        if (this.phase !== 'reinforce') throw new Error('can only trade during reinforce')
        const set = indices.slice().sort((a, b) => b - a)
        const cards = indices.map(i => p.cards[i])
        const valid = this.tradeableSets(p.cards).some(s =>
            s.slice().sort().join() === indices.slice().sort().join())
        if (!valid) throw new Error('not a valid set')
        const value = this.nextTradeValue()
        this.tradeCount += 1
        for (const i of set) p.cards.splice(i, 1)
        this.discard.push(...cards)
        // +2 bonus armies on an owned territory matching a traded card
        for (const c of cards) {
            if (c.territory && this.state[c.territory].owner === p.id) {
                this.state[c.territory].armies += 2
                this._log(`${p.name} places 2 bonus armies on ${this.map.territories[c.territory].name}`)
                break
            }
        }
        this.toPlace += value
        this._log(`${p.name} trades cards for ${value} armies`)
        return value
    }

    placeArmies(tid, count) {
        if (this.phase !== 'reinforce') throw new Error('not in reinforce phase')
        const p = this.currentPlayer()
        if (this.state[tid].owner !== p.id) throw new Error('not your territory')
        if (count < 1 || count > this.toPlace) throw new Error('bad count')
        this.state[tid].armies += count
        this.toPlace -= count
        if (this.toPlace === 0 && !this.mustTrade(p.id)) this.phase = 'attack'
    }

    // ---- attack phase ----

    canAttack(from, to) {
        const p = this.currentPlayer()
        return this.phase === 'attack' &&
            !this.pendingOccupy &&
            this.state[from].owner === p.id &&
            this.state[to].owner !== p.id &&
            this.state[from].armies >= 2 &&
            this.adj[from].includes(to)
    }

    attack(from, to) {
        if (!this.canAttack(from, to)) throw new Error('illegal attack')
        const atk = this.state[from]
        const def = this.state[to]
        const aDice = Math.min(3, atk.armies - 1)
        const dDice = Math.min(2, def.armies)
        const roll = n => Array.from({ length: n }, () => 1 + Math.floor(this.rng() * 6)).sort((a, b) => b - a)
        const aRoll = roll(aDice)
        const dRoll = roll(dDice)
        let aLoss = 0, dLoss = 0
        for (let i = 0; i < Math.min(aDice, dDice); i++) {
            if (aRoll[i] > dRoll[i]) dLoss++
            else aLoss++
        }
        atk.armies -= aLoss
        def.armies -= dLoss

        const result = { from, to, aRoll, dRoll, aLoss, dLoss, conquered: false, eliminated: null }
        const defenderId = def.owner
        this._log(`${this.currentPlayer().name} attacks ${this.map.territories[to].name} ` +
            `[${aRoll.join(',')}] vs [${dRoll.join(',')}] — loses ${aLoss}, defender loses ${dLoss}`)

        if (def.armies === 0) {
            result.conquered = true
            def.owner = this.currentPlayer().id
            this.conqueredThisTurn = true
            this.pendingOccupy = { from, to, min: Math.max(1, Math.min(aDice, atk.armies - 1)) }
            result.minMove = this.pendingOccupy.min
            this._log(`${this.currentPlayer().name} conquers ${this.map.territories[to].name}`)
            if (!this.territoriesOf(defenderId).length) {
                result.eliminated = defenderId
                this._eliminate(defenderId)
            }
            this._checkVictory()
        }
        return result
    }

    occupy(count) {
        const po = this.pendingOccupy
        if (!po) throw new Error('nothing to occupy')
        const max = this.state[po.from].armies - 1
        const n = Math.max(po.min, Math.min(count, max))
        this.state[po.from].armies -= n
        this.state[po.to].armies += n
        this.pendingOccupy = null
    }

    _eliminate(pid) {
        const loser = this.players[pid]
        loser.alive = false
        const p = this.currentPlayer()
        p.cards.push(...loser.cards)
        loser.cards = []
        this._log(`${loser.name} is eliminated; ${p.name} takes their cards`)
    }

    _checkVictory() {
        const alive = this.players.filter(p => p.alive)
        if (alive.length === 1) {
            if (this.pendingOccupy) this.occupy(this.pendingOccupy.min)
            this.winner = alive[0]
            this.phase = 'over'
            this._log(`${alive[0].name} conquers the world!`)
        }
    }

    endAttack() {
        if (this.phase !== 'attack') throw new Error('not attacking')
        if (this.pendingOccupy) this.occupy(this.pendingOccupy.min)
        this.phase = 'fortify'
    }

    // ---- fortify phase ----

    canFortify(from, to) {
        const p = this.currentPlayer()
        if (this.phase !== 'fortify' || this.fortified) return false
        if (this.state[from].owner !== p.id || this.state[to].owner !== p.id) return false
        if (this.state[from].armies < 2 || from === to) return false
        const path = MapCore.shortestPath(this.adj, from, to,
            t => this.territoryIds.includes(t) && this.state[t].owner === p.id)
        return !!path
    }

    fortify(from, to, count) {
        if (!this.canFortify(from, to)) throw new Error('illegal fortify')
        const n = Math.min(count, this.state[from].armies - 1)
        if (n < 1) throw new Error('bad count')
        this.state[from].armies -= n
        this.state[to].armies += n
        this.fortified = true
        this._log(`${this.currentPlayer().name} fortifies ${this.map.territories[to].name} with ${n}`)
    }

    // ---- turn flow ----

    endTurn() {
        if (this.phase === 'over') return
        if (this.pendingOccupy) this.occupy(this.pendingOccupy.min)
        const p = this.currentPlayer()
        if (this.conqueredThisTurn && this.deck.length + this.discard.length > 0) {
            if (!this.deck.length) this.deck = this._shuffle(this.discard.splice(0))
            p.cards.push(this.deck.pop())
            this._log(`${p.name} draws a card`)
        }
        do {
            this.currentIndex = (this.currentIndex + 1) % this.players.length
            if (this.currentIndex === 0) this.round += 1
        } while (!this.players[this.currentIndex].alive)
        this._startTurn()
    }

    _startTurn() {
        this.phase = 'reinforce'
        this.conqueredThisTurn = false
        this.fortified = false
        this.pendingOccupy = null
        this.toPlace = this.reinforcementsFor(this.currentIndex)
        this._log(`— ${this.currentPlayer().name}'s turn (round ${this.round}): ${this.toPlace} reinforcements`)
    }

    _log(text) { this.log.push({ round: this.round, text }) }
}

// ---- bot ----

class RiskBot {
    constructor(game, pid) {
        this.game = game
        this.pid = pid
    }

    // returns when the bot's whole turn is done
    takeTurn() {
        const g = this.game
        if (g.currentPlayer().id !== this.pid || g.phase === 'over') return

        // trade cards while required or profitable
        let sets
        while ((g.mustTrade(this.pid) || g.players[this.pid].cards.length >= 3) &&
               (sets = g.tradeableSets(g.players[this.pid].cards)).length) {
            g.tradeCards(sets[0])
        }

        // reinforce the most threatened border territory
        while (g.phase === 'reinforce' && g.toPlace > 0) {
            g.placeArmies(this._bestReinforceTarget(), Math.min(g.toPlace, 3))
        }

        // attack while odds look good
        let guard = 200
        while (g.phase === 'attack' && guard-- > 0) {
            const target = this._bestAttack()
            if (!target) break
            const res = g.attack(target.from, target.to)
            if (g.phase === 'over') return
            if (res.conquered) {
                const spare = g.state[target.from].armies - 1
                g.occupy(Math.ceil(spare * 0.7))
            }
        }
        if (g.phase === 'attack') g.endAttack()

        // fortify weakest border from safest interior
        if (g.phase === 'fortify') {
            const move = this._bestFortify()
            if (move) g.fortify(move.from, move.to, move.count)
        }
        g.endTurn()
    }

    _isBorder(tid) {
        return this.game.adj[tid].some(n =>
            this.game.territoryIds.includes(n) && this.game.state[n].owner !== this.pid)
    }

    _threat(tid) {
        const g = this.game
        let enemy = 0
        for (const n of g.adj[tid]) {
            if (g.territoryIds.includes(n) && g.state[n].owner !== this.pid) enemy += g.state[n].armies
        }
        return enemy - g.state[tid].armies
    }

    _bestReinforceTarget() {
        const g = this.game
        const mine = g.territoriesOf(this.pid)
        const borders = mine.filter(t => this._isBorder(t))
        const pool = borders.length ? borders : mine
        return pool.reduce((best, t) => this._threat(t) > this._threat(best) ? t : best, pool[0])
    }

    _bestAttack() {
        const g = this.game
        let best = null
        for (const from of g.territoriesOf(this.pid)) {
            if (g.state[from].armies < 3) continue
            for (const to of g.adj[from]) {
                if (!g.territoryIds.includes(to) || g.state[to].owner === this.pid) continue
                const edge = g.state[from].armies - 1 - g.state[to].armies
                if (edge < 2) continue
                if (!best || edge > best.edge) best = { from, to, edge }
            }
        }
        return best
    }

    _bestFortify() {
        const g = this.game
        const mine = g.territoriesOf(this.pid)
        const interior = mine.filter(t => !this._isBorder(t) && g.state[t].armies > 1)
        if (!interior.length) return null
        const from = interior.reduce((a, b) => g.state[a].armies >= g.state[b].armies ? a : b)
        const borders = mine.filter(t => this._isBorder(t))
        if (!borders.length) return null
        const to = borders.reduce((a, b) => this._threat(a) >= this._threat(b) ? a : b)
        if (!g.canFortify(from, to)) return null
        return { from, to, count: g.state[from].armies - 1 }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RiskGame, RiskBot, RISK_CARD_VALUES }
}
