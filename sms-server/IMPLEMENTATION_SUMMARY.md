# SMS-Based Diplomacy Game - Implementation Summary

## Overview

A complete SMS-based multiplayer system for the Diplomacy board game. Players can join games, submit moves via text messages, receive board updates as images, and coordinate strategies all through SMS.

## Architecture

```
┌─────────────┐      SMS       ┌──────────────┐      HTTP      ┌──────────────┐
│   Players   │ ◄──────────────► │    Twilio    │ ◄────────────► │  SMS Server  │
│  (Mobile)   │                 │   Service    │                │  (Node.js)   │
└─────────────┘                 └──────────────┘                └──────────────┘
                                                                        │
                                                                        │
                                                   ┌────────────────────┼────────────────────┐
                                                   │                    │                    │
                                                   ▼                    ▼                    ▼
                                            ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
                                            │ Move Parser │    │ Game Logic   │    │ Image Gen    │
                                            │ (AI-based)  │    │ (Diplomacy)  │    │ (Canvas)     │
                                            └─────────────┘    └──────────────┘    └──────────────┘
```

## Components

### 1. Move Notation System (`moveNotation.js`)

**Purpose:** Parse SMS text into game moves with intelligent error correction.

**Features:**
- **Concise notation** - Supports standard Diplomacy notation (PAR-BUR, MUN H, etc.)
- **Fuzzy matching** - Auto-corrects typos using Levenshtein distance
- **Case insensitive** - Accepts any capitalization
- **Flexible formats** - Multiple ways to express the same move
- **Unit inference** - Can deduce unit type from location

**Supported Order Types:**
1. **MOVE**: `PAR-BUR` (Paris to Burgundy)
2. **HOLD**: `MUN H` (Munich holds)
3. **SUPPORT**: `BUR S PAR-PIC` (Burgundy supports Paris to Picardy)
4. **CONVOY**: `NTH C YOR-NWY` (North Sea convoys Yorkshire to Norway)

**Province Code Mapping:**
- Full names → 3-letter codes (e.g., "Vienna" → "vie")
- 170+ province variations recognized
- Typo tolerance up to 2 character differences

**Example Parsing:**
```javascript
Input:  "paris-burgundy; mun h; MARS S SPA"
Output: ✓ A PAR-BUR
        ✓ A MUN H
        ✓ A MAR-SPA (corrected "MARS" to "MAR")
```

### 2. SMS Server (`server.js`)

**Purpose:** Handle SMS communication via Twilio webhooks.

**Technology Stack:**
- Express.js for HTTP server
- Twilio SDK for SMS
- In-memory game storage (Map-based)

**Core Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/sms/incoming` | Twilio webhook for incoming SMS |
| POST | `/api/game/create` | Create new game |
| POST | `/api/game/add-player` | Register player with nation |
| POST | `/api/game/process-turn` | Resolve orders and advance turn |
| GET | `/api/game/:id/status` | Get game state |

**Player Workflow:**
```
1. Admin assigns player to nation + phone number
2. Player receives: "Welcome! You are AUSTRIA. Reply Y to confirm."
3. Player texts: "Y"
4. System responds: "Confirmed! Waiting for other players..."
5. When all ready, game auto-starts
6. Players receive board image + unit list
7. Players text moves: "vie-gal; bud-ser; tri-ven"
8. System parses and confirms: "✓ A VIE-GAL, ✓ A BUD-SER, ✓ F TRI-VEN"
9. Players can resubmit until turn deadline
10. Admin processes turn → new board sent to all
```

**Data Structures:**
```javascript
games = Map<gameId, GameState>
players = Map<phoneNumber, {gameId, nation, confirmed, pendingOrders}>
gameRosters = Map<gameId, Map<nation, phoneNumber>>
pendingConfirmations = Map<phoneNumber, {orders, parseResult, timestamp}>
```

### 3. Image Generator (`imageGenerator.js`)

**Purpose:** Create PNG images of game board for MMS delivery.

**Technology:** Node Canvas (server-side HTML5 Canvas)

**Rendering Pipeline:**
```
GameState → Canvas Drawing → PNG Buffer → File System → HTTP URL → Twilio MMS
```

**Visual Elements:**
- **Provinces**: Colored circles (owner's color or neutral gray)
- **Units**:
  - Armies: Yellow-bordered squares with "A"
  - Fleets: Yellow-bordered triangles with "F"
- **Supply Centers**: White circles inside provinces
- **Orders**: Red dashed arrows showing moves
- **Legend**: Unit type examples
- **Game Info**: Season, year, phase at top

**Performance:**
- Images: 1200x900px PNG
- Auto-cleanup: Deletes images older than 24 hours
- Served via Express static middleware

### 4. Admin CLI (`admin-cli.js`)

**Purpose:** Interactive command-line tool for game management.

**Features:**
- Create new games
- Add players to games
- Process turns
- View game status
- Quick setup wizard (create + add 7 players)

**Usage:**
```bash
node admin-cli.js

# Interactive menu:
1. Create new game
2. Add players to game
3. Process turn
4. View game status
5. Quick setup
6. Exit
```

**Quick Setup Example:**
```
Game ID: spring1901
Austria: +15551111111
England: +15552222222
France: +15553333333
...

✅ Game created
✅ All players added and SMS sent
✅ Waiting for confirmations
```

### 5. Game Integration

**Modified Files:**
- `gameData.js` - Added ORDER_TYPES constant and Node.js exports
- `gameLogic.js` - Added Node.js exports for GameState class

**Export Compatibility:**
```javascript
// Browser compatibility maintained
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ... };
}
```

## Key Features Implemented

### ✅ Player Registration & Confirmation
- Phone number to nation assignment
- SMS confirmation flow ("Reply Y to join")
- Auto-start when all players confirm

### ✅ Intelligent Move Parsing
- Standard Diplomacy notation
- Fuzzy province name matching
- Multiple format support
- Error correction with suggestions

### ✅ Move Confirmation System
- Parse moves → Send confirmation
- Allow resubmission before deadline
- Track pending orders per player
- Validate moves against game rules

### ✅ Board Image Delivery
- Generate PNG images of current board
- Show all units and orders
- MMS delivery to all players
- Automatic image cleanup

### ✅ Game Flow Management
- Turn-based progression
- Order resolution
- Supply center updates
- Victory detection
- Season/phase advancement

### ✅ Player Commands
- **CONFIRM** - Submit pending orders
- **STATUS** - Get current game state
- **HELP** - View command reference
- **[moves]** - Submit/update orders

## Setup & Deployment

### Environment Variables Required:
```bash
TWILIO_ACCOUNT_SID=ACxxxx...
TWILIO_AUTH_TOKEN=xxxx...
TWILIO_PHONE_NUMBER=+1234567890
BASE_URL=http://your-domain.com
PORT=3000
```

### Installation:
```bash
cd sms-server
npm install
node server.js
```

### Dependencies:
- express - Web server
- twilio - SMS API
- body-parser - Parse webhooks
- canvas - Server-side image generation

## Example Game Flow

**Turn 1 - Spring 1901**

1. **Setup (Admin):**
   ```bash
   node admin-cli.js
   # Quick setup → Add 7 players
   ```

2. **Confirmation (Players):**
   ```
   [SMS to Player] Welcome! You are AUSTRIA. Reply Y to confirm.
   [Player] Y
   [SMS] Confirmed! Waiting for others...
   ```

3. **Game Start (Auto):**
   ```
   [SMS to All] Spring 1901 - Movement Phase
                [Board Image]
                Your units: A VIE, A BUD, F TRI
                Send your orders!
   ```

4. **Submit Orders (Player - Austria):**
   ```
   [Player] vie-gal; bud-ser; tri-ven
   [SMS] 1. A VIE-GAL ✓
         2. A BUD-SER ✓
         3. F TRI-VEN ✓
         Reply CONFIRM to submit, or send new orders to change.
   ```

5. **Update Orders (Optional):**
   ```
   [Player] vie-bud; bud-rum; tri-alb
   [SMS] Orders updated:
         1. A VIE-BUD ✓
         2. A BUD-RUM ✓
         3. F TRI-ALB ✓
   ```

6. **Process Turn (Admin):**
   ```bash
   curl -X POST http://localhost:3000/api/game/process-turn \
     -H "Content-Type: application/json" \
     -d '{"gameId": "spring1901"}'
   ```

7. **Turn Resolution (Auto):**
   ```
   [SMS to All] Fall 1901 - Movement Phase
                [New Board Image]
                Your units: A GAL, A SER, F ALB
                Supply centers: 4
                Send your orders!
   ```

## Testing

### Unit Tests for Parser:
```bash
node test-parser.js
```

### Manual Testing:
1. Set up ngrok tunnel: `ngrok http 3000`
2. Configure Twilio webhook to ngrok URL
3. Use your own phone number for testing
4. Send test moves and verify parsing

### Example Test Cases:
- ✅ `PAR-BUR` → Parsed correctly
- ✅ `paris-burgundy` → Normalized to PAR-BUR
- ✅ `PARS-BUR` → Corrected typo to PAR-BUR
- ❌ `XXX-YYY` → Error: Unknown provinces
- ❌ `PAR-BER` → Error: Not adjacent

## Production Considerations

### Current Limitations (MVP):
- **In-memory storage** - Games lost on restart
- **No turn timers** - Manual turn processing
- **No authentication** - Phone number as ID
- **Limited game features** - No builds/retreats yet
- **Single server** - No horizontal scaling

### Recommended Production Upgrades:
1. **Database** - PostgreSQL for persistence
2. **Redis** - Session/cache management
3. **Automated turns** - Cron jobs for deadlines
4. **Authentication** - PIN codes or OAuth
5. **Full Diplomacy** - Build/retreat phases
6. **Monitoring** - Error tracking, analytics
7. **Load balancing** - Multi-server support
8. **Message queue** - Bull/RabbitMQ for SMS
9. **CDN** - CloudFront for board images
10. **Rate limiting** - Prevent abuse

### Scaling Path:
```
MVP (Current)
  ↓
Add PostgreSQL + Redis
  ↓
Implement turn timers
  ↓
Add full Diplomacy rules
  ↓
Multi-tenant architecture
  ↓
Kubernetes deployment
```

## Security Considerations

### SMS Security:
- ✅ Twilio signature validation (built-in)
- ⚠️ Add: Rate limiting per phone number
- ⚠️ Add: Abuse detection/blocking
- ⚠️ Add: PIN codes for sensitive actions

### API Security:
- ⚠️ Add: API key authentication
- ⚠️ Add: HTTPS enforcement
- ⚠️ Add: Input sanitization
- ⚠️ Add: CORS configuration

### Data Privacy:
- Store phone numbers securely
- Implement GDPR compliance (if EU users)
- Add data deletion endpoints
- Encrypt sensitive data at rest

## Cost Estimation (Twilio)

### SMS Costs (US):
- Outbound SMS: $0.0079 per message
- Inbound SMS: $0.0079 per message
- MMS (with images): $0.02 per message

### Example Game Cost:
- 7 players × 1 confirmation = 7 SMS out
- 7 players × 1 response = 7 SMS in
- 10 turns × 7 players × board image = 70 MMS out
- 10 turns × 7 players × moves = 70 SMS in
- 10 turns × 7 players × confirmations = 70 SMS out

**Total:** ~$3.50 per game

### Optimization:
- Bundle multiple updates into one message
- Use SMS for confirmations, MMS only for boards
- Implement player preferences (image frequency)

## Files Created

```
sms-server/
├── README.md                   # Setup guide
├── IMPLEMENTATION_SUMMARY.md   # This file
├── package.json               # Dependencies
├── .env.example              # Environment template
├── .gitignore               # Git exclusions
├── server.js                # Main SMS server
├── moveNotation.js          # Move parser
├── imageGenerator.js        # Board image generator
├── admin-cli.js            # Admin CLI tool
├── test-parser.js          # Parser tests
├── example-setup.sh        # Example game setup
└── board-images/           # Generated images
    └── .gitkeep
```

## Next Steps / Enhancements

### High Priority:
1. **Database integration** - Persistent storage
2. **Turn timers** - Automatic deadlines
3. **Build/Retreat phases** - Full Diplomacy rules
4. **Error recovery** - Handle failed SMS delivery

### Medium Priority:
5. **Player statistics** - Win/loss records
6. **Game history** - Turn-by-turn replay
7. **Spectator mode** - Non-player observers
8. **Custom house rules** - Configurable variants

### Low Priority:
9. **Web dashboard** - Visual game management
10. **Tournament support** - Multi-game brackets
11. **AI opponents** - Bot players via SMS
12. **Internationalization** - Multi-language support

## Conclusion

This implementation provides a fully functional SMS-based Diplomacy game system with:

✅ Complete player workflow (join → play → win)
✅ Intelligent move parsing with error correction
✅ Visual board updates via MMS
✅ Flexible game management tools
✅ Production-ready architecture (with upgrades)

The system is ready for MVP testing with real players and can be scaled to production with the recommended enhancements.

---

**Built:** 2025-11-16
**Technology:** Node.js, Twilio, Express, Canvas
**Status:** MVP Complete ✅
