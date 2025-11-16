/**
 * Diplomacy Web Multiplayer Server
 *
 * Players access the game via unique URLs: /game/{gameHash}?p={playerHash}
 * Features:
 * - Web-based move submission
 * - In-game messaging between players
 * - Bot players with trust/value systems
 * - Real-time updates
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { GameState } = require('../gameLogic.js');
const { EnhancedBotPlayer } = require('./enhancedBot.js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (replace with database in production)
const games = new Map(); // gameHash -> GameData
const players = new Map(); // playerHash -> PlayerData

/**
 * Game Data Structure
 */
class GameData {
    constructor(gameHash) {
        this.gameHash = gameHash;
        this.gameState = new GameState();
        this.players = new Map(); // nation -> PlayerData
        this.bots = new Map(); // nation -> EnhancedBotPlayer
        this.messages = []; // Chat messages
        this.nextMessageId = 1;
        this.turnDeadline = null;
        this.started = false;
        this.createdAt = Date.now();
    }

    addPlayer(nation, playerHash, playerName, isBot = false) {
        const playerData = {
            playerHash,
            nation,
            playerName,
            isBot,
            pendingOrders: [],
            lastSeen: Date.now()
        };

        this.players.set(nation, playerData);
        players.set(playerHash, {
            gameHash: this.gameHash,
            ...playerData
        });

        if (isBot) {
            const bot = new EnhancedBotPlayer(nation, this.gameState);
            this.bots.set(nation, bot);
        }

        return playerData;
    }

    addMessage(fromNation, toNations, content) {
        const message = {
            id: this.nextMessageId++,
            from: fromNation,
            to: toNations, // Array of nations, or 'all' for broadcast
            content,
            timestamp: Date.now(),
            isBot: this.players.get(fromNation)?.isBot || false
        };

        this.messages.push(message);
        return message;
    }

    getMessagesFor(nation) {
        return this.messages.filter(msg =>
            msg.to === 'all' ||
            msg.to.includes(nation) ||
            msg.from === nation
        );
    }

    getAllPlayers() {
        return Array.from(this.players.values());
    }

    processBotActions() {
        // Bots generate messages and submit orders
        for (const [nation, bot] of this.bots.entries()) {
            // Update bot's trust values based on game state
            bot.updateTrustValues(this);

            // Bot might send a message
            if (Math.random() < 0.3) { // 30% chance per turn
                const message = bot.generateMessage(this);
                if (message) {
                    this.addMessage(nation, message.to, message.content);
                }
            }

            // Bot submits orders
            const orders = bot.generateOrders();
            this.players.get(nation).pendingOrders = orders;
        }
    }
}

/**
 * Generate unique hash
 */
function generateHash(length = 8) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Create new game
 */
app.post('/api/game/create', (req, res) => {
    const { nations, playerNames, botNations } = req.body;

    if (!nations || !Array.isArray(nations) || nations.length === 0) {
        return res.status(400).json({ error: 'Nations array required' });
    }

    const gameHash = generateHash(6);
    const game = new GameData(gameHash);

    const playerUrls = [];

    // Add players
    nations.forEach((nation, index) => {
        const playerHash = generateHash(8);
        const playerName = playerNames?.[index] || `Player ${index + 1}`;
        const isBot = botNations?.includes(nation) || false;

        game.addPlayer(nation, playerHash, playerName, isBot);

        playerUrls.push({
            nation,
            playerName,
            isBot,
            url: isBot ? null : `/game/${gameHash}?p=${playerHash}`
        });
    });

    games.set(gameHash, game);

    res.json({
        success: true,
        gameHash,
        playerUrls,
        message: 'Game created successfully'
    });
});

/**
 * Get game state for a player
 */
app.get('/api/game/:gameHash/state', (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;

    const game = games.get(gameHash);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    const playerData = players.get(playerHash);
    if (!playerData || playerData.gameHash !== gameHash) {
        return res.status(403).json({ error: 'Invalid player credentials' });
    }

    // Update last seen
    playerData.lastSeen = Date.now();

    // Get player's nation
    const nation = playerData.nation;

    // Return game state from player's perspective
    res.json({
        success: true,
        game: {
            gameHash,
            season: game.gameState.season,
            year: game.gameState.year,
            phase: game.gameState.phase,
            started: game.started,
            turnDeadline: game.turnDeadline
        },
        player: {
            nation,
            playerName: playerData.playerName,
            units: game.gameState.getUnitsForNation(nation),
            supplyCenters: game.gameState.getSupplyCount(nation),
            pendingOrders: playerData.pendingOrders
        },
        players: game.getAllPlayers().map(p => ({
            nation: p.nation,
            playerName: p.playerName,
            isBot: p.isBot,
            supplyCenters: game.gameState.getSupplyCount(p.nation),
            units: game.gameState.getUnitsForNation(p.nation).length
        })),
        messages: game.getMessagesFor(nation),
        allUnits: game.gameState.units,
        supplyCenters: game.gameState.supplyCenters
    });
});

/**
 * Submit orders
 */
app.post('/api/game/:gameHash/orders', (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;
    const { orders } = req.body;

    const game = games.get(gameHash);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    const playerData = players.get(playerHash);
    if (!playerData || playerData.gameHash !== gameHash) {
        return res.status(403).json({ error: 'Invalid player credentials' });
    }

    if (playerData.isBot) {
        return res.status(403).json({ error: 'Cannot submit orders for bot players' });
    }

    // Validate and store orders
    playerData.pendingOrders = orders;

    // Submit orders to game state
    orders.forEach(order => {
        game.gameState.addOrder(order);
    });

    res.json({
        success: true,
        message: 'Orders submitted successfully',
        orders
    });
});

/**
 * Send message
 */
app.post('/api/game/:gameHash/message', (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;
    const { to, content } = req.body;

    const game = games.get(gameHash);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    const playerData = players.get(playerHash);
    if (!playerData || playerData.gameHash !== gameHash) {
        return res.status(403).json({ error: 'Invalid player credentials' });
    }

    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message content required' });
    }

    const message = game.addMessage(playerData.nation, to, content.trim());

    // Bots might respond to messages
    if (to !== 'all' && Array.isArray(to)) {
        to.forEach(targetNation => {
            const bot = game.bots.get(targetNation);
            if (bot && Math.random() < 0.4) { // 40% chance bot responds
                setTimeout(() => {
                    const response = bot.generateResponseTo(playerData.nation, content, game);
                    if (response) {
                        game.addMessage(targetNation, [playerData.nation], response);
                    }
                }, 2000 + Math.random() * 3000); // Respond after 2-5 seconds
            }
        });
    }

    res.json({
        success: true,
        message
    });
});

/**
 * Process turn
 */
app.post('/api/game/:gameHash/process-turn', (req, res) => {
    const { gameHash } = req.params;

    const game = games.get(gameHash);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    // Process bot actions first
    game.processBotActions();

    // Resolve orders
    game.gameState.resolveOrders();

    // Update supply centers
    game.gameState.updateSupplyCenters();

    // Clear pending orders
    game.players.forEach(player => {
        player.pendingOrders = [];
    });

    // Advance turn
    game.gameState.advanceTurn();

    // Check for victory
    const winner = game.gameState.checkVictory();

    res.json({
        success: true,
        message: 'Turn processed',
        season: game.gameState.season,
        year: game.gameState.year,
        phase: game.gameState.phase,
        winner
    });
});

/**
 * Start game
 */
app.post('/api/game/:gameHash/start', (req, res) => {
    const { gameHash } = req.params;

    const game = games.get(gameHash);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    game.started = true;
    game.turnDeadline = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now

    // Bots send initial messages
    game.processBotActions();

    res.json({
        success: true,
        message: 'Game started',
        turnDeadline: game.turnDeadline
    });
});

/**
 * Serve game page
 */
app.get('/game/:gameHash', (req, res) => {
    const { gameHash } = req.params;
    const { p: playerHash } = req.query;

    const game = games.get(gameHash);
    if (!game) {
        return res.status(404).send('Game not found');
    }

    const playerData = players.get(playerHash);
    if (!playerData || playerData.gameHash !== gameHash) {
        return res.status(403).send('Invalid player credentials');
    }

    res.sendFile(path.join(__dirname, 'public', 'game.html'));
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
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        games: games.size,
        players: players.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`Diplomacy Web Server running on port ${port}`);
    console.log(`\nCreate a game: http://localhost:${port}/`);
    console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = { app, games, players };
