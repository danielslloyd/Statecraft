// Game Client - Main Game Page Logic

// Extract game and player hashes from URL
const urlParams = new URLSearchParams(window.location.search);
const playerHash = urlParams.get('p');
const gameHash = window.location.pathname.split('/').pop();

let gameState = null;
let playerData = null;
let selectedUnit = null;
let pendingOrders = [];
let updateInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!playerHash || !gameHash) {
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
    document.getElementById('turn-info').textContent =
        `${gameState.game.season} ${gameState.game.year} - ${gameState.game.phase} Phase`;

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
}

function renderOrders() {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '';

    if (pendingOrders.length === 0) {
        ordersList.innerHTML = '<p style="color: #999;">No orders yet. Click units on the map to create orders.</p>';
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
            return `${unitType} ${order.from.toUpperCase()} supports ${order.supportTo.toUpperCase()}`;
        case 'convoy':
            return `${unitType} ${order.from.toUpperCase()} convoys to ${order.convoyTo.toUpperCase()}`;
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

function handleCanvasClick(event) {
    if (!gameState || !playerData) return;

    const canvas = document.getElementById('game-board');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked province (simplified - check provinces within click radius)
    const clickedProvince = findProvinceAtPosition(x, y);

    if (!clickedProvince) return;

    // Check if clicked on own unit
    const unit = playerData.units.find(u => u.province === clickedProvince);

    if (unit) {
        // Select unit
        selectedUnit = unit;
        highlightSelectedUnit(unit);
    } else if (selectedUnit) {
        // Create move order
        createMoveOrder(selectedUnit, clickedProvince);
        selectedUnit = null;
    }
}

function findProvinceAtPosition(x, y) {
    // This requires the PROVINCES data - we'll need to pass it from server
    // For now, simplified implementation
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

function createMoveOrder(unit, destination) {
    // Check if unit can reach destination
    if (!canUnitReach(unit, destination)) {
        alert(`${unit.type === 'army' ? 'Army' : 'Fleet'} cannot move from ${unit.province} to ${destination}`);
        return;
    }

    const order = {
        unitId: unit.id,
        type: unit.type,
        orderType: 'move',
        from: unit.province,
        to: destination
    };

    // Remove any existing order for this unit
    pendingOrders = pendingOrders.filter(o => o.unitId !== unit.id);

    // Add new order
    pendingOrders.push(order);

    renderOrders();
}

function canUnitReach(unit, destination) {
    // Simplified - should use ADJACENCIES data
    return true; // TODO: Implement proper adjacency check
}

function highlightSelectedUnit(unit) {
    // Visual feedback for selected unit
    console.log('Selected unit:', unit);
}
