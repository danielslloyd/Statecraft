/**
 * Board Image Generator for SMS/MMS
 *
 * Generates PNG images of the game board using Canvas
 * Images are saved locally and served via HTTP for MMS delivery
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { PROVINCES, ADJACENCIES, NATIONS } = require('../gameData.js');

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, 'board-images');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Draw the game board on a canvas
 * Based on the renderer.js logic but adapted for server-side canvas
 */
function drawBoard(ctx, gameState, width, height) {
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Draw province connections
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;

    for (const [provinceCode, adjacentProvinces] of Object.entries(ADJACENCIES)) {
        const province = PROVINCES[provinceCode];
        if (!province) continue;

        adjacentProvinces.forEach(adjCode => {
            const adjProvince = PROVINCES[adjCode];
            if (!adjProvince) return;

            ctx.beginPath();
            ctx.moveTo(province.x, province.y);
            ctx.lineTo(adjProvince.x, adjProvince.y);
            ctx.stroke();
        });
    }

    // Draw provinces
    for (const [code, province] of Object.entries(PROVINCES)) {
        const owner = gameState.supplyCenters[code];

        // Province circle
        ctx.beginPath();
        ctx.arc(province.x, province.y, 20, 0, 2 * Math.PI);

        if (owner && NATIONS[owner]) {
            ctx.fillStyle = NATIONS[owner].color;
        } else if (province.sea) {
            ctx.fillStyle = '#b0d0ff';
        } else {
            ctx.fillStyle = '#d0d0d0';
        }

        ctx.fill();
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Supply center marker
        if (province.supply) {
            ctx.beginPath();
            ctx.arc(province.x, province.y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Province label (abbreviated)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(code.toUpperCase(), province.x, province.y - 25);
    }

    // Draw units
    gameState.units.forEach(unit => {
        const province = PROVINCES[unit.province];
        if (!province) return;

        const nation = NATIONS[unit.nation];
        if (!nation) return;

        if (unit.type === 'army') {
            // Draw army (square)
            ctx.fillStyle = nation.color;
            ctx.fillRect(province.x - 10, province.y - 10, 20, 20);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(province.x - 10, province.y - 10, 20, 20);

            // "A" label
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px Arial';
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
            ctx.fillStyle = nation.color;
            ctx.fill();
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.stroke();

            // "F" label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('F', province.x, province.y + 2);
        }
    });

    // Draw orders (simplified - just show move arrows)
    ctx.strokeStyle = '#ff0000';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;

    gameState.orders.forEach(order => {
        if (order.type === 'move' || order.type === 'support') {
            const fromProvince = PROVINCES[order.from];
            const toProvince = PROVINCES[order.to];

            if (fromProvince && toProvince) {
                ctx.beginPath();
                ctx.moveTo(fromProvince.x, fromProvince.y);
                ctx.lineTo(toProvince.x, toProvince.y);
                ctx.stroke();

                // Arrow head
                const angle = Math.atan2(toProvince.y - fromProvince.y, toProvince.x - fromProvince.x);
                const arrowSize = 10;
                ctx.beginPath();
                ctx.moveTo(toProvince.x, toProvince.y);
                ctx.lineTo(
                    toProvince.x - arrowSize * Math.cos(angle - Math.PI / 6),
                    toProvince.y - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(toProvince.x, toProvince.y);
                ctx.lineTo(
                    toProvince.x - arrowSize * Math.cos(angle + Math.PI / 6),
                    toProvince.y - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                ctx.stroke();
            }
        }
    });

    ctx.setLineDash([]); // Reset line dash

    // Add game info at top
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${gameState.season} ${gameState.year} - ${gameState.phase} Phase`, 10, 20);

    // Add legend
    const legendY = height - 80;
    ctx.font = '12px Arial';
    ctx.fillText('Legend:', 10, legendY);

    // Army example
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(20, legendY + 10, 15, 15);
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, legendY + 10, 15, 15);
    ctx.fillStyle = '#000000';
    ctx.fillText('= Army', 40, legendY + 22);

    // Fleet example
    ctx.beginPath();
    ctx.moveTo(20, legendY + 35);
    ctx.lineTo(12, legendY + 50);
    ctx.lineTo(28, legendY + 50);
    ctx.closePath();
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.fillText('= Fleet', 40, legendY + 47);
}

/**
 * Generate board image and save to file
 * Returns URL to access the image
 */
async function generateBoardImage(gameState, gameId) {
    const width = 1200;
    const height = 900;

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw board
    drawBoard(ctx, gameState, width, height);

    // Save to file
    const timestamp = Date.now();
    const filename = `${gameId}-${timestamp}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);

    console.log(`Board image generated: ${filename}`);

    // Return URL (will be served by Express static middleware)
    // In production, replace YOUR_DOMAIN with actual domain
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/images/${filename}`;
}

/**
 * Clean up old board images (older than 24 hours)
 */
function cleanupOldImages() {
    const files = fs.readdirSync(OUTPUT_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    files.forEach(file => {
        const filepath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
            fs.unlinkSync(filepath);
            console.log(`Deleted old image: ${file}`);
        }
    });
}

// Run cleanup every hour
setInterval(cleanupOldImages, 60 * 60 * 1000);

module.exports = {
    generateBoardImage,
    cleanupOldImages
};
