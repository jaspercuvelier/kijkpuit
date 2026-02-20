document.title = `Paddentrek Teller Pro ${APP_VERSION}`;
document.getElementById('app-version-display').innerText = APP_VERSION;
document.getElementById('pwa-status').onclick = handleVersionTap;
let deferredInstallPrompt = null;
const installBtns = Array.from(document.querySelectorAll('.install-app-btn'));
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

// --- DEV MODE STATE ---
let devMode = false;
let versionTapCount = 0;
let versionTapTimer = null;

function initDevMode() {
    devMode = localStorage.getItem('paddentrek_dev_mode') === 'true';
    updateDevModeUI();
}

function handleVersionTap() {
    versionTapCount++;
    if (versionTapTimer) clearTimeout(versionTapTimer);

    versionTapTimer = setTimeout(() => {
        versionTapCount = 0;
    }, 2000);

    if (versionTapCount === 5) {
        toggleDevMode();
        versionTapCount = 0;
    }
}

function toggleDevMode() {
    devMode = !devMode;
    localStorage.setItem('paddentrek_dev_mode', devMode);
    updateDevModeUI();
    showToast(devMode ? "👨‍💻 Developer Mode: AAN" : "👨‍💻 Developer Mode: UIT");
}

function updateDevModeUI() {
    const advancedContainer = document.getElementById('advanced-settings-details');
    if (advancedContainer) {
        if (devMode) {
            advancedContainer.classList.remove('hidden');
        } else {
            advancedContainer.classList.add('hidden');
            advancedContainer.removeAttribute('open');
        }
    }
}

// Track app open
trackEvent('app_open', {
    app_version: APP_VERSION,
    pwa_mode: isStandalone() ? 'standalone' : 'browser',
    platform: isIOS ? 'ios' : 'other'
});

function setInstallButtonState(show) {
    installBtns.forEach(btn => btn.classList.toggle('hidden', !show));
}

if (!isStandalone() && isIOS) {
    setInstallButtonState(true);
}

window.addEventListener('beforeinstallprompt', ev => {
    deferredInstallPrompt = ev;
    if (!isStandalone()) setInstallButtonState(true);
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallButtonState(false);
    showToast('App is geinstalleerd');
});

installBtns.forEach(installBtn => {
    installBtn.onclick = async () => {
        if (isStandalone()) return;
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            try { await deferredInstallPrompt.userChoice; } catch (_) { }
            deferredInstallPrompt = null;
            setInstallButtonState(false);
            return;
        }
        if (isIOS) {
            alert('iPhone/iPad: open in Safari, tik op Deel en kies "Zet op beginscherm".');
        } else {
            alert('Installeren is nog niet beschikbaar. Herlaad de pagina en wacht enkele seconden.');
        }
    };
});

// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`).then(reg => {
        document.getElementById('status-icon').className = 'status-dot bg-emerald-500 shadow-[0_0_8px_#10b981]';
        const st = document.getElementById('status-text');
        st.innerText = '';
        st.classList.add('hidden');

        // Luister naar nieuwe versies
        reg.addEventListener('updatefound', () => {
            // updatefound kan ook "zelfde query, andere inhoud" zijn via importScripts(version.js)
            if (navigator.serviceWorker.controller) showUpdateBadge();
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            const u = reg.active?.scriptURL || '';
            const m = u.match(/v=([^&]+)/);
            showUpdateBadge(m ? m[1] : null);
        });
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBadge();

        const requestSwUpdateCheck = () => reg.update().catch(() => { });
        requestSwUpdateCheck();
        window.addEventListener('online', requestSwUpdateCheck);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') requestSwUpdateCheck();
        });
    }).catch(() => {
        document.getElementById('status-icon').className = 'status-dot bg-red-500';
        const st = document.getElementById('status-text');
        st.innerText = 'SW fout';
        st.classList.remove('hidden');
    });

    navigator.serviceWorker.addEventListener('message', ev => {
        if (ev.data?.type === 'NEW_VERSION') showUpdateBadge(ev.data.version || APP_VERSION);
    });
}

// --- FX ---
const canvas = document.getElementById('canvas-fx');
const ctx = canvas.getContext('2d');
let particles = [];
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize; resize();

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 4 + 1.5;
        this.vX = (Math.random() - 0.5) * 12;
        this.vY = (Math.random() - 0.5) * 12;
        this.life = 1.2;
    }
    update() { this.x += this.vX; this.y += this.vY; this.vY += 0.2; this.life -= 0.02; }
    draw() { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
}

class EmojiParticle extends Particle {
    constructor(x, y, emoji) {
        super(x, y, '#9ca3af');
        this.emoji = emoji;
        this.size = 18 + Math.random() * 8;
    }
    draw() {
        ctx.save();
        ctx.font = `${this.size}px Arial`;
        ctx.globalAlpha = Math.max(this.life, 0);
        ctx.fillText(this.emoji, this.x, this.y);
        ctx.restore();
    }
}

class HeartParticle extends Particle {
    constructor(x, y, color) { super(x, y, color); this.size = Math.random() * 4 + 4; }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.bezierCurveTo(this.x - s, this.y - s, this.x - 2 * s, this.y + s * 0.8, this.x, this.y + s * 1.8);
        ctx.bezierCurveTo(this.x + 2 * s, this.y + s * 0.8, this.x + s, this.y - s, this.x, this.y);
        ctx.fill();
    }
}

function celebrate(e, hearts = false, sad = false, boost = 0) {
    const colors = hearts ? ['#fb7185', '#f472b6', '#ef4444', '#f87171']
        : sad ? ['#60a5fa', '#94a3b8', '#a5b4fc', '#22d3ee']
            : ['#10b981', '#60a5fa', '#fcd34d', '#f472b6', '#ffffff'];
    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY : window.innerHeight / 2;
    const base = hearts ? 50 : sad ? 25 : 60;
    const count = base + boost;
    const sadEmojis = ['☠️', '💀', '🥀', '😢', '🪦', '🙁'];
    for (let i = 0; i < count; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        if (hearts) particles.push(new HeartParticle(x, y, color));
        else if (sad) particles.push(new EmojiParticle(x, y, sadEmojis[Math.floor(Math.random() * sadEmojis.length)]));
        else particles.push(new Particle(x, y, color));
    }
    // extra confetti-golf
    setTimeout(() => {
        for (let i = 0; i < count / 1.5; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            particles.push(new Particle(x + (Math.random() - 0.5) * 200, y + (Math.random() - 0.5) * 200, color));
        }
    }, 350);
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

// --- HAPTICS ---
let lastVibeTs = 0;
function vibe(ms = 15, force = false) {
    if (!navigator.vibrate) return;
    const now = Date.now();
    if (!force && now - lastVibeTs < 60) return;
    navigator.vibrate(ms);
    lastVibeTs = now;
}
document.addEventListener('pointerdown', ev => {
    const btn = ev.target.closest('button');
    if (btn && !btn.disabled) vibe();
}, { passive: true });

// --- DATA ---
const SPECIES = [
    { id: 'pad', name: 'Gewone Pad', color: 'emerald', hasAmplexus: true },
    { id: 'br_kikker', name: 'Bruine Kikker', color: 'amber', hasAmplexus: true },
    { id: 'alpen', name: 'Alpenwatersalamander', color: 'blue', hasAmplexus: false },
    { id: 'kleine', name: 'Kleine Watersalamander', color: 'orange', hasAmplexus: false },
    { id: 'vin', name: 'Vinpootsalamander', color: 'pink', hasAmplexus: false },
    { id: 'kam', name: 'Kamsalamander', color: 'yellow', hasAmplexus: false }
];

const COUNT_KEY_MIGRATION_SUFFIX_MAP = Object.freeze({
    pair_live: 'p_l',
    pair_dead: 'p_d',
    m_live: 'm_l',
    f_live: 'v_l',
    u_live: 'o_l',
    m_dead: 'm_d',
    f_dead: 'v_d',
    u_dead: 'o_d'
});

function toLegacyCountKey(key) {
    if (typeof key !== 'string' || !key) return key;
    for (const modernSuffix in COUNT_KEY_MIGRATION_SUFFIX_MAP) {
        const marker = `_${modernSuffix}`;
        if (!key.endsWith(marker)) continue;
        return `${key.slice(0, -marker.length)}_${COUNT_KEY_MIGRATION_SUFFIX_MAP[modernSuffix]}`;
    }
    return key;
}

function normalizeCountKeySchema(counts) {
    if (!counts || typeof counts !== 'object') return false;
    let changed = false;
    const entries = Object.entries(counts);
    entries.forEach(([key, raw]) => {
        const legacyKey = toLegacyCountKey(key);
        if (legacyKey === key) return;
        const n = Number(raw || 0);
        const safe = Number.isFinite(n) ? n : 0;
        const current = Number(counts[legacyKey] || 0);
        const currentSafe = Number.isFinite(current) ? current : 0;
        if (safe !== 0) counts[legacyKey] = currentSafe + safe;
        delete counts[key];
        changed = true;
    });
    return changed;
}

let detEditing = false;

function rarityFor(speciesId) {
    const map = {
        vuurs: ['Zeldzaam', 'bg-yellow-900 text-yellow-200'],
        kam: ['Zeldzaam', 'bg-yellow-900 text-yellow-200'],
        vroed: ['Zeer zeldzaam', 'bg-red-900 text-red-200'],
        knoflook: ['Zeer zeldzaam', 'bg-red-900 text-red-200'],
        boomkikker: ['Zeer zeldzaam', 'bg-red-900 text-red-200'],
        rugstreep: ['Zeldzaam', 'bg-yellow-900 text-yellow-200'],
        heikikker: ['Zeldzaam', 'bg-yellow-900 text-yellow-200'],
        br_kikker: ['Algemeen', 'bg-emerald-900 text-emerald-200'],
        pad: ['Algemeen', 'bg-emerald-900 text-emerald-200'],
        alpen: ['Algemeen', 'bg-emerald-900 text-emerald-200'],
        vin: ['Algemeen', 'bg-emerald-900 text-emerald-200'],
        kleine: ['Algemeen', 'bg-emerald-900 text-emerald-200'],
        groene: ['Algemeen', 'bg-emerald-900 text-emerald-200'],
    };
    return map[speciesId] || ['Onbekend', 'bg-gray-800 text-gray-200'];
}

function cleanSpeciesName(n) { return n ? n.split('(')[0].trim() : ''; }
function toSlug(n) {
    return cleanSpeciesName(n || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Beslisboom (geactualiseerd op basis van veldkaart)

const DET_TREE = {
    id: 'root',
    question: 'Heeft het dier een staart?',
    yes: 'sal_start',
    no: 'frog_start'
};
const DET_NODES = {
    // Salamanders
    sal_start: { id: 'sal_start', question: 'Is het dier zwart en geel gekleurd?', yes: 'res_vuurs', no: 'sal_buik' },
    sal_buik: { id: 'sal_buik', question: 'Is de buik oranje en ongevlekt?', yes: 'res_alpen', no: 'sal_keel_ongevlekt' },
    sal_keel_ongevlekt: { id: 'sal_keel_ongevlekt', question: 'Is de keel ongevlekt?', yes: 'res_vin', no: 'sal_keel_spots' },
    sal_keel_spots: { id: 'sal_keel_spots', question: 'Is de keel donker met lichte spikkels?', yes: 'res_kam', no: 'res_kleine' },

    // Kikkers/padden
    frog_start: { id: 'frog_start', question: 'Heeft het dier een wrattige huid?', yes: 'frog_wrata', no: 'frog_pupil_vert' },
    frog_wrata: { id: 'frog_wrata', question: 'Heeft het dier een horizontale pupil?', yes: 'frog_geelstreep', no: 'res_vroed' },
    frog_geelstreep: { id: 'frog_geelstreep', question: 'Heeft het dier een gele rugstreep?', yes: 'res_rugstreep', no: 'res_pad' },

    frog_pupil_vert: { id: 'frog_pupil_vert', question: 'Heeft het dier een verticale pupil?', yes: 'res_knoflook', no: 'frog_masker' },
    frog_masker: { id: 'frog_masker', question: 'Is er een brede donkere vlek achter het oog (masker)?', yes: 'frog_rug_tot_snuit', no: 'frog_hechtschijf' },
    frog_rug_tot_snuit: { id: 'frog_rug_tot_snuit', question: 'Loopt er een lichte rugstreep tot aan de snuit?', yes: 'res_heikikker', no: 'res_bruine' },
    frog_hechtschijf: { id: 'frog_hechtschijf', question: 'Zijn er hechtschijfjes aan de tenen?', yes: 'res_boomkikker', no: 'res_groenekikker' },

    // Resultaten
    res_vuurs: { result: true, species: 'vuurs', name: 'Vuursalamander' },
    res_alpen: { result: true, species: 'alpen', name: 'Alpenwatersalamander' },
    res_vin: { result: true, species: 'vin', name: 'Vinpootsalamander' },
    res_kam: { result: true, species: 'kam', name: 'Kamsalamander' },
    res_kleine: { result: true, species: 'kleine', name: 'Kleine watersalamander' },

    res_vroed: { result: true, species: 'vroed', name: 'Vroedmeesterpad' },
    res_rugstreep: { result: true, species: 'rugstreep', name: 'Rugstreeppad' },
    res_pad: { result: true, species: 'pad', name: 'Gewone pad' },
    res_knoflook: { result: true, species: 'knoflook', name: 'Knoflookpad' },
    res_heikikker: { result: true, species: 'heikikker', name: 'Heikikker' },
    res_bruine: { result: true, species: 'br_kikker', name: 'Bruine kikker' },
    res_boomkikker: { result: true, species: 'boomkikker', name: 'Boomkikker' },
    res_groenekikker: { result: true, species: 'groene', name: 'Groene kikker' }
};

// helpers voor determinatie-rapporten
function detQuestionText(nodeId) {
    if (nodeId === 'root') return DET_TREE.question;
    return DET_NODES[nodeId]?.question || nodeId;
}
function detAnswerLabel(ans) { return ans === 'yes' ? 'JA' : 'NEE'; }


const WMO = {
    0: "Helder",
    1: "Licht bewolkt",
    2: "Half bewolkt",
    3: "Bewolkt",
    45: "Mist",
    48: "Rijpende mist",
    51: "Lichte motregen",
    53: "Motregen",
    55: "Dichte motregen",
    56: "Lichte ijzelmotregen",
    57: "Dichte ijzelmotregen",
    61: "Lichte regen",
    63: "Regen",
    65: "Harde regen",
    66: "Lichte ijzel",
    67: "Harde ijzel",
    71: "Lichte sneeuw",
    73: "Sneeuw",
    75: "Hevige sneeuw",
    77: "Sneeuwkorrels",
    80: "Lichte buien",
    81: "Buien",
    82: "Hevige buien",
    85: "Lichte sneeuwbuien",
    86: "Sneeuwbuien",
    95: "Onweer",
    96: "Onweer met hagel",
    99: "Zwaar onweer met hagel"
};

function precipitationLabelFromCode(code) {
    const c = Number(code);
    if ([0, 1, 2, 3].includes(c)) return 'Droog';
    if ([45, 48].includes(c)) return 'Nevel/mist';
    if ([51, 53, 55, 56, 57].includes(c)) return 'Motregen';
    if ([61, 63, 65, 66, 67].includes(c)) return 'Regen';
    if ([80, 81, 82].includes(c)) return 'Buien';
    if ([71, 73, 75, 77, 85, 86].includes(c)) return 'Sneeuw';
    if ([95, 96, 99].includes(c)) return 'Onweer';
    return 'Onbekend';
}

function weatherIconFromCode(code) {
    const c = Number(code);
    if (c === 0) return '☀️';
    if ([1, 2].includes(c)) return '🌤️';
    if (c === 3) return '☁️';
    if ([45, 48].includes(c)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(c)) return '🌦️';
    if ([61, 63, 65, 66, 67].includes(c)) return '🌧️';
    if ([80, 81, 82].includes(c)) return '🌦️';
    if ([71, 73, 75, 77, 85, 86].includes(c)) return '🌨️';
    if ([95, 96, 99].includes(c)) return '⛈️';
    return '🌡️';
}

function weatherNumber(val, digits = 1) {
    const n = Number(val);
    if (!isFinite(n)) return null;
    return Number(n.toFixed(digits));
}

function weatherDetailsText(weather, separator = ' • ') {
    if (!weather) return '';
    const details = [];
    const precip = weatherNumber(weather.pr, 1);
    const wind = weatherNumber(weather.ws, 0);
    if (precip !== null) details.push(`🌧️ ${precip.toFixed(1)} mm/u`);
    if (wind !== null) details.push(`💨 ${wind.toFixed(0)} km/u`);
    return details.join(separator);
}

function weatherSummaryText(weather, separator = ' • ', includeDetails = false) {
    if (!weather) return 'Onbekend';
    const code = Number(weather.c);
    const condition = WMO[code] || `Code ${code}`;
    const precipitation = weather.p || precipitationLabelFromCode(code);
    const icon = weatherIconFromCode(code);
    const base = `${icon} ${weather.t}°C${separator}${condition}${separator}${precipitation}`;
    if (!includeDetails) return base;
    const details = weatherDetailsText(weather, separator);
    return details ? `${base}${separator}${details}` : base;
}

const WEATHER_FETCH_MAX_AGE_MS = 3 * 60 * 60 * 1000;

function getSessionWeatherFetchPolicy(session, nowTs = Date.now()) {
    if (!session || typeof session !== 'object') return { allowed: true, ageMs: 0, active: false };
    const active = !session.end;
    if (active) return { allowed: true, ageMs: 0, active: true };
    const refTs = new Date(session.end || session.start || '').getTime();
    if (!isFinite(refTs)) return { allowed: true, ageMs: 0, active: false };
    const ageMs = Math.max(0, nowTs - refTs);
    return {
        allowed: ageMs < WEATHER_FETCH_MAX_AGE_MS,
        ageMs,
        active: false
    };
}

// Bewaar data onder vaste key; schrijf ook naar versie-key voor backward compat.
const STORAGE_KEY = 'paddentrek_data';
const STORAGE_KEY_VERSIONED = `paddentrek_${APP_VERSION}`;
const STORAGE_MIGRATION_STATE_KEY = 'paddentrek_migration_legacy_to_data_v1';
const AUTO_V3_MIGRATION_STATE_KEY = 'paddentrek_auto_migration_v3_v1';
const REPORT_TREND_SHOW_EMPTY_KEY = 'paddentrek_report_trend_show_empty_v1';
const SYNC_QUERY_PARAM = 'sync';
const SYNC_PAYLOAD_VERSION = 1;
const SYNC_IMPORTED_IDS_KEY = 'paddentrek_sync_imported_ids_v1';
const SYNC_IMPORTED_REGISTRY_KEY = 'paddentrek_sync_imported_registry_v1';
const CONTRIBUTOR_PROFILE_KEY = 'paddentrek_contributor_profile_v1';
let reportMode = 'day'; // 'session' | 'day'
let currentTab = 'count';
let photoTargetSession = null;
let viewedSessionId = '';
let sessionScanner = null;
let pendingQrImportPayload = null;
let pendingSyncLinkPayload = null;
let shareSelectionStateByDay = {};
let reportTrendShowEmptyDays = true;
const PHOTO_DB_NAME = 'paddentrek_media_v1';
const PHOTO_DB_VERSION = 1;
const PHOTO_DB_STORE = 'photos';
const PHOTO_REF_PREFIX = 'idb_photo:';
let photoDbPromise = null;
const photoDataUrlCache = new Map();

function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function safeParseJSON(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return isPlainObject(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function cloneJSON(v) {
    return JSON.parse(JSON.stringify(v || {}));
}

function isDataImageUrl(v) {
    return typeof v === 'string' && v.startsWith('data:image');
}

function isIdbPhotoRef(v) {
    return typeof v === 'string' && v.startsWith(PHOTO_REF_PREFIX);
}

function makeIdbPhotoRef(id) {
    return `${PHOTO_REF_PREFIX}${id}`;
}

function photoIdFromRef(ref) {
    return isIdbPhotoRef(ref) ? ref.slice(PHOTO_REF_PREFIX.length) : '';
}

function openPhotoDb() {
    if (photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('INDEXEDDB_UNAVAILABLE'));
            return;
        }
        const req = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(PHOTO_DB_STORE)) {
                db.createObjectStore(PHOTO_DB_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('PHOTO_DB_OPEN_FAILED'));
    });
    return photoDbPromise;
}

function runPhotoStore(mode, work) {
    return openPhotoDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_DB_STORE, mode);
        const store = tx.objectStore(PHOTO_DB_STORE);
        const out = work(store);
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error || new Error('PHOTO_DB_TX_FAILED'));
        tx.onabort = () => reject(tx.error || new Error('PHOTO_DB_TX_ABORTED'));
    }));
}

function putPhotoRecord(dataUrl, meta = {}) {
    const id = `ph_${Date.now()}_${randomHex(8)}`;
    const ref = makeIdbPhotoRef(id);
    const record = {
        id,
        dataUrl,
        mime: 'image/jpeg',
        createdAt: Date.now(),
        dayKey: meta.dayKey || '',
        sessionId: meta.sessionId || '',
        source: meta.source || 'session'
    };
    return runPhotoStore('readwrite', store => store.put(record))
        .then(() => {
            photoDataUrlCache.set(ref, Promise.resolve(dataUrl));
            return ref;
        });
}

function readPhotoRecordByRef(ref) {
    const id = photoIdFromRef(ref);
    if (!id) return Promise.resolve(null);
    return openPhotoDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(PHOTO_DB_STORE, 'readonly');
        const req = tx.objectStore(PHOTO_DB_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('PHOTO_DB_GET_FAILED'));
    }));
}

function deletePhotoRecordByRef(ref) {
    const id = photoIdFromRef(ref);
    if (!id) return Promise.resolve();
    return runPhotoStore('readwrite', store => store.delete(id))
        .finally(() => {
            photoDataUrlCache.delete(ref);
        });
}

function resolvePhotoDataUrl(refOrDataUrl) {
    if (!refOrDataUrl || typeof refOrDataUrl !== 'string') return Promise.resolve('');
    if (isDataImageUrl(refOrDataUrl)) return Promise.resolve(refOrDataUrl);
    if (!isIdbPhotoRef(refOrDataUrl)) return Promise.resolve('');
    if (!photoDataUrlCache.has(refOrDataUrl)) {
        const p = readPhotoRecordByRef(refOrDataUrl)
            .then(record => (record && typeof record.dataUrl === 'string') ? record.dataUrl : '')
            .catch(() => '');
        photoDataUrlCache.set(refOrDataUrl, p);
    }
    return photoDataUrlCache.get(refOrDataUrl);
}

function collectAllPhotoRefsFromStorage() {
    const refs = new Set();
    Object.keys(storage || {}).forEach(dayKey => {
        const day = storage[dayKey];
        if (!day || typeof day !== 'object') return;
        (Array.isArray(day.photos) ? day.photos : []).forEach(ref => { if (isIdbPhotoRef(ref)) refs.add(ref); });
        (Array.isArray(day.sessions) ? day.sessions : []).forEach(session => {
            (Array.isArray(session?.photos) ? session.photos : []).forEach(ref => { if (isIdbPhotoRef(ref)) refs.add(ref); });
            (Array.isArray(session?.determinations) ? session.determinations : []).forEach(det => {
                (Array.isArray(det?.photos) ? det.photos : []).forEach(ref => { if (isIdbPhotoRef(ref)) refs.add(ref); });
            });
        });
    });
    return refs;
}

function cleanupPhotoRefsIfUnused(refs = []) {
    const candidates = Array.from(new Set((Array.isArray(refs) ? refs : []).filter(isIdbPhotoRef)));
    if (!candidates.length) return Promise.resolve();
    const used = collectAllPhotoRefsFromStorage();
    const orphaned = candidates.filter(ref => !used.has(ref));
    if (!orphaned.length) return Promise.resolve();
    return Promise.all(orphaned.map(ref => deletePhotoRecordByRef(ref))).then(() => undefined);
}

function collectSessionPhotoRefs(session = null) {
    const refs = [];
    if (!session || typeof session !== 'object') return refs;
    (Array.isArray(session.photos) ? session.photos : []).forEach(ref => {
        if (isIdbPhotoRef(ref)) refs.push(ref);
    });
    (Array.isArray(session.determinations) ? session.determinations : []).forEach(det => {
        (Array.isArray(det?.photos) ? det.photos : []).forEach(ref => {
            if (isIdbPhotoRef(ref)) refs.push(ref);
        });
    });
    return refs;
}

function collectDayPhotoRefs(day = null) {
    const refs = [];
    if (!day || typeof day !== 'object') return refs;
    (Array.isArray(day.photos) ? day.photos : []).forEach(ref => {
        if (isIdbPhotoRef(ref)) refs.push(ref);
    });
    (Array.isArray(day.sessions) ? day.sessions : []).forEach(session => {
        refs.push(...collectSessionPhotoRefs(session));
    });
    return refs;
}

function encodePhotoRef(ref) {
    return encodeURIComponent(String(ref || ''));
}

function decodePhotoRef(refEncoded = '') {
    try { return decodeURIComponent(refEncoded); } catch (_) { return String(refEncoded || ''); }
}

function photoPreviewSrc(ref) {
    return isDataImageUrl(ref) ? ref : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
}

function hydratePhotoElements(root = document) {
    const nodes = Array.from((root || document).querySelectorAll('img[data-photo-ref]'));
    nodes.forEach(node => {
        const encoded = node.getAttribute('data-photo-ref') || '';
        const ref = decodePhotoRef(encoded);
        if (!ref) return;
        if (isDataImageUrl(ref)) {
            if (!node.getAttribute('src')) node.setAttribute('src', ref);
            return;
        }
        resolvePhotoDataUrl(ref).then(src => {
            if (src) node.setAttribute('src', src);
        });
    });
}

function dayHasContent(day) {
    if (!isPlainObject(day)) return false;
    if (Object.values(day.counts || {}).some(v => (v || 0) > 0)) return true;
    if (Array.isArray(day.photos) && day.photos.length > 0) return true;
    if (Array.isArray(day.custom) && day.custom.length > 0) return true;
    if (typeof day.notes === 'string' && day.notes.trim()) return true;
    if (Array.isArray(day.sessions) && day.sessions.some(s => {
        if (!isPlainObject(s)) return false;
        if (Object.values(s.counts || {}).some(v => (v || 0) > 0)) return true;
        if (Array.isArray(s.photos) && s.photos.length > 0) return true;
        if (Array.isArray(s.determinations) && s.determinations.length > 0) return true;
        if (typeof s.notes === 'string' && s.notes.trim()) return true;
        return false;
    })) return true;
    return false;
}

function isVersionedStorageKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key === STORAGE_KEY) return false;
    if (key === STORAGE_MIGRATION_STATE_KEY) return false;
    if (!key.startsWith('paddentrek_')) return false;
    const suffix = key.slice('paddentrek_'.length).toLowerCase();
    // Ondersteunt oude varianten zoals v1 / v2.0 en nieuwe zoals 2.2.4
    return /^v?\d/.test(suffix);
}

function listVersionedStorageKeys() {
    return Object.keys(localStorage)
        .filter(isVersionedStorageKey)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function listLegacyStorageSnapshots() {
    return listVersionedStorageKeys()
        .filter(k => k !== STORAGE_KEY_VERSIONED)
        .map(key => {
            const raw = localStorage.getItem(key) || '';
            const data = safeParseJSON(raw);
            if (!data) return null;
            const dayKeys = Object.keys(data);
            const nonEmptyDayCount = dayKeys.filter(d => dayHasContent(data[d])).length;
            return { key, data, dayCount: dayKeys.length, nonEmptyDayCount, rawSize: raw.length };
        })
        .filter(Boolean)
        .sort((a, b) =>
            (b.nonEmptyDayCount - a.nonEmptyDayCount) ||
            (b.dayCount - a.dayCount) ||
            (b.rawSize - a.rawSize) ||
            b.key.localeCompare(a.key, undefined, { numeric: true, sensitivity: 'base' })
        );
}

function getLegacyMigrationState() {
    return safeParseJSON(localStorage.getItem(STORAGE_MIGRATION_STATE_KEY));
}

function setLegacyMigrationState(payload) {
    localStorage.setItem(STORAGE_MIGRATION_STATE_KEY, JSON.stringify(payload));
}

function getAppMajorVersion() {
    const major = parseInt(String(APP_VERSION || '').split('.')[0], 10);
    return Number.isFinite(major) ? major : 0;
}

function getAutoV3MigrationState() {
    const parsed = safeParseJSON(localStorage.getItem(AUTO_V3_MIGRATION_STATE_KEY));
    return isPlainObject(parsed) ? parsed : null;
}

function setAutoV3MigrationState(payload) {
    localStorage.setItem(AUTO_V3_MIGRATION_STATE_KEY, JSON.stringify(payload || {}));
}

function shouldRunAutoV3Migration() {
    if (getAppMajorVersion() < 3) return false;
    const state = getAutoV3MigrationState();
    return !state?.doneAt;
}

function getReportTrendShowEmptySetting() {
    const raw = localStorage.getItem(REPORT_TREND_SHOW_EMPTY_KEY);
    if (raw === null) return true;
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return true;
}

function setReportTrendShowEmptySetting(enabled) {
    reportTrendShowEmptyDays = !!enabled;
    localStorage.setItem(REPORT_TREND_SHOW_EMPTY_KEY, reportTrendShowEmptyDays ? '1' : '0');
}

function encodeBase64Url(str) {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(str) {
    if (!str || typeof str !== 'string') return '';
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return decodeURIComponent(escape(atob(b64 + pad)));
}

function randomHex(len = 8) {
    const chars = 'abcdef0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `id_${Date.now()}_${randomHex(16)}`;
}

function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
    const keys = Object.keys(v).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

function simpleHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

function normalizeRouteName(name = '') {
    return String(name || '').replace(/\s+/g, ' ').trim();
}

function normalizeRouteHistory(list = []) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach(item => {
        const route = normalizeRouteName(item);
        if (!route) return;
        const key = route.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(route);
    });
    return out.slice(0, 60);
}

function stripLegacyTeamFields(obj) {
    if (!isPlainObject(obj)) return false;
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(obj, 'teamRunId')) {
        delete obj.teamRunId;
        changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'teamLabel')) {
        delete obj.teamLabel;
        changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'lastTeamRunId')) {
        delete obj.lastTeamRunId;
        changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'lastTeamLabel')) {
        delete obj.lastTeamLabel;
        changed = true;
    }
    return changed;
}

function getContributorProfile() {
    const parsed = safeParseJSON(localStorage.getItem(CONTRIBUTOR_PROFILE_KEY));
    const profile = isPlainObject(parsed) ? parsed : {};
    if (typeof profile.id !== 'string' || !profile.id.trim()) profile.id = generateUUID();
    if (typeof profile.name !== 'string') profile.name = '';
    stripLegacyTeamFields(profile);
    profile.lastRouteName = normalizeRouteName(profile.lastRouteName || '');
    profile.routeHistory = normalizeRouteHistory(profile.routeHistory || []);
    if (profile.lastRouteName) {
        profile.routeHistory = normalizeRouteHistory([profile.lastRouteName, ...profile.routeHistory]);
    }
    return profile;
}

function saveContributorProfile(profile) {
    const lastRouteName = normalizeRouteName(profile?.lastRouteName || '');
    let routeHistory = normalizeRouteHistory(profile?.routeHistory || []);
    if (lastRouteName) routeHistory = normalizeRouteHistory([lastRouteName, ...routeHistory]);
    const payload = {
        id: typeof profile?.id === 'string' ? profile.id : generateUUID(),
        name: typeof profile?.name === 'string' ? profile.name.trim() : '',
        lastRouteName,
        routeHistory
    };
    localStorage.setItem(CONTRIBUTOR_PROFILE_KEY, JSON.stringify(payload));
    return payload;
}

function rememberRoutePreference(routeName = '') {
    const route = normalizeRouteName(routeName);
    if (!route) return false;
    const profile = getContributorProfile();
    const next = saveContributorProfile({
        ...profile,
        lastRouteName: route,
        routeHistory: [route, ...(profile.routeHistory || [])]
    });
    return !!next.lastRouteName;
}

function localContributorRosterEntry(routeName = '') {
    const profile = getContributorProfile();
    const contributorId = profile?.id ? `local_user_${profile.id}` : `local_user_${simpleHash('local')}`;
    return {
        id: contributorId,
        name: 'mezelf',
        route: normalizeRouteName(routeName || '')
    };
}

function ensureLocalSessionContributorDefaults(session) {
    if (!session || session.detTemp) return false;
    if (Array.isArray(session.contributions) && session.contributions.length > 0) return false;
    let changed = false;
    if (!Array.isArray(session.contributorRoster)) {
        session.contributorRoster = [];
        changed = true;
    }
    if (!session.contributorRoster.length) {
        session.contributorRoster = [localContributorRosterEntry(session.routeName || '')];
        changed = true;
    }
    if (typeof session.autoContributorNote !== 'string' || !session.autoContributorNote.trim()) {
        session.autoContributorNote = 'Data van mezelf';
        changed = true;
    }
    return changed;
}

function currentDayIsoFallback() {
    return new Date().toISOString().split('T')[0];
}

function updateContributorInputsFromProfile() {
    const profile = getContributorProfile();
    const nameInput = document.getElementById('share-contributor-name');
    const routeInput = document.getElementById('share-route-name');
    if (nameInput && !nameInput.value.trim() && profile.name) nameInput.value = profile.name;
    if (routeInput && !routeInput.value.trim() && profile.lastRouteName) routeInput.value = profile.lastRouteName;
}

function handleShareRouteChange(commitHistory = false) {
    const routeInput = document.getElementById('share-route-name');
    if (!routeInput) return;
    const raw = routeInput.value || '';
    const route = normalizeRouteName(raw);
    if (raw !== route) routeInput.value = route;
    const profile = getContributorProfile();
    const payload = {
        ...profile,
        lastRouteName: route
    };
    if (commitHistory && route) {
        payload.routeHistory = [route, ...(profile.routeHistory || [])];
    }
    saveContributorProfile(payload);
    if (commitHistory && route) buildRouteSuggestions();
    const hint = document.getElementById('share-identity-hint');
    if (hint) handleShareIdentityChange(false);
}

function handleShareIdentityChange(refreshQr = true) {
    const profile = getContributorProfile();
    const nameInput = document.getElementById('share-contributor-name');
    const routeInput = document.getElementById('share-route-name');
    const hint = document.getElementById('share-identity-hint');
    const name = (nameInput?.value || '').trim();
    const route = normalizeRouteName(routeInput?.value || profile.lastRouteName || '');
    saveContributorProfile({
        ...profile,
        name: name || profile.name || '',
        lastRouteName: route
    });
    if (hint) {
        hint.innerText = name
            ? `Je deelt als ${name}${route ? ` · Traject ${route}` : ''}`
            : `Vul je naam in voor je deelt.${route ? ` Traject: ${route}` : ''}`;
    }
    if (refreshQr) generateQR(false);
}

function ensureContributorIdentity() {
    const profile = getContributorProfile();
    const nameInput = document.getElementById('share-contributor-name');
    const fromInput = (nameInput?.value || '').trim();
    const contributorName = (fromInput || profile.name || '').trim();
    if (nameInput && !fromInput) {
        alert('Vul eerst je naam in bij "Jouw naam".');
        nameInput.focus();
        return null;
    }
    if (!contributorName || contributorName.toLowerCase() === 'onbekende teller') {
        alert('Vul eerst je naam in bij "Jouw naam".');
        if (nameInput) nameInput.focus();
        return null;
    }
    const nextProfile = saveContributorProfile({
        ...profile,
        name: contributorName
    });
    if (nameInput) nameInput.value = nextProfile.name;
    return { contributorId: nextProfile.id, contributorName: nextProfile.name };
}

function getImportedSyncIds() {
    const raw = localStorage.getItem(SYNC_IMPORTED_IDS_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(v => typeof v === 'string');
    } catch (_) {
        return [];
    }
}

function getSyncImportRegistry() {
    const parsed = safeParseJSON(localStorage.getItem(SYNC_IMPORTED_REGISTRY_KEY));
    const registry = isPlainObject(parsed) ? parsed : {};
    // Backward compat: oude lijst van IDs migreren naar registry
    getImportedSyncIds().forEach(id => {
        if (typeof id !== 'string' || !id.trim()) return;
        if (!registry[id]) registry[id] = { importedAt: Date.now(), hash: '', dayKey: '', sessionId: '' };
    });
    return registry;
}

function setSyncImportRegistry(registry) {
    localStorage.setItem(SYNC_IMPORTED_REGISTRY_KEY, JSON.stringify(registry || {}));
}

function getSyncImportEntry(id) {
    if (!id || typeof id !== 'string') return null;
    return getSyncImportRegistry()[id] || null;
}

function markSyncImported(id, info = {}) {
    if (!id || typeof id !== 'string') return;
    const ids = getImportedSyncIds();
    if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(SYNC_IMPORTED_IDS_KEY, JSON.stringify(ids.slice(-300)));
    }
    const registry = getSyncImportRegistry();
    registry[id] = {
        hash: typeof info.hash === 'string' ? info.hash : (registry[id]?.hash || ''),
        dayKey: typeof info.dayKey === 'string' ? info.dayKey : (registry[id]?.dayKey || ''),
        sessionId: typeof info.sessionId === 'string' ? info.sessionId : (registry[id]?.sessionId || ''),
        importedAt: Date.now()
    };
    setSyncImportRegistry(registry);
}

function isSyncAlreadyImported(id) {
    if (!id || typeof id !== 'string') return false;
    return !!getSyncImportEntry(id);
}

let storage = safeParseJSON(localStorage.getItem(STORAGE_KEY)) || safeParseJSON(localStorage.getItem(STORAGE_KEY_VERSIONED));
let activeDeterminationId = null;
let activeDeterminationSessionId = null;
let detPhotoTargetId = null;
let detCredits = null;
// Migreer indien versie is opgehoogd zodat data behouden blijft
if (!storage) {
    const fallback = listLegacyStorageSnapshots()[0];
    storage = fallback ? cloneJSON(fallback.data) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
} else {
    // Schrijf enkel nog naar paddentrek_data; versie-keys blijven legacy fallback.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}
reportTrendShowEmptyDays = getReportTrendShowEmptySetting();
runCoreSchemaMigrations();
let activeSessionId = null;
// Schema v2: per day stores counts, custom, photos, notes, weather, sessions
// session object: { id, start, end?, counts: {}, notes: '' }
let lastAction = null;
let tellingTimer = null;
let tellingStartTs = null;
let inactivityPromptTimer = null;
let inactivityAutoTimer = null;
const INACTIVITY_MS = 60 * 60 * 1000; // 1 uur
const INACTIVITY_AUTO_MS = 10 * 60 * 1000; // 10 minuten extra
const picker = document.getElementById('datePicker');

// Gebruik lokale datum (niet UTC) zodat dag juist blijft rond middernacht en tijdzones
const todayISO = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offsetMs);
    return local.toISOString().split('T')[0];
};

function setDateInputsToToday() {
    const today = todayISO();
    picker.value = today;
    const sd = document.getElementById('sessionDate');
    if (sd) sd.value = today;
    const pd = document.getElementById('photo-clean-date');
    if (pd) pd.value = today;
}

function isoWithDayOffset(baseIso, offsetDays = 0) {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(baseIso || '') ? baseIso : todayISO();
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() + Number(offsetDays || 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function changePickerDay(offsetDays = 0) {
    if (!picker) return;
    picker.value = isoWithDayOffset(picker.value || todayISO(), offsetDays);
    if (typeof picker.onchange === 'function') picker.onchange();
}

function shouldHideHeaderSelectors() {
    const day = ensureDay();
    const hasActiveSession = !!getActiveSession(day);
    const trendCard = document.getElementById('report-trend-card');
    const trendOpen = !!(trendCard && !trendCard.classList.contains('hidden') && trendCard.open);
    return hasActiveSession || (currentTab === 'report' && trendOpen);
}

function refreshHeaderSelectorVisibility() {
    const dateControls = document.getElementById('header-date-controls');
    const quickRow = document.getElementById('quick-session-row');
    const hide = shouldHideHeaderSelectors();
    if (dateControls) dateControls.classList.toggle('header-selectors-hidden', hide);
    if (quickRow) quickRow.classList.toggle('header-selectors-hidden', hide);
}

setDateInputsToToday();

function migrateLegacyDays() {
    let changed = false;
    for (const d in storage) {
        const day = ensureDay(d);
        const hasSessions = Array.isArray(day.sessions) && day.sessions.length > 0;
        if (hasSessions) continue;
        const counts = day.counts || {};
        const hasCounts = Object.values(counts).some(v => (v || 0) > 0);
        const hasPhotos = (day.photos || []).length > 0;
        if (!hasCounts && !hasPhotos) continue;
        const startIso = new Date(`${d}T00:00:00`).toISOString();
        const endIso = new Date(`${d}T23:59:00`).toISOString();
        day.sessions = [{
            id: `import_${d}`,
            start: startIso,
            end: endIso,
            counts: { ...counts },
            notes: day.notes || '',
            weather: day.weather || null,
            photos: day.photos || [],
            routeName: day.routeName || '',
            determinations: [],
            detTemp: false,
            includeInReports: true,
            contributions: [],
            contributorRoster: [],
            autoContributorNote: ''
        }];
        changed = true;
    }
    if (changed) {
        const str = JSON.stringify(storage);
        localStorage.setItem(STORAGE_KEY, str);
    }
}

function mergeLegacyIntoStorage(sourceData, targetData) {
    const merged = cloneJSON(targetData || {});
    let addedDays = 0;
    let replacedEmptyDays = 0;
    for (const dayKey in sourceData || {}) {
        const sourceDay = sourceData[dayKey];
        if (!isPlainObject(sourceDay)) continue;
        if (!Object.prototype.hasOwnProperty.call(merged, dayKey)) {
            merged[dayKey] = cloneJSON(sourceDay);
            addedDays++;
            continue;
        }
        if (!dayHasContent(merged[dayKey]) && dayHasContent(sourceDay)) {
            merged[dayKey] = cloneJSON(sourceDay);
            replacedEmptyDays++;
        }
    }
    return { merged, addedDays, replacedEmptyDays };
}

function mergeMultipleLegacySnapshots(snapshots, targetData) {
    let merged = cloneJSON(targetData || {});
    let addedDays = 0;
    let replacedEmptyDays = 0;
    const sourceStats = [];
    (Array.isArray(snapshots) ? snapshots : []).forEach(source => {
        if (!source || !isPlainObject(source.data)) return;
        const result = mergeLegacyIntoStorage(source.data, merged);
        merged = result.merged;
        addedDays += result.addedDays;
        replacedEmptyDays += result.replacedEmptyDays;
        sourceStats.push({
            key: source.key,
            dayCount: Number(source.dayCount || 0),
            nonEmptyDayCount: Number(source.nonEmptyDayCount || 0),
            addedDays: result.addedDays,
            replacedEmptyDays: result.replacedEmptyDays
        });
    });
    return { merged, addedDays, replacedEmptyDays, sourceStats };
}

function updateLegacyMigrationUI() {
    const card = document.getElementById('legacy-migrate-card');
    const btn = document.getElementById('legacy-migrate-btn');
    const cleanupBtn = document.getElementById('legacy-cleanup-btn');
    const cleanupHint = document.getElementById('legacy-cleanup-hint');
    const status = document.getElementById('legacy-migrate-status');
    if (!card || !btn || !status || !cleanupBtn || !cleanupHint) return;

    const versionedKeys = listVersionedStorageKeys();
    card.classList.remove('hidden');

    const legacyKeys = versionedKeys.filter(k => k !== STORAGE_KEY_VERSIONED);
    cleanupBtn.classList.add('hidden');
    cleanupHint.classList.add('hidden');
    cleanupHint.innerText = '';

    const state = getLegacyMigrationState();
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    if (state?.doneAt) {
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
        const when = new Date(state.doneAt).toLocaleString('nl-BE');
        const added = Number(state.addedDays || 0);
        const replaced = Number(state.replacedEmptyDays || 0);
        const sourcesFromState = Array.isArray(state.sources)
            ? state.sources.filter(Boolean)
            : (state.sourceKey ? [state.sourceKey] : []);
        const inferredSources = sourcesFromState.length ? sourcesFromState : legacyKeys;
        const sourceLines = Array.isArray(state.sourceStats)
            ? state.sourceStats
                .filter(s => s && s.key)
                .map(s => `${s.key}: ${Number(s.addedDays || 0)} toegevoegd, ${Number(s.replacedEmptyDays || 0)} aangevuld`)
            : [];
        const sourceSummary = inferredSources.length
            ? `Bronnen (${inferredSources.length}): ${inferredSources.join(', ')}`
            : 'Bronnen: onbekend';
        const detailSummary = sourceLines.length ? ` Details: ${sourceLines.join(' | ')}` : '';
        status.innerText =
            `Migratie uitgevoerd op ${when}. ${sourceSummary} (${added} toegevoegd, ${replaced} aangevuld).` +
            detailSummary;
        if (legacyKeys.length > 0) {
            cleanupBtn.disabled = false;
            cleanupBtn.classList.remove('hidden');
            cleanupHint.innerText = `Er staan nog ${legacyKeys.length} oude versie-key(s). Verwijder ze pas nadat je gecontroleerd hebt dat alles correct staat.`;
            cleanupHint.classList.remove('hidden');
        }
        return;
    }

    if (!legacyKeys.length) {
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
        status.innerText =
            'Geen oude versie-key(s) gevonden op dit toestel. ' +
            'Gebruik exact dezelfde browser + URL als vroeger om legacy data te vinden.';
        return;
    }

    const sources = listLegacyStorageSnapshots();
    if (!sources.length) {
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
        status.innerText =
            `Oude versie-key(s) gevonden (${legacyKeys.length}), maar geen leesbare oude data om te migreren.`;
        return;
    }

    btn.disabled = false;
    const preview = sources
        .slice(0, 4)
        .map(s => `${s.key} (${s.nonEmptyDayCount || s.dayCount} dag(en))`)
        .join(', ');
    const more = sources.length > 4 ? ` +${sources.length - 4} extra` : '';
    status.innerText =
        `Klaar om te migreren vanuit ${sources.length} bron(nen): ${preview}${more}.`;
}

function migrateLegacyStorageManually() {
    const state = getLegacyMigrationState();
    if (state?.doneAt) {
        showToast('Migratie is al uitgevoerd');
        updateLegacyMigrationUI();
        return;
    }

    const sources = listLegacyStorageSnapshots();
    if (!sources.length) {
        alert('Geen oude data gevonden onder paddentrek_*.');
        updateLegacyMigrationUI();
        return;
    }

    const sourceKeys = sources.map(s => s.key);
    const ok = confirm(
        `Oude data overzetten van ${sources.length} bron(nen) naar ${STORAGE_KEY}?\n\n` +
        `${sourceKeys.join('\n')}\n\n` +
        'Dit kan maar 1 keer via deze knop.'
    );
    if (!ok) return;

    const result = mergeMultipleLegacySnapshots(sources, storage);
    storage = result.merged;
    migrateLegacyDays();
    save();
    setLegacyMigrationState({
        doneAt: new Date().toISOString(),
        sourceKey: sourceKeys[0] || '',
        sources: sourceKeys,
        sourceStats: result.sourceStats,
        addedDays: result.addedDays,
        replacedEmptyDays: result.replacedEmptyDays
    });

    buildUI();
    render();
    renderSessionAdmin();
    buildQRSessionOptions();
    buildReportSessionOptions();
    buildImportTargetOptions();
    renderStorageInspector(true);
    updateLegacyMigrationUI();

    if ((result.addedDays + result.replacedEmptyDays) === 0) {
        showToast('Migratie uitgevoerd (geen nieuwe dagen)');
        alert(
            `Migratie uitgevoerd, maar er was geen ontbrekende data om toe te voegen.\n\n` +
            `Bronnen:\n${sourceKeys.join('\n')}`
        );
        return;
    }
    showToast('Oude data overgezet');
    alert(
        `Migratie klaar.\nBronnen (${sourceKeys.length}):\n${sourceKeys.join('\n')}\n\n` +
        `Toegevoegd: ${result.addedDays} dag(en)\n` +
        `Aangevuld: ${result.replacedEmptyDays} lege dag(en).`
    );
}

function cleanupLegacyStorageKeys() {
    const state = getLegacyMigrationState();
    if (!state?.doneAt) {
        alert('Voer eerst de migratie uit.');
        return;
    }
    const legacyKeys = listVersionedStorageKeys().filter(k => k !== STORAGE_KEY_VERSIONED);
    if (!legacyKeys.length) {
        showToast('Geen oude data om te verwijderen');
        updateLegacyMigrationUI();
        return;
    }
    const ok = confirm(
        `Verwijder ${legacyKeys.length} oude storage key(s)?\n\n` +
        `${legacyKeys.join('\n')}\n\n` +
        'Dit verwijdert alleen oude kopieën. paddentrek_data blijft behouden.'
    );
    if (!ok) return;
    legacyKeys.forEach(k => localStorage.removeItem(k));
    renderStorageInspector(true);
    updateLegacyMigrationUI();
    showToast('Oude data verwijderd');
}

// Zorgt dat een dag-object altijd alle sleutels heeft voordat we ermee werken
function ensureDay(d = picker.value) {
    if (!storage[d]) storage[d] = { counts: {}, custom: [], photos: [], notes: "", sessions: [], weather: null };
    const day = storage[d];
    stripLegacyTeamFields(day);
    if (!day.counts) day.counts = {};
    normalizeCountKeySchema(day.counts);
    if (!day.custom) day.custom = [];
    if (!day.photos) day.photos = [];
    if (typeof day.notes !== 'string') day.notes = "";
    if (!day.sessions) day.sessions = [];
    if (!day.weather) day.weather = null;
    day.sessions.forEach(s => {
        stripLegacyTeamFields(s);
        if (!s.counts) s.counts = {};
        normalizeCountKeySchema(s.counts);
        if (!s.photos) s.photos = [];
        if (!s.determinations) s.determinations = [];
        if (!s.routeName) s.routeName = "";
        if (typeof s.notes !== 'string') s.notes = "";
        if (!s.weather) s.weather = null;
        if (typeof s.includeInReports !== 'boolean') s.includeInReports = true;
        if (!Array.isArray(s.contributions)) s.contributions = [];
        s.contributions.forEach(c => {
            stripLegacyTeamFields(c);
            normalizeCountKeySchema(c?.counts);
        });
        if (!Array.isArray(s.contributorRoster)) s.contributorRoster = [];
        if (typeof s.autoContributorNote !== 'string') s.autoContributorNote = '';
        ensureLocalSessionContributorDefaults(s);
    });
    return day;
}

function findRunningSessionAcrossDays() {
    for (const d in storage) {
        const day = ensureDay(d);
        const sess = day.sessions.find(s => !s.end);
        if (sess) return { dayKey: d, session: sess };
    }
    return null;
}

function splitSessionOverMidnightIfNeeded() {
    const today = todayISO();
    const running = findRunningSessionAcrossDays();
    if (!running) return;
    if (running.dayKey === today) return;

    const prevDay = ensureDay(running.dayKey);
    const sess = prevDay.sessions.find(s => s.id === running.session.id);
    if (!sess) return;

    // sluit vorige dag af op 23:59
    const prevEnd = new Date(`${running.dayKey}T23:59:00`).toISOString();
    sess.end = prevEnd;
    recalcDayFromSessions(prevDay);

    // start nieuwe sessie op nieuwe dag, leeg zodat nieuwe tellingen correct landen
    const newDay = ensureDay(today);
    const newSession = {
        id: 'sess_' + Date.now(),
        start: new Date(`${today}T00:00:00`).toISOString(),
        counts: {},
        notes: '',
        weather: null,
        photos: [],
        routeName: sess.routeName || '',
        determinations: [],
        includeInReports: true,
        contributions: [],
        contributorRoster: [],
        autoContributorNote: ''
    };
    ensureLocalSessionContributorDefaults(newSession);
    newDay.sessions.push(newSession);
    activeSessionId = newSession.id;
    viewedSessionId = newSession.id;
    setDateInputsToToday();
    save();
    showToast('Telling gesplitst om middernacht');
}

function migrateOldSchema() {
    for (const d in storage) {
        const day = storage[d];
        stripLegacyTeamFields(day);
        if (!day.sessions) day.sessions = [];
        if (!day.custom) day.custom = [];
        if (!day.photos) day.photos = [];
        if (typeof day.notes !== 'string') day.notes = "";
        if (!day.weather) day.weather = null;
        day.sessions.forEach(s => {
            stripLegacyTeamFields(s);
            if (!s.counts) s.counts = {};
            if (!s.photos) s.photos = [];
            if (!s.determinations) s.determinations = [];
            if (!s.routeName) s.routeName = "";
            if (typeof s.notes !== 'string') s.notes = "";
            if (!s.weather) s.weather = null;
            if (typeof s.includeInReports !== 'boolean') s.includeInReports = true;
            if (!Array.isArray(s.contributions)) s.contributions = [];
            s.contributions.forEach(c => stripLegacyTeamFields(c));
            if (!Array.isArray(s.contributorRoster)) s.contributorRoster = [];
            if (typeof s.autoContributorNote !== 'string') s.autoContributorNote = '';
            ensureLocalSessionContributorDefaults(s);
        });
    }
    save();
}

function migrateCounterKeySchema() {
    let changed = false;
    for (const d in storage) {
        const day = storage[d];
        if (!day || typeof day !== 'object') continue;
        if (normalizeCountKeySchema(day.counts)) changed = true;
        (Array.isArray(day.sessions) ? day.sessions : []).forEach(s => {
            if (normalizeCountKeySchema(s.counts)) changed = true;
            if (Array.isArray(s.contributions)) {
                s.contributions.forEach(c => {
                    if (normalizeCountKeySchema(c?.counts)) changed = true;
                });
            }
        });
    }
    if (changed) save();
}

function migrateLegacyContributions() {
    let changed = false;
    for (const d in storage) {
        const day = ensureDay(d);
        (day.sessions || []).forEach(s => {
            if (!Array.isArray(s.contributions)) s.contributions = [];
            if (typeof s.includeInReports !== 'boolean') s.includeInReports = true;
            if (!sumCounts(s.counts || {})) return;
            if (!s.contributions.length) {
                const contributionId = `legacy_contrib_${simpleHash(`${d}|${s.id}`)}`;
                const hash = simpleHash(stableStringify(s.counts || {}));
                s.contributions.push({
                    contributionId,
                    hash,
                    counts: cloneJSON(s.counts || {}),
                    createdAt: s.start ? new Date(s.start).getTime() : Date.now(),
                    sourceDate: d,
                    sourceLabel: s.id || 'legacy',
                    contributorId: `legacy_user_${simpleHash(`${d}|${s.id}|local`)}`,
                    contributorName: 'mezelf',
                    importedAt: Date.now()
                });
                changed = true;
            }
            rebuildSessionContributorRoster(s);
        });
    }
    if (changed) save();
}

function runCoreSchemaMigrations() {
    migrateLegacyDays();
    migrateOldSchema();
    migrateCounterKeySchema();
    migrateLegacyContributions();
}

function removeLegacyVersionedKeysAfterAutoMigration() {
    const keys = listVersionedStorageKeys().filter(k => k !== STORAGE_KEY_VERSIONED);
    keys.forEach(k => localStorage.removeItem(k));
    return keys;
}

function countInlinePhotoDataUrlsInStorage() {
    let total = 0;
    for (const dayKey in storage || {}) {
        const day = storage[dayKey];
        if (!day || typeof day !== 'object') continue;
        (Array.isArray(day.photos) ? day.photos : []).forEach(v => { if (isDataImageUrl(v)) total++; });
        (Array.isArray(day.sessions) ? day.sessions : []).forEach(session => {
            (Array.isArray(session?.photos) ? session.photos : []).forEach(v => { if (isDataImageUrl(v)) total++; });
            (Array.isArray(session?.determinations) ? session.determinations : []).forEach(det => {
                (Array.isArray(det?.photos) ? det.photos : []).forEach(v => { if (isDataImageUrl(v)) total++; });
            });
        });
    }
    return total;
}

async function migratePhotoArrayToIndexedDbRefs(photoArr, meta = {}, cache = new Map()) {
    if (!Array.isArray(photoArr) || !photoArr.length) {
        return { converted: 0, failed: 0 };
    }
    let converted = 0;
    let failed = 0;
    for (let i = 0; i < photoArr.length; i++) {
        const value = photoArr[i];
        if (!isDataImageUrl(value)) continue;
        if (cache.has(value)) {
            const cached = cache.get(value);
            if (cached && cached !== value) {
                photoArr[i] = cached;
                converted++;
            }
            continue;
        }
        try {
            const ref = await putPhotoRecord(value, meta);
            cache.set(value, ref);
            photoArr[i] = ref;
            converted++;
        } catch (err) {
            cache.set(value, value);
            failed++;
            console.warn('Foto-migratie naar IndexedDB mislukt voor 1 item.', err);
        }
    }
    return { converted, failed };
}

async function migrateStoragePhotosToIndexedDbRefs() {
    const cache = new Map();
    let converted = 0;
    let failed = 0;
    const dayKeys = Object.keys(storage || {});
    for (let i = 0; i < dayKeys.length; i++) {
        const dayKey = dayKeys[i];
        const day = ensureDay(dayKey);
        const dayPhotoResult = await migratePhotoArrayToIndexedDbRefs(day.photos, { dayKey, source: 'day' }, cache);
        converted += dayPhotoResult.converted;
        failed += dayPhotoResult.failed;

        for (let j = 0; j < (day.sessions || []).length; j++) {
            const session = day.sessions[j];
            const sessionResult = await migratePhotoArrayToIndexedDbRefs(
                session.photos,
                { dayKey, sessionId: session.id || '', source: 'session' },
                cache
            );
            converted += sessionResult.converted;
            failed += sessionResult.failed;
            for (let k = 0; k < (session.determinations || []).length; k++) {
                const det = session.determinations[k];
                const detResult = await migratePhotoArrayToIndexedDbRefs(
                    det.photos,
                    { dayKey, sessionId: session.id || '', source: 'determination' },
                    cache
                );
                converted += detResult.converted;
                failed += detResult.failed;
            }
        }
        day.photos = (day.sessions || []).flatMap(s => Array.isArray(s.photos) ? s.photos : []);
    }
    return {
        converted,
        failed,
        remainingInline: countInlinePhotoDataUrlsInStorage()
    };
}

async function runAutomaticV3UpgradeMigration() {
    if (!shouldRunAutoV3Migration()) return { ran: false, completed: true };
    const startedAt = new Date().toISOString();
    const sources = listLegacyStorageSnapshots();
    let mergeStats = { addedDays: 0, replacedEmptyDays: 0, sourceStats: [] };
    if (sources.length) {
        const merged = mergeMultipleLegacySnapshots(sources, storage);
        storage = merged.merged;
        mergeStats = {
            addedDays: Number(merged.addedDays || 0),
            replacedEmptyDays: Number(merged.replacedEmptyDays || 0),
            sourceStats: Array.isArray(merged.sourceStats) ? merged.sourceStats : []
        };
    }

    runCoreSchemaMigrations();
    const beforeInline = countInlinePhotoDataUrlsInStorage();
    const photoStats = await migrateStoragePhotosToIndexedDbRefs();
    save();

    const completed = Number(photoStats.failed || 0) === 0 && Number(photoStats.remainingInline || 0) === 0;
    const removedLegacyKeys = completed ? removeLegacyVersionedKeysAfterAutoMigration() : [];
    if (removedLegacyKeys.length) save();

    const payload = {
        version: APP_VERSION,
        startedAt,
        finishedAt: new Date().toISOString(),
        doneAt: completed ? new Date().toISOString() : '',
        sources: sources.map(s => s.key),
        sourceStats: mergeStats.sourceStats,
        addedDays: mergeStats.addedDays,
        replacedEmptyDays: mergeStats.replacedEmptyDays,
        beforeInlinePhotos: beforeInline,
        convertedPhotos: Number(photoStats.converted || 0),
        failedPhotos: Number(photoStats.failed || 0),
        remainingInlinePhotos: Number(photoStats.remainingInline || 0),
        removedLegacyKeys
    };
    setAutoV3MigrationState(payload);
    if (completed && sources.length) {
        setLegacyMigrationState({
            doneAt: payload.doneAt,
            sourceKey: sources[0]?.key || '',
            sources: sources.map(s => s.key),
            sourceStats: mergeStats.sourceStats,
            addedDays: mergeStats.addedDays,
            replacedEmptyDays: mergeStats.replacedEmptyDays
        });
    }

    if (completed && (sources.length || photoStats.converted || removedLegacyKeys.length)) {
        showToast('Data automatisch gemigreerd naar v3');
    }
    if (!completed) {
        console.warn('Automatische v3-migratie nog niet volledig afgerond.', payload);
    }
    return { ran: true, completed, payload };
}

function buildUI() {
    document.getElementById('render-target').innerHTML = SPECIES.map(s => renderCard(s)).join('');
    renderCustom();
    renderSessionLog();
}

function renderCard(s, custom = false) {
    // Determine image source
    let imgHTML = '';
    if (s.image) {
        imgHTML = `<img src="${s.image}" class="w-12 h-12 rounded object-cover border border-emerald-500/30">`;
    } else {
        imgHTML = `<div class="text-3xl">${s.icon || '🐸'}</div>`;
    }

    const nameDisplay = custom ?
        `<span class="font-bold text-emerald-200">${s.name}</span> <span class="text-[10px] text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">Eigen</span>` :
        `<span class="font-bold text-gray-100">${s.name}</span>`;

    // Visual zones: Green tint for live, Red tint for dead
    return `
    <div class="bg-gray-800 rounded-xl p-3 shadow-lg border border-gray-700 w-full mb-4">
        <div class="flex items-center gap-3 mb-3 border-b border-gray-700 pb-2">
            ${imgHTML}
            <div class="flex-1 leading-tight">
                ${nameDisplay}
                <div class="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">${s.latin || ''}</div>
            </div>
            <div class="text-[9px] bg-black/40 px-2 py-1 rounded text-gray-400">
                TOT: <span id="tot-${s.id}" class="text-white font-bold">0</span>
            </div>
        </div>
        
        <div class="grid grid-cols-2 gap-3">
            <!-- LEVEND ZONE -->
            <div class="space-y-2 bg-emerald-900/10 p-2 rounded-lg border border-emerald-500/10">
                <div class="text-[10px] text-emerald-400 font-bold text-center uppercase tracking-widest mb-1 opacity-80">Levend</div>
                
                ${renderCounterRow(s.id, 'p_l', 'Paar', 'live')}
                ${renderCounterRow(s.id, 'm_l', 'Man', 'live')}
                ${renderCounterRow(s.id, 'v_l', 'Vrouw', 'live')}
                ${renderCounterRow(s.id, 'o_l', 'Onb', 'live')}
            </div>

            <!-- DOOD ZONE -->
            <div class="space-y-2 bg-red-900/10 p-2 rounded-lg border border-red-500/10">
                <div class="text-[10px] text-red-400 font-bold text-center uppercase tracking-widest mb-1 opacity-80">Dood</div>
                
                ${renderCounterRow(s.id, 'p_d', 'Paar', 'dead')}
                ${renderCounterRow(s.id, 'm_d', 'Man', 'dead')}
                ${renderCounterRow(s.id, 'v_d', 'Vrouw', 'dead')}
                ${renderCounterRow(s.id, 'o_d', 'Onb', 'dead')}
            </div>
        </div>
    </div>`;
}

function renderCounterRow(speciesId, key, label, type) {
    const isDead = type === 'dead';
    const btnColorDelta = isDead ? 'bg-red-900/60 hover:bg-red-700' : 'bg-emerald-600/80 hover:bg-emerald-500';
    const id = `${speciesId}_${key}`;
    const valId = `val_${id}`;

    return `
    <div class="flex items-center justify-between bg-gray-900/50 rounded-lg p-1">
        <button onclick="mod('${id}', -1, event)" class="w-8 h-8 rounded bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-transform">-</button>
        <div class="flex flex-col items-center">
            <span id="${valId}" class="text-xl font-bold text-white font-mono leading-none">0</span>
            <span class="text-[9px] text-gray-500 uppercase tracking-widest">${label}</span>
        </div>
        <button onclick="mod('${id}', 1, event)" class="w-12 h-10 rounded ${btnColorDelta} text-white flex items-center justify-center font-bold text-xl shadow-lg active:scale-95 transition-transform counter-btn">+</button>
    </div>`;
}

function livePairLabel() {
    return `<span class="inline-flex items-center gap-1 text-[15px] font-bold">
                <span class="icon-lg font-bold">M</span>
                <span class="icon-lg" style="color:#f87171;">❤️</span>
                <span class="icon-lg font-bold">V</span>
            </span>`;
}
function deadPairLabel() {
    return `<span class="inline-flex items-center gap-1">
                <span class="icon-lg">☠️</span>
                <span class="icon-lg font-bold">M</span>
                <span class="icon-lg" style="color:#f87171;">❤️</span>
                <span class="icon-lg font-bold">V</span>
            </span>`;
}

function iconLabel(key, dead = false) {
    const isM = key.startsWith('m') || key.includes('m_');
    const isV = key.startsWith('v') || key.includes('v_');
    const isO = key.startsWith('o') || key.includes('o_');
    const male = `<span class="icon-lg font-bold">M</span>`;
    const female = `<span class="icon-lg font-bold">V</span>`;
    const unk = `<span class="icon-lg font-bold">?</span>`;
    const skull = `<span class="icon-lg">☠️</span>`;
    if (isM) return dead ? `${skull}${male}` : `${male}`;
    if (isV) return dead ? `${skull}${female}` : `${female}`;
    if (isO) return dead ? `${skull}${unk}` : `${unk}`;
    return key;
}

function btn(sid, type, color, label, dood = false) {
    const key = `${sid}_${type}`;
    let cls = dood ? 'bg-red-950/40 border-red-900/40 text-red-300' : `bg-${color}-700 border-white/5 text-white shadow-sm`;
    if (color === 'emerald' && type === 'p_l') cls = 'bg-emerald-600 border-emerald-400/20';
    if (color === 'amber') cls = dood ? 'bg-red-950/40' : 'bg-amber-700';
    if (color === 'yellow') cls = dood ? 'bg-red-950/40' : 'bg-yellow-700';

    return `
                <div class="flex items-center gap-1">
                    <button onclick="mod('${key}', 1, event)" class="counter-btn flex-grow ${cls} h-10 rounded-lg font-bold text-[14px] border active:scale-95">
                        <span class="inline-flex items-center gap-1 align-middle">${label}</span>: <span id="${key}">0</span>
                    </button>
                    <button onclick="mod('${key}', -1, event)" class="minus-btn bg-gray-700/40 w-8 h-10 rounded-lg text-gray-500 border border-gray-600/20 active:bg-gray-600">-</button>
                </div>
            `;
}

function mod(key, val, e) {
    splitSessionOverMidnightIfNeeded();
    const d = picker.value;
    const day = ensureDay(d);
    let active = getActiveSession(day);
    if (!active) {
        startSession(true, false, d, false, false, false); // auto-start zonder redirect of modal
        active = getActiveSession(day);
    }
    day.counts[key] = (day.counts[key] || 0) + val;
    if (day.counts[key] < 0) day.counts[key] = 0;
    // Also bump active session if running
    if (active) {
        active.counts[key] = (active.counts[key] || 0) + val;
        if (active.counts[key] < 0) active.counts[key] = 0;
    }
    save(); render();
    recordUserAction();
    if (val > 0) {
        vibe(22, true);
        if (key.includes('_p_l')) celebrate(e, true);
        else if (key.includes('_l')) celebrate(e);
        else if (key.includes('_d')) celebrate(e, false, true);
    }
}

function save() {
    const str = JSON.stringify(storage);
    localStorage.setItem(STORAGE_KEY, str);
}

// --- DEV STORAGE INSPECTOR ---
function formatBytes(b) {
    if (!b || isNaN(b)) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
    return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function renderStorageInspector(forceReload = false) {
    const box = document.getElementById('storage-inspector');
    const meta = document.getElementById('storage-meta');
    if (!box || !meta) return;
    const search = (document.getElementById('storage-search')?.value || '').toLowerCase();
    const keys = Object.keys(localStorage).sort();
    let totalBytes = 0;
    const rows = keys.map(k => {
        const raw = localStorage.getItem(k) || '';
        totalBytes += raw.length;
        let pretty = raw;
        let type = 'string';
        let imgs = [];
        try {
            const parsed = JSON.parse(raw);
            pretty = JSON.stringify(parsed, null, 2);
            type = Array.isArray(parsed) ? 'array' : (parsed && typeof parsed === 'object' ? 'object' : typeof parsed);
            // verzamel foto-waarden (data URLs + IndexedDB refs) voor preview
            const collect = v => {
                if (typeof v === 'string' && (isDataImageUrl(v) || isIdbPhotoRef(v))) imgs.push(v);
                else if (Array.isArray(v)) v.forEach(collect);
                else if (v && typeof v === 'object') Object.values(v).forEach(collect);
            };
            collect(parsed);
        } catch (_) { /* keep raw */ }
        const hay = `${k} ${pretty}`.toLowerCase();
        if (search && !hay.includes(search)) return null;
        const badge = k === STORAGE_KEY ? '<span class="text-[9px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 px-2 py-1 rounded">actief</span>' : '';
        const imgHtml = imgs.map((src, idx) => `<button type="button" onclick="openInspectorPhoto('${idx}', '${k}')" class="block"><img src="${photoPreviewSrc(src)}" data-photo-ref="${encodePhotoRef(src)}" alt="foto ${idx + 1}" class="h-16 w-16 object-cover rounded border border-gray-700"></button>`).join('');
        return `<details class="bg-gray-900 border border-gray-800 rounded p-2">
                    <summary class="cursor-pointer flex justify-between items-center text-gray-200">${k} ${badge}<span class="text-[10px] text-gray-400">${type} · ${formatBytes(raw.length)}</span></summary>
                    <pre class="mt-2 bg-black/40 rounded p-2 whitespace-pre-wrap text-[10px] text-gray-200">${pretty.replace(/</g, '&lt;')}</pre>
                    ${imgHtml ? `<div class="mt-2 flex gap-2 flex-wrap">${imgHtml}</div>` : ''}
                </details>`;
    }).filter(Boolean);
    box.innerHTML = rows.join('') || '<div class="text-gray-500 text-[11px]">Geen matches.</div>';
    hydratePhotoElements(box);
    meta.innerText = `${keys.length} keys · ${formatBytes(totalBytes)} totaal opgeslagen`;
}

function render() {
    const d = ensureDay();
    const active = getActiveSession(d);
    const countsSource = active ? (active.counts || {}) : d.counts;
    const up = s => {
        let t = 0;
        ['p_l', 'p_d', 'm_l', 'v_l', 'o_l', 'm_d', 'v_d', 'o_d'].forEach(k => {
            const v = countsSource[`${s.id}_${k}`] || 0;
            const legacyEl = document.getElementById(`${s.id}_${k}`);
            if (legacyEl) legacyEl.innerText = v;
            const modernEl = document.getElementById(`val_${s.id}_${k}`);
            if (modernEl) modernEl.innerText = v;
            t += (k === 'p_l' || k === 'p_d') ? v * 2 : v;
        });
        if (document.getElementById(`tot-${s.id}`)) document.getElementById(`tot-${s.id}`).innerText = t;
    };
    SPECIES.forEach(up);
    (d.custom || []).forEach(up);
    renderSessions();
    renderSessionLog();
    buildReportSessionOptions();
    updateReport(); updateWeather();
    renderDetSessionOptions(); renderDeterminationUI(); renderDeterminationList();
}

function renderSessionLog() {
    const box = document.getElementById('session-log-container');
    if (!box) return;
    const day = ensureDay();
    const sessions = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    if (!sessions.length) { box.innerHTML = '<div class="text-gray-500 text-sm">Nog geen sessies vandaag.</div>'; return; }
    const selected = viewedSessionId || sessions[sessions.length - 1].id;
    box.innerHTML = sessions
        .filter(s => s.id === selected)
        .map(s => {
            const total = sumCounts(s.counts);
            const weather = weatherSummaryText(s.weather, ' • ', true);
            const weatherPolicy = getSessionWeatherFetchPolicy(s);
            const weatherDisabled = weatherPolicy.allowed ? '' : 'disabled';
            const weatherButtonClass = weatherPolicy.allowed
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-600 text-gray-300 opacity-70 cursor-not-allowed';
            const weatherHint = weatherPolicy.allowed
                ? ''
                : `<div class="text-[10px] text-amber-200 mt-1">Automatisch weer ophalen kan enkel tot 3 uur na einde sessie. Zet het weer manueel in notities.</div>`;
            const photos = s.photos || [];
            const label = sessionDisplayLabel(s, day);
            const autoNote = (s.autoContributorNote || '').trim();
            return `
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-3">
                        <div class="flex justify-between items-start gap-2">
                            <div>
                                <div class="text-xs text-gray-400">${label}</div>
                                <div class="text-lg font-bold text-white">${total} stuks</div>
                                ${autoNote ? `<div class="text-[10px] text-cyan-200 mt-1">🔗 ${autoNote}</div>` : ''}
                            </div>
                            <button class="bg-purple-700 px-2 py-1 rounded text-[10px]" onclick="triggerPhoto('${s.id}')">📸</button>
                        </div>
                            <label class="flex items-center gap-2 text-[11px] text-gray-300 bg-gray-900/60 border border-gray-700 rounded px-2 py-2">
                                <input type="checkbox" class="accent-emerald-500" ${s.includeInReports !== false ? 'checked' : ''} onchange="toggleSessionInclude('${s.id}','${picker.value}', this.checked)">
                                Meetellen in rapport en trendgrafiek
                            </label>
                            <div class="space-y-2 text-left">
                                <label class="text-[10px] uppercase text-gray-400 font-bold">Traject</label>
                                <input value="${s.routeName || ''}" oninput="updateRoute('${s.id}', this.value)" onchange="commitRoutePreference('${s.id}', this.value)" class="w-full bg-gray-700 rounded px-2 py-2 text-sm text-white border border-gray-600" placeholder="Sint-Amandsstraat, Pittem" list="route-suggestions">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-[10px] uppercase text-gray-400 font-bold">Weer</div>
                                    <div class="text-sm text-gray-200">${weather}</div>
                                    ${weatherHint}
                                </div>
                                <button class="${weatherButtonClass} px-3 py-1 rounded text-[10px]" ${weatherDisabled} onclick="fetchWeather(picker.value, '${s.id}')">Weerbericht ophalen</button>
                            </div>
                            <label class="text-[10px] uppercase text-gray-400 font-bold">Notities</label>
                            <textarea oninput="updateSessionNotes('${s.id}', this.value)" class="w-full bg-gray-700 border-none rounded p-3 text-sm h-20 text-white focus:ring-1 focus:ring-blue-500" placeholder="${autoNote ? 'Persoonlijke notities (onder teamdata)' : 'Notities'}">${s.notes || ''}</textarea>
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-[10px] text-gray-400">
                                <span>Foto's (${photos.length})</span>
                                <div class="flex gap-2">
                                    <button class="bg-purple-700 px-3 py-1 rounded text-white text-[10px]" onclick="triggerPhoto('${s.id}')">➕ Voeg foto</button>
                                    <button class="bg-purple-900/60 border border-purple-500 px-3 py-1 rounded text-white text-[10px]" onclick="shareSessionPhotos('${s.id}')">📤 Deel</button>
                                </div>
                            </div>
                            <div class="grid grid-cols-3 gap-2">
                                ${photos.map((p, i) => `
                                    <div class="relative">
                                        <img src="${photoPreviewSrc(p)}" data-photo-ref="${encodePhotoRef(p)}" class="rounded w-full aspect-square object-cover shadow cursor-pointer" onclick="openPhoto('${s.id}', ${i})">
                                        <button class="absolute top-1 right-1 bg-red-700 rounded-full w-5 h-5 text-[9px] font-bold" onclick="removeSessionPhoto('${s.id}', ${i})">X</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
        }).join('');
    hydratePhotoElements(box);
    buildRouteSuggestions();
}

// --- DETERMINATIE FLOW ---
function getDetSession() {
    const day = ensureDay();
    if (activeDeterminationSessionId) {
        const sessByState = day.sessions.find(s => s.id === activeDeterminationSessionId);
        if (sessByState) return sessByState;
    }
    if (activeDeterminationId) {
        const sessByDet = findSessionByDeterminationId(activeDeterminationId, day);
        if (sessByDet) {
            activeDeterminationSessionId = sessByDet.id;
            return sessByDet;
        }
    }
    return getActiveSession(day) || getLatestSession(day) || null;
}

function renderDetSessionOptions() {
    const sel = document.getElementById('det-session-select');
    const label = document.getElementById('det-session-label');
    const btnStart = document.getElementById('det-start-session-btn');
    const btnLoose = document.getElementById('det-loose-btn');
    const btnNew = document.getElementById('det-new-btn');
    const day = ensureDay();
    if (!sel) return;
    const sessions = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    sel.innerHTML = sessions.map(s => {
        const l = sessionDisplayLabel(s, day);
        const route = normalizeRouteName(s.routeName || '');
        return `<option value="${s.id}">${l}${route ? ` · ${route}` : ''}</option>`;
    }).join('') || '<option value=\"\">Geen sessies</option>';
    const sess = getDetSession();
    if (sess && !sess.determinations) sess.determinations = [];
    if (!sess) {
        activeDeterminationId = null;
        activeDeterminationSessionId = null;
    }
    if (sess) sel.value = sess.id;
    if (label) {
        const route = normalizeRouteName(sess?.routeName || '');
        label.innerText = sess ? `${sessionDisplayLabel(sess, day)}${route ? ` · ${route}` : ''}` : 'Geen telling';
    }
    const hasActive = !!getActiveSession(day);
    if (btnStart) btnStart.classList.add('hidden');
    if (btnLoose) btnLoose.classList.toggle('hidden', hasActive);
    if (btnNew) btnNew.classList.toggle('hidden', !hasActive);
}

function beginDetermination(id = null) {
    const day = ensureDay();
    let sess = null;
    if (id) {
        sess = findSessionByDeterminationId(id, day);
    } else {
        sess = getActiveSession(day);
        if (!sess) {
            // Zonder actieve sessie: maak tijdelijke sessie voor losse determinatie.
            startSession(true, false, picker.value, false, true);
            sess = getActiveSession(ensureDay());
        }
    }
    if (!sess) { alert('Start eerst een sessie.'); return; }
    let det = null;
    detEditing = !!id;
    if (id) {
        det = sess.determinations.find(d => d.id === id);
    }
    if (!det) {
        det = { id: `det_${Date.now()}`, answers: [], photos: [], node: 'root', result: null, resultName: '', createdAt: Date.now(), updatedAt: Date.now(), pending: true };
        sess.determinations.push(det);
        detEditing = false;
    }
    activeDeterminationId = det.id;
    activeDeterminationSessionId = sess.id;
    renderDeterminationUI();
    renderDeterminationList();
}

function currentDetermination() {
    const sess = getDetSession();
    if (!sess || !activeDeterminationId) return null;
    return sess.determinations.find(d => d.id === activeDeterminationId) || null;
}

function triggerDetPhoto(detId = null) {
    const day = ensureDay();
    let det = null;
    if (detId) {
        const sessById = findSessionByDeterminationId(detId, day);
        det = sessById?.determinations?.find(d => d.id === detId) || null;
        detPhotoTargetId = det ? det.id : null;
    } else {
        det = currentDetermination();
        detPhotoTargetId = det ? det.id : null;
    }
    if (!det) { alert('Start eerst een determinatie.'); return; }
    if (det.photos.length >= 3) { alert('Max 3 foto’s.'); return; }
    const inp = document.getElementById('det-photo-input');
    if (inp) { inp.value = ''; inp.click(); }
}

async function handleDetPhoto(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const day = ensureDay();
    const targetDetId = detPhotoTargetId || activeDeterminationId;
    let sess = targetDetId ? findSessionByDeterminationId(targetDetId, day) : null;
    if (!sess) sess = getDetSession();
    let det = null;
    if (targetDetId && sess) det = sess.determinations.find(d => d.id === targetDetId) || null;
    if (!det) det = currentDetermination();

    if (!det || !sess) { alert('Geen actieve determinatie.'); return; }
    try {
        const data = await resizeImageFileToDataUrl(file, 700, 0.7);
        const photoRef = await persistPhotoDataUrl(data, { dayKey: picker.value, sessionId: sess.id, source: 'determination' });
        det.photos.push(photoRef);
        det.updatedAt = Date.now();
        // ook toevoegen aan sessie-foto's zodat delen werkt
        sess.photos.push(photoRef);
        save();
        renderDeterminationUI();
        renderDeterminationList();
        trackEvent('photo_taken', { source: 'determination_camera' });
        recordUserAction();
    } catch (err) {
        console.error(err);
        alert('Foto kon niet verwerkt worden.');
    } finally {
        detPhotoTargetId = null;
    }
}

function removeDetPhoto(idx) {
    const det = currentDetermination();
    const sess = getDetSession();
    if (!det || !sess) return;
    const removedRef = det.photos?.[idx];
    if (typeof removedRef === 'undefined') return;
    det.photos.splice(idx, 1);
    const sessionPhotoIdx = (sess.photos || []).indexOf(removedRef);
    if (sessionPhotoIdx >= 0) sess.photos.splice(sessionPhotoIdx, 1);
    const day = ensureDay();
    day.photos = day.sessions.flatMap(s => s.photos || []);
    save();
    renderDeterminationUI();
    renderDeterminationList();
    cleanupPhotoRefsIfUnused([removedRef]).catch(err => console.warn('Photo cleanup failed', err));
}


function goBackDetermination() {
    const det = currentDetermination();
    if (!det || !det.answers.length) return;
    det.answers.pop();
    const last = det.answers[det.answers.length - 1];
    det.node = last ? last.node : 'root';
    det.result = null; det.resultName = ''; det.completedAt = null; det.wikiThumb = null;
    save(); renderDeterminationUI(); renderDeterminationList();
}

function answerDetermination(ans) {
    const det = currentDetermination();
    if (!det) { alert('Start eerst een determinatie.'); return; }
    const nodeId = det.node || 'root';
    const node = nodeId === 'root' ? DET_TREE : DET_NODES[nodeId];
    if (!node) return;
    det.answers.push({ node: nodeId, answer: ans });
    let next = null;
    if (node.result) {
        next = node;
    } else {
        const jump = ans === 'yes' ? node.yes : node.no;
        next = DET_NODES[jump] || DET_NODES[DET_TREE[jump]] || DET_NODES[jump];
        det.node = jump;
    }
    det.updatedAt = Date.now();
    // check result
    const n = node.result ? node : (DET_NODES[det.node] && DET_NODES[det.node].result ? DET_NODES[det.node] : null);
    if (n && n.result) {
        det.result = n.species;
        det.resultName = n.name;
        det.pending = false;
        // sluit tijdelijke determinatie-sessie automatisch af na resultaat
        const sess = getDetSession();
        if (sess?.detTemp && !sess.end) {
            const endIso = new Date(new Date(sess.start).getTime() + 60000).toISOString();
            sess.end = endIso;
            if (activeSessionId === sess.id) activeSessionId = null;
            render(); // refresh UI (record knop / nieuwe sessie knop)
        }
        if (!det.completedAt) {
            det.completedAt = Date.now();
            celebrate(null, true, false, 80);
            showToast(`Determinatie: ${det.resultName}`);
            if (!det.wikiThumb) {
                const name = cleanSpeciesName(det.resultName || det.result);
                det.wikiThumb = null;
                det.wikiLink = `https://nl.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
            }
            showDetModal(det);
        }
        save();
    }
    renderDeterminationUI();
    renderDeterminationList();
}

function resetDetermination(id) {
    const det = currentDetermination();
    if (!det) return;
    det.answers = [];
    det.node = 'root';
    det.result = null;
    det.resultName = '';
    det.updatedAt = Date.now();
    save(); renderDeterminationUI(); renderDeterminationList();
}

function renderDeterminationUI() {
    const det = currentDetermination();
    const qBox = document.getElementById('det-question');
    const resBox = document.getElementById('det-result');
    const applyBox = document.getElementById('det-apply');
    const warnBox = document.getElementById('det-warning');
    const progress = document.getElementById('det-progress');
    const nextHint = document.getElementById('det-next-hint');
    const answerButtons = document.getElementById('det-answer-buttons');
    const btnY = document.getElementById('det-btn-yes');
    const btnN = document.getElementById('det-btn-no');
    const strip = document.getElementById('det-photo-strip');
    const qCard = document.getElementById('det-question-card');
    renderDetSessionOptions();
    if (strip) {
        strip.innerHTML = det ? det.photos.map((p, i) => `
                    <div class="relative">
                        <img src="${photoPreviewSrc(p)}" data-photo-ref="${encodePhotoRef(p)}" class="rounded-lg w-full aspect-square object-cover cursor-pointer" onclick="openDetPhoto('${det.id}', ${i})">
                        <button class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-[10px]" onclick="removeDetPhoto(${i})">✕</button>
                    </div>
                `).join('') : '<div class="text-gray-500 text-[11px]">Nog geen foto\'s.</div>';
        hydratePhotoElements(strip);
    }
    if (!det || !qBox) {
        if (qBox) qBox.innerText = 'Start een nieuwe determinatie om vragen te krijgen.';
        if (resBox) resBox.innerText = '';
        if (progress) progress.innerText = '';
        if (applyBox) applyBox.classList.add('hidden');
        if (warnBox) warnBox.classList.add('hidden');
        if (answerButtons) answerButtons.classList.remove('hidden');
        if (progress) progress.classList.remove('hidden');
        if (resBox) resBox.classList.remove('hidden');
        if (nextHint) nextHint.classList.add('hidden');
        if (qCard) qCard.classList.add('hidden');
        [btnY, btnN].forEach(b => b && (b.disabled = true));
        return;
    }
    if (qCard) qCard.classList.remove('hidden');
    const nodeId = det.node || 'root';
    const node = nodeId === 'root' ? DET_TREE : DET_NODES[nodeId];
    const atResult = node && node.result;
    if (qBox) qBox.innerText = atResult ? (det.resultName || 'Onbekend') : (node?.question || 'Vraag onbekend');
    if (resBox) resBox.innerHTML = '';
    const thumbBox = document.getElementById('det-thumb-box');
    const thumbImg = document.getElementById('det-thumb-img');
    const thumbCap = document.getElementById('det-thumb-cap');
    if (thumbBox && thumbImg) {
        thumbBox.classList.add('hidden'); // geen afbeeldingen meer tonen
    }
    if (progress) progress.innerText = `Vragen beantwoord: ${det.answers.length}`;
    if (answerButtons) answerButtons.classList.toggle('hidden', !!det.result);
    if (progress) progress.classList.toggle('hidden', !!det.result);
    if (resBox) resBox.classList.toggle('hidden', !!det.result);
    if (nextHint) nextHint.classList.toggle('hidden', !det.result);
    if (applyBox) applyBox.classList.toggle('hidden', !det.result);
    if (warnBox) warnBox.classList.add('hidden');
    [btnY, btnN].forEach(b => b && (b.disabled = !!det.result));
    // hintBox niet meer gebruikt; blijft verborgen
}

function renderDeterminationList() {
    const list = document.getElementById('det-list');
    if (!list) return;
    const sess = getDetSession();

    if (!sess || !sess.determinations?.length) {
        list.innerHTML = '<div class=\"text-gray-500\">Nog geen determinaties.</div>';
        return;
    }
    const sorted = sess.determinations
        .filter(d => !!d.result && !d.pending)
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt);
    if (!sorted.length) {
        list.innerHTML = '<div class=\"text-gray-500\">Nog geen afgewerkte determinaties.</div>';
        return;
    }
    const cards = sorted.map(d => {
        const photos = d.photos?.length || 0;
        const label = d.resultName || 'Onbekend';
        const answers = d.answers || [];
        const ts = new Date(d.updatedAt).toLocaleString('nl-BE');
        const [rarityText, rarityCls] = rarityFor(d.result || '');
        const ansBadges = answers.map((a, idx) =>
            `<span class="px-2 py-1 rounded-full text-[10px] font-bold ${a.answer === 'yes' ? 'bg-emerald-900/60 text-emerald-200' : 'bg-red-900/60 text-red-200'}">${idx + 1}. ${detAnswerLabel(a.answer)}</span>`
        ).join(' ');
        const ansList = answers.map((a, idx) =>
            `<div class="text-[11px] flex gap-2"><span class="text-gray-500">${idx + 1}.</span><span class="flex-1 text-gray-200">${detQuestionText(a.node)}</span><span class="font-bold ${a.answer === 'yes' ? 'text-emerald-400' : 'text-red-400'}">${detAnswerLabel(a.answer)}</span></div>`
        ).join('');
        const photoList = photos
            ? d.photos.map((p, i) => `<div class="relative"><img src="${photoPreviewSrc(p)}" data-photo-ref="${encodePhotoRef(p)}" class="h-16 w-16 object-cover rounded-lg border border-emerald-500/30 shadow" onclick="openDetPhoto('${d.id}', ${i})"><span class="absolute -top-1 -left-1 bg-black/70 text-[9px] px-1 rounded-full">${i + 1}</span></div>`).join('')
            : '<div class="text-gray-500 text-[10px]">Geen foto\'s</div>';
        return (
            '<div class="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-emerald-500/20 rounded-xl p-3 space-y-2 shadow-lg">' +
            '<div class="flex items-start justify-between gap-2">' +
            '<div>' +
            `<div class="font-bold text-white">${label}</div>` +
            `<div class="mt-1 inline-block px-2 py-1 rounded-full text-[10px] font-bold ${rarityCls}">${rarityText}</div>` +
            '</div>' +
            `<div class="text-[10px] text-gray-400">${ts}</div>` +
            '</div>' +
            (ansBadges ? `<div class="flex flex-wrap gap-1">${ansBadges}</div>` : '<div class="text-gray-500 text-[10px]">Geen antwoorden</div>') +
            (ansList ? `<div class="space-y-1 bg-black/20 border border-gray-800 rounded p-2">${ansList}</div>` : '') +
            `<div class="flex gap-2 flex-wrap">${photoList}</div>` +
            '<div class="flex gap-2 justify-end">' +
            `<button class="bg-emerald-700 text-white px-3 py-1 rounded text-[10px]" onclick="triggerDetPhoto('${d.id}')">Foto toevoegen</button>` +
            '</div>' +
            '</div>'
        );
    });
    list.innerHTML = cards.join('');
    hydratePhotoElements(list);
}



function startLooseDetermination() {
    // start een tijdelijke sessie enkel voor determinatie
    const day = ensureDay();
    if (!getActiveSession(day)) startSession(true, false, picker.value, false, true);
    beginDetermination();
    renderDetSessionOptions();
}
function openDetermination(id) {
    activeDeterminationId = id;
    const sess = findSessionByDeterminationId(id, ensureDay());
    activeDeterminationSessionId = sess ? sess.id : null;
    detEditing = true;
    renderDeterminationUI();
    renderDeterminationList();
}

function applyDeterminationToCounts() {
    const det = currentDetermination();
    const day = ensureDay();
    const sess = getDetSession();
    if (!det || !det.result || !sess) return;
    const speciesId = det.result;
    const targetId = ensureSpeciesExists(speciesId, det.resultName || speciesId, day);
    const key = `${targetId}_o_l`;
    const inc = confirm(`'${det.resultName}' toevoegen aan teller?`) ? 1 : 0;
    if (!inc) return;
    day.counts[key] = (day.counts[key] || 0) + 1;
    sess.counts[key] = (sess.counts[key] || 0) + 1;
    save(); render(); recordUserAction(); showToast('Determinatie toegevoegd aan teller');
}

function ensureSpeciesExists(id, name, day) {
    if (SPECIES.some(s => s.id === id)) return id;
    const existing = (day.custom || []).find(c => c.name === name || c.id === id);
    if (existing) return existing.id;
    const obj = { id: id.startsWith('c_') ? id : `c_${id}`, name, color: 'gray', hasAmplexus: false };
    day.custom.push(obj);
    buildUI();
    return obj.id;
}

function renderSessions() {
    const day = ensureDay();
    const active = getActiveSession(day);
    const dayTotal = sumCounts(day.counts);
    const activeTotal = active ? sumCounts(active.counts) : null;
    const newBtn = document.getElementById('new-session-btn');
    if (newBtn) newBtn.classList.toggle('hidden', !!active);
    const camFab = document.getElementById('camera-fab');
    if (camFab) camFab.classList.toggle('hidden', !active);
    const recBtn = document.getElementById('record-btn');
    if (recBtn) recBtn.classList.toggle('hidden', !active);
    buildViewedSessionOptions();
    buildRouteSuggestions();
    syncTellingUI();
    refreshHeaderSelectorVisibility();
}

function buildViewedSessionOptions() {
    const sels = ['session-view-select', 'session-log-select', 'global-session-select'].map(id => document.getElementById(id)).filter(Boolean);
    const quickRow = document.getElementById('quick-session-row');
    const quickMeta = document.getElementById('quick-session-meta');
    const reportSel = document.getElementById('report-session-select');
    const day = ensureDay();
    const activeSession = getActiveSession(day);
    const sessions = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    if (!sessions.length) {
        viewedSessionId = '';
        const emptyOpt = '<option value="">Geen sessies</option>';
        sels.forEach(sel => {
            sel.innerHTML = emptyOpt;
            sel.value = '';
            sel.disabled = true;
        });
        if (quickRow) quickRow.classList.add('hidden');
        if (quickMeta) quickMeta.innerText = '';
        if (reportSel) reportSel.value = '';
        return;
    }

    const hasCurrent = sessions.some(s => s.id === viewedSessionId);
    if (!hasCurrent) viewedSessionId = sessions[sessions.length - 1].id;
    const opts = sessions.map(s => {
        const label = sessionDisplayLabel(s, day);
        const routeTag = s.routeName ? ` · ${s.routeName}` : '';
        return `<option value="${s.id}" ${s.id === (viewedSessionId || '') ? 'selected' : ''}>${label}${routeTag}</option>`;
    }).join('');
    sels.forEach(sel => {
        sel.innerHTML = opts;
        sel.disabled = false;
        if (viewedSessionId) sel.value = viewedSessionId;
    });
    if (quickRow) quickRow.classList.toggle('hidden', !!activeSession);
    const current = sessions.find(s => s.id === viewedSessionId);
    if (quickMeta) {
        if (!current) quickMeta.innerText = '';
        else {
            const total = sumCounts(current.counts || {});
            const route = (current.routeName || '').trim();
            quickMeta.innerText = route ? `${total} dieren · ${route}` : `${total} dieren`;
        }
    }
    if (reportSel && reportMode === 'session' && viewedSessionId && Array.from(reportSel.options).some(o => o.value === viewedSessionId)) {
        reportSel.value = viewedSessionId;
    }
}

function setViewedSession(id) {
    const day = ensureDay();
    const sessions = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    if (!sessions.length) {
        viewedSessionId = '';
        buildViewedSessionOptions();
        updateReport();
        return;
    }
    const exists = sessions.some(s => s.id === id);
    viewedSessionId = exists ? id : sessions[sessions.length - 1].id;
    buildViewedSessionOptions();
    renderSessionLog();
    updateReport();
}

function selectReportSession(id) {
    if (!id) {
        reportMode = 'day';
        updateReport();
        return;
    }
    reportMode = 'session';
    setViewedSession(id);
}


function updateSessionNotes(id, val) {
    const day = ensureDay();
    const s = day.sessions.find(x => x.id === id);
    if (!s) return;
    s.notes = val;
    save();
}

function toggleSessionInclude(id, dayKey = picker.value, include = true) {
    const day = ensureDay(dayKey);
    const s = day.sessions.find(x => x.id === id);
    if (!s) return;
    s.includeInReports = !!include;
    save();
    render();
    renderSessionAdmin();
    showToast(s.includeInReports ? 'Sessie telt mee in rapport' : 'Sessie telt niet mee in rapport');
}

function updateRoute(id, val) {
    const day = ensureDay();
    const s = day.sessions.find(x => x.id === id);
    if (!s) return;
    s.routeName = val;
    save();
}

function commitRoutePreference(id, val) {
    updateRoute(id, val);
    if (rememberRoutePreference(val)) buildRouteSuggestions();
}

function removeSessionPhoto(id, idx) {
    const day = ensureDay();
    const s = day.sessions.find(x => x.id === id);
    if (!s) return;
    const removedRef = s.photos?.[idx];
    if (typeof removedRef === 'undefined') return;
    s.photos.splice(idx, 1);
    // dagbuffer opschonen grof (herstelt duplicaten niet exact, maar voldoende)
    day.photos = day.sessions.flatMap(ss => ss.photos);
    save();
    renderSessionLog();
    cleanupPhotoRefsIfUnused([removedRef]).catch(err => console.warn('Photo cleanup failed', err));
}

async function openPhoto(sessionId, idx) {
    const day = ensureDay();
    let photo = null;
    if (sessionId === 'det') {
        const det = currentDetermination();
        photo = det?.photos?.[idx];
    } else {
        const s = day.sessions.find(x => x.id === sessionId);
        if (!s) return;
        photo = s.photos?.[idx];
    }
    if (!photo) return;
    const src = await resolvePhotoDataUrl(photo);
    if (!src) {
        alert('Foto niet gevonden.');
        return;
    }
    const box = document.getElementById('photo-lightbox');
    const img = document.getElementById('photo-lightbox-img');
    img.src = src;
    box.classList.remove('hidden');
}

// open foto uit storage inspector
async function openInspectorPhoto(idx, key) {
    const raw = localStorage.getItem(key || STORAGE_KEY);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        const imgs = [];
        const collect = v => {
            if (typeof v === 'string' && (isDataImageUrl(v) || isIdbPhotoRef(v))) imgs.push(v);
            else if (Array.isArray(v)) v.forEach(collect);
            else if (v && typeof v === 'object') Object.values(v).forEach(collect);
        };
        collect(parsed);
        const src = await resolvePhotoDataUrl(imgs[idx]);
        if (!src) return;
        const box = document.getElementById('photo-lightbox');
        const img = document.getElementById('photo-lightbox-img');
        img.src = src;
        box.classList.remove('hidden');
    } catch (e) { console.log(e); }
}


async function openDetPhoto(detId, idx) {
    const day = ensureDay();
    for (const s of day.sessions || []) {
        const det = (s.determinations || []).find(d => d.id === detId);
        if (det) {
            const photo = det.photos?.[idx];
            if (photo) {
                const src = await resolvePhotoDataUrl(photo);
                if (!src) return;
                const box = document.getElementById('photo-lightbox');
                const img = document.getElementById('photo-lightbox-img');
                img.src = src;
                box.classList.remove('hidden');
            }
            return;
        }
    }
}

function closePhoto(ev) {
    // close when backdrop or X clicked
    const box = document.getElementById('photo-lightbox');
    if (!box) return;
    if (ev.target.id === 'photo-lightbox' || ev.target.tagName === 'BUTTON' || ev.target.tagName === 'IMG' && ev.target.id === 'photo-lightbox-img') {
        box.classList.add('hidden');
        document.getElementById('photo-lightbox-img').src = '';
    }
}

function sumCounts(obj = {}) {
    let total = 0;
    for (const k in obj) {
        const v = obj[k] || 0;
        total += (k.includes('_p_')) ? v * 2 : v; // paartjes tellen als twee dieren
    }
    return total;
}

function addCounts(target = {}, counts = {}) {
    for (const k in counts) {
        const n = Number(counts[k] || 0);
        if (!isFinite(n) || n === 0) continue;
        target[k] = (target[k] || 0) + n;
    }
    return target;
}

function subtractCounts(target = {}, counts = {}) {
    for (const k in counts) {
        const n = Number(counts[k] || 0);
        if (!isFinite(n) || n === 0) continue;
        target[k] = (target[k] || 0) - n;
        if (target[k] < 0) target[k] = 0;
    }
    return target;
}

function sessionIncludedInReports(session) {
    return session?.includeInReports !== false;
}

function getReportEligibleSessions(day) {
    const sessions = Array.isArray(day?.sessions) ? day.sessions : [];
    if (!sessions.length) return [];
    return sessions.filter(sessionIncludedInReports);
}

function getReportCountsForDay(day) {
    const allSessions = Array.isArray(day?.sessions) ? day.sessions : [];
    if (!allSessions.length) return day?.counts || {};
    const sessions = getReportEligibleSessions(day);
    if (!sessions.length) return {};
    const merged = {};
    sessions.forEach(s => addCounts(merged, s.counts || {}));
    return merged;
}

function formatSessionNote(s) {
    const auto = (s?.autoContributorNote || '').trim();
    const notes = (s?.notes || '').trim();
    if (auto && notes) return `${auto}. ${notes}`;
    return auto || notes;
}

function sessionContributorNames(session) {
    if (!session || typeof session !== 'object') return '';
    const names = [];
    const seen = new Set();
    const pushName = (name, contributorId = '') => {
        const normalized = normalizeContributorDisplayName(name || '', contributorId || '');
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(normalized);
    };
    (Array.isArray(session.contributorRoster) ? session.contributorRoster : []).forEach(r => {
        pushName(r?.name || '', r?.id || '');
    });
    if (!names.length) {
        (Array.isArray(session.contributions) ? session.contributions : []).forEach(c => {
            pushName(c?.contributorName || '', c?.contributorId || '');
        });
    }
    if (!names.length && !Array.isArray(session.contributions)) return '';
    if (!names.length && session.contributions.length === 0) return 'mezelf';
    return names.join(', ');
}

function getActiveSession(day) {
    const running = (day.sessions || [])
        .filter(s => !s.end)
        .sort((a, b) => new Date(b.start) - new Date(a.start));
    return running[0] || null;
}

function getLatestSession(day) {
    const sessions = (day.sessions || []).slice()
        .sort((a, b) => new Date(b.start) - new Date(a.start));
    return sessions[0] || null;
}

function findSessionByDeterminationId(detId, day = ensureDay()) {
    if (!detId) return null;
    return (day.sessions || []).find(s => (s.determinations || []).some(d => d.id === detId)) || null;
}

function renderSessionAdmin() {
    const dayKey = document.getElementById('sessionDate')?.value || picker.value;
    const day = ensureDay(dayKey);
    const box = document.getElementById('session-admin-list');
    if (!box) return;
    const items = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start)).map(s => {
        const total = sumCounts(s.counts);
        const detCount = (s.determinations || []).filter(d => !!d.result && !d.pending).length;
        const photoCount = (s.photos || []).length;
        const route = normalizeRouteName(s.routeName || '');
        const weather = s.weather ? `<div class="text-[10px] text-sky-300">${weatherSummaryText(s.weather, ' • ', true)}</div>` : '';
        const autoNote = (s.autoContributorNote || '').trim();
        return `<div class="bg-gray-900 p-3 rounded border border-gray-800 flex items-center gap-2">
                    <input type="checkbox" class="session-merge-checkbox accent-emerald-500" value="${s.id}">
                    <div class="flex-1">
                        <div class="font-bold text-gray-100">${fmtTime(s.start)} - ${s.end ? fmtTime(s.end) : 'lopend'}</div>
                        <div class="text-gray-400 text-[10px]">${total} stuks · ${detCount} determinaties · ${photoCount} foto's</div>
                        ${route ? `<div class="text-emerald-200 text-[10px]">🚶‍♂️ ${route}</div>` : ''}
                        ${autoNote ? `<div class="text-cyan-200 text-[10px]">${autoNote}</div>` : ''}
                        <label class="inline-flex items-center gap-1 text-[10px] mt-1 text-gray-300">
                            <input type="checkbox" class="accent-emerald-500" ${s.includeInReports !== false ? 'checked' : ''} onchange="event.stopPropagation(); toggleSessionInclude('${s.id}','${dayKey}', this.checked)">
                            Meetellen in rapport
                        </label>
                        ${weather}
                    </div>
                    <button class="bg-red-700 px-2 py-1 rounded text-[12px]" onclick="deleteSession('${s.id}','${dayKey}')" title="Verwijder sessie">🗑️</button>
                </div>`;
    }).join('') || '<div class="text-gray-500">Geen sessies voor deze dag.</div>';
    box.innerHTML = items;
    // merge action button
    const mergeBtn = document.createElement('button');
    mergeBtn.innerText = 'Merge selectie';
    mergeBtn.className = 'w-full bg-gray-700 mt-2 py-2 rounded text-[11px] font-bold';
    mergeBtn.onclick = () => mergeSelectedSessions(dayKey);
    box.appendChild(mergeBtn);
}

function startSession(force = false, fromSessionPage = false, dayKeyOverride = null, redirect = true, tempDet = false, showInfo = true) {
    const dayKey = dayKeyOverride || (fromSessionPage ? (document.getElementById('sessionDate').value || picker.value) : picker.value);
    const day = ensureDay(dayKey);
    const existing = day.sessions.find(s => !s.end);
    if (existing && !force) { alert('Er draait al een sessie. Stop eerst.'); return; }
    const now = new Date();
    const defaultRoute = tempDet ? '' : normalizeRouteName(getContributorProfile().lastRouteName || '');
    const session = {
        id: 'sess_' + now.getTime(),
        start: now.toISOString(),
        counts: {},
        notes: tempDet ? 'Losse determinatie' : '',
        weather: null,
        photos: [],
        routeName: defaultRoute,
        determinations: [],
        detTemp: tempDet,
        includeInReports: true,
        contributions: [],
        contributorRoster: [],
        autoContributorNote: ''
    };
    ensureLocalSessionContributorDefaults(session);
    day.sessions.push(session);
    activeSessionId = session.id;
    viewedSessionId = session.id;
    save(); render(); renderSessionAdmin(); renderDetSessionOptions(); renderDeterminationUI(); renderDeterminationList(); showToast('Telling gestart');
    if (!tempDet && showInfo) showSessionInfoModal();
    if (redirect) switchTab('sessions');
    fetchWeather(dayKey, session.id); // capture weather at start
}

function showSessionInfoModal() {
    const modal = document.getElementById('session-info-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
}

function closeSessionInfoModal() {
    const modal = document.getElementById('session-info-modal');
    if (!modal) return;
    modal.classList.add('hidden');
}

function formatDuration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
}

function recordUserAction() {
    lastAction = Date.now();
    scheduleInactivityWatch();
}

function scheduleInactivityWatch() {
    clearTimeout(inactivityPromptTimer);
    clearTimeout(inactivityAutoTimer);
    const day = ensureDay();
    const active = getActiveSession(day);
    if (!active) return;
    inactivityPromptTimer = setTimeout(() => {
        const ok = confirm('Mag deze telling afgesloten worden?');
        if (ok) {
            stopTelling();
        } else {
            inactivityAutoTimer = setTimeout(() => stopTelling(true), INACTIVITY_AUTO_MS);
        }
    }, INACTIVITY_MS);
}

function updateTellingTimer() {
    const el = document.getElementById('session-timer');
    if (!el) return;
    if (!tellingStartTs) { el.innerText = '00:00:00'; return; }
    el.innerText = formatDuration(Date.now() - tellingStartTs);
}

function syncTellingUI() {
    const day = ensureDay();
    const active = getActiveSession(day);
    const hasActive = !!active;
    const startBox = document.getElementById('start-telling-container');
    const stopBox = document.getElementById('stop-telling-container');
    const counters = document.getElementById('counters-container');
    if (startBox) startBox.classList.toggle('hidden', hasActive);
    if (stopBox) stopBox.classList.toggle('hidden', !hasActive);
    if (counters) counters.classList.toggle('hidden', !hasActive);
    if (hasActive) {
        tellingStartTs = new Date(active.start).getTime();
        updateTellingTimer();
        clearInterval(tellingTimer);
        tellingTimer = setInterval(updateTellingTimer, 1000);
        recordUserAction();
    } else {
        clearInterval(tellingTimer);
        tellingTimer = null;
        tellingStartTs = null;
        updateTellingTimer();
    }
}

function startTelling() {
    recordUserAction();
    const day = ensureDay();
    let active = getActiveSession(day);
    if (!active) {
        startSession(false, false, picker.value, false, false, false); // geen redirect, geen start-info
        active = getActiveSession(day);
    }
    tellingStartTs = active ? new Date(active.start).getTime() : Date.now();
    clearInterval(tellingTimer);
    tellingTimer = setInterval(updateTellingTimer, 1000);
    syncTellingUI();
    showToast('Telling gestart');
}

function stopTelling(auto = false) {
    const day = ensureDay();
    const active = getActiveSession(day);
    if (!active) return;
    endSession(true);
    clearInterval(tellingTimer);
    tellingTimer = null;
    tellingStartTs = null;
    clearTimeout(inactivityPromptTimer);
    clearTimeout(inactivityAutoTimer);
    syncTellingUI();
    updateReport();
    if (!auto) showSessionInfoModal();
    switchTab('report');
    showToast(auto ? 'Telling automatisch gestopt' : 'Telling gestopt');
}

function endSession(silent = false) {
    const day = ensureDay();
    const active = day.sessions.find(s => !s.end);
    if (!active) return alert('Geen actieve sessie');
    active.end = new Date().toISOString();
    save(); render(); renderSessionAdmin();
    if (!silent) showToast('Telling gestopt');
}

// legacy single merge fallback (unused in UI now but kept for safety)
function mergeSession(id, dayKey = picker.value) {
    const day = ensureDay(dayKey);
    const target = day.sessions.find(s => s.id === id);
    if (!target) return;
    const others = day.sessions.filter(s => s.id !== id);
    if (!others.length) { alert('Minstens 2 sessies nodig.'); return; }
    const master = target;
    others.forEach(s => {
        for (const k in s.counts) master.counts[k] = (master.counts[k] || 0) + s.counts[k];
        if (s.photos && s.photos.length) {
            master.photos = (master.photos || []).concat(s.photos);
        }
        if (new Date(s.start) < new Date(master.start)) master.start = s.start;
        if (s.end && (!master.end || new Date(s.end) > new Date(master.end))) master.end = s.end;
        if (s.weather && !master.weather) master.weather = s.weather;
    });
    day.sessions = [master];
    recalcDayFromSessions(day);
    save(); render(); renderSessionAdmin(); showToast('Tellingen samengevoegd');
}

function mergeSelectedSessions(dayKey = picker.value) {
    const day = ensureDay(dayKey);
    const boxes = Array.from(document.querySelectorAll('.session-merge-checkbox')).filter(cb => cb.checked);
    if (boxes.length < 2) { alert('Selecteer minstens 2 sessies.'); return; }
    const ids = boxes.map(b => b.value);
    const masterId = ids[0];
    const master = day.sessions.find(s => s.id === masterId);
    const others = day.sessions.filter(s => ids.includes(s.id) && s.id !== masterId);
    const removedDets = others.reduce((n, s) => n + ((s.determinations || []).filter(d => !!d.result && !d.pending).length), 0);
    const removedPhotos = others.reduce((n, s) => n + ((s.photos || []).length), 0);
    if (!confirm(`Opgelet: bij het samenvoegen worden ${others.length} sessies verwijderd. Ook ${removedDets} determinaties en ${removedPhotos} foto's uit die sessies gaan verloren.`)) return;
    others.forEach(s => {
        for (const k in s.counts) master.counts[k] = (master.counts[k] || 0) + s.counts[k];
        if (s.photos && s.photos.length) {
            master.photos = (master.photos || []).concat(s.photos);
        }
        if (new Date(s.start) < new Date(master.start)) master.start = s.start;
        if (s.end && (!master.end || new Date(s.end) > new Date(master.end))) master.end = s.end;
        if (s.weather && !master.weather) master.weather = s.weather;
    });
    day.sessions = day.sessions.filter(s => !others.includes(s));
    recalcDayFromSessions(day);
    save(); render(); renderSessionAdmin(); showToast('Tellingen samengevoegd');
}

function recalcDayFromSessions(day) {
    day.counts = {};
    day.sessions.forEach(s => {
        for (const k in s.counts) day.counts[k] = (day.counts[k] || 0) + s.counts[k];
    });
    day.photos = day.sessions.flatMap(s => s.photos || []);
}

function purgeEmptyCustomSpecies() {
    for (const d in storage) {
        const day = ensureDay(d);
        if (!day.custom) continue;
        day.custom = day.custom.filter(c => {
            const hasCounts = Object.keys(day.counts || {}).some(k => k.startsWith(`${c.id}_`) && (day.counts[k] || 0) > 0);
            return hasCounts || c.name !== 'Onbekend';
        });
        // verwijder lege count keys voor niet-bestaande custom soorten
        const validIds = new Set(day.custom.map(c => c.id));
        Object.keys(day.counts || {}).forEach(k => {
            const sid = k.split('_')[0];
            if (!validIds.has(sid) && k.startsWith('c_')) delete day.counts[k];
        });
    }
}

function deleteSession(id, dayKey = picker.value) {
    const day = ensureDay(dayKey);
    const target = day.sessions.find(s => s.id === id);
    if (!target) return;
    const refsToCleanup = collectSessionPhotoRefs(target);
    const detCount = (target.determinations || []).filter(d => !!d.result && !d.pending).length;
    const photoCount = (target.photos || []).length;
    const ok = confirm(`Telling verwijderen? Opgelet: ook ${detCount} determinaties en ${photoCount} foto's in deze telling gaan verloren.`);
    if (!ok) return;
    day.sessions = day.sessions.filter(s => s.id !== id);
    recalcDayFromSessions(day);
    if (activeSessionId === id) activeSessionId = null;
    save();
    render();
    renderSessionAdmin();
    showToast('Telling verwijderd');
    cleanupPhotoRefsIfUnused(refsToCleanup).catch(err => console.warn('Photo cleanup failed', err));
}

function confirmMerge(id) {
    return confirm(`Tellingen samenvoegen met ${id}?`);
}

function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}

function looseDeterminationLabel(sess, day = ensureDay()) {
    const loose = (day.sessions || []).filter(s => s.detTemp).sort((a, b) => new Date(a.start) - new Date(b.start));
    const idx = loose.findIndex(s => s.id === sess.id);
    const firstResult = (sess.determinations || []).find(d => d.resultName)?.resultName || null;
    const base = firstResult ? `${firstResult} determinatie` : 'Losse determinatie';
    return `${base}${idx >= 0 ? ' ' + (idx + 1) : ''}`;
}

function sessionDisplayLabel(sess, day = ensureDay()) {
    if (sess?.detTemp) return looseDeterminationLabel(sess, day);
    return `${fmtTime(sess.start)} ${sess.end ? '– ' + fmtTime(sess.end) : '(live)'}`;
}

async function fetchWeather(dayOverride, sessionId) {
    if (!navigator.geolocation) return;
    const dayKey = dayOverride || picker.value;
    const day = ensureDay(dayKey);
    if (sessionId) {
        const sess = day.sessions.find(s => s.id === sessionId) || null;
        const policy = getSessionWeatherFetchPolicy(sess);
        if (!policy.allowed) {
            showToast('Weerbericht geblokkeerd');
            alert(
                'Deze sessie is ouder dan 3 uur.\n\n' +
                'Automatisch weer ophalen kan nu afwijken. Zet het weer manueel bij Notities.'
            );
            return;
        }
    }
    showToast("Weerbericht ophalen...");
    navigator.geolocation.getCurrentPosition(async p => {
        try {
            const r = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}` +
                `&current=temperature_2m,weather_code,precipitation,rain,showers,snowfall,wind_speed_10m&timezone=auto`
            );
            const j = await r.json();
            const nowDay = ensureDay(dayKey);
            const current = j.current || j.current_weather || {};
            const code = Number(current.weather_code ?? current.weathercode ?? 0);
            const temp = Number(current.temperature_2m ?? current.temperature ?? 0);
            const w = {
                t: temp,
                c: code,
                p: precipitationLabelFromCode(code),
                pr: weatherNumber(current.precipitation, 1),
                rr: weatherNumber(current.rain, 1),
                sh: weatherNumber(current.showers, 1),
                sn: weatherNumber(current.snowfall, 1),
                ws: weatherNumber(current.wind_speed_10m ?? current.windspeed, 0),
                ts: Date.now()
            };
            nowDay.weather = w;
            if (sessionId) {
                const sess = nowDay.sessions.find(s => s.id === sessionId);
                if (sess) sess.weather = w;
            } else {
                const active = nowDay.sessions.find(s => !s.end);
                if (active) active.weather = active.weather || w;
            }
            save(); render(); showToast("Weer OK");
        } catch (e) { alert("API Fout"); console.log(e) }
    });
}

function updateWeather() {
    const el = document.getElementById('weather-display');
    if (!el) return;
    const w = storage[picker.value]?.weather;
    el.innerText = w ? weatherSummaryText(w, ' - ', true) : "Geen weerdata bekend.";
}

function addCustomSpecies() {
    const n = document.getElementById('new-species-name').value.trim();
    if (!n) return;
    const day = ensureDay();
    day.custom.push({ id: 'c_' + Date.now(), name: n, color: 'gray', hasAmplexus: true });
    document.getElementById('new-species-name').value = '';
    save(); buildUI(); render();
}

function renderCustom() {
    const d = ensureDay();
    document.getElementById('custom-species-render').innerHTML = d.custom.map(s => renderCard(s, true)).join('');
    document.getElementById('custom-species-list').innerHTML = d.custom.map(s => `
                <div class="flex justify-between items-center bg-gray-800 p-2 rounded text-[10px] mb-1 border border-gray-700 shadow-sm uppercase font-bold">
                    <span>${s.name}</span> <button onclick="removeC('${s.id}')" class="text-red-400 px-3 py-1 bg-red-900/20 rounded">Verwijder</button>
                </div>
            `).join('');
}
function removeC(id) { if (confirm("Soort wissen?")) { const day = ensureDay(); day.custom = day.custom.filter(c => c.id !== id); save(); buildUI(); render(); } }

function resizeImageFileToDataUrl(file, maxSide = 700, quality = 0.7) {
    return new Promise((resolve, reject) => {

        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('FILE_READ_FAILED'));
        reader.onload = ev => {
            const img = new Image();
            img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
            img.onload = () => {
                const c = document.createElement('canvas');
                const fct = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
                c.width = Math.max(1, Math.round(img.width * fct));
                c.height = Math.max(1, Math.round(img.height * fct));
                const ctx = c.getContext('2d');
                if (!ctx) {
                    reject(new Error('CANVAS_CONTEXT_FAILED'));
                    return;
                }
                ctx.drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', quality));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function persistPhotoDataUrl(dataUrl, meta = {}) {
    try {
        return await putPhotoRecord(dataUrl, meta);
    } catch (err) {
        console.warn('IndexedDB foto-opslag niet beschikbaar, fallback naar localStorage string.', err);
        return dataUrl;
    }
}

function triggerPhoto(sessionId = null) {
    const day = ensureDay();
    const target = sessionId || (getActiveSession(day)?.id || null);
    if (!target) { alert('Start eerst een sessie om foto\'s toe te voegen.'); return; }
    photoTargetSession = target;
    vibe(25, true);
    const input = document.getElementById('photo-input');
    input.value = '';
    input.click();
}

async function handlePhoto(e) {
    const f = e.target.files[0]; if (!f) return;
    const day = ensureDay();
    const session = photoTargetSession
        ? day.sessions.find(s => s.id === photoTargetSession)
        : getActiveSession(day);
    if (!session) { alert('Geen actieve sessie gevonden.'); return; }
    try {
        const data = await resizeImageFileToDataUrl(f, 600, 0.6);
        const photoRef = await persistPhotoDataUrl(data, { dayKey: picker.value, sessionId: session.id, source: 'session' });
        session.photos.push(photoRef);
        // ook op dag-niveau voor aggregatie en legacy
        day.photos.push(photoRef);
        save();
        renderSessionLog();
        trackEvent('photo_taken', { source: 'session_camera' });
        recordUserAction();
    } catch (err) {
        console.error(err);
        alert('Foto kon niet verwerkt worden.');
    }
}

function clearAllPhotos(dayKey = null) {
    if (!confirm(dayKey ? `Alle foto\'s van ${dayKey} wissen?` : 'Alle foto\'s in alle dagen wissen?')) return;
    let refsToCleanup = [];
    if (dayKey) {
        const d = ensureDay(dayKey);
        refsToCleanup = collectDayPhotoRefs(d);
        d.photos = [];
        d.sessions.forEach(s => {
            s.photos = [];
            (Array.isArray(s.determinations) ? s.determinations : []).forEach(det => {
                det.photos = [];
            });
        });
    } else {
        for (const d in storage) {
            const day = ensureDay(d);
            refsToCleanup = refsToCleanup.concat(collectDayPhotoRefs(day));
            day.photos = [];
            day.sessions.forEach(s => {
                s.photos = [];
                (Array.isArray(s.determinations) ? s.determinations : []).forEach(det => {
                    det.photos = [];
                });
            });
        }
    }
    save();
    renderSessionLog();
    showToast('Foto\'s gewist');
    cleanupPhotoRefsIfUnused(refsToCleanup).catch(err => console.warn('Photo cleanup failed', err));
}

async function shareSessionPhotos(sessionId) {
    const day = ensureDay();
    const session = day.sessions.find(s => s.id === sessionId);
    if (!session) return alert('Tellingen niet gevonden');
    const photos = uniquePhotoRefs(session.photos || []);
    if (!photos.length) return alert('Geen foto\'s in deze sessie.');
    const files = await buildShareFilesFromPhotoRefs(photos, (idx, ext) =>
        `paddentrek-${picker.value}-${sessionId}-${idx + 1}.${ext}`
    );
    if (!files.length) return alert('Foto\'s konden niet geladen worden.');
    const text = `Foto's ${picker.value} (${fmtTime(session.start)}): ${files.length} stuks`;
    const shareData = { title: 'Paddentrek Teller Pro', text, files };
    try {
        if (navigator.share) {
            if (navigator.canShare && !navigator.canShare({ files })) {
                throw new Error('FILES_NOT_SUPPORTED');
            }
            await navigator.share(shareData);
            return;
        }
    } catch (err) {
        if (err?.name === 'AbortError') return;
        if (err?.message === 'FILES_NOT_SUPPORTED') {
            alert('Je toestel ondersteunt geen delen met foto’s. Probeer zonder foto’s.');
            return;
        }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank');
}

function dataURLToBlob(dataUrl) {
    if (!isDataImageUrl(dataUrl) || !dataUrl.includes(',')) return null;
    const [meta, b64] = dataUrl.split(',');
    const match = meta.match(/data:(.*);base64/);
    if (!match || !match[1]) return null;
    const mime = match[1];
    const ext = mime.split('/')[1] || 'jpg';
    try {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return { blob: new Blob([arr], { type: mime }), ext };
    } catch (_) {
        return null;
    }
}

function uniquePhotoRefs(photos = []) {
    const out = [];
    const seen = new Set();
    (Array.isArray(photos) ? photos : []).forEach(ref => {
        if (typeof ref !== 'string' || !ref) return;
        if (seen.has(ref)) return;
        seen.add(ref);
        out.push(ref);
    });
    return out;
}

async function buildShareFilesFromPhotoRefs(photoRefs = [], fileNameFactory = null) {
    const refs = uniquePhotoRefs(photoRefs);
    const files = [];
    for (let i = 0; i < refs.length; i++) {
        const src = await resolvePhotoDataUrl(refs[i]);
        const blobResult = dataURLToBlob(src);
        if (!blobResult?.blob) continue;
        const ext = blobResult.ext || 'jpg';
        const fileName = typeof fileNameFactory === 'function'
            ? fileNameFactory(i, ext, refs[i])
            : `paddentrek-photo-${i + 1}.${ext}`;
        files.push(new File([blobResult.blob], fileName, { type: blobResult.blob.type || 'image/jpeg' }));
    }
    return files;
}

function dayTotalForTrend(day) {
    if (!day || typeof day !== 'object') return 0;
    const hasSessions = Array.isArray(day.sessions) && day.sessions.length > 0;
    const reportCounts = getReportCountsForDay(day);
    const reportTotal = sumCounts(reportCounts || {});
    if (hasSessions) return reportTotal;
    if (reportTotal > 0) return reportTotal;
    return sumCounts(day.counts || {});
}

function dayIsTrendTellingDay(day) {
    if (!day || typeof day !== 'object') return false;
    const sessions = Array.isArray(day.sessions) ? day.sessions : [];
    if (sessions.length) {
        return sessions.some(sessionIncludedInReports);
    }
    if (typeof day.notes === 'string' && day.notes.trim()) return true;
    return dayTotalForTrend(day) > 0;
}

function trendDateLabel(dateIso) {
    const d = new Date(`${dateIso}T00:00:00`);
    if (isNaN(d.getTime())) return dateIso;
    return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' });
}

function bindReportTrendInteractions() {
    const chart = document.getElementById('report-trend-chart');
    const svg = chart?.querySelector('svg');
    if (!svg) return;

    const tooltip = svg.querySelector('#trend-point-tooltip');
    const tooltipBg = svg.querySelector('#trend-point-tooltip-bg');
    const tooltipText = svg.querySelector('#trend-point-tooltip-text');
    const pointNodes = Array.from(svg.querySelectorAll('[data-trend-point="1"]'));
    if (!tooltip || !tooltipBg || !tooltipText || !pointNodes.length) return;

    const vb = svg.viewBox?.baseVal;
    const vbW = vb?.width || 520;
    let pinnedPoint = null;

    const drawTooltip = pointEl => {
        if (!pointEl) return;
        const x = Number(pointEl.getAttribute('data-x') || 0);
        const y = Number(pointEl.getAttribute('data-y') || 0);
        const label = pointEl.getAttribute('data-label') || '';
        const total = Number(pointEl.getAttribute('data-total') || 0);
        const txt = `${label}: ${total} dieren`;
        const boxH = 22;
        const boxW = Math.max(102, Math.round(txt.length * 6.3) + 14);
        const left = Math.min(vbW - boxW - 4, Math.max(4, x - (boxW / 2)));
        const top = Math.max(4, y - boxH - 12);
        tooltipBg.setAttribute('x', String(left));
        tooltipBg.setAttribute('y', String(top));
        tooltipBg.setAttribute('width', String(boxW));
        tooltipBg.setAttribute('height', String(boxH));
        tooltipText.setAttribute('x', String(left + (boxW / 2)));
        tooltipText.setAttribute('y', String(top + 14));
        tooltipText.textContent = txt;
        tooltip.setAttribute('visibility', 'visible');
    };

    const hideTooltip = () => {
        if (pinnedPoint) return;
        tooltip.setAttribute('visibility', 'hidden');
    };

    pointNodes.forEach(point => {
        point.style.cursor = 'pointer';
        point.addEventListener('mouseenter', () => drawTooltip(point));
        point.addEventListener('mouseleave', hideTooltip);
        point.addEventListener('focus', () => drawTooltip(point));
        point.addEventListener('blur', hideTooltip);
        point.addEventListener('click', ev => {
            ev.stopPropagation();
            if (pinnedPoint === point) {
                pinnedPoint = null;
                tooltip.setAttribute('visibility', 'hidden');
                return;
            }
            pinnedPoint = point;
            drawTooltip(point);
        });
        point.addEventListener('touchstart', () => {
            pinnedPoint = point;
            drawTooltip(point);
        }, { passive: true });
    });

    svg.addEventListener('click', ev => {
        if (ev.target?.closest?.('[data-trend-point="1"]')) return;
        pinnedPoint = null;
        tooltip.setAttribute('visibility', 'hidden');
    });
}

function toggleReportTrendZeroDays(checked) {
    setReportTrendShowEmptySetting(!!checked);
    renderReportTrend();
}

function renderReportTrend() {
    const card = document.getElementById('report-trend-card');
    const meta = document.getElementById('report-trend-meta');
    const chart = document.getElementById('report-trend-chart');
    const peaks = document.getElementById('report-trend-peaks');
    const toggle = document.getElementById('report-trend-toggle-empty');
    if (!card || !meta || !chart || !peaks) return;
    if (toggle) toggle.checked = !!reportTrendShowEmptyDays;

    const knownPoints = Object.keys(storage || {})
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .map(d => {
            const day = storage[d];
            return {
                date: d,
                total: dayTotalForTrend(day),
                hasTellingDay: dayIsTrendTellingDay(day)
            };
        })
        .filter(p => p.hasTellingDay);

    if (!knownPoints.length) {
        card.classList.add('hidden');
        refreshHeaderSelectorVisibility();
        return;
    }
    card.classList.remove('hidden');

    const knownByDate = new Map(knownPoints.map(p => [p.date, p]));
    const minDate = knownPoints[0].date;
    const maxKnownDate = knownPoints[knownPoints.length - 1].date;
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(picker?.value || '') ? picker.value : todayISO();
    const maxDate = selectedDate > maxKnownDate ? selectedDate : maxKnownDate;
    const daySpanMs = new Date(`${maxDate}T00:00:00`).getTime() - new Date(`${minDate}T00:00:00`).getTime();
    const fullRangeCount = Math.max(1, Math.round(daySpanMs / 86400000) + 1);

    let points = [];
    let assumedZeroCount = 0;
    let hiddenZeroCount = 0;
    if (reportTrendShowEmptyDays) {
        let cursor = minDate;
        while (cursor <= maxDate) {
            const existing = knownByDate.get(cursor);
            if (existing) {
                points.push({ date: cursor, total: existing.total, hasTellingDay: true, assumed: false });
            } else {
                points.push({ date: cursor, total: 0, hasTellingDay: false, assumed: true });
                assumedZeroCount++;
            }
            cursor = isoWithDayOffset(cursor, 1);
        }
    } else {
        points = knownPoints.filter(p => p.total > 0).map(p => ({ ...p, assumed: false }));
        hiddenZeroCount = Math.max(0, fullRangeCount - points.length);
    }
    const emptyCount = points.filter(p => p.total === 0).length;

    if (!points.length) {
        meta.innerHTML = `Alle <strong>${fullRangeCount}</strong> dag(en) in deze periode hebben <strong>0</strong> dieren of zijn verborgen.`;
        chart.innerHTML = `
                    <div class="min-h-[220px] flex items-center justify-center text-center text-[12px] text-emerald-100/90 px-4">
                        Geen dagen met dieren in beeld. Zet "Toon lege teldagen (0)" aan om 0-dagen te tonen.
                    </div>
                `;
        peaks.innerHTML = `
                    <span class="px-2 py-1 rounded-full border bg-gray-800/70 border-gray-600 text-gray-200">
                        Lege dagen verborgen (${reportTrendShowEmptyDays ? emptyCount : hiddenZeroCount})
                    </span>
                `;
        return;
    }

    const top = points.reduce((best, p) => p.total > best.total ? p : best, points[0]);
    const totalSum = points.reduce((n, p) => n + p.total, 0);
    const avg = Math.round(totalSum / points.length);
    const avgLabel = reportTrendShowEmptyDays ? 'per dag in periode' : 'per teldag';
    const emptyInfo = reportTrendShowEmptyDays
        ? `${emptyCount} lege dag(en) zichtbaar${assumedZeroCount ? ` (${assumedZeroCount} automatisch als 0)` : ''}`
        : `${hiddenZeroCount} lege dag(en) verborgen`;
    meta.innerHTML = `Topdag: <strong>${trendDateLabel(top.date)}</strong> met <strong>${top.total}</strong> dieren · Gemiddeld <strong>${avg}</strong> ${avgLabel} · ${emptyInfo}`;

    const sortedTop = points.slice().sort((a, b) => b.total - a.total).slice(0, 3);
    peaks.innerHTML = sortedTop.map((p, i) => `
                <span class="px-2 py-1 rounded-full border ${i === 0 ? 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100' : 'bg-gray-800/70 border-gray-600 text-gray-200'}">
                    ${i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'} ${trendDateLabel(p.date)} · ${p.total}
                </span>
            `).join('');

    const maxValue = Math.max(...points.map(p => p.total), 1);
    const viewportWidth = Math.max(
        280,
        Math.floor((chart.parentElement?.clientWidth || chart.clientWidth || window.innerWidth || 360) - 8)
    );
    const width = Math.max(viewportWidth, (points.length - 1) * 56 + 96);
    const height = 220;
    const pad = { l: 44, r: 18, t: 18, b: 42 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const xOf = i => points.length === 1 ? (pad.l + innerW / 2) : (pad.l + (i / (points.length - 1)) * innerW);
    const yOf = v => pad.t + innerH - (v / maxValue) * innerH;
    const yTicks = 4;
    const labelStep = points.length > 12 ? Math.ceil(points.length / 8) : 1;

    const linePath = points.map((p, i) => `${i ? 'L' : 'M'} ${xOf(i).toFixed(2)} ${yOf(p.total).toFixed(2)}`).join(' ');
    const areaPath = `${linePath} L ${xOf(points.length - 1).toFixed(2)} ${(pad.t + innerH).toFixed(2)} L ${xOf(0).toFixed(2)} ${(pad.t + innerH).toFixed(2)} Z`;

    const grid = Array.from({ length: yTicks + 1 }).map((_, i) => {
        const ratio = i / yTicks;
        const y = (pad.t + innerH - ratio * innerH).toFixed(2);
        const val = Math.round(maxValue * ratio);
        return `
                    <line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="rgba(148,163,184,0.22)" stroke-width="1" />
                    <text x="${pad.l - 6}" y="${Number(y) + 4}" text-anchor="end" fill="#94a3b8" font-size="10">${val}</text>
                `;
    }).join('');

    const dots = points.map((p, i) => {
        const x = xOf(i);
        const y = yOf(p.total);
        const isTop = p.date === top.date && p.total === top.total;
        const isSelectedDay = p.date === picker.value;
        const label = trendDateLabel(p.date);
        return `
                    <g data-trend-point="1" data-date="${p.date}" data-label="${label}" data-total="${p.total}" data-x="${x.toFixed(2)}" data-y="${y.toFixed(2)}" tabindex="0" role="button" aria-label="${label}: ${p.total} dieren">
                        <title>${label}: ${p.total} dieren</title>
                        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="12" fill="transparent" />
                        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${isTop ? 6 : 4}" fill="${isTop ? '#facc15' : '#34d399'}" stroke="#06281f" stroke-width="${isTop ? 2 : 1.5}" />
                        ${isSelectedDay ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="9" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="2 2" />` : ''}
                        ${isTop ? `<text x="${x.toFixed(2)}" y="${(y - 10).toFixed(2)}" text-anchor="middle" fill="#fde68a" font-size="12">🐸</text>` : ''}
                    </g>
                `;
    }).join('');

    const labels = points.map((p, i) => {
        if (i % labelStep !== 0 && i !== points.length - 1) return '';
        const x = xOf(i);
        return `<text x="${x.toFixed(2)}" y="${height - 12}" text-anchor="middle" fill="#cbd5e1" font-size="10">${trendDateLabel(p.date)}</text>`;
    }).join('');

    chart.innerHTML = `
                <svg viewBox="0 0 ${width} ${height}" style="width:${width}px; height:${height}px; max-width:none; display:block;" role="img" aria-label="Teldagen trendgrafiek">
                    <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="rgba(52,211,153,0.45)" />
                            <stop offset="100%" stop-color="rgba(6,95,70,0.05)" />
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(2,6,23,0.45)" rx="10" />
                    ${grid}
                    <path d="${areaPath}" fill="url(#trendFill)" />
                    <path d="${linePath}" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
                    ${dots}
                    <g id="trend-point-tooltip" visibility="hidden" pointer-events="none">
                        <rect id="trend-point-tooltip-bg" x="0" y="0" width="120" height="22" rx="7" fill="rgba(2,6,23,0.9)" stroke="rgba(16,185,129,0.6)" stroke-width="1" />
                        <text id="trend-point-tooltip-text" x="60" y="14" text-anchor="middle" fill="#d1fae5" font-size="10" font-weight="700"></text>
                    </g>
                    ${labels}
                    <text x="${width - 8}" y="${height - 4}" text-anchor="end" fill="#64748b" font-size="9">dagen</text>
                    <text x="8" y="12" fill="#64748b" font-size="9">dieren</text>
                </svg>
            `;
    bindReportTrendInteractions();
    refreshHeaderSelectorVisibility();
}

function getReportTargetSession() {
    const d = picker.value;
    const data = ensureDay(d);
    const sel = document.getElementById('report-session-select');
    // Try explicit selection first
    if (sel && sel.value) return data.sessions.find(s => s.id === sel.value);

    // Then view mode
    if (reportMode === 'session' && viewedSessionId) return data.sessions.find(s => s.id === viewedSessionId);

    // In day mode, default to latest session for editing
    return getLatestSession(data);
}

function updateReportSessionRoute(val) {
    const s = getReportTargetSession();
    if (!s) return;
    updateRoute(s.id, val);
    updateReport();
}

function updateReportSessionNotes(val) {
    const s = getReportTargetSession();
    if (!s) return;
    updateSessionNotes(s.id, val);
    updateReport();
}

function updateReportSessionInputs(session) {
    const routeInp = document.getElementById('report-session-route');
    const notesInp = document.getElementById('report-session-notes');
    const weatherDiv = document.getElementById('report-session-weather');

    if (session) {
        if (routeInp) {
            routeInp.disabled = false;
            routeInp.value = session.routeName || '';
        }
        if (notesInp) {
            notesInp.disabled = false;
            notesInp.value = session.notes || '';
        }
        if (weatherDiv) {
            weatherDiv.innerHTML = session.weather
                ? (typeof weatherSummaryText === 'function' ? weatherSummaryText(session.weather, ' • ', true) : 'Weerdata beschikbaar')
                : '<span class="italic opacity-50">Geen weerdata (start sessie om te laden)</span>';
        }
    } else {
        if (routeInp) { routeInp.disabled = true; routeInp.value = ''; }
        if (notesInp) { notesInp.disabled = true; notesInp.value = ''; }
        if (weatherDiv) weatherDiv.innerText = '-';
    }
}

function updateReport() {
    const d = picker.value; const data = ensureDay(d);
    const sel = document.getElementById('report-session-select');
    const sessionId = sel ? (sel.value || (reportMode === 'session' ? viewedSessionId : '')) : (reportMode === 'session' ? viewedSessionId : '');
    const session = sessionId ? (data.sessions || []).find(s => s.id === sessionId) : null;
    const reportSessions = getReportEligibleSessions(data);
    renderReportSessionChecklist();
    const excludedSessions = (data.sessions || []).filter(s => !sessionIncludedInReports(s));
    const targetCounts = reportMode === 'session' && session ? (session.counts || {}) : getReportCountsForDay(data);
    const sessionsToShow = reportMode === 'session' && session ? [session] : reportSessions;

    // Update the editor UI in the Delen tab
    const editSession = session || (reportSessions.length === 1 ? reportSessions[0] : getLatestSession(data));
    updateReportSessionInputs(editSession);

    const routeSummaries = [];
    const routeSeen = new Set();
    const weatherSummaries = [];
    const weatherSeen = new Set();

    const addRouteSummary = value => {
        const route = normalizeRouteName(value || '');
        if (!route) return;
        const key = route.toLowerCase();
        if (routeSeen.has(key)) return;
        routeSeen.add(key);
        routeSummaries.push(route);
    };

    const addWeatherSummary = weather => {
        if (!weather) return;
        const summary = weatherSummaryText(weather, ' • ', true);
        const key = summary.toLowerCase();
        if (weatherSeen.has(key)) return;
        weatherSeen.add(key);
        weatherSummaries.push(summary);
    };

    sessionsToShow.forEach(s => {
        addRouteSummary(s.routeName || '');
        addWeatherSummary(s.weather);
    });

    if (!weatherSummaries.length) {
        const fallbackWeather = (reportMode === 'session' ? session?.weather : data.weather) || session?.weather;
        addWeatherSummary(fallbackWeather);
    }

    const showRoutePerSession = reportMode === 'session' || routeSummaries.length > 1;
    const showWeatherPerSession = reportMode === 'session' || weatherSummaries.length > 1;

    let txt = `🐸 *OVERZET-UPDATE - ${d}*\n\n`;
    if (weatherSummaries.length === 1) txt += `*Weer:* ${weatherSummaries[0]}\n\n`;
    if (weatherSummaries.length > 1) txt += `*Weer:* ${weatherSummaries.join(' | ')}\n\n`;
    if (reportMode === 'day' && routeSummaries.length === 1) txt += `*Traject:* ${routeSummaries[0]}\n\n`;
    if (reportMode === 'day' && routeSummaries.length > 1) txt += `*Trajecten:* ${routeSummaries.join(' | ')}\n\n`;
    const all = [...SPECIES, ...(data.custom || [])]; let h = false;
    all.forEach(s => {
        const pl = targetCounts[`${s.id}_p_l`] || 0, pd = targetCounts[`${s.id}_p_d`] || 0;
        const ml = targetCounts[`${s.id}_m_l`] || 0, vl = targetCounts[`${s.id}_v_l`] || 0, ol = targetCounts[`${s.id}_o_l`] || 0;
        const md = targetCounts[`${s.id}_m_d`] || 0, vd = targetCounts[`${s.id}_v_d`] || 0, od = targetCounts[`${s.id}_o_d`] || 0;
        if (pl + pd + ml + vl + ol + md + vd + od > 0) {
            h = true;
            txt += `*${s.name}:*\n${pl > 0 ? '  ❤️ ' + pl + ' Koppels (levend)\n' : ''}${pd > 0 ? '  ☠️ ' + pd + ' Koppels (dood)\n' : ''}  - Levend: ${ml}m, ${vl}v, ${ol}o\n  - Dood: ${md}m, ${vd}v, ${od}o\n`;
        }
    });
    txt += `\nℹ️ Koppels (❤️/☠️) worden niet dubbel geteld bij de losse man/vrouw-aantallen.\n`;
    if (reportMode === 'session' && session) {
        const note = formatSessionNote(session);
        if (note) txt += `\n📝 *Nota:* ${note}\n`;
        if (session.includeInReports === false) txt += `\n⚠️ Deze sessie staat op "niet meetellen in rapport".\n`;
    }
    if (reportMode === 'day' && data.notes) txt += `\n📝 *Nota:* ${data.notes}\n`;
    if (sessionsToShow.length) {
        txt += `\n⏱️ *Tellingen:*\n`;
        sessionsToShow.sort((a, b) => new Date(a.start) - new Date(b.start)).forEach(s => {
            const total = sumCounts(s.counts);
            const weatherTxt = showWeatherPerSession && s.weather ? ` | ${weatherSummaryText(s.weather, ' • ', true)}` : '';
            const routeName = normalizeRouteName(s.routeName || '');
            const routeTxt = showRoutePerSession && routeName ? ` | 🚶‍♂️ ${routeName}` : '';
            const contributors = sessionContributorNames(s);
            const who = contributors ? ` | 👤 ${contributors}` : '';
            txt += `  - ${sessionDisplayLabel(s, data)}: ${total} stuks${routeTxt}${who}${weatherTxt}\n`;
        });
        if (reportMode === 'day' && excludedSessions.length) {
            txt += `\n⚠️ ${excludedSessions.length} sessie(s) tellen niet mee in dit rapport.\n`;
        }
    }
    if (reportMode === 'day' && !sessionsToShow.length && (data.sessions || []).length) {
        txt += `\n⚠️ Geen tellingen geselecteerd. Zet minstens 1 sessie aan bovenaan.\n`;
    }
    txt += `\n#Paddentrek #Telling`;
    document.getElementById('report-text').innerText = h || data.notes || reportSessions.length || (data.sessions || []).length ? txt : "Nog geen data ingevoerd.";
    renderReportTrend();

    // determinaties blok
    const detBox = document.getElementById('report-dets');
    if (detBox) {
        const dets = (reportMode === 'session' && session)
            ? (session.determinations || [])
            : reportSessions.flatMap(s => s.determinations || []);
        const completedDets = dets.filter(d => !!d.result && !d.pending);
        if (!completedDets.length) {
            detBox.innerHTML = '<div class=\"text-gray-500\">Geen determinaties in deze selectie.</div>';
        } else {
            const parts = [];
            completedDets.slice().sort((a, b) => b.updatedAt - a.updatedAt).forEach(det => {
                const photos = det.photos?.length || 0;
                const label = det.resultName || 'Onbekend';
                const answers = det.answers || [];
                const ts = new Date(det.updatedAt).toLocaleString('nl-BE');
                const wiki = det.wikiThumb ? `<img src="${det.wikiThumb}" class="h-16 w-16 object-cover rounded-lg border border-gray-700 shadow" alt="${label}">` : '';
                const ansBadges = answers.map((a, idx) =>
                    `<span class="px-2 py-1 rounded-full text-[10px] font-bold ${a.answer === 'yes' ? 'bg-emerald-900/60 text-emerald-200' : 'bg-red-900/60 text-red-200'}">${idx + 1}. ${detAnswerLabel(a.answer)}</span>`
                ).join(' ');
                const ansList = answers.map((a, idx) => `<div class="text-[11px] flex gap-2"><span class="text-gray-500">${idx + 1}.</span><span class="flex-1 text-gray-200">${detQuestionText(a.node)}</span><span class="font-bold ${a.answer === 'yes' ? 'text-emerald-400' : 'text-red-400'}">${detAnswerLabel(a.answer)}</span></div>`).join('');
                const photoList = photos
                    ? det.photos.map((p, i) => `<div class="relative"><img src="${photoPreviewSrc(p)}" data-photo-ref="${encodePhotoRef(p)}" class="h-16 w-16 object-cover rounded-lg border border-emerald-500/30 shadow" onclick="openDetPhoto('${det.id}', ${i})"><span class="absolute -top-1 -left-1 bg-black/70 text-[9px] px-1 rounded-full">${i + 1}</span></div>`).join('')
                    : '<div class="text-gray-500 text-[10px]">Geen foto\'s</div>';
                parts.push(
                    '<div class="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-emerald-500/20 rounded-xl p-3 space-y-2 shadow-lg">' +
                    '<div class="flex items-start justify-between gap-2">' +
                    '<div class="flex items-start gap-2">' +
                    `<input type="checkbox" class="mt-1 share-det-checkbox checkbox-det" value="${det.id}">` +
                    `<div><div class="font-bold text-white">${label}</div><div class="text-gray-400 text-[10px]">${answers.length} vragen · ${photos} foto(s)</div></div>` +
                    '</div>' +
                    `<div class="text-[10px] text-gray-400">${ts}</div>` +
                    '</div>' +
                    (wiki ? `<div class="flex gap-2 items-center">${wiki}<div class="text-[10px] text-gray-400"></div></div>` : '') +
                    (ansBadges ? `<div class="flex flex-wrap gap-1">${ansBadges}</div>` : '<div class="text-gray-500 text-[10px]">Geen antwoorden</div>') +
                    (ansList ? `<div class="space-y-1 bg-black/20 border border-gray-800 rounded p-2">${ansList}</div>` : '') +
                    `<div class="flex gap-2 flex-wrap">${photoList}</div>` +
                    '</div>'
                );
            });
            detBox.innerHTML = parts.join('');
            hydratePhotoElements(detBox);
        }
    }
}

function setReportMode(m) {
    reportMode = m;
    if (m === 'session') {
        const day = ensureDay();
        if (!viewedSessionId && day.sessions.length) viewedSessionId = day.sessions[day.sessions.length - 1].id;
        const sel = document.getElementById('report-session-select');
        if (sel && viewedSessionId && Array.from(sel.options).some(o => o.value === viewedSessionId)) {
            sel.value = viewedSessionId;
        }
    } else {
        const sel = document.getElementById('report-session-select');
        if (sel) sel.value = '';
    }
    updateReport();
}

async function shareReport(includePhotos = false) {
    const day = ensureDay();
    const sel = document.getElementById('report-session-select');
    const sessionId = sel ? sel.value : '';
    const session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
    const text = document.getElementById('report-text').innerText || 'Geen data';
    let files = [];
    if (includePhotos) {
        const photos = reportMode === 'session' && session
            ? (session.photos || [])
            : getReportEligibleSessions(day).flatMap(s => s.photos || []);
        if (!photos.length) { alert('Geen foto’s beschikbaar voor deze selectie.'); return; }
        files = await buildShareFilesFromPhotoRefs(photos, (idx, ext) =>
            `paddentrek-${picker.value}-${idx + 1}.${ext}`
        );
        if (!files.length) { alert('Foto’s konden niet geladen worden voor delen.'); return; }
    }

    const shareData = includePhotos ? { title: 'Paddentrek Teller Pro', text, files } : { title: 'Paddentrek Teller Pro', text };
    try {
        if (navigator.share) {
            if (includePhotos) {
                if (navigator.canShare && !navigator.canShare({ files })) {
                    throw new Error('FILES_NOT_SUPPORTED');
                }
            }
            await navigator.share(shareData);
            return;
        }
    } catch (err) {
        if (err?.name === 'AbortError') return;
        if (err?.message === 'FILES_NOT_SUPPORTED') {
            alert('Je toestel ondersteunt geen delen met foto’s. Probeer zonder foto’s.');
            return;
        }
    }
    // Fallback: kopieer tekst zodat gebruiker zelf kan plakken in een app naar keuze
    const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    alert('Rapport gekopieerd. Plak het in je favoriete app (Signal/WhatsApp/Messenger).');
}

async function shareDeterminaties() {
    const day = ensureDay();
    const sel = document.getElementById('report-session-select');
    const sessionId = sel ? sel.value : '';
    const session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
    let dets = (reportMode === 'session' && session)
        ? (session?.determinations || [])
        : getReportEligibleSessions(day).flatMap(s => s.determinations || []);
    dets = dets.filter(d => !!d.result && !d.pending);
    const selected = Array.from(document.querySelectorAll('#report-dets .share-det-checkbox:checked')).map(cb => cb.value);
    if (selected.length) dets = dets.filter(d => selected.includes(d.id));
    if (!dets.length) { alert('Geen determinaties in deze selectie.'); return; }
    const lines = dets.map(d => {
        const ansLines = (d.answers || []).map((a, idx) =>
            `  ${idx + 1}. ${detQuestionText(a.node)} -> ${detAnswerLabel(a.answer)}`
        ).join('\n');
        const ts = new Date(d.updatedAt).toLocaleString('nl-BE');
        const fotos = (d.photos || []).length;
        return `🔎 ${d.resultName || 'Onbekend'}
• Tijd: ${ts}
• Antwoorden:
${ansLines || '  n.v.t.'}
• Foto's: ${fotos}`;
    });
    const text = `🐸 Determinaties ${picker.value} (${reportMode === 'session' && session ? 'sessie' : 'dag'})

${lines.join('\n\n')}`;
    let files = [];
    const photos = dets.flatMap(d => d.photos || []).slice(0, 10); // limiet om share API vriendelijk te houden
    if (photos.length) {
        files = await buildShareFilesFromPhotoRefs(photos, (idx, ext) =>
            `det-${picker.value}-${idx + 1}.${ext}`
        );
    }
    const shareData = files.length && navigator.canShare && navigator.canShare({ files })
        ? { title: 'Determinaties', text, files }
        : { title: 'Determinaties', text };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
            return;
        }
    } catch (err) {
        if (err?.name === 'AbortError') return;
    }
    const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    alert('Determinaties gekopieerd. Plak in je app naar keuze.');
}

function exportReportCSV(forceDay = false) {
    const d = picker.value;
    const day = ensureDay();
    const sel = document.getElementById('report-session-select');
    const sessionId = sel ? sel.value : '';
    const session = (!forceDay && sessionId) ? day.sessions.find(s => s.id === sessionId) : null;
    const counts = reportMode === 'session' && session ? session.counts || {} : getReportCountsForDay(day);
    const meta = reportMode === 'session' && session
        ? { route: session.routeName || '', notes: formatSessionNote(session), weather: session.weather }
        : { route: '', notes: day.notes || '', weather: day.weather };
    const rows = [];
    rows.push(['Datum', 'Scope', 'Route', 'Notities', 'Weer temp', 'Weer code', 'Soort', 'Koppels levend', 'Koppels dood', 'M levend', 'V levend', 'Onb levend', 'M dood', 'V dood', 'Onb dood', 'Totaal']);
    const all = [...SPECIES, ...(day.custom || [])];
    all.forEach(s => {
        const pl = counts[`${s.id}_p_l`] || 0, pd = counts[`${s.id}_p_d`] || 0;
        const ml = counts[`${s.id}_m_l`] || 0, vl = counts[`${s.id}_v_l`] || 0, ol = counts[`${s.id}_o_l`] || 0;
        const md = counts[`${s.id}_m_d`] || 0, vd = counts[`${s.id}_v_d`] || 0, od = counts[`${s.id}_o_d`] || 0;
        const tot = pl * 2 + pd * 2 + ml + vl + ol + md + vd + od;
        if (tot > 0) rows.push([
            d,
            session ? 'Sessie' : 'Dag',
            meta.route,
            meta.notes,
            meta.weather?.t ?? '',
            meta.weather?.c ?? '',
            s.name, pl, pd, ml, vl, ol, md, vd, od, tot
        ]);
    });
    if (rows.length === 1) rows.push(['Geen data', 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    downloadCSV(rows, session ? `paddentrek-${d}-${session.id}.csv` : `paddentrek-${d}-dag.csv`);
}

function downloadCSV(rows, name) {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV opgeslagen');
}

function exportAllSessionsCSV() {
    const d = picker.value;
    const day = ensureDay();
    const rows = [['Datum', 'Scope', 'SessionId', 'Sessiestart', 'Sessie-einde', 'Route', 'Notities', 'Weer temp', 'Weer code', 'Soort', 'Koppels levend', 'Koppels dood', 'M levend', 'V levend', 'Onb levend', 'M dood', 'V dood', 'Onb dood', 'Totaal']];
    const addRows = (scopeLabel, counts, route, notes, wt, wc, sessStart = '', sessEnd = '', sessId = '') => {
        const all = [...SPECIES, ...(day.custom || [])];
        all.forEach(s => {
            const pl = counts[`${s.id}_p_l`] || 0, pd = counts[`${s.id}_p_d`] || 0;
            const ml = counts[`${s.id}_m_l`] || 0, vl = counts[`${s.id}_v_l`] || 0, ol = counts[`${s.id}_o_l`] || 0;
            const md = counts[`${s.id}_m_d`] || 0, vd = counts[`${s.id}_v_d`] || 0, od = counts[`${s.id}_o_d`] || 0;
            const tot = pl * 2 + pd * 2 + ml + vl + ol + md + vd + od;
            if (tot > 0) rows.push([d, scopeLabel, sessId, sessStart, sessEnd, route, notes, wt, wc, s.name, pl, pd, ml, vl, ol, md, vd, od, tot]);
        });
    };
    if (day.sessions && day.sessions.length) {
        day.sessions.forEach(s => {
            const wt = s.weather?.t ?? day.weather?.t ?? '';
            const wc = s.weather?.c ?? day.weather?.c ?? '';
            addRows('Sessie', s.counts || {}, s.routeName || '', formatSessionNote(s), wt, wc, s.start || '', s.end || '', s.id || '');
        });
    }
    downloadCSV(rows, `paddentrek-${d}-sessies.csv`);
}

function copyReport() {
    const t = document.getElementById('report-text').innerText;
    const el = document.createElement('textarea'); el.value = t; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el); showToast("Gekopieerd!");
}

// --- UPDATE BADGE ---
const updateBtn = document.getElementById('update-btn');
function showUpdateBadge(version) {
    if (version && version === APP_VERSION) return; // niets nieuw
    updateBtn.classList.remove('hidden');
    updateBtn.innerText = version ? `UPDATE ${version}` : 'UPDATE BESCHIKBAAR';
}
updateBtn.onclick = async () => {
    updateBtn.innerText = 'Bezig...';
    updateBtn.disabled = true;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
            await reg.update();
            if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    } catch (_) {
        // noop
    } finally {
        setTimeout(() => location.reload(), 600);
    }
};

function showToast(m) {
    const t = document.getElementById('toast'); t.innerText = m; t.classList.remove('hidden');
    setTimeout(() => t.style.opacity = '1', 10);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 500); }, 2000);
}
if (window.__cdnFallbackUsed) {
    console.warn('CDN fallback actief: plaats lokale libs in ./vendor voor vaste versies/offline.');
}

function showDetModal(det) {
    const modal = document.getElementById('det-modal');
    const title = document.getElementById('det-modal-title');
    const rarity = document.getElementById('det-modal-rarity');
    const addBtn = document.getElementById('det-modal-add');
    if (!modal || !det) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    if (title) title.innerText = cleanSpeciesName(det.resultName || det.result || 'Determinatie');
    const [label, cls] = rarityFor(det.result || det.resultName || '');
    if (rarity) {
        rarity.className = `rarity-pill ${cls}`;
        rarity.innerText = label;
    }
    const query = cleanSpeciesName(det.resultName || det.result || '').trim();
    const wikiBtn = document.getElementById('det-modal-link');
    const npBtn = document.getElementById('det-modal-link-np');
    currentDetLinks = { wiki: null, np: null };
    if (query) {
        const npName = toSlug(query);
        currentDetLinks.wiki = `https://nl.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;
        currentDetLinks.np = `https://www.natuurpunt.be/soorten/amfibieen-reptielen/${npName}`;
        if (wikiBtn) {
            wikiBtn.dataset.url = currentDetLinks.wiki;
            wikiBtn.classList.remove('hidden');
            wikiBtn.disabled = false;
        }
        if (npBtn) {
            npBtn.dataset.url = currentDetLinks.np;
            npBtn.classList.remove('hidden');
            npBtn.disabled = false;
        }
    } else {
        if (wikiBtn) {
            wikiBtn.dataset.url = '';
            wikiBtn.classList.add('hidden');
            wikiBtn.disabled = true;
        }
        if (npBtn) {
            npBtn.dataset.url = '';
            npBtn.classList.add('hidden');
            npBtn.disabled = true;
        }
    }
    const sess = getDetSession();
    if (addBtn) addBtn.classList.toggle('hidden', !!sess?.detTemp); // verbergen bij losse determinatie
}

let currentDetLinks = { wiki: null, np: null };
function openDetLink(type) {
    const id = type === 'np' ? 'det-modal-link-np' : 'det-modal-link';
    const btn = document.getElementById(id);
    let url = btn?.dataset?.url || currentDetLinks?.[type] || '';
    if (!url) {
        const q = (document.getElementById('det-modal-title')?.innerText || '').trim();
        if (q) {
            if (type === 'np') url = `https://www.natuurpunt.be/soorten/amfibieen-reptielen/${toSlug(q)}`;
            else url = `https://nl.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`;
        }
    }
    if (url) window.open(url, '_blank');
}


function closeDetModal(ev) {
    if (ev) ev.stopPropagation();
    const modal = document.getElementById('det-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function normalizeShareSelectionState(day, state = null) {
    const sessions = Array.isArray(day?.sessions) ? day.sessions : [];
    const validIds = new Set(sessions.map(s => s.id));
    const incoming = state && typeof state === 'object' ? state : {};
    let sessionIds = Array.isArray(incoming.sessionIds) ? incoming.sessionIds.filter(id => validIds.has(id)) : [];
    let dayTotal = !!incoming.dayTotal;
    if (dayTotal) sessionIds = [];
    if (!dayTotal && !sessionIds.length) {
        if (sessions.length) sessionIds = sessions.map(s => s.id);
        else dayTotal = true;
    }
    return { dayTotal, sessionIds };
}

function getShareSelectionState(dayKey = picker.value) {
    const day = ensureDay(dayKey);
    const current = shareSelectionStateByDay[dayKey] || null;
    const normalized = normalizeShareSelectionState(day, current);
    shareSelectionStateByDay[dayKey] = normalized;
    return normalized;
}

function setShareSelectionState(dayKey = picker.value, state = null) {
    const day = ensureDay(dayKey);
    shareSelectionStateByDay[dayKey] = normalizeShareSelectionState(day, state);
}

function collectShareSelectionFromDom() {
    const dayCheckbox = document.getElementById('share-session-day-total');
    const sessionCheckboxes = Array.from(document.querySelectorAll('[data-share-session-id]'));
    const sessionIds = sessionCheckboxes.filter(cb => cb.checked).map(cb => cb.getAttribute('data-share-session-id')).filter(Boolean);
    return {
        dayTotal: !!dayCheckbox?.checked,
        sessionIds
    };
}

function syncShareSelectionFromDom(refreshQr = true) {
    const dayCheckbox = document.getElementById('share-session-day-total');
    const sessionCheckboxes = Array.from(document.querySelectorAll('[data-share-session-id]'));
    const meta = document.getElementById('share-session-checklist-meta');
    if (!dayCheckbox) return;
    const hasCheckedSession = sessionCheckboxes.some(cb => cb.checked);
    if (dayCheckbox.checked && hasCheckedSession) {
        sessionCheckboxes.forEach(cb => cb.checked = false);
    } else if (!dayCheckbox.checked && !hasCheckedSession) {
        if (sessionCheckboxes.length) sessionCheckboxes[0].checked = true;
        else dayCheckbox.checked = true;
    }
    setShareSelectionState(picker.value, collectShareSelectionFromDom());
    if (meta) {
        if (sessionCheckboxes.length) {
            const selectedCount = sessionCheckboxes.filter(cb => cb.checked).length;
            meta.innerText = dayCheckbox.checked
                ? 'Hele dag geselecteerd om te delen.'
                : `${selectedCount} van ${sessionCheckboxes.length} sessie(s) geselecteerd om te delen.`;
        } else {
            meta.innerText = 'Geen sessies gevonden. Je kan enkel het dagtotaal delen.';
        }
    }
    if (refreshQr) generateQR(false);
    else updateQrSummary();
}

function onShareDayTotalChanged() {
    const dayCheckbox = document.getElementById('share-session-day-total');
    const sessionCheckboxes = Array.from(document.querySelectorAll('[data-share-session-id]'));
    if (dayCheckbox?.checked) sessionCheckboxes.forEach(cb => cb.checked = false);
    syncShareSelectionFromDom(true);
}

function onShareSessionSelectionChanged() {
    const dayCheckbox = document.getElementById('share-session-day-total');
    const hasCheckedSession = Array.from(document.querySelectorAll('[data-share-session-id]')).some(cb => cb.checked);
    if (dayCheckbox && hasCheckedSession) dayCheckbox.checked = false;
    syncShareSelectionFromDom(true);
}

function buildQRSessionOptions() {
    const list = document.getElementById('share-session-checklist');
    const meta = document.getElementById('share-session-checklist-meta');
    if (!list || !meta) return;
    const day = ensureDay();
    const sessions = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    const state = getShareSelectionState(picker.value);
    const totalSessions = sessions.length;
    if (totalSessions) {
        meta.innerText = state.dayTotal
            ? 'Hele dag geselecteerd om te delen.'
            : `${state.sessionIds.length} van ${totalSessions} sessie(s) geselecteerd om te delen.`;
    } else {
        meta.innerText = 'Geen sessies gevonden. Je kan enkel het dagtotaal delen.';
    }
    const dayChecked = state.dayTotal ? 'checked' : '';
    const dayTotal = sumCounts(day.counts || {});
    list.innerHTML = `
                <label class="flex items-start gap-2 bg-gray-900/65 border border-gray-700 rounded-lg px-2 py-2 cursor-pointer">
                    <input id="share-session-day-total" type="checkbox" class="mt-0.5 accent-cyan-500" ${dayChecked} onchange="onShareDayTotalChanged()">
                    <div class="flex-1 min-w-0">
                        <div class="text-[11px] text-cyan-100 font-semibold">Hele dag (samenvatting)</div>
                        <div class="text-[10px] text-gray-400">${dayTotal} dieren</div>
                    </div>
                </label>
            `;
    const sessionRows = sessions.map(s => {
        const checked = state.sessionIds.includes(s.id) ? 'checked' : '';
        const total = sumCounts(s.counts || {});
        const label = sessionDisplayLabel(s, day);
        const route = normalizeRouteName(s.routeName || '');
        return `
                    <label class="flex items-start gap-2 bg-gray-900/65 border border-gray-700 rounded-lg px-2 py-2 cursor-pointer">
                        <input type="checkbox" class="mt-0.5 accent-cyan-500" data-share-session-id="${s.id}" ${checked} onchange="onShareSessionSelectionChanged()">
                        <div class="flex-1 min-w-0">
                            <div class="text-[11px] text-gray-100 font-semibold">${label}${route ? ` · ${route}` : ''}</div>
                            <div class="text-[10px] text-gray-400">${total} dieren</div>
                        </div>
                    </label>
                `;
    }).join('');
    list.innerHTML += sessionRows;
    syncShareSelectionFromDom(false);
}

function buildReportSessionOptions() {
    const sel = document.getElementById('report-session-select');
    if (!sel) return;
    const day = ensureDay();
    const preferred = viewedSessionId && day.sessions.some(s => s.id === viewedSessionId)
        ? viewedSessionId
        : sel.value;
    sel.innerHTML = '<option value=\"\">Overzicht geselecteerde tellingen</option>' + day.sessions.map(s => {
        const includeTag = s.includeInReports === false ? ' · (niet meetellen)' : '';
        const label = `${sessionDisplayLabel(s, day)}${s.routeName ? ' · ' + s.routeName : ''}${includeTag}`;
        return `<option value="${s.id}">${label}</option>`;
    }).join('');
    if (reportMode === 'day') {
        sel.value = '';
    } else {
        sel.value = day.sessions.some(s => s.id === preferred) ? preferred : '';
    }
}

function renderReportSessionChecklist() {
    const box = document.getElementById('report-session-checklist');
    const meta = document.getElementById('report-session-checklist-meta');
    if (!box || !meta) return;
    const day = ensureDay();
    const sessions = day.sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    if (!sessions.length) {
        box.innerHTML = '<div class="text-[11px] text-gray-500">Nog geen tellingen voor deze datum.</div>';
        meta.innerText = '';
        return;
    }
    const includedCount = sessions.filter(sessionIncludedInReports).length;
    meta.innerText = `${includedCount} van ${sessions.length} tellingen opgenomen in het rapport.`;
    box.innerHTML = sessions.map(s => {
        const total = sumCounts(s.counts || {});
        const label = sessionDisplayLabel(s, day);
        const route = normalizeRouteName(s.routeName || '');
        const autoNote = (s.autoContributorNote || '').trim();
        return `
                    <label class="flex items-start gap-2 bg-gray-900/65 border border-gray-700 rounded-lg px-2 py-2 cursor-pointer">
                        <input type="checkbox" class="mt-0.5 accent-emerald-500" ${s.includeInReports !== false ? 'checked' : ''} onchange="toggleSessionInclude('${s.id}','${picker.value}', this.checked)">
                        <div class="flex-1 min-w-0">
                            <div class="text-[11px] text-gray-100 font-semibold">${label}${route ? ` · ${route}` : ''}</div>
                            <div class="text-[10px] text-gray-400">${total} dieren</div>
                            ${autoNote ? `<div class="text-[10px] text-cyan-200">${autoNote}</div>` : ''}
                        </div>
                    </label>
                `;
    }).join('');
}

function setAllReportSessionsIncluded(include = true, dayKey = picker.value) {
    const day = ensureDay(dayKey);
    if (!day.sessions.length) return;
    day.sessions.forEach(s => s.includeInReports = !!include);
    save();
    render();
    renderSessionAdmin();
    showToast(include ? 'Alle tellingen tellen mee' : 'Geen tellingen geselecteerd');
}

function buildRouteSuggestions() {
    const dl = document.getElementById('route-suggestions');
    if (!dl) return;
    const seen = new Set();
    const names = [];
    const addName = value => {
        const route = normalizeRouteName(value);
        if (!route) return;
        const key = route.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(route);
    };

    const profile = getContributorProfile();
    normalizeRouteHistory(profile.routeHistory || []).forEach(addName);
    if (profile.lastRouteName) addName(profile.lastRouteName);

    Object.keys(storage || {}).sort().reverse().forEach(dayKey => {
        const day = storage[dayKey];
        const sessions = Array.isArray(day?.sessions) ? day.sessions.slice() : [];
        sessions
            .sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0))
            .forEach(s => addName(s?.routeName || ''));
    });

    dl.innerHTML = names.slice(0, 60).map(n => `<option value="${n}"></option>`).join('');
}

function normalizeCustomSpeciesList(list) {
    return (Array.isArray(list) ? list : [])
        .filter(s => s && typeof s === 'object' && typeof s.name === 'string')
        .map(s => ({
            id: typeof s.id === 'string' && s.id.trim() ? s.id : `c_${toSlug(s.name) || simpleHash(s.name)}`,
            name: s.name.trim(),
            color: s.color || 'gray',
            hasAmplexus: !!s.hasAmplexus
        }))
        .filter(s => !!s.name);
}

function buildPayloadHash(payload) {
    const basis = {
        c: payload?.c || {},
        s: normalizeCustomSpeciesList(payload?.s || []).map(s => ({ id: s.id, name: s.name })),
        sourceDate: payload?.sourceDate || payload?.d || '',
        sourceLabel: payload?.sourceLabel || '',
        sourceRoute: payload?.sourceRoute || '',
        contributorId: payload?.contributorId || ''
    };
    return simpleHash(stableStringify(basis));
}

function buildContributionId(contributorId, sourceDate, sessionId = '') {
    const seed = `${contributorId || ''}|${sourceDate || ''}|${sessionId || 'day'}`;
    return `contrib_${simpleHash(seed)}`;
}

function ensureShareIdentity(requireInput = false) {
    if (requireInput) return ensureContributorIdentity();
    const profile = getContributorProfile();
    const nameInput = document.getElementById('share-contributor-name');
    const rawName = nameInput ? (nameInput.value || '').trim() : (profile.name || '').trim();
    const contributorName = rawName || 'Onbekende teller';
    const nextProfile = saveContributorProfile({
        ...profile,
        name: contributorName === 'Onbekende teller' ? (profile.name || '') : contributorName
    });
    if (nameInput && !nameInput.value.trim()) nameInput.value = nextProfile.name;
    return { contributorId: nextProfile.id, contributorName };
}

function buildSyncPayloadForSource(dayKey, day, session, identity) {
    const sessionId = session?.id || '';
    const counts = cloneJSON(session ? (session.counts || {}) : (day.counts || {}));
    const custom = normalizeCustomSpeciesList(cloneJSON(day.custom || []));
    const sourceLabel = session ? sessionDisplayLabel(session, day) : 'Volledige dag';
    const sourceRoute = normalizeRouteName(session?.routeName || document.getElementById('share-route-name')?.value || '');
    const contributionId = buildContributionId(identity.contributorId, dayKey, sessionId || '');
    const payload = {
        v: SYNC_PAYLOAD_VERSION,
        id: contributionId,
        contributionId,
        createdAt: Date.now(),
        sourceDate: dayKey,
        sourceLabel,
        sourceRoute,
        sess: sessionId || null,
        c: counts,
        s: custom,
        contributorName: identity.contributorName || 'Onbekende teller',
        contributorId: identity.contributorId || `legacy_${simpleHash(identity.contributorName || 'unknown')}`
    };
    payload.h = buildPayloadHash(payload);
    return payload;
}

function buildSyncPayloadListFromSelection(requireIdentity = false) {
    const d = picker.value;
    const day = ensureDay(d);
    const identity = ensureShareIdentity(requireIdentity);
    if (!identity) return [];
    const state = getShareSelectionState(d);
    const selectedSessions = state.dayTotal
        ? [null]
        : state.sessionIds
            .map(id => day.sessions.find(s => s.id === id))
            .filter(Boolean);
    const fallbackSources = selectedSessions.length ? selectedSessions : [null];
    return fallbackSources
        .map(session => buildSyncPayloadForSource(d, day, session, identity))
        .filter(payload => sumCounts(payload.c || {}) > 0);
}

function buildSyncPayloadFromSelection(requireIdentity = false) {
    return buildSyncPayloadListFromSelection(requireIdentity)[0] || null;
}

function listSyncPayloadsFromTransfer(transfer) {
    if (!transfer) return [];
    if (Array.isArray(transfer.items)) return transfer.items.filter(item => item && typeof item === 'object');
    return (transfer && typeof transfer === 'object') ? [transfer] : [];
}

function buildSyncTransferFromSelection(requireIdentity = false) {
    const payloads = buildSyncPayloadListFromSelection(requireIdentity);
    if (!payloads.length) return null;
    if (payloads.length === 1) return payloads[0];
    return {
        v: SYNC_PAYLOAD_VERSION,
        kind: 'bundle',
        createdAt: Date.now(),
        sourceDate: picker.value,
        sourceLabel: `${payloads.length} sessies`,
        items: payloads
    };
}

function generateQR(requireIdentity = false) {
    const container = document.getElementById("qrcode-area");
    if (container) container.innerHTML = "";
    const transfer = buildSyncTransferFromSelection(requireIdentity);
    if (!transfer || !container) return;
    const raw = JSON.stringify(transfer);
    if (raw.length > 3000) {
        alert('Deze selectie is te groot voor een stabiele QR-code. Kies minder sessies of gebruik de deel-link.');
        updateQrSummary(transfer);
        return;
    }
    new QRCode(container, { text: raw, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.L });
    updateQrSummary(transfer);
    save();
}

function updateQrSummary(payloadOverride = null) {
    const d = picker.value;
    const box = document.getElementById('qr-summary-box');
    if (!box) return;
    const transfer = payloadOverride || buildSyncTransferFromSelection(false);
    const payloads = listSyncPayloadsFromTransfer(transfer);
    if (!payloads.length) {
        box.innerText = 'Geen data geselecteerd om te delen.';
        return;
    }
    if (payloads.length === 1) {
        const payload = payloads[0];
        const day = ensureDay(d);
        const sessionId = payload.sess || '';
        const session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
        const counts = payload.c || {};
        const total = sumCounts(counts);
        const lines = [
            `Dag: ${payload.sourceDate || d}`,
            `Bron: ${payload.sourceLabel || (session ? sessionDisplayLabel(session, day) : 'Volledige dag')}`,
            payload.sourceRoute ? `Traject: ${payload.sourceRoute}` : '',
            `Teller: ${payload.contributorName || 'Onbekende teller'}`,
            `Totaal dieren: ${total}`
        ].filter(Boolean);
        const perSpecies = {};
        for (const k in counts) {
            const [sid, suf] = k.split('_');
            perSpecies[sid] = perSpecies[sid] || 0;
            perSpecies[sid] += counts[k] * (suf.includes('p_') ? 2 : 1);
        }
        Object.entries(perSpecies).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([sid, val]) => {
            const name = (SPECIES.find(s => s.id === sid) || (payload.s || []).find(c => c.id === sid) || { name: sid }).name;
            lines.push(`${name}: ${val}`);
        });
        box.innerText = `Wie deze QR scant, krijgt eerst een wizard en kan deze data als aparte telling toevoegen:\n\n${lines.join('\n')}`;
        return;
    }

    const total = payloads.reduce((acc, payload) => acc + sumCounts(payload.c || {}), 0);
    const contributors = Array.from(new Set(payloads.map(p => p.contributorName || 'Onbekende teller')));
    const lines = payloads.slice(0, 6).map((payload, idx) => {
        const route = normalizeRouteName(payload.sourceRoute || '');
        const count = sumCounts(payload.c || {});
        return `${idx + 1}. ${payload.sourceLabel || `Telling ${idx + 1}`}${route ? ` · ${route}` : ''} (${count} dieren)`;
    });
    if (payloads.length > 6) lines.push(`+${payloads.length - 6} extra telling(en)`);
    box.innerText =
        `Wie deze QR scant, krijgt eerst een wizard en kan ${payloads.length} aparte telling(en) toevoegen.\n\n` +
        `Dag: ${payloads[0]?.sourceDate || d}\n` +
        `Teller(s): ${contributors.join(', ')}\n` +
        `Totaal dieren in selectie: ${total}\n\n` +
        lines.join('\n');
}

function summarizeIncomingCounts(incoming) {
    const label = {
        p_l: '❤️ koppels', p_d: '☠️ koppels', m_l: 'm levend', v_l: 'v levend', o_l: 'o levend',
        m_d: 'm dood', v_d: 'v dood', o_d: 'o dood'
    };
    const nameFor = id => {
        const base = SPECIES.find(s => s.id === id);
        if (base) return base.name;
        const inc = (incoming.s || []).find(s => s.id === id);
        return inc ? inc.name : id;
    };
    const perSpecies = {};
    for (const k in incoming.c || {}) {
        const [sid, suf] = k.split('_');
        if (!perSpecies[sid]) perSpecies[sid] = [];
        perSpecies[sid].push(`${incoming.c[k]} × ${label[suf] || suf}`);
    }
    const lines = Object.entries(perSpecies).map(([sid, items]) => `- ${nameFor(sid)}: ${items.join(', ')}`);
    return lines.length ? lines.join('\n') : 'Geen teldata ontvangen.';
}

function sanitizeIncomingSyncPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const rawCounts = payload.c && typeof payload.c === 'object' ? payload.c : {};
    const counts = {};
    for (const k in rawCounts) {
        const n = Number(rawCounts[k]);
        if (!isFinite(n) || n === 0) continue;
        const legacyKey = toLegacyCountKey(k);
        counts[legacyKey] = (counts[legacyKey] || 0) + n;
    }
    const custom = normalizeCustomSpeciesList(payload.s || []);
    const sourceDate = typeof payload.sourceDate === 'string' ? payload.sourceDate : (typeof payload.d === 'string' ? payload.d : '');
    const sourceLabel = typeof payload.sourceLabel === 'string' ? payload.sourceLabel : '';
    const sourceRoute = normalizeRouteName(
        typeof payload.sourceRoute === 'string'
            ? payload.sourceRoute
            : (typeof payload.routeName === 'string' ? payload.routeName : '')
    );
    const createdAt = Number(payload.createdAt) || Date.now();
    const incomingId = typeof payload.contributionId === 'string' ? payload.contributionId : (typeof payload.id === 'string' ? payload.id : '');
    const fallbackId = `legacy_${simpleHash(`${sourceDate}|${sourceLabel}|${stableStringify(counts)}`)}`;
    const contributionId = incomingId || fallbackId;
    const contributorName = typeof payload.contributorName === 'string' && payload.contributorName.trim()
        ? payload.contributorName.trim()
        : 'Onbekende teller';
    const contributorId = typeof payload.contributorId === 'string' && payload.contributorId.trim()
        ? payload.contributorId.trim()
        : `legacy_${simpleHash(`${contributorName}|${contributionId}`)}`;
    const normalized = {
        v: Number(payload.v) || 1,
        id: contributionId,
        contributionId,
        createdAt,
        sourceDate,
        sourceLabel,
        sourceRoute,
        sess: payload.sess || null,
        c: counts,
        s: custom,
        contributorName,
        contributorId
    };
    normalized.h = typeof payload.h === 'string' ? payload.h : buildPayloadHash(normalized);
    return normalized;
}

function extractIncomingSyncPayloadList(payloadInput) {
    if (!payloadInput || typeof payloadInput !== 'object') return [];
    const seen = new Set();
    if (Array.isArray(payloadInput.items)) {
        return payloadInput.items
            .map(item => sanitizeIncomingSyncPayload(item))
            .filter(item => item && Object.keys(item.c || {}).length > 0)
            .filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
    }
    const parsed = sanitizeIncomingSyncPayload(payloadInput);
    if (!parsed || !Object.keys(parsed.c || {}).length) return [];
    return [parsed];
}

function normalizeIncomingSyncTransfer(payloadInput) {
    const items = extractIncomingSyncPayloadList(payloadInput);
    if (!items.length) return null;
    if (items.length === 1) return items[0];
    return {
        v: Number(payloadInput?.v) || SYNC_PAYLOAD_VERSION,
        kind: 'bundle',
        createdAt: Number(payloadInput?.createdAt) || Date.now(),
        sourceDate: typeof payloadInput?.sourceDate === 'string' ? payloadInput.sourceDate : (items[0]?.sourceDate || ''),
        sourceLabel: typeof payloadInput?.sourceLabel === 'string' ? payloadInput.sourceLabel : `${items.length} sessies`,
        items
    };
}

function summarizeIncomingPayloadList(payloads, limit = 6) {
    const list = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
    if (!list.length) return 'Geen teldata ontvangen.';
    if (list.length === 1) return summarizeIncomingCounts(list[0]);
    const lines = list.slice(0, limit).map((p, idx) => {
        const route = normalizeRouteName(p.sourceRoute || '');
        const total = sumCounts(p.c || {});
        const already = !!findImportedSessionLocation(p.id, getSyncImportEntry(p.id));
        return `${idx + 1}. ${p.sourceLabel || `Telling ${idx + 1}`}${route ? ` · ${route}` : ''} (${total} dieren)${already ? ' [al bekend]' : ''}`;
    });
    if (list.length > limit) lines.push(`+${list.length - limit} extra telling(en)`);
    return lines.join('\n');
}

function clearSyncQueryFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SYNC_QUERY_PARAM)) return;
    url.searchParams.delete(SYNC_QUERY_PARAM);
    const q = url.searchParams.toString();
    history.replaceState({}, '', `${url.pathname}${q ? `?${q}` : ''}${url.hash}`);
}

function renderIncomingSyncCard() {
    const card = document.getElementById('sync-incoming-card');
    const meta = document.getElementById('sync-incoming-meta');
    const summary = document.getElementById('sync-incoming-summary');
    if (!card || !meta || !summary) return;
    if (!pendingSyncLinkPayload) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');
    const payloads = listSyncPayloadsFromTransfer(pendingSyncLinkPayload);
    if (!payloads.length) {
        card.classList.add('hidden');
        return;
    }
    const total = payloads.reduce((acc, p) => acc + sumCounts(p.c || {}), 0);
    const createdAt = Number(pendingSyncLinkPayload?.createdAt) || Number(payloads[0]?.createdAt) || Date.now();
    const created = new Date(createdAt).toLocaleString('nl-BE');
    const srcDate = payloads[0]?.sourceDate || pendingSyncLinkPayload?.sourceDate || 'onbekend';
    const contributors = Array.from(new Set(payloads.map(p => p.contributorName || 'Onbekende teller')));
    const alreadyCount = payloads.filter(p => !!findImportedSessionLocation(p.id, getSyncImportEntry(p.id))).length;
    meta.innerText =
        `Bron: ${srcDate} · ${created}\n` +
        `Teller(s): ${contributors.join(', ')}\n` +
        `${payloads.length} telling(en), ${total} dieren totaal.` +
        `${alreadyCount ? ` ${alreadyCount} bijdrage(n) zijn al bekend en worden overgeslagen.` : ''}\n` +
        `De wizard opent normaal automatisch. Deze kaart is een fallback als je later alsnog wil toevoegen.`;
    summary.innerText = summarizeIncomingPayloadList(payloads);
}

function buildSyncWizardTargetOptions() {
    const dateInput = document.getElementById('sync-wizard-date');
    const hint = document.getElementById('sync-wizard-hint');
    if (!dateInput || !hint) return;
    if (!dateInput.value) dateInput.value = picker.value || todayISO();
    updateSyncWizardHint();
}

function updateSyncWizardHint() {
    const dateInput = document.getElementById('sync-wizard-date');
    const hint = document.getElementById('sync-wizard-hint');
    if (!dateInput || !hint) return;
    const dayKey = dateInput.value || picker.value || todayISO();
    hint.innerText =
        `Stap 3: voeg deze link toe als aparte telling(en) op ${dayKey}.\n` +
        `Er wordt niets bijgeteld in bestaande tellingen.`;
}

function openSyncWizard() {
    const modal = document.getElementById('sync-wizard-modal');
    const meta = document.getElementById('sync-wizard-meta');
    const summary = document.getElementById('sync-wizard-summary');
    const dateInput = document.getElementById('sync-wizard-date');
    if (!modal || !meta || !summary || !dateInput || !pendingSyncLinkPayload) return;
    const payloads = listSyncPayloadsFromTransfer(pendingSyncLinkPayload);
    if (!payloads.length) return;
    const total = payloads.reduce((acc, p) => acc + sumCounts(p.c || {}), 0);
    const createdAt = Number(pendingSyncLinkPayload?.createdAt) || Number(payloads[0]?.createdAt) || Date.now();
    const created = new Date(createdAt).toLocaleString('nl-BE');
    const srcDate = payloads[0]?.sourceDate || pendingSyncLinkPayload?.sourceDate || 'onbekend';
    const contributors = Array.from(new Set(payloads.map(p => p.contributorName || 'Onbekende teller')));
    const alreadyCount = payloads.filter(p => !!findImportedSessionLocation(p.id, getSyncImportEntry(p.id))).length;
    meta.innerText =
        `Stap 1: controleer de bron.\n` +
        `• ${srcDate}\n` +
        `• Teller(s): ${contributors.join(', ')}\n` +
        `• ${created}\n` +
        `• ${payloads.length} telling(en), ${total} dieren\n` +
        `${alreadyCount ? `• ${alreadyCount} bijdrage(n) zijn al bekend en worden overgeslagen.\n` : ''}` +
        `• Na toevoegen staan deze data als aparte tellingen in je lijst.`;
    summary.innerText = `Stap 2: inhoud van de link\n\n${summarizeIncomingPayloadList(payloads)}`;
    dateInput.value = picker.value || todayISO();
    buildSyncWizardTargetOptions();
    modal.classList.remove('hidden');
}

function closeSyncWizard(ev = null) {
    const modal = document.getElementById('sync-wizard-modal');
    if (!modal) return;
    if (ev && ev.target && ev.target.id !== 'sync-wizard-modal' && !ev.target.closest('[data-sync-close="1"]')) return;
    modal.classList.add('hidden');
}

function mergeIncomingCustomSpecies(day, payload) {
    normalizeCustomSpeciesList(payload?.s || []).forEach(si => {
        if (!day.custom.some(c => c.name === si.name || c.id === si.id)) day.custom.push(cloneJSON(si));
    });
}

function normalizeContributorDisplayName(name = '', contributorId = '') {
    if (typeof contributorId === 'string' && contributorId.startsWith('legacy_user_')) return 'mezelf';
    const raw = String(name || '').trim();
    const low = raw.toLowerCase();
    if (low === 'legacy telling' || low === 'legacy-telling' || low === 'legacy') return 'mezelf';
    return raw || 'Onbekende teller';
}

function ensureImportSessionForContribution(dayKey, payload = null, existingSession = null) {
    if (existingSession) return existingSession;
    const day = ensureDay(dayKey);
    const createdAt = Number(payload?.createdAt) || Date.now();
    const createdIso = new Date(createdAt).toISOString();
    const session = {
        id: `syncsess_${createdAt}_${randomHex(4)}`,
        start: createdIso,
        end: createdIso,
        counts: {},
        notes: '',
        weather: null,
        photos: [],
        routeName: normalizeRouteName(payload?.sourceRoute || ''),
        determinations: [],
        detTemp: false,
        includeInReports: true,
        contributions: [],
        contributorRoster: [],
        autoContributorNote: ''
    };
    day.sessions.push(session);
    return session;
}

function findImportedSessionLocation(contributionId, hint = null) {
    if (!contributionId) return null;
    const tryLocate = (dayKey, sessionId = '') => {
        if (!dayKey || !storage[dayKey]) return null;
        const day = ensureDay(dayKey);
        let session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
        if (!session) {
            session = day.sessions.find(s => (s.contributions || []).some(c => c.contributionId === contributionId));
        }
        if (!session) return null;
        const rec = (session.contributions || []).find(c => c.contributionId === contributionId) || null;
        return { dayKey, day, session, record: rec };
    };

    const hinted = tryLocate(hint?.dayKey || '', hint?.sessionId || '');
    if (hinted) return hinted;

    const dayKeys = Object.keys(storage || {}).sort();
    for (let i = 0; i < dayKeys.length; i++) {
        const found = tryLocate(dayKeys[i]);
        if (found) return found;
    }
    return null;
}

function rebuildSessionContributorRoster(session) {
    if (!session) return;
    const map = new Map();
    (session.contributions || []).forEach(c => {
        const id = c?.contributorId || '';
        const name = normalizeContributorDisplayName(c?.contributorName || '', id);
        const route = normalizeRouteName(c?.sourceRoute || '');
        const key = id || `name_${name.toLowerCase()}`;
        if (!map.has(key)) {
            map.set(key, { id: id || `legacy_${simpleHash(name)}`, name, route });
        } else if (route && !map.get(key).route) {
            map.get(key).route = route;
        }
    });
    session.contributorRoster = Array.from(map.values());
    const names = session.contributorRoster
        .map(r => r.route ? `${r.name} (${r.route})` : r.name)
        .filter(Boolean);
    session.autoContributorNote = names.length ? `Data van ${names.join(', ')}` : '';
}

function importContributionPayload(payloadInput, dayKey) {
    const payload = sanitizeIncomingSyncPayload(payloadInput);
    if (!payload || !Object.keys(payload.c || {}).length) {
        return { ok: false, status: 'invalid', summary: 'Geen teldata ontvangen.' };
    }
    const hash = payload.h || buildPayloadHash(payload);
    const existing = getSyncImportEntry(payload.id);
    const located = findImportedSessionLocation(payload.id, existing);

    if (existing && existing.hash && existing.hash === hash && located?.session) {
        return {
            ok: true,
            status: 'already',
            summary: `Bijdrage van ${payload.contributorName || 'Onbekende teller'} was al bekend en is overgeslagen.`,
            payload
        };
    }
    if (existing && !existing.hash && located?.session) {
        return {
            ok: true,
            status: 'already',
            summary: `Bijdrage van ${payload.contributorName || 'Onbekende teller'} was al bekend en is overgeslagen.`,
            payload
        };
    }

    const targetDayKey = located?.dayKey || dayKey;
    const day = ensureDay(targetDayKey);
    mergeIncomingCustomSpecies(day, payload);

    const targetSession = ensureImportSessionForContribution(targetDayKey, payload, located?.session || null);
    const route = normalizeRouteName(payload.sourceRoute || targetSession.routeName || '');
    const createdAt = Number(payload.createdAt) || Date.now();
    const createdIso = new Date(createdAt).toISOString();
    targetSession.start = targetSession.start || createdIso;
    targetSession.end = targetSession.end || createdIso;
    targetSession.counts = cloneJSON(payload.c || {});
    if (route) targetSession.routeName = route;
    if (typeof targetSession.includeInReports !== 'boolean') targetSession.includeInReports = true;
    if (!Array.isArray(targetSession.contributions)) targetSession.contributions = [];
    const rec = {
        contributionId: payload.id,
        hash,
        counts: cloneJSON(payload.c || {}),
        createdAt,
        sourceDate: payload.sourceDate || '',
        sourceLabel: payload.sourceLabel || '',
        sourceRoute: route,
        contributorId: payload.contributorId || '',
        contributorName: payload.contributorName || 'Onbekende teller',
        importedAt: Date.now()
    };
    targetSession.contributions = [rec];
    rebuildSessionContributorRoster(targetSession);
    if (!targetSession.routeName) {
        const rosterRoute = (targetSession.contributorRoster || []).find(r => normalizeRouteName(r.route || ''))?.route || '';
        if (rosterRoute) targetSession.routeName = rosterRoute;
    }
    recalcDayFromSessions(day);

    markSyncImported(payload.id, { hash, dayKey: targetDayKey, sessionId: targetSession.id });
    const status = located?.session ? 'updated' : 'new';
    const summary = describeSync({ ...payload, d: payload.sourceDate || targetDayKey }, targetDayKey);
    return { ok: true, status, summary, payload, targetSession, targetDayKey };
}

function importContributionPayloadBatch(payloadInput, dayKey) {
    const payloads = extractIncomingSyncPayloadList(payloadInput);
    if (!payloads.length) {
        return {
            ok: false,
            status: 'invalid',
            summary: 'Geen teldata ontvangen.',
            batch: { total: 0, newCount: 0, updatedCount: 0, alreadyCount: 0 }
        };
    }
    if (payloads.length === 1) {
        const single = importContributionPayload(payloads[0], dayKey);
        const singleStatus = single?.status || 'invalid';
        return {
            ...single,
            batch: {
                total: 1,
                newCount: singleStatus === 'new' ? 1 : 0,
                updatedCount: singleStatus === 'updated' ? 1 : 0,
                alreadyCount: singleStatus === 'already' ? 1 : 0
            }
        };
    }
    const results = payloads.map(payload => importContributionPayload(payload, dayKey)).filter(Boolean);
    const okResults = results.filter(r => r?.ok);
    if (!okResults.length) {
        return {
            ok: false,
            status: 'invalid',
            summary: 'Geen teldata ontvangen.',
            batch: { total: payloads.length, newCount: 0, updatedCount: 0, alreadyCount: 0 }
        };
    }
    const newCount = okResults.filter(r => r.status === 'new').length;
    const updatedCount = okResults.filter(r => r.status === 'updated').length;
    const alreadyCount = okResults.filter(r => r.status === 'already').length;
    const added = newCount + updatedCount;
    const status = added ? (alreadyCount ? 'mixed' : 'new') : 'already';
    const lines = [
        `Resultaat: ${payloads.length} telling(en) verwerkt.`,
        `Nieuw: ${newCount} · Bijgewerkt: ${updatedCount} · Al bekend: ${alreadyCount}`
    ];
    const preview = summarizeIncomingPayloadList(okResults.map(r => r.payload), 8);
    const summary = `${lines.join('\n')}\n\n${preview}`;
    return {
        ok: true,
        status,
        summary,
        batch: { total: payloads.length, newCount, updatedCount, alreadyCount },
        results: okResults
    };
}

function applyPendingSyncToDay(dayKey) {
    const p = pendingSyncLinkPayload;
    if (!p) return null;
    const result = importContributionPayloadBatch(p, dayKey);
    if (!result?.ok) return result;
    pendingSyncLinkPayload = null;
    save();
    buildUI();
    render();
    renderSessionAdmin();
    buildQRSessionOptions();
    buildReportSessionOptions();
    buildImportTargetOptions();
    buildRouteSuggestions();
    renderIncomingSyncCard();
    return result;
}

function generateSyncLink() {
    const transfer = buildSyncTransferFromSelection(true);
    if (!transfer) return;
    const payloads = listSyncPayloadsFromTransfer(transfer);
    const total = payloads.reduce((acc, payload) => acc + sumCounts(payload.c || {}), 0);
    if (total <= 0) { alert('Geen aantallen om te delen in deze selectie.'); return; }
    const encoded = encodeBase64Url(JSON.stringify(transfer));
    const link = `${window.location.origin}${window.location.pathname}?${SYNC_QUERY_PARAM}=${encoded}`;
    const box = document.getElementById('sync-link-box');
    const out = document.getElementById('sync-link-output');
    if (box) box.classList.remove('hidden');
    if (out) out.value = link;
    if (link.length > 3500) showToast('Let op: erg lange deel-link');
    else showToast(payloads.length > 1 ? `Deel-link klaar (${payloads.length} sessies)` : 'Deel-link klaar');
}

function copySyncLink() {
    const out = document.getElementById('sync-link-output');
    const link = out?.value?.trim();
    if (!link) { alert('Maak eerst een deel-link.'); return; }
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(() => showToast('Link gekopieerd')).catch(() => {
            out.select();
            document.execCommand('copy');
            showToast('Link gekopieerd');
        });
        return;
    }
    out.select();
    document.execCommand('copy');
    showToast('Link gekopieerd');
}

async function shareSyncLink() {
    const out = document.getElementById('sync-link-output');
    const link = out?.value?.trim();
    if (!link) { alert('Maak eerst een deel-link.'); return; }
    try {
        if (navigator.share) {
            await navigator.share({ title: 'Paddentrek deel-link', text: 'Open deze link en synchroniseer deze telling(en) in je app.', url: link });
            return;
        }
    } catch (err) {
        if (err?.name === 'AbortError') return;
    }
    copySyncLink();
}

function importPendingSyncLink() {
    const p = pendingSyncLinkPayload;
    if (!p) { alert('Geen ontvangen deel-link.'); return; }
    const dayKey = picker.value;
    const result = applyPendingSyncToDay(dayKey);
    if (!result?.ok) return;
    closeSyncWizard();
    const added = Number(result.batch?.newCount || 0) + Number(result.batch?.updatedCount || 0);
    const already = Number(result.batch?.alreadyCount || 0);
    if (added === 0 && already > 0) {
        showToast('Alle bijdragen al bekend (overgeslagen)');
        alert(result.summary);
        return;
    }
    showToast(added > 1 ? `${added} tellingen toegevoegd` : (result.status === 'updated' ? 'Bijdrage bijgewerkt' : 'Telling toegevoegd'));
    alert(result.summary);
    switchTab('sessions');
}

function importPendingSyncLinkWizard() {
    const p = pendingSyncLinkPayload;
    if (!p) { alert('Geen ontvangen deel-link.'); return; }
    const dayKey = document.getElementById('sync-wizard-date')?.value || picker.value || todayISO();
    const result = applyPendingSyncToDay(dayKey);
    if (!result?.ok) return;
    closeSyncWizard();
    const added = Number(result.batch?.newCount || 0) + Number(result.batch?.updatedCount || 0);
    const already = Number(result.batch?.alreadyCount || 0);
    if (added === 0 && already > 0) {
        showToast('Alle bijdragen al bekend (overgeslagen)');
        alert(result.summary);
        return;
    }
    showToast(added > 1 ? `${added} tellingen toegevoegd` : (result.status === 'updated' ? 'Bijdrage bijgewerkt' : 'Telling toegevoegd'));
    alert(result.summary);
    switchTab('sessions');
}

function dismissPendingSyncLink() {
    pendingSyncLinkPayload = null;
    closeSyncWizard();
    renderIncomingSyncCard();
    showToast('Deel-link genegeerd');
}

function handleIncomingSyncFromUrl() {
    const raw = new URL(window.location.href).searchParams.get(SYNC_QUERY_PARAM);
    if (!raw) return;
    clearSyncQueryFromUrl();
    try {
        const json = decodeBase64Url(raw);
        const parsed = normalizeIncomingSyncTransfer(JSON.parse(json));
        if (!parsed || !listSyncPayloadsFromTransfer(parsed).length) throw new Error('EMPTY');
        pendingSyncLinkPayload = parsed;
        renderIncomingSyncCard();
        openSyncWizard();
        showToast('Deel-link ontvangen');
    } catch (e) {
        console.log(e);
        alert('Kon de deel-link niet lezen.');
    }
}

function exportRangeCSV(forceSettings = false) {
    const from = document.getElementById(forceSettings ? 'csv-from-settings' : 'csv-from')?.value || picker.value;
    const to = document.getElementById(forceSettings ? 'csv-to-settings' : 'csv-to')?.value || picker.value;
    const dates = Object.keys(storage).filter(d => d >= from && d <= to).sort();
    const rows = [['Datum', 'Scope', 'SessionId', 'Sessiestart', 'Sessie-einde', 'Route', 'Notities', 'Weer temp', 'Weer code', 'Soort', 'Koppels levend', 'Koppels dood', 'M levend', 'V levend', 'Onb levend', 'M dood', 'V dood', 'Onb dood', 'Totaal']];
    dates.forEach(d => {
        const day = ensureDay(d);
        const addRows = (scopeLabel, counts, route, notes, wt, wc, sessStart = '', sessEnd = '', sessId = '') => {
            const all = [...SPECIES, ...(day.custom || [])];
            all.forEach(s => {
                const pl = counts[`${s.id}_p_l`] || 0, pd = counts[`${s.id}_p_d`] || 0;
                const ml = counts[`${s.id}_m_l`] || 0, vl = counts[`${s.id}_v_l`] || 0, ol = counts[`${s.id}_o_l`] || 0;
                const md = counts[`${s.id}_m_d`] || 0, vd = counts[`${s.id}_v_d`] || 0, od = counts[`${s.id}_o_d`] || 0;
                const tot = pl * 2 + pd * 2 + ml + vl + ol + md + vd + od;
                if (tot > 0) rows.push([d, scopeLabel, sessId, sessStart, sessEnd, route, notes, wt, wc, s.name, pl, pd, ml, vl, ol, md, vd, od, tot]);
            });
        };
        if (day.sessions && day.sessions.length) {
            day.sessions.forEach(s => {
                const wt = s.weather?.t ?? day.weather?.t ?? '';
                const wc = s.weather?.c ?? day.weather?.c ?? '';
                addRows('Sessie', s.counts || {}, s.routeName || '', formatSessionNote(s), wt, wc, s.start || '', s.end || '', s.id || '');
            });
        }
        // ook dagtotaal opnemen
        addRows('Dag', getReportCountsForDay(day), '', day.notes || '', day.weather?.t ?? '', day.weather?.c ?? '', '', '', 'day-' + d);
    });
    if (rows.length === 1) rows.push(['Geen data', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paddentrek-${from}-tot-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV range opgeslagen');
}

function handleCSVImport() {
    const input = document.getElementById('csv-import-input');
    const res = document.getElementById('csv-import-result');
    if (!input?.files?.length) { res.innerText = 'Geen bestand gekozen.'; return; }
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
        const text = reader.result;
        const { added, days } = importCSV(text);
        res.innerText = `Geïmporteerd: ${added} records over ${days.size} dagen.`;
        save(); render(); renderSessionAdmin(); updateReport(); buildRouteSuggestions();
    };
    reader.readAsText(file);
}

function importCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return { added: 0, days: new Set() };
    const delim = lines[0].includes(';') ? ';' : ',';
    const clean = v => v.replace(/^\"|\"$/g, '').trim().toLowerCase();
    const header = lines[0].split(delim).map(clean);
    const idx = {
        date: header.findIndex(h => h.startsWith('datum')),
        soort: header.findIndex(h => h.startsWith('soort')),
        pl: header.findIndex(h => h.includes('koppels levend')),
        pd: header.findIndex(h => h.includes('koppels dood')),
        ml: header.findIndex(h => h.startsWith('m ') && h.includes('levend')) === -1 ? header.findIndex(h => h === 'm levend') : header.findIndex(h => h.startsWith('m') && h.includes('levend')),
        vl: header.findIndex(h => h.startsWith('v') && h.includes('levend')),
        ol: header.findIndex(h => h.includes('onb') && h.includes('levend')),
        md: header.findIndex(h => h.startsWith('m') && h.includes('dood')),
        vd: header.findIndex(h => h.startsWith('v') && h.includes('dood')),
        od: header.findIndex(h => h.includes('onb') && h.includes('dood')),
        route: header.findIndex(h => h.startsWith('route')),
        notes: header.findIndex(h => h.startsWith('notities') || h.startsWith('nota')),
        wt: header.findIndex(h => h.includes('weer temp')),
        wc: header.findIndex(h => h.includes('weer code')),
        scope: header.findIndex(h => h === 'scope'),
        sessStart: header.findIndex(h => h.startsWith('sessiestart')),
        sessEnd: header.findIndex(h => h.startsWith('sessie-einde')),
        sessId: header.findIndex(h => h === 'sessionid'),
    };
    let added = 0;
    const days = new Set();
    const importSessions = {}; // key -> session
    const sessionsSeen = {};
    const fallbackCounts = {};
    const fallbackMeta = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delim).map(c => c.replace(/^\"|\"$/g, '').trim());
        const date = cols[idx.date] || picker.value;
        const speciesName = cols[idx.soort] || 'Onbekend';
        if (!date || !speciesName) continue;
        const day = ensureDay(date);
        days.add(date);
        const scope = idx.scope >= 0 ? cols[idx.scope].toLowerCase() : '';
        const startRaw = idx.sessStart >= 0 ? cols[idx.sessStart] : '';
        const endRaw = idx.sessEnd >= 0 ? cols[idx.sessEnd] : '';
        const sessIdCsv = idx.sessId >= 0 ? cols[idx.sessId] : '';
        let sess = null;
        const isSessionRow = scope.includes('sessie');
        if (isSessionRow) {
            const key = sessIdCsv || `${date}_${startRaw || '00:00'}`;
            if (!importSessions[key]) {
                const startIso = startRaw ? new Date(startRaw).toISOString() : new Date(`${date}T00:00:00`).toISOString();
                const endIso = endRaw ? new Date(endRaw).toISOString() : null;
                const existing = day.sessions.find(s => s.id === sessIdCsv);
                sess = existing || {
                    id: sessIdCsv || `import_${key}_${i}`,
                    start: startIso,
                    end: endIso,
                    counts: {},
                    notes: cols[idx.notes] || 'CSV import',
                    photos: [],
                    routeName: cols[idx.route] || 'CSV import',
                    weather: null,
                    determinations: [],
                    includeInReports: true,
                    contributions: [],
                    contributorRoster: [],
                    autoContributorNote: ''
                };
                if (!existing) day.sessions.push(sess);
                importSessions[key] = sess;
            } else {
                sess = importSessions[key];
            }
            sessionsSeen[date] = true;
        }
        // fallback dagtotaal verzamelen, pas later toepassen
        if (!isSessionRow) {
            if (!fallbackCounts[date]) fallbackCounts[date] = {};
            const route = cols[idx.route] || '';
            const notes = cols[idx.notes] || '';
            const wt = idx.wt >= 0 ? parseFloat(cols[idx.wt].replace(',', '.')) : null;
            const wc = idx.wc >= 0 ? parseInt(cols[idx.wc]) : null;
            if (!fallbackMeta[date]) fallbackMeta[date] = { route, notes, wt, wc };
        }
        if (idx.wt >= 0 || idx.wc >= 0) {
            const wt = idx.wt >= 0 ? parseFloat(cols[idx.wt].replace(',', '.')) : null;
            const wc = idx.wc >= 0 ? parseInt(cols[idx.wc]) : null;
            if (sess) {
                if (!sess.weather && (wt || wc)) {
                    sess.weather = { t: wt ?? 0, c: isFinite(wc) ? wc : 0, ts: Date.now() };
                    day.weather = day.weather || sess.weather;
                }
            } else {
                // day-row: bewaar in fallbackMeta zodat we het later kunnen toepassen
                const fm = fallbackMeta[date] || {};
                if (wt !== null) fm.wt = wt;
                if (wc !== null && isFinite(wc)) fm.wc = wc;
                fallbackMeta[date] = fm;
            }
        }

        let species = SPECIES.find(s => s.name.toLowerCase() === speciesName.toLowerCase());
        if (!species) {
            species = day.custom.find(c => c.name.toLowerCase() === speciesName.toLowerCase());
            if (!species) {
                species = { id: 'c_' + Date.now() + Math.random().toString(16).slice(2), name: speciesName, color: 'gray', hasAmplexus: true };
                day.custom.push(species);
            }
        }
        const counts = day.counts;
        const addVal = (field, val, targetCounts) => {
            if (isNaN(val)) return;
            const key = `${species.id}_${field}`;
            targetCounts[key] = (targetCounts[key] || 0) + val;
        };
        const num = k => {
            const v = idx[k] >= 0 ? parseFloat(cols[idx[k]].replace(',', '.')) : 0;
            return isFinite(v) ? v : 0;
        };
        if (isSessionRow) {
            addVal('p_l', num('pl'), sess.counts);
            addVal('p_d', num('pd'), sess.counts);
            addVal('m_l', num('ml'), sess.counts);
            addVal('v_l', num('vl'), sess.counts);
            addVal('o_l', num('ol'), sess.counts);
            addVal('m_d', num('md'), sess.counts);
            addVal('v_d', num('vd'), sess.counts);
            addVal('o_d', num('od'), sess.counts);
        } else {
            addVal('p_l', num('pl'), fallbackCounts[date]);
            addVal('p_d', num('pd'), fallbackCounts[date]);
            addVal('m_l', num('ml'), fallbackCounts[date]);
            addVal('v_l', num('vl'), fallbackCounts[date]);
            addVal('o_l', num('ol'), fallbackCounts[date]);
            addVal('m_d', num('md'), fallbackCounts[date]);
            addVal('v_d', num('vd'), fallbackCounts[date]);
            addVal('o_d', num('od'), fallbackCounts[date]);
        }
        added++;
    }
    // apply fallbacks and recalc day totals from sessions
    days.forEach(d => {
        const day = ensureDay(d);
        if (sessionsSeen[d]) {
            recalcDayFromSessions(day);
        } else if (fallbackCounts[d]) {
            day.counts = fallbackCounts[d];
            const meta = fallbackMeta[d] || {};
            // maak een dag-importsessie zodat log iets toont
            const startIso = new Date(`${d}T00:00:00`).toISOString();
            const endIso = new Date(`${d}T23:59:00`).toISOString();
            day.sessions.push({
                id: `import_${d}_day`,
                start: startIso,
                end: endIso,
                counts: { ...fallbackCounts[d] },
                notes: meta.notes || '',
                photos: [],
                routeName: meta.route || '',
                weather: (meta.wt || meta.wc) ? { t: meta.wt || 0, c: meta.wc || 0, ts: Date.now() } : null,
                determinations: [],
                includeInReports: true,
                contributions: [],
                contributorRoster: [],
                autoContributorNote: ''
            });
        }
    });
    purgeEmptyCustomSpecies();
    return { added, days };
}

function describeSync(incoming, targetDay = null) {
    const sourceDay = incoming?.sourceDate || incoming?.d || picker.value;
    const dayKey = targetDay || sourceDay;
    const who = incoming?.contributorName || 'Onbekende teller';
    const route = normalizeRouteName(incoming?.sourceRoute || '');
    const label = {
        p_l: '❤️ koppels', p_d: '☠️ koppels', m_l: 'm levend', v_l: 'v levend', o_l: 'o levend',
        m_d: 'm dood', v_d: 'v dood', o_d: 'o dood'
    };
    const nameFor = id => {
        const base = SPECIES.find(s => s.id === id);
        if (base) return base.name;
        const inc = (incoming.s || []).find(s => s.id === id);
        return inc ? inc.name : id;
    };

    const perSpecies = {};
    for (const k in incoming.c || {}) {
        const [sid, suf] = k.split('_');
        if (!perSpecies[sid]) perSpecies[sid] = [];
        perSpecies[sid].push(`${incoming.c[k]} × ${label[suf] || suf}`);
    }

    const lines = Object.entries(perSpecies).map(([sid, items]) => `- ${nameFor(sid)}: ${items.join(', ')}`);

    const existingCustom = (storage[dayKey]?.custom) || [];
    const newCustom = (incoming.s || []).filter(s => !existingCustom.some(c => c.name === s.name));
    if (newCustom.length) lines.push(`+ Nieuwe soorten: ${newCustom.map(s => s.name).join(', ')}`);

    if (!lines.length) return 'Geen teldata ontvangen.';
    const sourceTxt = sourceDay !== dayKey ? ` (bron ${sourceDay})` : '';
    return `Toegevoegd als aparte telling op ${dayKey}${sourceTxt}.\nTeller: ${who}${route ? `\nTraject: ${route}` : ''}\n\n${lines.join('\n')}`;
}

function startScanner() {
    const sc = new Html5Qrcode("reader");
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, t => {
        try {
            const i = JSON.parse(t);
            const payload = sanitizeQrImportPayload(i);
            if (!payload) throw new Error('INVALID');
            const result = importContributionPayloadBatch(payload, picker.value);
            if (!result?.ok) throw new Error('IMPORT');
            save();
            buildUI();
            render();
            sc.stop();
            const added = Number(result.batch?.newCount || 0) + Number(result.batch?.updatedCount || 0);
            const already = Number(result.batch?.alreadyCount || 0);
            if (added === 0 && already > 0) {
                alert(result.summary);
                showToast("Alle bijdragen al bekend");
            } else {
                alert(result.summary);
                showToast(added > 1 ? `${added} tellingen toegevoegd` : (result.status === 'updated' ? "Bijdrage bijgewerkt" : "Telling toegevoegd"));
            }
            switchTab('count');
        } catch (e) { alert("QR fout"); }
    }).catch(() => alert("Camera fout"));
}

function sanitizeQrImportPayload(payload) {
    return normalizeIncomingSyncTransfer(payload);
}

function buildQrWizardTargetOptions() {
    const dateInput = document.getElementById('qr-wizard-date');
    const hint = document.getElementById('qr-wizard-hint');
    if (!dateInput || !hint) return;
    if (!dateInput.value) dateInput.value = picker.value || todayISO();
    updateQrWizardHint();
}

function updateQrWizardHint() {
    const dateInput = document.getElementById('qr-wizard-date');
    const hint = document.getElementById('qr-wizard-hint');
    if (!dateInput || !hint) return;
    const dayKey = dateInput.value || picker.value || todayISO();
    hint.innerText =
        `Stap 3: voeg deze QR toe als aparte telling(en) op ${dayKey}.\n` +
        `Er wordt niets bijgeteld in bestaande tellingen.`;
}

function setQrWizardIdleState() {
    const meta = document.getElementById('qr-wizard-meta');
    const summary = document.getElementById('qr-wizard-summary');
    const btnImport = document.getElementById('qr-wizard-import-btn');
    if (meta) meta.innerText = 'Stap 1: scan de QR-code van je partner.';
    if (summary) summary.innerText = 'Nog geen QR gelezen.';
    if (btnImport) {
        btnImport.disabled = true;
        btnImport.classList.add('opacity-60');
    }
}

function renderQrWizardPreview(payload) {
    const meta = document.getElementById('qr-wizard-meta');
    const summary = document.getElementById('qr-wizard-summary');
    const btnImport = document.getElementById('qr-wizard-import-btn');
    if (!meta || !summary || !btnImport) return;
    const payloads = listSyncPayloadsFromTransfer(payload);
    if (!payloads.length) {
        meta.innerText = 'QR bevat geen geldige teldata.';
        summary.innerText = 'Scan een andere QR.';
        btnImport.disabled = true;
        btnImport.classList.add('opacity-60');
        return;
    }
    const total = payloads.reduce((acc, p) => acc + sumCounts(p.c || {}), 0);
    const contributors = Array.from(new Set(payloads.map(p => p.contributorName || 'Onbekende teller')));
    const sourceDate = payloads[0]?.sourceDate || payload?.sourceDate || 'onbekend';
    const alreadyCount = payloads.filter(p => !!findImportedSessionLocation(p.id, getSyncImportEntry(p.id))).length;
    meta.innerText =
        `Stap 1 klaar: QR gelezen.\n` +
        `Bron-datum: ${sourceDate}\n` +
        `Teller(s): ${contributors.join(', ')}\n` +
        `In QR: ${payloads.length} telling(en), ${total} dieren\n` +
        `${alreadyCount ? `Status: ${alreadyCount} bijdrage(n) al bekend (wordt overgeslagen)\n` : ''}` +
        `Stap 2: controleer hieronder de inhoud.\n` +
        `Na toevoegen staan deze data als aparte telling(en) in je lijst.`;
    summary.innerText = `Stap 2: inhoud van de QR\n\n${summarizeIncomingPayloadList(payloads)}`;
    btnImport.disabled = false;
    btnImport.classList.remove('opacity-60');
}

function startQrCameraScan() {
    const targetId = 'session-reader-modal';
    const host = document.getElementById(targetId);
    if (host) host.innerHTML = '';
    if (sessionScanner) { sessionScanner.stop().catch(() => { }); sessionScanner = null; }
    sessionScanner = new Html5Qrcode(targetId);
    sessionScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, t => {
        let parsed = null;
        try { parsed = JSON.parse(t); } catch (_) { return; }
        const payload = sanitizeQrImportPayload(parsed);
        if (!payload) return;
        pendingQrImportPayload = payload;
        stopSessionScanner();
        renderQrWizardPreview(payload);
        showToast('QR gelezen');
    }).catch(() => alert("Camera fout"));
}

function restartQrWizardScan() {
    pendingQrImportPayload = null;
    setQrWizardIdleState();
    startQrCameraScan();
}

function importQrWizardPayload() {
    const payload = pendingQrImportPayload;
    if (!payload) { alert('Scan eerst een QR-code.'); return; }
    const dayKey = document.getElementById('qr-wizard-date')?.value || picker.value || todayISO();
    const result = importContributionPayloadBatch(payload, dayKey);
    if (!result?.ok) return;
    pendingQrImportPayload = null;
    save();
    buildUI();
    render();
    renderSessionAdmin();
    buildQRSessionOptions();
    buildReportSessionOptions();
    buildImportTargetOptions();
    buildRouteSuggestions();
    closeQrModal();
    const added = Number(result.batch?.newCount || 0) + Number(result.batch?.updatedCount || 0);
    const already = Number(result.batch?.alreadyCount || 0);
    if (added === 0 && already > 0) {
        showToast('Alle bijdragen al bekend (overgeslagen)');
        alert(result.summary);
        return;
    }
    showToast(added > 1 ? `${added} tellingen toegevoegd` : (result.status === 'updated' ? 'Bijdrage bijgewerkt' : 'Telling toegevoegd'));
    alert(result.summary);
    switchTab('sessions');
}

function startSessionScanner() {
    const modal = document.getElementById('qr-modal');
    const dateInput = document.getElementById('qr-wizard-date');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (dateInput) dateInput.value = picker.value || todayISO();
    buildQrWizardTargetOptions();
    restartQrWizardScan();
}

function stopSessionScanner() {
    if (sessionScanner) {
        sessionScanner.stop().catch(() => { }).finally(() => sessionScanner = null);
    }
}

function closeQrModal(ev = null) {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    if (ev && ev.target && ev.target.id !== 'qr-modal' && !ev.target.closest('[data-qr-close=\"1\"]')) return;
    stopSessionScanner();
    pendingQrImportPayload = null;
    setQrWizardIdleState();
    modal.classList.add('hidden');
    const host = document.getElementById('session-reader-modal');
    if (host) host.innerHTML = '';
}

function buildImportTargetOptions() {
    const hint = document.getElementById('import-target-hint');
    if (!hint) return;
    updateImportTargetHint();
}

function updateImportTargetHint() {
    const hint = document.getElementById('import-target-hint');
    if (!hint) return;
    hint.innerText = `Data uit QR of deel-link wordt als aparte telling(en) toegevoegd op ${picker.value}.`;
}

function renderAppChanges() {
    const current = document.getElementById('app-changes-current');
    const list = document.getElementById('app-changes-list');
    if (!current || !list) return;

    current.innerText = `Huidige appversie: v${APP_VERSION}`;

    const changes = (typeof APP_CHANGELOG !== 'undefined' && Array.isArray(APP_CHANGELOG)) ? APP_CHANGELOG : [];
    if (!changes.length) {
        list.innerHTML = '<div class="text-[11px] text-gray-500">Nog geen wijzigingen geregistreerd.</div>';
        return;
    }

    list.innerHTML = changes.map(entry => {
        const version = typeof entry?.version === 'string' && entry.version.trim() ? entry.version.trim() : 'Onbekende versie';
        const title = typeof entry?.title === 'string' && entry.title.trim() ? entry.title.trim() : 'Wijzigingen';
        const items = Array.isArray(entry?.changes) ? entry.changes.filter(Boolean) : [];
        const rows = items.map(item => `<li>${item}</li>`).join('');
        return `
                    <div class="bg-gray-900/60 border border-amber-500/20 rounded-lg px-3 py-2 space-y-1.5">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] uppercase tracking-wider text-amber-300 font-bold">v${version}</span>
                            <span class="text-[10px] text-gray-400">release notes</span>
                        </div>
                        <div class="text-[12px] font-bold text-amber-100">${title}</div>
                        ${rows ? `<ul class="list-disc ml-4 text-[11px] text-gray-200 space-y-1">${rows}</ul>` : '<div class="text-[11px] text-gray-400">Geen details.</div>'}
                    </div>
                `;
    }).join('');
}

function switchTab(t) {
    currentTab = t;
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const view = document.getElementById('view-' + t);
    if (view) view.classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-tab'));
    const tab = document.getElementById('tab-' + t);
    if (tab) tab.classList.add('active-tab');
    if (t === 'report') {
        reportMode = 'day';
        buildReportSessionOptions();
        updateReport();
    }
    if (t === 'sessions') { renderSessionLog(); }
    if (t === 'settings') {
        const sd = document.getElementById('sessionDate');
        if (sd) sd.value = picker.value;
        const pd = document.getElementById('photo-clean-date');
        if (pd) pd.value = picker.value;
        renderSessionAdmin();
        buildQRSessionOptions();
        buildImportTargetOptions();
        updateContributorInputsFromProfile();
        handleShareIdentityChange(false);
        generateQR();
        renderIncomingSyncCard();
        updateLegacyMigrationUI();
        renderStorageInspector(true);
    }
    if (t === 'help') {
        renderDetSessionOptions();
        renderDeterminationUI();
        renderDeterminationList();
    }
    if (t === 'info') renderAppChanges();
    refreshHeaderSelectorVisibility();
}

function resetCurrentDate() { if (confirm("Alles wissen voor vandaag?")) { delete storage[picker.value]; save(); buildUI(); render(); } }

picker.onchange = () => {
    buildUI();
    render();
    buildQRSessionOptions();
    buildReportSessionOptions();
    renderSessionAdmin();
    buildImportTargetOptions();
    renderIncomingSyncCard();
};
document.getElementById('sessionDate').onchange = () => renderSessionAdmin();
window.addEventListener('resize', () => {
    const reportView = document.getElementById('view-report');
    if (reportView && !reportView.classList.contains('hidden')) renderReportTrend();
});
function runInitialRender() {
    splitSessionOverMidnightIfNeeded();
    buildUI();
    render();
    renderSessionAdmin();
    buildQRSessionOptions();
    buildReportSessionOptions();
    renderDetSessionOptions();
    renderDeterminationUI();
    renderDeterminationList();
    updateContributorInputsFromProfile();
    handleShareIdentityChange(false);
    handleIncomingSyncFromUrl();
    renderAppChanges();
    const trendCard = document.getElementById('report-trend-card');
    if (trendCard && trendCard.dataset.headerVisibilityBound !== '1') {
        trendCard.addEventListener('toggle', refreshHeaderSelectorVisibility);
        trendCard.dataset.headerVisibilityBound = '1';
    }
    refreshHeaderSelectorVisibility();
}

async function bootstrapApp() {
    await runAutomaticV3UpgradeMigration();
    runInitialRender();
}

bootstrapApp().catch(err => {
    console.error('Bootstrap met automatische migratie faalde, fallback init wordt gestart.', err);
    runInitialRender();
});
