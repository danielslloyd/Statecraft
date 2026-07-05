/**
 * Database Connection and Query Module
 */

const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/statecraft',
    // SSL configuration for production (Heroku, etc.)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    // Connection pool settings
    max: 20, // Maximum number of clients
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Log connection
pool.on('connect', () => {
    console.log('Database connected');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
});

/**
 * Execute a query
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 100) {
            console.log('Slow query:', { text, duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        console.error('Database query error:', { text, params, error: error.message });
        throw error;
    }
}

/**
 * Get a client from the pool (for transactions)
 */
async function getClient() {
    return await pool.connect();
}

/**
 * Game operations
 */
const games = {
    async create(gameHash, gameState, turnDurationHours = 24, turnTimeHour = 0) {
        const result = await query(
            `INSERT INTO games (game_hash, game_state, turn_duration_hours, turn_time_hour)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [gameHash, JSON.stringify(gameState), turnDurationHours, turnTimeHour]
        );
        return result.rows[0];
    },

    async get(gameHash) {
        const result = await query(
            'SELECT * FROM games WHERE game_hash = $1',
            [gameHash]
        );
        return result.rows[0];
    },

    async update(gameHash, updates) {
        const { gameState, started, turnDeadline } = updates;
        const result = await query(
            `UPDATE games
             SET game_state = COALESCE($2, game_state),
                 started = COALESCE($3, started),
                 turn_deadline = COALESCE($4, turn_deadline)
             WHERE game_hash = $1
             RETURNING *`,
            [gameHash, gameState ? JSON.stringify(gameState) : null, started, turnDeadline]
        );
        return result.rows[0];
    },

    async getGamesReadyForTurn() {
        const result = await query(
            `SELECT * FROM games
             WHERE started = TRUE
             AND turn_deadline IS NOT NULL
             AND turn_deadline <= NOW()`
        );
        return result.rows;
    },

    async delete(gameHash) {
        await query('DELETE FROM games WHERE game_hash = $1', [gameHash]);
    }
};

/**
 * Player operations
 */
const players = {
    async create(playerHash, gameHash, nation, playerName, isBot = false) {
        const result = await query(
            `INSERT INTO players (player_hash, game_hash, nation, player_name, is_bot)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [playerHash, gameHash, nation, playerName, isBot]
        );
        return result.rows[0];
    },

    async get(playerHash) {
        const result = await query(
            'SELECT * FROM players WHERE player_hash = $1',
            [playerHash]
        );
        return result.rows[0];
    },

    async getByGame(gameHash) {
        const result = await query(
            'SELECT * FROM players WHERE game_hash = $1',
            [gameHash]
        );
        return result.rows;
    },

    async updateOrders(playerHash, orders) {
        const result = await query(
            `UPDATE players
             SET pending_orders = $2,
                 last_seen = CURRENT_TIMESTAMP
             WHERE player_hash = $1
             RETURNING *`,
            [playerHash, JSON.stringify(orders)]
        );
        return result.rows[0];
    },

    async updateLastSeen(playerHash) {
        await query(
            'UPDATE players SET last_seen = CURRENT_TIMESTAMP WHERE player_hash = $1',
            [playerHash]
        );
    },

    async clearOrders(gameHash) {
        await query(
            `UPDATE players
             SET pending_orders = '[]'
             WHERE game_hash = $1`,
            [gameHash]
        );
    }
};

/**
 * Message operations
 */
const messages = {
    async create(gameHash, fromNation, toNations, content, isBot = false) {
        const result = await query(
            `INSERT INTO messages (game_hash, from_nation, to_nations, content, is_bot)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *, EXTRACT(EPOCH FROM created_at) * 1000 as timestamp`,
            [gameHash, fromNation, JSON.stringify(toNations), content, isBot]
        );
        return result.rows[0];
    },

    async getByGame(gameHash, limit = 100) {
        const result = await query(
            `SELECT *, EXTRACT(EPOCH FROM created_at) * 1000 as timestamp
             FROM messages
             WHERE game_hash = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [gameHash, limit]
        );
        return result.rows.reverse();
    },

    async getForNation(gameHash, nation, limit = 100) {
        const result = await query(
            `SELECT *, EXTRACT(EPOCH FROM created_at) * 1000 as timestamp
             FROM messages
             WHERE game_hash = $1
             AND (from_nation = $2 OR to_nations = '"all"' OR to_nations::jsonb ? $2)
             ORDER BY created_at DESC
             LIMIT $3`,
            [gameHash, nation, limit]
        );
        return result.rows.reverse();
    }
};

/**
 * Bot state operations
 */
const botStates = {
    async create(gameHash, nation, personality, trustValues = {}, alliances = [], enemies = []) {
        const result = await query(
            `INSERT INTO bot_states (game_hash, nation, personality, trust_values, alliances, enemies)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (game_hash, nation)
             DO UPDATE SET
                 personality = $3,
                 trust_values = $4,
                 alliances = $5,
                 enemies = $6
             RETURNING *`,
            [gameHash, nation, JSON.stringify(personality), JSON.stringify(trustValues),
             JSON.stringify(alliances), JSON.stringify(enemies)]
        );
        return result.rows[0];
    },

    async get(gameHash, nation) {
        const result = await query(
            'SELECT * FROM bot_states WHERE game_hash = $1 AND nation = $2',
            [gameHash, nation]
        );
        return result.rows[0];
    },

    async update(gameHash, nation, trustValues, alliances, enemies) {
        const result = await query(
            `UPDATE bot_states
             SET trust_values = $3,
                 alliances = $4,
                 enemies = $5
             WHERE game_hash = $1 AND nation = $2
             RETURNING *`,
            [gameHash, nation, JSON.stringify(trustValues),
             JSON.stringify(alliances), JSON.stringify(enemies)]
        );
        return result.rows[0];
    }
};

/**
 * Turn history operations
 */
const turnHistory = {
    async create(gameHash, turnNumber, season, year, phase, orders, results = null) {
        const result = await query(
            `INSERT INTO turn_history (game_hash, turn_number, season, year, phase, orders, results)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [gameHash, turnNumber, season, year, phase, JSON.stringify(orders), JSON.stringify(results)]
        );
        return result.rows[0];
    },

    async getByGame(gameHash) {
        const result = await query(
            'SELECT * FROM turn_history WHERE game_hash = $1 ORDER BY turn_number',
            [gameHash]
        );
        return result.rows;
    }
};

module.exports = {
    query,
    getClient,
    pool,
    games,
    players,
    messages,
    botStates,
    turnHistory
};
