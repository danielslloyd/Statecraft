# CLAUDE.md - AI Assistant Guide for Statecraft

## Project Overview

**Statecraft** is a browser-based clone of the classic board game Diplomacy, built with vanilla JavaScript, HTML5 Canvas, and CSS3. The game simulates pre-World War I European diplomacy with 7 great powers competing for control through military strategy and diplomatic negotiation.

### Key Technologies
- **HTML5 Canvas** for game rendering
- **Vanilla JavaScript** (ES6+) for game logic
- **CSS3** for UI styling
- **localStorage** for custom map storage
- **No build tools or external dependencies**

### Repository Structure
```
Statecraft/
├── index.html          # Main HTML file with game UI structure
├── main.js             # Main game controller & event handling
├── gameLogic.js        # Core game logic, GameState, BotPlayer
├── gameData.js         # Game data (nations, provinces, adjacencies)
├── renderer.js         # Canvas rendering engine
├── styles.css          # UI styling
├── README.md           # User-facing documentation
├── MAP_FORMAT.md       # Map format specification
└── CLAUDE.md           # This file (AI assistant guide)
```

## Architecture & Design Patterns

### Core Classes

#### 1. **GameState** (`gameLogic.js`)
- **Purpose**: Manages entire game state
- **Key Properties**:
  - `units[]` - All units on the board
  - `orders[]` - Current turn orders
  - `year`, `season`, `phase` - Turn tracking
  - `supplyCenters{}` - Supply center ownership
  - `messages[]` - Diplomatic messages
- **Key Methods**:
  - `initializeGame()` - Set up initial state
  - `addOrder(order)` - Add/replace unit order
  - `resolveOrders()` - Execute turn resolution
  - `advanceTurn()` - Progress to next phase/season
  - `saveToJSON()` / `loadFromJSON()` - Serialization
  - `createMessage()` / `replyToMessage()` - Diplomacy system

#### 2. **BotPlayer** (`gameLogic.js`)
- **Purpose**: AI player for diplomatic messages
- **Key Methods**:
  - `generateDiplomaticMessage()` - Create alliance/action proposals
  - `proposeAlliance(targetNation)` - Propose alliance
  - `proposeAction(targetNation)` - Propose coordinated moves
  - `evaluateMessage(message)` - Respond to diplomatic messages

#### 3. **Renderer** (`renderer.js`)
- **Purpose**: Handle all canvas drawing
- **Key Methods**:
  - `render()` - Main render loop
  - `drawMap()` - Draw provinces and connections
  - `drawUnits()` - Render army/fleet units
  - `drawOrders()` - Visualize move/support arrows
  - `getProvinceAtPosition(x, y)` - Hit detection

### Data Structures

#### Nations (`gameData.js`)
```javascript
const NATIONS = {
    AUSTRIA: { name, shortName, color, textColor },
    ENGLAND: { ... },
    // ... 7 nations total
}
```

#### Provinces (`gameData.js`)
```javascript
const PROVINCES = {
    'vie': {
        name: 'Vienna',
        x: 580, y: 500,           // Canvas coordinates
        supply: true,              // Is supply center?
        owner: 'AUSTRIA',          // Initial owner (if supply center)
        coast: false,              // Can fleets access?
        sea: false,                // Is sea province?
        coasts: ['nc', 'sc']       // Optional: split coasts
    }
    // ... 75+ provinces
}
```

#### Adjacencies (`gameData.js`)
Graph structure defining legal moves:
```javascript
const ADJACENCIES = {
    'vie': ['boh', 'gal', 'bud', 'tri', 'tyr'],
    // ... defines all connections
}
```

#### Orders
Order objects follow these patterns:
```javascript
// Move order
{ type: 'move', unit: {...}, from: 'vie', to: 'bud' }

// Hold order
{ type: 'hold', unit: {...}, from: 'vie' }

// Support order
{ type: 'support', unit: {...}, from: 'tyr', supportFrom: 'vie', supportTo: 'bud' }
```

## Code Conventions & Standards

### JavaScript Style
- **ES6+ syntax**: Use `const`/`let`, arrow functions, classes
- **No semicolons**: Code omits semicolons (follow existing style)
- **Naming conventions**:
  - `SCREAMING_SNAKE_CASE` for constants (e.g., `NATIONS`, `UNIT_TYPES`)
  - `camelCase` for variables and functions (e.g., `gameState`, `updateUI`)
  - `PascalCase` for classes (e.g., `GameState`, `BotPlayer`)
- **String quotes**: Prefer single quotes `'` over double quotes `"`
- **Object properties**: Use concise property syntax when possible

### HTML/CSS Conventions
- **IDs for unique elements**: `#game-board`, `#current-turn`
- **Classes for reusable styles**: `.panel`, `.order-btn`, `.nation-item`
- **BEM-like naming**: `.order-btn.active`, `.action-btn.primary`
- **Color scheme**:
  - Background: `#1a1a2e` (dark blue)
  - Panels: `#16213e` (medium blue)
  - Accent: `#e94560` (red/pink)
  - Borders: `#0f3460` (dark blue)

### Canvas Rendering
- **Coordinate system**: 1200×900 canvas
- **Province radius**: 20px circles
- **Unit shapes**:
  - Armies = 24×24px squares with "A"
  - Fleets = triangles with "F"
- **Order visualization**:
  - Move = red dashed arrow
  - Hold = green dashed circle
  - Support = blue dashed line

### State Management
- **Single source of truth**: Global `gameState` variable
- **Immutability**: Avoid - state is mutated directly
- **UI updates**: Call `updateUI()` and `renderer.render()` after state changes
- **Event flow**: User action → State mutation → UI update

## Development Workflows

### Testing Changes Locally
1. Open `index.html` in a web browser
2. No build step required
3. Hard refresh (Ctrl+Shift+R) to clear cache
4. Check browser console for errors

### Adding New Features

#### Adding a New Order Type
1. Update `ORDER_TYPES` constant in `gameLogic.js`
2. Add button in `index.html` right panel
3. Add event listener in `setupEventListeners()` (main.js)
4. Implement order logic in `createOrder()` (main.js)
5. Add resolution logic in `resolveOrders()` (gameLogic.js)
6. Add rendering in `drawOrder()` (renderer.js)

#### Adding a New Nation
1. Add entry to `NATIONS` in `gameData.js`
2. Define home supply centers
3. Add to `STARTING_POSITIONS`
4. Ensure all provinces have correct `owner` field
5. Test balance (nations should have 3-4 units each)

#### Adding a New Province
1. Add entry to `PROVINCES` with coordinates
2. Update `ADJACENCIES` for this province and neighbors
3. Test rendering and click detection
4. Verify movement validation works
5. Update supply center count if needed

### Map Creation Workflow
See `MAP_FORMAT.md` for detailed specification. Quick overview:
1. Design layout and assign coordinates
2. Define provinces with properties
3. Create adjacency graph
4. Set up nations and starting positions
5. Save to localStorage: `localStorage.setItem('statecraft_map_Name', JSON.stringify(mapData))`
6. Load via map selector dropdown

### Debugging Tips

#### Common Issues
- **Units not rendering**: Check `gameState.units` array
- **Orders not working**: Verify `ADJACENCIES` includes both directions
- **Click detection off**: Ensure canvas coordinates account for `getBoundingClientRect()`
- **State not persisting**: Check localStorage quota and JSON serialization
- **Rendering glitches**: Call `renderer.render()` after state changes

#### Console Commands
```javascript
// Inspect game state
console.log(gameState)

// View all units
console.log(gameState.units)

// Check supply counts
Object.keys(NATIONS).forEach(n =>
  console.log(n, gameState.getSupplyCount(n))
)

// Save current state
console.log(JSON.stringify(gameState.saveToJSON(), null, 2))

// Add a unit manually
gameState.units.push({
  id: 'test-123',
  nation: 'AUSTRIA',
  province: 'vie',
  type: 'army'
})
renderer.render()
```

## Key Subsystems

### Order Resolution System
Located in `gameLogic.js` → `GameState.resolveOrders()`

**Algorithm** (simplified Diplomacy rules):
1. Calculate support strengths for each move
2. Resolve contested moves (highest strength wins)
3. Check holding units (require >1 strength to dislodge)
4. Execute successful moves
5. Return results object with moves/bounces/holds

**Limitations** (vs. full Diplomacy):
- Simplified retreat handling (skipped)
- No convoy pathfinding yet
- Basic support mechanics (doesn't handle all edge cases)
- No bounce prevention for swapping units

### Messaging/Diplomacy System
Located in `gameLogic.js` → `GameState` methods

**Message Structure**:
```javascript
{
  id: 1,
  from: 'AUSTRIA',
  to: 'GERMANY',
  type: 'alliance' | 'action_proposal',
  proposals: [{
    text: "Let's coordinate...",
    actions: [
      { nation: 'AUSTRIA', action: 'Move A VIE to BUD' },
      { nation: 'GERMANY', action: 'Support...' }
    ]
  }],
  status: 'pending' | 'accepted' | 'rejected' | 'countered',
  timestamp: 'Spring 1901',
  replies: []
}
```

**Workflow**:
1. `createMessage()` → Creates new message
2. `replyToMessage()` → Accept/reject/counter
3. UI displays in messages panel
4. Bot players auto-respond 50% of the time

### Save/Load System

**Save Process** (`main.js` → `saveGame()`):
1. Call `gameState.saveToJSON()` → serializes state
2. Create Blob with JSON data
3. Trigger browser download with filename pattern: `statecraft_save_Spring_1901.json`

**Load Process** (`main.js` → `loadGame()`):
1. File picker dialog
2. Read file as text
3. Parse JSON
4. Call `gameState.loadFromJSON(data)`
5. Update UI and re-render

**Saved Data Includes**:
- All units and positions
- Current orders
- Turn/season/phase
- Supply center ownership
- Diplomatic messages
- Timestamp

## Extending the Game

### Adding AI Improvements
Current bot logic in `BotPlayer` is random. To improve:

1. **Strategic evaluation**:
   - Analyze supply center proximity
   - Identify threats (adjacent enemy units)
   - Prioritize expansion paths

2. **Diplomatic reasoning**:
   - Track alliances and betrayals
   - Evaluate proposal value
   - Generate context-aware messages

3. **Order generation**:
   - Current: manual UI input only
   - Future: `BotPlayer.generateOrders()` method
   - Use minimax or Monte Carlo tree search

### Adding Multiplayer
Current: Single-player with bot messaging

To add multiplayer:
1. **Backend**: Set up WebSocket server (Node.js + Socket.io)
2. **Lobby system**: Room creation and player matching
3. **Turn synchronization**: Broadcast orders when all players submit
4. **State sync**: Server as authoritative game state
5. **Reconnection**: Save session state in backend

### Adding Animations
Current: Instant state updates

To animate:
1. Add transition states to GameState
2. Implement tweening in Renderer
3. Animate unit movement along paths
4. Animate order arrows appearing
5. Add victory celebration effects

### Performance Optimization
Current performance is good for standard gameplay. For larger maps:

1. **Rendering**:
   - Use dirty rectangle rendering
   - Only redraw changed regions
   - Implement spatial indexing for hit detection

2. **Order resolution**:
   - Current O(n²) for conflict detection
   - Optimize with adjacency lookups
   - Cache reachability calculations

3. **Canvas optimization**:
   - Use offscreen canvas for static elements
   - Layer rendering (map → orders → units)
   - RequestAnimationFrame for smooth updates

## Common Tasks for AI Assistants

### When asked to add a feature:
1. Identify affected files (usually multiple)
2. Update data structures first (`gameData.js`)
3. Add logic (`gameLogic.js`)
4. Add UI/rendering (`main.js`, `renderer.js`, `index.html`, `styles.css`)
5. Test in browser
6. Update README.md if user-facing

### When asked to fix a bug:
1. Reproduce the issue
2. Check console for errors
3. Verify state consistency (`console.log(gameState)`)
4. Check order resolution logic for edge cases
5. Verify adjacency graph correctness
6. Test fix with multiple scenarios

### When asked to refactor:
1. Maintain existing patterns (no frameworks)
2. Keep vanilla JS approach
3. Preserve global state architecture
4. Don't introduce build tools unless explicitly requested
5. Update this CLAUDE.md if architecture changes

### When asked about game rules:
- Refer to official Diplomacy rules
- Note current implementation limitations
- Explain simplifications in order resolution
- Point to `gameLogic.js` for actual behavior

## Testing Checklist

Before committing changes:
- [ ] Code follows existing style conventions
- [ ] No console errors in browser
- [ ] All 7 nations render correctly
- [ ] Order submission works (move, hold, support)
- [ ] Order resolution produces correct results
- [ ] Turn advancement works (Spring → Fall → Build → Spring)
- [ ] Supply center capture updates correctly
- [ ] Victory condition triggers at 18 supply centers
- [ ] Save/load preserves game state
- [ ] UI updates reflect state changes
- [ ] Canvas rendering has no visual glitches
- [ ] Click detection works for all provinces
- [ ] Mobile responsive (if applicable)

## Important Notes for AI Assistants

### What NOT to do:
- Don't add npm/build tools unless explicitly requested
- Don't refactor to use React/Vue/Angular
- Don't change global state architecture without discussion
- Don't remove features without user confirmation
- Don't add external dependencies (keep it vanilla)
- Don't break backward compatibility with save files

### What TO do:
- Follow existing code style rigorously
- Test changes in actual browser
- Update documentation when adding features
- Explain trade-offs and limitations
- Preserve game rule accuracy
- Keep performance in mind
- Maintain accessibility where possible

### Git Workflow:
- Work on feature branches (pattern: `claude/<description>-<session-id>`)
- Commit messages should be descriptive: "Add convoy order type" not "Update gameLogic.js"
- Push to designated branch only
- Create PRs when features are complete

### Communication Style:
- Explain what you're changing and why
- Note any limitations or edge cases
- Provide testing instructions
- Link to relevant line numbers: `gameLogic.js:123`
- Warn about breaking changes

## Resources

### External References
- [Official Diplomacy Rules](https://www.wizards.com/avalonhill/rules/diplomacy.pdf)
- [HTML5 Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Diplomacy Strategy Guides](http://www.diplom.org/Zine/) - for AI improvements

### Internal Documentation
- `README.md` - User guide and features
- `MAP_FORMAT.md` - Custom map specification
- Code comments in each `.js` file

## Version History

- **v1.0** (Initial release)
  - Core Diplomacy gameplay
  - 7 nations, classic map
  - Order system (move, hold, support, convoy)
  - Turn-based resolution
  - Basic bot diplomacy
  - Save/load functionality
  - Map loading system

---

**Last Updated**: 2025-11-16
**Maintainer**: AI Assistant
**Project Type**: Educational/Recreational
**License**: MIT
