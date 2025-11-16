# Diplomacy SMS Game Server

Play Diplomacy via text messages! This server enables SMS-based gameplay where players submit moves via text and receive board updates as images.

## Features

- 📱 **SMS-based gameplay** - Players interact entirely via text messages
- 🎮 **Automatic move parsing** - Intelligent parser understands shorthand notation and corrects common mistakes
- 🖼️ **Visual board updates** - Players receive board images after each turn
- ✅ **Move confirmation** - System confirms interpreted moves before submission
- 🔄 **Resubmission allowed** - Players can update moves anytime before turn deadline
- 🤖 **Smart error correction** - Fuzzy matching handles typos in province names

## Prerequisites

1. **Node.js** (v14 or higher)
2. **Twilio Account** with:
   - Account SID
   - Auth Token
   - SMS-enabled phone number
3. **Public server** (for Twilio webhooks) - use ngrok for local development

## Setup Instructions

### 1. Install Dependencies

```bash
cd sms-server
npm install
```

### 2. Configure Twilio

1. Sign up for Twilio account at https://www.twilio.com
2. Get a phone number with SMS capabilities
3. Note your Account SID and Auth Token from the console

### 3. Set Environment Variables

Create a `.env` file in the `sms-server` directory:

```bash
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
BASE_URL=http://your-domain.com
PORT=3000
```

Or export them directly:

```bash
export TWILIO_ACCOUNT_SID=your_account_sid
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_PHONE_NUMBER=+1234567890
export BASE_URL=http://your-domain.com
```

### 4. Set Up Public Webhook (Development)

For local development, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3000
```

Note the ngrok URL (e.g., `https://abc123.ngrok.io`)

### 5. Configure Twilio Webhook

1. Go to Twilio Console → Phone Numbers → Your Number
2. Under "Messaging", set:
   - **A MESSAGE COMES IN**: Webhook
   - **URL**: `https://your-ngrok-url.ngrok.io/sms/incoming`
   - **HTTP**: POST

### 6. Start Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Setting Up a Game

### Create Game and Add Players

Use the API to set up a new game:

```bash
# Create a new game
curl -X POST http://localhost:3000/api/game/create \
  -H "Content-Type: application/json" \
  -d '{"gameId": "game1"}'

# Add players (one per nation)
curl -X POST http://localhost:3000/api/game/add-player \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+15551234567",
    "gameId": "game1",
    "nation": "AUSTRIA"
  }'

curl -X POST http://localhost:3000/api/game/add-player \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+15559876543",
    "gameId": "game1",
    "nation": "ENGLAND"
  }'

# Repeat for all 7 nations:
# AUSTRIA, ENGLAND, FRANCE, GERMANY, ITALY, RUSSIA, TURKEY
```

### Player Confirmation

1. Each player receives: "Welcome to Diplomacy SMS! You are assigned to play as AUSTRIA in game game1. Reply Y to confirm you're ready to play."
2. Players reply with "Y"
3. Once all players confirm, the game starts automatically
4. All players receive the initial board image and their starting units

## Move Notation Guide

### Basic Moves

**Format:** `[from]-[to]`

Examples:
- `PAR-BUR` - Move Paris to Burgundy
- `lon-nth` - Move London to North Sea (case insensitive)

### Hold

**Format:** `[province] H` or `HOLD [province]`

Examples:
- `MUN H` - Munich holds
- `HOLD VIE` - Vienna holds

### Support

**Format:** `[supporter] S [supported move]`

Examples:
- `BUR S PAR-PIC` - Burgundy supports Paris to Picardy
- `MAR S SPA` - Marseilles supports Spain to hold

### Convoy

**Format:** `[fleet] C [army movement]`

Examples:
- `NTH C YOR-NWY` - North Sea convoys Yorkshire to Norway
- `eng c wal-pic` - English Channel convoys Wales to Picardy

### Multiple Orders

Separate orders with semicolons or newlines:

```
PAR-BUR; MUN H; BUR S PAR-PIC
```

Or:
```
PAR-BUR
MUN H
BUR S PAR-PIC
```

## Player Commands

- **CONFIRM** - Submit pending orders
- **STATUS** or **S** - Get current game status
- **HELP** or **H** - Get help message

## Gameplay Flow

1. **Turn starts** - All players receive board image with their units
2. **Players submit orders** - Send moves via SMS
3. **System parses & confirms** - Players receive confirmation of interpreted moves
4. **Players can update** - Resubmit orders anytime before turn deadline
5. **Turn processes** - Game master triggers turn resolution via API
6. **Cycle repeats** - New board sent to all players

### Processing Turns

The game master manually triggers turn processing:

```bash
curl -X POST http://localhost:3000/api/game/process-turn \
  -H "Content-Type: application/json" \
  -d '{"gameId": "game1"}'
```

This will:
1. Resolve all submitted orders
2. Update supply center ownership
3. Advance to next season/phase
4. Send new board to all players

### Game Status

Check game status anytime:

```bash
curl http://localhost:3000/api/game/game1/status
```

Response:
```json
{
  "success": true,
  "game": {
    "id": "game1",
    "season": "Spring",
    "year": 1901,
    "phase": "Movement",
    "players": [
      {
        "nation": "AUSTRIA",
        "phone": "+15551234567",
        "confirmed": true,
        "units": 3,
        "supplyCenters": 3
      },
      ...
    ]
  }
}
```

## Province Codes

### Major Powers Starting Positions

- **Austria**: VIE (Vienna), BUD (Budapest), TRI (Trieste)
- **England**: LON (London), LVP (Liverpool), EDI (Edinburgh)
- **France**: PAR (Paris), MAR (Marseilles), BRE (Brest)
- **Germany**: BER (Berlin), MUN (Munich), KIE (Kiel)
- **Italy**: ROM (Rome), VEN (Venice), NAP (Naples)
- **Russia**: MOS (Moscow), SEV (Sevastopol), STP (St Petersburg), WAR (Warsaw)
- **Turkey**: CON (Constantinople), ANK (Ankara), SMY (Smyrna)

### Common Provinces

- **BUR** - Burgundy
- **PIC** - Picardy
- **GAS** - Gascony
- **BEL** - Belgium
- **HOL** - Holland
- **DEN** - Denmark
- **SWE** - Sweden
- **NWY** - Norway
- **SPA** - Spain
- **POR** - Portugal
- **TUN** - Tunis
- **NAF** - North Africa

### Seas

- **NTH** - North Sea
- **ENG** - English Channel
- **MAO** - Mid-Atlantic Ocean
- **BAL** - Baltic Sea
- **BAR** - Barents Sea
- **NWG** - Norwegian Sea
- **SKA** - Skagerrak
- **HEL** - Helgoland Bight
- **ADR** - Adriatic Sea
- **AEG** - Aegean Sea
- **BLA** - Black Sea
- **EAS** - Eastern Mediterranean
- **ION** - Ionian Sea
- **TYS** - Tyrrhenian Sea
- **WES** - Western Mediterranean
- **LYO** - Gulf of Lyon

## Intelligent Parsing Examples

The parser handles various formatting styles:

| Player Input | Parsed As | Notes |
|--------------|-----------|-------|
| `par-bur` | `A PAR-BUR` | Adds unit type |
| `Paris-Burgundy` | `A PAR-BUR` | Converts full names |
| `par bur` | `A PAR-BUR` | Accepts space instead of dash |
| `PARS-BUR` | `A PAR-BUR` | Corrects typo (fuzzy match) |
| `mun h` | `A MUN H` | Adds unit type to hold |
| `hold munich` | `A MUN H` | Alternate format |

## Error Handling

### Common Errors

**No unit at location:**
```
Player: "BOH-VIE"
Response: "ERROR: No unit found at boh"
```

**Illegal move:**
```
Player: "PAR-BER"
Response: "ERROR: Army cannot move from par to ber"
```

**Invalid province:**
```
Player: "XXX-YYY"
Response: "ERROR: Unknown province: XXX"
```

**Orders for wrong nation:**
```
Player (Austria): "PAR-BUR"
Response: "Could not parse any valid orders for your units."
```

## API Reference

### Create Game

```http
POST /api/game/create
Content-Type: application/json

{
  "gameId": "string (optional)"
}
```

### Add Player

```http
POST /api/game/add-player
Content-Type: application/json

{
  "phoneNumber": "+15551234567",
  "gameId": "game1",
  "nation": "AUSTRIA"
}
```

Nations: `AUSTRIA`, `ENGLAND`, `FRANCE`, `GERMANY`, `ITALY`, `RUSSIA`, `TURKEY`

### Process Turn

```http
POST /api/game/process-turn
Content-Type: application/json

{
  "gameId": "game1"
}
```

### Get Game Status

```http
GET /api/game/:gameId/status
```

## Troubleshooting

### Players Not Receiving Messages

1. Check Twilio account balance
2. Verify phone numbers are in E.164 format (+1234567890)
3. Check Twilio console for delivery logs

### Webhook Not Working

1. Verify ngrok is running
2. Check webhook URL in Twilio console
3. Test with: `curl http://your-url/health`

### Board Images Not Sending

1. Ensure `canvas` package is installed properly
2. Check `BASE_URL` environment variable
3. Verify `board-images` directory exists and is writable

### Parse Errors

1. Send `HELP` command to see format examples
2. Check province codes are valid
3. Ensure orders are for player's own units

## Production Deployment

### Recommended Setup

1. **Hosting**: Heroku, AWS, DigitalOcean, or similar
2. **Database**: Add PostgreSQL for persistent storage (replace Maps)
3. **File Storage**: Use S3 for board images
4. **Monitoring**: Add error tracking (Sentry, Rollbar)
5. **SSL**: Ensure HTTPS for webhook security

### Environment Variables for Production

```bash
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
BASE_URL=https://your-domain.com
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://... (if using database)
```

### Database Migration

Replace in-memory Maps with database:

```javascript
// games Map → games table
// players Map → players table
// gameRosters Map → game_rosters table
// pendingConfirmations Map → pending_orders table
```

## Advanced Features (Future Enhancements)

- [ ] Automatic turn timers (e.g., 24-hour deadlines)
- [ ] SMS-based diplomacy (secret messages between players)
- [ ] Game save/load functionality
- [ ] Multiple simultaneous games
- [ ] Turn history and replay
- [ ] Build/retreat phase support
- [ ] NMR (No Moves Received) handling
- [ ] Spectator mode

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Twilio logs
3. Check server logs for errors

## License

MIT
