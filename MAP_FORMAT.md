# Statecraft Map Format Specification

## Overview

Maps in Statecraft are defined using a JSON format that describes the provinces, connections, starting positions, and factions. This document specifies the structure for creating custom maps.

## Map JSON Structure

```json
{
  "metadata": {
    "name": "Map Name",
    "description": "Brief description of the map",
    "version": "1.0",
    "author": "Map Creator",
    "victoryCondition": 18
  },
  "provinces": {
    "PROVINCE_CODE": {
      "x": 100,
      "y": 100,
      "name": "Province Name",
      "supply": true,
      "owner": "Nation",
      "coast": true,
      "sea": false,
      "coasts": ["nc", "sc"]
    }
  },
  "adjacencies": {
    "PROVINCE_CODE": ["ADJ1", "ADJ2", "ADJ3"]
  },
  "nations": {
    "Nation": {
      "color": "#FF0000",
      "homeSupplyCenters": ["PRO1", "PRO2"]
    }
  },
  "startingPositions": {
    "Nation": [
      {"province": "PRO1", "type": "army"},
      {"province": "PRO2", "type": "fleet"}
    ]
  },
  "svg": {
    "width": 1200,
    "height": 900,
    "backgroundImage": "optional_url_to_background.svg",
    "overlays": []
  }
}
```

## Field Definitions

### Metadata

- **name** (string, required): Display name of the map
- **description** (string, optional): Brief description
- **version** (string, optional): Version number
- **author** (string, optional): Map creator
- **victoryCondition** (number, required): Number of supply centers needed to win

### Provinces

Each province is keyed by a unique code (typically 3 letters, all caps).

#### Province Fields

- **x** (number, required): X coordinate on canvas (0-1200)
- **y** (number, required): Y coordinate on canvas (0-900)
- **name** (string, required): Full display name
- **supply** (boolean, required): Whether this is a supply center
- **owner** (string, optional): Initial owning nation (if supply center)
- **coast** (boolean, required): Whether coastal (fleets can access)
- **sea** (boolean, required): Whether this is a sea province (fleets only)
- **coasts** (array, optional): For split-coast provinces (e.g., ["nc", "sc", "ec"] for north/south/east coast)

#### Province Types

1. **Inland provinces**: `coast: false, sea: false` (armies only)
2. **Coastal provinces**: `coast: true, sea: false` (armies and fleets)
3. **Sea provinces**: `coast: false, sea: true` (fleets only)
4. **Split-coast provinces**: `coast: true, coasts: ["nc", "sc"]` (fleets can access multiple coasts)

### Adjacencies

Maps province codes to arrays of adjacent province codes. Units can move between adjacent provinces if:
- Armies can move between any non-sea adjacent provinces
- Fleets can move between any coastal or sea adjacent provinces

For split-coast provinces, use notation like `"STP/NC"` to specify coast.

### Nations

Defines the playable factions.

- **color** (string, required): Hex color code for rendering
- **homeSupplyCenters** (array, required): List of starting supply center codes

### Starting Positions

Defines initial unit placements for each nation.

- **province** (string, required): Province code where unit starts
- **type** (string, required): "army" or "fleet"

For split-coast provinces, use format: `"province": "STP/SC"`

### SVG (Optional)

Defines visual rendering properties.

- **width** (number): Canvas width (default: 1200)
- **height** (number): Canvas height (default: 900)
- **backgroundImage** (string, optional): URL to SVG background image
- **overlays** (array, optional): Additional SVG elements to render

## Example: Classic Diplomacy Map

See `gameData.js` for the default implementation, which includes:
- 56 provinces (34 land, 2 inland seas, 19 sea regions)
- 7 nations (Austria, England, France, Germany, Italy, Russia, Turkey)
- 34 supply centers (7 nations × ~3-4 + 11 neutral)
- Victory at 18 supply centers

## Creating Custom Maps

### Steps to Create a New Map

1. **Design the layout**: Plan provinces and their positions
2. **Create province definitions**: Define all provinces with coordinates
3. **Define adjacencies**: Map out which provinces connect
4. **Set up nations**: Define factions with colors and home centers
5. **Place starting units**: Define initial unit positions
6. **Test balance**: Ensure no nation has unfair advantage
7. **Save as JSON**: Export to JSON format
8. **Load in game**: Use map dropdown to select

### Map Storage

Maps are stored in browser `localStorage` with key format:
- `statecraft_map_<mapName>`

To save a custom map, use the browser console:
```javascript
localStorage.setItem('statecraft_map_MyMap', JSON.stringify(mapData));
```

## Graph Structure

The adjacency graph forms the core of movement validation:
- **Nodes**: Provinces
- **Edges**: Legal movement paths
- **Weights**: All edges have equal weight (distance 1)
- **Properties**: Edge traversal restricted by unit type

### Pathfinding

For convoy moves, the game calculates paths through the graph:
1. Start province → Fleet chain → Destination province
2. Each fleet in chain must form continuous water path
3. Army can only start and end on coastal provinces

## Validation Rules

When loading a map, the game validates:

1. **Province integrity**:
   - All provinces have x, y coordinates within bounds
   - All supply centers have valid owner or null
   - Coast/sea flags are mutually exclusive

2. **Adjacency consistency**:
   - All adjacencies are bidirectional
   - Referenced provinces exist
   - Split-coast references are valid

3. **Nation setup**:
   - All nations have at least one supply center
   - All home supply centers exist
   - Starting positions reference valid provinces

4. **Balance checks** (warnings only):
   - Nations have similar supply center counts
   - Nations have similar starting unit counts
   - Victory condition is reasonable (typically 50-60% of total)

## Future Extensions

Potential additions to map format:

- **Terrain types**: Mountains, forests affecting movement
- **Special rules**: Canals, straits with restrictions
- **Seasonal variations**: Provinces accessible only in certain seasons
- **Victory regions**: Alternative win conditions beyond supply centers
- **Custom phases**: Different turn structures
- **Fog of war**: Limited visibility areas

## Version History

- **1.0**: Initial format specification with classic Diplomacy support
