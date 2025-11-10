// Game Logic for Diplomacy

class GameState {
    constructor() {
        this.units = [];
        this.orders = [];
        this.year = 1901;
        this.season = 'Spring';
        this.phase = 'Movement';
        this.supplyCenters = {};
        this.selectedUnit = null;
        this.currentOrderType = 'move';

        this.initializeGame();
    }

    initializeGame() {
        // Initialize units from starting positions
        for (const [nation, positions] of Object.entries(STARTING_POSITIONS)) {
            for (const pos of positions) {
                this.units.push({
                    id: `${nation}-${pos.province}-${Date.now()}-${Math.random()}`,
                    nation: nation,
                    province: pos.province,
                    type: pos.type
                });
            }
        }

        // Initialize supply centers
        for (const [code, province] of Object.entries(PROVINCES)) {
            if (province.supply && province.owner) {
                this.supplyCenters[code] = province.owner;
            }
        }
    }

    getUnit(province) {
        return this.units.find(u => u.province === province);
    }

    getUnitsForNation(nation) {
        return this.units.filter(u => u.nation === nation);
    }

    addOrder(order) {
        // Remove any existing order for this unit
        this.orders = this.orders.filter(o => o.unit.id !== order.unit.id);
        this.orders.push(order);
    }

    clearOrders() {
        this.orders = [];
    }

    getOrder(unitId) {
        return this.orders.find(o => o.unit.id === unitId);
    }

    canUnitReach(unit, destination) {
        const province = PROVINCES[unit.province];
        const destProvince = PROVINCES[destination];

        if (!destProvince) return false;

        // Check if destination is adjacent
        const adjacencies = ADJACENCIES[unit.province] || [];
        if (!adjacencies.includes(destination)) return false;

        // Check unit type restrictions
        if (unit.type === UNIT_TYPES.ARMY) {
            // Armies cannot move to sea provinces
            if (destProvince.sea) return false;
        } else if (unit.type === UNIT_TYPES.FLEET) {
            // Fleets can only move to coastal or sea provinces
            if (!destProvince.coast && !destProvince.sea) return false;
        }

        return true;
    }

    resolveOrders() {
        const results = {
            moves: [],
            bounces: [],
            supports: [],
            holds: []
        };

        // Simple order resolution (simplified Diplomacy rules)
        // In a full implementation, this would be much more complex

        // 1. Calculate support strengths
        const moveStrengths = new Map();

        for (const order of this.orders) {
            if (order.type === 'move') {
                const key = `${order.from}-${order.to}`;
                moveStrengths.set(key, 1);
            }
        }

        // Add support strengths
        for (const order of this.orders) {
            if (order.type === 'support') {
                const key = `${order.supportFrom}-${order.supportTo}`;
                const current = moveStrengths.get(key) || 0;
                moveStrengths.set(key, current + 1);
            }
        }

        // 2. Resolve moves
        const successfulMoves = [];
        const failedMoves = [];
        const occupiedDestinations = new Map();

        for (const order of this.orders) {
            if (order.type === 'move') {
                const key = `${order.from}-${order.to}`;
                const strength = moveStrengths.get(key) || 1;

                // Check if destination is contested
                const otherMoves = this.orders.filter(o =>
                    o.type === 'move' &&
                    o.to === order.to &&
                    o.unit.id !== order.unit.id
                );

                let canMove = true;

                for (const otherMove of otherMoves) {
                    const otherKey = `${otherMove.from}-${otherMove.to}`;
                    const otherStrength = moveStrengths.get(otherKey) || 1;

                    if (otherStrength >= strength) {
                        canMove = false;
                        break;
                    }
                }

                // Check if there's a unit holding at destination
                const holdingUnit = this.getUnit(order.to);
                if (holdingUnit && !this.orders.find(o => o.type === 'move' && o.unit.id === holdingUnit.id)) {
                    // Unit is holding, needs to overcome it
                    if (strength <= 1) {
                        canMove = false;
                    }
                }

                if (canMove && !occupiedDestinations.has(order.to)) {
                    successfulMoves.push(order);
                    occupiedDestinations.set(order.to, order.unit);
                    results.moves.push({
                        unit: order.unit,
                        from: order.from,
                        to: order.to,
                        success: true
                    });
                } else {
                    failedMoves.push(order);
                    results.bounces.push({
                        unit: order.unit,
                        from: order.from,
                        to: order.to
                    });
                }
            }
        }

        // 3. Execute successful moves
        for (const move of successfulMoves) {
            const unit = this.units.find(u => u.id === move.unit.id);
            if (unit) {
                // Remove unit at destination if exists
                this.units = this.units.filter(u => u.province !== move.to || u.id === unit.id);
                unit.province = move.to;
            }
        }

        // 4. Handle holds
        for (const order of this.orders) {
            if (order.type === 'hold') {
                results.holds.push({
                    unit: order.unit,
                    province: order.unit.province
                });
            }
        }

        // 5. Handle supports (just log them)
        for (const order of this.orders) {
            if (order.type === 'support') {
                results.supports.push({
                    unit: order.unit,
                    supporting: `${order.supportFrom} to ${order.supportTo}`
                });
            }
        }

        return results;
    }

    updateSupplyCenters() {
        // Update ownership of supply centers based on unit positions
        for (const [code, province] of Object.entries(PROVINCES)) {
            if (province.supply) {
                const unit = this.getUnit(code);
                if (unit) {
                    this.supplyCenters[code] = unit.nation;
                }
            }
        }
    }

    getSupplyCount(nation) {
        return Object.values(this.supplyCenters).filter(owner => owner === nation).length;
    }

    advanceTurn() {
        if (this.phase === 'Movement') {
            // After movement phase, update supply centers
            this.updateSupplyCenters();

            if (this.season === 'Fall') {
                // After Fall movement, go to build phase
                this.phase = 'Retreat';
                // For simplicity, skip retreat and go to builds
                this.phase = 'Build';
            } else {
                // After Spring movement, go to Fall
                this.season = 'Fall';
            }
        } else if (this.phase === 'Build') {
            // After build phase, advance to next year
            this.year++;
            this.season = 'Spring';
            this.phase = 'Movement';
        }

        this.clearOrders();
    }

    checkVictory() {
        for (const nation of Object.keys(NATIONS)) {
            if (this.getSupplyCount(nation) >= WINNING_SUPPLY_COUNT) {
                return nation;
            }
        }
        return null;
    }

    getTurnString() {
        return `${this.season} ${this.year}`;
    }

    getPhaseString() {
        return `${this.phase} Phase`;
    }
}

// Order types
const ORDER_TYPES = {
    MOVE: 'move',
    HOLD: 'hold',
    SUPPORT: 'support',
    CONVOY: 'convoy'
};

// Create global game state
let gameState = null;
