
        document.title = `Paddentrek Teller Pro ${APP_VERSION}`;
        document.getElementById('app-version-display').innerText = APP_VERSION;
        document.getElementById('pwa-status').onclick = () => alert('Groen bolletje = app volledig beschikbaar (ook offline). Rood = service worker fout, herlaad of check verbinding. Geel/grijs = bezig met laden of update.');

        // --- SERVICE WORKER ---
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`).then(reg => {
                document.getElementById('status-icon').className = 'status-dot bg-emerald-500 shadow-[0_0_8px_#10b981]';
                const st = document.getElementById('status-text');
                st.innerText = '';
                st.classList.add('hidden');

                // Luister naar nieuwe versies
                reg.addEventListener('updatefound', () => {
                    const u = reg.installing?.scriptURL || '';
                    const m = u.match(/v=([^&]+)/);
                    showUpdateBadge(m ? m[1] : null);
                });
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    const u = reg.active?.scriptURL || '';
                    const m = u.match(/v=([^&]+)/);
                    showUpdateBadge(m ? m[1] : null);
                });
            }).catch(() => {
                document.getElementById('status-icon').className = 'status-dot bg-red-500';
                const st = document.getElementById('status-text');
                st.innerText = 'SW fout';
                st.classList.remove('hidden');
            });

            navigator.serviceWorker.addEventListener('message', ev => {
                if(ev.data?.type === 'NEW_VERSION') showUpdateBadge(ev.data.version || APP_VERSION);
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
            draw() { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill(); }
        }

        class EmojiParticle extends Particle {
            constructor(x, y, emoji) {
                super(x, y, '#9ca3af');
                this.emoji = emoji;
                this.size = 18 + Math.random()*8;
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
                ctx.bezierCurveTo(this.x - s, this.y - s, this.x - 2*s, this.y + s*0.8, this.x, this.y + s*1.8);
                ctx.bezierCurveTo(this.x + 2*s, this.y + s*0.8, this.x + s, this.y - s, this.x, this.y);
                ctx.fill();
            }
        }

        function celebrate(e, hearts = false, sad = false) {
            const colors = hearts ? ['#fb7185', '#f472b6', '#ef4444', '#f87171']
                                  : sad ? ['#60a5fa', '#94a3b8', '#a5b4fc', '#22d3ee']
                                        : ['#10b981', '#60a5fa', '#fcd34d', '#f472b6', '#ffffff'];
            const x = e ? e.clientX : window.innerWidth / 2;
            const y = e ? e.clientY : window.innerHeight / 2;
            const count = hearts ? 35 : sad ? 18 : 30;
            const sadEmojis = ['☠️','💀','🥀','😢','🪦','🙁'];
            for(let i=0; i<count; i++) {
                const color = colors[Math.floor(Math.random()*colors.length)];
                if(hearts) particles.push(new HeartParticle(x, y, color));
                else if(sad) particles.push(new EmojiParticle(x, y, sadEmojis[Math.floor(Math.random()*sadEmojis.length)]));
                else particles.push(new Particle(x, y, color));
            }
        }

        function animate() {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            particles = particles.filter(p => p.life > 0);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animate);
        }
        animate();

        // --- HAPTICS ---
        let lastVibeTs = 0;
        function vibe(ms = 15, force = false) {
            if(!navigator.vibrate) return;
            const now = Date.now();
            if(!force && now - lastVibeTs < 60) return;
            navigator.vibrate(ms);
            lastVibeTs = now;
        }
        document.addEventListener('pointerdown', ev => {
            const btn = ev.target.closest('button');
            if(btn && !btn.disabled) vibe();
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

        // Beslisboom (vereenvoudigd op basis van veldkaart)
        const DET_TREE = {
            id: 'root',
            question: 'Heeft het dier een staart?',
            yes: 'salamander_start',
            no: 'frog_start'
        };
        const DET_NODES = {
            salamander_start: { id:'salamander_start', question:'Is het dier helemaal zwart en geel gekleurd?', yes:'res_vuurs', no:'sal_oranje', hint:'icons/det/vuurs.jpg', caption:'Vuursalamander: geel-zwart patroon' },
            sal_oranje: { id:'sal_oranje', question:'Is de buik oranje en ongevlekt?', yes:'sal_keel_ongevlekt', no:'sal_keel_spots', hint:'icons/det/alpen_buik.jpg', caption:'Oranje buik, let op keel' },
            sal_keel_ongevlekt: { id:'sal_keel_ongevlekt', question:'Is de keel ongevlekt?', yes:'res_alpen', no:'sal_keel_spots', hint:'icons/det/alpen_keel.jpg', caption:'Alpenwatersalamander keel' },
            sal_keel_spots: { id:'sal_keel_spots', question:'Is de keel donker met lichte spikkels?', yes:'res_vin', no:'res_kleine_kam', hint:'icons/det/vin_keel.jpg', caption:'Vinpoot/kleine/kam keel vergelijken' },
            frog_start: { id:'frog_start', question:'Heeft het dier een wrattige huid?', yes:'frog_pupil', no:'frog_masker', hint:'icons/det/pad_huid.jpg', caption:'Ruwe huid? → pad' },
            frog_pupil: { id:'frog_pupil', question:'Heeft het dier een horizontale pupil?', yes:'frog_geelstreep', no:'res_knoflook', hint:'icons/det/pupil_horiz.jpg', caption:'Kijk naar pupilvorm' },
            frog_geelstreep: { id:'frog_geelstreep', question:'Heeft het dier een gele rugstreep?', yes:'res_rugstreep', no:'res_pad', hint:'icons/det/geelstreep.jpg', caption:'Gele lijn over de rug?' },
            frog_masker: { id:'frog_masker', question:'Heeft het dier een lichte rugstreep tot aan de snuit?', yes:'res_heikikker', no:'frog_hechtschijf', hint:'icons/det/heikikker.jpg', caption:'Lichte rugstreep tot snuit?' },
            frog_hechtschijf: { id:'frog_hechtschijf', question:'Zijn er hechtschijfjes aan de tenen?', yes:'res_boomkikker', no:'res_groenekikker', hint:'icons/det/boomkikker_tenen.jpg', caption:'Hechtschijfjes = boomkikker' },
            res_vuurs: { result:true, species:'vuurs', name:'Vuursalamander', hint:'icons/det/vuurs.jpg', caption:'Vuursalamander (Z)' },
            res_alpen: { result:true, species:'alpen', name:'Alpenwatersalamander', hint:'icons/det/alpen.jpg', caption:'Alpenwatersalamander (A)' },
            res_vin: { result:true, species:'vin', name:'Vinpootsalamander', hint:'icons/det/vin.jpg', caption:'Vinpootsalamander (A)' },
            res_kleine_kam: { result:true, species:'kleine', name:'Kleine of Kamsalamander', hint:'icons/det/kleine_kam.jpg', caption:'Kleine watersalamander of Kamsalamander' },
            res_knoflook: { result:true, species:'knoflook', name:'Knoflookpad', hint:'icons/det/knoflook.jpg', caption:'Knoflookpad (ZZ)' },
            res_rugstreep: { result:true, species:'rugstreep', name:'Rugstreeppad', hint:'icons/det/rugstreep.jpg', caption:'Rugstreeppad (Z)' },
            res_pad: { result:true, species:'pad', name:'Gewone pad', hint:'icons/det/pad.jpg', caption:'Gewone pad (A)' },
            res_heikikker: { result:true, species:'heikikker', name:'Heikikker', hint:'icons/det/heikikker.jpg', caption:'Heikikker (Z)' },
            res_boomkikker: { result:true, species:'boomkikker', name:'Boomkikker', hint:'icons/det/boomkikker.jpg', caption:'Boomkikker (ZZ)' },
            res_groenekikker: { result:true, species:'groene', name:'Groene kikker (meer/pool/bastaard?)', hint:'icons/det/groene.jpg', caption:'Groene kikker groep (A*)' }
        };

        // helpers voor determinatie-rapporten
        function detQuestionText(nodeId) {
            if(nodeId === 'root') return DET_TREE.question;
            return DET_NODES[nodeId]?.question || nodeId;
        }
        function detAnswerLabel(ans) { return ans === 'yes' ? 'JA' : 'NEE'; }


        const WMO = { 0: "Helder", 1: "Licht bewolkt", 2:"Half bewolkt", 3: "Bewolkt", 61: "Regen", 80: "Buien" };

        const STORAGE_KEY = `paddentrek_${APP_VERSION}`;
        let reportMode = 'session'; // 'session' | 'day'
        let photoTargetSession = null;
        let viewedSessionId = '';
        let sessionScanner = null;
        let storage = JSON.parse(localStorage.getItem(STORAGE_KEY));
        let activeDeterminationId = null;
        // Migreer indien versie is opgehoogd zodat data behouden blijft
        if(!storage) {
            const prevKey = Object.keys(localStorage)
                .filter(k => k.startsWith('paddentrek_') && k !== STORAGE_KEY)
                .sort()
                .pop();
            storage = prevKey ? (JSON.parse(localStorage.getItem(prevKey)) || {}) : {};
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
        }
        let activeSessionId = null;
        // Schema v2: per day stores counts, custom, photos, notes, weather, sessions
        // session object: { id, start, end?, counts: {}, notes: '' }
        let lastAction = null;
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
            if(sd) sd.value = today;
            const pd = document.getElementById('photo-clean-date');
            if(pd) pd.value = today;
        }

        setDateInputsToToday();

        // Zorgt dat een dag-object altijd alle sleutels heeft voordat we ermee werken
        function ensureDay(d = picker.value) {
            if(!storage[d]) storage[d] = { counts: {}, custom: [], photos: [], notes: "", sessions: [], weather: null };
            const day = storage[d];
            if(!day.counts) day.counts = {};
            if(!day.custom) day.custom = [];
            if(!day.photos) day.photos = [];
            if(typeof day.notes !== 'string') day.notes = "";
            if(!day.sessions) day.sessions = [];
            if(!day.weather) day.weather = null;
            day.sessions.forEach(s => {
                if(!s.counts) s.counts = {};
                if(!s.photos) s.photos = [];
                if(!s.determinations) s.determinations = [];
                if(!s.routeName) s.routeName = "";
                if(typeof s.notes !== 'string') s.notes = "";
                if(!s.weather) s.weather = null;
            });
            return day;
        }

        function findRunningSessionAcrossDays() {
            for(const d in storage) {
                const day = ensureDay(d);
                const sess = day.sessions.find(s => !s.end);
                if(sess) return { dayKey: d, session: sess };
            }
            return null;
        }

        function splitSessionOverMidnightIfNeeded() {
            const today = todayISO();
            const running = findRunningSessionAcrossDays();
            if(!running) return;
            if(running.dayKey === today) return;

            const prevDay = ensureDay(running.dayKey);
            const sess = prevDay.sessions.find(s => s.id === running.session.id);
            if(!sess) return;

            // sluit vorige dag af op 23:59
            const prevEnd = new Date(`${running.dayKey}T23:59:00`).toISOString();
            sess.end = prevEnd;
            recalcDayFromSessions(prevDay);

            // start nieuwe sessie op nieuwe dag, leeg zodat nieuwe tellingen correct landen
            const newDay = ensureDay(today);
            const newSession = { id: 'sess_'+Date.now(), start: new Date(`${today}T00:00:00`).toISOString(), counts: {}, notes: '', weather: null, photos: [], routeName: sess.routeName || '' };
            newDay.sessions.push(newSession);
            activeSessionId = newSession.id;
            viewedSessionId = newSession.id;
            setDateInputsToToday();
            save();
            showToast('Sessie gesplitst om middernacht');
        }

        function migrateOldSchema() {
            for(const d in storage) {
                const day = storage[d];
                if(!day.sessions) day.sessions = [];
                if(!day.custom) day.custom = [];
                if(!day.photos) day.photos = [];
                if(typeof day.notes !== 'string') day.notes = "";
                if(!day.weather) day.weather = null;
                day.sessions.forEach(s => {
                    if(!s.counts) s.counts = {};
                    if(!s.photos) s.photos = [];
                    if(!s.determinations) s.determinations = [];
                    if(!s.routeName) s.routeName = "";
                    if(typeof s.notes !== 'string') s.notes = "";
                    if(!s.weather) s.weather = null;
                });
            }
            save();
        }

        function buildUI() {
            document.getElementById('render-target').innerHTML = SPECIES.map(s => renderCard(s)).join('');
            renderCustom();
            renderSessionLog();
        }

        function renderCard(s, custom = false) {
            const liveKeys = s.hasAmplexus ? ['p_l','m_l','v_l','o_l'] : ['m_l','v_l','o_l'];
            return `
                <div class="bg-gray-800 p-4 rounded-xl shadow-lg border-l-4 border-${s.color}-500 mb-6 transition-all">
                    <h2 class="text-sm font-bold mb-3 flex justify-between items-center text-white">
                        ${s.name} ${custom ? '<span class="text-[8px] opacity-40 italic">EXTRA</span>' : ''}
                        <span class="text-[9px] bg-black/40 px-2 py-1 rounded">TOT: <span id="tot-${s.id}" class="text-white font-bold">0</span></span>
                    </h2>
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <p class="text-[8px] text-emerald-400 font-bold uppercase tracking-widest italic">Levend</p>
                                ${liveKeys.map(k => btn(s.id, k, s.color, k==='p_l' ? livePairLabel() : iconLabel(k, false))).join('')}
                            </div>
                            <div class="space-y-1">
                                <p class="text-[8px] text-red-500 font-bold uppercase tracking-widest italic">Dood</p>
                                ${s.hasAmplexus ? btn(s.id, 'p_d', 'red', deadPairLabel(), true) : ''}
                                ${['m_d','v_d','o_d'].map(k => btn(s.id, k, 'red', iconLabel(k, true), true)).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
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
            if(isM) return dead ? `${skull}${male}` : `${male}`;
            if(isV) return dead ? `${skull}${female}` : `${female}`;
            if(isO) return dead ? `${skull}${unk}` : `${unk}`;
            return key;
        }

        function btn(sid, type, color, label, dood = false) {
            const key = `${sid}_${type}`;
            let cls = dood ? 'bg-red-950/40 border-red-900/40 text-red-300' : `bg-${color}-700 border-white/5 text-white shadow-sm`;
            if(color==='emerald' && type==='p_l') cls = 'bg-emerald-600 border-emerald-400/20';
            if(color==='amber') cls = dood ? 'bg-red-950/40' : 'bg-amber-700';
            if(color==='yellow') cls = dood ? 'bg-red-950/40' : 'bg-yellow-700';

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
            if(!active) {
                startSession(true, false, d, false); // auto-start zonder redirect
                active = getActiveSession(day);
            }
            day.counts[key] = (day.counts[key] || 0) + val;
            if(day.counts[key] < 0) day.counts[key] = 0;
            // Also bump active session if running
            if(active) {
                active.counts[key] = (active.counts[key] || 0) + val;
                if(active.counts[key] < 0) active.counts[key] = 0;
            }
            save(); render();
            if(val > 0) {
                vibe(22, true);
                if(key.includes('_p_l')) celebrate(e, true);
                else if(key.includes('_l')) celebrate(e);
                else if(key.includes('_d')) celebrate(e, false, true);
            }
        }

        function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(storage)); }

        // --- DEV STORAGE INSPECTOR ---
        function formatBytes(b) {
            if(!b || isNaN(b)) return '0 B';
            const u = ['B','KB','MB','GB'];
            const i = Math.min(Math.floor(Math.log(b)/Math.log(1024)), u.length-1);
            return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
        }

        function renderStorageInspector(forceReload = false) {
            const box = document.getElementById('storage-inspector');
            const meta = document.getElementById('storage-meta');
            if(!box || !meta) return;
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
                    // verzamel data:image... strings voor preview
                    const collect = v => {
                        if(typeof v === 'string' && v.startsWith('data:image')) imgs.push(v);
                        else if(Array.isArray(v)) v.forEach(collect);
                        else if(v && typeof v === 'object') Object.values(v).forEach(collect);
                    };
                    collect(parsed);
                } catch(_) { /* keep raw */ }
                const hay = `${k} ${pretty}`.toLowerCase();
                if(search && !hay.includes(search)) return null;
                const badge = k === STORAGE_KEY ? '<span class="text-[9px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 px-2 py-1 rounded">actief</span>' : '';
                const imgHtml = imgs.slice(0,8).map((src,idx) => `<button type="button" onclick="openInspectorPhoto('${idx}', '${k}')" class="block"><img src="${src}" alt="foto ${idx+1}" class="h-16 w-16 object-cover rounded border border-gray-700"></button>`).join('');
                return `<details class="bg-gray-900 border border-gray-800 rounded p-2">
                    <summary class="cursor-pointer flex justify-between items-center text-gray-200">${k} ${badge}<span class="text-[10px] text-gray-400">${type} · ${formatBytes(raw.length)}</span></summary>
                    <pre class="mt-2 bg-black/40 rounded p-2 whitespace-pre-wrap text-[10px] text-gray-200">${pretty.replace(/</g,'&lt;')}</pre>
                    ${imgHtml ? `<div class="mt-2 flex gap-2 flex-wrap">${imgHtml}</div>` : ''}
                </details>`;
            }).filter(Boolean);
            box.innerHTML = rows.join('') || '<div class="text-gray-500 text-[11px]">Geen matches.</div>';
            meta.innerText = `${keys.length} keys · ${formatBytes(totalBytes)} totaal opgeslagen`;
        }

        function render() {
            const d = ensureDay();
            const active = getActiveSession(d);
            const countsSource = active ? (active.counts || {}) : d.counts;
            const up = s => {
                let t = 0;
                ['p_l','p_d','m_l','v_l','o_l','m_d','v_d','o_d'].forEach(k => {
                    const v = countsSource[`${s.id}_${k}`] || 0;
                    if(document.getElementById(`${s.id}_${k}`)) document.getElementById(`${s.id}_${k}`).innerText = v;
                    t += (k==='p_l' || k==='p_d') ? v*2 : v;
                });
                if(document.getElementById(`tot-${s.id}`)) document.getElementById(`tot-${s.id}`).innerText = t;
            };
            SPECIES.forEach(up);
            (d.custom || []).forEach(up);
            renderSessions();
            renderSessionLog();
            updateReport(); updateWeather();
            renderDetSessionOptions(); renderDeterminationUI(); renderDeterminationList();
        }

        function renderSessionLog() {
            const box = document.getElementById('session-log-container');
            if(!box) return;
            const day = ensureDay();
            const sessions = day.sessions.slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
            if(!sessions.length) { box.innerHTML = '<div class="text-gray-500 text-sm">Nog geen sessies vandaag.</div>'; return; }
            const selected = viewedSessionId || sessions[sessions.length-1].id;
            box.innerHTML = sessions
            .filter(s => s.id === selected)
            .map(s => {
                const total = sumCounts(s.counts);
                const weather = s.weather ? `${s.weather.t}°C • ${WMO[s.weather.c] || 'OK'}` : 'Onbekend';
                const photos = s.photos || [];
                return `
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-3">
                        <div class="flex justify-between items-start gap-2">
                            <div>
                                <div class="text-xs text-gray-400">${fmtTime(s.start)} - ${s.end ? fmtTime(s.end) : 'lopend'}</div>
                                <div class="text-lg font-bold text-white">${total} stuks</div>
                            </div>
                            <button class="bg-purple-700 px-2 py-1 rounded text-[10px]" onclick="triggerPhoto('${s.id}')">📸</button>
                        </div>
                            <div class="space-y-2 text-left">
                                <label class="text-[10px] uppercase text-gray-400 font-bold">Traject</label>
                                <input value="${s.routeName || ''}" oninput="updateRoute('${s.id}', this.value)" class="w-full bg-gray-700 rounded px-2 py-2 text-sm text-white border border-gray-600" placeholder="Sint-Amandsstraat, Pittem" list="route-suggestions">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-[10px] uppercase text-gray-400 font-bold">Weer</div>
                                    <div class="text-sm text-gray-200">${weather}</div>
                                </div>
                                <button class="bg-yellow-600 text-white px-3 py-1 rounded text-[10px]" onclick="fetchWeather(picker.value, '${s.id}')">GPS Update</button>
                            </div>
                            <label class="text-[10px] uppercase text-gray-400 font-bold">Notities</label>
                            <textarea oninput="updateSessionNotes('${s.id}', this.value)" class="w-full bg-gray-700 border-none rounded p-3 text-sm h-20 text-white focus:ring-1 focus:ring-blue-500">${s.notes || ''}</textarea>
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
                                ${photos.map((p,i)=>`
                                    <div class="relative">
                                        <img src="${p}" class="rounded w-full aspect-square object-cover shadow cursor-pointer" onclick="openPhoto('${s.id}', ${i})">
                                        <button class="absolute top-1 right-1 bg-red-700 rounded-full w-5 h-5 text-[9px] font-bold" onclick="removeSessionPhoto('${s.id}', ${i})">X</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            buildRouteSuggestions();
        }

        // --- DETERMINATIE FLOW ---
        function getDetSession() {
            const day = ensureDay();
            const select = document.getElementById('det-session-select');
            const chosen = select ? select.value : '';
            if(chosen) return day.sessions.find(s => s.id === chosen) || null;
            return getActiveSession(day) || day.sessions[day.sessions.length-1] || null;
        }

        function renderDetSessionOptions() {
            const sel = document.getElementById('det-session-select');
            const label = document.getElementById('det-session-label');
            const day = ensureDay();
            if(!sel) return;
            const sessions = day.sessions.slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
            sel.innerHTML = sessions.map(s => {
                const l = `${fmtTime(s.start)} ${s.end ? '– '+fmtTime(s.end) : '(live)'}`;
                return `<option value="${s.id}">${l}</option>`;
            }).join('') || '<option value=\"\">Geen sessies</option>';
            if(!sel.value && sessions.length) sel.value = sessions[sessions.length-1].id;
            const sess = getDetSession();
            if(sess && !sess.determinations) sess.determinations = [];
            if(!sess && sessions.length) activeDeterminationId = null;
            if(sess && sess.determinations && !sess.determinations.find(d => d.id === activeDeterminationId)) {
                activeDeterminationId = sess.determinations[sess.determinations.length-1]?.id || null;
            }
            if(label) label.innerText = sess ? sel.selectedOptions[0].textContent : 'Geen sessie';
        }

        function beginDetermination(id = null) {
            const day = ensureDay();
            const sess = getDetSession();
            if(!sess) { alert('Start eerst een sessie.'); return; }
            let det = null;
            if(id) {
                det = sess.determinations.find(d => d.id === id);
            }
            if(!det) {
                det = { id:`det_${Date.now()}`, answers: [], photos: [], node:'root', result:null, resultName:'', createdAt:Date.now(), updatedAt:Date.now() };
                sess.determinations.push(det);
            }
            activeDeterminationId = det.id;
            save();
            renderDeterminationUI();
            renderDeterminationList();
        }

        function currentDetermination() {
            const sess = getDetSession();
            if(!sess) return null;
            const found = sess.determinations.find(d => d.id === activeDeterminationId);
            return found || sess.determinations[sess.determinations.length-1] || null;
        }

        function triggerDetPhoto() {
            const det = currentDetermination();
            if(!det) { alert('Start eerst een determinatie.'); return; }
            if(det.photos.length >= 3) { alert('Max 3 foto’s.'); return; }
            const inp = document.getElementById('det-photo-input');
            if(inp) { inp.value=''; inp.click(); }
        }

        function handleDetPhoto(ev) {
            const file = ev.target.files?.[0];
            if(!file) return;
            const det = currentDetermination();
            const sess = getDetSession();
            if(!det || !sess) { alert('Geen actieve determinatie.'); return; }
            const reader = new FileReader();
            reader.onload = r => {
                const img = new Image();
                img.onload = () => {
                    const c = document.createElement('canvas'); const m = 700;
                    const fct = Math.min(1, m/Math.max(img.width, img.height));
                    c.width = img.width*fct; c.height = img.height*fct;
                    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
                    const data = c.toDataURL('image/jpeg', 0.7);
                    det.photos.push(data);
                    // ook toevoegen aan sessie-foto's zodat delen werkt
                    sess.photos.push(data);
                    save();
                    renderDeterminationUI();
                    renderDeterminationList();
                };
                img.src = r.target.result;
            };
            reader.readAsDataURL(file);
        }

        function removeDetPhoto(idx) {
            const det = currentDetermination();
            if(!det) return;
            det.photos.splice(idx,1);
            save();
            renderDeterminationUI();
            renderDeterminationList();
        }

        function answerDetermination(ans) {
            const det = currentDetermination();
            if(!det) { alert('Start eerst een determinatie.'); return; }
            const nodeId = det.node || 'root';
            const node = nodeId === 'root' ? DET_TREE : DET_NODES[nodeId];
            if(!node) return;
            det.answers.push({ node: nodeId, answer: ans });
            let next = null;
            if(node.result) {
                next = node;
            } else {
                const jump = ans === 'yes' ? node.yes : node.no;
                next = DET_NODES[jump] || DET_NODES[DET_TREE[jump]] || DET_NODES[jump];
                det.node = jump;
            }
            det.updatedAt = Date.now();
            // check result
            const n = node.result ? node : (DET_NODES[det.node] && DET_NODES[det.node].result ? DET_NODES[det.node] : null);
            if(n && n.result) {
                det.result = n.species;
                det.resultName = n.name;
            }
            save();
            renderDeterminationUI();
            renderDeterminationList();
        }

        function resetDetermination(id) {
            const det = currentDetermination();
            if(!det) return;
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
            const progress = document.getElementById('det-progress');
            const btnY = document.getElementById('det-btn-yes');
            const btnN = document.getElementById('det-btn-no');
            const strip = document.getElementById('det-photo-strip');
            const hintBox = document.getElementById('det-hint');
            const hintImg = document.getElementById('det-hint-img');
            const hintCap = document.getElementById('det-hint-caption');
            renderDetSessionOptions();
            if(strip) {
                strip.innerHTML = det ? det.photos.map((p,i)=>`
                    <div class="relative">
                        <img src="${p}" class="rounded-lg w-full aspect-square object-cover cursor-pointer" onclick="openDetPhoto('${det.id}', ${i})">
                        <button class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-[10px]" onclick="removeDetPhoto(${i})">✕</button>
                    </div>
                `).join('') : '<div class="text-gray-500 text-[11px]">Nog geen foto\'s.</div>';
            }
            if(!det || !qBox) {
                if(qBox) qBox.innerText = 'Start een nieuwe determinatie om vragen te krijgen.';
                if(resBox) resBox.innerText = '';
                if(progress) progress.innerText = '';
                if(applyBox) applyBox.classList.add('hidden');
                if(hintBox) hintBox.classList.add('hidden');
                [btnY, btnN].forEach(b => b && (b.disabled = true));
                return;
            }
            const nodeId = det.node || 'root';
            const node = nodeId === 'root' ? DET_TREE : DET_NODES[nodeId];
            const atResult = node && node.result;
            if(qBox) qBox.innerText = atResult ? 'Determinatie afgerond' : (node?.question || 'Vraag onbekend');
            if(resBox) resBox.innerText = det.resultName ? `Resultaat: ${det.resultName}` : '';
            if(progress) progress.innerText = `Vragen beantwoord: ${det.answers.length}`;
            if(applyBox) applyBox.classList.toggle('hidden', !det.result);
            [btnY, btnN].forEach(b => b && (b.disabled = !!det.result));
            if(hintBox) {
                const resNode = det.result ? Object.values(DET_NODES).find(n => n.result && n.species === det.result) : null;
                const hintSrc = node?.hint || resNode?.hint;
                const caption = node?.caption || resNode?.caption || '';
                if(hintSrc) {
                    hintImg.src = hintSrc;
                    hintCap.innerText = caption;
                    hintBox.classList.remove('hidden');
                } else {
                    hintBox.classList.add('hidden');
                }
            }
        }

        function renderDeterminationList() {
            const list = document.getElementById('det-list');
            if(!list) return;
            const sess = getDetSession();
            if(!sess || !sess.determinations?.length) {
                list.innerHTML = '<div class=\"text-gray-500\">Nog geen determinaties.</div>';
                return;
            }
            const sorted = sess.determinations.slice().sort((a,b)=>b.updatedAt - a.updatedAt);
            const items = [];
            sorted.forEach(d => {
                const photos = d.photos?.length || 0;
                const res = d.resultName || 'Onbekend';
                const ts = new Date(d.updatedAt).toLocaleString('nl-BE');
                const openBtn = `<button class="bg-blue-700 text-white px-2 py-1 rounded text-[10px]" onclick="openDetermination('${d.id}')">Open</button>`;
                const editBtn = `<button class="bg-gray-700 text-white px-2 py-1 rounded text-[10px]" onclick="beginDetermination('${d.id}')">Bewerk</button>`;
                items.push(
                    '<div class=\"bg-gray-900 border border-gray-700 rounded p-3 flex items-center justify-between gap-2\">' +
                        '<div>' +
                            `<div class=\"font-bold text-white\">${res}</div>` +
                            `<div class=\"text-gray-400 text-[10px]\">${ts} · ${d.answers.length} vragen · ${photos} foto(s)</div>` +
                        '</div>' +
                        '<div class=\"flex gap-2\">' + openBtn + editBtn + '</div>' +
                    '</div>'
                );
            });
            list.innerHTML = items.join('');
        }

        function openDetermination(id) {
            activeDeterminationId = id;
            renderDeterminationUI();
            renderDeterminationList();
        }

        function applyDeterminationToCounts() {
            const det = currentDetermination();
            const day = ensureDay();
            const sess = getDetSession();
            if(!det || !det.result || !sess) return;
            const speciesId = det.result;
            const targetId = ensureSpeciesExists(speciesId, det.resultName || speciesId, day);
            const key = `${targetId}_o_l`;
            const inc = confirm(`'${det.resultName}' toevoegen aan teller?`) ? 1 : 0;
            if(!inc) return;
            day.counts[key] = (day.counts[key]||0) + 1;
            sess.counts[key] = (sess.counts[key]||0) + 1;
            save(); render(); showToast('Determinatie toegevoegd aan teller');
        }

        function ensureSpeciesExists(id, name, day) {
            if(SPECIES.some(s => s.id === id)) return id;
            const existing = (day.custom || []).find(c => c.name === name || c.id === id);
            if(existing) return existing.id;
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
            if(newBtn) newBtn.classList.toggle('hidden', !!active);
            const camFab = document.getElementById('camera-fab');
            if(camFab) camFab.classList.toggle('hidden', !active);
            const recBtn = document.getElementById('record-btn');
            if(recBtn) recBtn.classList.toggle('hidden', !active);
            buildViewedSessionOptions();
            buildRouteSuggestions();
        }

        function buildViewedSessionOptions() {
            const sels = ['session-view-select','session-log-select'].map(id => document.getElementById(id)).filter(Boolean);
            if(!sels.length) return;
            const day = ensureDay();
            const sessions = day.sessions.slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
            const opts = sessions.map(s => {
                const label = `${fmtTime(s.start)} ${s.end ? '– '+fmtTime(s.end) : '(live)'}`;
                return `<option value="${s.id}" ${s.id === (viewedSessionId || '') ? 'selected' : ''}>${label}</option>`;
            }).join('') || '<option value=\"\">Geen sessies</option>';
            sels.forEach(sel => {
                sel.innerHTML = opts;
                if(!viewedSessionId && sessions.length) viewedSessionId = sessions[sessions.length-1].id;
                if(sel && viewedSessionId) sel.value = viewedSessionId;
            });
        }

        function setViewedSession(id) {
            viewedSessionId = id || '';
            renderSessionLog();
            updateReport();
        }


        function updateSessionNotes(id, val) {
            const day = ensureDay();
            const s = day.sessions.find(x => x.id === id);
            if(!s) return;
            s.notes = val;
            save();
        }

        function updateRoute(id, val) {
            const day = ensureDay();
            const s = day.sessions.find(x => x.id === id);
            if(!s) return;
            s.routeName = val;
            save();
            buildRouteSuggestions();
        }

        function removeSessionPhoto(id, idx) {
            const day = ensureDay();
            const s = day.sessions.find(x => x.id === id);
            if(!s) return;
            s.photos.splice(idx,1);
            // dagbuffer opschonen grof (herstelt duplicaten niet exact, maar voldoende)
            day.photos = day.sessions.flatMap(ss => ss.photos);
            save(); renderSessionLog();
        }

        function openPhoto(sessionId, idx) {
            const day = ensureDay();
            let photo = null;
            if(sessionId === 'det') {
                const det = currentDetermination();
                photo = det?.photos?.[idx];
            } else {
                const s = day.sessions.find(x => x.id === sessionId);
                if(!s) return;
                photo = s.photos?.[idx];
            }
            if(!photo) return;
            const box = document.getElementById('photo-lightbox');
            const img = document.getElementById('photo-lightbox-img');
            img.src = photo;
            box.classList.remove('hidden');
        }

        // open foto uit storage inspector
        function openInspectorPhoto(idx, key) {
            const raw = localStorage.getItem(key || STORAGE_KEY);
            if(!raw) return;
            try {
                const parsed = JSON.parse(raw);
                const imgs = [];
                const collect = v => {
                    if(typeof v === 'string' && v.startsWith('data:image')) imgs.push(v);
                    else if(Array.isArray(v)) v.forEach(collect);
                    else if(v && typeof v === 'object') Object.values(v).forEach(collect);
                };
                collect(parsed);
                const photo = imgs[idx];
                if(!photo) return;
                const box = document.getElementById('photo-lightbox');
                const img = document.getElementById('photo-lightbox-img');
                img.src = photo;
                box.classList.remove('hidden');
            } catch(e) { console.log(e); }
        }


        function openDetPhoto(detId, idx) {
            const day = ensureDay();
            for(const s of day.sessions || []) {
                const det = (s.determinations || []).find(d => d.id === detId);
                if(det) {
                    const photo = det.photos?.[idx];
                    if(photo) {
                        const box = document.getElementById('photo-lightbox');
                        const img = document.getElementById('photo-lightbox-img');
                        img.src = photo;
                        box.classList.remove('hidden');
                    }
                    return;
                }
            }
        }

        function closePhoto(ev) {
            // close when backdrop or X clicked
            const box = document.getElementById('photo-lightbox');
            if(!box) return;
            if(ev.target.id === 'photo-lightbox' || ev.target.tagName === 'BUTTON' || ev.target.tagName === 'IMG' && ev.target.id === 'photo-lightbox-img') {
                box.classList.add('hidden');
                document.getElementById('photo-lightbox-img').src = '';
            }
        }

        function sumCounts(obj = {}) {
            let total = 0;
            for(const k in obj) {
                const v = obj[k] || 0;
                total += (k.includes('_p_')) ? v*2 : v; // paartjes tellen als twee dieren
            }
            return total;
        }

        function getActiveSession(day) {
            return day.sessions.find(s => s.id === activeSessionId && !s.end) || day.sessions.find(s => !s.end);
        }

        function renderSessionAdmin() {
            const dayKey = document.getElementById('sessionDate')?.value || picker.value;
            const day = ensureDay(dayKey);
            const box = document.getElementById('session-admin-list');
            if(!box) return;
            const items = day.sessions.slice().sort((a,b)=>new Date(a.start)-new Date(b.start)).map(s => {
                const total = sumCounts(s.counts);
                const weather = s.weather ? `<div class="text-[10px] text-sky-300">🌤️ ${s.weather.t}°C ${WMO[s.weather.c]||'OK'}</div>` : '';
                return `<label class="bg-gray-900 p-3 rounded border border-gray-800 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" class="session-merge-checkbox accent-emerald-500" value="${s.id}">
                    <div class="flex-1">
                        <div class="font-bold text-gray-100">${fmtTime(s.start)} - ${s.end ? fmtTime(s.end) : 'lopend'}</div>
                        <div class="text-gray-400 text-[10px]">${total} stuks</div>
                        ${weather}
                    </div>
                    <button class="bg-red-700 px-2 py-1 rounded text-[12px]" onclick="deleteSession('${s.id}','${dayKey}')" title="Verwijder sessie">🗑️</button>
                </label>`;
            }).join('') || '<div class="text-gray-500">Geen sessies voor deze dag.</div>';
            box.innerHTML = items;
            // merge action button
            const mergeBtn = document.createElement('button');
            mergeBtn.innerText = 'Merge selectie';
            mergeBtn.className = 'w-full bg-gray-700 mt-2 py-2 rounded text-[11px] font-bold';
            mergeBtn.onclick = () => mergeSelectedSessions(dayKey);
            box.appendChild(mergeBtn);
        }

        function startSession(force = false, fromSessionPage = false, dayKeyOverride = null, redirect = true) {
            const dayKey = dayKeyOverride || (fromSessionPage ? (document.getElementById('sessionDate').value || picker.value) : picker.value);
            const day = ensureDay(dayKey);
            const existing = day.sessions.find(s => !s.end);
            if(existing && !force) { alert('Er draait al een sessie. Stop eerst.'); return; }
            const now = new Date();
            const session = { id: 'sess_'+now.getTime(), start: now.toISOString(), counts: {}, notes: '', weather: null, photos: [], routeName: '', determinations: [] };
            day.sessions.push(session);
            activeSessionId = session.id;
            viewedSessionId = session.id;
            save(); render(); renderSessionAdmin(); renderDetSessionOptions(); renderDeterminationUI(); renderDeterminationList(); showToast('Sessie gestart');
            if(redirect) switchTab('sessions');
            fetchWeather(dayKey, session.id); // capture weather at start
        }

        function endSession() {
            const day = ensureDay();
            const active = day.sessions.find(s => !s.end);
            if(!active) return alert('Geen actieve sessie');
            active.end = new Date().toISOString();
            save(); render(); renderSessionAdmin(); showToast('Sessie gestopt');
        }

        // legacy single merge fallback (unused in UI now but kept for safety)
        function mergeSession(id, dayKey = picker.value) {
            const day = ensureDay(dayKey);
            const target = day.sessions.find(s => s.id === id);
            if(!target) return;
            const others = day.sessions.filter(s => s.id !== id);
            if(!others.length) { alert('Minstens 2 sessies nodig.'); return; }
            const master = target;
            others.forEach(s => {
                for(const k in s.counts) master.counts[k] = (master.counts[k]||0) + s.counts[k];
                if(s.photos && s.photos.length) {
                    master.photos = (master.photos || []).concat(s.photos);
                }
                if(new Date(s.start) < new Date(master.start)) master.start = s.start;
                if(s.end && (!master.end || new Date(s.end) > new Date(master.end))) master.end = s.end;
                if(s.weather && !master.weather) master.weather = s.weather;
            });
            day.sessions = [master];
            recalcDayFromSessions(day);
            save(); render(); renderSessionAdmin(); showToast('Sessies samengevoegd');
        }

        function mergeSelectedSessions(dayKey = picker.value) {
            const day = ensureDay(dayKey);
            const boxes = Array.from(document.querySelectorAll('.session-merge-checkbox')).filter(cb => cb.checked);
            if(boxes.length < 2) { alert('Selecteer minstens 2 sessies.'); return; }
            const ids = boxes.map(b => b.value);
            const masterId = ids[0];
            const master = day.sessions.find(s => s.id === masterId);
            const others = day.sessions.filter(s => ids.includes(s.id) && s.id !== masterId);
            others.forEach(s => {
                for(const k in s.counts) master.counts[k] = (master.counts[k]||0) + s.counts[k];
                if(s.photos && s.photos.length) {
                    master.photos = (master.photos || []).concat(s.photos);
                }
                if(new Date(s.start) < new Date(master.start)) master.start = s.start;
                if(s.end && (!master.end || new Date(s.end) > new Date(master.end))) master.end = s.end;
                if(s.weather && !master.weather) master.weather = s.weather;
            });
            day.sessions = day.sessions.filter(s => !others.includes(s));
            recalcDayFromSessions(day);
            save(); render(); renderSessionAdmin(); showToast('Sessies samengevoegd');
        }

        function recalcDayFromSessions(day) {
            day.counts = {};
            day.sessions.forEach(s => {
                for(const k in s.counts) day.counts[k] = (day.counts[k]||0) + s.counts[k];
            });
            day.photos = day.sessions.flatMap(s => s.photos || []);
        }

        function purgeEmptyCustomSpecies() {
            for(const d in storage) {
                const day = ensureDay(d);
                if(!day.custom) continue;
                day.custom = day.custom.filter(c => {
                    const hasCounts = Object.keys(day.counts||{}).some(k => k.startsWith(`${c.id}_`) && (day.counts[k]||0) > 0);
                    return hasCounts || c.name !== 'Onbekend';
                });
                // verwijder lege count keys voor niet-bestaande custom soorten
                const validIds = new Set(day.custom.map(c => c.id));
                Object.keys(day.counts||{}).forEach(k => {
                    const sid = k.split('_')[0];
                    if(!validIds.has(sid) && k.startsWith('c_')) delete day.counts[k];
                });
            }
        }

        function deleteSession(id, dayKey = picker.value) {
            const day = ensureDay(dayKey);
            day.sessions = day.sessions.filter(s => s.id !== id);
            recalcDayFromSessions(day);
            if(activeSessionId === id) activeSessionId = null;
            save(); render(); renderSessionAdmin(); showToast('Sessie verwijderd');
        }

        function confirmMerge(id) {
            return confirm(`Sessies samenvoegen met ${id}?`);
        }

        function fmtTime(iso) {
            const d = new Date(iso);
            return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
        }

        async function fetchWeather(dayOverride, sessionId) {
            if(!navigator.geolocation) return;
            showToast("GPS zoekt...");
            navigator.geolocation.getCurrentPosition(async p => {
                try {
                    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current_weather=true`);
                    const j = await r.json();
                    const dayKey = dayOverride || picker.value;
                    const day = ensureDay(dayKey);
                    const w = { t: j.current_weather.temperature, c: j.current_weather.weathercode, ts: Date.now() };
                    day.weather = w;
                    if(sessionId) {
                        const sess = day.sessions.find(s => s.id === sessionId);
                        if(sess) sess.weather = w;
                    } else {
                        const active = day.sessions.find(s => !s.end);
                        if(active) active.weather = active.weather || w;
                    }
                    save(); render(); showToast("Weer OK");
                } catch(e) { alert("API Fout"); console.log(e) }
            });
        }

        function updateWeather() {
            const el = document.getElementById('weather-display');
            if(!el) return;
            const w = storage[picker.value]?.weather;
            el.innerText = w ? `${w.t}°C - ${WMO[w.c] || "OK"}` : "Geen weerdata bekend.";
        }

        function addCustomSpecies() {
            const n = document.getElementById('new-species-name').value.trim();
            if(!n) return;
            const day = ensureDay();
            day.custom.push({ id: 'c_'+Date.now(), name: n, color: 'gray', hasAmplexus: true });
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
        function removeC(id) { if(confirm("Soort wissen?")) { const day = ensureDay(); day.custom = day.custom.filter(c => c.id!==id); save(); buildUI(); render(); } }

        function triggerPhoto(sessionId = null) {
            const day = ensureDay();
            const target = sessionId || (getActiveSession(day)?.id || null);
            if(!target) { alert('Start eerst een sessie om foto\'s toe te voegen.'); return; }
            photoTargetSession = target;
            vibe(25, true);
            const input = document.getElementById('photo-input');
            input.value = '';
            input.click();
        }

        function handlePhoto(e) {
            const f = e.target.files[0]; if(!f) return;
            const day = ensureDay();
            const session = photoTargetSession
                ? day.sessions.find(s => s.id === photoTargetSession)
                : getActiveSession(day);
            if(!session) { alert('Geen actieve sessie gevonden.'); return; }
            const r = new FileReader(); r.onload = ev => {
                const img = new Image(); img.onload = () => {
                    const c = document.createElement('canvas'); const m = 600;
                    const fct = Math.min(1, m/Math.max(img.width, img.height));
                    c.width = img.width*fct; c.height = img.height*fct;
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    const data = c.toDataURL('image/jpeg', 0.6);
                    session.photos.push(data);
                    // ook op dag-niveau voor aggregatie en legacy
                    day.photos.push(data);
                    save(); renderSessionLog();
                }; img.src = ev.target.result;
            }; r.readAsDataURL(f);
        }

        function clearAllPhotos(dayKey = null) {
            if(!confirm(dayKey ? `Alle foto\'s van ${dayKey} wissen?` : 'Alle foto\'s in alle dagen wissen?')) return;
            if(dayKey) {
                const d = ensureDay(dayKey);
                d.photos = [];
                d.sessions.forEach(s => s.photos = []);
            } else {
                for(const d in storage) { const day = ensureDay(d); day.photos = []; day.sessions.forEach(s => s.photos = []); }
            }
            save(); renderSessionLog(); showToast('Foto\'s gewist');
        }

        async function shareSessionPhotos(sessionId) {
            const day = ensureDay();
            const session = day.sessions.find(s => s.id === sessionId);
            if(!session) return alert('Sessies niet gevonden');
            const photos = session.photos || [];
            if(!photos.length) return alert('Geen foto\'s in deze sessie.');
            const files = photos.map((dataUrl, idx) => {
                const res = dataURLToBlob(dataUrl);
                return new File([res.blob], `paddentrek-${picker.value}-${sessionId}-${idx+1}.${res.ext}`, { type: res.blob.type });
            });
            const text = `Foto's ${picker.value} (${fmtTime(session.start)}): ${photos.length} stuks`;
            const shareData = { title: 'Paddentrek', text, files };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                    return;
                }
            } catch(err) {
                if(err?.name === 'AbortError') return;
            }
            const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(wa, '_blank');
        }

        function dataURLToBlob(dataUrl) {
            const [meta, b64] = dataUrl.split(',');
            const mime = meta.match(/data:(.*);base64/)[1] || 'image/jpeg';
            const ext = mime.split('/')[1] || 'jpg';
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
            return { blob: new Blob([arr], { type: mime }), ext };
        }

        function updateReport() {
            const d = picker.value; const data = ensureDay(d);
            const sel = document.getElementById('report-session-select');
            const sessionId = sel ? sel.value : '';
            const session = sessionId ? (data.sessions || []).find(s => s.id === sessionId) : null;
            const targetCounts = reportMode === 'session' && session ? session.counts : data.counts;
            let txt = `🐸 *OVERZET-UPDATE - ${d}*\n\n`;
            const w = (reportMode === 'session' ? session?.weather : data.weather) || session?.weather;
            if(w) txt += `🌤️ *Weer:* ${w.t}°C, ${WMO[w.c] || "OK"}\n\n`;
            const all = [...SPECIES, ...(data.custom || [])]; let h = false;
            all.forEach(s => {
                const pl = targetCounts[`${s.id}_p_l`]||0, pd = targetCounts[`${s.id}_p_d`]||0;
                const ml = targetCounts[`${s.id}_m_l`]||0, vl = targetCounts[`${s.id}_v_l`]||0, ol = targetCounts[`${s.id}_o_l`]||0;
                const md = targetCounts[`${s.id}_m_d`]||0, vd = targetCounts[`${s.id}_v_d`]||0, od = targetCounts[`${s.id}_o_d`]||0;
                if(pl+pd+ml+vl+ol+md+vd+od > 0) { h = true;
                    txt += `*${s.name}:*\n${pl>0 ? '  ❤️ '+pl+' Koppels (levend)\n':''}${pd>0 ? '  ☠️ '+pd+' Koppels (dood)\n':''}  - Levend: ${ml}m, ${vl}v, ${ol}o\n  - Dood: ${md}m, ${vd}v, ${od}o\n`;
                }
            });
            txt += `\nℹ️ Koppels (❤️/☠️) worden niet dubbel geteld bij de losse man/vrouw-aantallen.\n`;
            if(reportMode === 'session' && session?.notes) txt += `\n📝 *Nota:* ${session.notes}\n`;
            if(reportMode === 'day' && data.notes) txt += `\n📝 *Nota:* ${data.notes}\n`;
            const sessionsToShow = reportMode === 'session' && session ? [session] : (data.sessions || []);
            if(sessionsToShow.length) {
                txt += `\n⏱️ *Sessies:*\n`;
                sessionsToShow.sort((a,b)=>new Date(a.start)-new Date(b.start)).forEach(s => {
                    const total = sumCounts(s.counts);
                    const wtxt = s.weather ? ` | 🌤️ ${s.weather.t}°C ${WMO[s.weather.c]||'OK'}` : '';
                    const route = s.routeName ? ` | 🚶‍♂️ ${s.routeName}` : '';
                    txt += `  - ${fmtTime(s.start)} - ${s.end ? fmtTime(s.end) : 'lopend'}: ${total} stuks${route}${wtxt}\n`;
                });
            }
            txt += `\n#Paddentrek #Telling`;
            document.getElementById('report-text').innerText = h || data.notes ? txt : "Nog geen data ingevoerd.";

            // determinaties blok
            const detBox = document.getElementById('report-dets');
            if(detBox) {
                const dets = (reportMode === 'session' && session)
                    ? (session.determinations || [])
                    : (data.sessions || []).flatMap(s => s.determinations || []);
                if(!dets.length) {
                    detBox.innerHTML = '<div class=\"text-gray-500\">Geen determinaties in deze selectie.</div>';
                } else {
                    const parts = [];
                    dets.slice().sort((a,b)=>b.updatedAt-a.updatedAt).forEach(det => {
                        const photos = det.photos?.length || 0;
                        const label = det.resultName || 'Onbekend';
                        const answers = det.answers || [];
                        const ts = new Date(det.updatedAt).toLocaleString('nl-BE');
            const ansList = answers.map((a,idx) => `<li class=\"flex justify-between\"><span>${idx+1}. ${detQuestionText(a.node)}</span><span class=\"font-bold ${a.answer==='yes' ? 'text-emerald-400' : 'text-red-400'}\">${detAnswerLabel(a.answer)}</span></li>`).join('');
                        const photoList = photos ? det.photos.map((p,i)=>`<img src=\"${p}\" class=\"h-16 w-16 object-cover rounded border border-gray-800\" onclick=\"openDetPhoto(\'${det.id}\', ${i})\">`).join('') : '<div class=\"text-gray-500 text-[10px]\">Geen foto\'s</div>';
                        parts.push(
                            '<div class=\"bg-gray-900 border border-gray-700 rounded p-3 space-y-2\">' +
                                '<div class=\"flex items-start justify-between gap-2\">' +
                                    '<div class=\"flex items-start gap-2\">' +
                                        `<input type=\"checkbox\" class=\"mt-1 share-det-checkbox accent-emerald-500\" value=\"${det.id}\">` +
                                        `<div><div class=\"font-bold text-white\">${label}</div><div class=\"text-gray-400 text-[10px]\">${answers.length} vragen · ${photos} foto(s)</div></div>` +
                                    '</div>' +
                                    `<div class=\"text-[10px] text-gray-400\">${ts}</div>` +
                                '</div>' +
                                `<ul class=\"text-[11px] text-gray-200 space-y-1\">${ansList || '<li class=\\\"text-gray-500\\\">Geen antwoorden</li>'}</ul>` +
                                `<div class=\"flex gap-2 flex-wrap\">${photoList}</div>` +
                            '</div>'
                        );
                    });
                    detBox.innerHTML = parts.join('');
                }
            }
        }

        function setReportMode(m) {
            reportMode = m;
            updateReport();
        }

        async function shareReport(includePhotos = false) {
            const day = ensureDay();
            const sel = document.getElementById('report-session-select');
            const sessionId = sel ? sel.value : '';
            const session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
            const text = document.getElementById('report-text').innerText || 'Geen data';
            let files = [];
            if(includePhotos) {
                const photos = reportMode === 'session' && session ? (session.photos||[]) : (day.photos||[]);
                if(!photos.length) { alert('Geen foto’s beschikbaar voor deze selectie.'); return; }
                files = photos.map((dataUrl, idx) => {
                    const res = dataURLToBlob(dataUrl);
                    return new File([res.blob], `paddentrek-${picker.value}-${idx+1}.${res.ext}`, { type: res.blob.type });
                });
            }

            const shareData = includePhotos ? { title: 'Paddentrek', text, files } : { title: 'Paddentrek', text };
            try {
                if(navigator.share) {
                    if(includePhotos) {
                        if(navigator.canShare && !navigator.canShare({ files })) {
                            throw new Error('FILES_NOT_SUPPORTED');
                        }
                    }
                    await navigator.share(shareData);
                    return;
                }
            } catch(err) {
                if(err?.name === 'AbortError') return;
                if(err?.message === 'FILES_NOT_SUPPORTED') {
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
                : (day.sessions || []).flatMap(s => s.determinations || []);
            const selected = Array.from(document.querySelectorAll('#report-dets .share-det-checkbox:checked')).map(cb => cb.value);
            if(selected.length) dets = dets.filter(d => selected.includes(d.id));
            if(!dets.length) { alert('Geen determinaties in deze selectie.'); return; }
            const lines = dets.map((d,i) => {
                const ans = (d.answers||[]).map((a,idx)=>`${idx+1}. ${detQuestionText(a.node)} -> ${detAnswerLabel(a.answer)}`).join(' | ');
                return `${i+1}. ${d.resultName || 'Onbekend'} (${new Date(d.updatedAt).toLocaleString('nl-BE')})\\n   Antwoorden: ${ans || 'n.v.t.'}\\n   Foto's: ${(d.photos||[]).length}`;
            });
            const text = `Determinaties ${picker.value} (${reportMode==='session' && session ? 'sessie' : 'dag'}):\\n\\n${lines.join('\\n')}`;
            let files = [];
            const photos = dets.flatMap(d => d.photos || []).slice(0,10); // limiet om share API vriendelijk te houden
            if(photos.length) {
                files = photos.map((dataUrl, idx) => {
                    const res = dataURLToBlob(dataUrl);
                    return new File([res.blob], `det-${picker.value}-${idx+1}.${res.ext}`, { type: res.blob.type });
                });
            }
            const shareData = photos.length && navigator.canShare && navigator.canShare({ files })
                ? { title:'Determinaties', text, files }
                : { title:'Determinaties', text };
            try {
                if(navigator.share) {
                    await navigator.share(shareData);
                    return;
                }
            } catch(err) {
                if(err?.name === 'AbortError') return;
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
            const counts = reportMode === 'session' && session ? session.counts || {} : day.counts || {};
            const meta = reportMode === 'session' && session
                ? { route: session.routeName || '', notes: session.notes || '', weather: session.weather }
                : { route: '', notes: day.notes || '', weather: day.weather };
            const rows = [];
            rows.push(['Datum','Scope','Route','Notities','Weer temp','Weer code','Soort','Koppels levend','Koppels dood','M levend','V levend','Onb levend','M dood','V dood','Onb dood','Totaal']);
            const all = [...SPECIES, ...(day.custom || [])];
            all.forEach(s => {
                const pl = counts[`${s.id}_p_l`]||0, pd = counts[`${s.id}_p_d`]||0;
                const ml = counts[`${s.id}_m_l`]||0, vl = counts[`${s.id}_v_l`]||0, ol = counts[`${s.id}_o_l`]||0;
                const md = counts[`${s.id}_m_d`]||0, vd = counts[`${s.id}_v_d`]||0, od = counts[`${s.id}_o_d`]||0;
                const tot = pl*2+pd*2+ml+vl+ol+md+vd+od;
                if(tot>0) rows.push([
                    d,
                    session ? 'Sessie' : 'Dag',
                    meta.route,
                    meta.notes,
                    meta.weather?.t ?? '',
                    meta.weather?.c ?? '',
                    s.name, pl, pd, ml, vl, ol, md, vd, od, tot
                ]);
            });
            if(rows.length===1) rows.push(['Geen data',0,0,0,0,0,0,0,0,0]);
            downloadCSV(rows, session ? `paddentrek-${d}-${session.id}.csv` : `paddentrek-${d}-dag.csv`);
        }

        function downloadCSV(rows, name) {
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
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
            const rows = [['Datum','Scope','SessionId','Sessiestart','Sessie-einde','Route','Notities','Weer temp','Weer code','Soort','Koppels levend','Koppels dood','M levend','V levend','Onb levend','M dood','V dood','Onb dood','Totaal']];
            const addRows = (scopeLabel, counts, route, notes, wt, wc, sessStart='', sessEnd='', sessId='') => {
                const all = [...SPECIES, ...(day.custom || [])];
                all.forEach(s => {
                    const pl = counts[`${s.id}_p_l`]||0, pd = counts[`${s.id}_p_d`]||0;
                    const ml = counts[`${s.id}_m_l`]||0, vl = counts[`${s.id}_v_l`]||0, ol = counts[`${s.id}_o_l`]||0;
                    const md = counts[`${s.id}_m_d`]||0, vd = counts[`${s.id}_v_d`]||0, od = counts[`${s.id}_o_d`]||0;
                    const tot = pl*2+pd*2+ml+vl+ol+md+vd+od;
                    if(tot>0) rows.push([d, scopeLabel, sessId, sessStart, sessEnd, route, notes, wt, wc, s.name, pl, pd, ml, vl, ol, md, vd, od, tot]);
                });
            };
            if(day.sessions && day.sessions.length) {
                day.sessions.forEach(s => {
                    const wt = s.weather?.t ?? day.weather?.t ?? '';
                    const wc = s.weather?.c ?? day.weather?.c ?? '';
                    addRows('Sessie', s.counts||{}, s.routeName||'', s.notes||'', wt, wc, s.start||'', s.end||'', s.id||'');
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
            if(!version || version === APP_VERSION) return; // niets nieuw
            updateBtn.classList.remove('hidden');
            updateBtn.innerText = `UPDATE ${version}`;
        }
        updateBtn.onclick = () => {
            updateBtn.innerText = 'Bezig...';
            updateBtn.disabled = true;
            navigator.serviceWorker.getRegistration().then(reg => reg?.update()).finally(() => location.reload());
        };

        function showToast(m) {
            const t = document.getElementById('toast'); t.innerText = m; t.classList.remove('hidden');
            setTimeout(() => t.style.opacity = '1', 10);
            setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 500); }, 2000);
        }

        function buildQRSessionOptions() {
            const sel = document.getElementById('qr-session-select');
            if(!sel) return;
            const day = ensureDay();
            sel.innerHTML = '<option value=\"\">Alle sessies (dagtotaal)</option>' + day.sessions.map(s => {
                const label = `${fmtTime(s.start)} ${s.end ? '– '+fmtTime(s.end) : '(live)'}`;
                return `<option value="${s.id}">${label}</option>`;
            }).join('');
        }

        function buildReportSessionOptions() {
            const sel = document.getElementById('report-session-select');
            if(!sel) return;
            const day = ensureDay();
            sel.innerHTML = '<option value=\"\">Alle sessies</option>' + day.sessions.map(s => {
                const label = `${fmtTime(s.start)} ${s.end ? '– '+fmtTime(s.end) : '(live)'}${s.routeName ? ' · '+s.routeName : ''}`;
                return `<option value="${s.id}">${label}</option>`;
            }).join('');
            sel.value = '';
        }

        function buildRouteSuggestions() {
            const dl = document.getElementById('route-suggestions');
            if(!dl) return;
            const names = new Set();
            for(const d in storage) {
                const day = ensureDay(d);
                (day.sessions || []).forEach(s => { if(s.routeName) names.add(s.routeName); });
            }
            dl.innerHTML = Array.from(names).slice(0,50).map(n => `<option value="${n}"></option>`).join('');
        }

        function generateQR() {
            const d = picker.value;
            const container = document.getElementById("qrcode-area"); if(container) container.innerHTML = "";
            const sel = document.getElementById('qr-session-select');
            const sessionId = sel ? sel.value : '';
            const day = ensureDay(d);
            const session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
            const counts = session ? session.counts || {} : day.counts || {};
            const payload = { d, c: counts, s: day.custom || [], sess: sessionId || null };
            new QRCode(container, { text: JSON.stringify(payload), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.L });
            updateQrSummary();
        }

        function updateQrSummary() {
            const d = picker.value;
            const sel = document.getElementById('qr-session-select');
            const box = document.getElementById('qr-summary-box');
            if(!sel || !box) return;
            const sessionId = sel.value;
            const day = ensureDay(d);
            const session = sessionId ? day.sessions.find(s => s.id === sessionId) : null;
            const counts = session ? session.counts || {} : day.counts || {};
            const total = sumCounts(counts);
            let lines = [`Dag: ${d}`, `Bron: ${session ? `Sessie ${fmtTime(session.start)}${session.end ? ' – '+fmtTime(session.end) : ''}` : 'Volledige dag'}`, `Totaal dieren: ${total}`];
            const perSpecies = {};
            for(const k in counts) {
                const [sid, suf] = k.split('_');
                perSpecies[sid] = perSpecies[sid] || 0;
                perSpecies[sid] += counts[k] * (suf.includes('p_') ? 2 : 1);
            }
            Object.entries(perSpecies).sort((a,b)=>b[1]-a[1]).slice(0,4).forEach(([sid, val]) => {
                const name = (SPECIES.find(s=>s.id===sid) || (day.custom||[]).find(c=>c.id===sid) || {name:sid}).name;
                lines.push(`${name}: ${val}`);
            });
            box.innerText = `Wie deze QR scant, telt dit bij zichzelf op:\n\n${lines.join('\n')}`;
        }

        function exportRangeCSV(forceSettings = false) {
            const from = document.getElementById(forceSettings ? 'csv-from-settings' : 'csv-from')?.value || picker.value;
            const to = document.getElementById(forceSettings ? 'csv-to-settings' : 'csv-to')?.value || picker.value;
            const dates = Object.keys(storage).filter(d => d >= from && d <= to).sort();
            const rows = [['Datum','Scope','SessionId','Sessiestart','Sessie-einde','Route','Notities','Weer temp','Weer code','Soort','Koppels levend','Koppels dood','M levend','V levend','Onb levend','M dood','V dood','Onb dood','Totaal']];
            dates.forEach(d => {
                const day = ensureDay(d);
                const addRows = (scopeLabel, counts, route, notes, wt, wc, sessStart='', sessEnd='', sessId='') => {
                    const all = [...SPECIES, ...(day.custom || [])];
                    all.forEach(s => {
                        const pl = counts[`${s.id}_p_l`]||0, pd = counts[`${s.id}_p_d`]||0;
                        const ml = counts[`${s.id}_m_l`]||0, vl = counts[`${s.id}_v_l`]||0, ol = counts[`${s.id}_o_l`]||0;
                        const md = counts[`${s.id}_m_d`]||0, vd = counts[`${s.id}_v_d`]||0, od = counts[`${s.id}_o_d`]||0;
                        const tot = pl*2+pd*2+ml+vl+ol+md+vd+od;
                        if(tot>0) rows.push([d, scopeLabel, sessId, sessStart, sessEnd, route, notes, wt, wc, s.name, pl, pd, ml, vl, ol, md, vd, od, tot]);
                    });
                };
                if(day.sessions && day.sessions.length) {
                    day.sessions.forEach(s => {
                        const wt = s.weather?.t ?? day.weather?.t ?? '';
                        const wc = s.weather?.c ?? day.weather?.c ?? '';
                        addRows('Sessie', s.counts||{}, s.routeName||'', s.notes||'', wt, wc, s.start||'', s.end||'', s.id || '');
                    });
                }
                // ook dagtotaal opnemen
                addRows('Dag', day.counts||{}, '', day.notes||'', day.weather?.t ?? '', day.weather?.c ?? '', '', '', 'day-'+d);
            });
            if(rows.length===1) rows.push(['Geen data',0,0,0,0,0,0,0,0,0,0]);
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
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
            if(!input?.files?.length) { res.innerText = 'Geen bestand gekozen.'; return; }
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
            if(!lines.length) return { added:0, days:new Set() };
            const delim = lines[0].includes(';') ? ';' : ',';
            const clean = v => v.replace(/^\"|\"$/g,'').trim().toLowerCase();
            const header = lines[0].split(delim).map(clean);
            const idx = {
                date: header.findIndex(h => h.startsWith('datum')),
                soort: header.findIndex(h => h.startsWith('soort')),
                pl: header.findIndex(h => h.includes('koppels levend')),
                pd: header.findIndex(h => h.includes('koppels dood')),
                ml: header.findIndex(h => h.startsWith('m ') && h.includes('levend')) === -1 ? header.findIndex(h=>h==='m levend') : header.findIndex(h => h.startsWith('m') && h.includes('levend')),
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
            for(let i=1;i<lines.length;i++){
                const cols = lines[i].split(delim).map(c => c.replace(/^\"|\"$/g,'').trim());
                const date = cols[idx.date] || picker.value;
                const speciesName = cols[idx.soort] || 'Onbekend';
                if(!date || !speciesName) continue;
                const day = ensureDay(date);
                days.add(date);
                const scope = idx.scope>=0 ? cols[idx.scope].toLowerCase() : '';
                const startRaw = idx.sessStart>=0 ? cols[idx.sessStart] : '';
                const endRaw = idx.sessEnd>=0 ? cols[idx.sessEnd] : '';
                const sessIdCsv = idx.sessId>=0 ? cols[idx.sessId] : '';
                let sess = null;
                const isSessionRow = scope.includes('sessie');
                if(isSessionRow) {
                    const key = sessIdCsv || `${date}_${startRaw||'00:00'}`;
                    if(!importSessions[key]) {
                        const startIso = startRaw ? new Date(startRaw).toISOString() : new Date(`${date}T00:00:00`).toISOString();
                        const endIso = endRaw ? new Date(endRaw).toISOString() : null;
                        const existing = day.sessions.find(s => s.id === sessIdCsv);
                        sess = existing || { id: sessIdCsv || `import_${key}_${i}`, start: startIso, end: endIso, counts: {}, notes: cols[idx.notes] || 'CSV import', photos: [], routeName: cols[idx.route] || 'CSV import', weather: null, determinations: [] };
                        if(!existing) day.sessions.push(sess);
                        importSessions[key] = sess;
                    } else {
                        sess = importSessions[key];
                    }
                    sessionsSeen[date] = true;
                }
                // fallback dagtotaal verzamelen, pas later toepassen
                if(!isSessionRow) {
                    if(!fallbackCounts[date]) fallbackCounts[date] = {};
                    const route = cols[idx.route] || '';
                    const notes = cols[idx.notes] || '';
                    const wt = idx.wt>=0 ? parseFloat(cols[idx.wt].replace(',','.')) : null;
                    const wc = idx.wc>=0 ? parseInt(cols[idx.wc]) : null;
                    if(!fallbackMeta[date]) fallbackMeta[date] = { route, notes, wt, wc };
                }
                if(idx.wt >=0 || idx.wc >=0) {
                    const wt = idx.wt>=0 ? parseFloat(cols[idx.wt].replace(',','.')) : null;
                    const wc = idx.wc>=0 ? parseInt(cols[idx.wc]) : null;
                    if(sess) {
                        if(!sess.weather && (wt || wc)) {
                            sess.weather = { t: wt ?? 0, c: isFinite(wc)? wc : 0, ts: Date.now() };
                            day.weather = day.weather || sess.weather;
                        }
                    } else {
                        // day-row: bewaar in fallbackMeta zodat we het later kunnen toepassen
                        const fm = fallbackMeta[date] || {};
                        if(wt !== null) fm.wt = wt;
                        if(wc !== null && isFinite(wc)) fm.wc = wc;
                        fallbackMeta[date] = fm;
                    }
                }

                let species = SPECIES.find(s => s.name.toLowerCase() === speciesName.toLowerCase());
                if(!species) {
                    species = day.custom.find(c => c.name.toLowerCase() === speciesName.toLowerCase());
                    if(!species) {
                        species = { id: 'c_'+Date.now()+Math.random().toString(16).slice(2), name: speciesName, color: 'gray', hasAmplexus: true };
                        day.custom.push(species);
                    }
                }
                const counts = day.counts;
                const addVal = (field, val, targetCounts) => {
                    if(isNaN(val)) return;
                    const key = `${species.id}_${field}`;
                    targetCounts[key] = (targetCounts[key]||0) + val;
                };
                const num = k => {
                    const v = idx[k] >=0 ? parseFloat(cols[idx[k]].replace(',','.')) : 0;
                    return isFinite(v) ? v : 0;
                };
                if(isSessionRow) {
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
                if(sessionsSeen[d]) {
                    recalcDayFromSessions(day);
                } else if(fallbackCounts[d]) {
                    day.counts = fallbackCounts[d];
                    const meta = fallbackMeta[d] || {};
                    // maak een dag-importsessie zodat log iets toont
                    const startIso = new Date(`${d}T00:00:00`).toISOString();
                    const endIso = new Date(`${d}T23:59:00`).toISOString();
                    day.sessions.push({ id:`import_${d}_day`, start:startIso, end:endIso, counts:{...fallbackCounts[d]}, notes: meta.notes||'', photos: [], routeName: meta.route||'', weather: (meta.wt||meta.wc) ? {t:meta.wt||0, c:meta.wc||0, ts:Date.now()} : null, determinations: [] });
                }
            });
            purgeEmptyCustomSpecies();
            return { added, days };
        }

        function describeSync(incoming) {
            const label = {
                p_l: '❤️ koppels', p_d: '☠️ koppels', m_l: 'm levend', v_l: 'v levend', o_l: 'o levend',
                m_d: 'm dood',   v_d: 'v dood',   o_d: 'o dood'
            };
            const nameFor = id => {
                const base = SPECIES.find(s => s.id === id);
                if(base) return base.name;
                const inc = (incoming.s || []).find(s => s.id === id);
                return inc ? inc.name : id;
            };

            const perSpecies = {};
            for(const k in incoming.c || {}) {
                const [sid, suf] = k.split('_');
                if(!perSpecies[sid]) perSpecies[sid] = [];
                perSpecies[sid].push(`${incoming.c[k]} × ${label[suf] || suf}`);
            }

            const lines = Object.entries(perSpecies).map(([sid, items]) => `- ${nameFor(sid)}: ${items.join(', ')}`);

            const existingCustom = (storage[incoming.d]?.custom) || [];
            const newCustom = (incoming.s || []).filter(s => !existingCustom.some(c => c.name === s.name));
            if(newCustom.length) lines.push(`+ Nieuwe soorten: ${newCustom.map(s => s.name).join(', ')}`);

            return lines.length ? `Toegevoegd op ${incoming.d}:\n${lines.join('\n')}` : 'Geen teldata ontvangen.';
        }

        function startScanner() {
            const sc = new Html5Qrcode("reader");
            sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, t => {
                try {
                    const i = JSON.parse(t);
                    const summary = describeSync(i);
                    const day = ensureDay(i.d);
                    for(let k in i.c) day.counts[k] = (day.counts[k] || 0) + i.c[k];
                    (i.s||[]).forEach(si => { if(!day.custom.some(c => c.name===si.name)) day.custom.push(si); });
                    save(); buildUI(); render(); sc.stop(); alert(summary); showToast("Partner gesynct!"); switchTab('count');
                } catch(e) { alert("QR fout"); }
            }).catch(() => alert("Camera fout"));
        }

        function startSessionScanner() {
            const modal = document.getElementById('qr-modal');
            modal.classList.remove('hidden');
            const targetId = 'session-reader-modal';
            if(sessionScanner) { sessionScanner.stop().catch(()=>{}); sessionScanner = null; }
            sessionScanner = new Html5Qrcode(targetId);
            sessionScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, t => {
                try {
                    const i = JSON.parse(t);
                    const summary = describeSync(i);
                    const day = ensureDay(i.d);
                    const targetSessionId = document.getElementById('import-target-select')?.value || '';
                    for(let k in i.c) day.counts[k] = (day.counts[k] || 0) + i.c[k];
                    if(targetSessionId) {
                        const ts = day.sessions.find(s => s.id === targetSessionId);
                        if(ts) {
                            for(let k in i.c) ts.counts[k] = (ts.counts[k] || 0) + i.c[k];
                        }
                    }
                    (i.s||[]).forEach(si => { if(!day.custom.some(c => c.name===si.name)) day.custom.push(si); });
                    save(); buildUI(); render(); stopSessionScanner(); alert(summary); showToast("Sessies geïmporteerd"); switchTab('sessions');
                } catch(e) { alert("QR fout"); }
            }).catch(() => alert("Camera fout"));
        }

        function stopSessionScanner() {
            if(sessionScanner) {
                sessionScanner.stop().catch(()=>{}).finally(()=> sessionScanner = null);
            }
        }

        function closeQrModal(ev) {
            const modal = document.getElementById('qr-modal');
            if(ev.target.id === 'qr-modal' || ev.target.tagName === 'BUTTON') {
                stopSessionScanner();
                modal.classList.add('hidden');
                document.getElementById('session-reader-modal').innerHTML = '';
            }
        }

        function buildImportTargetOptions() {
            const sel = document.getElementById('import-target-select');
            const hint = document.getElementById('import-target-hint');
            if(!sel || !hint) return;
            const day = ensureDay();
            const sessions = day.sessions.slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
            sel.innerHTML = `<option value=\"\">Dag ${picker.value} (dagtotaal)</option>` +
                sessions.map(s => `<option value="${s.id}">${fmtTime(s.start)} ${s.end ? '– '+fmtTime(s.end) : '(live)'}</option>`).join('');
            sel.value = '';
            updateImportTargetHint();
        }

        function updateImportTargetHint() {
            const sel = document.getElementById('import-target-select');
            const hint = document.getElementById('import-target-hint');
            if(!sel || !hint) return;
            const val = sel.value;
            if(!val) {
                hint.innerText = `Tellen uit de QR worden bij het dagtotaal van ${picker.value} opgeteld.`;
            } else {
                hint.innerText = `Tellen uit de QR worden bijgeteld in sessie ${sel.selectedOptions[0].textContent}.`;
            }
        }

        function switchTab(t) {
            document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
            const view = document.getElementById('view-' + t);
            if(view) view.classList.remove('hidden');
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-tab'));
            const tab = document.getElementById('tab-' + t);
            if(tab) tab.classList.add('active-tab');
            if(t==='report') { buildReportSessionOptions(); updateReport(); }
            if(t==='sessions') { renderSessionLog(); }
            if(t==='settings') {
                const sd = document.getElementById('sessionDate');
                if(sd) sd.value = picker.value;
                const pd = document.getElementById('photo-clean-date');
                if(pd) pd.value = picker.value;
                renderSessionAdmin();
                buildQRSessionOptions();
                buildImportTargetOptions();
                generateQR();
                renderStorageInspector(true);
            }
            if(t==='help') {
                renderDetSessionOptions();
                renderDeterminationUI();
                renderDeterminationList();
            }
        }

        function resetCurrentDate() { if(confirm("Alles wissen voor vandaag?")) { delete storage[picker.value]; save(); buildUI(); render(); } }

        picker.onchange = () => { buildUI(); render(); buildQRSessionOptions(); buildReportSessionOptions(); renderSessionAdmin(); };
        document.getElementById('sessionDate').onchange = () => renderSessionAdmin();
        splitSessionOverMidnightIfNeeded();
        buildUI(); render(); renderSessionAdmin(); buildQRSessionOptions(); buildReportSessionOptions(); renderDetSessionOptions(); renderDeterminationUI(); renderDeterminationList();
    