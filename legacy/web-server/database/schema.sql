-- PostgreSQL Schema for Statecraft

-- Games table
CREATE TABLE games (
    game_hash VARCHAR(8) PRIMARY KEY,
    game_state JSONB NOT NULL,
    started BOOLEAN DEFAULT FALSE,
    turn_deadline TIMESTAMP,
    turn_duration_hours INTEGER DEFAULT 24,
    turn_time_hour INTEGER DEFAULT 0, -- 0-23, hour of day for turn processing (Eastern Time)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE players (
    player_hash VARCHAR(8) PRIMARY KEY,
    game_hash VARCHAR(8) REFERENCES games(game_hash) ON DELETE CASCADE,
    nation VARCHAR(20) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    is_bot BOOLEAN DEFAULT FALSE,
    pending_orders JSONB DEFAULT '[]',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_hash, nation)
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    game_hash VARCHAR(8) REFERENCES games(game_hash) ON DELETE CASCADE,
    from_nation VARCHAR(20) NOT NULL,
    to_nations JSONB NOT NULL, -- Array of nations or 'all'
    content TEXT NOT NULL,
    is_bot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bot state table (for persistence of trust values, etc.)
CREATE TABLE bot_states (
    game_hash VARCHAR(8) REFERENCES games(game_hash) ON DELETE CASCADE,
    nation VARCHAR(20) NOT NULL,
    trust_values JSONB DEFAULT '{}',
    personality JSONB NOT NULL,
    alliances JSONB DEFAULT '[]',
    enemies JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_hash, nation)
);

-- Turn history table
CREATE TABLE turn_history (
    id SERIAL PRIMARY KEY,
    game_hash VARCHAR(8) REFERENCES games(game_hash) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    phase VARCHAR(20) NOT NULL,
    orders JSONB NOT NULL,
    results JSONB,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_hash, turn_number)
);

-- Indexes for performance
CREATE INDEX idx_games_turn_deadline ON games(turn_deadline) WHERE started = TRUE;
CREATE INDEX idx_players_game_hash ON players(game_hash);
CREATE INDEX idx_messages_game_hash ON messages(game_hash);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_bot_states_game_hash ON bot_states(game_hash);
CREATE INDEX idx_turn_history_game_hash ON turn_history(game_hash);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_states_updated_at BEFORE UPDATE ON bot_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old games (optional)
CREATE OR REPLACE FUNCTION cleanup_old_games()
RETURNS void AS $$
BEGIN
    DELETE FROM games
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND started = FALSE;
END;
$$ LANGUAGE plpgsql;
