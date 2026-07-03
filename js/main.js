// App shell: menu, screen switching, and the shared services (board container,
// status/controls/log panels) that mode UIs render into.

const app = {
    boardEl: null,
    statusEl: null,
    controlsEl: null,
    logEl: null,
    activeUI: null,

    setTitle(text) { document.getElementById('game-title').textContent = text },
    setTurnInfo(text) { document.getElementById('turn-info').textContent = text },

    renderLog(lines) {
        this.logEl.innerHTML = lines.map(l =>
            l.heading ? `<div class="log-turn">${l.heading}</div>` : `<div>${l.text}</div>`
        ).join('')
        this.logEl.scrollTop = this.logEl.scrollHeight
    }
}

function mapsForMode(mode) {
    return Object.values(window.STATECRAFT_MAPS || {}).filter(m => m.modes.includes(mode))
}

function showScreen(id) {
    document.getElementById('screen-menu').classList.toggle('hidden', id !== 'menu')
    document.getElementById('screen-game').classList.toggle('hidden', id !== 'game')
}

function startGame(makeUI) {
    if (app.activeUI && app.activeUI.destroy) app.activeUI.destroy()
    showScreen('game')
    document.getElementById('toggle-graph').checked = false
    app.activeUI = makeUI()
}

function populateMenu() {
    const dipMaps = mapsForMode('diplomacy')
    const riskMaps = mapsForMode('risk')

    const dipMapSel = document.getElementById('dip-map')
    dipMapSel.innerHTML = dipMaps.map(m => `<option value="${m.id}">${m.name}</option>`).join('')

    const riskMapSel = document.getElementById('risk-map')
    riskMapSel.innerHTML = riskMaps.map(m => `<option value="${m.id}">${m.name}</option>`).join('')

    const powerSel = document.getElementById('dip-power')
    const fillPowers = () => {
        const map = window.STATECRAFT_MAPS[dipMapSel.value]
        powerSel.innerHTML = Object.entries(map.diplomacy.powers)
            .map(([key, p]) => `<option value="${key}">${p.name}</option>`)
            .join('') + `<option value="">Spectate (all bots)</option>`
    }
    fillPowers()
    dipMapSel.onchange = fillPowers

    document.getElementById('start-diplomacy').onclick = () => {
        const map = window.STATECRAFT_MAPS[dipMapSel.value]
        const power = powerSel.value || null
        startGame(() => new DiplomacyUI(app, map, power))
    }

    document.getElementById('start-risk').onclick = () => {
        const map = window.STATECRAFT_MAPS[riskMapSel.value]
        const players = +document.getElementById('risk-players').value
        const humans = Math.min(+document.getElementById('risk-humans').value, players)
        startGame(() => new RiskUI(app, map, players, humans))
    }
}

document.addEventListener('DOMContentLoaded', () => {
    app.boardEl = document.getElementById('board-wrap')
    app.statusEl = document.getElementById('panel-status')
    app.controlsEl = document.getElementById('panel-controls')
    app.logEl = document.getElementById('panel-log')

    // validate shipped maps loudly so authoring mistakes surface immediately
    for (const map of Object.values(window.STATECRAFT_MAPS || {})) {
        const res = MapCore.validateMap(map)
        if (!res.ok) console.error(`map ${map.id} failed validation:`, res.errors)
        for (const w of res.warnings) console.warn(`map ${map.id}:`, w)
    }

    populateMenu()

    document.getElementById('btn-menu').onclick = () => {
        if (app.activeUI && app.activeUI.destroy) app.activeUI.destroy()
        app.activeUI = null
        showScreen('menu')
    }
    document.getElementById('toggle-graph').onchange = e => {
        if (app.activeUI) app.activeUI.board.setGraphVisible(e.target.checked)
    }
})
