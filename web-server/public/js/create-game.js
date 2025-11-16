// Game Creation Page Logic

const NATIONS = {
    AUSTRIA: { name: 'Austria-Hungary', short: 'Austria' },
    ENGLAND: { name: 'England', short: 'England' },
    FRANCE: { name: 'France', short: 'France' },
    GERMANY: { name: 'Germany', short: 'Germany' },
    ITALY: { name: 'Italy', short: 'Italy' },
    RUSSIA: { name: 'Russia', short: 'Russia' },
    TURKEY: { name: 'Turkey', short: 'Turkey' }
};

let selectedNations = [];
let playerConfigs = {};
let createdGameHash = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    renderNationsList();
    setupEventListeners();
});

function renderNationsList() {
    const nationsList = document.getElementById('nations-list');

    Object.entries(NATIONS).forEach(([code, nation]) => {
        const label = document.createElement('label');
        label.className = 'nation-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = code;
        checkbox.checked = true; // All selected by default

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedNations.push(code);
                label.classList.add('checked');
            } else {
                selectedNations = selectedNations.filter(n => n !== code);
                label.classList.remove('checked');
            }
            updatePlayerConfig();
        });

        const text = document.createTextNode(nation.short);

        label.appendChild(checkbox);
        label.appendChild(text);
        nationsList.appendChild(label);

        // Initialize as selected
        selectedNations.push(code);
        label.classList.add('checked');
    });

    updatePlayerConfig();
}

function updatePlayerConfig() {
    const playersConfig = document.getElementById('players-config');
    playersConfig.innerHTML = '';

    selectedNations.forEach(nationCode => {
        const nation = NATIONS[nationCode];

        const row = document.createElement('div');
        row.className = 'player-row';

        const nationLabel = document.createElement('strong');
        nationLabel.textContent = nation.short + ':';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = `Player name for ${nation.short}`;
        nameInput.value = playerConfigs[nationCode]?.name || '';
        nameInput.addEventListener('input', (e) => {
            if (!playerConfigs[nationCode]) {
                playerConfigs[nationCode] = {};
            }
            playerConfigs[nationCode].name = e.target.value;
        });

        const botLabel = document.createElement('label');
        const botCheckbox = document.createElement('input');
        botCheckbox.type = 'checkbox';
        botCheckbox.checked = playerConfigs[nationCode]?.isBot || false;
        botCheckbox.addEventListener('change', (e) => {
            if (!playerConfigs[nationCode]) {
                playerConfigs[nationCode] = {};
            }
            playerConfigs[nationCode].isBot = e.target.checked;

            // If bot, clear name
            if (e.target.checked) {
                nameInput.value = nation.short + ' Bot';
                playerConfigs[nationCode].name = nameInput.value;
                nameInput.disabled = true;
            } else {
                nameInput.disabled = false;
            }
        });

        const botText = document.createTextNode('Bot');
        botLabel.appendChild(botCheckbox);
        botLabel.appendChild(botText);

        row.appendChild(nationLabel);
        row.appendChild(nameInput);
        row.appendChild(botLabel);

        playersConfig.appendChild(row);
    });
}

function setupEventListeners() {
    document.getElementById('create-game-btn').addEventListener('click', createGame);
    document.getElementById('copy-all-links').addEventListener('click', copyAllLinks);
    document.getElementById('start-game-btn').addEventListener('click', startGame);
}

async function createGame() {
    if (selectedNations.length < 2) {
        alert('Please select at least 2 nations');
        return;
    }

    const nations = selectedNations;
    const playerNames = nations.map(nation =>
        playerConfigs[nation]?.name || NATIONS[nation].short
    );
    const botNations = nations.filter(nation =>
        playerConfigs[nation]?.isBot
    );

    try {
        const response = await fetch('/api/game/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nations, playerNames, botNations })
        });

        const data = await response.json();

        if (data.success) {
            createdGameHash = data.gameHash;
            displayGameLinks(data);
        } else {
            alert('Error creating game: ' + data.error);
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

function displayGameLinks(data) {
    const gameLinks = document.getElementById('game-links');
    const playerLinks = document.getElementById('player-links');

    playerLinks.innerHTML = '';

    data.playerUrls.forEach(player => {
        const linkDiv = document.createElement('div');
        linkDiv.className = 'player-link' + (player.isBot ? ' bot' : '');

        const label = document.createElement('strong');
        label.textContent = `${player.playerName} (${player.nation})${player.isBot ? ' [BOT]' : ''}`;

        linkDiv.appendChild(label);

        if (!player.isBot) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = window.location.origin + player.url;
            input.readOnly = true;
            input.addEventListener('click', () => {
                input.select();
                document.execCommand('copy');
                showCopiedNotification(input);
            });

            linkDiv.appendChild(input);
        } else {
            const botNote = document.createElement('p');
            botNote.textContent = 'This is a bot player - no link needed';
            botNote.style.margin = '5px 0 0';
            botNote.style.fontSize = '12px';
            botNote.style.color = '#666';
            linkDiv.appendChild(botNote);
        }

        playerLinks.appendChild(linkDiv);
    });

    gameLinks.classList.remove('hidden');
    document.querySelector('.create-game-form').style.opacity = '0.5';
}

function showCopiedNotification(input) {
    const originalBg = input.style.background;
    input.style.background = '#d4edda';
    setTimeout(() => {
        input.style.background = originalBg;
    }, 500);
}

function copyAllLinks() {
    const links = Array.from(document.querySelectorAll('.player-link:not(.bot) input'))
        .map(input => input.value)
        .join('\n\n');

    navigator.clipboard.writeText(links).then(() => {
        const btn = document.getElementById('copy-all-links');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#28a745';
        btn.style.color = 'white';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 2000);
    });
}

async function startGame() {
    if (!createdGameHash) {
        alert('No game to start');
        return;
    }

    try {
        const response = await fetch(`/api/game/${createdGameHash}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            alert('Game started! Players can now access their links.');
        } else {
            alert('Error starting game: ' + data.error);
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}
