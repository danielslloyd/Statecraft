// Game Data for Diplomacy

const NATIONS = {
    AUSTRIA: {
        name: 'Austria-Hungary',
        shortName: 'Austria',
        color: '#ff0000',
        textColor: '#ffffff'
    },
    ENGLAND: {
        name: 'England',
        shortName: 'England',
        color: '#0000ff',
        textColor: '#ffffff'
    },
    FRANCE: {
        name: 'France',
        shortName: 'France',
        color: '#4169e1',
        textColor: '#ffffff'
    },
    GERMANY: {
        name: 'Germany',
        shortName: 'Germany',
        color: '#333333',
        textColor: '#ffffff'
    },
    ITALY: {
        name: 'Italy',
        shortName: 'Italy',
        color: '#00ff00',
        textColor: '#000000'
    },
    RUSSIA: {
        name: 'Russia',
        shortName: 'Russia',
        color: '#ffffff',
        textColor: '#000000'
    },
    TURKEY: {
        name: 'Turkey',
        shortName: 'Turkey',
        color: '#ffff00',
        textColor: '#000000'
    }
};

const UNIT_TYPES = {
    ARMY: 'army',
    FLEET: 'fleet'
};

// Province data with positions on the map
const PROVINCES = {
    // Austria-Hungary
    'vie': { name: 'Vienna', x: 580, y: 500, supply: true, owner: 'AUSTRIA', coast: false },
    'bud': { name: 'Budapest', x: 640, y: 540, supply: true, owner: 'AUSTRIA', coast: false },
    'tri': { name: 'Trieste', x: 560, y: 540, supply: true, owner: 'AUSTRIA', coast: true },
    'boh': { name: 'Bohemia', x: 560, y: 450, supply: false, owner: null, coast: false },
    'gal': { name: 'Galicia', x: 680, y: 480, supply: false, owner: null, coast: false },
    'tyr': { name: 'Tyrolia', x: 520, y: 500, supply: false, owner: null, coast: false },

    // England
    'lon': { name: 'London', x: 320, y: 380, supply: true, owner: 'ENGLAND', coast: true },
    'lvp': { name: 'Liverpool', x: 300, y: 340, supply: true, owner: 'ENGLAND', coast: true },
    'edi': { name: 'Edinburgh', x: 320, y: 280, supply: true, owner: 'ENGLAND', coast: true },
    'wal': { name: 'Wales', x: 280, y: 380, supply: false, owner: null, coast: true },
    'yor': { name: 'Yorkshire', x: 340, y: 340, supply: false, owner: null, coast: true },
    'cly': { name: 'Clyde', x: 300, y: 260, supply: false, owner: null, coast: true },

    // France
    'par': { name: 'Paris', x: 380, y: 460, supply: true, owner: 'FRANCE', coast: false },
    'mar': { name: 'Marseilles', x: 420, y: 540, supply: true, owner: 'FRANCE', coast: true },
    'bre': { name: 'Brest', x: 320, y: 460, supply: true, owner: 'FRANCE', coast: true },
    'pic': { name: 'Picardy', x: 360, y: 420, supply: false, owner: null, coast: true },
    'bur': { name: 'Burgundy', x: 420, y: 480, supply: false, owner: null, coast: false },
    'gas': { name: 'Gascony', x: 360, y: 520, supply: false, owner: null, coast: true },

    // Germany
    'ber': { name: 'Berlin', x: 520, y: 380, supply: true, owner: 'GERMANY', coast: true },
    'mun': { name: 'Munich', x: 500, y: 460, supply: true, owner: 'GERMANY', coast: false },
    'kie': { name: 'Kiel', x: 480, y: 360, supply: true, owner: 'GERMANY', coast: true },
    'ruh': { name: 'Ruhr', x: 440, y: 400, supply: false, owner: null, coast: false },
    'sil': { name: 'Silesia', x: 580, y: 420, supply: false, owner: null, coast: false },
    'pru': { name: 'Prussia', x: 600, y: 360, supply: false, owner: null, coast: true },

    // Italy
    'rom': { name: 'Rome', x: 520, y: 620, supply: true, owner: 'ITALY', coast: true },
    'ven': { name: 'Venice', x: 520, y: 560, supply: true, owner: 'ITALY', coast: true },
    'nap': { name: 'Naples', x: 580, y: 660, supply: true, owner: 'ITALY', coast: true },
    'tus': { name: 'Tuscany', x: 480, y: 580, supply: false, owner: null, coast: true },
    'pie': { name: 'Piedmont', x: 460, y: 540, supply: false, owner: null, coast: true },
    'apu': { name: 'Apulia', x: 600, y: 640, supply: false, owner: null, coast: true },

    // Russia
    'mos': { name: 'Moscow', x: 780, y: 340, supply: true, owner: 'RUSSIA', coast: false },
    'sev': { name: 'Sevastopol', x: 800, y: 560, supply: true, owner: 'RUSSIA', coast: true },
    'stp': { name: 'St Petersburg', x: 720, y: 200, supply: true, owner: 'RUSSIA', coast: true, coasts: ['nc', 'sc'] },
    'war': { name: 'Warsaw', x: 640, y: 400, supply: true, owner: 'RUSSIA', coast: false },
    'ukr': { name: 'Ukraine', x: 740, y: 500, supply: false, owner: null, coast: false },
    'lvn': { name: 'Livonia', x: 680, y: 300, supply: false, owner: null, coast: true },
    'fin': { name: 'Finland', x: 700, y: 220, supply: false, owner: null, coast: true },

    // Turkey
    'con': { name: 'Constantinople', x: 740, y: 640, supply: true, owner: 'TURKEY', coast: true },
    'ank': { name: 'Ankara', x: 800, y: 640, supply: true, owner: 'TURKEY', coast: true },
    'smy': { name: 'Smyrna', x: 760, y: 680, supply: true, owner: 'TURKEY', coast: true },
    'arm': { name: 'Armenia', x: 860, y: 620, supply: false, owner: null, coast: true },
    'syr': { name: 'Syria', x: 840, y: 700, supply: false, owner: null, coast: true },

    // Neutral supply centers
    'bel': { name: 'Belgium', x: 400, y: 400, supply: true, owner: null, coast: true },
    'hol': { name: 'Holland', x: 420, y: 380, supply: true, owner: null, coast: true },
    'den': { name: 'Denmark', x: 480, y: 320, supply: true, owner: null, coast: true },
    'swe': { name: 'Sweden', x: 580, y: 260, supply: true, owner: null, coast: true },
    'nor': { name: 'Norway', x: 520, y: 220, supply: true, owner: null, coast: true },
    'spa': { name: 'Spain', x: 320, y: 580, supply: true, owner: null, coast: true, coasts: ['nc', 'sc'] },
    'por': { name: 'Portugal', x: 260, y: 600, supply: true, owner: null, coast: true },
    'tun': { name: 'Tunis', x: 440, y: 700, supply: true, owner: null, coast: true },
    'ser': { name: 'Serbia', x: 640, y: 580, supply: true, owner: null, coast: false },
    'bul': { name: 'Bulgaria', x: 720, y: 620, supply: true, owner: null, coast: true, coasts: ['ec', 'sc'] },
    'gre': { name: 'Greece', x: 680, y: 680, supply: true, owner: null, coast: true },
    'rum': { name: 'Rumania', x: 720, y: 560, supply: true, owner: null, coast: true },

    // Non-supply provinces
    'alb': { name: 'Albania', x: 640, y: 640, supply: false, owner: null, coast: true },

    // Seas
    'nth': { name: 'North Sea', x: 400, y: 320, supply: false, owner: null, coast: false, sea: true },
    'eng': { name: 'English Channel', x: 340, y: 420, supply: false, owner: null, coast: false, sea: true },
    'iri': { name: 'Irish Sea', x: 280, y: 340, supply: false, owner: null, coast: false, sea: true },
    'mao': { name: 'Mid-Atlantic Ocean', x: 260, y: 500, supply: false, owner: null, coast: false, sea: true },
    'nao': { name: 'North Atlantic Ocean', x: 220, y: 300, supply: false, owner: null, coast: false, sea: true },
    'nwg': { name: 'Norwegian Sea', x: 420, y: 220, supply: false, owner: null, coast: false, sea: true },
    'bar': { name: 'Barents Sea', x: 740, y: 160, supply: false, owner: null, coast: false, sea: true },
    'bal': { name: 'Baltic Sea', x: 580, y: 320, supply: false, owner: null, coast: false, sea: true },
    'ska': { name: 'Skagerrak', x: 500, y: 300, supply: false, owner: null, coast: false, sea: true },
    'hel': { name: 'Helgoland Bight', x: 440, y: 360, supply: false, owner: null, coast: false, sea: true },
    'wes': { name: 'Western Mediterranean', x: 380, y: 620, supply: false, owner: null, coast: false, sea: true },
    'lyo': { name: 'Gulf of Lyon', x: 420, y: 580, supply: false, owner: null, coast: false, sea: true },
    'tys': { name: 'Tyrrhenian Sea', x: 500, y: 640, supply: false, owner: null, coast: false, sea: true },
    'ion': { name: 'Ionian Sea', x: 600, y: 700, supply: false, owner: null, coast: false, sea: true },
    'adr': { name: 'Adriatic Sea', x: 580, y: 600, supply: false, owner: null, coast: false, sea: true },
    'aeg': { name: 'Aegean Sea', x: 700, y: 680, supply: false, owner: null, coast: false, sea: true },
    'eas': { name: 'Eastern Mediterranean', x: 780, y: 720, supply: false, owner: null, coast: false, sea: true },
    'bla': { name: 'Black Sea', x: 780, y: 600, supply: false, owner: null, coast: false, sea: true },
    'bot': { name: 'Gulf of Bothnia', x: 640, y: 240, supply: false, owner: null, coast: false, sea: true }
};

// Adjacency list - defines which provinces can move to which
const ADJACENCIES = {
    // Land and sea connections
    'vie': ['boh', 'gal', 'bud', 'tri', 'tyr'],
    'bud': ['vie', 'gal', 'rum', 'ser', 'tri'],
    'tri': ['vie', 'bud', 'ser', 'alb', 'adr', 'ven', 'tyr'],
    'boh': ['vie', 'mun', 'sil', 'gal', 'tyr'],
    'gal': ['vie', 'boh', 'sil', 'war', 'ukr', 'rum', 'bud'],
    'tyr': ['vie', 'boh', 'mun', 'ven', 'tri', 'pie'],

    'lon': ['wal', 'yor', 'nth', 'eng'],
    'lvp': ['cly', 'edi', 'yor', 'wal', 'iri', 'nao'],
    'edi': ['cly', 'yor', 'lvp', 'nth', 'nwg'],
    'wal': ['lon', 'yor', 'lvp', 'iri', 'eng'],
    'yor': ['lon', 'wal', 'lvp', 'edi', 'nth'],
    'cly': ['edi', 'lvp', 'nao', 'nwg'],

    'par': ['pic', 'bur', 'gas', 'bre'],
    'mar': ['pie', 'bur', 'gas', 'spa', 'lyo', 'spa'],
    'bre': ['par', 'pic', 'gas', 'mao', 'eng'],
    'pic': ['par', 'bre', 'eng', 'bel', 'bur'],
    'bur': ['par', 'pic', 'bel', 'ruh', 'mun', 'mar', 'gas'],
    'gas': ['par', 'bre', 'mao', 'spa', 'mar', 'bur'],

    'ber': ['kie', 'pru', 'sil', 'mun', 'bal'],
    'mun': ['ber', 'sil', 'boh', 'tyr', 'bur', 'ruh', 'kie'],
    'kie': ['ber', 'mun', 'ruh', 'hol', 'hel', 'den', 'bal'],
    'ruh': ['kie', 'mun', 'bur', 'bel', 'hol'],
    'sil': ['ber', 'pru', 'war', 'gal', 'boh', 'mun'],
    'pru': ['ber', 'bal', 'lvn', 'war', 'sil'],

    'rom': ['tus', 'ven', 'apu', 'nap', 'tys'],
    'ven': ['tyr', 'tri', 'adr', 'apu', 'rom', 'tus', 'pie'],
    'nap': ['rom', 'apu', 'ion', 'tys'],
    'tus': ['pie', 'ven', 'rom', 'tys', 'lyo'],
    'pie': ['tyr', 'ven', 'tus', 'lyo', 'mar'],
    'apu': ['ven', 'adr', 'ion', 'nap', 'rom'],

    'mos': ['stp', 'lvn', 'war', 'ukr', 'sev'],
    'sev': ['mos', 'ukr', 'rum', 'bla', 'arm'],
    'stp': ['mos', 'lvn', 'fin', 'bot', 'bar'],
    'war': ['pru', 'lvn', 'mos', 'ukr', 'gal', 'sil'],
    'ukr': ['mos', 'war', 'gal', 'rum', 'sev'],
    'lvn': ['pru', 'bal', 'bot', 'stp', 'mos', 'war'],
    'fin': ['stp', 'bot', 'swe', 'nwg'],

    'con': ['bul', 'bla', 'ank', 'smy', 'aeg'],
    'ank': ['con', 'bla', 'arm', 'smy'],
    'smy': ['con', 'ank', 'arm', 'syr', 'eas', 'aeg'],
    'arm': ['sev', 'bla', 'ank', 'smy', 'syr'],
    'syr': ['arm', 'smy', 'eas'],

    'bel': ['pic', 'bur', 'ruh', 'hol', 'eng', 'nth'],
    'hol': ['bel', 'ruh', 'kie', 'hel', 'nth'],
    'den': ['kie', 'bal', 'ska', 'hel', 'nth', 'swe'],
    'swe': ['den', 'ska', 'bal', 'bot', 'fin', 'nwg'],
    'nor': ['swe', 'ska', 'nth', 'nwg', 'nao', 'bar'],
    'spa': ['por', 'gas', 'mar', 'mao', 'wes', 'lyo'],
    'por': ['spa', 'mao'],
    'tun': ['wes', 'tys', 'ion', 'naf'],
    'ser': ['bud', 'rum', 'bul', 'gre', 'alb', 'tri'],
    'bul': ['rum', 'ser', 'gre', 'con', 'bla', 'aeg'],
    'gre': ['ser', 'bul', 'alb', 'aeg', 'ion'],
    'rum': ['bud', 'gal', 'ukr', 'sev', 'bla', 'bul', 'ser'],
    'alb': ['tri', 'ser', 'gre', 'adr', 'ion'],

    // Seas
    'nth': ['nwg', 'nao', 'iri', 'eng', 'bel', 'hol', 'hel', 'den', 'ska', 'yor', 'lon', 'edi', 'nor'],
    'eng': ['iri', 'mao', 'bre', 'pic', 'bel', 'nth', 'lon', 'wal'],
    'iri': ['nao', 'mao', 'eng', 'wal', 'lvp'],
    'mao': ['nao', 'iri', 'eng', 'bre', 'gas', 'spa', 'por', 'wes'],
    'nao': ['nwg', 'cly', 'lvp', 'iri', 'mao', 'nor'],
    'nwg': ['bar', 'nor', 'nth', 'nao', 'cly', 'edi', 'swe', 'fin'],
    'bar': ['nwg', 'nor', 'stp', 'fin'],
    'bal': ['bot', 'swe', 'den', 'kie', 'ber', 'pru', 'lvn'],
    'ska': ['nth', 'den', 'swe', 'nor'],
    'hel': ['nth', 'hol', 'kie', 'den'],
    'wes': ['mao', 'spa', 'lyo', 'tus', 'tys', 'tun'],
    'lyo': ['spa', 'mar', 'pie', 'tus', 'wes'],
    'tys': ['lyo', 'tus', 'rom', 'nap', 'ion', 'tun', 'wes'],
    'ion': ['tys', 'nap', 'apu', 'adr', 'alb', 'gre', 'aeg', 'eas', 'tun'],
    'adr': ['tri', 'ven', 'apu', 'ion', 'alb'],
    'aeg': ['gre', 'bul', 'con', 'smy', 'eas', 'ion'],
    'eas': ['aeg', 'smy', 'syr', 'ion'],
    'bla': ['rum', 'bul', 'con', 'ank', 'arm', 'sev'],
    'bot': ['swe', 'fin', 'stp', 'lvn', 'bal']
};

// Starting positions for 1901
const STARTING_POSITIONS = {
    'AUSTRIA': [
        { province: 'vie', type: UNIT_TYPES.ARMY },
        { province: 'bud', type: UNIT_TYPES.ARMY },
        { province: 'tri', type: UNIT_TYPES.FLEET }
    ],
    'ENGLAND': [
        { province: 'lon', type: UNIT_TYPES.FLEET },
        { province: 'lvp', type: UNIT_TYPES.ARMY },
        { province: 'edi', type: UNIT_TYPES.FLEET }
    ],
    'FRANCE': [
        { province: 'par', type: UNIT_TYPES.ARMY },
        { province: 'mar', type: UNIT_TYPES.ARMY },
        { province: 'bre', type: UNIT_TYPES.FLEET }
    ],
    'GERMANY': [
        { province: 'ber', type: UNIT_TYPES.ARMY },
        { province: 'mun', type: UNIT_TYPES.ARMY },
        { province: 'kie', type: UNIT_TYPES.FLEET }
    ],
    'ITALY': [
        { province: 'rom', type: UNIT_TYPES.ARMY },
        { province: 'ven', type: UNIT_TYPES.ARMY },
        { province: 'nap', type: UNIT_TYPES.FLEET }
    ],
    'RUSSIA': [
        { province: 'mos', type: UNIT_TYPES.ARMY },
        { province: 'sev', type: UNIT_TYPES.FLEET },
        { province: 'stp', type: UNIT_TYPES.FLEET },
        { province: 'war', type: UNIT_TYPES.ARMY }
    ],
    'TURKEY': [
        { province: 'con', type: UNIT_TYPES.ARMY },
        { province: 'ank', type: UNIT_TYPES.FLEET },
        { province: 'smy', type: UNIT_TYPES.ARMY }
    ]
};

// Constants
const WINNING_SUPPLY_COUNT = 18;
