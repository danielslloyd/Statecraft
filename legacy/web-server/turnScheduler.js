/**
 * Automatic Turn Scheduler
 *
 * Processes turns automatically based on game settings:
 * - Default: 24 hours at midnight Eastern Time
 * - Configurable per game
 */

const cron = require('node-cron');
const { games: gamesDb, players: playersDb, turnHistory: turnHistoryDb } = require('./database/db.js');
const { GameState } = require('../gameLogic.js');
const { EnhancedBotPlayer } = require('./enhancedBot.js');

// Track loaded games in memory for performance
const gameCache = new Map();

/**
 * Calculate next turn deadline
 */
function calculateNextDeadline(turnDurationHours, turnTimeHour) {
    const now = new Date();

    // Convert to Eastern Time
    const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Set to the target hour
    easternTime.setHours(turnTimeHour, 0, 0, 0);

    // If we've passed today's deadline, move to tomorrow
    if (easternTime <= now) {
        easternTime.setDate(easternTime.getDate() + 1);
    }

    // Add additional days based on turn duration
    const additionalDays = Math.floor(turnDurationHours / 24);
    easternTime.setDate(easternTime.getDate() + additionalDays);

    return easternTime;
}

/**
 * Process a single game's turn
 */
async function processTurn(gameHash) {
    console.log(`Processing turn for game ${gameHash}...`);

    try {
        // Load game from database
        const gameRow = await gamesDb.get(gameHash);
        if (!gameRow) {
            console.error(`Game ${gameHash} not found`);
            return;
        }

        // Parse game state
        const gameState = new GameState();
        Object.assign(gameState, gameRow.game_state);

        // Load all players
        const playersRows = await playersDb.getByGame(gameHash);
        const botPlayers = new Map();

        // Load bot states and create bot instances
        for (const playerRow of playersRows) {
            if (playerRow.is_bot) {
                const bot = new EnhancedBotPlayer(playerRow.nation, gameState);
                // TODO: Load bot state from database
                botPlayers.set(playerRow.nation, bot);
            }
        }

        // Process bot actions
        console.log(`  Processing ${botPlayers.size} bot players...`);
        for (const [nation, bot] of botPlayers.entries()) {
            // Bot generates orders
            const orders = bot.generateOrders();
            await playersDb.updateOrders(
                playersRows.find(p => p.nation === nation).player_hash,
                orders
            );

            // Bot might send messages
            if (Math.random() < 0.3) {
                const message = bot.generateMessage({ messages: [] }); // Simplified
                if (message) {
                    const { messages: messagesDb } = require('./database/db.js');
                    await messagesDb.create(gameHash, nation, message.to, message.content, true);
                }
            }
        }

        // Collect all orders
        const allOrders = [];
        for (const playerRow of playersRows) {
            const orders = playerRow.pending_orders || [];
            orders.forEach(order => {
                gameState.addOrder(order);
                allOrders.push({
                    nation: playerRow.nation,
                    ...order
                });
            });
        }

        // Save turn to history
        const currentTurn = (gameState.year - 1901) * 5 +
            ['Spring', 'Fall'].indexOf(gameState.season) + 1;

        await turnHistoryDb.create(
            gameHash,
            currentTurn,
            gameState.season,
            gameState.year,
            gameState.phase,
            allOrders
        );

        // Resolve orders
        console.log(`  Resolving ${allOrders.length} orders...`);
        const results = gameState.resolveOrders();

        // Update supply centers
        gameState.updateSupplyCenters();

        // Clear all pending orders
        await playersDb.clearOrders(gameHash);

        // Advance turn
        gameState.advanceTurn();

        // Check for victory
        const winner = gameState.checkVictory();
        if (winner) {
            console.log(`  🏆 ${winner} wins the game!`);
            // Mark game as completed
            await gamesDb.update(gameHash, {
                started: false,
                turnDeadline: null,
                gameState
            });
            return;
        }

        // Calculate next deadline
        const nextDeadline = calculateNextDeadline(
            gameRow.turn_duration_hours,
            gameRow.turn_time_hour
        );

        // Save updated game state
        await gamesDb.update(gameHash, {
            gameState,
            turnDeadline: nextDeadline
        });

        console.log(`  ✅ Turn processed. Next deadline: ${nextDeadline.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);

    } catch (error) {
        console.error(`Error processing turn for game ${gameHash}:`, error);
    }
}

/**
 * Check for games ready to process
 */
async function checkGames() {
    try {
        const gamesReady = await gamesDb.getGamesReadyForTurn();

        if (gamesReady.length > 0) {
            console.log(`Found ${gamesReady.length} games ready for turn processing`);

            for (const game of gamesReady) {
                await processTurn(game.game_hash);
            }
        }
    } catch (error) {
        console.error('Error checking games:', error);
    }
}

/**
 * Start the turn scheduler
 */
function start() {
    console.log('Turn scheduler started');
    console.log('Checking for ready games every minute...');

    // Check every minute for games that need processing
    cron.schedule('* * * * *', async () => {
        await checkGames();
    });

    // Also check on startup
    checkGames();
}

/**
 * Manually trigger turn processing for a game
 */
async function processTurnManually(gameHash) {
    await processTurn(gameHash);
}

module.exports = {
    start,
    processTurnManually,
    calculateNextDeadline
};
