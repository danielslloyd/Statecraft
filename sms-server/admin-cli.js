#!/usr/bin/env node

/**
 * Admin CLI Tool for Diplomacy SMS Server
 *
 * Provides easy commands to manage games without using curl
 */

const readline = require('readline');
const http = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const NATIONS = [
    'AUSTRIA', 'ENGLAND', 'FRANCE', 'GERMANY', 'ITALY', 'RUSSIA', 'TURKEY'
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

function apiRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function createGame() {
    console.log('\n📋 CREATE NEW GAME\n');

    const gameId = await question('Game ID (leave empty for auto-generated): ');

    try {
        const result = await apiRequest('POST', '/api/game/create', {
            gameId: gameId || undefined
        });

        if (result.success) {
            console.log(`\n✅ Game created successfully!`);
            console.log(`Game ID: ${result.gameId}`);
        } else {
            console.log(`\n❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.log(`\n❌ Failed to create game: ${error.message}`);
    }
}

async function addPlayers() {
    console.log('\n👥 ADD PLAYERS TO GAME\n');

    const gameId = await question('Game ID: ');

    console.log('\nAvailable nations:');
    NATIONS.forEach((nation, i) => {
        console.log(`  ${i + 1}. ${nation}`);
    });

    console.log('\nEnter players (format: phone,nation or just phone for interactive)');
    console.log('Type "done" when finished\n');

    const players = [];

    while (true) {
        const input = await question('Player (or "done"): ');

        if (input.toLowerCase() === 'done') {
            break;
        }

        if (input.includes(',')) {
            const [phone, nation] = input.split(',').map(s => s.trim());
            players.push({ phone, nation: nation.toUpperCase() });
        } else {
            const phone = input.trim();
            console.log('\nSelect nation:');
            NATIONS.forEach((nation, i) => {
                console.log(`  ${i + 1}. ${nation}`);
            });
            const nationIndex = await question('Nation (1-7): ');
            const nation = NATIONS[parseInt(nationIndex) - 1];

            if (nation) {
                players.push({ phone, nation });
            } else {
                console.log('Invalid nation selection');
            }
        }
    }

    console.log(`\nAdding ${players.length} players...`);

    for (const player of players) {
        try {
            const result = await apiRequest('POST', '/api/game/add-player', {
                phoneNumber: player.phone,
                gameId,
                nation: player.nation
            });

            if (result.success) {
                console.log(`✅ ${player.nation}: ${player.phone}`);
            } else {
                console.log(`❌ ${player.nation}: ${result.error}`);
            }
        } catch (error) {
            console.log(`❌ ${player.nation}: ${error.message}`);
        }
    }

    console.log('\n✅ Player registration complete!');
}

async function processTurn() {
    console.log('\n⚙️  PROCESS GAME TURN\n');

    const gameId = await question('Game ID: ');

    const confirm = await question(`Process turn for game "${gameId}"? (y/n): `);

    if (confirm.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        return;
    }

    try {
        const result = await apiRequest('POST', '/api/game/process-turn', {
            gameId
        });

        if (result.success) {
            console.log('\n✅ Turn processed successfully!');
            console.log('All players have been notified with updated board.');
        } else {
            console.log(`\n❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.log(`\n❌ Failed to process turn: ${error.message}`);
    }
}

async function gameStatus() {
    console.log('\n📊 GAME STATUS\n');

    const gameId = await question('Game ID: ');

    try {
        const result = await apiRequest('GET', `/api/game/${gameId}/status`);

        if (result.success) {
            const game = result.game;
            console.log('\n' + '='.repeat(60));
            console.log(`Game: ${game.id}`);
            console.log(`Season: ${game.season} ${game.year}`);
            console.log(`Phase: ${game.phase}`);
            console.log('='.repeat(60));
            console.log('\nPlayers:');

            game.players.forEach(player => {
                const status = player.confirmed ? '✓' : '✗';
                console.log(`\n  ${player.nation} ${status}`);
                console.log(`    Phone: ${player.phone}`);
                console.log(`    Units: ${player.units}`);
                console.log(`    Supply Centers: ${player.supplyCenters}`);
            });

            console.log('\n' + '='.repeat(60));
        } else {
            console.log(`\n❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.log(`\n❌ Failed to get status: ${error.message}`);
    }
}

async function quickSetup() {
    console.log('\n🚀 QUICK GAME SETUP\n');
    console.log('This will create a game and add 7 players\n');

    const gameId = await question('Game ID: ');

    console.log('\nEnter phone numbers for each nation:');

    const players = [];
    for (const nation of NATIONS) {
        const phone = await question(`${nation}: `);
        if (phone.trim()) {
            players.push({ phone: phone.trim(), nation });
        }
    }

    if (players.length === 0) {
        console.log('No players entered. Cancelled.');
        return;
    }

    console.log(`\nCreating game with ${players.length} players...`);

    // Create game
    try {
        const createResult = await apiRequest('POST', '/api/game/create', { gameId });

        if (!createResult.success) {
            console.log(`❌ Failed to create game: ${createResult.error}`);
            return;
        }

        console.log(`✅ Game created: ${createResult.gameId}`);

        // Add players
        for (const player of players) {
            try {
                const result = await apiRequest('POST', '/api/game/add-player', {
                    phoneNumber: player.phone,
                    gameId: createResult.gameId,
                    nation: player.nation
                });

                if (result.success) {
                    console.log(`✅ ${player.nation}: ${player.phone} (confirmation sent)`);
                } else {
                    console.log(`❌ ${player.nation}: ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ ${player.nation}: ${error.message}`);
            }
        }

        console.log('\n✅ Setup complete!');
        console.log('Players will receive confirmation messages.');
        console.log('Game will start automatically once all players confirm.');

    } catch (error) {
        console.log(`\n❌ Setup failed: ${error.message}`);
    }
}

async function mainMenu() {
    console.log('\n' + '='.repeat(60));
    console.log('  DIPLOMACY SMS GAME - ADMIN CLI');
    console.log('='.repeat(60));
    console.log('\n1. Create new game');
    console.log('2. Add players to game');
    console.log('3. Process turn');
    console.log('4. View game status');
    console.log('5. Quick setup (create game + add 7 players)');
    console.log('6. Exit');

    const choice = await question('\nSelect option (1-6): ');

    switch (choice) {
        case '1':
            await createGame();
            break;
        case '2':
            await addPlayers();
            break;
        case '3':
            await processTurn();
            break;
        case '4':
            await gameStatus();
            break;
        case '5':
            await quickSetup();
            break;
        case '6':
            console.log('\nGoodbye!');
            rl.close();
            process.exit(0);
            return;
        default:
            console.log('\nInvalid option');
    }

    // Return to menu
    await mainMenu();
}

// Start CLI
console.log('\nConnecting to server at:', API_BASE);
mainMenu().catch(error => {
    console.error('Fatal error:', error);
    rl.close();
    process.exit(1);
});
