// Simple renderer for web client
// Province and nation data passed from server

window.PROVINCES = null;
window.NATIONS = null;

function renderGame(gameState, currentNation) {
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');

    // Store province data for click detection
    if (!window.PROVINCES && gameState.allUnits && gameState.allUnits.length > 0) {
        // We'll get PROVINCES from a separate endpoint or embed it
        // For now, use simplified rendering
    }

    // Clear canvas
    ctx.fillStyle = '#2a4a6a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // We need province data to render properly
    // For MVP, let's render a simple board with units
    renderSimpleBoard(ctx, gameState, currentNation);
}

function renderSimpleBoard(ctx, gameState, currentNation) {
    // Draw a message if province data not loaded
    if (!window.PROVINCES) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading map data...', 600, 450);

        // Try to load province data
        loadProvinceData();
        return;
    }

    // Draw connections
    ctx.strokeStyle = '#1a3a5a';
    ctx.lineWidth = 1;

    if (window.ADJACENCIES) {
        const drawn = new Set();
        for (const [province, adjacents] of Object.entries(window.ADJACENCIES)) {
            const prov = window.PROVINCES[province];
            if (!prov) continue;

            for (const adj of adjacents) {
                const adjProv = window.PROVINCES[adj];
                if (!adjProv) continue;

                const key = [province, adj].sort().join('-');
                if (drawn.has(key)) continue;
                drawn.add(key);

                ctx.beginPath();
                ctx.moveTo(prov.x, prov.y);
                ctx.lineTo(adjProv.x, adjProv.y);
                ctx.stroke();
            }
        }
    }

    // Draw provinces
    for (const [code, province] of Object.entries(window.PROVINCES)) {
        drawProvince(ctx, code, province, gameState);
    }

    // Draw units
    if (gameState.allUnits) {
        gameState.allUnits.forEach(unit => {
            drawUnit(ctx, unit, gameState, currentNation);
        });
    }
}

function drawProvince(ctx, code, province, gameState) {
    // Draw province circle
    ctx.beginPath();
    ctx.arc(province.x, province.y, 20, 0, Math.PI * 2);

    // Color based on ownership
    if (province.supply) {
        const owner = gameState.supplyCenters[code];
        if (owner && window.NATIONS && window.NATIONS[owner]) {
            ctx.fillStyle = window.NATIONS[owner].color;
        } else {
            ctx.fillStyle = '#808080';
        }
    } else if (province.sea) {
        ctx.fillStyle = '#4a7a9a';
    } else {
        ctx.fillStyle = '#5a6a7a';
    }

    ctx.fill();

    // Border
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw supply center indicator
    if (province.supply) {
        ctx.beginPath();
        ctx.arc(province.x, province.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw province name
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(code.toUpperCase(), province.x, province.y + 35);
}

function drawUnit(ctx, unit, gameState, currentNation) {
    const province = window.PROVINCES[unit.province];
    if (!province) return;

    const isOwnUnit = unit.nation === currentNation;
    const nation = window.NATIONS ? window.NATIONS[unit.nation] : null;
    const color = nation ? nation.color : '#ffffff';

    if (unit.type === 'army') {
        // Draw army (square)
        ctx.fillStyle = color;
        ctx.fillRect(province.x - 10, province.y - 10, 20, 20);

        // Border
        ctx.strokeStyle = isOwnUnit ? '#ffff00' : '#000000';
        ctx.lineWidth = isOwnUnit ? 3 : 2;
        ctx.strokeRect(province.x - 10, province.y - 10, 20, 20);

        // "A" label
        ctx.fillStyle = nation && nation.textColor === '#000000' ? '#000000' : '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', province.x, province.y);
    } else if (unit.type === 'fleet') {
        // Draw fleet (triangle)
        ctx.beginPath();
        ctx.moveTo(province.x, province.y - 12);
        ctx.lineTo(province.x - 10, province.y + 8);
        ctx.lineTo(province.x + 10, province.y + 8);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = isOwnUnit ? '#ffff00' : '#000000';
        ctx.lineWidth = isOwnUnit ? 3 : 2;
        ctx.stroke();

        // "F" label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F', province.x, province.y + 2);
    }
}

async function loadProvinceData() {
    try {
        // Load static game data (provinces, nations, adjacencies)
        const response = await fetch('/api/game-data');
        const data = await response.json();

        if (data.success) {
            window.PROVINCES = data.provinces;
            window.NATIONS = data.nations;
            window.ADJACENCIES = data.adjacencies;
        }
    } catch (error) {
        console.error('Error loading province data:', error);
    }
}

// Initialize
loadProvinceData();
