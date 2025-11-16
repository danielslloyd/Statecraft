#!/bin/bash

# Example Game Setup Script
# This script demonstrates how to set up a test game via the API

API_BASE="${API_BASE:-http://localhost:3000}"
GAME_ID="test-game-$(date +%s)"

echo "=================================="
echo "Diplomacy SMS - Example Game Setup"
echo "=================================="
echo ""
echo "API Base: $API_BASE"
echo "Game ID: $GAME_ID"
echo ""

# Create game
echo "Creating game..."
curl -s -X POST "$API_BASE/api/game/create" \
  -H "Content-Type: application/json" \
  -d "{\"gameId\": \"$GAME_ID\"}" | jq '.'

echo ""

# Add players (replace these with real phone numbers in E.164 format)
echo "Adding players..."
echo ""

# Austria
echo "Adding Austria..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15551111111\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"AUSTRIA\"
  }" | jq '.'

# England
echo "Adding England..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15552222222\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"ENGLAND\"
  }" | jq '.'

# France
echo "Adding France..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15553333333\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"FRANCE\"
  }" | jq '.'

# Germany
echo "Adding Germany..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15554444444\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"GERMANY\"
  }" | jq '.'

# Italy
echo "Adding Italy..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15555555555\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"ITALY\"
  }" | jq '.'

# Russia
echo "Adding Russia..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15556666666\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"RUSSIA\"
  }" | jq '.'

# Turkey
echo "Adding Turkey..."
curl -s -X POST "$API_BASE/api/game/add-player" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+15557777777\",
    \"gameId\": \"$GAME_ID\",
    \"nation\": \"TURKEY\"
  }" | jq '.'

echo ""
echo "=================================="
echo "Game setup complete!"
echo ""
echo "Game ID: $GAME_ID"
echo ""
echo "All players should receive confirmation SMS messages."
echo "They need to reply with 'Y' to confirm participation."
echo ""
echo "To check game status:"
echo "  curl $API_BASE/api/game/$GAME_ID/status | jq '.'"
echo ""
echo "To process a turn (after players submit orders):"
echo "  curl -X POST $API_BASE/api/game/process-turn -H 'Content-Type: application/json' -d '{\"gameId\": \"$GAME_ID\"}' | jq '.'"
echo ""
echo "=================================="
