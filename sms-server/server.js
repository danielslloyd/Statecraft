/**
 * Diplomacy SMS Game Server
 *
 * This server handles SMS-based gameplay using Twilio.
 * Players can join games, submit orders via SMS, and receive board updates.
 */

const express = require('express');
const twilio = require('twilio');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { parseOrders, formatConfirmation } = require('./moveNotation.js');
const { GameState } = require('../gameLogic.js');
const { generateBoardImage } = require('./imageGenerator.js');

const app = express();
const port = process.env.PORT || 3000;

// Twilio credentials (set via environment variables)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.error('ERROR: Missing Twilio credentials. Please set environment variables:');
    console.error('  TWILIO_ACCOUNT_SID');
    console.error('  TWILIO_AUTH_TOKEN');
    console.error('  TWILIO_PHONE_NUMBER');
    process.exit(1);
}

const twilioClient = twilio(accountSid, authToken);

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'board-images')));

/**
 * In-memory game storage
 * In production, this should be replaced with a database
 */
const games = new Map(); // gameId -> GameState
const players = new Map(); // phoneNumber -> { gameId, nation, confirmed, pendingOrders }
const gameRosters = new Map(); // gameId -> { nation -> phoneNumber }
const pendingConfirmations = new Map(); // phoneNumber -> { orders, parseResult, timestamp }

/**
 * Send SMS message to a phone number
 */
async function sendSMS(to, message, mediaUrl = null) {
    try {
        const messageParams = {
            body: message,
            from: twilioPhoneNumber,
            to: to
        };

        if (mediaUrl) {
            messageParams.mediaUrl = [mediaUrl];
        }

        const result = await twilioClient.messages.create(messageParams);
        console.log(`SMS sent to ${to}: ${result.sid}`);
        return result;
    } catch (error) {
        console.error(`Error sending SMS to ${to}:`, error);
        throw error;
    }
}

/**
 * Create a new game
 */
function createGame(gameId) {
    const gameState = new GameState();
    games.set(gameId, gameState);
    gameRosters.set(gameId, {});
    console.log(`Game created: ${gameId}`);
    return gameState;
}

/**
 * Add player to game
 */
function addPlayerToGame(phoneNumber, gameId, nation) {
    // Validate nation
    const game = games.get(gameId);
    if (!game) {
        throw new Error('Game not found');
    }

    const roster = gameRosters.get(gameId);
    if (roster[nation]) {
        throw new Error(`Nation ${nation} is already assigned`);
    }

    // Register player
    players.set(phoneNumber, {
        gameId,
        nation,
        confirmed: false,
        pendingOrders: []
    });

    roster[nation] = phoneNumber;

    console.log(`Player ${phoneNumber} assigned to ${nation} in game ${gameId}`);
}

/**
 * Send confirmation request to player
 */
async function sendConfirmationRequest(phoneNumber, gameId, nation) {
    const message = `Welcome to Diplomacy SMS!\n\nYou are assigned to play as ${nation} in game ${gameId}.\n\nReply Y to confirm you're ready to play.`;
    await sendSMS(phoneNumber, message);
}

/**
 * Send board image to player
 */
async function sendBoardUpdate(phoneNumber, gameId) {
    const game = games.get(gameId);
    if (!game) {
        throw new Error('Game not found');
    }

    const player = players.get(phoneNumber);
    if (!player) {
        throw new Error('Player not found');
    }

    try {
        // Generate board image
        const imageUrl = await generateBoardImage(game, gameId);

        const message = `${game.season} ${game.year} - ${game.phase} Phase\n\nYour units (${player.nation}):\n${formatUnits(game, player.nation)}\n\nSend your orders!`;

        await sendSMS(phoneNumber, message, imageUrl);
    } catch (error) {
        console.error('Error sending board update:', error);
        // Send text-only update as fallback
        const message = `${game.season} ${game.year} - ${game.phase} Phase\n\nYour units (${player.nation}):\n${formatUnits(game, player.nation)}\n\nSend your orders!`;
        await sendSMS(phoneNumber, message);
    }
}

/**
 * Format units for a nation
 */
function formatUnits(game, nation) {
    const units = game.getUnitsForNation(nation);
    if (units.length === 0) {
        return '(none)';
    }

    return units.map(u => {
        const type = u.type === 'army' ? 'A' : 'F';
        return `${type} ${u.province.toUpperCase()}`;
    }).join(', ');
}

/**
 * Handle incoming SMS message
 */
async function handleIncomingSMS(from, body) {
    const message = body.trim();
    const player = players.get(from);

    console.log(`Received SMS from ${from}: ${message}`);

    // Handle new player confirmation
    if (player && !player.confirmed) {
        if (message.toUpperCase() === 'Y' || message.toUpperCase() === 'YES') {
            player.confirmed = true;
            await sendSMS(from, `Great! You're confirmed for ${player.nation}. The game will start once all players confirm.`);

            // Check if all players confirmed
            const roster = gameRosters.get(player.gameId);
            const allConfirmed = Object.values(roster).every(phone => {
                const p = players.get(phone);
                return p && p.confirmed;
            });

            if (allConfirmed) {
                await startGame(player.gameId);
            }

            return { success: true, message: 'Player confirmed' };
        } else {
            await sendSMS(from, `Please reply Y to confirm you're ready to play as ${player.nation}.`);
            return { success: false, message: 'Invalid confirmation' };
        }
    }

    // Handle player not registered
    if (!player) {
        await sendSMS(from, 'You are not registered for any game. Please contact the game organizer.');
        return { success: false, message: 'Player not registered' };
    }

    // Handle CONFIRM keyword for pending orders
    if (message.toUpperCase() === 'CONFIRM' || message.toUpperCase() === 'CONFIRMED') {
        const pending = pendingConfirmations.get(from);
        if (pending && pending.parseResult.allSuccessful) {
            // Submit orders to game
            const game = games.get(player.gameId);
            pending.parseResult.orders.forEach(order => {
                if (order.success) {
                    submitOrderToGame(game, order, player.nation);
                }
            });

            pendingConfirmations.delete(from);
            await sendSMS(from, `Orders submitted! You can update your orders anytime before the next turn.`);
            return { success: true, message: 'Orders confirmed and submitted' };
        } else {
            await sendSMS(from, 'No pending orders to confirm. Send your orders first.');
            return { success: false, message: 'No pending orders' };
        }
    }

    // Handle STATUS command
    if (message.toUpperCase() === 'STATUS' || message.toUpperCase() === 'S') {
        const game = games.get(player.gameId);
        const statusMessage = `Game ${player.gameId}\n${game.season} ${game.year} - ${game.phase}\n\nYour units (${player.nation}):\n${formatUnits(game, player.nation)}\n\nSupply centers: ${game.getSupplyCount(player.nation)}`;
        await sendSMS(from, statusMessage);
        return { success: true, message: 'Status sent' };
    }

    // Handle HELP command
    if (message.toUpperCase() === 'HELP' || message.toUpperCase() === 'H') {
        const helpMessage = `Diplomacy SMS Commands:\n\nORDERS:\n- Move: PAR-BUR\n- Hold: MUN H\n- Support: BUR S PAR-PIC\n- Convoy: NTH C YOR-NWY\n\nCOMMANDS:\n- CONFIRM: Submit orders\n- STATUS: Game status\n- HELP: This message`;
        await sendSMS(from, helpMessage);
        return { success: true, message: 'Help sent' };
    }

    // Parse orders
    const game = games.get(player.gameId);
    const parseResult = parseOrders(message, game);

    // Filter to only this player's units
    const playerOrders = parseResult.orders.filter(order => {
        return order.success && order.unit && order.unit.nation === player.nation;
    });

    if (playerOrders.length === 0) {
        await sendSMS(from, `Could not parse any valid orders for your units. Send HELP for format examples.`);
        return { success: false, message: 'No valid orders parsed' };
    }

    // Store pending orders
    pendingConfirmations.set(from, {
        orders: playerOrders,
        parseResult: { ...parseResult, orders: playerOrders },
        timestamp: Date.now()
    });

    // Send confirmation
    const confirmation = formatConfirmation({ ...parseResult, orders: playerOrders });
    await sendSMS(from, confirmation);

    return { success: true, message: 'Orders parsed and confirmation sent' };
}

/**
 * Submit order to game
 */
function submitOrderToGame(game, parsedOrder, nation) {
    // Create order in game format
    const order = {
        unitId: parsedOrder.unit.id,
        type: parsedOrder.type,
        from: parsedOrder.from,
        to: parsedOrder.to
    };

    if (parsedOrder.type === 'support' && parsedOrder.supported) {
        order.supportedUnitId = parsedOrder.supported.unit.id;
        order.supportTo = parsedOrder.supported.to;
    }

    if (parsedOrder.type === 'convoy' && parsedOrder.convoyed) {
        order.convoyedUnitId = parsedOrder.convoyed.unit.id;
        order.convoyFrom = parsedOrder.convoyed.from;
        order.convoyTo = parsedOrder.convoyed.to;
    }

    // Remove any existing orders for this unit
    game.orders = game.orders.filter(o => o.unitId !== order.unitId);

    // Add new order
    game.orders.push(order);

    console.log(`Order submitted for ${nation}: ${parsedOrder.corrected}`);
}

/**
 * Start game and notify all players
 */
async function startGame(gameId) {
    console.log(`Starting game ${gameId}`);

    const roster = gameRosters.get(gameId);
    const game = games.get(gameId);

    game.addLog(`Game started! ${game.season} ${game.year} - ${game.phase} Phase`);

    // Send board to all players
    for (const [nation, phoneNumber] of Object.entries(roster)) {
        try {
            await sendBoardUpdate(phoneNumber, gameId);
        } catch (error) {
            console.error(`Error sending board to ${nation}:`, error);
        }
    }
}

/**
 * Process turn - resolve orders and advance
 */
async function processTurn(gameId) {
    const game = games.get(gameId);
    const roster = gameRosters.get(gameId);

    console.log(`Processing turn for game ${gameId}`);

    // Resolve orders
    game.resolveOrders();

    // Update supply centers
    game.updateSupplyCenters();

    // Clear pending confirmations
    Object.values(roster).forEach(phone => {
        pendingConfirmations.delete(phone);
    });

    // Advance turn
    game.advanceTurn();

    // Check for victory
    const winner = game.checkVictory();
    if (winner) {
        const winMessage = `GAME OVER! ${winner} wins with ${game.getSupplyCount(winner)} supply centers!`;
        for (const phoneNumber of Object.values(roster)) {
            await sendSMS(phoneNumber, winMessage);
        }
        return;
    }

    // Send new board to all players
    for (const [nation, phoneNumber] of Object.entries(roster)) {
        try {
            await sendBoardUpdate(phoneNumber, gameId);
        } catch (error) {
            console.error(`Error sending board to ${nation}:`, error);
        }
    }
}

/**
 * Webhook endpoint for Twilio incoming messages
 */
app.post('/sms/incoming', async (req, res) => {
    const from = req.body.From;
    const body = req.body.Body;

    try {
        await handleIncomingSMS(from, body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling incoming SMS:', error);
        res.status(500).send('Error processing message');
    }
});

/**
 * API endpoint to create a new game
 */
app.post('/api/game/create', (req, res) => {
    const gameId = req.body.gameId || `game-${Date.now()}`;
    const game = createGame(gameId);

    res.json({
        success: true,
        gameId,
        message: 'Game created successfully'
    });
});

/**
 * API endpoint to add player to game
 */
app.post('/api/game/add-player', async (req, res) => {
    const { phoneNumber, gameId, nation } = req.body;

    if (!phoneNumber || !gameId || !nation) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: phoneNumber, gameId, nation'
        });
    }

    try {
        addPlayerToGame(phoneNumber, gameId, nation);
        await sendConfirmationRequest(phoneNumber, gameId, nation);

        res.json({
            success: true,
            message: `Player added to ${nation} and confirmation sent`
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API endpoint to manually process turn
 */
app.post('/api/game/process-turn', async (req, res) => {
    const { gameId } = req.body;

    if (!gameId || !games.has(gameId)) {
        return res.status(400).json({
            success: false,
            error: 'Game not found'
        });
    }

    try {
        await processTurn(gameId);
        res.json({
            success: true,
            message: 'Turn processed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API endpoint to get game status
 */
app.get('/api/game/:gameId/status', (req, res) => {
    const gameId = req.params.gameId;
    const game = games.get(gameId);

    if (!game) {
        return res.status(404).json({
            success: false,
            error: 'Game not found'
        });
    }

    const roster = gameRosters.get(gameId);

    res.json({
        success: true,
        game: {
            id: gameId,
            season: game.season,
            year: game.year,
            phase: game.phase,
            players: Object.entries(roster).map(([nation, phone]) => ({
                nation,
                phone,
                confirmed: players.get(phone)?.confirmed || false,
                units: game.getUnitsForNation(nation).length,
                supplyCenters: game.getSupplyCount(nation)
            }))
        }
    });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start server
 */
app.listen(port, () => {
    console.log(`Diplomacy SMS Server running on port ${port}`);
    console.log(`Twilio webhook URL: http://YOUR_DOMAIN/sms/incoming`);
    console.log('\nAPI Endpoints:');
    console.log('  POST /api/game/create - Create new game');
    console.log('  POST /api/game/add-player - Add player to game');
    console.log('  POST /api/game/process-turn - Process game turn');
    console.log('  GET  /api/game/:gameId/status - Get game status');
});

module.exports = {
    app,
    createGame,
    addPlayerToGame,
    sendSMS,
    sendBoardUpdate,
    processTurn
};
