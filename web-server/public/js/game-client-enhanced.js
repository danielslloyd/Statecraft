// Enhanced Game Client with Support/Convoy Orders

// Extract game and player hashes from URL
const urlParams = new URLSearchParams(window.location.search);
const playerHash = urlParams.get('p');
const gameHash = window.location.pathname.split('/').pop();

let gameState = null;
let playerData = null;
let selectedUnit = null;
let pendingOrders = [];
let updateInterval = null;
let currentOrderMode = 'move'; // 'move', 'hold', 'support', 'convoy'

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!playerHash || gameHash) {
        alert('Invalid game link');
        return;
    }

    setupEventListeners();
    loadGameState();

    // Poll for updates every 5 seconds
    updateInterval = setInterval(loadGameState, 5000);
});

function setupEventListeners() {
    document.getElementById('submit-orders-btn').addEventListener('click', submitOrders);
    document.getElementById('clear-orders-btn').addEventListener('click', clearOrders);
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);

    // Order mode buttons
    document.getElementById('mode-move').addEventListener('click', () => setOrderMode('move'));
    document.getElementById('mode-hold').addEventListener('click', () => setOrderMode('hold'));
    document.getElementById('mode-support').addEventListener('click', () => setOrderMode('support'));
    document.getElementById('mode-convoy').addEventListener('click', () => setOrderMode('convoy'));

    // Enter key sends message
    document.getElementById('message-text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Canvas click for unit selection and order creation
    const canvas = document.getElementById('game-board');
    canvas.addEventListener('click', handleCanvasClick);
}

function setOrderMode(mode) {
    currentOrderMode = mode;

    // Update button states
    ['move', 'hold', 'support', 'convoy'].forEach(m => {
        const btn = document.getElementById(`mode-${m}`);
        if (m === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Reset selection
    selectedUnit = null;
    supportSource = null;

    renderInstructions();
}

function renderInstructions() {
    const instructions = document.getElementById('order-instructions');

    switch (currentOrderMode) {
        case 'move':
            instructions.textContent = 'Click your unit, then click destination to move';
            break;
        case 'hold':
            instructions.textContent = 'Click your unit to make it hold position';
            break;
        case 'support':
            instructions.textContent = 'Click supporting unit, then unit to support, then destination';
            break;
        case 'convoy':
            instructions.textContent = 'Click fleet, then army to convoy, then destination';
            break;
    }
}

async function loadGameState() {
    try {
        const response = await fetch(`/api/game/${gameHash}/state?p=${playerHash}`);
        const data = await response.json();

        if (data.success) {
            gameState = data;
            playerData = data.player;
            renderGameState();
        } else {
            console.error('Error loading game state:', data.error);
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}

function renderGameState() {
    if (!gameState || !playerData) return;

    // Update header
    const turnInfo = `${gameState.game.season} ${gameState.game.year} - ${gameState.game.phase} Phase`;
    document.getElementById('turn-info').textContent = turnInfo;

    // Show deadline if game started
    if (gameState.game.turnDeadline) {
        const deadline = new Date(gameState.game.turnDeadline);
        const deadlineText = deadline.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        document.getElementById('turn-deadline').textContent = `Deadline: ${deadlineText}`;
    }

    document.getElementById('player-nation').textContent = playerData.nation;
    document.getElementById('player-stats').textContent =
        `Units: ${playerData.units.length} | Supply Centers: ${playerData.supplyCenters}`;

    // Render board (using renderer.js)
    if (window.renderGame) {
        window.renderGame(gameState, playerData.nation);
    }

    // Render orders
    renderOrders();

    // Render players
    renderPlayers();

    // Render messages
    renderMessages();

    // Update message recipient dropdown
    updateMessageRecipients();

    // Update timer settings display
    if (gameState.game.turnDurationHours && gameState.game.turnTimeHour !== undefined) {
        document.getElementById('timer-settings').textContent =
            `Turn timer: ${gameState.game.turnDurationHours}h at ${formatHour(gameState.game.turnTimeHour)} ET`;
    }
}

function formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

function renderOrders() {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '';

    if (pendingOrders.length === 0) {
        ordersList.innerHTML = '<p style="color: #999;">No orders yet. Use the buttons above to create orders.</p>';
        return;
    }

    pendingOrders.forEach((order, index) => {
        const div = document.createElement('div');
        div.className = 'order-item';
        div.textContent = formatOrder(order);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.float = 'right';
        removeBtn.style.background = '#ff4444';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.padding = '2px 8px';
        removeBtn.style.borderRadius = '3px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.addEventListener('click', () => {
            pendingOrders.splice(index, 1);
            renderOrders();
        });

        div.appendChild(removeBtn);
        ordersList.appendChild(div);
    });
}

function formatOrder(order) {
    const unitType = order.type === 'army' ? 'A' : 'F';

    switch (order.orderType) {
        case 'move':
            return `${unitType} ${order.from.toUpperCase()} → ${order.to.toUpperCase()}`;
        case 'hold':
            return `${unitType} ${order.from.toUpperCase()} HOLD`;
        case 'support':
            if (order.supportedTo === order.supportedFrom) {
                return `${unitType} ${order.from.toUpperCase()} supports ${order.supportedFrom.toUpperCase()} HOLD`;
            } else {
                return `${unitType} ${order.from.toUpperCase()} supports ${order.supportedFrom.toUpperCase()}→${order.supportedTo.toUpperCase()}`;
            }
        case 'convoy':
            return `${unitType} ${order.from.toUpperCase()} convoys ${order.convoyedFrom.toUpperCase()}→${order.convoyedTo.toUpperCase()}`;
        default:
            return 'Unknown order';
    }
}

function renderPlayers() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';

    gameState.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item' + (player.isBot ? ' bot' : '');

        const nameDiv = document.createElement('div');
        const nationSpan = document.createElement('span');
        nationSpan.className = 'player-nation-name';
        nationSpan.textContent = player.nation;

        const playerNameSpan = document.createElement('span');
        playerNameSpan.textContent = ` - ${player.playerName}`;
        playerNameSpan.style.fontSize = '12px';
        playerNameSpan.style.color = '#666';

        nameDiv.appendChild(nationSpan);
        nameDiv.appendChild(playerNameSpan);

        const statsDiv = document.createElement('div');
        statsDiv.className = 'player-stats-small';
        statsDiv.textContent = `${player.units} units, ${player.supplyCenters} SC`;

        div.appendChild(nameDiv);
        div.appendChild(statsDiv);

        playersList.appendChild(div);
    });
}

function renderMessages() {
    const messagesList = document.getElementById('messages-list');
    const scrolledToBottom = messagesList.scrollHeight - messagesList.scrollTop === messagesList.clientHeight;

    messagesList.innerHTML = '';

    if (!gameState.messages || gameState.messages.length === 0) {
        messagesList.innerHTML = '<p style="color: #999; padding: 10px;">No messages yet</p>';
        return;
    }

    gameState.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message-item';

        if (msg.from === playerData.nation) {
            div.classList.add('own');
        }
        if (msg.isBot) {
            div.classList.add('bot');
        }

        const header = document.createElement('div');
        header.className = 'message-header';

        const from = document.createElement('span');
        from.className = 'message-from';
        from.textContent = msg.from;

        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatTime(msg.timestamp);

        header.appendChild(from);
        header.appendChild(time);

        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = msg.content;

        div.appendChild(header);
        div.appendChild(content);

        messagesList.appendChild(div);
    });

    // Auto-scroll to bottom if was already at bottom
    if (scrolledToBottom) {
        messagesList.scrollTop = messagesList.scrollHeight;
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
        return 'Just now';
    } else if (diff < 3600000) {
        return Math.floor(diff / 60000) + 'm ago';
    } else if (diff < 86400000) {
        return Math.floor(diff / 3600000) + 'h ago';
    } else {
        return date.toLocaleDateString();
    }
}

function updateMessageRecipients() {
    const select = document.getElementById('message-recipient');
    const currentValue = select.value;

    select.innerHTML = '<option value="all">Everyone</option>';

    gameState.players.forEach(player => {
        if (player.nation !== playerData.nation) {
            const option = document.createElement('option');
            option.value = player.nation;
            option.textContent = player.nation + (player.isBot ? ' (Bot)' : '');
            select.appendChild(option);
        }
    });

    // Restore selection if still valid
    if (currentValue !== 'all') {
        const option = select.querySelector(`option[value="${currentValue}"]`);
        if (option) {
            select.value = currentValue;
        }
    }
}

async function submitOrders() {
    if (pendingOrders.length === 0) {
        alert('No orders to submit');
        return;
    }

    try {
        const response = await fetch(`/api/game/${gameHash}/orders?p=${playerHash}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders: pendingOrders })
        });

        const data = await response.json();

        if (data.success) {
            alert('Orders submitted successfully!');
            loadGameState();
        } else {
            alert('Error submitting orders: ' + data.error);
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

function clearOrders() {
    if (confirm('Clear all pending orders?')) {
        pendingOrders = [];
        renderOrders();
    }
}

async function sendMessage() {
    const recipientSelect = document.getElementById('message-recipient');
    const messageText = document.getElementById('message-text');

    const recipient = recipientSelect.value;
    const content = messageText.value.trim();

    if (!content) {
        return;
    }

    const to = recipient === 'all' ? 'all' : [recipient];

    try {
        const response = await fetch(`/api/game/${gameHash}/message?p=${playerHash}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, content })
        });

        const data = await response.json();

        if (data.success) {
            messageText.value = '';
            loadGameState();
        } else {
            alert('Error sending message: ' + data.error);
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

// Order creation logic
let supportSource = null;
let supportTarget = null;
let convoyFleet = null;
let convoyArmy = null;

function handleCanvasClick(event) {
    if (!gameState || !playerData) return;

    const canvas = document.getElementById('game-board');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedProvince = findProvinceAtPosition(x, y);
    if (!clickedProvince) return;

    const unit = playerData.units.find(u => u.province === clickedProvince);
    const allUnit = gameState.allUnits.find(u => u.province === clickedProvince);

    switch (currentOrderMode) {
        case 'move':
            handleMoveClick(clickedProvince, unit);
            break;
        case 'hold':
            handleHoldClick(clickedProvince, unit);
            break;
        case 'support':
            handleSupportClick(clickedProvince, unit, allUnit);
            break;
        case 'convoy':
            handleConvoyClick(clickedProvince, unit, allUnit);
            break;
    }
}

function handleMoveClick(clickedProvince, unit) {
    if (unit) {
        selectedUnit = unit;
        console.log('Selected unit:', unit);
    } else if (selectedUnit) {
        createMoveOrder(selectedUnit, clickedProvince);
        selectedUnit = null;
    }
}

function handleHoldClick(clickedProvince, unit) {
    if (!unit) {
        alert('No unit at this location');
        return;
    }

    const order = {
        unitId: unit.id,
        type: unit.type,
        orderType: 'hold',
        from: unit.province
    };

    // Remove existing order for this unit
    pendingOrders = pendingOrders.filter(o => o.unitId !== unit.id);
    pendingOrders.push(order);
    renderOrders();
}

function handleSupportClick(clickedProvince, unit, allUnit) {
    if (!supportSource) {
        // Step 1: Select supporting unit (must be your unit)
        if (!unit) {
            alert('You must select your own unit to provide support');
            return;
        }
        supportSource = unit;
        console.log('Support source selected:', unit.province);
    } else if (!supportTarget) {
        // Step 2: Select unit to support (can be any unit)
        if (!allUnit) {
            alert('No unit to support at this location');
            return;
        }
        supportTarget = allUnit;
        console.log('Support target selected:', allUnit.province);
    } else {
        // Step 3: Select destination (or same location for hold support)
        const order = {
            unitId: supportSource.id,
            type: supportSource.type,
            orderType: 'support',
            from: supportSource.province,
            supportedUnitId: supportTarget.id,
            supportedFrom: supportTarget.province,
            supportedTo: clickedProvince
        };

        pendingOrders = pendingOrders.filter(o => o.unitId !== supportSource.id);
        pendingOrders.push(order);
        renderOrders();

        // Reset
        supportSource = null;
        supportTarget = null;
    }
}

function handleConvoyClick(clickedProvince, unit, allUnit) {
    if (!convoyFleet) {
        // Step 1: Select fleet (must be your fleet)
        if (!unit || unit.type !== 'fleet') {
            alert('You must select your own fleet to provide convoy');
            return;
        }
        convoyFleet = unit;
        console.log('Convoy fleet selected:', unit.province);
    } else if (!convoyArmy) {
        // Step 2: Select army to convoy
        if (!allUnit || allUnit.type !== 'army') {
            alert('You must select an army to convoy');
            return;
        }
        convoyArmy = allUnit;
        console.log('Army to convoy selected:', allUnit.province);
    } else {
        // Step 3: Select destination
        const order = {
            unitId: convoyFleet.id,
            type: convoyFleet.type,
            orderType: 'convoy',
            from: convoyFleet.province,
            convoyedUnitId: convoyArmy.id,
            convoyedFrom: convoyArmy.province,
            convoyedTo: clickedProvince
        };

        pendingOrders = pendingOrders.filter(o => o.unitId !== convoyFleet.id);
        pendingOrders.push(order);
        renderOrders();

        // Reset
        convoyFleet = null;
        convoyArmy = null;
    }
}

function createMoveOrder(unit, destination) {
    const order = {
        unitId: unit.id,
        type: unit.type,
        orderType: 'move',
        from: unit.province,
        to: destination
    };

    // Remove existing order for this unit
    pendingOrders = pendingOrders.filter(o => o.unitId !== unit.id);
    pendingOrders.push(order);
    renderOrders();
}

function findProvinceAtPosition(x, y) {
    if (!window.PROVINCES) return null;

    for (const [code, province] of Object.entries(window.PROVINCES)) {
        const dx = x - province.x;
        const dy = y - province.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 25) {
            return code;
        }
    }

    return null;
}
