/**
 * Diplomacy Move Notation System for SMS
 *
 * This module defines a concise shorthand notation for all Diplomacy moves
 * and provides intelligent parsing with error correction.
 *
 * NOTATION FORMATS:
 *
 * 1. MOVE: [unit] [from]-[to]
 *    Examples:
 *      "A PAR-BUR" (Army Paris to Burgundy)
 *      "F LON-NTH" (Fleet London to North Sea)
 *      "par-bur" (case insensitive, unit type inferred)
 *
 * 2. HOLD: [unit] [location] H
 *    Examples:
 *      "A MUN H" (Army Munich holds)
 *      "mun h" (unit type inferred)
 *      "hold mun" (alternate format)
 *
 * 3. SUPPORT: [unit] [location] S [supported unit] [from]-[to]
 *    OR: [unit] [location] S [supported unit] [location] (for support hold)
 *    Examples:
 *      "A BUR S A PAR-PIC" (Army Burgundy supports Army Paris to Picardy)
 *      "A MAR S A SPA" (Army Marseilles supports Army Spain hold)
 *      "bur s par-pic" (simplified)
 *
 * 4. CONVOY: [fleet] [location] C [army] [from]-[to]
 *    Examples:
 *      "F NTH C A YOR-NWY" (Fleet North Sea convoys Army Yorkshire to Norway)
 *      "nth c yor-nwy" (simplified)
 *
 * MULTIPLE ORDERS:
 *    Separate with semicolons or newlines:
 *    "A PAR-BUR; F LON-NTH; A MUN H"
 *
 * FLEXIBLE PARSING:
 *    - Case insensitive
 *    - Province codes can be 2-3 letters
 *    - Unit type (A/F) is optional if unambiguous
 *    - Common typos are auto-corrected
 *    - Whitespace variations accepted
 */

const { PROVINCES, ADJACENCIES, UNIT_TYPES, ORDER_TYPES } = require('../gameData.js');

/**
 * Province code mapping with common variations and abbreviations
 */
const PROVINCE_CODES = {
    // Full names to codes
    'vienna': 'vie', 'budapest': 'bud', 'trieste': 'tri',
    'london': 'lon', 'liverpool': 'lvp', 'edinburgh': 'edi',
    'paris': 'par', 'marseilles': 'mar', 'brest': 'bre',
    'berlin': 'ber', 'munich': 'mun', 'kiel': 'kie',
    'rome': 'rom', 'venice': 'ven', 'naples': 'nap',
    'moscow': 'mos', 'sevastopol': 'sev', 'st petersburg': 'stp', 'stpetersburg': 'stp', 'warsaw': 'war',
    'constantinople': 'con', 'ankara': 'ank', 'smyrna': 'smy',

    // Common abbreviations
    'vie': 'vie', 'bud': 'bud', 'tri': 'tri', 'tyr': 'tyr', 'boh': 'boh',
    'lon': 'lon', 'lvp': 'lvp', 'edi': 'edi', 'yor': 'yor', 'wal': 'wal',
    'par': 'par', 'mar': 'mar', 'bre': 'bre', 'pic': 'pic', 'bur': 'bur', 'gas': 'gas',
    'ber': 'ber', 'mun': 'mun', 'kie': 'kie', 'ruh': 'ruh', 'sil': 'sil', 'pru': 'pru',
    'rom': 'rom', 'ven': 'ven', 'nap': 'nap', 'tus': 'tus', 'pie': 'pie', 'apu': 'apu',
    'mos': 'mos', 'sev': 'sev', 'stp': 'stp', 'war': 'war', 'ukr': 'ukr', 'lvn': 'lvn', 'fin': 'fin',
    'con': 'con', 'ank': 'ank', 'smy': 'smy', 'arm': 'arm', 'syr': 'syr',

    // Seas
    'north sea': 'nth', 'nth': 'nth', 'norwegian sea': 'nwg', 'nwg': 'nwg',
    'english channel': 'eng', 'eng': 'eng', 'mid atlantic': 'mao', 'mao': 'mao',
    'barents sea': 'bar', 'bar': 'bar', 'baltic sea': 'bal', 'bal': 'bal',
    'gulf of bothnia': 'bot', 'bot': 'bot', 'skagerrak': 'ska', 'ska': 'ska',
    'helgoland bight': 'hel', 'hel': 'hel', 'irish sea': 'iri', 'iri': 'iri',
    'western mediterranean': 'wes', 'wes': 'wes', 'gulf of lyon': 'lyo', 'lyo': 'lyo',
    'tyrrhenian sea': 'tys', 'tys': 'tys', 'ionian sea': 'ion', 'ion': 'ion',
    'adriatic sea': 'adr', 'adr': 'adr', 'aegean sea': 'aeg', 'aeg': 'aeg',
    'eastern mediterranean': 'eas', 'eas': 'eas', 'black sea': 'bla', 'bla': 'bla',

    // Other territories
    'spain': 'spa', 'spa': 'spa', 'portugal': 'por', 'por': 'por',
    'belgium': 'bel', 'bel': 'bel', 'holland': 'hol', 'hol': 'hol',
    'denmark': 'den', 'den': 'den', 'sweden': 'swe', 'swe': 'swe',
    'norway': 'nwy', 'nwy': 'nwy', 'rumania': 'rum', 'rum': 'rum',
    'serbia': 'ser', 'ser': 'ser', 'bulgaria': 'bul', 'bul': 'bul',
    'greece': 'gre', 'gre': 'gre', 'albania': 'alb', 'alb': 'alb',
    'tunis': 'tun', 'tun': 'tun', 'north africa': 'naf', 'naf': 'naf',
    'picardy': 'pic', 'burgundy': 'bur', 'gascony': 'gas',
    'clyde': 'cly', 'cly': 'cly', 'yorkshire': 'yor',
    'wales': 'wal', 'ruhr': 'ruh', 'silesia': 'sil',
    'prussia': 'pru', 'galicia': 'gal', 'gal': 'gal',
    'bohemia': 'boh', 'tyrolia': 'tyr', 'tuscany': 'tus',
    'piedmont': 'pie', 'apulia': 'apu', 'ukraine': 'ukr',
    'livonia': 'lvn', 'finland': 'fin', 'armenia': 'arm',
    'syria': 'syr'
};

/**
 * Normalize a province name to its standard code
 */
function normalizeProvince(input) {
    const normalized = input.toLowerCase().trim();
    return PROVINCE_CODES[normalized] || normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching province names
 */
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Find the closest matching province code using fuzzy matching
 */
function findClosestProvince(input) {
    const normalized = input.toLowerCase().trim();

    // Check exact match first
    if (PROVINCE_CODES[normalized]) {
        return PROVINCE_CODES[normalized];
    }

    // Find closest match
    let minDistance = Infinity;
    let bestMatch = null;

    for (const [key, code] of Object.entries(PROVINCE_CODES)) {
        const distance = levenshteinDistance(normalized, key);
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = code;
        }
    }

    // Only accept if distance is reasonable (max 2 character differences)
    if (minDistance <= 2) {
        return bestMatch;
    }

    return null;
}

/**
 * Parse a single order from text
 * Returns: { type, unit, from, to, supported, success, original, corrected, errors }
 */
function parseOrder(text, gameState) {
    const original = text.trim();
    const normalized = text.toUpperCase().trim();
    let errors = [];
    let warnings = [];

    // Remove extra whitespace
    const tokens = normalized.split(/\s+/).filter(t => t.length > 0);

    if (tokens.length === 0) {
        return {
            success: false,
            original,
            errors: ['Empty order']
        };
    }

    let result = {
        success: false,
        original,
        corrected: null,
        errors: [],
        warnings: []
    };

    // Determine order type and parse accordingly

    // HOLD: [unit?] [province] H  OR  HOLD [province]
    if (tokens.includes('H') || tokens.includes('HOLD')) {
        result.type = ORDER_TYPES.HOLD;

        // Find province
        let provinceToken = tokens.find(t => t !== 'H' && t !== 'HOLD' && t !== 'A' && t !== 'F');
        if (!provinceToken) {
            result.errors.push('No province specified for hold order');
            return result;
        }

        const province = findClosestProvince(provinceToken);
        if (!province) {
            result.errors.push(`Unknown province: ${provinceToken}`);
            return result;
        }

        // Get unit at that province
        const unit = gameState.getUnit(province);
        if (!unit) {
            result.errors.push(`No unit found at ${province}`);
            return result;
        }

        result.unit = unit;
        result.from = province;
        result.success = true;
        result.corrected = `${unit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${province.toUpperCase()} H`;

        return result;
    }

    // SUPPORT: [unit?] [province] S [unit?] [province]-[province] OR S [province]
    if (tokens.includes('S') || tokens.includes('SUPPORT')) {
        result.type = ORDER_TYPES.SUPPORT;

        const sIndex = tokens.findIndex(t => t === 'S' || t === 'SUPPORT');

        // Parse supporting unit location (before S)
        const beforeS = tokens.slice(0, sIndex).filter(t => t !== 'A' && t !== 'F');
        if (beforeS.length === 0) {
            result.errors.push('No location specified for supporting unit');
            return result;
        }

        const supporterProvince = findClosestProvince(beforeS[beforeS.length - 1]);
        if (!supporterProvince) {
            result.errors.push(`Unknown province for supporter: ${beforeS[beforeS.length - 1]}`);
            return result;
        }

        const supporterUnit = gameState.getUnit(supporterProvince);
        if (!supporterUnit) {
            result.errors.push(`No unit found at ${supporterProvince}`);
            return result;
        }

        // Parse supported action (after S)
        const afterS = tokens.slice(sIndex + 1).filter(t => t !== 'A' && t !== 'F');

        // Check if it's a move support (has dash) or hold support
        const movePattern = afterS.join(' ').match(/(\w+)-(\w+)/);

        if (movePattern) {
            // Support move
            const [_, fromToken, toToken] = movePattern;
            const supportedFrom = findClosestProvince(fromToken);
            const supportedTo = findClosestProvince(toToken);

            if (!supportedFrom || !supportedTo) {
                result.errors.push('Invalid provinces in supported move');
                return result;
            }

            const supportedUnit = gameState.getUnit(supportedFrom);
            if (!supportedUnit) {
                result.errors.push(`No unit found at ${supportedFrom} to support`);
                return result;
            }

            result.unit = supporterUnit;
            result.from = supporterProvince;
            result.supported = {
                unit: supportedUnit,
                from: supportedFrom,
                to: supportedTo
            };
            result.success = true;
            result.corrected = `${supporterUnit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${supporterProvince.toUpperCase()} S ${supportedUnit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${supportedFrom.toUpperCase()}-${supportedTo.toUpperCase()}`;
        } else if (afterS.length > 0) {
            // Support hold
            const supportedProvince = findClosestProvince(afterS[0]);
            if (!supportedProvince) {
                result.errors.push(`Unknown province for supported unit: ${afterS[0]}`);
                return result;
            }

            const supportedUnit = gameState.getUnit(supportedProvince);
            if (!supportedUnit) {
                result.errors.push(`No unit found at ${supportedProvince} to support`);
                return result;
            }

            result.unit = supporterUnit;
            result.from = supporterProvince;
            result.supported = {
                unit: supportedUnit,
                from: supportedProvince,
                to: supportedProvince
            };
            result.success = true;
            result.corrected = `${supporterUnit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${supporterProvince.toUpperCase()} S ${supportedUnit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${supportedProvince.toUpperCase()}`;
        } else {
            result.errors.push('No supported unit specified');
            return result;
        }

        return result;
    }

    // CONVOY: [fleet] [province] C [army] [from]-[to]
    if (tokens.includes('C') || tokens.includes('CONVOY')) {
        result.type = ORDER_TYPES.CONVOY;

        const cIndex = tokens.findIndex(t => t === 'C' || t === 'CONVOY');

        // Parse fleet location (before C)
        const beforeC = tokens.slice(0, cIndex).filter(t => t !== 'A' && t !== 'F');
        if (beforeC.length === 0) {
            result.errors.push('No location specified for convoying fleet');
            return result;
        }

        const fleetProvince = findClosestProvince(beforeC[beforeC.length - 1]);
        if (!fleetProvince) {
            result.errors.push(`Unknown province for fleet: ${beforeC[beforeC.length - 1]}`);
            return result;
        }

        const fleet = gameState.getUnit(fleetProvince);
        if (!fleet) {
            result.errors.push(`No unit found at ${fleetProvince}`);
            return result;
        }

        if (fleet.type !== UNIT_TYPES.FLEET) {
            result.errors.push(`Unit at ${fleetProvince} is not a fleet`);
            return result;
        }

        // Parse convoyed army movement (after C)
        const afterC = tokens.slice(cIndex + 1).filter(t => t !== 'A' && t !== 'F');
        const movePattern = afterC.join(' ').match(/(\w+)-(\w+)/);

        if (!movePattern) {
            result.errors.push('Invalid convoy format - expected: [from]-[to]');
            return result;
        }

        const [_, fromToken, toToken] = movePattern;
        const armyFrom = findClosestProvince(fromToken);
        const armyTo = findClosestProvince(toToken);

        if (!armyFrom || !armyTo) {
            result.errors.push('Invalid provinces in convoy route');
            return result;
        }

        const army = gameState.getUnit(armyFrom);
        if (!army) {
            result.errors.push(`No unit found at ${armyFrom} to convoy`);
            return result;
        }

        if (army.type !== UNIT_TYPES.ARMY) {
            result.errors.push(`Unit at ${armyFrom} is not an army`);
            return result;
        }

        result.unit = fleet;
        result.from = fleetProvince;
        result.convoyed = {
            unit: army,
            from: armyFrom,
            to: armyTo
        };
        result.success = true;
        result.corrected = `F ${fleetProvince.toUpperCase()} C A ${armyFrom.toUpperCase()}-${armyTo.toUpperCase()}`;

        return result;
    }

    // MOVE: [unit?] [province]-[province]  OR  [province] [province]
    // Try to find dash pattern first
    const movePattern = normalized.match(/(\w+)-(\w+)/);

    if (movePattern) {
        const [_, fromToken, toToken] = movePattern;
        const from = findClosestProvince(fromToken);
        const to = findClosestProvince(toToken);

        if (!from) {
            result.errors.push(`Unknown starting province: ${fromToken}`);
            return result;
        }

        if (!to) {
            result.errors.push(`Unknown destination province: ${toToken}`);
            return result;
        }

        const unit = gameState.getUnit(from);
        if (!unit) {
            result.errors.push(`No unit found at ${from}`);
            return result;
        }

        // Validate move is legal
        if (!gameState.canUnitReach(unit, to)) {
            result.errors.push(`${unit.type === UNIT_TYPES.ARMY ? 'Army' : 'Fleet'} cannot move from ${from} to ${to}`);
            result.warnings.push('Move may be illegal - check adjacency rules');
        }

        result.type = ORDER_TYPES.MOVE;
        result.unit = unit;
        result.from = from;
        result.to = to;
        result.success = true;
        result.corrected = `${unit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${from.toUpperCase()}-${to.toUpperCase()}`;

        return result;
    }

    // Try space-separated format: [province] [province]
    const nonUnitTokens = tokens.filter(t => t !== 'A' && t !== 'F');
    if (nonUnitTokens.length >= 2) {
        const from = findClosestProvince(nonUnitTokens[0]);
        const to = findClosestProvince(nonUnitTokens[1]);

        if (from && to) {
            const unit = gameState.getUnit(from);
            if (!unit) {
                result.errors.push(`No unit found at ${from}`);
                return result;
            }

            // Validate move is legal
            if (!gameState.canUnitReach(unit, to)) {
                result.errors.push(`${unit.type === UNIT_TYPES.ARMY ? 'Army' : 'Fleet'} cannot move from ${from} to ${to}`);
                result.warnings.push('Move may be illegal - check adjacency rules');
            }

            result.type = ORDER_TYPES.MOVE;
            result.unit = unit;
            result.from = from;
            result.to = to;
            result.success = true;
            result.corrected = `${unit.type === UNIT_TYPES.ARMY ? 'A' : 'F'} ${from.toUpperCase()}-${to.toUpperCase()}`;

            return result;
        }
    }

    result.errors.push('Unable to parse order - please use format like: PAR-BUR, MUN H, BUR S PAR-PIC, or NTH C YOR-NWY');
    return result;
}

/**
 * Parse multiple orders from a message
 * Handles semicolon or newline separation
 */
function parseOrders(text, gameState) {
    // Split by semicolons or newlines
    const orderTexts = text.split(/[;\n]/).filter(t => t.trim().length > 0);

    const results = orderTexts.map(orderText => parseOrder(orderText, gameState));

    return {
        orders: results,
        allSuccessful: results.every(r => r.success),
        hasErrors: results.some(r => r.errors.length > 0),
        hasWarnings: results.some(r => r.warnings && r.warnings.length > 0)
    };
}

/**
 * Format parsed orders for confirmation message
 */
function formatConfirmation(parseResult) {
    const lines = [];

    parseResult.orders.forEach((order, i) => {
        if (order.success) {
            lines.push(`${i + 1}. ${order.corrected} ✓`);
        } else {
            lines.push(`${i + 1}. ERROR: ${order.original}`);
            order.errors.forEach(err => {
                lines.push(`   - ${err}`);
            });
        }
    });

    if (parseResult.allSuccessful) {
        lines.push('\nReply CONFIRM to submit these orders, or send new orders to change.');
    } else {
        lines.push('\nPlease correct the errors above and resend your orders.');
    }

    return lines.join('\n');
}

module.exports = {
    parseOrder,
    parseOrders,
    formatConfirmation,
    normalizeProvince,
    findClosestProvince,
    PROVINCE_CODES
};
