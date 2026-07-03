# Statecraft - Web-Based Diplomacy Game

A multiplayer web version of the classic Diplomacy board game with intelligent bot players. Players access the game via unique URLs and can message each other in real-time.

## Features

- 🌐 **Web-Based** - Play in your browser, no installation required
- 🔗 **Unique URLs** - Each player gets a secure link (e.g., `statecraft.com/abc123?p=xyz789`)
- 💬 **In-Game Messaging** - Chat with other players during the game
- 🤖 **Smart Bot Players** - Bots with trust systems and probabilistic decision-making
- 🎮 **Interactive Board** - Click-to-move interface with visual feedback
- 📊 **Real-Time Updates** - Auto-refreshing game state every 5 seconds

## Quick Start

### 1. Install Dependencies

```bash
cd web-server
npm install
```

### 2. Start Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 3. Create a Game

1. Open http://localhost:3000 in your browser
2. Select nations to include in the game
3. Configure player names (check "Bot" for AI players)
4. Click "Create Game"
5. Share the generated URLs with your friends!

Each player gets a unique URL like:
```
http://localhost:3000/game/a1b2c3?p=x7y8z9
```

### 4. Play!

- View the game board
- Click your units to select them
- Click destination to create move orders
- Chat with other players
- Submit orders when ready

## Game Setup Example

### Creating a 7-Player Game with 3 Bots

1. **Select Nations:**
   - ✅ Austria
   - ✅ England (Bot)
   - ✅ France
   - ✅ Germany (Bot)
   - ✅ Italy
   - ✅ Russia (Bot)
   - ✅ Turkey

2. **Player Names:**
   - Austria: "Alice"
   - England: "England Bot" ✓
   - France: "Bob"
   - Germany: "Germany Bot" ✓
   - Italy: "Charlie"
   - Russia: "Russia Bot" ✓
   - Turkey: "Diana"

3. **Generated URLs:**
   ```
   Alice (Austria):   http://localhost:3000/game/a1b2c3?p=abc123
   Bob (France):      http://localhost:3000/game/a1b2c3?p=def456
   Charlie (Italy):   http://localhost:3000/game/a1b2c3?p=ghi789
   Diana (Turkey):    http://localhost:3000/game/a1b2c3?p=jkl012
   ```

Bot players don't need URLs - they play automatically!

## Bot AI Features

### Trust System

Bots track trust values for each player (-1 to +1):
- **+1**: Complete trust, strong ally
- **0**: Neutral
- **-1**: Complete distrust, enemy

Trust is affected by:
- Relative strength (supply center count)
- Proximity of units
- Message tone (positive vs. negative words)
- Historical interactions

### Personality Traits

Each bot has randomized personality:
- **Aggression** (0.3-0.7): How likely to attack
- **Trustingness** (0.2-0.8): How easily they form alliances
- **Chattiness** (0.2-0.8): How often they send messages
- **Deception** (0.0-0.5): Willingness to break promises
- **Loyalty** (0.3-0.8): How long they keep alliances

### Message Types

Bots send various messages based on game state:

**Alliance Proposals:**
```
"France, I propose we form an alliance. Together we can dominate this game!"
```

**Threats:**
```
"Germany, you better watch your borders. I'm coming for you."
```

**Negotiations:**
```
"England, I won't attack you if you don't attack me. Deal?"
```

**Boasts** (when winning):
```
"My empire is growing nicely. Who wants to be on the winning side?"
```

**Pleas** (when losing):
```
"I need allies or I'm done for!"
```

### Probabilistic Decision Making

Bots don't always make the "optimal" move - they use weighted probabilities:

**Move Weight Factors:**
- Supply center value: +3.0 for neutral, +2.0 for enemy
- Unit conflicts: +1.5 vs enemies, -1.5 vs allies
- Expansion bonus: +1.0 for new territories
- Randomness: ±0.5 for unpredictability

This creates realistic, human-like behavior!

## Messaging System

### Sending Messages

1. Select recipient from dropdown (or "Everyone")
2. Type your message
3. Click "Send" or press Enter

### Bot Responses

Bots may respond to your messages:
- 40% chance to respond to direct messages
- Response delay: 2-5 seconds (realistic!)
- Response depends on trust level and message content

**Example Interaction:**
```
You → Russia: "Want to ally against Germany?"
Russia → You: "Yes! Let's work together." (if trust > 0.3)
or
Russia → You: "I'll have to pass on that." (if trust < 0.3)
```

## API Reference

### Create Game

```http
POST /api/game/create
Content-Type: application/json

{
  "nations": ["AUSTRIA", "ENGLAND", "FRANCE"],
  "playerNames": ["Alice", "England Bot", "Bob"],
  "botNations": ["ENGLAND"]
}
```

**Response:**
```json
{
  "success": true,
  "gameHash": "a1b2c3",
  "playerUrls": [
    {
      "nation": "AUSTRIA",
      "playerName": "Alice",
      "isBot": false,
      "url": "/game/a1b2c3?p=abc123"
    },
    ...
  ]
}
```

### Get Game State

```http
GET /api/game/:gameHash/state?p=:playerHash
```

**Response:**
```json
{
  "success": true,
  "game": {
    "gameHash": "a1b2c3",
    "season": "Spring",
    "year": 1901,
    "phase": "Movement"
  },
  "player": {
    "nation": "AUSTRIA",
    "units": [...],
    "supplyCenters": 3
  },
  "players": [...],
  "messages": [...],
  "allUnits": [...],
  "supplyCenters": {...}
}
```

### Submit Orders

```http
POST /api/game/:gameHash/orders?p=:playerHash
Content-Type: application/json

{
  "orders": [
    {
      "unitId": "AUSTRIA-vie-...",
      "type": "army",
      "orderType": "move",
      "from": "vie",
      "to": "gal"
    }
  ]
}
```

### Send Message

```http
POST /api/game/:gameHash/message?p=:playerHash
Content-Type: application/json

{
  "to": "all",  // or ["ENGLAND", "FRANCE"]
  "content": "Good luck everyone!"
}
```

### Process Turn

```http
POST /api/game/:gameHash/process-turn
```

Resolves all orders, updates game state, and advances to next turn.

### Start Game

```http
POST /api/game/:gameHash/start
```

Starts the game and activates bot players.

## File Structure

```
web-server/
├── server.js               # Main Express server
├── enhancedBot.js         # Bot AI with trust system
├── package.json           # Dependencies
├── README.md             # This file
└── public/
    ├── index.html        # Game creation page
    ├── game.html         # Main game interface
    ├── css/
    │   └── style.css     # All styles
    └── js/
        ├── create-game.js    # Game creation logic
        ├── game-client.js    # Game page logic
        └── renderer.js       # Canvas board rendering
```

## Game Flow

```
1. Host creates game via web interface
   ↓
2. Host shares unique URLs with players
   ↓
3. Players open their URLs
   ↓
4. Host clicks "Start Game"
   ↓
5. Bots send initial messages
   ↓
6. Players/bots submit orders
   ↓
7. Host processes turn (or automated)
   ↓
8. New turn begins → repeat from step 5
   ↓
9. Game ends when someone reaches 18 supply centers
```

## Order Submission

### Via UI

1. Click on your unit
2. Click on destination province
3. Order appears in "Your Orders" panel
4. Click "Submit Orders" when ready

### Order Types

Currently supported:
- **Move**: Unit moves to adjacent province
- **Hold**: Unit stays in place

Coming soon:
- **Support**: Support another unit's move
- **Convoy**: Transport army via fleet

## Customization

### Adjusting Bot Difficulty

Edit `enhancedBot.js`:

```javascript
// Make bots more aggressive
this.personality = {
    aggression: 0.7 + Math.random() * 0.3,  // 0.7-1.0 instead of 0.3-0.7
    ...
};
```

### Changing Update Frequency

Edit `game-client.js`:

```javascript
// Update every 3 seconds instead of 5
updateInterval = setInterval(loadGameState, 3000);
```

### Custom Messages

Edit `enhancedBot.js` message generation functions:

```javascript
generateBoast() {
    const messages = [
        "I'm dominating this game!",  // Add your own
        ...
    ];
    ...
}
```

## Troubleshooting

### Game Board Not Rendering

- Check browser console for errors
- Ensure `/api/game-data` endpoint is accessible
- Verify PROVINCES data loaded correctly

### Bots Not Responding

- Check that nations are marked as `isBot: true`
- Verify `enhancedBot.js` is loaded
- Check server logs for errors

### Orders Not Submitting

- Ensure player hash is valid
- Check network tab for failed requests
- Verify orders array is formatted correctly

## Production Deployment

### Recommended Setup

1. **Hosting**: Heroku, AWS, DigitalOcean, etc.
2. **Database**: PostgreSQL for persistent storage
3. **Redis**: For session management
4. **HTTPS**: SSL certificate (Let's Encrypt)
5. **Domain**: Custom domain name

### Environment Variables

```bash
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...
SESSION_SECRET=your_secret_here
```

### Database Migration

Replace in-memory Maps with database tables:

```sql
CREATE TABLE games (
  game_hash VARCHAR(8) PRIMARY KEY,
  game_state JSONB,
  created_at TIMESTAMP,
  ...
);

CREATE TABLE players (
  player_hash VARCHAR(8) PRIMARY KEY,
  game_hash VARCHAR(8) REFERENCES games(game_hash),
  nation VARCHAR(20),
  ...
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  game_hash VARCHAR(8) REFERENCES games(game_hash),
  from_nation VARCHAR(20),
  to_nations JSONB,
  content TEXT,
  timestamp TIMESTAMP,
  ...
);
```

## Roadmap

### Planned Features

- [ ] Automated turn timers
- [ ] Support and Convoy orders via UI
- [ ] Build/Retreat phases
- [ ] Game history and replay
- [ ] Player statistics
- [ ] Tournament mode
- [ ] Spectator mode
- [ ] Mobile-responsive design improvements

### Advanced Bot Features

- [ ] Learn from past games
- [ ] Adapt to player strategies
- [ ] Multi-turn planning
- [ ] Complex negotiation logic

## Comparison: SMS vs Web

| Feature | SMS Server | Web Server |
|---------|-----------|------------|
| Access | Text messages | Browser |
| Setup | Twilio account | None |
| Cost | ~$3.50/game | Free |
| UI | Text-based | Visual board |
| Bots | Not implemented | Fully featured |
| Messaging | SMS | In-game chat |
| Best For | Mobile-only players | Desktop/friends |

## License

MIT

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For questions or issues:
- Check the troubleshooting section
- Review server logs
- Open an issue on GitHub

---

**Have fun playing Diplomacy!** 🎮

Remember: In Diplomacy, there are no permanent friends, only permanent interests. 😉
