// Main game controller

let renderer = null;
let botPlayers = {};

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-board');
    renderer = new Renderer(canvas);

    // Load available maps
    loadAvailableMaps();

    // Initialize game state
    gameState = new GameState();

    // Initialize bot players for each nation
    for (const nation of Object.keys(NATIONS)) {
        botPlayers[nation] = new BotPlayer(nation, gameState);
    }

    setupEventListeners();
    updateUI();
    renderer.render();
});

// Map Management
function loadAvailableMaps() {
    const mapSelect = document.getElementById('map-select');

    // Check localStorage for saved maps
    const savedMaps = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('statecraft_map_')) {
            const mapName = key.replace('statecraft_map_', '');
            savedMaps.push(mapName);
        }
    }

    // Add saved maps to dropdown
    for (const mapName of savedMaps) {
        const option = document.createElement('option');
        option.value = mapName;
        option.textContent = mapName;
        mapSelect.appendChild(option);
    }
}

function loadMapData(mapName) {
    if (mapName === 'classic') {
        // Use default map data (already loaded from gameData.js)
        return;
    }

    const mapData = localStorage.getItem(`statecraft_map_${mapName}`);
    if (mapData) {
        try {
            const parsed = JSON.parse(mapData);
            // In a full implementation, we would override PROVINCES, ADJACENCIES, etc.
            // For now, just log that we found it
            addLog(`Loaded map: ${mapName}`, 'info');
        } catch (e) {
            addLog(`Error loading map: ${mapName}`, 'error');
        }
    }
}

function setupEventListeners() {
    const canvas = document.getElementById('game-board');

    // Canvas click handler
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        handleCanvasClick(x, y);
    });

    // Canvas hover handler
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const province = renderer.getProvinceAtPosition(x, y);
        if (province !== renderer.hoveredProvince) {
            renderer.hoveredProvince = province;
            renderer.render();
        }
    });

    // Order type buttons
    document.getElementById('btn-hold').addEventListener('click', () => setOrderType('hold'));
    document.getElementById('btn-move').addEventListener('click', () => setOrderType('move'));
    document.getElementById('btn-support').addEventListener('click', () => setOrderType('support'));
    document.getElementById('btn-convoy').addEventListener('click', () => setOrderType('convoy'));

    // Action buttons
    document.getElementById('btn-clear-orders').addEventListener('click', clearAllOrders);
    document.getElementById('btn-resolve').addEventListener('click', resolveTurn);
    document.getElementById('btn-save-game').addEventListener('click', saveGame);
    document.getElementById('btn-load-game').addEventListener('click', loadGame);
    document.getElementById('btn-bot-action').addEventListener('click', triggerBotDiplomacy);

    // Map selector
    document.getElementById('map-select').addEventListener('change', (e) => {
        loadMapData(e.target.value);
    });
}

function handleCanvasClick(x, y) {
    const provinceCode = renderer.getProvinceAtPosition(x, y);
    if (!provinceCode) return;

    const clickedUnit = gameState.getUnit(provinceCode);

    if (gameState.selectedUnit) {
        // A unit is already selected, process order
        if (clickedUnit && clickedUnit.id === gameState.selectedUnit.id) {
            // Clicked on same unit, deselect
            gameState.selectedUnit = null;
        } else {
            // Create order based on current order type
            createOrder(gameState.selectedUnit, provinceCode);
        }
    } else {
        // No unit selected, select one if clicked
        if (clickedUnit) {
            gameState.selectedUnit = clickedUnit;
        }
    }

    updateUI();
    renderer.render();
}

function createOrder(unit, targetProvince) {
    const orderType = gameState.currentOrderType;

    if (orderType === 'hold') {
        gameState.addOrder({
            type: 'hold',
            unit: unit,
            from: unit.province
        });
        addLog(`${NATIONS[unit.nation].shortName} ${unit.type} in ${PROVINCES[unit.province].name} holds.`);
        gameState.selectedUnit = null;
    } else if (orderType === 'move') {
        // Check if move is valid
        if (gameState.canUnitReach(unit, targetProvince)) {
            gameState.addOrder({
                type: 'move',
                unit: unit,
                from: unit.province,
                to: targetProvince
            });
            addLog(`${NATIONS[unit.nation].shortName} ${unit.type} moves ${PROVINCES[unit.province].name} → ${PROVINCES[targetProvince].name}`);
            gameState.selectedUnit = null;
        } else {
            addLog(`Invalid move: ${PROVINCES[unit.province].name} → ${PROVINCES[targetProvince].name}`, 'error');
        }
    } else if (orderType === 'support') {
        // For support, we need two clicks: first the unit being supported, then the destination
        // This is a simplified version - just support any adjacent move
        const targetUnit = gameState.getUnit(targetProvince);
        if (targetUnit) {
            // Support a unit to hold
            gameState.addOrder({
                type: 'support',
                unit: unit,
                from: unit.province,
                supportFrom: targetProvince,
                supportTo: targetProvince
            });
            addLog(`${NATIONS[unit.nation].shortName} ${unit.type} supports ${NATIONS[targetUnit.nation].shortName} in ${PROVINCES[targetProvince].name}`);
            gameState.selectedUnit = null;
        }
    }
}

function setOrderType(type) {
    gameState.currentOrderType = type;

    // Update button states
    document.querySelectorAll('.order-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${type}`).classList.add('active');
}

function clearAllOrders() {
    gameState.clearOrders();
    gameState.selectedUnit = null;
    addLog('All orders cleared.');
    updateUI();
    renderer.render();
}

function resolveTurn() {
    if (gameState.orders.length === 0) {
        addLog('No orders to resolve!', 'error');
        return;
    }

    addLog(`--- Resolving ${gameState.getTurnString()} ${gameState.getPhaseString()} ---`);

    const results = gameState.resolveOrders();

    // Log results
    for (const move of results.moves) {
        addLog(`✓ ${NATIONS[move.unit.nation].shortName} ${move.unit.type}: ${PROVINCES[move.from].name} → ${PROVINCES[move.to].name}`);
    }

    for (const bounce of results.bounces) {
        addLog(`✗ ${NATIONS[bounce.unit.nation].shortName} ${bounce.unit.type}: ${PROVINCES[bounce.from].name} → ${PROVINCES[bounce.to].name} (bounced)`);
    }

    for (const hold of results.holds) {
        addLog(`= ${NATIONS[hold.unit.nation].shortName} ${hold.unit.type}: ${PROVINCES[hold.province].name} (holds)`);
    }

    // Advance turn
    gameState.advanceTurn();

    // Check victory
    const winner = gameState.checkVictory();
    if (winner) {
        addLog(`🎉 ${NATIONS[winner].name} wins the game!`);
        alert(`${NATIONS[winner].name} wins by controlling ${WINNING_SUPPLY_COUNT} supply centers!`);
    } else {
        addLog(`--- ${gameState.getTurnString()} ${gameState.getPhaseString()} begins ---`);
    }

    updateUI();
    renderer.render();
}

function updateUI() {
    // Update turn info
    document.getElementById('current-turn').textContent = gameState.getTurnString();
    document.getElementById('phase').textContent = gameState.getPhaseString();

    // Update nations list
    updateNationsList();

    // Update orders list
    updateOrdersList();

    // Update unit info
    updateUnitInfo();

    // Update messages list
    updateMessagesList();
}

function updateNationsList() {
    const container = document.getElementById('nations-list');
    container.innerHTML = '';

    for (const [key, nation] of Object.entries(NATIONS)) {
        const unitCount = gameState.getUnitsForNation(key).length;
        const supplyCount = gameState.getSupplyCount(key);

        const div = document.createElement('div');
        div.className = 'nation-item';
        div.innerHTML = `
            <div>
                <span class="nation-color" style="background-color: ${nation.color}"></span>
                <strong>${nation.shortName}</strong>
            </div>
            <div>
                <span>${unitCount} units</span>
                <span> | ${supplyCount} SC</span>
            </div>
        `;
        container.appendChild(div);
    }
}

function updateOrdersList() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '';

    if (gameState.orders.length === 0) {
        container.innerHTML = '<p style="color: #888;">No orders issued</p>';
        return;
    }

    for (const order of gameState.orders) {
        const div = document.createElement('div');
        div.className = 'order-item';

        let orderText = '';
        const nation = NATIONS[order.unit.nation].shortName;
        const unitType = order.unit.type === 'army' ? 'A' : 'F';

        if (order.type === 'move') {
            orderText = `${nation} ${unitType} ${PROVINCES[order.from].name} → ${PROVINCES[order.to].name}`;
        } else if (order.type === 'hold') {
            orderText = `${nation} ${unitType} ${PROVINCES[order.from].name} HOLD`;
        } else if (order.type === 'support') {
            orderText = `${nation} ${unitType} ${PROVINCES[order.from].name} SUPPORT`;
        }

        div.textContent = orderText;
        container.appendChild(div);
    }
}

function updateUnitInfo() {
    const container = document.getElementById('unit-info');

    if (!gameState.selectedUnit) {
        container.innerHTML = '<p>No unit selected</p>';
        return;
    }

    const unit = gameState.selectedUnit;
    const nation = NATIONS[unit.nation];
    const province = PROVINCES[unit.province];
    const unitType = unit.type === 'army' ? 'Army' : 'Fleet';

    container.innerHTML = `
        <p><strong>${nation.shortName}</strong></p>
        <p>${unitType}</p>
        <p>Location: ${province.name}</p>
        <p style="margin-top: 10px;">Click a province to issue ${gameState.currentOrderType} order</p>
    `;
}

function addLog(message, type = 'info') {
    const container = document.getElementById('game-log');
    const p = document.createElement('p');
    p.textContent = message;

    if (type === 'error') {
        p.style.color = '#ff6b6b';
    } else if (message.includes('✓')) {
        p.style.color = '#51cf66';
    } else if (message.includes('✗')) {
        p.style.color = '#ff6b6b';
    } else if (message.includes('---')) {
        p.style.fontWeight = 'bold';
        p.style.color = '#e94560';
    }

    container.appendChild(p);
    container.scrollTop = container.scrollHeight;
}

// Save/Load game functionality
function saveGame() {
    const saveData = gameState.saveToJSON();
    const saveJson = JSON.stringify(saveData, null, 2);

    // Create a download link
    const blob = new Blob([saveJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statecraft_save_${saveData.season}_${saveData.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('Game saved successfully!');
}

function loadGame() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const saveData = JSON.parse(event.target.result);
                gameState.loadFromJSON(saveData);

                addLog('Game loaded successfully!');
                updateUI();
                renderer.render();
            } catch (error) {
                addLog('Error loading game file!', 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// Messaging system UI
function updateMessagesList() {
    const container = document.getElementById('messages-list');
    container.innerHTML = '';

    if (gameState.messages.length === 0) {
        container.innerHTML = '<p style="color: #888; font-size: 12px;">No messages</p>';
        return;
    }

    // Show most recent messages (limit to 5)
    const recentMessages = gameState.messages.slice(-5);

    for (const message of recentMessages) {
        const div = document.createElement('div');
        div.className = 'message-item';
        div.style.cssText = 'border: 1px solid #444; padding: 8px; margin-bottom: 8px; border-radius: 4px; font-size: 12px;';

        const fromNation = NATIONS[message.from].shortName;
        const toNation = NATIONS[message.to].shortName;

        let statusColor = '#888';
        if (message.status === 'accepted') statusColor = '#51cf66';
        if (message.status === 'rejected') statusColor = '#ff6b6b';
        if (message.status === 'countered') statusColor = '#ffd43b';

        div.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">
                ${fromNation} → ${toNation}
                <span style="color: ${statusColor}; font-size: 10px;">[${message.status}]</span>
            </div>
            <div style="font-size: 11px; color: #aaa;">${message.proposals[0].text}</div>
            ${message.replies.length > 0 ? `<div style="font-size: 10px; color: #888; margin-top: 4px;">Reply: ${message.replies[0].response}</div>` : ''}
        `;

        // Add click to expand/reply (simplified - just show in log)
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            showMessageDetails(message);
        });

        container.appendChild(div);
    }
}

function showMessageDetails(message) {
    const fromNation = NATIONS[message.from].name;
    const toNation = NATIONS[message.to].name;

    addLog(`--- Message from ${fromNation} to ${toNation} ---`);
    addLog(`Type: ${message.type}`);
    addLog(`Proposal: ${message.proposals[0].text}`);

    for (const action of message.proposals[0].actions) {
        const actionNation = NATIONS[action.nation].shortName;
        addLog(`  - ${actionNation}: ${action.action}`);
    }

    if (message.replies.length > 0) {
        addLog(`Reply: ${message.replies[0].response}`);
        if (message.replies[0].counterProposal) {
            addLog(`Counter: ${message.replies[0].counterProposal.text}`);
        }
    }

    // If pending, allow quick reply
    if (message.status === 'pending') {
        addLog('Right-click message to reply (yes/no/counter)');
    }
}

// Bot diplomacy
function triggerBotDiplomacy() {
    // Pick a random bot to send a message
    const nations = Object.keys(NATIONS);
    const randomNation = nations[Math.floor(Math.random() * nations.length)];
    const bot = botPlayers[randomNation];

    const message = bot.generateDiplomaticMessage();

    addLog(`🤖 ${NATIONS[message.from].shortName} sent a diplomatic message to ${NATIONS[message.to].shortName}`);

    updateUI();

    // Sometimes have the recipient bot auto-respond after a delay
    if (Math.random() > 0.5) {
        setTimeout(() => {
            const recipientBot = botPlayers[message.to];
            recipientBot.evaluateMessage(message);
            addLog(`🤖 ${NATIONS[message.to].shortName} replied to ${NATIONS[message.from].shortName}'s message`);
            updateUI();
        }, 1000);
    }
}
