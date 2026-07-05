#!/usr/bin/env node
// Headless smoke tests: validate the shipped maps, then play full bot-vs-bot
// games of both modes checking state invariants every step.
// Run with: node tests/smoke.js

global.MapCore = require('../js/mapcore.js')
const { DiplomacyGame, DiplomacyBot } = require('../js/diplomacy.js')
const { RiskGame, RiskBot } = require('../js/risk.js')

const europeMap = require('../maps/classic-europe.js')
const worldMap = require('../maps/classic-world.js')

let failures = 0
function assert(cond, msg) {
    if (!cond) {
        failures++
        console.error('  FAIL:', msg)
    }
}

function seededRng(seed) {
    let s = seed >>> 0
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return s / 4294967296
    }
}

// ---- map validation ----

console.log('== map validation ==')
for (const map of [europeMap, worldMap]) {
    const res = MapCore.validateMap(map)
    assert(res.ok, `${map.id}: ${res.errors.join('; ')}`)
    for (const w of res.warnings) console.log(`  warn (${map.id}): ${w}`)
    console.log(`  ${map.id}: ${Object.keys(map.territories).length} territories, ${map.edges.length} edges, ok=${res.ok}`)
}

// deliberately broken maps must fail validation
const broken = JSON.parse(JSON.stringify(worldMap))
delete broken.territories.japan
assert(!MapCore.validateMap(broken).ok, 'map with dangling edges should fail validation')

const disconnected = JSON.parse(JSON.stringify(worldMap))
disconnected.edges = disconnected.edges.filter(([a, b]) => a !== 'japan' && b !== 'japan')
assert(!MapCore.validateMap(disconnected).ok, 'disconnected graph should fail validation')

// ---- diplomacy unit tests ----

console.log('== diplomacy adjudication ==')
{
    const g = new DiplomacyGame(europeMap, { rng: seededRng(1) })
    // basic bounce: A par -> bur, A mun -> bur
    const par = g.unitAt('par'), mun = g.unitAt('mun')
    g.setOrder(par.id, { type: 'move', to: 'bur' })
    g.setOrder(mun.id, { type: 'move', to: 'bur' })
    g.resolve()
    assert(par.territory === 'par' && mun.territory === 'mun', 'equal-strength moves should bounce')
}
{
    const g = new DiplomacyGame(europeMap, { rng: seededRng(1) })
    // supported attack dislodges: A par -> bur supported by A mar; A mun -> bur
    const par = g.unitAt('par'), mar = g.unitAt('mar'), mun = g.unitAt('mun')
    g.setOrder(par.id, { type: 'move', to: 'bur' })
    g.setOrder(mar.id, { type: 'support', from: 'par', to: 'bur' })
    g.setOrder(mun.id, { type: 'move', to: 'bur' })
    g.resolve()
    assert(par.territory === 'bur', 'supported move should win 2v1')
    assert(mun.territory === 'mun', 'unsupported competitor should bounce')
}
{
    const g = new DiplomacyGame(europeMap, { rng: seededRng(1) })
    // supported move into empty territory beats an unsupported competitor:
    // A mun -> tyr supported by A vie (cross-power support), vs A ven -> tyr
    const ven = g.unitAt('ven'), vie = g.unitAt('vie'), mun = g.unitAt('mun')
    g.setOrder(mun.id, { type: 'move', to: 'tyr' })
    g.setOrder(vie.id, { type: 'support', from: 'mun', to: 'tyr' })
    g.setOrder(ven.id, { type: 'move', to: 'tyr' })
    g.resolve()
    assert(mun.territory === 'tyr', 'supported move into empty territory beats competitor')
    assert(ven.territory === 'ven', 'weaker competitor bounces')
}
{
    const g = new DiplomacyGame(europeMap, { rng: seededRng(1) })
    // head-to-head: equal strength, both stay
    const vie = g.unitAt('vie'), ven = g.unitAt('ven')
    g.setOrder(vie.id, { type: 'move', to: 'tyr' })
    g.resolve() // spring: vie -> tyr
    assert(g.unitAt('tyr') && g.unitAt('tyr').power === 'AUSTRIA', 'setup move failed')
    const tyr = g.unitAt('tyr')
    g.setOrder(tyr.id, { type: 'move', to: 'ven' })
    g.setOrder(ven.id, { type: 'move', to: 'tyr' })
    g.resolve()
    assert(tyr.territory === 'tyr' && ven.territory === 'ven', 'head-to-head tie should hold both')
}
{
    // dislodgement produces a retreat phase
    const g = new DiplomacyGame(europeMap, { rng: seededRng(1) })
    const vie = g.unitAt('vie'), ven = g.unitAt('ven')
    g.setOrder(vie.id, { type: 'move', to: 'tyr' })
    g.resolve() // spring: Austria occupies Tyrolia
    const tyr = g.unitAt('tyr')
    // fall: Germany mun -> tyr supported by Italy ven (2v1 dislodges)
    const mun = g.unitAt('mun')
    g.setOrder(mun.id, { type: 'move', to: 'tyr' })
    g.setOrder(ven.id, { type: 'support', from: 'mun', to: 'tyr' })
    g.resolve()
    assert(mun.territory === 'tyr', 'supported attack should dislodge holder')
    assert(g.phase === 'retreats', 'dislodgement should trigger retreat phase')
    assert(g.dislodged.length === 1 && g.dislodged[0].unit === tyr, 'tyr unit should be dislodged')
    assert(!g.dislodged[0].options.includes('mun'), 'cannot retreat to attacker origin')
    g.setRetreat(tyr.id, g.dislodged[0].options[0] || null)
    g.resolveRetreats()
    assert(g.phase === 'orders' || g.phase === 'builds', 'game continues after retreats')
}
{
    // convoy: England London army convoyed across the Channel
    const g = new DiplomacyGame(europeMap, { rng: seededRng(1) })
    const lvp = g.unitAt('lvp'), lon = g.unitAt('lon')
    g.setOrder(lvp.id, { type: 'move', to: 'wal' })
    g.resolve()
    const wal = g.unitAt('wal')
    const fLon = g.unitAt('lon')
    g.setOrder(fLon.id, { type: 'move', to: 'eng' })
    g.resolve() // builds may trigger? no, fall->builds only if deltas; SC unchanged so next spring
    const fEng = g.unitAt('eng')
    assert(fEng && fEng.type === 'fleet', 'fleet should reach English Channel')
    assert(g.convoyTargets(wal).includes('bre'), 'convoy target via occupied sea should be listed')
    g.setOrder(wal.id, { type: 'move', to: 'bre' })
    g.setOrder(fEng.id, { type: 'convoy', from: 'wal', to: 'bre' })
    const bre = g.unitAt('bre') // French fleet starts in bre — it will defend
    g.resolve()
    // French fleet holds with strength 1, attack strength 1 → bounce, but convoy itself is valid
    assert(wal.territory === 'wal', 'convoyed attack vs holder should bounce at 1v1')
}

// ---- diplomacy full game ----

console.log('== diplomacy bot game ==')
{
    const g = new DiplomacyGame(europeMap, { rng: seededRng(42) })
    const bots = g.powers.map(p => new DiplomacyBot(g, p))
    let steps = 0
    while (!g.winner && g.year < 1931 && steps++ < 500) {
        if (g.phase === 'orders') {
            bots.forEach(b => b.submitOrders())
            g.resolve()
        } else if (g.phase === 'retreats') {
            bots.forEach(b => b.submitRetreats())
            g.resolveRetreats()
        } else if (g.phase === 'builds') {
            bots.forEach(b => b.submitAdjustments())
            g.resolveBuilds()
        } else break

        // invariants (during retreats a dislodged unit legitimately shares
        // its territory with the attacker until it retreats)
        if (g.phase !== 'retreats') {
            const seen = new Set()
            for (const u of g.units) {
                assert(!seen.has(u.territory), `two units in ${u.territory} (${g.turnLabel()})`)
                seen.add(u.territory)
                assert(g.canOccupy(u.type, u.territory), `${u.type} illegally in ${u.territory}`)
            }
        }
        const totalSCs = Object.values(g.scOwner).filter(Boolean).length
        assert(totalSCs <= Object.keys(g.scOwner).length, 'SC bookkeeping broken')
    }
    const counts = g.powers.map(p => `${p}:${g.supplyCount(p)}`).join(' ')
    console.log(`  reached ${g.turnLabel()} in ${steps} steps; winner=${g.winner || 'none'}; ${counts}`)
    assert(steps > 10, 'game should progress')
}

// ---- risk full game ----

console.log('== risk bot game ==')
{
    const players = [
        { name: 'Red', color: '#c0392b', isBot: true },
        { name: 'Blue', color: '#2980b9', isBot: true },
        { name: 'Green', color: '#27ae60', isBot: true },
        { name: 'Purple', color: '#8e44ad', isBot: true }
    ]
    const g = new RiskGame(worldMap, players, { rng: seededRng(7) })

    // setup invariants
    let total = 0
    for (const tid of g.territoryIds) {
        assert(g.state[tid].armies >= 1, `territory ${tid} has no armies`)
        assert(g.state[tid].owner >= 0 && g.state[tid].owner < 4, `territory ${tid} unowned`)
        total += g.state[tid].armies
    }
    assert(total === 4 * 30, `initial armies should be 120, got ${total}`)

    const bots = players.map((_, i) => new RiskBot(g, i))
    let turns = 0
    while (!g.winner && turns++ < 2000) {
        bots[g.currentPlayer().id].takeTurn()
        for (const tid of g.territoryIds) {
            assert(g.state[tid].armies >= 1, `${tid} left with ${g.state[tid].armies} armies`)
            assert(g.players[g.state[tid].owner].alive, `${tid} owned by dead player`)
        }
    }
    console.log(`  ${turns} turns; winner=${g.winner ? g.winner.name : 'none'}; round=${g.round}`)
    assert(g.winner || g.round > 3, 'risk game should progress')
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall smoke tests passed')
process.exit(failures ? 1 : 0)
