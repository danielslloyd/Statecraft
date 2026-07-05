#!/usr/bin/env node
// Map generator for Statecraft.
//
// Each map is authored as a set of territory seed points plus a hand-written
// adjacency graph. Polygons are derived from the seeds as Voronoi cells
// (half-plane clipping, no dependencies) so every map satisfies the polygon
// requirements in MAP_REQUIREMENTS.md by construction. Adjacency is NEVER
// inferred from geometry — the graph layer is authoritative.
//
// Usage: node tools/gen-maps.js   (writes maps/*.js)

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Voronoi via Sutherland-Hodgman half-plane clipping. O(n^2) per map — fine
// for maps under a few hundred territories.
// ---------------------------------------------------------------------------

function clipHalfPlane(poly, mx, my, nx, ny) {
    // Keep points p with (p - m) . n <= 0
    const out = []
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i]
        const b = poly[(i + 1) % poly.length]
        const da = (a[0] - mx) * nx + (a[1] - my) * ny
        const db = (b[0] - mx) * nx + (b[1] - my) * ny
        if (da <= 0) out.push(a)
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const t = da / (da - db)
            out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
        }
    }
    return out
}

function voronoiCells(seeds, clip) {
    // seeds: {id: [x,y]}, clip: [x0,y0,x1,y1]
    const ids = Object.keys(seeds)
    const cells = {}
    for (const id of ids) {
        const [sx, sy] = seeds[id]
        let poly = [
            [clip[0], clip[1]], [clip[2], clip[1]],
            [clip[2], clip[3]], [clip[0], clip[3]]
        ]
        for (const other of ids) {
            if (other === id) continue
            const [ox, oy] = seeds[other]
            const mx = (sx + ox) / 2
            const my = (sy + oy) / 2
            poly = clipHalfPlane(poly, mx, my, ox - sx, oy - sy)
            if (poly.length === 0) break
        }
        const rounded = poly.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
        // drop near-duplicate consecutive vertices introduced by rounding
        cells[id] = rounded.filter((p, i) => {
            const q = rounded[(i + 1) % rounded.length]
            return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5
        })
    }
    return cells
}

function symmetrize(adj) {
    // one-directional authoring -> deduped undirected edge list
    const seen = new Set()
    const edges = []
    for (const a of Object.keys(adj)) {
        for (const b of adj[a]) {
            if (a === b) throw new Error(`self-loop on ${a}`)
            const key = a < b ? `${a}|${b}` : `${b}|${a}`
            if (seen.has(key)) continue
            seen.add(key)
            edges.push(a < b ? [a, b] : [b, a])
        }
    }
    return edges.sort((x, y) => (x[0] + x[1]).localeCompare(y[0] + y[1]))
}

// ---------------------------------------------------------------------------
// Classic Europe (Diplomacy). Seed coordinates from the original Statecraft
// board; adjacency corrected against the standard Diplomacy map (added North
// Africa, fixed Norway/Scandinavia/Atlantic sea links). Split coasts
// (StP/Spa/Bul) are intentionally NOT modelled — see MAP_REQUIREMENTS.md.
// ---------------------------------------------------------------------------

const EURO = {
    // id: [x, y, terrain, name]  terrain: land | coast | sea
    vie: [580, 500, 'land', 'Vienna'], bud: [640, 540, 'land', 'Budapest'],
    tri: [560, 540, 'coast', 'Trieste'], boh: [560, 450, 'land', 'Bohemia'],
    gal: [680, 480, 'land', 'Galicia'], tyr: [520, 500, 'land', 'Tyrolia'],
    lon: [320, 380, 'coast', 'London'], lvp: [300, 340, 'coast', 'Liverpool'],
    edi: [320, 280, 'coast', 'Edinburgh'], wal: [280, 380, 'coast', 'Wales'],
    yor: [340, 340, 'coast', 'Yorkshire'], cly: [300, 260, 'coast', 'Clyde'],
    par: [380, 460, 'land', 'Paris'], mar: [420, 540, 'coast', 'Marseilles'],
    bre: [320, 460, 'coast', 'Brest'], pic: [360, 420, 'coast', 'Picardy'],
    bur: [420, 480, 'land', 'Burgundy'], gas: [360, 520, 'coast', 'Gascony'],
    ber: [520, 380, 'coast', 'Berlin'], mun: [500, 460, 'land', 'Munich'],
    kie: [480, 360, 'coast', 'Kiel'], ruh: [440, 400, 'land', 'Ruhr'],
    sil: [580, 420, 'land', 'Silesia'], pru: [600, 360, 'coast', 'Prussia'],
    rom: [520, 620, 'coast', 'Rome'], ven: [520, 560, 'coast', 'Venice'],
    nap: [580, 660, 'coast', 'Naples'], tus: [480, 580, 'coast', 'Tuscany'],
    pie: [460, 540, 'coast', 'Piedmont'], apu: [600, 640, 'coast', 'Apulia'],
    mos: [780, 340, 'land', 'Moscow'], sev: [800, 560, 'coast', 'Sevastopol'],
    stp: [720, 200, 'coast', 'St Petersburg'], war: [640, 400, 'land', 'Warsaw'],
    ukr: [740, 500, 'land', 'Ukraine'], lvn: [680, 300, 'coast', 'Livonia'],
    fin: [700, 220, 'coast', 'Finland'],
    con: [740, 640, 'coast', 'Constantinople'], ank: [800, 640, 'coast', 'Ankara'],
    smy: [760, 680, 'coast', 'Smyrna'], arm: [860, 620, 'coast', 'Armenia'],
    syr: [840, 700, 'coast', 'Syria'],
    bel: [400, 400, 'coast', 'Belgium'], hol: [420, 380, 'coast', 'Holland'],
    den: [480, 320, 'coast', 'Denmark'], swe: [580, 260, 'coast', 'Sweden'],
    nor: [520, 220, 'coast', 'Norway'], spa: [320, 580, 'coast', 'Spain'],
    por: [260, 600, 'coast', 'Portugal'], tun: [440, 700, 'coast', 'Tunis'],
    ser: [640, 580, 'land', 'Serbia'], bul: [720, 620, 'coast', 'Bulgaria'],
    gre: [680, 680, 'coast', 'Greece'], rum: [720, 560, 'coast', 'Rumania'],
    alb: [640, 640, 'coast', 'Albania'], naf: [340, 690, 'coast', 'North Africa'],
    nth: [400, 320, 'sea', 'North Sea'], eng: [340, 420, 'sea', 'English Channel'],
    iri: [280, 340, 'sea', 'Irish Sea'], mao: [240, 500, 'sea', 'Mid-Atlantic Ocean'],
    nao: [220, 300, 'sea', 'North Atlantic'], nwg: [420, 220, 'sea', 'Norwegian Sea'],
    bar: [740, 160, 'sea', 'Barents Sea'], bal: [580, 320, 'sea', 'Baltic Sea'],
    ska: [500, 300, 'sea', 'Skagerrak'], hel: [440, 360, 'sea', 'Helgoland Bight'],
    wes: [380, 620, 'sea', 'Western Mediterranean'], lyo: [420, 580, 'sea', 'Gulf of Lyon'],
    tys: [500, 640, 'sea', 'Tyrrhenian Sea'], ion: [600, 700, 'sea', 'Ionian Sea'],
    adr: [580, 600, 'sea', 'Adriatic Sea'], aeg: [700, 680, 'sea', 'Aegean Sea'],
    eas: [780, 720, 'sea', 'Eastern Mediterranean'], bla: [780, 600, 'sea', 'Black Sea'],
    bot: [640, 240, 'sea', 'Gulf of Bothnia']
}

const EURO_ADJ = {
    vie: ['boh', 'gal', 'bud', 'tri', 'tyr'],
    bud: ['vie', 'gal', 'rum', 'ser', 'tri'],
    tri: ['vie', 'bud', 'ser', 'alb', 'adr', 'ven', 'tyr'],
    boh: ['vie', 'mun', 'sil', 'gal', 'tyr'],
    gal: ['vie', 'boh', 'sil', 'war', 'ukr', 'rum', 'bud'],
    tyr: ['vie', 'boh', 'mun', 'ven', 'tri', 'pie'],
    lon: ['wal', 'yor', 'nth', 'eng'],
    lvp: ['cly', 'edi', 'yor', 'wal', 'iri', 'nao'],
    edi: ['cly', 'yor', 'lvp', 'nth', 'nwg'],
    wal: ['lon', 'yor', 'lvp', 'iri', 'eng'],
    yor: ['lon', 'wal', 'lvp', 'edi', 'nth'],
    cly: ['edi', 'lvp', 'nao', 'nwg'],
    par: ['pic', 'bur', 'gas', 'bre'],
    mar: ['pie', 'bur', 'gas', 'spa', 'lyo'],
    bre: ['par', 'pic', 'gas', 'mao', 'eng'],
    pic: ['par', 'bre', 'eng', 'bel', 'bur'],
    bur: ['par', 'pic', 'bel', 'ruh', 'mun', 'mar', 'gas'],
    gas: ['par', 'bre', 'mao', 'spa', 'mar', 'bur'],
    ber: ['kie', 'pru', 'sil', 'mun', 'bal'],
    mun: ['ber', 'sil', 'boh', 'tyr', 'bur', 'ruh', 'kie'],
    kie: ['ber', 'mun', 'ruh', 'hol', 'hel', 'den', 'bal'],
    ruh: ['kie', 'mun', 'bur', 'bel', 'hol'],
    sil: ['ber', 'pru', 'war', 'gal', 'boh', 'mun'],
    pru: ['ber', 'bal', 'lvn', 'war', 'sil'],
    rom: ['tus', 'ven', 'apu', 'nap', 'tys'],
    ven: ['tyr', 'tri', 'adr', 'apu', 'rom', 'tus', 'pie'],
    nap: ['rom', 'apu', 'ion', 'tys'],
    tus: ['pie', 'ven', 'rom', 'tys', 'lyo'],
    pie: ['tyr', 'ven', 'tus', 'lyo', 'mar'],
    apu: ['ven', 'adr', 'ion', 'nap', 'rom'],
    mos: ['stp', 'lvn', 'war', 'ukr', 'sev'],
    sev: ['mos', 'ukr', 'rum', 'bla', 'arm'],
    stp: ['mos', 'lvn', 'fin', 'bot', 'bar', 'nor'],
    war: ['pru', 'lvn', 'mos', 'ukr', 'gal', 'sil'],
    ukr: ['mos', 'war', 'gal', 'rum', 'sev'],
    lvn: ['pru', 'bal', 'bot', 'stp', 'mos', 'war'],
    fin: ['stp', 'bot', 'swe', 'nor'],
    con: ['bul', 'bla', 'ank', 'smy', 'aeg'],
    ank: ['con', 'bla', 'arm', 'smy'],
    smy: ['con', 'ank', 'arm', 'syr', 'eas', 'aeg'],
    arm: ['sev', 'bla', 'ank', 'smy', 'syr'],
    syr: ['arm', 'smy', 'eas'],
    bel: ['pic', 'bur', 'ruh', 'hol', 'eng', 'nth'],
    hol: ['bel', 'ruh', 'kie', 'hel', 'nth'],
    den: ['kie', 'bal', 'ska', 'hel', 'nth', 'swe'],
    swe: ['nor', 'den', 'ska', 'bal', 'bot', 'fin'],
    nor: ['swe', 'ska', 'nth', 'nwg', 'bar', 'stp', 'fin'],
    spa: ['por', 'gas', 'mar', 'mao', 'wes', 'lyo'],
    por: ['spa', 'mao'],
    tun: ['wes', 'tys', 'ion', 'naf'],
    naf: ['mao', 'wes', 'tun'],
    ser: ['bud', 'rum', 'bul', 'gre', 'alb', 'tri'],
    bul: ['rum', 'ser', 'gre', 'con', 'bla', 'aeg'],
    gre: ['ser', 'bul', 'alb', 'aeg', 'ion'],
    rum: ['bud', 'gal', 'ukr', 'sev', 'bla', 'bul', 'ser'],
    alb: ['tri', 'ser', 'gre', 'adr', 'ion'],
    nth: ['nwg', 'eng', 'bel', 'hol', 'hel', 'den', 'ska', 'yor', 'lon', 'edi', 'nor'],
    eng: ['iri', 'mao', 'bre', 'pic', 'bel', 'nth', 'lon', 'wal'],
    iri: ['nao', 'mao', 'eng', 'wal', 'lvp'],
    mao: ['nao', 'iri', 'eng', 'bre', 'gas', 'spa', 'por', 'wes', 'naf'],
    nao: ['nwg', 'cly', 'lvp', 'iri', 'mao'],
    nwg: ['bar', 'nor', 'nth', 'nao', 'cly', 'edi'],
    bar: ['nwg', 'nor', 'stp'],
    bal: ['bot', 'swe', 'den', 'kie', 'ber', 'pru', 'lvn'],
    ska: ['nth', 'den', 'swe', 'nor'],
    hel: ['nth', 'hol', 'kie', 'den'],
    wes: ['mao', 'spa', 'lyo', 'tys', 'tun', 'naf'],
    lyo: ['spa', 'mar', 'pie', 'tus', 'wes'],
    tys: ['lyo', 'tus', 'rom', 'nap', 'ion', 'tun', 'wes'],
    ion: ['tys', 'nap', 'apu', 'adr', 'alb', 'gre', 'aeg', 'eas', 'tun'],
    adr: ['tri', 'ven', 'apu', 'ion', 'alb'],
    aeg: ['gre', 'bul', 'con', 'smy', 'eas', 'ion'],
    eas: ['aeg', 'smy', 'syr', 'ion'],
    bla: ['rum', 'bul', 'con', 'ank', 'arm', 'sev'],
    bot: ['swe', 'fin', 'stp', 'lvn', 'bal']
}

const EURO_POWERS = {
    AUSTRIA: { name: 'Austria-Hungary', color: '#c0392b' },
    ENGLAND: { name: 'England', color: '#2c5f9e' },
    FRANCE: { name: 'France', color: '#5dade2' },
    GERMANY: { name: 'Germany', color: '#4d5656' },
    ITALY: { name: 'Italy', color: '#229954' },
    RUSSIA: { name: 'Russia', color: '#8e44ad' },
    TURKEY: { name: 'Turkey', color: '#d4ac0d' }
}

const EURO_HOMES = {
    AUSTRIA: ['vie', 'bud', 'tri'],
    ENGLAND: ['lon', 'lvp', 'edi'],
    FRANCE: ['par', 'mar', 'bre'],
    GERMANY: ['ber', 'mun', 'kie'],
    ITALY: ['rom', 'ven', 'nap'],
    RUSSIA: ['mos', 'sev', 'stp', 'war'],
    TURKEY: ['con', 'ank', 'smy']
}

const EURO_NEUTRAL_SCS = ['bel', 'hol', 'den', 'swe', 'nor', 'spa', 'por', 'tun', 'ser', 'bul', 'gre', 'rum']

const EURO_UNITS = {
    AUSTRIA: [['vie', 'army'], ['bud', 'army'], ['tri', 'fleet']],
    ENGLAND: [['lon', 'fleet'], ['lvp', 'army'], ['edi', 'fleet']],
    FRANCE: [['par', 'army'], ['mar', 'army'], ['bre', 'fleet']],
    GERMANY: [['ber', 'army'], ['mun', 'army'], ['kie', 'fleet']],
    ITALY: [['rom', 'army'], ['ven', 'army'], ['nap', 'fleet']],
    RUSSIA: [['mos', 'army'], ['sev', 'fleet'], ['stp', 'fleet'], ['war', 'army']],
    TURKEY: [['con', 'army'], ['ank', 'fleet'], ['smy', 'army']]
}

// ---------------------------------------------------------------------------
// Classic World (Risk). 42 territories, 6 continents, standard adjacency.
// All territories are land ('coast'/'sea' are Diplomacy concepts); sea routes
// exist only as graph edges and render as dashed links.
// ---------------------------------------------------------------------------

const WORLD = {
    alaska: [80, 140, 'Alaska'], nwterritory: [210, 110, 'Northwest Territory'],
    greenland: [420, 70, 'Greenland'], alberta: [185, 200, 'Alberta'],
    ontario: [285, 200, 'Ontario'], quebec: [375, 195, 'Quebec'],
    wus: [190, 300, 'Western United States'], eus: [300, 310, 'Eastern United States'],
    cam: [235, 400, 'Central America'],
    venezuela: [300, 480, 'Venezuela'], peru: [300, 590, 'Peru'],
    brazil: [395, 550, 'Brazil'], argentina: [330, 700, 'Argentina'],
    iceland: [495, 150, 'Iceland'], scandinavia: [620, 110, 'Scandinavia'],
    ukraine: [705, 200, 'Ukraine'], gbr: [505, 230, 'Great Britain'],
    neur: [595, 230, 'Northern Europe'], weur: [525, 310, 'Western Europe'],
    seur: [625, 300, 'Southern Europe'],
    nafr: [560, 450, 'North Africa'], egypt: [645, 400, 'Egypt'],
    eafr: [695, 510, 'East Africa'], congo: [625, 560, 'Congo'],
    safr: [645, 670, 'South Africa'], madagascar: [750, 650, 'Madagascar'],
    ural: [790, 160, 'Ural'], siberia: [865, 100, 'Siberia'],
    yakutsk: [960, 80, 'Yakutsk'], kamchatka: [1090, 90, 'Kamchatka'],
    irkutsk: [935, 175, 'Irkutsk'], mongolia: [955, 255, 'Mongolia'],
    japan: [1095, 265, 'Japan'], afghanistan: [785, 280, 'Afghanistan'],
    china: [905, 340, 'China'], mideast: [720, 370, 'Middle East'],
    india: [835, 420, 'India'], siam: [925, 440, 'Siam'],
    indonesia: [955, 545, 'Indonesia'], newguinea: [1085, 510, 'New Guinea'],
    waus: [990, 665, 'Western Australia'], eaus: [1095, 655, 'Eastern Australia']
}

const WORLD_ADJ = {
    alaska: ['nwterritory', 'alberta', 'kamchatka'],
    nwterritory: ['alaska', 'alberta', 'ontario', 'greenland'],
    greenland: ['nwterritory', 'ontario', 'quebec', 'iceland'],
    alberta: ['alaska', 'nwterritory', 'ontario', 'wus'],
    ontario: ['nwterritory', 'alberta', 'greenland', 'quebec', 'wus', 'eus'],
    quebec: ['greenland', 'ontario', 'eus'],
    wus: ['alberta', 'ontario', 'eus', 'cam'],
    eus: ['ontario', 'quebec', 'wus', 'cam'],
    cam: ['wus', 'eus', 'venezuela'],
    venezuela: ['cam', 'peru', 'brazil'],
    peru: ['venezuela', 'brazil', 'argentina'],
    brazil: ['venezuela', 'peru', 'argentina', 'nafr'],
    argentina: ['peru', 'brazil'],
    iceland: ['greenland', 'gbr', 'scandinavia'],
    scandinavia: ['iceland', 'gbr', 'neur', 'ukraine'],
    gbr: ['iceland', 'scandinavia', 'neur', 'weur'],
    neur: ['gbr', 'scandinavia', 'ukraine', 'seur', 'weur'],
    weur: ['gbr', 'neur', 'seur', 'nafr'],
    seur: ['weur', 'neur', 'ukraine', 'mideast', 'egypt', 'nafr'],
    ukraine: ['scandinavia', 'neur', 'seur', 'ural', 'afghanistan', 'mideast'],
    nafr: ['brazil', 'weur', 'seur', 'egypt', 'eafr', 'congo'],
    egypt: ['seur', 'nafr', 'eafr', 'mideast'],
    eafr: ['egypt', 'nafr', 'congo', 'safr', 'madagascar', 'mideast'],
    congo: ['nafr', 'eafr', 'safr'],
    safr: ['congo', 'eafr', 'madagascar'],
    madagascar: ['eafr', 'safr'],
    ural: ['ukraine', 'siberia', 'china', 'afghanistan'],
    siberia: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'],
    yakutsk: ['siberia', 'kamchatka', 'irkutsk'],
    kamchatka: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'],
    irkutsk: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'],
    mongolia: ['siberia', 'irkutsk', 'kamchatka', 'japan', 'china'],
    japan: ['kamchatka', 'mongolia'],
    afghanistan: ['ukraine', 'ural', 'china', 'india', 'mideast'],
    china: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'],
    mideast: ['ukraine', 'seur', 'egypt', 'eafr', 'afghanistan', 'india'],
    india: ['mideast', 'afghanistan', 'china', 'siam'],
    siam: ['india', 'china', 'indonesia'],
    indonesia: ['siam', 'newguinea', 'waus'],
    newguinea: ['indonesia', 'waus', 'eaus'],
    waus: ['indonesia', 'newguinea', 'eaus'],
    eaus: ['newguinea', 'waus']
}

const WORLD_CONTINENTS = {
    northamerica: {
        name: 'North America', bonus: 5, color: '#c8a239',
        territories: ['alaska', 'nwterritory', 'greenland', 'alberta', 'ontario', 'quebec', 'wus', 'eus', 'cam']
    },
    southamerica: {
        name: 'South America', bonus: 2, color: '#b5533c',
        territories: ['venezuela', 'peru', 'brazil', 'argentina']
    },
    europe: {
        name: 'Europe', bonus: 5, color: '#4a7fb5',
        territories: ['iceland', 'scandinavia', 'ukraine', 'gbr', 'neur', 'weur', 'seur']
    },
    africa: {
        name: 'Africa', bonus: 3, color: '#a8763e',
        territories: ['nafr', 'egypt', 'eafr', 'congo', 'safr', 'madagascar']
    },
    asia: {
        name: 'Asia', bonus: 7, color: '#5b9e6f',
        territories: ['ural', 'siberia', 'yakutsk', 'kamchatka', 'irkutsk', 'mongolia', 'japan', 'afghanistan', 'china', 'mideast', 'india', 'siam']
    },
    australia: {
        name: 'Australia', bonus: 2, color: '#8f6bb0',
        territories: ['indonesia', 'newguinea', 'waus', 'eaus']
    }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function buildEuropeMap() {
    const seeds = {}
    for (const id of Object.keys(EURO)) seeds[id] = [EURO[id][0], EURO[id][1]]
    const cells = voronoiCells(seeds, [150, 90, 930, 790])

    const territories = {}
    for (const id of Object.keys(EURO)) {
        const [x, y, terrain, name] = EURO[id]
        territories[id] = { name, terrain, center: [x, y], polygon: cells[id] }
    }

    const supplyCenters = [...Object.values(EURO_HOMES).flat(), ...EURO_NEUTRAL_SCS]
    const startingUnits = {}
    for (const p of Object.keys(EURO_UNITS)) {
        startingUnits[p] = EURO_UNITS[p].map(([territory, type]) => ({ territory, type }))
    }

    return {
        id: 'classic-europe',
        name: 'Classic Europe',
        modes: ['diplomacy'],
        width: 1080,
        height: 880,
        territories,
        edges: symmetrize(EURO_ADJ),
        diplomacy: {
            powers: EURO_POWERS,
            supplyCenters,
            homeCenters: EURO_HOMES,
            startingUnits,
            victorySupplyCenters: 18,
            startYear: 1901
        }
    }
}

function buildWorldMap() {
    const seeds = {}
    for (const id of Object.keys(WORLD)) seeds[id] = [WORLD[id][0], WORLD[id][1]]
    const cells = voronoiCells(seeds, [20, 20, 1180, 780])

    const territories = {}
    for (const id of Object.keys(WORLD)) {
        const [x, y, name] = WORLD[id]
        territories[id] = { name, terrain: 'land', center: [x, y], polygon: cells[id] }
    }

    return {
        id: 'classic-world',
        name: 'Classic World',
        modes: ['risk'],
        width: 1200,
        height: 800,
        territories,
        edges: symmetrize(WORLD_ADJ),
        risk: { continents: WORLD_CONTINENTS }
    }
}

function emit(map, file) {
    const src = `// Generated by tools/gen-maps.js — do not edit by hand.
// Regenerate with: node tools/gen-maps.js
(function () {
    const MAP = ${JSON.stringify(map)}
    if (typeof window !== 'undefined') {
        window.STATECRAFT_MAPS = window.STATECRAFT_MAPS || {}
        window.STATECRAFT_MAPS[MAP.id] = MAP
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = MAP
})()
`
    fs.writeFileSync(file, src)
    console.log(`wrote ${file}`)
}

const outDir = path.join(__dirname, '..', 'maps')
fs.mkdirSync(outDir, { recursive: true })
emit(buildEuropeMap(), path.join(outDir, 'classic-europe.js'))
emit(buildWorldMap(), path.join(outDir, 'classic-world.js'))
