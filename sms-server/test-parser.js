/**
 * Test script for move notation parser
 * Run with: node test-parser.js
 */

const { parseOrders, formatConfirmation } = require('./moveNotation.js');
const { GameState } = require('../gameLogic.js');

// Create a test game state
const gameState = new GameState();

console.log('='.repeat(60));
console.log('DIPLOMACY MOVE PARSER - TEST SUITE');
console.log('='.repeat(60));
console.log('');

// Test cases
const testCases = [
    // Move orders
    'PAR-BUR',
    'par-bur',
    'Paris-Burgundy',
    'vie-bud',
    'A VIE-BUD',
    'lon-nth',

    // Hold orders
    'MUN H',
    'mun h',
    'HOLD VIE',
    'A MUN H',

    // Support orders
    'BUR S PAR-PIC',
    'bur s par-pic',
    'A BUR S A PAR-PIC',
    'MAR S SPA',

    // Convoy orders
    'NTH C YOR-NWY',
    'nth c yor-nwy',
    'F NTH C A YOR-NWY',

    // Multiple orders
    'PAR-BUR; MUN H; MAR-SPA',
    'vie-bud\npar-pic\nmun h',

    // Errors (these should fail gracefully)
    'XXX-YYY',  // Invalid provinces
    'PAR-BER',  // Illegal move (not adjacent)
    'BOH-NTH',  // Army to sea
];

testCases.forEach((testInput, i) => {
    console.log(`Test ${i + 1}: ${testInput}`);
    console.log('-'.repeat(60));

    try {
        const result = parseOrders(testInput, gameState);

        if (result.allSuccessful) {
            console.log('✅ SUCCESS');
        } else if (result.hasErrors) {
            console.log('❌ ERRORS FOUND');
        }

        console.log('');
        console.log(formatConfirmation(result));

    } catch (error) {
        console.log('❌ EXCEPTION:', error.message);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('');
});

// Test with actual game units
console.log('TESTING WITH AUSTRIA UNITS');
console.log('-'.repeat(60));

const austriaUnits = gameState.getUnitsForNation('AUSTRIA');
console.log('Austria has the following units:');
austriaUnits.forEach(unit => {
    console.log(`  - ${unit.type === 'army' ? 'Army' : 'Fleet'} at ${unit.province.toUpperCase()}`);
});

console.log('');
console.log('Testing Austria moves:');
const austriaMoves = parseOrders('vie-gal; bud-ser; tri-ven', gameState);
console.log(formatConfirmation(austriaMoves));

console.log('');
console.log('='.repeat(60));
console.log('TEST SUITE COMPLETE');
console.log('='.repeat(60));
