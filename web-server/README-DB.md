# Statecraft - Web Multiplayer with PostgreSQL

**Version 2.0** - Now with database persistence, support/convoy orders, and automatic turn processing!

## 🎉 What's New in V2.0

### ✅ PostgreSQL Database Persistence
- Games are saved to database - no data loss on server restart
- Visit your game URL anytime to load current state
- Complete turn history tracking
- Bot state persistence (trust values, personalities)

### ✅ Support & Convoy Orders
- Full Diplomacy rules implementation
- Interactive UI for all order types:
  - **Move**: Click unit → click destination
  - **Hold**: Click unit
  - **Support**: Click supporting unit → unit to support → destination
  - **Convoy**: Click fleet → army to convoy → destination
- Visual order mode selection with instructions

### ✅ Automatic Turn Timer
- Configurable turn duration (default: 24 hours)
- Scheduled turn processing at specific time (default: midnight Eastern)
- Automatic bot order generation
- Email/notification ready (extensible)

## 📋 Prerequisites

1. **PostgreSQL** (v12 or higher)
2. **Node.js** (v14 or higher)

## 🚀 Quick Start

### 1. Install PostgreSQL

**Mac (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### 2. Create Database

```bash
# Create database
createdb statecraft

# Or using psql:
psql postgres
CREATE DATABASE statecraft;
\q
```

### 3. Install Dependencies

```bash
cd web-server
npm install
```

### 4. Run Migrations

```bash
npm run migrate
```

You should see:
```
✅ Migration completed successfully!

Created tables:
  - games
  - players
  - messages
  - bot_states
  - turn_history
```

### 5. Start Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

Server runs on http://localhost:3000

## 🎮 How to Play

### Create a Game

1. Open http://localhost:3000
2. Select nations to include
3. Configure players (name + bot checkbox)
4. **Set turn timer:**
   - Duration: 1-168 hours (default: 24)
   - Time: When to process turns in ET (default: midnight)
5. Click "Create Game"
6. Share URLs with friends!

**Example Timer Settings:**
```
Turn Duration: 24 hours
Process at: 12:00 AM (Midnight) Eastern Time
→ Turns process every day at midnight ET
```

```
Turn Duration: 48 hours
Process at: 6:00 PM Eastern Time
→ Turns process every 2 days at 6 PM ET
```

### Submit Orders

1. Select order type: **Move** | **Hold** | **Support** | **Convoy**
2. Follow on-screen instructions
3. Click "Submit Orders"
4. Orders saved to database immediately

**Order Examples:**

**Move:**
```
1. Click "Move" button
2. Click your unit (e.g., Army in Paris)
3. Click destination (e.g., Burgundy)
→ Order created: A PAR-BUR
```

**Hold:**
```
1. Click "Hold" button
2. Click your unit (e.g., Army in Munich)
→ Order created: A MUN H
```

**Support:**
```
1. Click "Support" button
2. Click your supporting unit (e.g., Army in Burgundy)
3. Click unit to support (e.g., Army in Paris)
4. Click destination (e.g., Picardy)
→ Order created: A BUR S A PAR-PIC
```

**Convoy:**
```
1. Click "Convoy" button
2. Click your fleet (e.g., Fleet in North Sea)
3. Click army to convoy (e.g., Army in Yorkshire)
4. Click destination (e.g., Norway)
→ Order created: F NTH C A YOR-NWY
```

### Turn Processing

**Automatic:**
- Turns process automatically based on timer settings
- Bots submit orders automatically
- Server checks every minute for ready games
- No manual intervention needed!

**Manual:**
- For testing or immediate resolution:
```bash
curl -X POST http://localhost:3000/api/game/abc123/process-turn
```

## 🗄️ Database Schema

### Tables

**games**
- Stores game state (units, supply centers, turn info)
- Turn timer settings
- Started status and deadline

**players**
- Player credentials and nation assignments
- Pending orders (JSON)
- Last seen timestamp

**messages**
- In-game chat messages
- From/to nations
- Bot vs human tracking

**bot_states**
- Bot trust values for each player
- Personality traits
- Alliances and enemies

**turn_history**
- Complete history of all turns
- Orders submitted each turn
- Results of resolution

## 🔧 Configuration

### Environment Variables

Create `.env` file:
```bash
DATABASE_URL=postgresql://localhost/statecraft
PORT=3000
NODE_ENV=development
```

**Production (Heroku, etc.):**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PORT=3000
NODE_ENV=production
```

### Turn Timer Settings

Edit game settings via API:
```bash
curl -X POST http://localhost:3000/api/game/abc123/settings \
  -H "Content-Type: application/json" \
  -d '{
    "turnDurationHours": 48,
    "turnTimeHour": 18
  }'
```

## 📊 API Reference

### Create Game
```http
POST /api/game/create
{
  "nations": ["AUSTRIA", "ENGLAND", ...],
  "playerNames": ["Alice", "Bob", ...],
  "botNations": ["ENGLAND"],
  "turnDurationHours": 24,
  "turnTimeHour": 0
}
```

### Get Game State
```http
GET /api/game/:gameHash/state?p=:playerHash
```

Returns complete game state including:
- Current turn/season/phase
- All units and supply centers
- Player's pending orders
- Messages
- Turn deadline

### Submit Orders
```http
POST /api/game/:gameHash/orders?p=:playerHash
{
  "orders": [
    {
      "unitId": "...",
      "type": "army",
      "orderType": "move",
      "from": "par",
      "to": "bur"
    }
  ]
}
```

### Send Message
```http
POST /api/game/:gameHash/message?p=:playerHash
{
  "to": "all",  // or ["ENGLAND", "FRANCE"]
  "content": "Good luck!"
}
```

### Process Turn (Manual)
```http
POST /api/game/:gameHash/process-turn
```

### Update Timer Settings
```http
POST /api/game/:gameHash/settings
{
  "turnDurationHours": 48,
  "turnTimeHour": 20
}
```

## 🤖 Bot Behavior

### Turn Processing
When a turn is processed:
1. Bots update trust values
2. Bots generate orders (probabilistic)
3. Bots may send messages (30% chance)
4. All orders resolved
5. Supply centers updated
6. Turn advanced
7. Next deadline calculated

### Bot Orders
Bots use weighted probability for moves:
- Neutral supply centers: High priority
- Enemy territories: Medium priority (if aggressive)
- Allied territories: Low priority (avoided)
- Plus randomness for unpredictability

### Bot Messages
Bots send contextual messages:
- Alliance proposals to trusted nations
- Threats to enemies
- Negotiations with neutrals
- Responses to player messages (40% chance)

## 🧪 Testing

### Manual Test Flow

1. **Create Test Game:**
```bash
# Open browser: http://localhost:3000
# Select 3 nations: Austria, England (Bot), France
# Set timer: 1 hour, midnight
# Create game
```

2. **Submit Orders:**
```bash
# Austria player: Open URL
# Click "Move" → Click A VIE → Click GAL
# Click "Submit Orders"
```

3. **Process Turn:**
```bash
# Wait for timer OR:
curl -X POST http://localhost:3000/api/game/abc123/process-turn
```

4. **Verify:**
- Check units moved
- Bot submitted orders
- Turn advanced
- Deadline updated

### Database Queries

**View all games:**
```sql
SELECT game_hash, started, turn_deadline, created_at
FROM games;
```

**View players in a game:**
```sql
SELECT nation, player_name, is_bot, last_seen
FROM players
WHERE game_hash = 'abc123';
```

**View messages:**
```sql
SELECT from_nation, to_nations, content, created_at
FROM messages
WHERE game_hash = 'abc123'
ORDER BY created_at;
```

**View turn history:**
```sql
SELECT turn_number, season, year, phase, processed_at
FROM turn_history
WHERE game_hash = 'abc123'
ORDER BY turn_number;
```

## 🚀 Production Deployment

### Heroku

```bash
# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate

# View logs
heroku logs --tail
```

### DigitalOcean / AWS / etc.

1. Set up PostgreSQL database
2. Set `DATABASE_URL` environment variable
3. Run `npm run migrate`
4. Start server with `npm start`
5. Use process manager (PM2, systemd)

### Production Checklist

- [ ] PostgreSQL database provisioned
- [ ] Environment variables set
- [ ] Migrations run
- [ ] HTTPS enabled
- [ ] Domain configured
- [ ] Turn scheduler running
- [ ] Backups configured
- [ ] Monitoring set up

## 🔒 Security Notes

- Player hashes are simple (8-char hex) - fine for friends
- For public deployment, add:
  - Player authentication
  - Rate limiting
  - Input validation
  - CSRF protection
  - SQL injection prevention (using parameterized queries ✓)

## 📝 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED
```

**Fix:**
```bash
# Check PostgreSQL is running:
pg_isready

# Start if not running:
brew services start postgresql@15  # Mac
sudo systemctl start postgresql    # Linux
```

### Migration Fails
```
ERROR: relation "games" already exists
```

**Fix:**
```bash
# Drop and recreate database:
dropdb statecraft
createdb statecraft
npm run migrate
```

### Turn Scheduler Not Working
```
Turns not processing automatically
```

**Check:**
1. Server is running
2. Game has `started = true`
3. `turn_deadline` is in past
4. Check server logs for errors

### Bot Not Responding
```
Bot players not submitting orders
```

**Check:**
1. Player marked as `is_bot = true` in database
2. Bot state exists in `bot_states` table
3. Check server logs during turn processing

## 📚 Additional Resources

- [Original README](README.md) - V1.0 features
- [Database Schema](database/schema.sql) - Complete schema
- [Migration Script](database/migrate.js) - Setup script

## 🎯 Roadmap

### Implemented ✅
- [x] PostgreSQL persistence
- [x] Support/Convoy orders
- [x] Automatic turn timer
- [x] Turn history tracking
- [x] Bot state persistence

### Planned
- [ ] Email notifications for turn deadlines
- [ ] Build/Retreat phases UI
- [ ] Game spectator mode
- [ ] Player statistics dashboard
- [ ] Tournament bracket system
- [ ] Mobile-responsive improvements
- [ ] WebSocket real-time updates
- [ ] Game replay viewer

## 💡 Tips

**For Fast Testing:**
- Set turn duration to 1 hour
- Use mostly bot players
- Process turns manually with API

**For Realistic Games:**
- Use 24-48 hour turns
- Process at consistent time (midnight)
- Mix human and bot players

**For Tournaments:**
- Create multiple games
- Track via `turn_history` table
- Export results to CSV

---

**Have fun conquering Europe! 🏰**

Remember: In Diplomacy, diplomacy is optional. 😉
