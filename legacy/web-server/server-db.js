/**
 * Diplomacy Web Multiplayer Server with Database Persistence
 *
 * Features:
 * - PostgreSQL database for persistence
 * - Automatic turn processing at midnight Eastern Time
 * - Support and Convoy order types
 * - Bot players with trust systems
 * - In-game messaging
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { GameState } = require('../gameLogic.js');
const { EnhancedBotPlayer } = require('./enhancedBot.js');
const db = require('./database/db.js');
const turnScheduler = require('./turnScheduler.js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Generate unique hash
 */
function generateHash(length = 8) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Create new game
 */
app.post('/api/game/create', async (req, res) => {
    const { nations, playerNames, botNations, turnDurationHours, turnTimeHour } = req.body;

    if (!nations || !Array.isArray(nations) || nations.length === 0) {
        return res.status(400).json({ error: 'Nations array required' });
    }

    try {
        const gameHash = generateHash(6);
        const gameState = new GameState();

        // Create game in database
        await db.games.create(
            gameHash,
            gameState,
            turnDurationHours || 24,
            turnTimeHour !== undefined ? turnTimeHour : 0 // Midnight ET by default
        );

        const playerUrls = [];

        // Add players
        for (let i = 0; i < nations.length; i++) {
            const nation = nations[i];
            const playerHash = generateHash(8);
            const playerName = playerNames?.[i] || `Player ${i + 1}`;
            const isBot = botNations?.includes(nation) || false;

            // Create player in database
            await db.players.create(playerHash, gameHash, nation, playerName, isBot);

            // If bot, create bot state
            if (isBot) {
                const bot = new EnhancedBotPlayer(nation, gameState);
                await db.botStates.create(
                    gameHash,
                    nation,
                    bot.personality,
                    Object.fromEntries(bot.trustValues),
                    Array.from(bot.alliances),
                    Array.from(bot.enemies)
                );
            }

            playerUrls.push({
                nation,
                playerName,
                isBot,
                url: isBot ? null : `/game/${gameHash}?p=${playerHash}`
            });
        }

        res.json({
            success: true,
            gameHash,
            playerUrls,
            message: 'Game created successfully',
            turnDurationHours: turnDurationHours || 24,
            turnTimeHour: turnTimeHour !== undefined ? turnTimeHour : 0
        });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

/**
 * Get game state for a player
 */
app.get('/api/game/:gameHash/state', async (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;

    try {
        // Get game
        const gameRow = await db.games.get(gameHash);
        if (!gameRow) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get player
        const playerRow = await db.players.get(playerHash);
        if (!playerRow || playerRow.game_hash !== gameHash) {
            return res.status(403).json({ error: 'Invalid player credentials' });
        }

        // Update last seen
        await db.players.updateLastSeen(playerHash);

        // Parse game state
        const gameState = gameRow.game_state;
        const nation = playerRow.nation;

        // Get all players
        const allPlayers = await db.players.getByGame(gameHash);

        // Get messages for this nation
        const messages = await db.messages.getForNation(gameHash, nation);

        // Format messages
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            from: msg.from_nation,
            to: msg.to_nations,
            content: msg.content,
            timestamp: parseInt(msg.timestamp),
            isBot: msg.is_bot
        }));

        res.json({
            success: true,
            game: {
                gameHash,
                season: gameState.season,
                year: gameState.year,
                phase: gameState.phase,
                started: gameRow.started,
                turnDeadline: gameRow.turn_deadline,
                turnDurationHours: gameRow.turn_duration_hours,
                turnTimeHour: gameRow.turn_time_hour
            },
            player: {
                nation,
                playerName: playerRow.player_name,
                units: gameState.units.filter(u => u.nation === nation),
                supplyCenters: gameState.getSupplyCount(nation),
                pendingOrders: playerRow.pending_orders || []
            },
            players: allPlayers.map(p => ({
                nation: p.nation,
                playerName: p.player_name,
                isBot: p.is_bot,
                supplyCenters: gameState.getSupplyCount(p.nation),
                units: gameState.units.filter(u => u.nation === p.nation).length
            })),
            messages: formattedMessages,
            allUnits: gameState.units,
            supplyCenters: gameState.supplyCenters
        });
    } catch (error) {
        console.error('Error getting game state:', error);
        res.status(500).json({ error: 'Failed to load game state' });
    }
});

/**
 * Submit orders
 */
app.post('/api/game/:gameHash/orders', async (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;
    const { orders } = req.body;

    try {
        // Get game
        const gameRow = await db.games.get(gameHash);
        if (!gameRow) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get player
        const playerRow = await db.players.get(playerHash);
        if (!playerRow || playerRow.game_hash !== gameHash) {
            return res.status(403).json({ error: 'Invalid player credentials' });
        }

        if (playerRow.is_bot) {
            return res.status(403).json({ error: 'Cannot submit orders for bot players' });
        }

        // Update orders in database
        await db.players.updateOrders(playerHash, orders);

        res.json({
            success: true,
            message: 'Orders submitted successfully',
            orders
        });
    } catch (error) {
        console.error('Error submitting orders:', error);
        res.status(500).json({ error: 'Failed to submit orders' });
    }
});

/**
 * Send message
 */
app.post('/api/game/:gameHash/message', async (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;
    const { to, content } = req.body;

    try {
        // Get game
        const gameRow = await db.games.get(gameHash);
        if (!gameRow) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get player
        const playerRow = await db.players.get(playerHash);
        if (!playerRow || playerRow.game_hash !== gameHash) {
            return res.status(403).json({ error: 'Invalid player credentials' });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Message content required' });
        }

        // Create message
        const message = await db.messages.create(
            gameHash,
            playerRow.nation,
            to,
            content.trim(),
            false
        );

        // Bots might respond to messages
        if (to !== 'all' && Array.isArray(to)) {
            // Find bot players
            const allPlayers = await db.players.getByGame(gameHash);
            const botPlayers = allPlayers.filter(p => to.includes(p.nation) && p.is_bot);

            for (const botPlayer of botPlayers) {
                if (Math.random() < 0.4) { // 40% chance bot responds
                    // Load bot state
                    const botState = await db.botStates.get(gameHash, botPlayer.nation);
                    if (botState) {
                        const gameState = gameRow.game_state;
                        const bot = new EnhancedBotPlayer(botPlayer.nation, gameState);

                        // Restore bot state
                        bot.trustValues = new Map(Object.entries(botState.trust_values));
                        bot.personality = botState.personality;
                        bot.alliances = new Set(botState.alliances);
                        bot.enemies = new Set(botState.enemies);

                        // Generate response
                        const response = bot.generateResponseTo(playerRow.nation, content, {});
                        if (response) {
                            // Send after delay
                            setTimeout(async () => {
                                await db.messages.create(
                                    gameHash,
                                    botPlayer.nation,
                                    [playerRow.nation],
                                    response,
                                    true
                                );
                            }, 2000 + Math.random() * 3000);
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            message: {
                id: message.id,
                from: message.from_nation,
                to: message.to_nations,
                content: message.content,
                timestamp: parseInt(message.timestamp)
            }
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * Process turn manually
 */
app.post('/api/game/:gameHash/process-turn', async (req, res) => {
    const { gameHash } = req.params;

    try {
        await turnScheduler.processTurnManually(gameHash);

        // Get updated game state
        const gameRow = await db.games.get(gameHash);

        res.json({
            success: true,
            message: 'Turn processed',
            season: gameRow.game_state.season,
            year: gameRow.game_state.year,
            phase: gameRow.game_state.phase
        });
    } catch (error) {
        console.error('Error processing turn:', error);
        res.status(500).json({ error: 'Failed to process turn' });
    }
});

/**
 * Start game
 */
app.post('/api/game/:gameHash/start', async (req, res) => {
    const { gameHash } = req.params;

    try {
        const gameRow = await db.games.get(gameHash);
        if (!gameRow) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Calculate first turn deadline
        const nextDeadline = turnScheduler.calculateNextDeadline(
            gameRow.turn_duration_hours,
            gameRow.turn_time_hour
        );

        // Update game
        await db.games.update(gameHash, {
            started: true,
            turnDeadline: nextDeadline
        });

        // Bots send initial messages (TODO: implement)

        res.json({
            success: true,
            message: 'Game started',
            turnDeadline: nextDeadline
        });
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
});

/**
 * Update game settings
 */
app.post('/api/game/:gameHash/settings', async (req, res) => {
    const { gameHash } = req.params;
    const { turnDurationHours, turnTimeHour } = req.body;

    try {
        const gameRow = await db.games.get(gameHash);
        if (!gameRow) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Update settings
        await db.query(
            `UPDATE games
             SET turn_duration_hours = COALESCE($2, turn_duration_hours),
                 turn_time_hour = COALESCE($3, turn_time_hour)
             WHERE game_hash = $1`,
            [gameHash, turnDurationHours, turnTimeHour]
        );

        // Recalculate deadline if game is started
        if (gameRow.started) {
            const nextDeadline = turnScheduler.calculateNextDeadline(
                turnDurationHours || gameRow.turn_duration_hours,
                turnTimeHour !== undefined ? turnTimeHour : gameRow.turn_time_hour
            );

            await db.games.update(gameHash, {
                turnDeadline: nextDeadline
            });
        }

        res.json({
            success: true,
            message: 'Settings updated'
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * Serve game page
 */
app.get('/game/:gameHash', async (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;

    try {
        const gameRow = await db.games.get(gameHash);
        if (!gameRow) {
            return res.status(404).send('Game not found');
        }

        const playerRow = await db.players.get(playerHash);
        if (!playerRow || playerRow.game_hash !== gameHash) {
            return res.status(403).send('Invalid player credentials');
        }

        res.sendFile(path.join(__dirname, 'public', 'game.html'));
    } catch (error) {
        console.error('Error loading game page:', error);
        res.status(500).send('Error loading game');
    }
});

/**
 * Home page - create game interface
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Serve static game data (provinces, nations, etc.)
 */
app.get('/api/game-data', (req, res) => {
    const { NATIONS, PROVINCES, ADJACENCIES } = require('../gameData.js');

    res.json({
        success: true,
        nations: NATIONS,
        provinces: PROVINCES,
        adjacencies: ADJACENCIES
    });
});

/**
 * Health check
 */
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        await db.query('SELECT 1');

        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Diplomacy Web Server running on port ${port}`);
    console.log(`\nCreate a game: http://localhost:${port}/`);
    console.log(`Health check: http://localhost:${port}/health`);

    // Start turn scheduler
    turnScheduler.start();
});

module.exports = { app };
