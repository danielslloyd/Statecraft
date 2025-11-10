// Main game controller

let renderer = null;

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-board');
    renderer = new Renderer(canvas);
    gameState = new GameState();

    setupEventListeners();
    updateUI();
    renderer.render();
});

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
