// Renderer for Diplomacy Game

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hoveredProvince = null;
    }

    clear() {
        this.ctx.fillStyle = '#2a4a6a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawMap() {
        this.clear();

        // Draw connections (adjacencies)
        this.ctx.strokeStyle = '#1a3a5a';
        this.ctx.lineWidth = 1;

        const drawn = new Set();
        for (const [province, adjacents] of Object.entries(ADJACENCIES)) {
            const prov = PROVINCES[province];
            if (!prov) continue;

            for (const adj of adjacents) {
                const adjProv = PROVINCES[adj];
                if (!adjProv) continue;

                const key = [province, adj].sort().join('-');
                if (drawn.has(key)) continue;
                drawn.add(key);

                this.ctx.beginPath();
                this.ctx.moveTo(prov.x, prov.y);
                this.ctx.lineTo(adjProv.x, adjProv.y);
                this.ctx.stroke();
            }
        }

        // Draw provinces
        for (const [code, province] of Object.entries(PROVINCES)) {
            this.drawProvince(code, province);
        }
    }

    drawProvince(code, province) {
        const isHovered = this.hoveredProvince === code;
        const isSelected = gameState.selectedUnit && gameState.selectedUnit.province === code;

        // Draw province circle
        this.ctx.beginPath();
        this.ctx.arc(province.x, province.y, 20, 0, Math.PI * 2);

        // Color based on ownership
        if (province.supply) {
            if (province.owner) {
                const nation = NATIONS[province.owner];
                this.ctx.fillStyle = nation.color;
            } else {
                // Neutral supply center
                const owner = gameState.supplyCenters[code];
                if (owner) {
                    const nation = NATIONS[owner];
                    this.ctx.fillStyle = nation.color;
                } else {
                    this.ctx.fillStyle = '#808080';
                }
            }
        } else if (province.sea) {
            this.ctx.fillStyle = '#4a7a9a';
        } else {
            this.ctx.fillStyle = '#5a6a7a';
        }

        this.ctx.fill();

        // Border
        this.ctx.strokeStyle = isSelected ? '#ffff00' : (isHovered ? '#ffffff' : '#2a3a4a');
        this.ctx.lineWidth = isSelected ? 3 : (isHovered ? 2 : 1);
        this.ctx.stroke();

        // Draw supply center indicator
        if (province.supply) {
            this.ctx.beginPath();
            this.ctx.arc(province.x, province.y, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // Draw province name
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(code.toUpperCase(), province.x, province.y + 35);
    }

    drawUnits() {
        if (!gameState) return;

        for (const unit of gameState.units) {
            this.drawUnit(unit);
        }
    }

    drawUnit(unit) {
        const province = PROVINCES[unit.province];
        if (!province) return;

        const nation = NATIONS[unit.nation];
        const isSelected = gameState.selectedUnit && gameState.selectedUnit.id === unit.id;

        // Draw unit shape
        this.ctx.save();
        this.ctx.translate(province.x, province.y);

        if (unit.type === UNIT_TYPES.ARMY) {
            // Draw army as a square
            this.ctx.fillStyle = nation.color;
            this.ctx.fillRect(-12, -12, 24, 24);
            this.ctx.strokeStyle = isSelected ? '#ffff00' : '#000000';
            this.ctx.lineWidth = isSelected ? 3 : 2;
            this.ctx.strokeRect(-12, -12, 24, 24);

            // Draw 'A' for army
            this.ctx.fillStyle = nation.textColor;
            this.ctx.font = 'bold 16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('A', 0, 0);
        } else {
            // Draw fleet as a triangle
            this.ctx.beginPath();
            this.ctx.moveTo(0, -15);
            this.ctx.lineTo(-13, 10);
            this.ctx.lineTo(13, 10);
            this.ctx.closePath();

            this.ctx.fillStyle = nation.color;
            this.ctx.fill();
            this.ctx.strokeStyle = isSelected ? '#ffff00' : '#000000';
            this.ctx.lineWidth = isSelected ? 3 : 2;
            this.ctx.stroke();

            // Draw 'F' for fleet
            this.ctx.fillStyle = nation.textColor;
            this.ctx.font = 'bold 14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('F', 0, 2);
        }

        this.ctx.restore();
    }

    drawOrders() {
        if (!gameState) return;

        for (const order of gameState.orders) {
            this.drawOrder(order);
        }
    }

    drawOrder(order) {
        const fromProvince = PROVINCES[order.from];
        if (!fromProvince) return;

        this.ctx.save();

        if (order.type === 'move') {
            const toProvince = PROVINCES[order.to];
            if (!toProvince) return;

            // Draw arrow from -> to
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);

            const angle = Math.atan2(toProvince.y - fromProvince.y, toProvince.x - fromProvince.x);
            const startX = fromProvince.x + Math.cos(angle) * 25;
            const startY = fromProvince.y + Math.sin(angle) * 25;
            const endX = toProvince.x - Math.cos(angle) * 25;
            const endY = toProvince.y - Math.sin(angle) * 25;

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();

            // Draw arrowhead
            const headLength = 15;
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            this.ctx.moveTo(endX, endY);
            this.ctx.lineTo(
                endX - headLength * Math.cos(angle - Math.PI / 6),
                endY - headLength * Math.sin(angle - Math.PI / 6)
            );
            this.ctx.moveTo(endX, endY);
            this.ctx.lineTo(
                endX - headLength * Math.cos(angle + Math.PI / 6),
                endY - headLength * Math.sin(angle + Math.PI / 6)
            );
            this.ctx.stroke();
        } else if (order.type === 'hold') {
            // Draw circle around unit for hold
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(fromProvince.x, fromProvince.y, 30, 0, Math.PI * 2);
            this.ctx.stroke();
        } else if (order.type === 'support') {
            // Draw support line
            const supportFromProvince = PROVINCES[order.supportFrom];
            const supportToProvince = PROVINCES[order.supportTo];
            if (!supportFromProvince || !supportToProvince) return;

            this.ctx.strokeStyle = '#0000ff';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([10, 5]);

            // Line from this unit to the move being supported
            const angle1 = Math.atan2(supportFromProvince.y - fromProvince.y, supportFromProvince.x - fromProvince.x);
            const startX1 = fromProvince.x + Math.cos(angle1) * 25;
            const startY1 = fromProvince.y + Math.sin(angle1) * 25;

            this.ctx.beginPath();
            this.ctx.moveTo(startX1, startY1);
            this.ctx.lineTo(supportFromProvince.x, supportFromProvince.y);
            this.ctx.lineTo(supportToProvince.x, supportToProvince.y);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    getProvinceAtPosition(x, y) {
        for (const [code, province] of Object.entries(PROVINCES)) {
            const dx = x - province.x;
            const dy = y - province.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= 20) {
                return code;
            }
        }
        return null;
    }

    render() {
        this.drawMap();
        this.drawOrders();
        this.drawUnits();
    }
}
