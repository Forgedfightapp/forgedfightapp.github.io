/* Forged — For the fight. Training log for combat sports, weights, cardio and mobility
   Vanilla JS, no dependencies. Data lives in localStorage on this device. */
(() => {
'use strict';

const STORE_KEY = 'dm.bjj.v1';
const APP_VERSION = '3.17.1';

const SUBMISSIONS = ['Rear naked choke','Armbar','Triangle','Kimura','Guillotine','Americana','Darce','Anaconda','Arm triangle','Ezekiel','Bow and arrow','Cross collar choke','Loop choke','Baseball bat choke','North-south choke','Omoplata','Straight ankle lock','Heel hook','Kneebar','Toe hold','Calf slicer','Wrist lock','Gogoplata','Paper cutter','Clock choke','Von Flue choke','Banana split','Estima lock'];
const POSITIONS = ['Bottom side control','Bottom mount','Back taken','Turtle','Bottom half guard','Closed guard (bottom)','Stuck in closed guard','Knee on belly','North-south bottom','Can\'t pass half guard','Can\'t pass De La Riva','Can\'t pass butterfly','Leg entanglement','Front headlock','Getting stalled','Guard pulled on me'];
const TECHNIQUES = ['Scissor sweep','Hip bump sweep','Flower sweep','Butterfly sweep','Knee slice pass','Toreando pass','Over-under pass','Stack pass','Leg drag','Elbow-knee escape','Bridge and roll','Back take from turtle','Seatbelt control','Arm drag','Double leg','Single leg','Hip escape (shrimp)','Technical stand-up','Collar drag','De La Riva entry','X-guard sweep','Berimbolo','Mount maintenance','Side control transitions','Guard retention','Kimura trap','Body triangle','Ashi garami entry'];
const SESSION_TYPES = [['class','Class'],['open','Open mat'],['pads','Pad work'],['private','Private'],['comp','Competition'],['seminar','Seminar'],['other','Other']];
/* 3.1.0: Grappling keeps Open mat; Striking and MMA use Pad work instead (stored 'open' maps to 'pads' there) */
const typesFor = c => c === 'striking' || c === 'mma' ? SESSION_TYPES.filter(t => t[0] !== 'open') : SESSION_TYPES.filter(t => t[0] !== 'pads');
const fixType = (c, t) => (c === 'striking' || c === 'mma') ? (t === 'open' ? 'pads' : t) : (t === 'pads' ? 'class' : t);
/* 'drill' (Drilling) was removed in 3.1.0. Old sessions keep the stored value and are shown (and edited) as Class. */
const LEGACY_TYPES = ['drill'];
const BELTS = [['white','White','#f1f1f1'],['blue','Blue','#2563eb'],['purple','Purple','#7c3aed'],['brown','Brown','#7b4a26'],['black','Black','#151515'],
  ['grey','Grey','#9ca3af'],['yellow','Yellow','#facc15'],['orange','Orange','#f97316'],['green','Green','#16a34a'],['red','Red','#dc2626']];
const ADULT_BELTS = ['white','blue','purple','brown','black'], KIDS_BELTS = ['grey','yellow','orange','green'];
/* 3.4.0: rank systems per art. Events without an art are BJJ (existing data is unchanged). sub(belt) = stripes/degrees/dan at that belt, or null.
   Colour orders follow common systems; clubs and federations vary, so every colour is pickable. */
const dan = to => b => b === 'black' ? { word:'dan', from:2, to } : null;
const BELT_ARTS = {
  bjj:{ label:'BJJ', cat:'grappling', noun:'belt', belts:ADULT_BELTS, kids:KIDS_BELTS, sub:b => b === 'black' ? { word:'degree', from:1, to:6 } : { word:'stripe', from:1, to:4 }, tint:'#D7261E' },
  judo:{ label:'Judo', cat:'grappling', noun:'belt', belts:['white','yellow','orange','green','blue','brown','black'], kyu:{ white:'6th kyu', yellow:'5th kyu', orange:'4th kyu', green:'3rd kyu', blue:'2nd kyu', brown:'1st kyu', black:'1st dan' }, sub:dan(10), tint:'#3b82f6' },
  sambo:{ label:'Sambo', cat:'grappling', noun:'belt', belts:['white','yellow','orange','green','blue','brown','black'], sub:dan(10), tint:'#dc2626' },
  karate:{ label:'Karate', cat:'striking', noun:'belt', belts:['white','yellow','orange','green','blue','purple','brown','black'], sub:dan(10), tint:'#e5e7eb' },
  taekwondo:{ label:'Taekwondo', cat:'striking', noun:'belt', belts:['white','yellow','green','blue','red','black'], sub:dan(9), tint:'#2563eb' },
  muaythai:{ label:'Muay Thai', cat:'striking', noun:'prajied', belts:['white','yellow','orange','green','blue','purple','brown','red','black'], sub:() => null, tint:'#F5C542' } };
const ART_KEYS = Object.keys(BELT_ARTS);
const artOf = e => (e && BELT_ARTS[e.art]) ? e.art : 'bjj';
const artBelts = art => { const A = BELT_ARTS[art] || BELT_ARTS.bjj; return A.belts.concat(A.kids || []); };
const cap = w => w ? w[0].toUpperCase() + w.slice(1) : w;
const ordN = n => `${n}${(n % 100 > 10 && n % 100 < 14) ? 'th' : ['th','st','nd','rd'][n % 10] || 'th'}`;
const INTENSITY = ['', 'Light','Easy','Moderate','Hard','All-out'];

/* ---------------- storage ---------------- */
const SCHEMA = 8;
const defaultProfile = () => ({ name:'', belt:'white', stripes:0, promotedOn:'', unit:'lb', distUnit:'mi', sampleProfile:false, setupDone:false, schedule:{}, challengeTarget:8,
  enabled:{ grappling:true, striking:false, mma:false, weights:false, cardio:false, mobility:false } });
const emptyDb = () => ({ schema:SCHEMA, sessions:[], profile:defaultProfile(), weights:[], belts:[], comps:[], benchmarks:[], strength:[], game:sanitizeGame(null), reps:[], injuries:[], challenges:[], program:null });
/* 2.3.0 archived striking sessions (archive.striking); 3.0.0 brings striking back, so they return to the normal session
   list unchanged. Old striking sessions whose style was "MMA" become the new MMA category (all their data kept). */
function dropArchive(d, k){ if (!d.archive) return; delete d.archive[k]; if (!Object.keys(d.archive).length) delete d.archive; }
function unarchiveStriking(d){ const ar = Array.isArray(d.archive?.striking) ? d.archive.striking : []; if (!ar.length) { dropArchive(d, 'striking'); return 0; }
  const ids = new Set((d.sessions||[]).map(s => s && s.id));
  const back = ar.filter(s => s && !ids.has(s.id)).map(s => s.discipline === 'mma' ? { ...s, category:'mma' } : s);
  d.sessions = (d.sessions||[]).concat(back); dropArchive(d, 'striking'); return back.length; }
/* 3.1.0 removed supplement tracking. Real (non-sample) supplement data is kept unchanged in archive.supps: stored, exported, re-imported, never shown. */
function archiveSupps(d){
  const s = d.supps; delete d.supps; if (!s || typeof s !== 'object') return 0;
  const items = (Array.isArray(s.items) ? s.items : []).filter(i => i && !i.sample), ids = new Set(items.map(i => String(i.id)));
  const log = (Array.isArray(s.log) ? s.log : []).filter(l => l && !l.sample && ids.has(String(l.itemId)));
  if (!items.length && !log.length) return 0;
  const prev = d.archive?.supps, merge = (a, b) => { const seen = new Set(a.map(x => String(x.id))); return a.concat(b.filter(x => !seen.has(String(x.id)))); };
  d.archive = { ...(d.archive||{}), supps: prev ? { items:merge(prev.items||[], items), log:merge(prev.log||[], log) } : { items, log } };
  return items.length;
}
const rpeFromIntensity = i => Math.min(5, Math.max(1, Math.round(Number(i)||3))) * 2; // 1->2, 2->4, 3->6, 4->8, 5->10
/* monthly challenge history: months (before the current one) where the workout count reached the target */
function challengeMonths(sessions, target, uptoMonth, sampleOnly){
  const m = new Map(); (sessions||[]).forEach(s => { if (!s || typeof s.date !== 'string' || (sampleOnly != null && !!s.sample !== sampleOnly)) return; const k = s.date.slice(0,7); m.set(k, (m.get(k)||0) + 1); });
  return [...m.entries()].filter(([k, n]) => k < uptoMonth && n >= target).sort((a,b) => a[0].localeCompare(b[0])).map(([month, n]) => ({ month, n, target }));
}
/* 3.18.0: data from removed features is archived, not deleted */
function archiveV317(d){
  const p = d.profile || {}, ar = { ...(d.archive?.v317 || {}) }, real = a => (Array.isArray(a) ? a : []).filter(x => x && !x.sample);
  const n = d.nutrition || {}, ent = real(n.entries), foods = real(n.foods), water = real(n.water);
  if (ent.length || foods.length || water.length) ar.nutrition = { entries:ent, foods, water };
  const pk = ['goalWeight','startWeight','goalDate','maintainW','weightMode','wplan','targets','calc','waterGoal','maxHR','tips','marks'].filter(k => p[k] != null && p[k] !== '');
  if (pk.length) ar.profile = Object.fromEntries(pk.map(k => [k, p[k]]));
  if (d.game && (d.game.rankSeen != null || d.game.seenMedals)) ar.game = d.game;
  delete d.nutrition; pk.concat(['setupDone']).forEach(k => k !== 'setupDone' && delete p[k]);
  if (p.enabled) { delete p.enabled.food; delete p.enabled.weight; delete p.enabled.supps; }
  (d.sessions||[]).forEach(s => { if (s && s.category === 'mobility' && ['sauna','steam'].includes(s.discipline)) { s.notes = [s.discipline === 'sauna' ? 'Sauna' : 'Steam', s.notes].filter(Boolean).join(' · '); s.discipline = 'recovery'; } });
  if (Object.keys(ar).length) d.archive = { ...(d.archive||{}), v317:ar };
}
function migrate(d){
  let v = Number(d.schema) || 1;
  if (v < 2) {
    try { if (!localStorage.getItem(STORE_KEY + '.backup.v1')) localStorage.setItem(STORE_KEY + '.backup.v1', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); }
    d.sessions = (d.sessions||[]).map(s => ({ ...s, category:s.category || 'grappling', discipline:s.discipline || 'bjj' }));
    const had = d.sessions.length || d.nutrition?.entries?.length || d.supps?.items?.length;
    d.profile = { ...(d.profile||{}), setupDone: d.profile?.setupDone ?? !!had, enabled:{ grappling:true, striking:false, weights:false, cardio:false, food:true, supps:true, ...(d.profile?.enabled||{}) } };
    v = 2;
  }
  if (v < 3) { // v3: dated weigh-ins + weight goal (start/goal/date). Nothing existing changes.
    if (v === 2) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v2')) localStorage.setItem(STORE_KEY + '.backup.v2', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    d.weights = Array.isArray(d.weights) ? d.weights : [];
    const hadW = !!d.profile?.goalWeight || (d.sessions||[]).some(s => s.weight !== '' && s.weight != null);
    d.profile = { ...(d.profile||{}), enabled:{ ...(d.profile?.enabled||{}), weight: d.profile?.enabled?.weight ?? hadW } };
    v = 3;
  }
  if (v < 4) { // v4: belt/stripe promotion history. The old single belt setting becomes the first entry.
    if (v === 3) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v3')) localStorage.setItem(STORE_KEY + '.backup.v3', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    const pr = d.profile || {};
    if (!Array.isArray(d.belts)) {
      d.belts = [];
      const belt = BELTS.some(b => b[0] === pr.belt) ? pr.belt : 'white', st = Math.max(0, Math.min(6, Number(pr.stripes) || 0));
      if (pr.promotedOn || belt !== 'white' || st > 0)
        d.belts.push({ id:'mig-' + (pr.promotedOn || 'nodate'), date: /^\d{4}-\d{2}-\d{2}$/.test(pr.promotedOn||'') ? pr.promotedOn : new Date().toISOString().slice(0,10), belt, stripes:st,
          instructor:'', academy:'', notes: pr.promotedOn ? '' : 'Date unknown (moved from the old belt setting). Tap to set it.', createdAt:1, ...(pr.sampleProfile ? { sample:true } : {}) });
    }
    v = 4;
  }
  if (v < 5) { // v5 (2.3.0) archived striking sessions; nothing to do on the way to v6
    if (v === 4) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v4')) localStorage.setItem(STORE_KEY + '.backup.v4', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    v = 5;
  }
  if (v < 6) { // v6 (3.0.0): Grappling/Striking/MMA/Weights/Cardio/Mobility. Archived striking sessions come back.
    if (v === 5) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v5')) localStorage.setItem(STORE_KEY + '.backup.v5', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    unarchiveStriking(d);
    // show the categories that now have sessions (e.g. un-archived striking); new ones default off
    const en = { ...(d.profile?.enabled||{}) }, has = c => (d.sessions||[]).some(s => s && s.category === c);
    ['striking','mma','mobility'].forEach(c => { en[c] = has(c) || !!en[c]; });
    if (d.profile) d.profile = { ...d.profile, enabled:en };
    v = 6;
  }
  if (v < 7) { // v7 (3.1.0): effort RPE 1-10 (from intensity 1-5, which is kept), feel, schedule, comps, benchmarks, injuries, monthly challenge, programs
    if (v === 6) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v6')) localStorage.setItem(STORE_KEY + '.backup.v6', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    d.sessions = (d.sessions||[]).map(s => s && (s.rpe == null || s.rpe === '') ? { ...s, rpe:rpeFromIntensity(s.intensity) } : s);
    ['comps','benchmarks','injuries'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!Array.isArray(d.challenges)) d.challenges = challengeMonths(d.sessions, 8, new Date().toISOString().slice(0,7), false);
    v = 7;
  }
  if (v < 8) { // v8 (3.18.0): food, water, weight goals, XP/medals removed. Real data moves to archive.v317 (kept in backups, never shown); sauna/steam logs become Recovery.
    if (v === 7) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v7')) localStorage.setItem(STORE_KEY + '.backup.v7', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    archiveV317(d); v = 8;
  }
  unarchiveStriking(d); // safety net: never leave archived sessions hidden
  archiveSupps(d);      // supplements are archived (hidden) from 3.1.0 on
  (d.sessions||[]).forEach(s => { if (s && s.type) s.type = fixType(s.category, s.type); });   // Striking/MMA Open mat → Pad work
  d.schema = v; return d;
}
function load(){
  try{
    let d = JSON.parse(lastRaw = localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.sessions)) { const before = d.schema, oldBelts = (d.belts||[]).some(x => x && !x.kind); d = migrate(d); if (before !== d.schema || oldBelts) setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch(e){} }, 0);
      return { schema:d.schema, sessions:d.sessions, profile:{...defaultProfile(), ...(d.profile||{})}, weights:sanitizeWeights(d.weights), belts:sanitizeBelts(d.belts), ...extrasOf(d) }; }
  }catch(e){ console.warn('Could not read saved data', e);
    // never silently lose data: keep the unreadable copy before starting fresh
    try { const raw = localStorage.getItem(STORE_KEY); if (raw && !localStorage.getItem(STORE_KEY + '.unreadable')) localStorage.setItem(STORE_KEY + '.unreadable', raw); } catch(_) {} }
  return emptyDb();
}
let db; // loaded just before the first render (after every helper is defined)
let lastRaw = null; // what this tab last read/wrote, so background saves never clobber changes made elsewhere
const saveDb = () => save();
function save(){
  try { localStorage.setItem(STORE_KEY, lastRaw = JSON.stringify(db)); }
  catch(e){ toast('Storage full or unavailable'); console.warn(e); }
  if (window.ForgedSync) window.ForgedSync.emit('db.saved', null);   // signed in: queues a summary sync (3.4.0)
}

/* ---------------- utils ---------------- */
const $ = (s, r=document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay()+6)%7; return addDays(x, -wd); };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtDate = s => { const d = parse(s); return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const fmtShort = s => { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const hrs = min => { const h = min/60; return h >= 10 ? Math.round(h) : Math.round(h*10)/10; };
const typeLabel = t => LEGACY_TYPES.includes(t) ? 'Class' : (SESSION_TYPES.find(x => x[0]===t)||[,'Session'])[1];
const sorted = () => [...db.sessions].sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt||0)-(a.createdAt||0));
const unit = () => db.profile.unit || 'lb';
function countBy(list){ const m = new Map(); list.forEach(x => { const k = x.trim(); if (k) m.set(k, (m.get(k)||0)+1); }); return [...m.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])); }
function uniqueMerge(...lists){ const seen = new Set(), out = []; lists.flat().forEach(x => { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(x); } }); return out; }
const allRolls = () => db.sessions.flatMap(s => (s.rolls||[]).map(r => ({...r, session:s})));
const usedTechniques = () => countBy(db.sessions.flatMap(s => s.techniques||[])).map(x => x[0]);
const usedSubs = () => countBy(allRolls().flatMap(r => [...(r.subsLanded||[]), ...(r.subsTapped||[])])).map(x => x[0]);
const usedPositions = () => countBy(allRolls().flatMap(r => r.stuck||[])).map(x => x[0]);
const usedPartners = () => countBy(allRolls().map(r => r.partner||'')).map(x => x[0]);

let toastTimer;
function toast(msg){ clearTimeout(chUndoTimer); chUndo = []; const t = $("#toast"); t.textContent = msg; t.classList.remove('act'); t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

function h(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/* ---------------- bottom sheet + in-app history ----------------
   Opening a sheet pushes a history entry so the iOS/browser back gesture closes it (popstate).
   Closing it in-app pops that entry again; navigation requested meanwhile waits for the pop. */
let sheetHist = false, popPending = false;
const afterPop = [];
function whenSettled(fn){ if (!popPending) return fn(); afterPop.push(fn); setTimeout(() => { const i = afterPop.indexOf(fn); if (i >= 0) { afterPop.splice(i, 1); fn(); } }, 1500); }   // never wait forever on a lost popstate
function openSheet(content, onClose, opts={}){
  const sheet = $('#sheet');
  const wasOpen = !sheet.hidden;
  sheet.innerHTML = '';
  const lbl = opts.closeLabel || 'Close';
  const panel = h(`<div class="panel" role="dialog" aria-modal="true"><div class="sheethead">${opts.noClose ? '<span></span>' : `<button type="button" class="backbtn" data-close aria-label="${esc(lbl)}"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><span>${esc(lbl)}</span></button>`}<div class="grab"></div><span></span></div></div>`);
  panel.appendChild(content);
  sheet.appendChild(panel);
  sheet.hidden = false;
  document.body.style.overflow = 'hidden'; document.body.classList.add('sheet-open');
  sheet.onclick = e => { if (e.target === sheet) closeSheet(); };
  const cb = panel.querySelector('[data-close]'); if (cb) cb.onclick = () => closeSheet();
  sheet._onClose = onClose;
  swipeToClose(panel);
  if (!wasOpen && !sheetHist && !popPending) { history.pushState({ ...(history.state||{}), sheet:true }, ''); sheetHist = true; }
}
function closeSheet(opts={}){
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.hidden = true; sheet.innerHTML = ''; document.body.style.overflow = ''; document.body.classList.remove('sheet-open');
  if (sheetHist) { sheetHist = false; if (!opts.fromPop && !opts.noHistory) { popPending = true; history.back(); } }
  const cb = sheet._onClose; sheet._onClose = null; cb && cb();
}
function swipeToClose(panel){
  let y0 = null, dy = 0;
  panel.addEventListener('touchstart', e => { if (panel.scrollTop > 0 || e.target.closest('input,textarea,select')) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive:true });
  panel.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { panel.style.transition = 'none'; panel.style.transform = `translateY(${dy}px)`; } }, { passive:true });
  panel.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; panel.style.transition = 'transform .18s'; if (dy > 110) closeSheet(); else panel.style.transform = ''; });
}
window.addEventListener('popstate', () => {
  if (popPending) {
    popPending = false;
    if (!$('#sheet').hidden && !sheetHist) { history.pushState({ ...(history.state||{}), sheet:true }, ''); sheetHist = true; }
    afterPop.splice(0).forEach(fn => fn());
    return;
  }
  if (!$('#sheet').hidden) closeSheet({ fromPop:true });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
/* navigate to a hash (re-renders when it is already the current one) */
function go(hash){ whenSettled(() => { const cur = location.hash || '#/'; if (cur === hash || (hash === '#/' && cur === '#')) route(); else location.hash = hash; }); }
function confirmSheet(title, body, okLabel='Delete', danger=true){
  return new Promise(resolve => {
    let result = false;
    const el = h(`<div><h3>${esc(title)}</h3><p style="color:var(--muted);margin:-6px 0 20px">${esc(body)}</p>
      <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn block ${danger?'danger':'primary'}" data-ok>${esc(okLabel)}</button>
      <button class="btn block ghost" data-cancel>Cancel</button></div></div>`);
    el.querySelector('[data-ok]').onclick = () => { result = true; closeSheet(); };
    el.querySelector('[data-cancel]').onclick = () => closeSheet();
    openSheet(el, () => resolve(result), { noClose:true });
  });
}

/* ---------------- tag input component ---------------- */
function tagField({ values, suggestions, placeholder, kind='', onChange }){
  const wrap = h(`<div><div class="tags"></div><div class="sugg"></div></div>`);
  const box = wrap.querySelector('.tags'), sugg = wrap.querySelector('.sugg');
  const input = h(`<input type="text" enterkeyhint="done" autocapitalize="words" autocomplete="off" placeholder="${esc(placeholder)}">`);
  const add = v => { v = v.trim().replace(/\s+/g,' '); if (!v) return; if (!values.some(x => x.toLowerCase()===v.toLowerCase())) { values.push(v); onChange && onChange(values); } input.value=''; draw(); input.focus(); };
  function draw(){
    box.innerHTML = '';
    values.forEach((v,i) => {
      const c = h(`<span class="chip ${kind}">${esc(v)}<button type="button" aria-label="Remove ${esc(v)}">×</button></span>`);
      c.querySelector('button').onclick = () => { values.splice(i,1); onChange && onChange(values); draw(); };
      box.appendChild(c);
    });
    box.appendChild(input);
    drawSugg();
  }
  function drawSugg(){
    const q = input.value.trim().toLowerCase();
    const list = suggestions().filter(s => !values.some(v => v.toLowerCase()===s.toLowerCase()) && (!q || s.toLowerCase().includes(q)))
      .sort((a,b) => q ? (a.toLowerCase().startsWith(q)?0:1) - (b.toLowerCase().startsWith(q)?0:1) : 0).slice(0,14);
    sugg.innerHTML = '';
    if (q && !list.some(s => s.toLowerCase()===q)) {
      const b = h(`<button type="button" style="border-style:solid;color:var(--accent)">+ Add “${esc(input.value.trim())}”</button>`);
      b.onclick = () => add(input.value); sugg.appendChild(b);
    }
    list.forEach(s => { const b = h(`<button type="button">${esc(s)}</button>`); b.onclick = () => add(s); sugg.appendChild(b); });
  }
  input.addEventListener('input', () => { if (input.value.includes(',')) { input.value.split(',').forEach(add); } else drawSugg(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); add(input.value); }
    else if (e.key === 'Backspace' && !input.value && values.length) { values.pop(); onChange && onChange(values); draw(); }
  });
  // Commit typed text on blur, but defer so tapping a suggestion (which also blurs the input) wins.
  input.addEventListener('blur', () => setTimeout(() => { if (input.value.trim() && document.activeElement !== input) { const v = input.value; input.value = ''; values.some(x => x.toLowerCase()===v.trim().toLowerCase()) || (values.push(v.trim().replace(/\s+/g,' ')), onChange && onChange(values)); draw(); } }, 180));
  sugg.addEventListener('mousedown', e => e.preventDefault());
  box.addEventListener('click', e => { if (e.target === box) input.focus(); });
  draw();
  return wrap;
}

function stepper(value, { step=1, min=0, max=999, unitLabel='', onChange }){
  const el = h(`<div class="stepper"><button type="button" aria-label="Decrease">−</button><input type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}"><span class="unit">${esc(unitLabel)}</span><button type="button" aria-label="Increase">+</button></div>`);
  const [dec, inc] = el.querySelectorAll('button'); const inp = el.querySelector('input');
  const set = v => { v = Math.max(min, Math.min(max, Math.round(Number(v)||0))); inp.value = v; onChange(v); };
  dec.onclick = () => set(Number(inp.value) - step);
  inc.onclick = () => set(Number(inp.value) + step);
  inp.onchange = () => set(inp.value);
  return el;
}
function seg(options, value, onChange, wrap=false){
  const el = h(`<div class="seg ${wrap?'wrap':''}" role="radiogroup"></div>`);
  options.forEach(([v,l]) => {
    const b = h(`<button type="button" role="radio">${esc(l)}</button>`);
    const sync = () => el.querySelectorAll('button').forEach((x,i) => { x.classList.toggle('on', options[i][0]===value); x.setAttribute('aria-checked', options[i][0]===value); });
    b.onclick = () => { value = v; sync(); onChange(v); };
    el.appendChild(b);
    queueMicrotask(sync);
  });
  return el;
}
const field = (label, control, hint) => { const f = h(`<div class="field"><label>${esc(label)}</label></div>`); f.appendChild(control); if (hint) f.appendChild(h(`<div class="hint">${esc(hint)}</div>`)); return f; };

/* ---------------- stats ---------------- */
function weekStreak(){
  const weeks = new Set(db.sessions.map(s => iso(weekStart(parse(s.date)))));
  let w = weekStart(new Date());
  if (!weeks.has(iso(w))) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(iso(w))) { n++; w = addDays(w, -7); }
  return n;
}
function periodStats(){
  const now = new Date(), ws = iso(weekStart(now)), ms = iso(new Date(now.getFullYear(), now.getMonth(), 1)), t = today();
  const wk = db.sessions.filter(s => s.date >= ws && s.date <= t);
  const mo = db.sessions.filter(s => s.date >= ms && s.date <= t);
  const sum = l => l.reduce((a,s) => a + (Number(s.duration)||0), 0);
  return { week:wk.length, month:mo.length, weekMin:sum(wk), monthMin:sum(mo), totalMin:sum(db.sessions), total:db.sessions.length };
}
function weeklyHours(n=12){
  const start = weekStart(new Date());
  const weeks = Array.from({length:n}, (_,i) => { const d = addDays(start, -7*(n-1-i)); return { key:iso(d), date:d, min:0, n:0, cat:{} }; });
  const idx = new Map(weeks.map((w,i) => [w.key, i]));
  db.sessions.forEach(s => { const k = iso(weekStart(parse(s.date))); if (idx.has(k)) { const w = weeks[idx.get(k)], c = CATS[s.category] ? s.category : 'grappling'; w.min += Number(s.duration)||0; w.n++; w.cat[c] = (w.cat[c]||0) + (Number(s.duration)||0); } });
  return weeks;
}
/* ---------------- weight: weigh-ins + workout body weight, merged ---------------- */
const KG_PER_LB = 0.45359237;
const convW = (v, from, to) => from === to ? v : to === 'kg' ? v * KG_PER_LB : v / KG_PER_LB;
function sanitizeWeights(list){
  return (Array.isArray(list) ? list : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && Number(x.w) > 0)
    .map(x => ({ id:String(x.id || ('w' + Date.now().toString(36) + Math.random().toString(36).slice(2,8))), date:String(x.date), w:Math.round(Number(x.w)*10)/10, u:x.u === 'kg' ? 'kg' : 'lb', createdAt:Number(x.createdAt)||0, ...(x.sample ? { sample:true } : {}) }));
}
/* One point per day in the current unit: the most recently entered value that day, from a weigh-in or a workout. */
function weightSeries(){
  const m = new Map(), u = unit();
  db.sessions.forEach(s => { const w = Number(s.weight); if (s.weight === '' || s.weight == null || !(w > 0)) return;
    const cur = m.get(s.date); if (!cur || (s.createdAt||0) >= cur.t) m.set(s.date, { date:s.date, w, src:'workout', t:s.createdAt||0 }); });
  (db.weights||[]).forEach(x => { const cur = m.get(x.date); if (!cur || (x.createdAt||0) >= cur.t) m.set(x.date, { date:x.date, w:Math.round(convW(x.w, x.u||u, u)*10)/10, src:'weigh', t:x.createdAt||0, id:x.id }); });
  return [...m.values()].sort((a,b) => a.date.localeCompare(b.date));
}
/* Least-squares slope over the last `days` days of data, per week. Needs 3+ points over 6+ days. */
function weightTrend(ws, days=28){
  if (!ws.length) return null;
  const last = parse(ws[ws.length-1].date), from = iso(addDays(last, -days));
  const pts = ws.filter(p => p.date >= from); if (pts.length < 3) return null;
  const xs = pts.map(p => (parse(p.date) - last) / 864e5), ys = pts.map(p => p.w);
  const span = Math.max(...xs) - Math.min(...xs); if (span < 6) return null;
  const mx = xs.reduce((a,b) => a+b, 0)/xs.length, my = ys.reduce((a,b) => a+b, 0)/ys.length;
  const sxx = xs.reduce((a,x) => a + (x-mx)**2, 0), sxy = xs.reduce((a,x,i) => a + (x-mx)*(ys[i]-my), 0);
  return { perWeek: Math.round(sxy/sxx*7*100)/100, n: pts.length, days: Math.round(span) };
}
/* 3.18.0: body weight is a plain weigh-in, shown in Profile only */
function weighInCard(){
  const ws = weightSeries(), u = unit(), cur = ws.length ? ws[ws.length-1] : null;
  const log = (db.weights||[]).slice().sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 3);
  return `<div class="card" id="weightCard"><h2>Body weight</h2>
    ${cur ? `<div class="wnow"><b data-w="current">${cur.w}<small> ${u}</small></b><span>Last weigh-in · ${fmtShort(cur.date)}</span></div>` : '<div class="empty" style="padding:2px 0 6px">No weigh-ins yet.</div>'}
    ${log.map(x => `<div class="list-row wrow"><div class="grow"><b>${Math.round(convW(x.w, x.u, u)*10)/10} ${u}</b><small>${fmtShort(x.date)}</small></div><button type="button" class="iconbtn" data-wdel="${x.id}" aria-label="Delete weigh-in">×</button></div>`).join('')}
    <button type="button" class="btn block" id="logWeight" style="margin-top:12px">Log weigh-in</button></div>`;
}
function wireWeight(root){
  root.querySelectorAll('#logWeight').forEach(b => b.onclick = logWeightSheet);
  root.querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => { const before = JSON.parse(JSON.stringify(db.weights)); db.weights = db.weights.filter(x => x.id !== b.dataset.wdel); save(); route(); undoToast('Weigh-in deleted', () => { db.weights = before; save(); route(); }); });
}
/* Log weight: one tap opens it prefilled with the last value, one tap saves. */
function logWeightSheet(){
  const u = unit(), ws = weightSeries(), g = { cur: ws.length ? ws[ws.length-1].w : null }, step = u === 'kg' ? 0.1 : 0.2;
  let val = g.cur ?? '';
  const el = h(`<div><h3>Log weight</h3>
    <div class="wstep"><button type="button" class="iconbtn big" aria-label="Decrease" data-dec>−</button><input class="input" id="wIn" type="text" inputmode="decimal" placeholder="${u === 'kg' ? '80.0' : '180.0'}" value="${esc(val)}" aria-label="Weight in ${u}"><span class="unit">${u}</span><button type="button" class="iconbtn big" aria-label="Increase" data-inc>+</button></div>
    <div class="field" style="margin-top:12px"><label>Date</label><input class="input" type="date" id="wDate" value="${today()}" max="${today()}"></div>
    <button type="button" class="btn primary block" id="wSave" style="margin-top:6px">Save weight</button></div>`);
  const inp = el.querySelector('#wIn'), dt = el.querySelector('#wDate');
  const bump = d => { const n = Number(inp.value) || Number(g.cur) || (u === 'kg' ? 80 : 180); inp.value = (Math.round((n + d)*10)/10).toFixed(1); };
  el.querySelector('[data-dec]').onclick = () => bump(-step); el.querySelector('[data-inc]').onclick = () => bump(step);
  el.querySelector('#wSave').onclick = () => {
    const w = Number(String(inp.value).replace(',', '.'));
    const lo = u === 'kg' ? 20 : 45, hi = u === 'kg' ? 400 : 900;
    if (!(w >= lo && w <= hi)) { toast(`Enter your weight in ${u}`); inp.focus(); return; }
    const date = dt.value || today(), prev = db.weights.find(x => x.date === date && !x.sample);
    const rec = { id:prev?.id || uid(), date, w:Math.round(w*10)/10, u, createdAt:Date.now() };
    const before = JSON.parse(JSON.stringify(db.weights));
    db.weights = db.weights.filter(x => x.date !== date || x.sample).concat(rec);
    if (!db.profile.enabled?.weight) db.profile.enabled = { ...(db.profile.enabled||{}), weight:true };
    save(); closeSheet();
    undoToast(`Logged ${rec.w} ${u}`, () => { db.weights = before; save(); route(); });
    whenSettled(route);
  };
  openSheet(el, null, { closeLabel:'Cancel' });
}

/* ---------------- charts (inline SVG) ---------------- */
function barChart(weeks){
  const W = 340, H = 150, pt = 18, pb = 22, pl = 4, pr = 4;
  const max = Math.max(1, ...weeks.map(w => w.min/60));
  const nice = Math.ceil(max);
  const bw = (W - pl - pr) / weeks.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly training hours, last ${weeks.length} weeks">`;
  for (let g = 0; g <= 2; g++) { const y = pt + (H-pt-pb) * g/2; s += `<line class="grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`; }
  weeks.forEach((w,i) => {
    const v = w.min/60, bh = (H-pt-pb) * v/nice, x = pl + i*bw + bw*0.18, y = H - pb - bh, cur = i === weeks.length-1;
    s += `<g class="wk" ${cur?'':'opacity=".6"'}>`;
    if (v === 0) s += `<rect class="bar dim" x="${x.toFixed(1)}" y="${(H-pb-3).toFixed(1)}" width="${(bw*0.64).toFixed(1)}" height="3" rx="1.5"/>`;
    else { let yy = H - pb; CAT_KEYS.forEach(c => { const m = w.cat[c]||0; if (!m) return; const hh = (H-pt-pb) * (m/60)/nice; yy -= hh; s += `<rect class="bar" x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw*0.64).toFixed(1)}" height="${hh.toFixed(1)}" style="fill:${CATS[c].color}"/>`; }); }
    s += '</g>';
    if (v > 0 && (cur || i % 2 === 1)) s += `<text x="${(x+bw*0.32).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" style="fill:${cur?'var(--accent)':'var(--muted)'}">${hrs(w.min)}</text>`;
    if (i % 3 === 2 || cur) s += `<text x="${(x+bw*0.32).toFixed(1)}" y="${H-6}" text-anchor="middle">${cur?'This wk':`${w.date.getMonth()+1}/${w.date.getDate()}`}</text>`;
  });
  return s + '</svg>';
}
function lineChart(series, goal){
  const W = 340, H = 160, pt = 14, pb = 22, pl = 30, pr = 8;
  const t0 = parse(series[0].date).getTime(), t1 = parse(series[series.length-1].date).getTime(), span = Math.max(1, t1-t0);
  const vals = series.map(p => p.w); if (goal) vals.push(goal);
  let lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const X = d => pl + (W-pl-pr) * (parse(d).getTime()-t0)/span;
  const Y = v => pt + (H-pt-pb) * (1 - (v-lo)/(hi-lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend"><defs><linearGradient id="wgrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#DC141F" stop-opacity=".28"/><stop offset="1" stop-color="#DC141F" stop-opacity="0"/></linearGradient></defs>`;
  [hi, (hi+lo)/2, lo].forEach(v => { const y = Y(v); s += `<line class="grid" x1="${pl}" x2="${W}" y1="${y}" y2="${y}"/><text x="${pl-6}" y="${y+3}" text-anchor="end">${Math.round(v)}</text>`; });
  if (goal) { const y = Y(goal); s += `<line class="goal" x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}"/><text x="${W-pr}" y="${y-5}" text-anchor="end" style="fill:#ffc43d">Goal ${goal}</text>`; }
  const pts = series.map(p => [X(p.date), Y(p.w)]);
  const path = pts.map((p,i) => `${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  if (pts.length > 1) s += `<path class="area" d="${path}L${pts[pts.length-1][0].toFixed(1)},${H-pb}L${pts[0][0].toFixed(1)},${H-pb}Z"/>`;
  s += `<path class="line" d="${path}"/>`;
  const last = pts[pts.length-1]; s += `<circle class="dot" cx="${last[0]}" cy="${last[1]}" r="4.5"/>`;
  s += `<text x="${pl}" y="${H-6}">${fmtShort(series[0].date).replace(/, \d{4}$/,'')}</text><text x="${W-pr}" y="${H-6}" text-anchor="end">${fmtShort(series[series.length-1].date).replace(/, \d{4}$/,'')}</text>`;
  return s + '</svg>';
}
function hbars(rows, cls){
  if (!rows.length) return `<div class="empty" style="padding:6px 0">None yet</div>`;
  const max = rows[0][1];
  return rows.map(([k,v]) => `<div class="hbar ${cls}"><div class="t"><span>${esc(k)}</span><span>${v}</span></div><div class="b"><i style="width:${Math.max(6, v/max*100)}%"></i></div></div>`).join('');
}
/* ---------------- belt & stripe promotion history ---------------- */
function beltOf(k){ return BELTS.find(x => x[0] === k) || BELTS[0]; }
function maxStripes(belt, art = 'bjj'){ const sb = (BELT_ARTS[art] || BELT_ARTS.bjj).sub(belt); return sb ? sb.to : 0; }
const subOf = (belt, art = 'bjj') => (BELT_ARTS[art] || BELT_ARTS.bjj).sub(belt);
/* 3.2.0: belt history is a list of dated events: kind 'belt' (belt earned, stripes reset to 0) or kind 'stripe' (stripe/degree n earned
   at that belt). Older entries were rank snapshots; they migrate here: same belt with a changed stripe count = stripe event, otherwise a
   belt event. A belt that starts with stripes already on it gets its belt event plus stripe events on the same date (marked approx). */
function sanitizeBelts(list){
  const all = (Array.isArray(list) ? list : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && (x.art && x.art !== 'bjj' ? BELT_ARTS[x.art] && BELT_ARTS[x.art].belts.includes(x.belt) : BELTS.some(b => b[0] === x.belt)));
  /* other arts are always stored as events (they're new in 3.4.0) */
  const arts = all.filter(x => x.art && x.art !== 'bjj').map(x => { const sb = subOf(x.belt, x.art), kind = x.kind === 'stripe' && sb ? 'stripe' : 'belt';
    return { id:String(x.id || ('b' + Date.now().toString(36) + Math.random().toString(36).slice(2,8))), art:x.art, date:String(x.date), belt:x.belt, kind,
      stripes:kind === 'stripe' ? Math.max(sb.from, Math.min(sb.to, Math.round(Number(x.stripes) || sb.from))) : 0,
      instructor:String(x.instructor||''), academy:String(x.academy||''), notes:String(x.notes||''), createdAt:Number(x.createdAt) || 0, ...(x.sample ? { sample:true } : {}) }; });
  return sanitizeBjjBelts(all.filter(x => !x.art || x.art === 'bjj')).concat(arts);
}
function sanitizeBjjBelts(list){
  const base = list
    .map(x => ({ id:String(x.id || ('b' + Date.now().toString(36) + Math.random().toString(36).slice(2,8))), date:String(x.date), belt:x.belt,
      stripes:Math.max(0, Math.min(maxStripes(x.belt), Math.round(Number(x.stripes) || 0))), ...(x.kind === 'belt' || x.kind === 'stripe' ? { kind:x.kind } : {}),
      instructor:String(x.instructor||''), academy:String(x.academy||''), notes:String(x.notes||''),
      createdAt:Number(x.createdAt) || 0, ...(x.approx ? { approx:true } : {}), ...(x.sample ? { sample:true } : {}) }));
  if (base.every(x => x.kind)) return base.map(x => x.kind === 'belt' ? { ...x, stripes:0 } : { ...x, stripes:Math.max(1, x.stripes) });
  const sorted = base.slice().sort((a,b) => a.date.localeCompare(b.date) || (a.createdAt||0) - (b.createdAt||0)), out = [];
  let prev = null;
  sorted.forEach(e => {
    if (e.kind) { out.push(e.kind === 'belt' ? { ...e, stripes:0 } : { ...e, stripes:Math.max(1, e.stripes) }); prev = e; return; }
    if (prev && prev.belt === e.belt) { if (e.stripes !== prev.stripes && e.stripes > 0) out.push({ ...e, kind:'stripe' }); else if (e.stripes !== prev.stripes) out.push({ ...e, kind:'belt' }); else out.push({ ...e, kind:'stripe', stripes:Math.max(1, e.stripes) }); }
    else { out.push({ ...e, kind:'belt', stripes:0 });
      for (let n = 1; n <= e.stripes; n++) out.push({ ...e, id:`${e.id}-s${n}`, kind:'stripe', stripes:n, approx:true, notes:'Stripe date not recorded. Tap to set it.', createdAt:(e.createdAt||0) + n / 10 }); }
    prev = e;
  });
  return out;
}
/* months added with the day clamped to the month's end (Jan 31 + 1 mo = Feb 28/29) */
function addMonthsClamp(d, n){ const y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(d.getDate(), last)); }
/* calendar difference a -> b (ISO dates) as whole years, months and leftover days */
function diffYMD(a, b){
  const A = parse(a), B = parse(b);
  if (B <= A) return { y:0, m:0, d:0, days:0 };
  let months = (B.getFullYear() - A.getFullYear()) * 12 + (B.getMonth() - A.getMonth());
  if (addMonthsClamp(A, months) > B) months--;
  const anchor = addMonthsClamp(A, months);
  return { y:Math.floor(months / 12), m:months % 12, d:Math.round((B - anchor) / 864e5), days:Math.round((B - A) / 864e5) };
}
function fmtSpan(x){
  if (x.y) return `${x.y} yr${x.m ? ` ${x.m} mo` : ''}`;
  if (x.m) return `${x.m} mo${x.d ? ` ${x.d} d` : ''}`;
  return `${x.d} d`;
}
const beltHistory = (art = 'bjj') => (db.belts||[]).filter(e => artOf(e) === art).sort((a,b) => a.date.localeCompare(b.date) || (a.kind === 'belt' ? 0 : 1) - (b.kind === 'belt' ? 0 : 1) || a.stripes - b.stripes || (a.createdAt||0) - (b.createdAt||0));
/* current rank: latest belt event + the highest stripe earned at that belt since; dates for "time at belt" and "since last stripe" */
const currentRank = (art = 'bjj') => { const h = beltHistory(art); if (!h.length) return null;
  const be = [...h].reverse().find(e => e.kind === 'belt') || h[0], st = h.filter(e => e.kind === 'stripe' && e.belt === be.belt && e.date >= be.date);
  const top = st.reduce((a, e) => !a || e.stripes > a.stripes || (e.stripes === a.stripes && e.date > a.date) ? e : a, null), last = st.reduce((a, e) => !a || e.date > a.date ? e : a, null);
  return { ...be, art, stripes:top ? top.stripes : 0, date:last ? last.date : be.date, beltDate:be.date, lastStripe:last ? last.date : null, sample:be.sample }; };
const fmtYM = x => x.y ? `${x.y} yr${x.y > 1 ? 's' : ''} ${x.m} mo${x.m === 1 ? '' : 's'}` : x.m ? `${x.m} mo${x.m === 1 ? '' : 's'}` : `${x.d} day${x.d === 1 ? '' : 's'}`;
const subWord = (belt, art = 'bjj') => (subOf(belt, art) || { word:'stripe' }).word;
const stripeWord = (belt, n, art = 'bjj') => { const w = subWord(belt, art); return w === 'stripe' ? `Stripe ${n}` : `${ordN(n)} ${w}`; };
const nounOf = art => (BELT_ARTS[art] || BELT_ARTS.bjj).noun;
const beltName = (belt, art = 'bjj') => `${beltOf(belt)[1]} ${nounOf(art)}`;
const kyuOf = (belt, art) => (BELT_ARTS[art] || {}).kyu?.[belt] || '';
const eventLabel = e => { const a = artOf(e); return e.kind === 'stripe' ? `${stripeWord(e.belt, e.stripes, a)} earned` : `${beltName(e.belt, a)}${kyuOf(e.belt, a) ? ` (${kyuOf(e.belt, a)})` : ''} earned`; };
const rankLabel = (e, short) => { const a = artOf(e), w = subWord(e.belt, a);
  return e.stripes ? (w === 'stripe' ? `${e.stripes} stripe${e.stripes > 1 ? 's' : ''}` : `${ordN(e.stripes)} ${w}`) : (short ? (a === 'bjj' ? 'No stripes' : kyuOf(e.belt, a) || '') : `Promoted to ${beltName(e.belt, a).toLowerCase()}`); };
function syncProfileRank(){ const c = currentRank(); db.profile = { ...db.profile, belt:c ? c.belt : 'white', stripes:c ? c.stripes : 0, promotedOn:c ? c.beltDate : '' }; }
/* mat time logged in [from, to) (to inclusive when it is today) */
/* consecutive entries at the same belt form one group; a group runs until the next belt's first entry (or today) */
function beltGroups(art = 'bjj'){
  const h = beltHistory(art), t = today(), groups = [];
  h.forEach((e, i) => { const prev = h[i-1]; e = { ...e, took: prev ? diffYMD(prev.date, e.date) : null, end: h[i+1] ? h[i+1].date : t, current: i === h.length-1 };
    const g = groups[groups.length-1]; if (g && g.belt === e.belt) g.items.push(e); else groups.push({ belt:e.belt, start:e.date, items:[e] }); });
  groups.forEach((g, i) => { g.current = i === groups.length-1; g.end = g.current ? t : groups[i+1].start; g.span = diffYMD(g.start, g.end); });
  return groups;
}
// Belt illustration (SVG). size 'lg' = tied belt with hanging tails; 'sm' = flat bar for lists/timeline.
function beltSVG(belt, stripes, size='lg', title, art='bjj'){
  if (art !== 'bjj') return artBeltSVG(belt, stripes, size, title, art);
  const b = beltOf(belt), n = Math.max(0, Math.min(maxStripes(belt), Number(stripes) || 0)), black = b[0] === 'black';
  const fill = b[2], bar = black ? '#c8102e' : '#141414', edge = black ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)', stitch = black ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.18)';
  const label = esc(title || `${b[1]} belt${n ? ', ' + (black ? n + (['','st','nd','rd'][n] || 'th') + ' degree' : n + ' stripe' + (n > 1 ? 's' : '')) : ''}`);
  if (size === 'sm') {
    const tape = Array.from({length:n}, (_, i) => `<rect x="${96 - i*5}" y="2" width="2.6" height="20" fill="#f4f4f4"/>`).join('');
    return `<svg class="beltsvg sm" data-belt="${b[0]}" data-stripes="${n}" viewBox="0 0 120 24" role="img" aria-label="${label}"><rect x=".75" y=".75" width="118.5" height="22.5" rx="3" fill="${fill}" stroke="${edge}" stroke-width="1.5"/><path d="M3 6.5H117M3 17.5H117" stroke="${stitch}" stroke-width="1" stroke-dasharray="3 2"/><rect x="66" y=".75" width="40" height="22.5" fill="${bar}"/>${tape}<rect x=".75" y=".75" width="118.5" height="22.5" rx="3" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/></svg>`;
  }
  // tails are drawn in a rotated frame: (0,0) at the knot, extending down 84 units, 28 wide
  const tape = Array.from({length:n}, (_, i) => `<rect x="-14" y="${68 - i*6.2}" width="28" height="2.8" fill="#f4f4f4"/>`).join('');
  const tail = (tx, rot, rank) => `<g transform="translate(${tx} 46) rotate(${rot})"><rect x="-14" y="0" width="28" height="84" rx="2.5" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>
    <path d="M-8 2V82M8 2V82" stroke="${stitch}" stroke-dasharray="4 3"/>${rank ? `<rect x="-14" y="${34}" width="28" height="40" fill="${bar}"/>${tape}` : ''}</g>`;
  return `<svg class="beltsvg lg" data-belt="${b[0]}" data-stripes="${n}" viewBox="0 0 320 132" role="img" aria-label="${label}">
    <rect x="2" y="20" width="316" height="28" rx="4" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>
    <path d="M6 27.5H314M6 40.5H314" stroke="${stitch}" stroke-dasharray="4 3"/>
    ${tail(146, 32, false)}${tail(174, -30, true)}
    <rect x="136" y="11" width="48" height="46" rx="7" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>
    <path d="M140 20L180 48M141 44L160 30" stroke="${edge}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}
/* other arts: solid belt (no rank bar); black belts show gold dan bars for 2nd dan up. Muay Thai: a twisted prajied armband. */
function artBeltSVG(belt, stripes, size, title, art){
  const A = BELT_ARTS[art], b = beltOf(belt), fill = b[2], dark = ['black','brown','blue','purple','red','green'].includes(belt), edge = dark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.3)', stitch = dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)';
  const sb = subOf(belt, art), n = sb ? Math.max(0, Math.min(sb.to, Number(stripes) || 0)) : 0, bars = n >= 2 ? n - 1 : 0;
  const label = esc(title || `${A.label} ${beltName(belt, art).toLowerCase()}${n ? `, ${ordN(n)} dan` : kyuOf(belt, art) ? `, ${kyuOf(belt, art)}` : ''}`);
  const attrs = `data-art="${art}" data-belt="${b[0]}" data-stripes="${n}" role="img" aria-label="${label}"`;
  if (A.noun === 'prajied') {
    const twist = Array.from({ length:size === 'sm' ? 9 : 14 }, (_, i) => size === 'sm' ? `<path d="M${6 + i*12} 2l8 20" stroke="${stitch}" stroke-width="3"/>` : `<path d="M${30 + i*19} 30l12 24" stroke="${stitch}" stroke-width="5"/>`).join('');
    if (size === 'sm') return `<svg class="beltsvg sm prajied" ${attrs} viewBox="0 0 120 24"><rect x=".75" y=".75" width="118.5" height="22.5" rx="11" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>${twist}<rect x=".75" y=".75" width="118.5" height="22.5" rx="11" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/></svg>`;
    return `<svg class="beltsvg lg prajied" ${attrs} viewBox="0 0 320 132"><rect x="20" y="28" width="280" height="28" rx="14" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>${twist}
      <path d="M150 56c-6 22-16 44-30 66M170 56c6 22 16 44 30 66" stroke="${fill}" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M150 56c-6 22-16 44-30 66M170 56c6 22 16 44 30 66" stroke="${edge}" stroke-width="1.5" fill="none"/>
      <circle cx="160" cy="44" r="18" fill="${fill}" stroke="${edge}" stroke-width="1.5"/></svg>`;
  }
  if (size === 'sm') { const tape = Array.from({ length:bars }, (_, i) => `<rect x="${100 - i*5}" y="2" width="2.6" height="20" fill="#d4a017"/>`).join('');
    return `<svg class="beltsvg sm" ${attrs} viewBox="0 0 120 24"><rect x=".75" y=".75" width="118.5" height="22.5" rx="3" fill="${fill}" stroke="${edge}" stroke-width="1.5"/><path d="M3 6.5H117M3 17.5H117" stroke="${stitch}" stroke-width="1" stroke-dasharray="3 2"/>${tape}<rect x=".75" y=".75" width="118.5" height="22.5" rx="3" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/></svg>`; }
  const tape = Array.from({ length:bars }, (_, i) => `<rect x="-14" y="${72 - i*6.2}" width="28" height="2.8" fill="#d4a017"/>`).join('');
  const tail = (tx, rot, rank) => `<g transform="translate(${tx} 46) rotate(${rot})"><rect x="-14" y="0" width="28" height="84" rx="2.5" fill="${fill}" stroke="${edge}" stroke-width="1.5"/><path d="M-8 2V82M8 2V82" stroke="${stitch}" stroke-dasharray="4 3"/>${rank ? tape : ''}</g>`;
  return `<svg class="beltsvg lg" ${attrs} viewBox="0 0 320 132"><rect x="2" y="20" width="316" height="28" rx="4" fill="${fill}" stroke="${edge}" stroke-width="1.5"/><path d="M6 27.5H314M6 40.5H314" stroke="${stitch}" stroke-dasharray="4 3"/>
    ${tail(146, 32, false)}${tail(174, -30, true)}<rect x="136" y="11" width="48" height="46" rx="7" fill="${fill}" stroke="${edge}" stroke-width="1.5"/><path d="M140 20L180 48M141 44L160 30" stroke="${edge}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
}
const beltBar = (belt, stripes, cls='', art='bjj') => beltSVG(belt, stripes, cls === 'mini' ? 'sm' : 'lg', undefined, art);
/* which arts get a belt card / tab: any art with promotions logged; BJJ by default for grapplers who haven't logged another art */
function artsUsed(){ const have = new Set((db.belts||[]).map(artOf)), l = ART_KEYS.filter(k => have.has(k)); if (!l.length && enabled('grappling')) l.push('bjj'); return l; }
const artsOffered = () => { const l = ART_KEYS.filter(k => enabled(BELT_ARTS[k].cat)); return l.length ? l : ART_KEYS; };
const beltCards = () => artsUsed().map(a => beltCard(a)).join('');
const beltEmpty = () => `<div class="belt empty-belt">${beltSVG('white', 0, 'lg', 'White belt')}</div><div class="belt-prompt"><b>Track your belt journey</b><span>Log your belt and stripes to track time at each rank.</span></div>`;
function beltCard(art = 'bjj'){
  const cur = currentRank(art), A = BELT_ARTS[art], id = art === 'bjj' ? 'beltCard' : `beltCard-${art}`, pre = art !== 'bjj' || artsUsed().length > 1 ? `${A.label} · ` : '', href = art === 'bjj' ? '#/belts' : `#/belts/${art}`;
  if (!cur) return `<div class="card beltcard" id="${id}" data-art="${art}"><h2>${art === 'bjj' ? 'Belt' : `${A.label} rank`}</h2>${art === 'bjj' ? beltEmpty() : ''}<button type="button" class="btn primary block" data-promo data-art="${art}">Log promotion</button></div>`;
  const B = cap(A.noun), atBelt = diffYMD(cur.beltDate, today()), sb = subOf(cur.belt, art), sw = sb ? sb.word : '';
  return `<div class="card tappable beltcard" id="${id}" data-art="${art}" data-href="${href}"><h2>${esc(pre)}${esc(beltName(cur.belt, art))}${cur.stripes ? ` · ${rankLabel(cur)}` : kyuOf(cur.belt, art) ? ` · ${kyuOf(cur.belt, art)}` : ''} ${cur.sample ? '<span class="pill sample">Sample</span>' : ''}<a class="lnk" href="${href}">Timeline ›</a></h2>
    <div class="belt">${beltBar(cur.belt, cur.stripes, '', art)}</div>
    <div class="belt-meta"><span>Time at ${A.noun} <b data-b="rank">${fmtYM(atBelt)}</b></span>${sw ? `<span>Time since last ${sw} <b data-b="since">${cur.lastStripe ? fmtYM(diffYMD(cur.lastStripe, today())) : `no ${sw}s yet`}</b></span>` : ''}</div>
    <div class="belt-meta" style="margin-top:4px"><span>${B} earned <b data-b="beltdate">${fmtShort(cur.beltDate)}</b></span>${cur.lastStripe ? `<span>Last ${sw} <b data-b="stripedate">${fmtShort(cur.lastStripe)}</b></span>` : ''}</div>
    <button type="button" class="btn block" data-promo data-art="${art}" style="margin-top:12px">Log promotion</button></div>`;
}
function wireBelt(root){
  root.querySelectorAll('[data-promo]').forEach(x => x.onclick = e => { e.stopPropagation(); promoSheet(null, null, x.dataset.art || 'bjj'); });
  root.querySelectorAll('.beltcard.tappable').forEach(c => c.onclick = e => { if (!e.target.closest('a,button')) go(c.dataset.href); });
  root.querySelectorAll('[data-pid]').forEach(x => x.onclick = () => promoSheet(x.dataset.pid));
  root.querySelectorAll('[data-addstripe]').forEach(x => x.onclick = e => { e.stopPropagation(); promoSheet(null, { kind:'stripe', belt:x.dataset.addstripe, stripes:Number(x.dataset.n) || 1 }, x.dataset.art || 'bjj'); });
}
/* the next likely promotion, so logging is usually just "Log promotion" -> "Save" */
function nextRank(cur, art = 'bjj'){
  const A = BELT_ARTS[art] || BELT_ARTS.bjj;
  if (!cur) return { belt:A.belts[0], stripes:0 };
  if (art === 'bjj') {
    if (cur.stripes < maxStripes(cur.belt) && cur.belt !== 'black') return { belt:cur.belt, stripes:cur.stripes + 1 };
    if (cur.belt === 'black') return { belt:'black', stripes:Math.min(6, cur.stripes + 1) };
    const ai = ADULT_BELTS.indexOf(cur.belt), ki = KIDS_BELTS.indexOf(cur.belt);
    return { belt: ai >= 0 ? ADULT_BELTS[ai+1] : KIDS_BELTS[ki+1] || 'blue', stripes:0 };
  }
  const sb = subOf(cur.belt, art), i = A.belts.indexOf(cur.belt);
  if (i < A.belts.length - 1) return { belt:A.belts[i + 1], stripes:0 };
  return sb ? { belt:cur.belt, stripes:Math.min(sb.to, Math.max(sb.from, cur.stripes + 1)) } : { belt:cur.belt, stripes:0 };
}
/* missing stripe numbers at a belt (e.g. stripes 1 and 3 logged, 2 missing) */
function missingStripes(belt, art = 'bjj'){ const sb = subOf(belt, art); if (!sb) return []; const have = new Set((db.belts||[]).filter(e => artOf(e) === art && e.kind === 'stripe' && e.belt === belt).map(e => e.stripes)), top = Math.max(0, ...have);
  return Array.from({ length:Math.max(0, top - sb.from + 1) }, (_, i) => i + sb.from).filter(n => !have.has(n)); }
function promoSheet(id, preset, art0 = 'bjj'){
  const ex0 = id ? db.belts.find(x => x.id === id) : null, art = ex0 ? artOf(ex0) : art0, A = BELT_ARTS[art], N = A.noun, ex = ex0, cur = currentRank(art), nx = nextRank(cur, art);
  const f = ex ? { ...ex } : preset ? { instructor:cur?.instructor || '', academy:cur?.academy || '', notes:'', date:today(), ...preset }
    : { kind: cur && nx.belt === cur.belt ? 'stripe' : 'belt', belt:nx.belt, stripes: cur && nx.belt === cur.belt ? nx.stripes : 0, date:today(), instructor:cur?.instructor || '', academy:cur?.academy || '', notes:'' };
  if (!f.kind) f.kind = f.stripes ? 'stripe' : 'belt';
  f.art = art; if (!artBelts(art).includes(f.belt)) f.belt = A.belts[0];
  let kids = art === 'bjj' && KIDS_BELTS.includes(f.belt);
  const el = h(`<div data-art="${art}"><h3>${ex ? (ex.kind === 'stripe' ? `Edit ${subWord(ex.belt, art)}` : `Edit ${N}`) : 'Log promotion'}${art !== 'bjj' || artsUsed().length > 1 ? ` <small class="artname">${esc(A.label)}</small>` : ''}</h3>
    <div class="field" id="kindF"></div>
    <div class="field"><label id="beltLbl">${cap(N)}</label><div class="beltpick" id="beltPick"></div>${art === 'bjj' ? '<button type="button" class="btn sm ghost" id="kidsT" style="margin-top:8px">Kids belts</button>' : ''}</div>
    <div class="field" id="stripeF"></div>
    <div class="field"><label id="dateLbl">Belt earned</label><input class="input" type="date" id="pDate" max="${today()}" value="${esc(f.approx ? '' : f.date)}"><div class="hint" id="dateHint">Defaults to today. Pick an earlier date to add a past promotion.</div></div>
    <details class="details" ${ex && (ex.instructor || ex.academy || (ex.notes && !ex.approx)) ? 'open' : ''}><summary><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add details <small>optional</small></summary><div class="det-body">
      <div class="field"><label>Instructor</label><input class="input" id="pInst" autocapitalize="words" value="${esc(f.instructor)}" placeholder="e.g. Prof. Silva"></div>
      <div class="field"><label>Academy</label><input class="input" id="pAcad" autocapitalize="words" value="${esc(f.academy)}" placeholder="e.g. Riverside BJJ"></div>
      <div class="field"><label>Notes</label><textarea class="input" id="pNotes" rows="2" placeholder="How it happened, what to work on next…">${esc(f.approx ? '' : f.notes)}</textarea></div></div></details>
    <div style="display:flex;gap:10px;margin-top:6px">${ex ? '<button type="button" class="btn danger" id="pDel">Delete</button>' : ''}<button type="button" class="btn primary" style="flex:1" id="pSave">${ex ? 'Save changes' : 'Save'}</button></div></div>`);
  if (f.approx) el.querySelector('#pDate').value = f.date;
  const pick = el.querySelector('#beltPick'), sf = el.querySelector('#stripeF'), kt = el.querySelector('#kidsT'), kf = el.querySelector('#kindF');
  const Sw = () => cap(subWord(f.belt, art));
  const sync = () => { if (!subOf(f.belt, art)) f.kind = 'belt'; const st = f.kind === 'stripe'; el.querySelector('#dateLbl').textContent = st ? `${Sw()} earned` : `${cap(N)} earned`; el.querySelector('#beltLbl').textContent = st ? `At ${N}` : `New ${N}`; sf.hidden = !st; kf.hidden = !subOf(f.belt, art); };
  const drawKind = () => { kf.innerHTML = '<label>What happened?</label>'; if (!subOf(f.belt, art)) return; kf.appendChild(seg([['belt',`New ${N}`],['stripe', Sw()]], f.kind, x => { f.kind = x; const sb = subOf(f.belt, art); if (x === 'stripe' && !f.stripes) f.stripes = (missingStripes(f.belt, art)[0]) || Math.min(sb.to, Math.max(sb.from, (cur && cur.belt === f.belt ? cur.stripes : 0) + 1)); drawStripes(); sync(); })); kf.querySelector('.seg').id = 'pKind'; };
  const drawStripes = () => { const sb = subOf(f.belt, art); sf.innerHTML = ''; if (!sb) return; if (f.stripes > sb.to) f.stripes = sb.to; if (f.stripes < sb.from) f.stripes = sb.from; sf.innerHTML = `<label>Which ${sb.word}</label>`;
    sf.appendChild(seg(Array.from({length:sb.to - sb.from + 1}, (_, i) => [i + sb.from, String(i + sb.from)]), f.stripes, x => { f.stripes = x; }, sb.to - sb.from > 6)); sf.querySelector('.seg').id = 'pStripe';
    const miss = missingStripes(f.belt, art).filter(n => !ex || n !== ex.stripes); if (miss.length) sf.appendChild(h(`<div class="hint">Missing a date for ${sb.word} ${miss.join(', ')} at ${beltName(f.belt, art).toLowerCase()}.</div>`)); };
  const drawPick = () => { const list = kids ? ADULT_BELTS.concat(KIDS_BELTS) : A.belts; if (kt) kt.textContent = kids ? 'Hide kids belts' : 'Kids belts';
    pick.innerHTML = list.map(k => `<button type="button" data-belt="${k}" class="${f.belt === k ? 'on' : ''}" aria-pressed="${f.belt === k}"><i style="background:${beltOf(k)[2]}"></i>${beltOf(k)[1]}${kyuOf(k, art) ? `<small>${kyuOf(k, art)}</small>` : ''}</button>`).join('');
    pick.querySelectorAll('button').forEach(x => x.onclick = () => { f.belt = x.dataset.belt; drawPick(); drawKind(); drawStripes(); sync(); }); };
  if (kt) kt.onclick = () => { kids = !kids; if (!kids && KIDS_BELTS.includes(f.belt)) f.belt = 'white'; drawPick(); drawStripes(); };
  drawKind(); drawPick(); drawStripes(); sync();
  el.querySelector('#pSave').onclick = () => {
    const date = el.querySelector('#pDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) { toast('Pick a date (today or earlier)'); return; }
    const same = e => e.id !== f.id && artOf(e) === art;
    if (f.kind === 'stripe' && (db.belts||[]).some(e => same(e) && e.kind === 'stripe' && e.belt === f.belt && e.stripes === f.stripes)) { toast(`${stripeWord(f.belt, f.stripes, art)} at ${beltName(f.belt, art).toLowerCase()} is already logged. Tap it on the timeline to edit.`); return; }
    if (f.kind === 'belt' && (db.belts||[]).some(e => same(e) && e.kind === 'belt' && e.belt === f.belt)) { toast(`${beltName(f.belt, art)} is already logged. Tap it on the timeline to edit.`); return; }
    const before = JSON.parse(JSON.stringify(db.belts));
    const rec = sanitizeBelts([{ ...f, ...(art === 'bjj' ? { art:undefined } : { art }), stripes:f.kind === 'belt' ? 0 : f.stripes, id:ex ? ex.id : uid(), date, instructor:el.querySelector('#pInst').value.trim(), academy:el.querySelector('#pAcad').value.trim(), notes:el.querySelector('#pNotes').value.trim(), createdAt:ex ? ex.createdAt : Date.now() }])[0];
    delete rec.sample; delete rec.approx;
    db.belts = db.belts.filter(x => x.id !== rec.id).concat(rec); syncProfileRank(); save(); closeSheet();
    undoToast(`${ex ? 'Updated' : 'Logged'}: ${eventLabel(rec)} · ${fmtShort(rec.date)}`, () => { db.belts = before; syncProfileRank(); save(); route(); });
    whenSettled(route);
  };
  const del = el.querySelector('#pDel');
  if (del) del.onclick = () => { const before = JSON.parse(JSON.stringify(db.belts)); db.belts = db.belts.filter(x => x.id !== ex.id); syncProfileRank(); save(); closeSheet();
    undoToast(`${eventLabel(ex)} deleted`, () => { db.belts = before; syncProfileRank(); save(); route(); }); whenSettled(route); };
  openSheet(el, null, { closeLabel:'Cancel' });
}
function histSeg(which){
  const belts = true;   // Belts also holds competitions (3.18.0)
  return `<div class="seg fuelseg histseg" role="tablist"><a role="tab" href="#/history" class="${which === 'workouts' ? 'on' : ''}">Workouts</a>${belts ? `<a role="tab" href="#/belts" class="${which === 'belts' ? 'on' : ''}">Belts</a>` : ''}</div>`;
}
let beltArt = 'bjj';
function viewBelts(want){
  setHeader('History', `<a class="btn sm" href="#/stats">Stats</a>`);
  const used = artsUsed(), art = BELT_ARTS[want] ? want : used.includes(beltArt) ? beltArt : used[0] || artsOffered()[0];
  beltArt = art; const A = BELT_ARTS[art], N = A.noun, arts = used.includes(art) ? used : used.concat(art);
  const v = $('#view'), groups = beltGroups(art).reverse();
  const items = g => [...g.items].reverse().map(e => `<button type="button" class="tl-item ${e.kind}${e.approx ? ' approx' : ''}" data-pid="${esc(e.id)}" data-kind="${e.kind}"><i class="tl-dot"></i><div class="grow"><b>${esc(eventLabel(e))}</b>
      <small>${fmtShort(e.date)}${e.instructor ? ` · ${esc(e.instructor)}` : ''}${e.academy ? ` · ${esc(e.academy)}` : ''}${e.sample ? ' · sample' : ''}</small>${e.notes ? `<small class="tl-note">${esc(e.notes)}</small>` : ''}</div>
      <span class="tl-took">${e.took ? `<b>${fmtSpan(e.took)}</b><small>after previous</small>` : '<small>start</small>'}</span></button>`).join('');
  const more = artsOffered().filter(k => !arts.includes(k));
  v.innerHTML = `${histSeg('belts')}
    ${arts.length > 1 ? `<div class="seg fuelseg artseg" id="artSwitch" role="tablist" aria-label="Martial art">${arts.map(k => `<a role="tab" href="#/belts/${k}" data-art="${k}" class="${k === art ? 'on' : ''}" aria-selected="${k === art}">${esc(BELT_ARTS[k].label)}</a>`).join('')}</div>` : ''}
    ${currentRank(art) ? beltCard(art).replace('card tappable', 'card').replace(/<button type="button" class="btn block" data-promo[^>]*>Log promotion<\/button>/, '').replace(/<a class="lnk" href="#\/belts[^"]*">Timeline ›<\/a>/, '') : ''}
    <button type="button" class="btn primary block" data-promo data-art="${art}" style="margin-bottom:14px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log promotion</button>
    ${groups.length ? `<div class="timeline" id="timeline" data-art="${art}">${groups.map(g => { const b = beltOf(g.belt); return `<section class="tl-group ${g.current ? 'current' : ''}" data-belt="${g.belt}" style="--belt:${b[2]}">
      <div class="tl-head">${beltBar(g.belt, g.items[g.items.length-1].stripes, 'mini', art)}<div class="grow"><b>${esc(beltName(g.belt, art))}${kyuOf(g.belt, art) ? ` <small class="kyu">${kyuOf(g.belt, art)}</small>` : ''}</b><small>${fmtShort(g.start)} – ${g.current ? 'today' : fmtShort(g.end)}</small></div>
        <div class="tl-dur"><b data-span>${fmtSpan(g.span)}</b><small>${g.current ? 'so far' : `at this ${N}`}</small></div></div>
      <div class="tl-items">${items(g)}</div>${(() => { const sb = subOf(g.belt, art); if (!sb) return ''; const miss = missingStripes(g.belt, art), top = Math.max(sb.from - 1, ...g.items.filter(e => e.kind === 'stripe').map(e => e.stripes)), n = miss[0] || (top < sb.to ? top + 1 : 0);
        return n ? `<button type="button" class="btn sm ghost addstripe" data-addstripe="${g.belt}" data-art="${art}" data-n="${n}">+ ${miss.length ? 'Add missing' : 'Add'} ${sb.word} ${n} date</button>` : ''; })()}</section>`; }).join('')}</div>
      <div class="hint" style="text-align:center;margin-top:8px">${art === 'bjj' ? 'Tap a belt or stripe to change its date or delete it. Add past belts and stripes in any order; they\'re sorted by date. A new belt starts at 0 stripes.' : `Tap any entry to change its date or delete it. Add past ranks in any order; they're sorted by date.${A.noun === 'prajied' ? ' Prajied colours vary by gym and organisation: pick the colour you were given.' : ' Colour orders vary by club: pick the colour you were given.'}`}</div>`
    : `<div class="empty" style="padding:30px 10px">No promotions yet. Log your current ${N} (and past ones if you like) to see your journey.</div>`}
    ${more.length ? `<button type="button" class="btn block ghost" id="addArt" style="margin-top:14px">+ Track another art's ranks</button>` : ''}
    ${compsLight()}`;
  wireBelt(v); wireComps(v);
  const aa = $('#addArt'); if (aa) aa.onclick = () => { const el = h(`<div><h3>Track ranks for</h3><div class="hint" style="margin:-6px 0 12px">Each art gets its own card and timeline. Wrestling and submission grappling don't use belts.</div><div class="artlist">${more.map(k => `<button type="button" class="btn block" data-pickart="${k}" style="margin-bottom:8px">${esc(BELT_ARTS[k].label)}${BELT_ARTS[k].noun === 'prajied' ? ' (prajied)' : ''}</button>`).join('')}</div></div>`);
    el.querySelectorAll('[data-pickart]').forEach(b => b.onclick = () => { closeSheet(); const k = b.dataset.pickart; whenSettled(() => { go('#/belts/' + k); setTimeout(() => promoSheet(null, null, k), 50); }); });
    openSheet(el, null, { closeLabel:'Cancel' }); };
}

/* ---------------- disciplines ---------------- */
const CATS = {
  grappling:{ label:'Grappling', sub:'BJJ, Wrestling, Judo', color:'#D7261E', dur:60, discLabel:'Sport', disc:[['bjj','BJJ'],['wrestling','Wrestling'],['judo','Judo'],['sambo','Sambo'],['subgrappling','Submission grappling']],
    icon:'<path d="M8 4a2 2 0 1 0 0 .1M16 4a2 2 0 1 0 0 .1M5 21l2-7-3-3 4-4h8l4 4-3 3 2 7M9 11l3 2 3-2"/>' },
  striking:{ label:'Striking', sub:'Boxing, Muay Thai, Kickboxing', color:'#F5C542', dur:60, discLabel:'Style', disc:[['boxing','Boxing'],['muaythai','Muay Thai'],['kickboxing','Kickboxing'],['karate','Karate/Taekwondo'],['other','Other']],
    icon:'<path d="M6 10a5 5 0 0 1 5-5h3a4 4 0 0 1 4 4v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM8 18v3h8v-3M9.5 10.5h5.5"/>' },
  mma:{ label:'MMA', sub:'Striking + grappling', color:'#E5484D', dur:60, disc:[['mma','MMA']],
    icon:'<path d="M4 20l6-6M14 10l6-6M15 4h5v5M9 20H4v-5M8 8l8 8"/>' },
  weights:{ label:'Weights', color:'#8FB0D9', dur:60, disc:[['strength','Strength']],
    icon:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>' },
  cardio:{ label:'Cardio', color:'#6FD3A8', dur:30, disc:[['run','Run'],['bike','Bike'],['row','Row'],['swim','Swim'],['stairs','Stairs'],['other','Other']],
    legacy:[['rope','Jump rope']],   // 3.4.0: no longer in the picker; old sessions keep their label
    icon:'<path d="M3 12h4l2-5 4 10 2-5h6"/>' },
  mobility:{ label:'Mobility', sub:'Yoga, stretching, foam rolling', color:'#B48CF2', dur:20, discLabel:'Session type', disc:[['yoga','Yoga'],['stretch','Stretching'],['foam','Foam rolling'],['flow','Mobility flow'],['recovery','Recovery/other']],
    icon:'<path d="M12 5a2 2 0 1 0 0-.1M4 10c3 1 5 1 8 1s5 0 8-1M12 11v4l-4 6M12 15l4 6"/>' }
};
const CAT_KEYS = Object.keys(CATS);
const allDisc = c => [...CATS[c].disc, ...(CATS[c].legacy || [])];
const STRIKE_TECH = ['Jab','Cross','Lead hook','Rear hook','Uppercut','Teep','Roundhouse kick','Low kick','Body kick','Head kick','Knee','Elbow','Clinch','Check kick','Slip & counter','Roll under','Parry','Footwork','Head movement','1-2-3','Jab-cross-low kick','Level change','Cage work'];
const STRIKE_MIX = [['shadow','Shadow'],['pads','Pads'],['bag','Bag'],['drills','Drills'],['sparring','Sparring'],['circuit','Circuit']];
const MMA_MIX = [['pads','Pad work'],['sparring','Sparring'],['grappling','Grappling rounds'],['circuit','Circuit']];
const MIX_LEGACY = { drills:'Drilling' };   // 3.13.5: no longer in the picker; old sessions keep their label
const MIX_KEYS = [...new Set(STRIKE_MIX.concat(MMA_MIX).map(x => x[0]).concat(Object.keys(MIX_LEGACY)))];
const mixOf = c => c === 'mma' ? MMA_MIX : STRIKE_MIX;
const FOCUS = [['hips','Hips'],['hamstrings','Hamstrings'],['shoulders','Shoulders'],['back','Back'],['neck','Neck'],['ankles','Ankles'],['full','Full body']];
const COMBAT = c => c === 'grappling' || c === 'striking' || c === 'mma';
const EXERCISES = ['Back squat','Front squat','Bench press','Incline bench press','Deadlift','Romanian deadlift','Trap bar deadlift','Overhead press','Barbell row','Pull-up','Chin-up','Dip','Lat pulldown','Cable row','Hip thrust','Bulgarian split squat','Lunge','Leg press','Kettlebell swing','Turkish get-up','Farmer carry','Power clean','Bicep curl','Tricep extension','Face pull','Neck curl','Plank','Push-up'];
const catOf = s => CATS[s.category] ? s.category : 'grappling';
const discLabel = s => { const k = catOf(s), c = CATS[k]; return (allDisc(k).find(d => d[0]===s.discipline) || c.disc[0])[1]; };
const enabled = k => { const e = db.profile.enabled || {}; return CAT_KEYS.includes(k) && (k in e ? !!e[k] : k === 'grappling'); };
const SECTION_KEYS = () => CAT_KEYS;
const enabledCats = () => { const l = CAT_KEYS.filter(enabled); return l.length ? l : ['grappling']; };
const distU = () => db.profile.distUnit === 'km' ? 'km' : 'mi';
const toUnit = (d, from, to) => from === to ? d : (to === 'km' ? d * 1.609344 : d / 1.609344);
const fmtDur = sec => { sec = Math.round(sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
const paceStr = (sec, dist, unit) => dist > 0 && sec > 0 ? `${fmtDur(sec/dist)} /${unit}` : '';
const speedStr = (sec, dist, unit) => dist > 0 && sec > 0 ? `${r1(dist/(sec/3600))} ${unit==='km'?'km/h':'mph'}` : '';
const e1rm = (w, r) => w > 0 && r > 0 ? w * (1 + Math.min(r, 12)/30) : 0;
const volumeOf = s => (s.exercises||[]).reduce((a,e) => a + e.sets.reduce((b,x) => b + (Number(x.reps)||0)*(Number(x.weight)||0), 0), 0);
function sessTitle(s){ const c = catOf(s); if (COMBAT(c)) { const t = (s.type && s.type !== 'class' && !LEGACY_TYPES.includes(s.type)) ? ` · ${typeLabel(s.type)}` : ''; return discLabel(s) + t; } return c === 'weights' ? (s.prog && tmplOf(s.prog.tid) ? `Weights · ${(tmplOf(s.prog.tid).sessions.find(x => x.key === s.prog.key) || { name:'Program' }).name}` : 'Weights') : discLabel(s); }
function catDot(c){ return `<i class="catdot" style="background:${CATS[c].color}"></i>`; }

/* schema-2 session sanitizer: used for import, migration and every save (so stored == exported == re-imported) */
function sanitizeSession(s){
  const n = v => v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
  const cat = CATS[s.category] ? s.category : 'grappling';
  const disc = allDisc(cat).some(d => d[0]===s.discipline) ? s.discipline : CATS[cat].disc[0][0];
  const out = { id:String(s.id||uid()), date:s.date, category:cat, discipline:disc, gi:s.gi==='nogi'?'nogi':'gi',
    type:SESSION_TYPES.some(t => t[0]===s.type) || LEGACY_TYPES.includes(s.type) ? fixType(s.category || 'grappling', s.type) : 'class', duration:Math.max(0, Math.round(Number(s.duration)||0)), rounds:Math.max(0, Number(s.rounds)||0),
    intensity:Math.min(5, Math.max(1, Number(s.intensity)||3)), techniques:Array.isArray(s.techniques) ? s.techniques.map(String) : [],
    notes:String(s.notes||''), weight:n(s.weight),
    rolls:Array.isArray(s.rolls) ? s.rolls.map(r => ({ id:String(r.id||uid()), partner:String(r.partner||''), result:['win','loss','draw'].includes(r.result)?r.result:'draw',
      subsLanded:(r.subsLanded||[]).map(String), subsTapped:(r.subsTapped||[]).map(String), stuck:(r.stuck||[]).map(String) })) : [],
    sample:!!s.sample, createdAt:s.createdAt||Date.now() };
  if (s.updatedAt) out.updatedAt = s.updatedAt;
  if (s.strike) out.strike = { roundLen:Number(s.strike.roundLen)||3, mix:Object.fromEntries(MIX_KEYS.filter(k => k in (s.strike.mix||{}) || mixOf(cat).some(m => m[0] === k)).map(k => [k, Math.max(0, Number(s.strike.mix?.[k])||0)])),
    spar:Array.isArray(s.strike.spar) ? s.strike.spar.filter(x => x && (x.partner || x.notes)).map(x => ({ partner:String(x.partner||''), notes:String(x.notes||'') })) : [] };
  if (Array.isArray(s.gtech) && s.gtech.length) out.gtech = s.gtech.map(String);
  if (Array.isArray(s.focus) && s.focus.length) out.focus = s.focus.filter(k => FOCUS.some(f => f[0] === k));
  if (Array.isArray(s.exercises)) out.exercises = s.exercises.filter(e => e && String(e.name||'').trim()).map(e => ({ name:String(e.name).trim(), sets:(e.sets||[]).map(x => ({ reps:n(x.reps), weight:n(x.weight), rpe:n(x.rpe) })), ...(e.plan && Number(e.plan.sets) > 0 ? { plan:{ sets:Number(e.plan.sets), lo:Number(e.plan.lo)||0, hi:Number(e.plan.hi)||Number(e.plan.lo)||0, unit:['reps','sec','m'].includes(e.plan.unit) ? e.plan.unit : 'reps' } } : {}) }));
  if (s.cardio) out.cardio = { distance:n(s.cardio.distance), unit:s.cardio.unit==='km'?'km':'mi', sec:Math.max(0, Math.round(Number(s.cardio.sec)||0)) };
  if (s.hr) { const hr = { avg:n(s.hr.avg), max:n(s.hr.max), cal:n(s.hr.cal), zones:[0,1,2,3,4].map(i => n(s.hr.zones?.[i])) }; if (hr.avg!==''||hr.max!==''||hr.cal!==''||hr.zones.some(z => z!=='')) out.hr = hr; }
  if (s.source) out.source = String(s.source);
  const rp = Math.round(Number(s.rpe)); if (rp >= 1 && rp <= 10) out.rpe = rp;
  const fe = Math.round(Number(s.feel)); if (fe >= 1 && fe <= 5) out.feel = fe;
  if (cat === 'weights' && Array.isArray(s.cardioAdd)) { const ca = s.cardioAdd.map(x => ({ type:CATS.cardio.disc.some(d => d[0] === x.type) ? x.type : 'other', min:Math.max(0, Math.round(Number(x.min)||0)), distance:n(x.distance), unit:x.unit === 'km' ? 'km' : 'mi' })).filter(x => x.min || x.distance); if (ca.length) out.cardioAdd = ca; }
  if (s.prog && typeof s.prog === 'object' && s.prog.puid) out.prog = { puid:String(s.prog.puid), tid:String(s.prog.tid||''), i:Math.max(0, Number(s.prog.i)||0), w:Math.max(1, Number(s.prog.w)||1), key:String(s.prog.key||'') };
  return out;
}

/* ---------------- views ---------------- */
function setHeader(title, action='', back=null){
  const t = $('#title'), tg = $('#tagline'), br = $('#backRow');
  br.hidden = !back;
  if (back) { br.querySelector('span').textContent = back.label || 'Back'; br.querySelector('button').setAttribute('aria-label', back.label || 'Back'); br.querySelector('button').onclick = () => goBack(back.parent || '#/'); }
  if (title) { t.textContent = title; tg.innerHTML = 'For the fight'; }
  else { t.innerHTML = '<img class="banner-logo" src="brand/forged/wordmark-header.svg" alt="Forged" width="767" height="192">'; tg.innerHTML = '<b>For the fight</b>'; }
  document.querySelector('.topbar').classList.toggle('home', !title);
  $('#topAction').innerHTML = action;
}
function updateNav(){
  { const fr = $('.tabbar a[data-tab="friends"]'), on = socialOn(); if (fr) fr.hidden = !on; $('.tabbar').classList.toggle('six', on); }
}


/* quick log helpers */
function lastOf(cat){ return sorted().find(s => catOf(s) === cat); }
function templates(){ return enabledCats().map(lastOf).filter(Boolean); }
function repeatSession(src){
  const rec = sanitizeSession({ category:catOf(src), discipline:src.discipline, gi:src.gi, type:src.type, duration:src.duration, rounds:src.rounds, intensity:src.intensity, ...(src.rpe ? { rpe:src.rpe } : {}),
    ...(src.strike ? { strike:{ roundLen:src.strike.roundLen, mix:src.strike.mix, spar:[] } } : {}), ...(src.focus ? { focus:src.focus } : {}),
    ...(src.exercises ? { exercises:src.exercises } : {}), ...(src.cardio ? { cardio:src.cardio } : {}),
    date:today(), id:uid(), createdAt:Date.now() });
  db.sessions.push(rec); save(); form = null;
  undoToast(`Logged ${sessTitle(rec)} · ${rec.duration} min`, () => { db.sessions = db.sessions.filter(x => x.id !== rec.id); save(); route(); });
  return rec;
}
function repeatButtons(compact){
  const t = templates(); if (!t.length) return '';
  return `<div class="repeat ${compact?'compact':''}">${t.map(s => `<button type="button" class="rep" data-rep="${esc(s.id)}">${catDot(catOf(s))}<span><b>${esc(sessTitle(s))}</b><small>${s.duration} min${catOf(s)==='cardio' && s.cardio?.distance ? ` · ${r1(s.cardio.distance)} ${s.cardio.unit}` : ''}</small></span><em>Log again</em></button>`).join('')}</div>`;
}
function wireRepeat(root, after){ root.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { const s = db.sessions.find(x => x.id === b.dataset.rep); if (s) { repeatSession(s); after ? after() : route(); } }); }

function viewHome(){
  if (needsAssessment()) return viewAssess();
  setHeader('');
  const v = $('#view');
  const st = periodStats(), streak = weekStreak();
  const hasSample = hasSampleData();
  v.innerHTML = `
    ${draftBanner()}
    ${hasSample ? `<div class="banner"><span>📋 <b>Sample data</b> is loaded for the demo.</span><button class="btn sm" id="rmSample">Remove</button></div>` : ''}
    ${dailyChallengeLine()}
    ${todayCard()}
    ${weekCard(st, streak)}
    ${progCard()}
    ${strengthHomeLine()}
    <div class="card quick"><h2>Quick log</h2>${repeatButtons() || '<div class="empty" style="padding:2px 0 10px">Your recent workouts will show here for one-tap logging.</div>'}
      <a class="btn primary block" href="#/log" id="homeLog"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log a workout</a></div>
    <a class="btn block" href="#/stats" id="seeStats">See all stats ›</a>`;
  wireDraft(v); wireRepeat(v); wireProg(v); wireToday(v);
  const rm = $('#rmSample'); if (rm) rm.onclick = removeSample;
  checkChallenge();
}

function sessSub(s){
  const c = catOf(s), rolls = s.rolls||[];
  if (c === 'cardio' && s.cardio) { const k = s.cardio; const bits = [k.distance ? `${r1(k.distance)} ${k.unit}` : '', k.sec ? fmtDur(k.sec) : `${s.duration} min`, s.discipline === 'bike' ? speedStr(k.sec, k.distance, k.unit) : paceStr(k.sec, k.distance, k.unit)]; return bits.filter(Boolean).join(' · '); }
  if (c === 'weights') { const ex = s.exercises||[]; return [`${s.duration} min`, ex.length ? `${ex.length} exercise${ex.length>1?'s':''}` : '', volumeOf(s) ? `${Math.round(volumeOf(s)).toLocaleString()} ${unit()} vol` : '', ...(s.cardioAdd||[]).map(cardioAddText)].filter(Boolean).join(' · '); }
  if (c === 'striking' || c === 'mma') { const m = s.strike?.mix || {}; return [`${s.duration} min`, s.rounds ? `${s.rounds} rds${s.strike ? ` × ${s.strike.roundLen} min` : ''}` : '', m.sparring ? `${m.sparring} sparring` : '', m.circuit ? `${m.circuit} circuit` : ''].filter(Boolean).join(' · '); }
  if (c === 'mobility') { const fl = (s.focus||[]).map(k => (FOCUS.find(f => f[0] === k)||[k,k])[1]); return [`${s.duration} min`, fl.slice(0,3).join(', ') + (fl.length > 3 ? '…' : '')].filter(Boolean).join(' · '); }
  const w = rolls.filter(r => r.result==='win').length, l = rolls.filter(r => r.result==='loss').length;
  return [`${s.duration} min`, `${s.rounds||0} rounds`, rolls.length ? `${w}W ${l}L` : ''].filter(Boolean).join(' · ');
}
function sessRow(s){
  const d = parse(s.date), c = catOf(s);
  const ef = rpeOf(s), dots = [1,2,3,4,5].map(i => `<i class="${i*2 <= ef + 1 ? 'on' : ''}"></i>`).join('');
  const tags = c === 'weights' ? (s.exercises||[]).map(e => e.name) : (s.techniques||[]);
  return `<a class="sess" href="#/session/${esc(s.id)}" style="--cat:${CATS[c].color}">
    <div class="d"><b>${d.getDate()}</b><span>${DOW[d.getDay()]}</span></div>
    <div class="m"><div class="t">${catDot(c)}${esc(sessTitle(s))} ${c==='grappling' && s.discipline==='bjj' ? `<span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>` : ''}${s.sample?'<span class="pill sample">Sample</span>':''}</div>
      <div class="s">${esc(sessSub(s))} · <span class="dots" aria-label="Effort ${ef} of 10">${dots}</span>${s.feel ? ` <span class="feel" aria-label="Felt ${FEELS[s.feel-1][2]}">${FEELS[s.feel-1][1]}</span>` : ''}</div>
      ${tags.length ? `<div class="tg">${esc(tags.join(' · '))}</div>` : ''}</div></a>`;
}

let histFilter = 'all', histQuery = '';
function viewHistory(){
  setHeader('History', `<a class="btn sm" href="#/stats">Stats</a>`);
  const v = $('#view');
  if (!db.sessions.length) { v.innerHTML = `${histSeg('workouts')}<div class="empty" style="padding:60px 10px">No workouts yet.<br><br><a class="btn primary" href="#/log">Log a workout</a></div>`; return; }
  const cats = enabledCats().filter(k => db.sessions.some(s => catOf(s) === k));
  const filters = [['all','All'], ...(cats.length > 1 ? cats.map(k => [k, CATS[k].label]) : []), ...(enabled('grappling') ? [['gi','Gi'],['nogi','No-Gi']] : []), ['comp','Competition']];
  if (!filters.some(f => f[0]===histFilter)) histFilter = 'all';
  v.innerHTML = `${histSeg('workouts')}<div class="search"><input class="input" type="search" placeholder="Search workouts, partners, notes…" value="${esc(histQuery)}" id="q"></div>
    <div class="filters">${filters.map(([k,l]) => `<button data-f="${k}" class="${histFilter===k?'on':''}">${l}</button>`).join('')}</div>
    <div id="list"></div>`;
  const draw = () => {
    const q = histQuery.toLowerCase();
    const list = sorted().filter(s => {
      if (CATS[histFilter] && catOf(s) !== histFilter) return false;
      if (histFilter==='gi' && !(catOf(s)==='grappling' && s.gi==='gi')) return false;
      if (histFilter==='nogi' && !(catOf(s)==='grappling' && s.gi==='nogi')) return false;
      if (histFilter==='comp' && s.type!=='comp') return false;
      if (!q) return true;
      const hay = [s.notes, sessTitle(s), CATS[catOf(s)].label, ...(s.techniques||[]), ...(s.exercises||[]).map(e => e.name), ...(s.gtech||[]), ...(s.focus||[]), ...(s.strike?.spar||[]).flatMap(x => [x.partner, x.notes]),
        ...(s.rolls||[]).flatMap(r => [r.partner, ...(r.subsLanded||[]), ...(r.subsTapped||[]), ...(r.stuck||[])])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    let html = '', cur = '';
    list.forEach(s => { const d = parse(s.date), m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; if (m !== cur) { cur = m; const n = list.filter(x => x.date.startsWith(s.date.slice(0,7))).length; html += `<div class="month">${m} · ${n}</div>`; } html += sessRow(s); });
    $('#list').innerHTML = html || `<div class="empty">No matching workouts.</div>`;
  };
  $('#q').oninput = e => { histQuery = e.target.value; draw(); };
  v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { histFilter = b.dataset.f; v.querySelectorAll('.filters button').forEach(x => x.classList.toggle('on', x===b)); draw(); });
  draw();
}

function viewSession(id){
  const s = db.sessions.find(x => x.id === id);
  if (!s) { go('#/history'); return; }
  const c = catOf(s);
  setHeader(sessTitle(s), `<a class="btn sm" href="#/edit/${esc(s.id)}">Edit</a>`, { parent:'#/history' });
  const rolls = s.rolls||[];
  let body = '';
  if (c === 'grappling') body = `<div class="card"><h2>Techniques drilled</h2>${(s.techniques||[]).length ? `<div class="chips">${s.techniques.map(t => `<span class="chip" style="padding:7px 12px">${esc(t)}</span>`).join('')}</div>` : '<div class="empty" style="padding:4px 0">—</div>'}</div>
    <div class="card"><h2>Rolls <small>${rolls.filter(r=>r.result==='win').length}W · ${rolls.filter(r=>r.result==='loss').length}L · ${rolls.filter(r=>r.result==='draw').length}D</small></h2>${rolls.length ? rolls.map((r,i) => rollCard(r,i,false)).join('') : '<div class="empty" style="padding:4px 0">No rolls logged</div>'}</div>`;
  const chipCard = (arr, t) => (arr||[]).length ? `<div class="card"><h2>${t}</h2><div class="chips">${arr.map(x => `<span class="chip" style="padding:7px 12px">${esc(x)}</span>`).join('')}</div></div>` : '';
  if (c === 'striking' || c === 'mma') { const m = s.strike?.mix || {}; body = `<div class="card"><h2>Rounds <small>${s.rounds||0} × ${s.strike?.roundLen||3} min</small></h2><div class="mix">${mixOf(c).concat(Object.entries(MIX_LEGACY).filter(([k]) => m[k] > 0)).map(([k,l]) => `<div><b>${m[k]||0}</b><span>${l}</span></div>`).join('')}</div></div>
    ${(s.strike?.spar||[]).length ? `<div class="card"><h2>Sparring notes</h2>${s.strike.spar.map(x => `<div class="list-row"><div class="grow"><b>${esc(x.partner||'Partner')}</b><small style="white-space:pre-wrap">${esc(x.notes)}</small></div></div>`).join('')}</div>` : ''}
    ${chipCard(s.techniques, c === 'mma' ? 'Striking techniques' : 'Worked on')}${c === 'mma' ? chipCard(s.gtech, 'Grappling techniques') : ''}`; }
  if (c === 'mobility') body = chipCard((s.focus||[]).map(k => (FOCUS.find(f => f[0] === k)||[k,k])[1]), 'Focus areas');
  if (c === 'weights') { const prs = prMap(s.id); body = `<div class="card"><h2>Exercises <small>${Math.round(volumeOf(s)).toLocaleString()} ${unit()} volume</small></h2>${(s.exercises||[]).length ? s.exercises.map(e => { const best = Math.max(0, ...e.sets.map(x => e1rm(Number(x.weight)||0, Number(x.reps)||0))); const pr = best && best > (prs[e.name.toLowerCase()]?.e1 || 0); return `<div class="ex-view"><div class="t"><b>${esc(e.name)}</b>${pr ? '<span class="pill pr">PR</span>' : ''}</div><div class="sets">${e.sets.map((x,i) => `<span>${i+1}. ${x.reps||0} × ${x.weight||0}${x.rpe!==''&&x.rpe!=null?` @${x.rpe}`:''}</span>`).join('')}</div></div>`; }).join('') : '<div class="empty" style="padding:4px 0">No exercises logged</div>'}</div>`; }
  if (c === 'weights' && (s.cardioAdd||[]).length) body += `<div class="card" id="sessCardio"><h2>Cardio</h2>${s.cardioAdd.map(x => `<div class="list-row"><div class="grow"><b>${esc(cardioLabel(x.type))}</b><small>${esc([x.min ? `${x.min} min` : '', x.distance ? `${r1(x.distance)} ${x.unit}` : ''].filter(Boolean).join(' · '))}</small></div></div>`).join('')}</div>`;
  if (c === 'cardio' && s.cardio) { const k = s.cardio; body = `<div class="kv"><div><b>${k.distance ? r1(k.distance) : '—'}<small style="font-size:13px;color:var(--muted)"> ${k.unit}</small></b><span>Distance</span></div><div><b>${k.sec ? fmtDur(k.sec) : s.duration+'m'}</b><span>Time</span></div><div><b>${(s.discipline==='bike' ? speedStr(k.sec,k.distance,k.unit) : paceStr(k.sec,k.distance,k.unit)) || '—'}</b><span>${s.discipline==='bike'?'Speed':'Pace'}</span></div></div>`; }
  $('#view').innerHTML = `
    <div class="sess-meta">${catDot(c)}${CATS[c].label} · ${fmtDate(s.date)} ${c==='grappling'&&s.discipline==='bjj' ? `<span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>` : ''}${s.sample?'<span class="pill sample">Sample</span>':''}${s.source?`<span class="pill">📎 ${esc(s.source)}</span>`:''}</div>
    <div class="kv"><div><b>${s.duration}<small style="font-size:13px;color:var(--muted)"> min</small></b><span>Duration</span></div><div><b>${c==='weights'||c==='cardio'||c==='mobility' ? loadOf(s) : (s.rounds||0)}</b><span>${c==='weights'||c==='cardio'||c==='mobility' ? 'Load' : 'Rounds'}</span></div><div><b data-effort>${rpeOf(s)}/10</b><span>Effort${s.rpe ? '' : ' (est.)'}</span></div></div>
    ${s.feel ? `<div class="card feelrow" style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--muted);font-weight:650">Felt</span><b style="font-size:20px" data-feel>${FEELS[s.feel-1][1]} ${FEELS[s.feel-1][2]}</b></div>` : ''}
    ${s.prog && tmplOf(s.prog.tid) ? `<div class="sess-meta" style="margin-top:-4px">🏋️ ${esc(tmplOf(s.prog.tid).name)} · week ${s.prog.w}</div>` : ''}
    ${body}
    ${s.weight ? `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--muted);font-weight:650">Body weight</span><b style="font-size:20px">${esc(s.weight)} ${unit()}</b></div>` : ''}
    ${s.notes ? `<div class="card"><h2>Notes</h2><div style="white-space:pre-wrap">${esc(s.notes)}</div></div>` : ''}
    <div style="display:flex;gap:10px;margin-top:6px"><a class="btn primary" style="flex:1" href="#/edit/${esc(s.id)}">Edit</a><button class="btn" id="shareSession" style="flex:1">Share</button><button class="btn danger" id="del">Delete</button></div>`;
  $('#shareSession').onclick = () => shareSheet('session', s);
  $('#del').onclick = async () => { if (await confirmSheet('Delete this workout?', `${fmtDate(s.date)} · ${sessTitle(s)}. This can't be undone.`)) { db.sessions = db.sessions.filter(x => x.id !== s.id); save(); toast('Workout deleted'); go('#/history'); } };
}

function rollCard(r, i, editable){
  const res = { win:'Won', loss:'Lost', draw:'Draw' }[r.result] || 'Draw';
  const chips = [...(r.subsLanded||[]).map(x => `<span class="chip">✓ ${esc(x)}</span>`), ...(r.subsTapped||[]).map(x => `<span class="chip loss">✕ ${esc(x)}</span>`), ...(r.stuck||[]).map(x => `<span class="chip neutral">⚠ ${esc(x)}</span>`)].join('');
  return `<div class="roll" data-i="${i}"><div class="roll-h"><span class="n">${i+1}</span><span class="who">${esc(r.partner || 'Partner not set')}</span><span class="res ${r.result||'draw'}">${res}</span>
    ${editable ? `<button type="button" class="iconbtn" data-edit aria-label="Edit roll"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>` : ''}</div>${chips ? `<div class="chips">${chips}</div>` : ''}</div>`;
}

/* PRs: best estimated 1RM / heaviest set per exercise, optionally excluding one session */
function prMap(excludeId){
  const m = {};
  db.sessions.forEach(s => { if (s.id === excludeId) return; (s.exercises||[]).forEach(e => e.sets.forEach(x => {
    const w = Number(x.weight)||0, r = Number(x.reps)||0, k = e.name.toLowerCase(), v = e1rm(w, r);
    const cur = m[k] || (m[k] = { name:e.name, e1:0, w:0, r:0, date:'', reps:0 });
    if (v > cur.e1) Object.assign(cur, { e1:v, w, r, date:s.date });
    if (!w && r > cur.reps) cur.reps = r;
  })); });
  return m;
}

/* ---------------- session form (quick log + details) ---------------- */
let form = null;
function blankSession(cat){
  cat = cat || catOf(sorted().find(s => enabledCats().includes(catOf(s))) || { category:enabledCats()[0] });
  const last = lastOf(cat);
  return { id:null, date:today(), category:cat, discipline:(last && CATS[cat].disc.some(d => d[0] === last.discipline) ? last.discipline : CATS[cat].disc[0][0]), gi:last?.gi || 'gi', type:'class',
    duration:last?.duration || CATS[cat].dur, rounds:cat==='grappling' ? 5 : (cat==='striking' || cat==='mma') ? (last?.rounds||6) : 0, intensity:3, rpe:'', feel:'', techniques:[], gtech:[], focus:[], rolls:[], weight:'', notes:'',
    strike:{ roundLen:last?.strike?.roundLen || (cat === 'mma' ? 5 : 3), mix:Object.fromEntries(mixOf(cat).map(([k]) => [k, 0])), spar:[] },
    exercises:[], cardioAdd:[], cardio:{ distance:'', unit:distU(), sec:0 }, _open:false };
}
function hydrate(s){
  const b = blankSession(catOf(s)), f = JSON.parse(JSON.stringify(s));
  f.strike = f.strike ? { ...b.strike, ...f.strike, mix:{ ...b.strike.mix, ...(f.strike.mix||{}) }, spar:f.strike.spar||[] } : b.strike;
  f.gtech = f.gtech || []; f.focus = f.focus || []; f.rpe = f.rpe || ''; f.feel = f.feel || '';
  f.exercises = f.exercises || []; f.cardioAdd = f.cardioAdd || []; f.cardio = f.cardio || b.cardio;
  f._open = true; return f;
}
function toRecord(f){
  const c = f.category, out = { ...f };
  delete out._open; delete out._durTouched;
  if (c !== 'grappling') { out.rolls = []; }
  if (c !== 'striking' && c !== 'mma') delete out.strike; else out.strike = { ...f.strike, mix:{ ...Object.fromEntries(Object.keys(MIX_LEGACY).filter(k => Number(f.strike.mix[k]) > 0).map(k => [k, Number(f.strike.mix[k])])), ...Object.fromEntries(mixOf(c).map(([k]) => [k, Number(f.strike.mix[k])||0])) } };
  if (c !== 'mma' || !f.gtech.length) delete out.gtech;
  if (c !== 'mobility' || !f.focus.length) delete out.focus;
  if (c === 'mobility') out.techniques = [];
  if (c === 'striking' || c === 'mma') out.rounds = Math.max(Number(f.rounds)||0, mixOf(c).reduce((a,[k]) => a + (Number(f.strike.mix[k])||0), 0));
  delete out.startedAt;
  if (c !== 'weights') { delete out.exercises; delete out.cardioAdd; } else { out.exercises = f.exercises.map(e => ({ ...e, sets:e.sets.filter(x => x.reps !== '' || x.weight !== '') }));
    const ca = (f.cardioAdd||[]).filter(x => num(x.min) || num(x.distance)); if (ca.length) out.cardioAdd = ca; else delete out.cardioAdd;
    if (f.startedAt && !f._durTouched && f.exercises.some(e => e.sets.some(x => x.done))) out.duration = Math.max(1, Math.min(600, Math.round((Date.now() - f.startedAt) / 60000))); }
  if (c !== 'cardio') delete out.cardio; else if (!f.cardio.distance && !f.cardio.sec) delete out.cardio;
  if (c === 'grappling') out.rounds = Math.max(Number(f.rounds)||0, f.rolls.length);
  if (c === 'cardio' && f.cardio.sec) out.duration = Math.max(1, Math.round(f.cardio.sec/60));
  if (Number(f.rpe) >= 1) out.intensity = Math.ceil(Number(f.rpe) / 2); else delete out.rpe; // intensity (1-5) kept in sync for older exports
  if (!(Number(f.feel) >= 1)) delete out.feel;
  if (!f.prog) delete out.prog;
  return out;
}

function viewForm(id){
  const editing = !!id;
  if (editing) {
    const s = db.sessions.find(x => x.id === id);
    if (!s) { go('#/history'); return; }
    if (!form || form.id !== id) { form = hydrate(s); formBase = null; }
  } else if (!form || form.id) { if (!draftResume()) { form = blankSession(); formBase = null; } }
  setHeader(editing ? 'Edit workout' : 'Log workout', '', { label:'Cancel', parent: editing ? `#/session/${id}` : '#/' });
  const v = $('#view'); v.innerHTML = '';
  const f = form, cats = enabledCats();
  if (!cats.includes(f.category) && !editing) cats.push(f.category);
  if (editing && !cats.includes(f.category)) cats.push(f.category);
  const redraw = () => { const y = window.scrollY; viewForm(id); window.scrollTo(0, y); };

  if (!editing) { const rb = repeatButtons(true); if (rb) { const r = h(`<div class="field"><label>One tap: log again</label>${rb}</div>`); wireRepeat(r, () => { go('#/'); }); v.appendChild(r); } }

  // 1. category
  document.body.dataset.theme = f.category;   // the whole form takes the category colour (CSS vars on body)
  const catEl = h(`<div class="cats n${cats.length}" role="radiogroup">${cats.map(k => `<button type="button" role="radio" data-c="${k}" class="${f.category===k?'on':''}" aria-checked="${f.category===k}" style="--cat:${CATS[k].color}"><svg viewBox="0 0 24 24">${CATS[k].icon}</svg>${CATS[k].label}</button>`).join('')}</div>`);
  catEl.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (f.category === b.dataset.c) return;
    const nb = blankSession(b.dataset.c);
    f.category = nb.category; f.discipline = nb.discipline; f.gi = nb.gi;
    if (!f._durTouched) f.duration = nb.duration;
    if ((f.category === 'striking' || f.category === 'mma') && !f.rounds) f.rounds = nb.rounds;
    f.strike = nb.strike;
    redraw();
  });
  v.appendChild(field('Workout', catEl));
  // 2. discipline (+ gi for BJJ)
  const C = CATS[f.category];
  const discOpts = [...C.disc, ...(C.legacy || []).filter(d => d[0] === f.discipline)];   // a legacy type shows only when editing a session that has it
  if (C.disc.length > 1) { const ds = seg(discOpts, f.discipline, x => { f.discipline = x; if (f.category === 'grappling') redraw(); }, C.disc.length > 4); if (C.disc.length > 4) ds.classList.add('three'); v.appendChild(field(C.discLabel || (f.category === 'cardio' ? 'Activity' : 'Style'), ds)); }
  if (f.category === 'grappling' && f.discipline === 'bjj') v.appendChild(field('Uniform', seg([['gi','Gi'],['nogi','No-Gi']], f.gi, x => f.gi = x)));
  // 3. duration + date
  const g = h('<div class="durdate"></div>');
  g.appendChild(field('Duration', stepper(f.duration, { step:f.category==='cardio' ? 5 : 15, min:0, max:600, unitLabel:'min', onChange:x => { f.duration = x; f._durTouched = true; } })));
  const date = h(`<input class="input" type="date" value="${esc(f.date)}" max="${today()}">`);
  date.onchange = () => { f.date = date.value || today(); };
  g.appendChild(field('Date', date));
  v.appendChild(g);

  // 4. details expander
  // 4. details: always visible, every field below is optional
  const det = h(`<section class="details-sec" id="detailsSec"><h3 class="sect-title">Details <small>(optional)</small></h3></section>`);
  const D = det;
  // file import
  const notes = h(`<textarea class="input" placeholder="What clicked? What to work on next time?">${esc(f.notes)}</textarea>`);
  notes.oninput = () => f.notes = notes.value;
  const notesF = field('Notes', notes); let notesPlaced = false;
  const feelEl = h(`<div class="feelpick" role="radiogroup" aria-label="How did it feel?">${FEELS.map(([n, e, l]) => `<button type="button" role="radio" data-feel="${n}" aria-label="${l}" aria-checked="false"><span>${e}</span><small>${l}</small></button>`).join('')}</div>`);
  const syncFeel = () => feelEl.querySelectorAll('button').forEach(b => { const on = Number(b.dataset.feel) === Number(f.feel); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  feelEl.querySelectorAll('button').forEach(b => b.onclick = () => { f.feel = Number(f.feel) === Number(b.dataset.feel) ? '' : Number(b.dataset.feel); syncFeel(); }); syncFeel();
  const placeNotes = () => { if (!notesPlaced) { D.appendChild(notesF); D.appendChild(field('How did it feel?', feelEl)); notesPlaced = true; } };
  const inj = activeInjuries(); if (inj.length) D.appendChild(h(`<div class="warnline injnote" id="injReminder">🩹 Active: ${inj.slice(0,2).map(x => `${esc(injName(x))} (severity ${x.severity})`).join(', ')}. Train around it.</div>`));
  if (f.prog && tmplOf(f.prog.tid)) { const rx = activeProgram() && activeProgram().uid === f.prog.puid ? prescription(activeProgram(), progSchedule(activeProgram())[f.prog.i] || { w:f.prog.w, key:f.prog.key }) : null;
    D.appendChild(h(`<div class="progbanner" id="progBanner"><b>🏋️ ${esc(tmplOf(f.prog.tid).name)}</b><span>${esc(rx ? rx.title : `Week ${f.prog.w}`)}${rx && rx.phase ? ` · ${esc(rx.phase)}` : ''}</span>${rx && rx.note ? `<small>${esc(rx.note)}</small>` : ''}<small>Weights are suggested from your last log. All sets done last time → small increase.</small></div>`)); }
  if (COMBAT(f.category)) {
    f.type = fixType(f.category, f.type);
    D.appendChild(field('Session type', seg(typesFor(f.category), LEGACY_TYPES.includes(f.type) ? 'class' : f.type, x => f.type = x, true)));
  }
  if (f.category === 'grappling') {
    D.appendChild(field('Techniques drilled', tagField({ values:f.techniques, suggestions:() => uniqueMerge(usedTechniques(), TECHNIQUES), placeholder:'Add technique…' })));
    placeNotes();
    const roundsStep = stepper(f.rounds, { min:0, max:50, unitLabel:'rds', onChange:x => f.rounds = x });
    D.appendChild(field('Rounds', roundsStep));
    const rollsWrap = h(`<div class="field"><div class="label" style="display:flex;justify-content:space-between;align-items:center">Rolls <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:600" id="rollSum"></span></div><div id="rollList"></div><button type="button" class="btn block" id="addRoll"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add roll</button></div>`);
    D.appendChild(rollsWrap);
    const drawRolls = () => {
      const list = rollsWrap.querySelector('#rollList');
      list.innerHTML = f.rolls.map((r,i) => rollCard(r,i,true)).join('');
      list.querySelectorAll('.roll').forEach(el => el.onclick = () => editRoll(Number(el.dataset.i)));
      rollsWrap.querySelector('#rollSum').textContent = f.rolls.length ? `${f.rolls.filter(r=>r.result==='win').length}W · ${f.rolls.filter(r=>r.result==='loss').length}L · ${f.rolls.filter(r=>r.result==='draw').length}D` : 'Optional';
      if (f.rolls.length > f.rounds) { f.rounds = f.rolls.length; roundsStep.querySelector('input').value = f.rounds; }
    };
    const editRoll = i => {
      const isNew = i == null;
      const r = isNew ? { id:uid(), partner:'', result:'draw', subsLanded:[], subsTapped:[], stuck:[] } : JSON.parse(JSON.stringify(f.rolls[i]));
      const el = h(`<div><h3>${isNew ? `Roll ${f.rolls.length+1}` : `Edit roll ${i+1}`}</h3></div>`);
      const partner = h(`<input class="input" type="text" autocapitalize="words" autocomplete="off" placeholder="Optional" value="${esc(r.partner)}" list="partners">`);
      const pw = h('<div></div>'); pw.appendChild(partner); pw.appendChild(h(`<datalist id="partners">${usedPartners().map(p => `<option value="${esc(p)}">`).join('')}</datalist>`));
      partner.oninput = () => r.partner = partner.value;
      el.appendChild(field('Partner', pw));
      el.appendChild(field('Result', seg([['win','Won'],['draw','Draw'],['loss','Lost']], r.result, x => r.result = x)));
      const subList = () => uniqueMerge(usedSubs(), SUBMISSIONS);
      el.appendChild(field('Submissions landed', tagField({ values:r.subsLanded, suggestions:subList, placeholder:'e.g. Armbar' })));
      el.appendChild(field('Tapped to', tagField({ values:r.subsTapped, suggestions:subList, placeholder:'e.g. Triangle', kind:'loss' })));
      el.appendChild(field('Got stuck in', tagField({ values:r.stuck, suggestions:() => uniqueMerge(usedPositions(), POSITIONS), placeholder:'Position…', kind:'neutral' })));
      const btns = h(`<div style="display:flex;gap:10px;margin-top:8px">${isNew ? '' : '<button type="button" class="btn danger" data-del>Remove</button>'}<button type="button" class="btn primary" style="flex:1" data-save>${isNew ? 'Add roll' : 'Save roll'}</button></div>`);
      btns.querySelector('[data-save]').onclick = () => { r.partner = partner.value.trim(); if (isNew) f.rolls.push(r); else f.rolls[i] = r; closeSheet(); drawRolls(); };
      const del = btns.querySelector('[data-del]'); if (del) del.onclick = () => { f.rolls.splice(i,1); closeSheet(); drawRolls(); };
      el.appendChild(btns);
      openSheet(el, null, { closeLabel:'Cancel' });
    };
    rollsWrap.querySelector('#addRoll').onclick = () => editRoll(null);
    drawRolls();
  }
  if (f.category === 'striking' || f.category === 'mma') {
    const mma = f.category === 'mma', MIX = mixOf(f.category);
    const strikeSugg = () => uniqueMerge(countBy(db.sessions.filter(s => catOf(s)==='striking' || catOf(s)==='mma').flatMap(s => s.techniques||[])).map(x => x[0]), STRIKE_TECH);
    D.appendChild(field(mma ? 'Striking techniques' : 'Worked on', tagField({ values:f.techniques, suggestions:strikeSugg, placeholder:'Combo, technique…' })));
    if (mma) D.appendChild(field('Grappling techniques', tagField({ values:f.gtech, suggestions:() => uniqueMerge(usedTechniques(), TECHNIQUES), placeholder:'Takedown, sub, position…' })));
    placeNotes();
    const g2 = h('<div class="grid2"></div>');
    const rs = stepper(f.rounds, { min:0, max:60, unitLabel:'rds', onChange:x => f.rounds = x });
    g2.appendChild(field('Total rounds', rs));
    g2.appendChild(field('Round length', stepper(f.strike.roundLen, { min:1, max:10, unitLabel:'min', onChange:x => f.strike.roundLen = x })));
    D.appendChild(g2);
    const mix = h('<div class="mixgrid"></div>');
    MIX.forEach(([k,l]) => mix.appendChild(field(l, stepper(f.strike.mix[k]||0, { min:0, max:40, unitLabel:'', onChange:x => { f.strike.mix[k] = x; const sum = MIX.reduce((a,[kk]) => a + (Number(f.strike.mix[kk])||0), 0); if (sum > f.rounds) { f.rounds = sum; rs.querySelector('input').value = sum; } } }))));
    D.appendChild(field('Rounds by type', mix));
    const sp = h(`<div class="field"><label>Sparring partners</label><div class="sparlist"></div><button type="button" class="btn block" id="addSpar"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add sparring partner</button></div>`);
    const drawSpar = () => { const L = sp.querySelector('.sparlist'); L.innerHTML = ''; f.strike.spar.forEach((x,i) => {
      const row = h(`<div class="spar"><div style="display:flex;gap:8px"><input class="input" type="text" autocapitalize="words" placeholder="Partner" value="${esc(x.partner)}"><button type="button" class="iconbtn big" aria-label="Remove partner"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><textarea class="input" rows="2" placeholder="What worked, what to fix…">${esc(x.notes)}</textarea></div>`);
      row.querySelector('input').oninput = e => x.partner = e.target.value; row.querySelector('textarea').oninput = e => x.notes = e.target.value;
      row.querySelector('button').onclick = () => { f.strike.spar.splice(i,1); drawSpar(); }; L.appendChild(row); }); };
    sp.querySelector('#addSpar').onclick = () => { f.strike.spar.push({ partner:'', notes:'' }); drawSpar(); sp.querySelector('.spar:last-child input').focus(); };
    drawSpar(); D.appendChild(sp);
  }
  if (f.category === 'mobility') {
    const fc = h(`<div class="focuschips" role="group" aria-label="Focus areas">${FOCUS.map(([k,l]) => `<button type="button" data-f="${k}" aria-pressed="false">${l}</button>`).join('')}</div>`);
    const syncF = () => fc.querySelectorAll('button').forEach(b => { const on = f.focus.includes(b.dataset.f); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    fc.querySelectorAll('button').forEach(b => b.onclick = () => { const k = b.dataset.f; f.focus = f.focus.includes(k) ? f.focus.filter(x => x !== k) : f.focus.concat(k); syncF(); });
    syncF(); D.appendChild(field('Focus areas', fc)); placeNotes();
  }
  if (f.category === 'weights') {
    let ed = exerciseEditor(f);
    D.appendChild(ed); D.appendChild(cardioAddEditor(f)); placeNotes(); }
  if (f.category === 'cardio') {
    const k = f.cardio;
    const g3 = h('<div class="grid2"></div>');
    const dist = h(`<div class="stepper" style="padding-left:14px"><input type="text" inputmode="decimal" placeholder="0.0" value="${esc(k.distance)}" style="text-align:left;font-weight:650" data-k="distance"><span class="unit" style="padding-right:12px"></span></div>`);
    const di = dist.querySelector('input');
    g3.appendChild(field('Distance', dist));
    g3.appendChild(field('Unit', seg([['mi','mi'],['km','km']], k.unit, x => { if (num(k.distance)) { k.distance = r2(toUnit(num(k.distance), k.unit, x)); di.value = k.distance; } k.unit = x; drawPace(); })));
    D.appendChild(g3);
    const hh = Math.floor(k.sec/3600), mm = Math.floor(k.sec%3600/60), ss = k.sec%60;
    const tm = h(`<div class="hms"><input class="input" type="text" inputmode="numeric" aria-label="Hours" placeholder="h" value="${k.sec?hh:''}"><span>:</span><input class="input" type="text" inputmode="numeric" aria-label="Minutes" placeholder="mm" value="${k.sec?pad(mm):''}"><span>:</span><input class="input" type="text" inputmode="numeric" aria-label="Seconds" placeholder="ss" value="${k.sec?pad(ss):''}"></div>`);
    const paceEl = h('<div class="pace"></div>');
    const [ih, im, is] = tm.querySelectorAll('input');
    const readT = () => { k.sec = (num(ih.value)*3600) + (num(im.value)*60) + num(is.value); if (k.sec) f.duration = Math.max(1, Math.round(k.sec/60)); drawPace(); };
    [ih, im, is].forEach(i => i.oninput = readT);
    di.oninput = () => { k.distance = di.value.replace(/[^\d.]/g,''); drawPace(); };
    function drawPace(){ const d = num(k.distance); paceEl.innerHTML = d && k.sec ? `<span>Pace <b>${paceStr(k.sec, d, k.unit)}</b></span><span>Speed <b>${speedStr(k.sec, d, k.unit)}</b></span>` : '<span>Enter distance and time to see your pace</span>'; }
    D.appendChild(field('Time (h:mm:ss)', tm)); D.appendChild(paceEl); drawPace(); placeNotes();
  }
  placeNotes();
  {
    const eff = h(`<div><div class="effort">${[1,2,3,4,5,6,7,8,9,10].map(i => `<button type="button" data-r="${i}" aria-label="Effort ${i} of 10">${i}</button>`).join('')}</div><div class="hint" id="effLabel"></div></div>`);
    const syncE = () => { eff.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.r) === Number(f.rpe))); const r = Number(f.rpe);
      eff.querySelector('#effLabel').textContent = r ? `${RPE_LABEL[r]} · load ${Math.round((Number(f.duration)||0) * r)} (min × effort)` : 'Optional. 1 = very easy, 10 = max effort.'; };
    eff.querySelectorAll('button').forEach(b => b.onclick = () => { f.rpe = Number(f.rpe) === Number(b.dataset.r) ? '' : Number(b.dataset.r); syncE(); });
    syncE(); D.appendChild(field('Effort (RPE)', eff));
  }
  v.appendChild(det);

  const actions = h(`<div class="actions">${editing ? '<button type="button" class="btn danger" data-del style="flex:0 0 auto">Delete</button>' : ''}<button type="button" class="btn primary" data-save>${editing ? 'Save changes' : 'Save workout'}</button></div>`);
  actions.querySelector('[data-save]').onclick = () => {
    if (!f.duration && !(f.category==='cardio' && f.cardio.sec)) { toast('Add a duration'); return; }
    const rec = sanitizeSession({ ...toRecord(f), updatedAt: Date.now() });
    if (editing) { const i = db.sessions.findIndex(x => x.id === f.id); rec.sample = false; db.sessions[i] = rec; }
    else { rec.id = uid(); rec.createdAt = Date.now(); db.sessions.push(rec); }
    save(); form = null; if (!editing) draftClear();
    toast(editing ? 'Workout updated' : 'Workout saved 🤙');
    go(editing ? `#/session/${rec.id}` : '#/');
    afterStrengthSave();
  };
  if (formBase == null) formBase = formSnap(f);
  const d = actions.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (await confirmSheet('Delete this workout?', "This can't be undone.")) { db.sessions = db.sessions.filter(x => x.id !== f.id); save(); form = null; toast('Workout deleted'); go('#/history'); } };
  actions.classList.add('stick');
  v.appendChild(actions);
}
const r2 = n => Math.round(n*100)/100;
/* 3.15.0: cardio inside a Weights workout */
const cardioLabel = t => (allDisc('cardio').find(d => d[0] === t) || [t, 'Cardio'])[1];
const cardioAddMin = s => catOf(s) === 'weights' ? (s.cardioAdd||[]).reduce((a,x) => a + (Number(x.min)||0), 0) : 0;
const cardioAddText = x => `+ ${[x.min ? `${x.min} min` : '', x.distance ? `${r1(x.distance)} ${x.unit}` : ''].filter(Boolean).join(' ')} ${cardioLabel(x.type).toLowerCase()}`;
function cardioAddEditor(f){
  const wrap = h(`<div class="field" id="cardioAdd"><div class="label">Cardio <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:600">Optional</span></div><div class="calist"></div><button type="button" class="btn block" id="addCardio"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add cardio</button></div>`);
  const list = wrap.querySelector('.calist');
  const draw = () => { list.innerHTML = ''; f.cardioAdd.forEach((x, i) => {
    const row = h(`<div class="excard carow"><div class="exhead"><select class="input" aria-label="Cardio type" data-ca="type">${CATS.cardio.disc.map(([k,l]) => `<option value="${k}"${x.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select><button type="button" class="iconbtn big" aria-label="Remove cardio"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div>
      <div class="grid2" style="margin-top:8px"><label class="stepper"><input type="text" inputmode="numeric" placeholder="0" value="${esc(x.min)}" aria-label="Minutes" data-ca="min"><span class="unit">min</span></label><label class="stepper"><input type="text" inputmode="decimal" placeholder="Distance" value="${esc(x.distance)}" aria-label="Distance (optional)" data-ca="distance"><span class="unit">${esc(x.unit)}</span></label></div></div>`);
    row.querySelector('select').onchange = ev => { x.type = ev.target.value; draftSave(); };
    row.querySelectorAll('input').forEach(inp => inp.oninput = () => { x[inp.dataset.ca] = inp.value.replace(/[^\d.]/g,''); });
    row.querySelector('.iconbtn').onclick = () => { f.cardioAdd.splice(i, 1); draw(); draftSave(); };
    list.appendChild(row); }); };
  wrap.querySelector('#addCardio').onclick = () => { const last = f.cardioAdd[f.cardioAdd.length-1] || (db.sessions.find(s => s.cardioAdd) || {}).cardioAdd?.[0]; f.cardioAdd.push({ type:last ? last.type : 'stairs', min:'', distance:'', unit:distU() }); draw(); draftSave(); const m = list.querySelectorAll('[data-ca="min"]'); m[m.length-1]?.focus(); };
  draw(); return wrap;
}
/* 3.15.0: in-progress workout draft survives a lock, reload or app kill */
const DRAFT_KEY = 'forged.draft';
const readDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && d.form && CATS[d.form.category] ? d : null; } catch(e) { return null; } };
function draftSave(){
  if (!form || form.id || !onForm() || formBase == null) return;
  if (formSnap(form) === formBase && !readDraft()) return;
  if (!form.startedAt) form.startedAt = Date.now();
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, base:formBase, at:Date.now() })); } catch(e) {}
}
const draftClear = () => { try { localStorage.removeItem(DRAFT_KEY); } catch(e) {} };
function draftResume(){ const d = readDraft(); if (!d) return false; form = d.form; form._open = true; formBase = d.base; return true; }
const fmtElapsed = ms => { const t = Math.max(0, Math.floor(ms/1000)), hh = Math.floor(t/3600), mm = Math.floor(t%3600/60), ss = t%60; return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`; };
function tickElapsed(){ document.querySelectorAll('[data-elapsed]').forEach(el => { const st = form && form.startedAt || (readDraft()?.form.startedAt); el.textContent = st ? fmtElapsed(Date.now() - st) : ''; }); }
setInterval(tickElapsed, 1000);
['input','change','click'].forEach(t => document.addEventListener(t, () => setTimeout(draftSave, 0), true));
document.addEventListener('visibilitychange', () => { draftSave(); if (!document.hidden) tickElapsed(); });
window.addEventListener('pagehide', draftSave);
function draftBanner(){ const d = readDraft(); if (!d || (form && !form.id && onForm())) return '';
  const f = d.form, n = (f.exercises||[]).length;
  return `<div class="banner live" id="draftBanner"><span>⏱ <b>Workout in progress</b><small>${esc(CATS[f.category].label)}${n ? ` · ${n} exercise${n > 1 ? 's' : ''}` : ''}${f.startedAt ? ` · <span data-elapsed>${fmtElapsed(Date.now() - f.startedAt)}</span>` : ''}</small></span><button class="btn sm" id="draftDiscard">Discard</button><button class="btn sm primary" id="draftResume">Resume</button></div>`; }
function wireDraft(v){
  const r = v.querySelector('#draftResume'); if (r) r.onclick = () => { draftResume(); go('#/log'); };
  const x = v.querySelector('#draftDiscard'); if (x) x.onclick = async () => { if (await confirmSheet('Discard this workout?', 'What you entered will be lost.', 'Discard', true)) { draftClear(); form = null; formBase = null; route(); } };
}

function exMeta(e){
  const L = e.plan && PROG.library[e.name]; if (!L) return '';
  const tgt = `${e.plan.sets} × ${e.plan.lo === e.plan.hi ? e.plan.lo : `${e.plan.lo}–${e.plan.hi}`}${e.plan.unit === 'sec' ? ' s' : e.plan.unit === 'm' ? ' m' : ''}${L.each ? ' each' : ''}`;
  const sg = e._sugg === 'up' ? ' · <b class="up">↑ progress</b>' : e._sugg === 'repeat' ? ' · repeat last' : '';
  return `<div class="excue"><div class="grow"><span>${esc(L.cue)}</span><small>Target ${tgt}${e._rest ? ` · rest ${esc(e._rest)}` : ''}${sg}</small></div><button type="button" class="btn sm" data-swap>Swap</button></div>`;
}
function exerciseEditor(f){
  const wrap = h(`<div class="field"><div class="label" style="display:flex;justify-content:space-between">Exercises <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:600" id="volSum"></span></div><div class="livebar" id="liveBar"${f.startedAt ? '' : ' hidden'}>⏱ <b data-elapsed>${f.startedAt ? fmtElapsed(Date.now() - f.startedAt) : ''}</b><small>Saved as you go</small></div><div class="exlist"></div><button type="button" class="btn block" id="addEx"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add exercise</button></div>`);
  const list = wrap.querySelector('.exlist');
  const known = () => uniqueMerge(countBy(db.sessions.flatMap(s => (s.exercises||[]).map(e => e.name))).map(x => x[0]), EXERCISES);
  const prs = prMap(f.id);
  const drawSum = () => { const v = f.exercises.reduce((a,e) => a + e.sets.reduce((b,x) => b + num(x.reps)*num(x.weight), 0), 0); wrap.querySelector('#volSum').textContent = v ? `${Math.round(v).toLocaleString()} ${unit()} volume` : 'Optional'; };
  const draw = () => {
    list.innerHTML = '';
    f.exercises.forEach((e, ei) => {
      const card = h(`<div class="excard"><div class="exhead"><input class="input exname" type="text" autocapitalize="words" autocomplete="off" placeholder="Exercise" value="${esc(e.name)}"><button type="button" class="iconbtn big" aria-label="Remove exercise"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div><div class="sugg"></div>${exMeta(e)}
        <div class="sethead"><span>Set</span><span>Reps</span><span>${unit()}</span><span>RPE</span><span>Done</span><span></span></div><div class="sets"></div><div class="exfoot"><button type="button" class="btn sm" data-addset>+ Add set</button><span class="prnote"></span></div></div>`);
      const name = card.querySelector('.exname'), sugg = card.querySelector('.sugg');
      const drawSugg = () => { const q = name.value.trim().toLowerCase(); sugg.innerHTML = ''; if (document.activeElement !== name && e.name) return;
        known().filter(x => !q || x.toLowerCase().includes(q)).filter(x => x.toLowerCase() !== q).slice(0,10).forEach(x => { const b = h(`<button type="button">${esc(x)}</button>`); b.onclick = () => { e.name = x; name.value = x; sugg.innerHTML = ''; drawPR(); }; sugg.appendChild(b); }); };
      sugg.addEventListener('mousedown', ev => ev.preventDefault());
      name.oninput = () => { e.name = name.value; drawSugg(); drawPR(); }; name.onfocus = drawSugg; name.onblur = () => setTimeout(() => { sugg.innerHTML = ''; }, 150);
      card.querySelector('.exhead .iconbtn').onclick = () => { f.exercises.splice(ei,1); draw(); };
      const sw = card.querySelector('[data-swap]'); if (sw) sw.onclick = () => { const orig = e._orig || e.name; swapSheet(orig, e.name, n => {
        const L = PROG.library[n] || {}, sg = suggest(n, { sets:e.plan.sets, reps:[e.plan.lo, e.plan.hi] }); e.name = n; e.plan = { ...e.plan, unit:L.unit || 'reps' }; e._sugg = sg.basis;
        e.sets = e.sets.map(() => ({ reps:sg.reps, weight:sg.weight, rpe:'' }));
        if (f.prog && activeProgram() && activeProgram().uid === f.prog.puid) setSwap(orig, n);
        toast(`Swapped to ${n}`); draw(); }); };
      const setsEl = card.querySelector('.sets');
      const drawPR = () => { const p = prs[(e.name||'').trim().toLowerCase()]; const best = Math.max(0, ...e.sets.map(x => e1rm(num(x.weight), num(x.reps))));
        card.querySelector('.prnote').innerHTML = best && (!p || best > p.e1) ? `<span class="pill pr">New PR</span> est. 1RM ${Math.round(best)}` : p ? `PR: ${p.w} × ${p.r} (est. ${Math.round(p.e1)})` : ''; };
      const drawSets = () => { setsEl.innerHTML = ''; e.sets.forEach((x, si) => {
        const row = h(`<div class="setrow"><span>${si+1}</span><input class="input" type="text" inputmode="numeric" value="${esc(x.reps)}" aria-label="Reps" data-f="reps"><input class="input" type="text" inputmode="decimal" value="${esc(x.weight)}" aria-label="Weight" data-f="weight"><input class="input" type="text" inputmode="decimal" value="${esc(x.rpe)}" placeholder="—" aria-label="RPE" data-f="rpe"><button type="button" class="setdone${x.done ? ' on' : ''}" aria-pressed="${!!x.done}" aria-label="Set ${si+1} done" data-done><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></button><button type="button" class="iconbtn" aria-label="Remove set" data-rmset><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`);
        row.querySelectorAll('input').forEach(i => i.oninput = () => { x[i.dataset.f] = i.value.replace(/[^\d.]/g,''); drawSum(); drawPR(); });
        row.querySelector('[data-done]').onclick = () => { x.done = !x.done; if (x.done && !f.startedAt) f.startedAt = Date.now(); row.classList.toggle('done', x.done); const b = row.querySelector('[data-done]'); b.classList.toggle('on', x.done); b.setAttribute('aria-pressed', x.done); const lb = wrap.querySelector('#liveBar'); if (f.startedAt && lb) { lb.hidden = false; tickElapsed(); } draftSave(); };
        if (x.done) row.classList.add('done');
        row.querySelector('[data-rmset]').onclick = () => { e.sets.splice(si,1); drawSets(); drawSum(); drawPR(); };
        setsEl.appendChild(row); }); };
      card.querySelector('[data-addset]').onclick = () => { const l = e.sets[e.sets.length-1]; e.sets.push(l ? { ...l, done:false } : { reps:'', weight:'', rpe:'' }); drawSets(); drawSum(); const ins = setsEl.querySelectorAll('.setrow:last-child input'); ins[0] && ins[0].focus(); };
      drawSets(); drawPR(); list.appendChild(card);
    });
    drawSum();
  };
  wrap.querySelector('#addEx').onclick = () => { f.exercises.push({ name:'', sets:[{ reps:'', weight:'', rpe:'' }] }); draw(); const ins = list.querySelectorAll('.exname'); const last = ins[ins.length-1]; last && last.focus(); };
  draw();
  return wrap;
}

/* ---------------- stats (deeper view) ---------------- */
function catHours(days){
  const from = iso(addDays(new Date(), -(days-1))), m = Object.fromEntries(CAT_KEYS.map(k => [k, 0]));
  db.sessions.forEach(s => { if (s.date >= from && s.date <= today()) { const add = Math.min(Number(s.duration)||0, cardioAddMin(s)); m[catOf(s)] += (Number(s.duration)||0) - add; m.cardio += add; } });
  return m;
}
function cardioCard(){
  const list = db.sessions.filter(s => catOf(s) === 'cardio' && s.cardio).concat(db.sessions.filter(s => catOf(s) === 'weights').flatMap(s => (s.cardioAdd||[]).filter(x => num(x.distance)).map(x => ({ date:s.date, discipline:x.type, cardio:{ distance:x.distance, unit:x.unit, sec:0 } }))));
  if (!list.length) return '';
  const u = distU(), ws = iso(weekStart(new Date())), ms = today().slice(0,7);
  const dist = l => l.reduce((a,s) => a + toUnit(num(s.cardio.distance), s.cardio.unit, u), 0);
  const wk = list.filter(s => s.date >= ws), mo = list.filter(s => s.date.startsWith(ms));
  const runs = list.filter(s => s.discipline === 'run' && num(s.cardio.distance) && s.cardio.sec).slice(-10);
  const rd = dist(runs), rs = runs.reduce((a,s) => a + s.cardio.sec, 0);
  return `<div class="card" id="cardioCard"><h2>Cardio</h2><div class="kv" style="margin:0"><div><b>${r1(dist(wk))}<small style="font-size:13px;color:var(--muted)"> ${u}</small></b><span>This week</span></div><div><b>${r1(dist(mo))}<small style="font-size:13px;color:var(--muted)"> ${u}</small></b><span>This month</span></div><div><b>${rd ? fmtDur(rs/rd) : '—'}</b><span>Avg run pace /${u}</span></div></div></div>`;
}
function grapplingStats(){
  const rolls = allRolls();
  if (!rolls.length) return '';
  const w = rolls.filter(r => r.result==='win').length, l = rolls.filter(r => r.result==='loss').length, d = rolls.length - w - l;
  const landed = countBy(rolls.flatMap(r => r.subsLanded||[])), caught = countBy(rolls.flatMap(r => r.subsTapped||[]));
  const stuck = countBy(rolls.flatMap(r => r.stuck||[])), tech = countBy(db.sessions.filter(s => catOf(s)==='grappling').flatMap(s => s.techniques||[]));
  const split = g => { const rs = rolls.filter(r => r.session.gi===g); return { n:rs.length, w:rs.filter(r=>r.result==='win').length, l:rs.filter(r=>r.result==='loss').length,
    sl:rs.reduce((a,r)=>a+(r.subsLanded||[]).length,0), st:rs.reduce((a,r)=>a+(r.subsTapped||[]).length,0) }; };
  const gi = split('gi'), ng = split('nogi');
  const nl = landed.reduce((a,x)=>a+x[1],0), nc = caught.reduce((a,x)=>a+x[1],0);
  return `<h3 class="sect-h">Grappling</h3>
    <div class="grid3" style="margin-bottom:14px"><div class="stat hero"><div class="v">${w}</div><div class="l">Won</div></div><div class="stat"><div class="v">${d}</div><div class="l">Draw</div></div><div class="stat"><div class="v" style="color:var(--loss)">${l}</div><div class="l">Lost</div></div></div>
    <div class="card"><h2>Sub ratio <small>${nl} landed · ${nc} caught</small></h2>
      <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--surface2)"><i style="width:${nl+nc ? nl/(nl+nc)*100 : 50}%;background:var(--brand)"></i><i style="flex:1;background:var(--loss)"></i></div>
      <div class="hint" style="display:flex;justify-content:space-between"><span>${rolls.length} rolls logged</span><span>${nl+nc ? Math.round(nl/(nl+nc)*100) : 0}% finishes yours</span></div></div>
    <div class="card"><h2>Submissions</h2><div class="subcols"><div><h3 class="win">Landed</h3>${hbars(landed.slice(0,6),'win')}</div><div><h3 class="loss">Caught by</h3>${hbars(caught.slice(0,6),'loss')}</div></div></div>
    <div class="card"><h2>Where I get stuck</h2>${hbars(stuck.slice(0,8),'loss')}</div>
    <div class="card"><h2>Gi vs No-Gi</h2>
      ${[['Gi',gi],['No-Gi',ng]].map(([n,x]) => `<div class="list-row"><div class="grow"><b>${n}</b><small>${x.n} rolls · ${x.w}W ${x.l}L</small></div><span class="chip" style="padding:5px 10px">✓ ${x.sl}</span><span class="chip loss" style="padding:5px 10px">✕ ${x.st}</span></div>`).join('')}</div>
    <div class="card"><h2>Most drilled</h2>${hbars(tech.slice(0,8),'win')}</div>`;
}
function viewStats(){
  setHeader('Stats', '', { parent:'#/' });
  const v = $('#view');
  if (!db.sessions.length) { v.innerHTML = `<div class="empty" style="padding:40px 10px">Log a few workouts to see your stats.<br><br><a class="btn primary" href="#/log">Log a workout</a></div>${strengthPrCard()}`; wireStrength(v); return; }
  const st = periodStats();
  v.innerHTML = `
    <div class="statrow">
      <div class="stat"><div class="v">${st.month}</div><div class="l">Sessions in ${MONTHS[new Date().getMonth()]}</div></div>
      <div class="stat"><div class="v">${hrs(st.monthMin)}<small>h</small></div><div class="l">Hours this month</div></div>
      <div class="stat"><div class="v">${hrs(st.totalMin)}<small>h</small></div><div class="l">Total hours</div></div>
      <div class="stat"><div class="v">${st.total}</div><div class="l">Total sessions</div></div>
    </div>
    ${weeklyStatsCard()}
    ${strengthPrCard()}
    ${cardioCard()}
    ${grapplingStats()}
    ${challengeHistory()}`;
  wireStrength(v);
}
/* 3.18.0: one weekly card = hours chart + load vs 4-week average + hours by type (was three cards) */
function weeklyStatsCard(){
  const weeks = weeklyHours(12), ld = loadStatus(), m30 = catHours(30), tot = Object.values(m30).reduce((a,b) => a+b, 0);
  const avg = weeks.slice(0,-1).reduce((a,w) => a+w.min, 0) / 60 / Math.max(1, weeks.length-1), avgS = weeks.slice(0,-1).reduce((a,w) => a+w.n, 0) / Math.max(1, weeks.length-1);
  const keys = CAT_KEYS.filter(k => m30[k]);
  return `<div class="card" id="weeklyCard"><h2>Weekly hours <small>avg ${Math.round(avg*10)/10} h · ${Math.round(avgS*10)/10} sessions/wk</small></h2>${barChart(weeks)}<div class="wkcounts">${weeks.map(w => `<span title="${w.key}">${w.n}</span>`).join('')}</div><div class="hint" style="text-align:center;margin-top:2px">Sessions per week (last 12 weeks)</div>
    <div class="acwr" id="loadLine" style="margin-top:12px"><div><b id="acwrRatio">${ld.ratio != null ? ld.ratio.toFixed(2) : '—'}</b><span>Load this week vs 4-wk avg</span></div>${ld.label ? `<span class="loadpill ${ld.label === 'High load' ? 'high' : ld.label === 'Fresh' ? 'fresh' : 'ok'}" id="acwrLabel">${ld.label}</span>` : ''}</div>
    <div class="hint" id="acwrText">${esc(ld.text)}</div>
    ${tot ? `<div class="label sect" style="margin-top:12px">Hours by type · last 30 days</div><div class="split" id="catSplit">${keys.map(k => `<i style="width:${m30[k]/tot*100}%;background:${CATS[k].color}"></i>`).join('')}</div><div class="split-l legend">${keys.map(k => `<span><i style="background:${CATS[k].color}"></i>${CATS[k].label} ${hrs(m30[k])} h</span>`).join('')}</div>` : ''}</div>`;
}
/* 3.18.0: strength goals and lift PRs in one card */
function strengthPrCard(){
  const m = prMap(), list = Object.values(m).filter(p => p.e1).sort((a,b) => b.date.localeCompare(a.date) || b.e1 - a.e1).slice(0,6), recent = iso(addDays(new Date(), -14));
  return `<div class="card" id="strengthCard"><h2>Strength &amp; PRs <small>${sgMethod() === 'single' ? 'heaviest set' : 'est. 1RM'}</small></h2>${db.strength.length ? strengthList() : '<div class="empty" style="padding:4px 0 10px">Set a PR target for bench, squat, deadlift or overhead press, or a rep goal like 15 pull-ups.</div>'}
    <button type="button" class="btn block" data-addsg style="margin-top:10px">Add strength goal</button>
    ${list.length ? `<div class="label sect" style="margin-top:14px">Recent PRs</div><div id="prList">${list.map(p => `<div class="list-row"><div class="grow"><b>${esc(p.name)}</b><small>${p.w} ${unit()} × ${p.r} · ${fmtShort(p.date)}</small></div>${p.date >= recent ? '<span class="pill pr">New</span>' : ''}<span class="cv"><b>${Math.round(p.e1)}</b><small>est. 1RM</small></span></div>`).join('')}</div>` : ''}</div>`;
}


const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
const r1 = n => Math.round(n*10)/10;
const LB_PER_KG = 1 / KG_PER_LB;
/* pure: inputs in any unit → targets. i = { sex:'m'|'f', age, cm, kg, goalKg, act, pace, mode? }
   mode (3.5.0): 'lose' | 'maintain' | 'gain'. Without it the direction comes from goal vs current (as before). */








/* ---------------- undo toast ---------------- */
/* challenge Done taps: one shared undo stack, toast stays 9 s and resets on every tap; each Undo reverts one tap */
var chUndo = [], chUndoTimer = null;
function chUndoPush(msg, fn){ chUndo.push({ msg, fn }); chUndoShow(); }
function chUndoShow(){
  const t = $('#toast'), n = chUndo.length; clearTimeout(toastTimer); clearTimeout(chUndoTimer);
  if (!n) { t.classList.remove('show','act'); return; }
  t.innerHTML = `${esc(chUndo[n - 1].msg)} <button type="button" class="undo">Undo${n > 1 ? ` (${n})` : ''}</button>`; t.classList.add('show', 'act');
  t.querySelector('.undo').onclick = () => { const u = chUndo.pop(); if (u) u.fn(); chUndoShow(); };
  chUndoTimer = setTimeout(() => { chUndo = []; t.classList.remove('show','act'); }, 9000);
}
function undoToast(msg, undo){
  const t = $('#toast'); t.innerHTML = `${esc(msg)} <button type="button" class="undo">Undo</button>`; t.classList.add('show', 'act');
  t.querySelector('.undo').onclick = () => { t.classList.remove('show','act'); undo(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show','act'), 4000);
}

/* ---------------- settings ---------------- */
function viewSettings(){
  const ret = goalsReturn, retName = RETURN_NAME(ret);
  setHeader('Profile', '', ret ? { label:`Back to ${retName}`, parent:'#' + ret } : null);
  const p = db.profile, v = $('#view'); v.innerHTML = '';
  if (ret) { const bb = h(`<div class="card goalsback" id="goalsBackCard"><span>Goals save as you type. When you're done:</span><button type="button" class="btn primary" id="goalsBack">← Back to ${esc(retName)}</button></div>`);
    bb.querySelector('#goalsBack').onclick = () => { goalsReturn = null; go('#' + ret); }; v.appendChild(bb); }
  if (paywallOn()) v.appendChild(h(`<a class="card prorow" id="proRow" href="#/pro"><span class="protag">PRO</span><div class="grow"><b>Forged Pro</b><small>Programs, advanced stats · ${PRO_TRIAL_DAYS}-day free trial</small></div>›</a>`));
  const sec = h(`<div class="card" id="sectionsCard"><h2>What I track</h2><div class="toggles"></div><div class="hint">Hidden sections disappear from the app. Your data is kept.</div></div>`);
  [...CAT_KEYS.map(k => [k, CATS[k].label, CATS[k].disc.map(d => d[1]).join(', ')])].forEach(([k,l,sub]) => {
    const row = h(`<label class="toggle"><span><b>${l}</b><small>${esc(sub)}</small></span><input type="checkbox" role="switch" data-sec="${k}" ${enabled(k)?'checked':''}><i></i></label>`);
    row.querySelector('input').onchange = e => { const en = { ...(p.enabled||{}) }; SECTION_KEYS().forEach(x => { if (!(x in en)) en[x] = enabled(x); }); en[k] = e.target.checked;
      if (!CAT_KEYS.some(x => en[x])) { e.target.checked = true; toast('Keep at least one workout type'); return; }
      p.enabled = en; save(); updateNav(); toast(`${l} ${e.target.checked ? 'shown' : 'hidden'}`); };
    sec.querySelector('.toggles').appendChild(row);
  });
  if (unameOn() && sUser()) { const at = sLS.get('allowTags', true), row = h(`<label class="toggle" id="allowTagsRow"><span><b>Allow tags</b><small>Friends can tag your @username on clips and photos. Turning this off removes you from tag suggestions and deletes tags you're already in.</small></span><input type="checkbox" role="switch" id="allowTags" ${at ? 'checked' : ''}><i></i></label>`);
    row.querySelector('input').onchange = async e => { const on = e.target.checked; try { await Cloud().setAllowTags(on); sLS.set('allowTags', on); toast(on ? 'Friends can tag you' : 'Tags off. Removed you from existing tags'); } catch(x) { e.target.checked = !on; toast(x.message); } };
    sec.querySelector('.toggles').appendChild(row); }
  { const rb = h(`<button type="button" class="btn block" id="tutReplay" style="margin-top:10px">Replay tutorials</button>`);
    rb.onclick = () => { if (window.FORGED_TUT) { FORGED_TUT.reset(); toast('Tutorials will show again on each page'); FORGED_TUT.check('settings'); } };
    sec.appendChild(rb); }
  v.appendChild(sec);
  const card = h(`<div id="beltsProfile">${beltCards()}</div>`);
  v.appendChild(scheduleCard());
  wireBelt(card);
  if (enabled('grappling')) v.appendChild(card);
  const ic = injuryProfileCard(); wireInjuries(ic); v.appendChild(ic);
  v.appendChild(h(`<div class="card" id="assessCard"><h2>Training profile</h2><div class="hint" style="margin:-4px 0 10px">Your arts, schedule, equipment, experience, goal and injuries shape every workout.</div><a class="btn block" href="#/assess" id="redoAssess">Redo assessment</a><a class="lnk" href="terms.html#medical" target="_blank" rel="noopener" id="nmaLink" style="display:block;margin-top:10px">Not medical advice ›</a></div>`));
  if (enabled('weights') || db.strength.length) { const sc = strengthProfileCard(); wireStrength(sc); v.appendChild(sc); }

  const wcard = h('<div class="card" id="unitsCard"><h2>Units</h2></div>');
  wcard.appendChild(field('Weight', seg([['lb','lb'],['kg','kg']], unit(), x => { if (x === unit()) return; const from = unit(), cv = v => v === '' || v == null || !(Number(v) > 0) ? v : Math.round(convW(Number(v), from, x)*10)/10;
    db.sessions.forEach(s => { s.weight = cv(s.weight); }); p.unit = x; save(); toast(`Weights shown in ${x}`); viewSettings(); })));
  if (enabled('cardio')) wcard.appendChild(field('Distance', seg([['mi','Miles'],['km','Kilometers']], distU(), x => { p.distUnit = x; save(); })));
  v.appendChild(wcard);
  const wi = h(weighInCard()); wireWeight(wi); v.appendChild(wi);

  const hasSample = hasSampleData();
  const data = h(`<div class="card"><h2>Your data</h2>
    <p class="hint" style="margin:-4px 0 14px;font-size:13px">Stored only on this device. Export a backup regularly, especially before clearing Safari data.</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn block" id="exp"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Export backup (JSON)</button>
      <label class="btn block" for="impFile"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>Import backup</label>
      <input type="file" id="impFile" accept="application/json,.json" hidden>
      <button class="btn block" id="ldS">Load sample data (demo)</button>
      ${hasSample ? '<button class="btn block" id="rmS">Remove sample data</button>' : ''}
      <button class="btn block danger" id="clr">Clear all data</button>
    </div><div class="legallinks" id="legalLinks"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a></div></div>`);
  v.appendChild(data);
  v.appendChild(h(`<div class="card"><h2>Install on iPhone</h2><div style="color:var(--muted);font-size:14px">In Safari, tap <b style="color:var(--text)">Share</b> → <b style="color:var(--text)">Add to Home Screen</b>. It opens full-screen and works offline.</div></div>`));
  if (socialOn()) v.appendChild(h(`<div class="card" id="friendsCard"><h2>Friends</h2><a class="list-row" href="#/friends" id="friendsProfileLink" style="text-decoration:none;color:inherit"><div class="grow"><b>Friends &amp; head-to-head</b><small>${sUser() ? `Signed in as ${esc(sUser().email)}` : 'Optional account. Only summaries are shared.'}</small></div>›</a></div>`));
  // 3.13.0: medals, badges and looks removed from Profile (data kept, not shown)
  { const row = h(`<div class="card" id="shareProfileCard"><h2>Train with friends</h2><div class="hint" style="margin:-4px 0 10px">Send your link. Friends who tap it can add you in one step, even if they're new to Forged.</div><button type="button" class="btn primary block" id="shareProfile">Share my profile</button></div>`);
    row.querySelector('#shareProfile').onclick = shareProfile; v.appendChild(row); }
  { const MF = 'https://matfinderhq.com', row = h(`<div class="card" id="findGymCard"><a class="list-row" id="findGym" href="${MF}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><div class="grow"><b>Find a gym</b><small>Search gyms near you on MatFinder</small></div><span style="color:var(--accent)">↗</span></a></div>`);
    row.querySelector('#findGym').onclick = e => { e.preventDefault(); try { window.open(MF, window.Capacitor?.isNativePlatform?.() ? '_system' : '_blank', 'noopener'); } catch(x) { location.href = MF; } };
    v.appendChild(row); }
  v.appendChild(h(`<div class="foot">Forged · v${APP_VERSION} · ${db.sessions.length} sessions stored</div>`));

  $('#exp').onclick = exportData;
  $('#impFile').onchange = e => importData(e.target.files[0]);
  const ld = $('#ldS'); if (ld) ld.onclick = loadSample;
  const rm = $('#rmS'); if (rm) rm.onclick = removeSample;
  $('#clr').onclick = async () => {
    if (await confirmSheet('Clear all data?', `This permanently deletes ${db.sessions.length} sessions, ${db.weights.length} weigh-ins, ${db.belts.length} belt promotions, competitions, benchmarks, injuries, your program and your profile from this device. Export a backup first if you want to keep them.`, 'Clear everything')) {
      db = emptyDb(); gPending = null; save(); form = null; toast('All data cleared'); go('#/');
    }
  };
}

function exportData(){
  const payload = { app:'forged', version:APP_VERSION, schema:SCHEMA, exportedAt:new Date().toISOString(), profile:db.profile, sessions:db.sessions, weights:db.weights, belts:db.belts, comps:db.comps, benchmarks:db.benchmarks, strength:db.strength, game:db.game, reps:db.reps || [], injuries:db.injuries, challenges:db.challenges, program:db.program, ...(db.archive ? { archive:db.archive } : {}) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `dm-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup exported');
}
async function importData(file){
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || !Array.isArray(d.sessions)) throw new Error('No sessions found');
    const src = migrate(JSON.parse(JSON.stringify(d)));
    const valid = src.sessions.filter(s => s && typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)).map(sanitizeSession);
    const wts = sanitizeWeights(src.weights), blt = sanitizeBelts(src.belts), ex = extrasOf(src);
    if (await confirmSheet(`Import ${valid.length} sessions?`, `This replaces the ${db.sessions.length} sessions and ${db.weights.length} weigh-ins currently on this device.`, 'Replace & import', false)) {
      db = { schema:SCHEMA, sessions:valid, profile:{ ...defaultProfile(), ...(src.profile||{}), setupDone:true }, weights:wts, belts:blt, ...ex }; syncProfileRank(); save(); toast(`Imported ${valid.length} sessions`); route();
    }
  } catch(e) { console.warn(e); toast('That file isn\'t a valid backup'); }
  finally { const f = $('#impFile'); if (f) f.value = ''; }
}

/* ---------------- sample data ---------------- */
function sampleOtherWorkouts(){
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd()*a.length)], out = [], start = addDays(new Date(), -84), total = 84;
  const sparNotes = ['Kept my hands up better. Still dropping the right after the jab.','Got caught with low kicks — check earlier.','Good pressure, cut off the ring well.','Clinch work felt strong, need sharper knees.'];
  const partners = ['Mo','Sam','Coach Lee','Tasha','Vince'];
  const lifts = [['Back squat', 245, 275, 5], ['Bench press', 185, 205, 5], ['Deadlift', 315, 355, 3], ['Overhead press', 115, 130, 5], ['Pull-up', 0, 0, 8], ['Barbell row', 155, 175, 8]];
  for (let d = new Date(start), i = 0; d <= new Date(); d = addDays(d, 1), i++) {
    const dow = d.getDay(), prog = i / total, date = iso(d), created = Math.min(Date.now() - 120000, d.getTime() - 3600e3);
    if (dow === 2 && rnd() < .85) { // Tuesday: Muay Thai / boxing
      const mix = { shadow:2, pads:3 + Math.floor(rnd()*2), bag:2 + Math.floor(rnd()*2), drills:1, sparring: rnd() < .6 ? 2 + Math.floor(rnd()*2) : 0 };
      const rounds = Object.values(mix).reduce((a,b) => a+b, 0);
      out.push({ id:uid(), date, category:'striking', discipline: rnd() < .8 ? 'muaythai' : 'boxing', type: rnd() < .3 ? 'pads' : 'class', duration:60, rounds, intensity:3 + Math.round(rnd()*1.4),
        strike:{ roundLen:3, mix, spar: mix.sparring ? [{ partner:pick(partners), notes:pick(sparNotes) }] : [] }, techniques:[pick(STRIKE_TECH), pick(STRIKE_TECH)].filter((x,j,a) => a.indexOf(x)===j), sample:true, createdAt:created });
    }
    if (dow === 5 && i % 14 < 7) { // every other Friday: MMA
      const mix = { pads:2, drills:2 + Math.floor(rnd()*2), sparring:2 + Math.floor(rnd()*2), grappling:2 };
      out.push({ id:uid(), date, category:'mma', discipline:'mma', type: i % 28 < 7 ? 'pads' : 'class', duration:75, rounds:Object.values(mix).reduce((a,b) => a+b, 0), intensity:4,
        strike:{ roundLen:5, mix, spar:[{ partner:pick(partners), notes:'Mixed the jab with level changes. Got stuck on the cage twice.' }] },
        techniques:[pick(STRIKE_TECH)], gtech:[pick(['Double leg','Single leg','Cage wrestling','Ground and pound','Get up from bottom','Rear naked choke'])], sample:true, createdAt:created });
    }
    if ((dow === 3 || dow === 0) && rnd() < .7) { // Wed/Sun: mobility
      const kinds = ['yoga','stretch','foam','flow'], disc = pick(kinds), fo = [['hips','hamstrings'],['shoulders','back'],['hips','ankles'],['full'],['neck','shoulders']][Math.floor(rnd()*5)];
      out.push({ id:uid(), date, category:'mobility', discipline:disc, type:'class', duration:[15,20,30][Math.floor(rnd()*3)], intensity:2, focus:fo, notes: rnd() < .3 ? 'Hips felt tight after Saturday open mat.' : '', sample:true, createdAt:created - 1800e3 });
    }
    if ((dow === 4 || dow === 0) && rnd() < .85) { // Thu/Sun: lifting, A/B split with slow progression
      const A = dow === 4, pickL = A ? [lifts[0], lifts[1], lifts[4]] : [lifts[2], lifts[3], lifts[5]];
      const exercises = pickL.map(([name, lo, hi, reps]) => { const top = lo ? Math.round((lo + (hi - lo) * prog + (rnd()-.5)*5) / 5) * 5 : 0;
        return { name, sets: [0,1,2].map(k => ({ reps: lo ? reps : reps + Math.round(prog*4) - (k===2?1:0), weight: lo ? top - (k===0?20:0) : '', rpe: k===2 ? 8 + (rnd()<.5?.5:0) : '' })) }; });
      out.push({ id:uid(), date, category:'weights', discipline:'strength', duration:55 + Math.round(rnd()*2)*5, intensity:3 + (rnd()<.4?1:0), exercises, sample:true, createdAt:created });
    }
    if ((dow === 5 && rnd() < .7) || (dow === 0 && rnd() < .5)) { // Fri run / Sun ride
      const bike = dow === 0, dist = bike ? 14 + Math.round(rnd()*8) : 3 + Math.round(rnd()*30)/10, pace = bike ? 3600/16.5 : (540 - prog*30 + (rnd()-.5)*30);
      const sec = Math.round(dist * pace);
      out.push({ id:uid(), date, category:'cardio', discipline: bike ? 'bike' : 'run', duration:Math.round(sec/60), intensity: 3, cardio:{ distance:dist, unit:'mi', sec }, sample:true, createdAt:created });
    }
  }
  return out;
}
function loadSample(){
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd()*a.length)];
  const partners = ['Marcus','Jake','Coach Ray','Danny','Priya','Luis','Tom','Andre','Kevin'];
  const subsWin = ['Armbar','Rear naked choke','Triangle','Kimura','Guillotine','Americana','Cross collar choke','Darce'];
  const subsLoss = ['Triangle','Guillotine','Rear naked choke','Arm triangle','Heel hook','Bow and arrow','Kimura','Ezekiel','Darce'];
  const stuckP = ['Bottom side control','Back taken','Bottom half guard','Turtle','Bottom mount','Can\'t pass half guard','Front headlock'];
  const notes = ['Felt sharp today. Hip escapes are finally automatic.','Gassed in round 4 — need more cardio.','Coach showed a great detail on the knee slice: underhook first, then slide.','Kept getting flattened in half guard. Fight for the underhook earlier.','Good rolls. Hit the armbar from mount twice.','Open mat, lots of positional sparring from bottom side.','Light flow rolls, nursing a sore knee.','Competition prep — hard rounds, short rest.'];
  const start = addDays(new Date(), -84), sessions = [];
  let w = 214.6;
  for (let d = new Date(start), i = 0; d <= new Date(); d = addDays(d, 1), i++) {
    const dow = d.getDay();
    const trains = (dow === 1 || dow === 3) ? rnd() < .9 : dow === 6 ? rnd() < .75 : dow === 5 ? rnd() < .3 : dow === 2 ? rnd() < .25 : false;
    w -= 0.13 + (rnd()-0.5)*0.2;
    if (!trains) continue;
    const type = dow === 6 ? (rnd() < .8 ? 'open' : 'private') : (i > 70 && dow === 0 ? 'comp' : 'class');
    const nRolls = type === 'private' ? 2 : 3 + Math.floor(rnd()*4);
    const rolls = Array.from({length: rnd() < .85 ? nRolls : 0}, () => {
      const r = rnd(), result = r < .38 ? 'win' : r < .7 ? 'draw' : 'loss';
      return { id:uid(), partner: rnd() < .8 ? pick(partners) : '', result,
        subsLanded: result==='win' ? [pick(subsWin)].concat(rnd()<.2?[pick(subsWin)]:[]) : (rnd()<.1?[pick(subsWin)]:[]),
        subsTapped: result==='loss' ? [pick(subsLoss)] : [],
        stuck: rnd() < .4 ? [pick(stuckP)] : [] };
    }).map(r => ({...r, subsLanded:[...new Set(r.subsLanded)]}));
    sessions.push({ id:uid(), date:iso(d), category:'grappling', discipline:'bjj', gi: dow === 3 || (dow === 6 && rnd() < .5) ? 'nogi' : 'gi', type,
      duration: type==='open' ? 90 : type==='private' ? 60 : rnd() < .6 ? 75 : 60,
      rounds: Math.max(rolls.length, nRolls), intensity: Math.min(5, Math.max(1, Math.round(2.6 + rnd()*2.2))),
      techniques: [pick(TECHNIQUES), pick(TECHNIQUES)].filter((x,i,a) => a.indexOf(x)===i).concat(rnd()<.4?[pick(TECHNIQUES)]:[]),
      rolls, weight: rnd() < .7 ? Math.round(w*10)/10 : '', notes: rnd() < .55 ? pick(notes) : '', sample:true, createdAt:Math.min(Date.now() - 60000, d.getTime()) });
  }
  sessions.push(...sampleOtherWorkouts(w));
  { let sd = 11; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    sessions.forEach(x => { const base = rpeFromIntensity(x.intensity); x.rpe = clamp(base + (rr() < .3 ? -1 : rr() < .5 ? 1 : 0), 1, 10); if (x.type === 'comp' || x.type === 'open') x.rpe = Math.max(x.rpe, 8); x.feel = clamp(Math.round(2.6 + rr() * 2.6), 1, 5); }); }
  db.sessions = db.sessions.filter(s => !s.sample).concat(sessions.map(sanitizeSession));
  db.profile = { ...db.profile, setupDone:true, enabled:{ grappling:true, striking:true, mma:true, weights:true, cardio:true, mobility:true } };
  db.weights = (db.weights||[]).filter(x => !x.sample).concat(sampleWeights());
  { const ex = sampleExtras(); db.comps = db.comps.filter(x => !x.sample).concat(sanitizeComps(ex.comps)); db.benchmarks = db.benchmarks.filter(x => !x.sample).concat(sanitizeBench(ex.benchmarks)); db.strength = db.strength.filter(x => !x.sample).concat(sanitizeStrength(ex.strength)); db.injuries = db.injuries.filter(x => !x.sample).concat(sanitizeInjuries(ex.injuries));
    const have = new Set(db.challenges.map(x => x.month)); db.challenges = db.challenges.concat(challengeMonths(db.sessions.filter(s => s.sample), Number(db.profile.challengeTarget) || 8, today().slice(0,7), true).filter(x => !have.has(x.month)).map(x => ({ ...x, sample:true })));
    if (!db.program) { const st = iso(addDays(weekStart(new Date()), -7)); db.program = sanitizeProgram({ uid:'sp1', tid:'full2', start:st, weeks:8, days:[2,4], finishers:['grip'], swaps:{}, startedAt:1, sample:true });
      const base = { 'Trap bar deadlift':315, 'Bench press':185, 'One-arm dumbbell row':70, 'Split squat':40, 'Farmer carry':70, 'Goblet squat':70, 'Half-kneeling landmine press':55, 'Hip thrust':225, 'Plate pinch hold':25 };
      progSchedule(db.program).filter(x => x.date < today()).forEach((it, n) => { const rx = prescription(db.program, it);
        db.sessions.push(sanitizeSession({ id:'sps' + it.i, date:it.date, category:'weights', discipline:'strength', duration:50, intensity:4, rpe:7, feel:4, sample:true, createdAt:parse(it.date).getTime() + 7200e3, prog:{ puid:'sp1', tid:'full2', i:it.i, w:it.w, key:it.key },
          exercises:rx.ex.map(e => { const [lo, hi] = repsRange(e.reps), L = PROG.library[e.name] || {}, w0 = base[e.name] ? Math.round(convW(base[e.name] * (1 + .025 * n), 'lb', unit()) / (unit() === 'kg' ? 2.5 : 5)) * (unit() === 'kg' ? 2.5 : 5) : '';
            return { name:e.name, plan:{ sets:e.sets, lo, hi, unit:L.unit || 'reps' }, sets:Array.from({ length:e.sets }, (_, k) => ({ reps: k === e.sets - 1 && n === 0 && e.main && e.name === 'Bench press' ? lo - 1 : hi, weight:w0, rpe:'' })) }; }) })); }); }
    if (!Object.values(schedule()).some(a => (a||[]).length)) db.profile.schedule = { grappling:[1,3,6], striking:[2], weights:[2,4], mobility:[0,3], cardio:[5] }; }
  if (!(db.belts||[]).some(x => !x.sample)) { db.belts = sampleBelts(); syncProfileRank(); }
  /* the demo gets a ready-made assessment so Today's session works straight away (Profile > Redo assessment replaces it) */
  if (!db.profile.assess?.done) db.profile.assess = { done:true, sample:true, at:today(), arts:['bjj'], primary:'bjj', belts:{}, schedule:{ mat:[1,3,6], lift:[2,4], len:45 }, locations:[{ id:'l1', name:'Gym', type:'gym', equip:FORGED_GEN.PRESET.gym.slice() }], loc:'l1', exp:'intermediate', goal:'strength', injuries:[] };
  document.body.classList.remove('setup-mode');
  save(); toast(`Loaded ${sessions.length} sample sessions`); go('#/'); route();
}
function sampleWeights(){
  // morning weigh-ins ~4x a week, trending from ~215 lb toward the 195 lb goal with day-to-day noise
  let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [], start = addDays(new Date(), -84), u = unit(); let w = 215.2;
  for (let d = new Date(start); iso(d) <= today(); d = addDays(d, 1)) {
    w -= 0.13 + (rnd()-0.5)*0.12;
    if (![1,3,5,0].includes(d.getDay()) && iso(d) !== today()) continue;
    const val = w + (rnd()-0.5)*1.4;
    out.push({ id:uid(), date:iso(d), w:Math.round(convW(val, 'lb', u)*10)/10, u, createdAt:Math.min(Date.now() - 60000, new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7, 0).getTime()), sample:true });
  }
  return out;
}
function sampleBelts(){
  // white belt (4 stripes) to blue belt 1 stripe over ~3 years, Riverside BJJ
  const d = n => iso(addDays(new Date(), -n));
  const raw = [[1150,'white',0,'Started BJJ'],[965,'white',1,''],[800,'white',2,''],[640,'white',3,'First competition the week before.'],[480,'white',4,''],[300,'blue',0,'Promoted at the end-of-year seminar.'],[115,'blue',1,'']]
    .map(([n, belt, stripes, notes], i) => ({ id:'sb' + i, date:d(n), belt, stripes, instructor:'Prof. Ana Silva', academy:'Riverside BJJ', notes, createdAt:i + 1, sample:true }));
  return sanitizeBelts(raw);
}
function removeSample(){
  const n = db.sessions.filter(s => s.sample).length;
  db.belts = (db.belts||[]).filter(x => !x.sample);
  db.weights = (db.weights||[]).filter(x => !x.sample);
  db.sessions = db.sessions.filter(s => !s.sample);
  db.comps = db.comps.filter(x => !x.sample); db.benchmarks = db.benchmarks.filter(x => !x.sample); db.strength = db.strength.filter(x => !x.sample); db.injuries = db.injuries.filter(x => !x.sample); db.challenges = db.challenges.filter(x => !x.sample);
  if (db.program && db.program.sample) db.program = null;
  if (db.profile.sampleProfile) db.profile = { ...defaultProfile(), unit:db.profile.unit };
  syncProfileRank();
  save(); toast(`Removed ${n} sample sessions`); route();
}

/* ================= 3.1.0: schedule, effort & load, competitions, benchmarks, injuries, monthly challenge, programs ================= */
const isPro = () => true; // the one gate for Pro features. Everything is free for now; a earned Pro week (db.game.proUntil) will count once Pro is paid.
const PROG = window.FORGED_PROGRAMS || { library:{}, templates:[], finishers:[], disclaimer:'', rpeNote:'' };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const isoOk = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x||''));
const posOr = v => v === '' || v == null || isNaN(Number(v)) || !(Number(v) > 0) ? '' : Math.round(Number(v)*10)/10;
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const DOW_MON = [1,2,3,4,5,6,0], DOW1 = ['S','M','T','W','T','F','S'];

/* ---- effort, feel, load ---- */
const rpeOf = s => { const r = Number(s.rpe); return r >= 1 && r <= 10 ? r : rpeFromIntensity(s.intensity); };
const loadOf = s => Math.round((Number(s.duration)||0) * rpeOf(s));
const RPE_LABEL = ['', 'Very easy','Easy','Easy','Moderate','Moderate','Somewhat hard','Hard','Very hard','Near max','Max effort'];
const FEELS = [[1,'😫','Awful'],[2,'😕','Meh'],[3,'😐','OK'],[4,'🙂','Good'],[5,'🤩','Great']];
const loadBetween = (from, to) => db.sessions.reduce((a,s) => s.date >= from && s.date <= to ? a + loadOf(s) : a, 0);
/* acute = last 7 days; chronic = weekly average of the 4 weeks before that. Ratio labels in plain language. */
function loadStatus(ref = new Date()){
  const t = iso(ref), acute = loadBetween(iso(addDays(ref, -6)), t), chronic = loadBetween(iso(addDays(ref, -34)), iso(addDays(ref, -7))) / 4;
  const ratio = chronic > 0 ? Math.round(acute / chronic * 100) / 100 : null;
  const label = ratio == null ? '' : ratio < 0.8 ? 'Fresh' : ratio <= 1.3 ? 'Building' : 'High load';
  const text = ratio == null ? 'Log a few weeks of workouts with effort to see how this week compares.' : label === 'Fresh' ? 'Lighter than your recent weeks: a good time to recover or push a little.'
    : label === 'Building' ? 'In line with your last 4 weeks. Steady progress.' : `About ${Math.round((ratio - 1) * 100)}% above your 4-week average. Consider an easier day or extra sleep.`;
  return { acute:Math.round(acute), chronic:Math.round(chronic), ratio, label, text, jump: ratio != null && ratio > 1.3 };
}
/* hard sessions (effort >= 8) on back-to-back days, from the day before this week's Monday up to today */
function backToBack(ref = new Date()){
  const from = iso(addDays(weekStart(ref), -1)), to = iso(ref), hard = new Set(db.sessions.filter(s => s.date >= from && s.date <= to && rpeOf(s) >= 8).map(s => s.date));
  return [...hard].sort().filter(d => hard.has(iso(addDays(parse(d), -1))) && d > from);
}

/* ---- weekly schedule + this-week strip ---- */
const schedule = () => db.profile.schedule || {};
function plannedOn(d){ const dow = d.getDay(), sch = schedule(), cats = enabledCats().filter(c => (sch[c]||[]).includes(dow));
  const p = activeProgram(); if (p && !cats.includes('weights') && progSchedule(p).some(x => x.date === iso(d))) cats.push('weights');
  return cats; }
function weekDays(ref = new Date()){
  const ws = weekStart(ref);
  return Array.from({length:7}, (_,i) => { const d = addDays(ws, i), k = iso(d); return { k, d, planned:plannedOn(d), done:[...new Set(db.sessions.filter(s => s.date === k).map(catOf))] }; });
}
function weekWarnings(){
  const out = [], b2b = backToBack(), st = loadStatus();
  if (b2b.length) out.push(`Hard sessions (effort 8+) on back-to-back days (${b2b.map(d => DOW[parse(d).getDay()]).map((x,i) => `${DOW[addDays(parse(b2b[i]), -1).getDay()]}–${x}`).join(', ')}). Keep the next one light if you can.`);
  if (st.jump) out.push(`This week's load is ${Math.round((st.ratio - 1) * 100)}% above your 4-week average. Ease off or add a rest day.`);
  return out;
}
function weekCard(st = periodStats(), streak = weekStreak()){
  const days = weekDays(), t = today(), hasPlan = Object.values(schedule()).some(a => (a||[]).length) || !!activeProgram();
  const plannedN = days.reduce((a,x) => a + x.planned.length, 0), doneN = days.reduce((a,x) => a + x.planned.filter(c => x.done.includes(c)).length, 0);
  const warn = weekWarnings(), ch = challengeStatus(), bm = benchDue();
  const dot = (c, on) => `<i class="wd ${on ? 'on' : ''}" style="--c:${CATS[c].color}" title="${CATS[c].label}${on ? ' done' : ' planned'}"></i>`;
  return `<div class="card" id="weekCard"><h2>This week<a class="lnk" href="#/settings/schedule">Schedule ›</a></h2>
    <div class="wksum" id="weekSum"><b>${st.week}</b> session${st.week === 1 ? '' : 's'} · <b>${hrs(st.weekMin)}</b> h${hasPlan ? ` · <b>${doneN}/${plannedN}</b> planned` : ''}${streak ? ` · 🔥 ${streak} wk` : ''}</div>
    <div class="weekstrip" id="weekStrip">${days.map(x => { const extra = x.done.filter(c => !x.planned.includes(c));
      return `<div class="wday ${x.k === t ? 'today' : ''} ${x.k > t ? 'future' : ''}" data-day="${x.k}"><span>${DOW1[x.d.getDay()]}</span><b>${x.d.getDate()}</b><div class="wdots">${x.planned.map(c => dot(c, x.done.includes(c))).join('')}${extra.map(c => dot(c, true)).join('')}</div></div>`; }).join('')}</div>
    ${!hasPlan ? `<div class="hint" style="margin-top:8px"><a class="lnk setgoals" href="#/settings/schedule">Set your usual training days</a> to see planned vs done.</div>` : '<div class="hint wlegend"><span><i class="wd" style="--c:var(--muted)"></i>Planned</span><span><i class="wd on" style="--c:var(--muted)"></i>Done</span></div>'}
    ${warn.map(w => `<div class="warnline" data-warn>⚠️ ${esc(w)}</div>`).join('')}
    <div class="challenge" id="challenge">${miniRing(ch.n, ch.target)}<div class="grow"><b id="chText">${ch.n} / ${ch.target} workouts this month</b><small>${ch.hit ? 'Monthly goal hit 🎉' : `${ch.target - ch.n} to go`} · ${db.challenges.length} month${db.challenges.length === 1 ? '' : 's'} achieved</small></div></div>
    ${bm.due ? `<a class="warnline nudge" href="#/benchmarks" id="benchNudge">📏 ${esc(bm.text)} ›</a>` : ''}</div>`;
}
function scheduleCard(){
  const card = h(`<div class="card" id="scheduleCard"><h2>Weekly schedule</h2><div class="hint" style="margin:-4px 0 10px">Tap the days you usually train. Home shows planned vs done for the week.</div></div>`);
  enabledCats().forEach(c => {
    const row = h(`<div class="schedrow"><span>${catDot(c)}${CATS[c].label}</span><div class="daypick" role="group" aria-label="${CATS[c].label} days">${DOW_MON.map(d => `<button type="button" data-d="${d}" aria-pressed="false" aria-label="${CATS[c].label} ${DOW[d]}">${DOW1[d]}</button>`).join('')}</div></div>`);
    const sync = () => row.querySelectorAll('button').forEach(b => { const on = (schedule()[c]||[]).includes(Number(b.dataset.d)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    row.querySelectorAll('button').forEach(b => b.onclick = () => { const d = Number(b.dataset.d), cur = schedule()[c] || [];
      db.profile.schedule = { ...schedule(), [c]: cur.includes(d) ? cur.filter(x => x !== d) : cur.concat(d).sort() }; save(); sync(); });
    sync(); card.appendChild(row);
  });
  const tgt = h(`<div class="field" style="margin-top:12px"></div>`);
  tgt.appendChild(h(`<label>Monthly workout goal</label>`));
  tgt.appendChild(stepper(Number(db.profile.challengeTarget) || 8, { min:1, max:31, unitLabel:'/ month', onChange:x => { db.profile.challengeTarget = x; save(); } }));
  tgt.appendChild(h(`<div class="hint">Total workouts per month, any type (BJJ, weights, cardio, etc.). Fills the ring on Home.</div>`));
  card.appendChild(tgt);
  return card;
}

/* ---- monthly challenge ring ---- */
function challengeStatus(month = today().slice(0,7)){
  const n = db.sessions.filter(s => s.date.startsWith(month)).length, target = clamp(Math.round(Number(db.profile.challengeTarget) || 8), 1, 31);
  return { month, n, target, hit:n >= target, pct:Math.min(1, n / target) };
}
function miniRing(n, target){ const R = 26, C = 2*Math.PI*R, p = Math.min(1, n/target);
  return `<svg class="mring ${n >= target ? 'hit' : ''}" viewBox="0 0 64 64" role="img" aria-label="${n} of ${target} workouts this month"><circle cx="32" cy="32" r="${R}" class="ring-bg"/><circle cx="32" cy="32" r="${R}" class="ring-fg" stroke-dasharray="${(p*C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${n}</text></svg>`; }
/* record a newly hit month (once) and celebrate */
function checkChallenge(){
  const ch = challengeStatus(), rec = db.challenges.find(x => x.month === ch.month);
  if (ch.hit && !rec) { const real = db.sessions.filter(s => !s.sample && s.date.startsWith(ch.month)).length;
    if (real < ch.target) { db.challenges.push({ month:ch.month, n:ch.n, target:ch.target, sample:true }); save(); return false; } // demo data: record quietly, no confetti
    db.challenges.push({ month:ch.month, n:ch.n, target:ch.target }); save(); celebrate(); return true; }
  if (rec && rec.sample && ch.hit && db.sessions.filter(s => !s.sample && s.date.startsWith(ch.month)).length >= ch.target) { delete rec.sample; rec.n = ch.n; save(); celebrate(); return true; }
  if (rec && ch.n > rec.n) { rec.n = ch.n; save(); }
  return false;
}
function celebrate(){
  const el = $('#challenge'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  return;   // 3.13.0: no popups or confetti
  toast('Monthly goal hit! 🎉');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('<div class="confetti" aria-hidden="true"></div>'), cols = ['#D7261E','#F5C542','#FFFFFF','#B48CF2','#6FD3A8','#E5484D'];
  for (let i = 0; i < 48; i++) box.appendChild(h(`<i style="left:${Math.random()*100}%;background:${cols[i % cols.length]};animation-delay:${(Math.random()*.35).toFixed(2)}s;animation-duration:${(1.3 + Math.random()*.9).toFixed(2)}s;transform:rotate(${Math.round(Math.random()*360)}deg)"></i>`));
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
}
function challengeHistory(){
  const list = db.challenges.slice().sort((a,b) => b.month.localeCompare(a.month));
  return `<div class="card" id="challengeHist"><h2>Monthly goal <small>${list.length} month${list.length === 1 ? '' : 's'} achieved</small></h2>${list.length ? list.slice(0, 12).map(x => { const [y, m] = x.month.split('-').map(Number); return `<div class="list-row"><div class="grow"><b>${MONTHS[m-1]} ${y}</b><small>${x.n} workouts · goal ${x.target}</small></div><button type="button" class="btn sm" data-sharering="${x.month}" aria-label="Share ${MONTHS[m-1]} ${y}">Share</button></div>`; }).join('') : '<div class="empty" style="padding:4px 0">Hit your monthly goal to start a streak of months.</div>'}</div>`;
}

/* ---- competitions (3.4.0: every combat sport, sport-appropriate fields, per-sport record) ---- */
const COMP_SPORT_DEFS = [['BJJ','grappling'],['Submission grappling','grappling'],['Judo','grappling'],['Wrestling','grappling'],['Sambo','grappling'],
  ['Boxing','striking'],['Muay Thai','striking'],['Kickboxing','striking'],['Karate','striking'],['Taekwondo','striking'],['MMA','mma'],['Other','']];
const LEGACY_COMP_SPORTS = { 'No-Gi grappling':'grappling' };
const COMP_SPORTS = COMP_SPORT_DEFS.map(x => x[0]);
const compKind = sport => { const d = COMP_SPORT_DEFS.find(x => x[0] === sport); return (d ? d[1] : LEGACY_COMP_SPORTS[sport]) || 'other'; };
/* the sports you can pick: limited to the combat categories you track (all of them if you track none); a comp's existing sport always stays listed */
function compSports(cur){ const cats = ['grappling','striking','mma'].filter(k => enabled(k)), l = COMP_SPORT_DEFS.filter(([, k]) => !k || !cats.length || cats.includes(k)).map(x => x[0]);
  if (cur && !l.includes(cur)) l.splice(l.length - 1, 0, cur); return l; }
const defaultCompSport = () => enabled('grappling') ? 'BJJ' : enabled('mma') ? 'MMA' : enabled('striking') ? 'Muay Thai' : 'BJJ';
const compFmtDefault = sport => compKind(sport) === 'grappling' || compKind(sport) === 'other' ? 'tournament' : 'bout';
const COMP_METHODS = { grappling:[['sub','Submission'],['points','Points'],['decision','Decision'],['dq','DQ']], striking:[['ko','KO/TKO'],['decision','Decision'],['points','Points'],['dq','DQ']],
  mma:[['ko','KO/TKO'],['sub','Submission'],['decision','Decision'],['dq','DQ']], other:[['sub','Submission'],['points','Points'],['decision','Decision'],['ko','KO/TKO'],['dq','DQ']] };
const METHOD_LABEL = { sub:'Submission', points:'Points', decision:'Decision', ko:'KO/TKO', dq:'DQ' };
const BOUT_TYPES = [['am','Amateur'],['pro','Pro'],['smoker','Smoker / interclub']];
const GI_OPTS = [['gi','Gi'],['nogi','No-Gi'],['both','Both']];
const dtOk = v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v || ''));
function sanitizeComps(l){ return (Array.isArray(l) ? l : []).filter(c => c && isoOk(c.date)).map(c => { const sport = String(c.sport || ''), kind = compKind(sport);
  const fmt = ['tournament','bout'].includes(c.fmt) ? c.fmt : c.result === 'medal' ? 'tournament' : ['win','loss','draw'].includes(c.result) ? 'bout' : compFmtDefault(sport);
  const n = (v, max) => { const x = Math.round(Number(v)); return x > 0 ? Math.min(max, x) : ''; };
  return { id:String(c.id || uid()), name:String(c.name || 'Competition').slice(0, 80), date:c.date, sport, weightClass:String(c.weightClass || ''), targetWeight:posOr(c.targetWeight), fmt,
    ...(GI_OPTS.some(g => g[0] === c.gi) ? { gi:c.gi } : {}), ...(c.division ? { division:String(c.division).slice(0, 80) } : {}),
    ...(BOUT_TYPES.some(b => b[0] === c.bout) ? { bout:c.bout } : {}), ...(n(c.rounds, 15) ? { rounds:n(c.rounds, 15) } : {}), ...(Number(c.roundMin) > 0 ? { roundMin:Math.min(15, Math.round(Number(c.roundMin) * 2) / 2) } : {}),
    ...(dtOk(c.weighIn) ? { weighIn:c.weighIn } : {}),
    result:['win','loss','draw','medal','nomedal'].includes(c.result) ? c.result : '', ...(METHOD_LABEL[c.method] ? { method:c.method } : {}),
    medal:['gold','silver','bronze'].includes(c.medal) ? c.medal : '', ...(Number(c.mw) >= 0 && c.mw !== '' && c.mw != null ? { mw:Math.min(30, Math.round(Number(c.mw))) } : {}), ...(Number(c.ml) >= 0 && c.ml !== '' && c.ml != null ? { ml:Math.min(30, Math.round(Number(c.ml))) } : {}),
    notes:String(c.notes || ''), createdAt:Number(c.createdAt)||0, ...(c.sample ? { sample:true } : {}) }; }); }
const nextComp = () => db.comps.filter(c => c.date >= today()).sort((a,b) => a.date.localeCompare(b.date))[0];
const daysTo = date => daysBetween(today(), date);
const MEDAL_LABEL = { gold:'🥇 Gold', silver:'🥈 Silver', bronze:'🥉 Bronze' };
const resultLabel = c => c.result === 'win' || c.result === 'loss' ? `${c.result === 'win' ? 'Win' : 'Loss'}${c.method ? ` · ${METHOD_LABEL[c.method]}` : ''}` : c.result === 'draw' ? 'Draw'
  : c.result === 'medal' ? (MEDAL_LABEL[c.medal] || 'Medal') : c.result === 'nomedal' ? 'No medal' : '';
function compSheet(id){
  const ex = db.comps.find(c => c.id === id), sp0 = defaultCompSport();
  const c = ex ? { ...ex } : { id:uid(), name:'', date:iso(addDays(new Date(), 28)), sport:sp0, fmt:compFmtDefault(sp0), weightClass:'', targetWeight:'', result:'', medal:'', notes:'', createdAt:Date.now() };
  if (!c.fmt) c.fmt = compFmtDefault(c.sport);
  const past = () => c.date < today();
  const el = h(`<div><h3>${ex ? 'Competition' : 'Add competition'}</h3></div>`);
  const name = h(`<input class="input" type="text" autocapitalize="words" placeholder="e.g. Riverside Open" value="${esc(c.name)}" id="compName">`); name.oninput = () => c.name = name.value;
  const date = h(`<input class="input" type="date" value="${esc(c.date)}" id="compDate">`);
  el.appendChild(field('Name', name)); el.appendChild(field('Date', date));
  const sportF = field('Sport', seg(compSports(c.sport).map(x => [x, x]), c.sport, x => { const was = compKind(c.sport); c.sport = x; if (compKind(x) !== was) { c.fmt = compFmtDefault(x); c.result = ''; c.method = ''; } drawFields(); drawRes(); }, true));
  sportF.querySelector('.seg').id = 'compSport'; el.appendChild(sportF);
  const F = h('<div id="compFields"></div>'); el.appendChild(F);
  const inp = (id, val, ph, mode = 'text') => h(`<input class="input" type="text" ${mode !== 'text' ? `inputmode="${mode}"` : ''} placeholder="${esc(ph)}" value="${esc(val ?? '')}" id="${id}">`);
  const drawFields = () => { F.innerHTML = ''; const k = compKind(c.sport), fight = k === 'striking' || k === 'mma';
    if (fight) { const bf = field('Bout type', seg(BOUT_TYPES, c.bout || '', x => c.bout = x, true)); bf.querySelector('.seg').id = 'compBout'; F.appendChild(bf); }
    const ff = field('Format', seg(fight ? [['bout','Single bout'],['tournament','Tournament']] : [['tournament','Tournament'],['bout','Superfight / single match']], c.fmt, x => { c.fmt = x; c.result = ''; drawRes(); }, true)); ff.querySelector('.seg').id = 'compFmt'; F.appendChild(ff);
    if (c.sport === 'BJJ' || c.sport === 'Other' || c.sport === 'No-Gi grappling') { const gf = field('Gi / No-Gi', seg(GI_OPTS, c.gi || '', x => c.gi = x)); gf.querySelector('.seg').id = 'compGi'; F.appendChild(gf); }
    if (!fight) { const dv = inp('compDiv', c.division, c.sport === 'BJJ' ? 'e.g. Adult · Blue belt · Masters 1' : 'e.g. Senior · Open'); dv.oninput = () => c.division = dv.value; F.appendChild(field('Division (optional)', dv)); }
    if (fight) { const g = h('<div class="grid2"></div>'), r = inp('compRounds', c.rounds, 'e.g. 3', 'numeric'), m = inp('compRoundMin', c.roundMin, k === 'mma' ? 'e.g. 5' : 'e.g. 3', 'decimal');
      r.oninput = () => c.rounds = r.value.replace(/\D/g, ''); m.oninput = () => c.roundMin = m.value.replace(/[^\d.]/g, '');
      g.appendChild(field('Rounds', r)); g.appendChild(field('Minutes per round', m)); F.appendChild(g); }
    const g = h('<div class="grid2"></div>');
    const wc = inp('compClass', c.weightClass, 'Optional'); wc.oninput = () => c.weightClass = wc.value;
    const tw = inp('compTarget', c.targetWeight, 'Optional', 'decimal'); tw.oninput = () => c.targetWeight = tw.value.replace(/[^\d.]/g, '');
    g.appendChild(field('Weight class', wc)); g.appendChild(field(`Target weight (${unit()})`, tw)); F.appendChild(g);
    if (fight) { const wi = h(`<input class="input" type="datetime-local" id="compWeighIn" value="${esc(c.weighIn || '')}">`); wi.onchange = () => c.weighIn = wi.value; F.appendChild(field('Weigh-in time (optional)', wi)); } };
  const res = h('<div id="compResult"></div>');
  const drawRes = () => { res.innerHTML = ''; if (!past()) return; const k = compKind(c.sport);
    if (c.fmt === 'tournament') {
      res.appendChild(field('Result', seg([['medal','Medal'],['nomedal','Didn\'t place']], c.result, x => { c.result = x; drawRes(); })));
      if (c.result === 'medal') res.appendChild(field('Medal', seg([['gold','🥇 Gold'],['silver','🥈 Silver'],['bronze','🥉 Bronze']], c.medal, x => c.medal = x)));
      const g = h('<div class="grid2"></div>'), w = inp('compMW', c.mw, '0', 'numeric'), l = inp('compML', c.ml, '0', 'numeric');
      w.oninput = () => c.mw = w.value.replace(/\D/g, ''); l.oninput = () => c.ml = l.value.replace(/\D/g, '');
      g.appendChild(field('Matches won', w)); g.appendChild(field('Matches lost', l)); res.appendChild(g);
    } else {
      res.appendChild(field('Result', seg([['win','Win'],['loss','Loss'],['draw','Draw']], c.result, x => { c.result = x; if (x === 'draw') c.method = ''; drawRes(); })));
      if (c.result === 'win' || c.result === 'loss') { const mf = field(c.result === 'win' ? 'How you won' : 'How it ended', seg(COMP_METHODS[k] || COMP_METHODS.other, c.method || '', x => c.method = x, true)); mf.querySelector('.seg').id = 'compMethod'; res.appendChild(mf); }
    }
    const nt = h(`<textarea class="input" rows="3" placeholder="How did it go? What to work on?">${esc(c.notes)}</textarea>`); nt.oninput = () => c.notes = nt.value; res.appendChild(field('Notes', nt)); };
  date.onchange = () => { c.date = date.value || c.date; drawRes(); };
  el.appendChild(res); drawFields(); drawRes();
  const btns = h(`<div style="display:flex;gap:10px;margin-top:8px">${ex ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}<button type="button" class="btn primary" style="flex:1" data-save>${ex ? 'Save' : 'Add competition'}</button></div>`);
  btns.querySelector('[data-save]').onclick = () => { if (!c.name.trim()) { toast('Add a name'); name.focus(); return; }
    const k = compKind(c.sport), keep = { ...c };
    if (k === 'striking' || k === 'mma') { delete keep.gi; delete keep.division; } else { delete keep.bout; delete keep.rounds; delete keep.roundMin; delete keep.weighIn; }
    if (keep.fmt === 'tournament') delete keep.method; else { delete keep.mw; delete keep.ml; keep.medal = ''; }
    const rec = sanitizeComps([{ ...keep, name:c.name.trim(), sample:false }])[0]; db.comps = db.comps.filter(x => x.id !== rec.id).concat(rec); save(); closeSheet(); toast(ex ? 'Competition saved' : 'Competition added'); whenSettled(route); };
  const del = btns.querySelector('[data-del]'); if (del) del.onclick = () => { const before = db.comps.slice(); db.comps = db.comps.filter(x => x.id !== c.id); save(); closeSheet(); undoToast('Competition deleted', () => { db.comps = before; save(); route(); }); whenSettled(route); };
  el.appendChild(btns); openSheet(el, null, { closeLabel:'Cancel' });
}
function compsList(list){ return list.map(c => `<button type="button" class="list-row comprow" data-comp="${esc(c.id)}" data-sport="${esc(c.sport)}"><div class="grow"><b>${esc(c.name)}</b><small>${[fmtShort(c.date), c.sport, c.weightClass, ...compDetail(c)].filter(Boolean).map(esc).join(' · ')}${c.date < today() && c.fmt === 'tournament' && (c.mw || c.ml) ? ` · ${c.mw || 0}–${c.ml || 0} in matches` : ''}${c.notes && c.date < today() ? ` · ${esc(c.notes.slice(0, 60))}` : ''}</small></div>${c.date >= today() ? `<span class="pill">${daysTo(c.date)} d</span>` : c.result ? `<span class="pill res-${c.result}">${esc(resultLabel(c))}</span>` : '<span class="pill">Add result</span>'}${c.sample ? '<span class="pill sample">Sample</span>' : ''}</button>`).join(''); }
function wireComps(root){ root.querySelectorAll('[data-comp]').forEach(b => b.onclick = e => { if (e.target.closest('a')) return; compSheet(b.dataset.comp); }); root.querySelectorAll('[data-addcomp]').forEach(b => b.onclick = () => compSheet(null)); }
/* record from past comps: bouts count W/L/D; tournaments add their match wins/losses and medals */
function compRecord(list){ const r = { w:0, l:0, d:0, medals:0, gold:0, silver:0, bronze:0, n:0 };
  list.forEach(c => { r.n++; if (c.result === 'win') r.w++; else if (c.result === 'loss') r.l++; else if (c.result === 'draw') r.d++;
    if (c.fmt === 'tournament') { r.w += Number(c.mw) || 0; r.l += Number(c.ml) || 0; } if (c.result === 'medal') { r.medals++; if (r[c.medal] != null) r[c.medal]++; } }); return r; }
const recText = r => `${r.w}W · ${r.l}L${r.d ? ` · ${r.d}D` : ''} · ${r.medals} medal${r.medals === 1 ? '' : 's'}`;
/* 3.18.0: competitions are one light entry on the Belts page (was its own History tab) */
function compsLight(){
  const up = db.comps.filter(c => c.date >= today()).sort((a,b) => a.date.localeCompare(b.date)), past = db.comps.filter(c => c.date < today()).sort((a,b) => b.date.localeCompare(a.date));
  return `<div class="card" id="compsCard"><h2>Competitions${past.length ? ` <small id="compRecord">${recText(compRecord(past))}</small>` : ''}</h2>
    ${up.length ? compsList(up.slice(0, 2)) : '<div class="hint" style="margin:0 0 4px">No upcoming competitions.</div>'}
    ${past.length ? `<details id="pastComps"><summary>Past results (${past.length})</summary>${compsList(past)}</details>` : ''}
    <button type="button" class="btn block" data-addcomp style="margin-top:10px">Add competition</button></div>`;
}

/* ---- strength benchmarks ---- */
const BENCH = [['pullups','Pull-ups','reps'],['pushups','Push-ups','reps'],['hang','Dead hang','sec'],['plank','Plank','sec'],['squat','Squat','1rm'],['bench','Bench press','1rm'],['deadlift','Deadlift','1rm'],['bw','Body weight','w']];
const BENCH_RX = { squat:/^(back |front )?squat$/i, bench:/^bench press$/i, deadlift:/^(conventional |trap bar )?deadlift$/i };
const RETEST_DAYS = 42;
const epley = (w, r) => { w = Number(w)||0; r = Math.round(Number(r)||0); return w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r/30)) : 0; };
function sanitizeBench(l){ return (Array.isArray(l) ? l : []).filter(x => x && isoOk(x.date) && BENCH.some(b => b[0] === x.key) && Number(x.value) > 0).map(x => ({ id:String(x.id || uid()), date:x.date, key:x.key, value:Math.round(Number(x.value)*10)/10,
  ...(Number(x.w) > 0 ? { w:Number(x.w), r:Math.max(1, Math.round(Number(x.r)||1)) } : {}), ...(x.u === 'kg' || x.u === 'lb' ? { u:x.u } : {}), createdAt:Number(x.createdAt)||0, ...(x.sample ? { sample:true } : {}) })); }
/* one series per benchmark (current units): entered tests, plus est. 1RM from logged lifts (Epley), plus weigh-ins for body weight */
function benchSeries(key){
  const u = unit(), m = new Map(), put = (date, value, src) => { const cur = m.get(date); if (!cur || value > cur.value || (src === 'test' && cur.src !== 'test' && value >= cur.value)) m.set(date, { date, value:Math.round(value*10)/10, src }); };
  const kind = BENCH.find(b => b[0] === key)[2];
  db.benchmarks.filter(x => x.key === key).forEach(x => put(x.date, kind === '1rm' || kind === 'w' ? convW(x.value, x.u || u, u) : x.value, 'test'));
  if (kind === '1rm') db.sessions.forEach(s => (s.exercises||[]).forEach(e => { if (!BENCH_RX[key].test(e.name.trim())) return; const best = Math.max(0, ...e.sets.map(x => epley(x.weight, x.reps))); if (best) put(s.date, best, 'log'); }));
  if (kind === 'w') weightSeries().forEach(p => put(p.date, p.w, 'log'));
  return [...m.values()].sort((a,b) => a.date.localeCompare(b.date));
}
function benchDue(){
  const tests = db.benchmarks.map(x => x.date).sort(), last = tests[tests.length - 1];
  if (!last) return { due:false, last:null, next:null, text:'' };
  const age = daysBetween(last, today()), next = iso(addDays(parse(last), RETEST_DAYS));
  return { due:age >= RETEST_DAYS, last, next, age, text: age >= RETEST_DAYS ? `Benchmarks: retest due (last test ${Math.floor(age/7)} weeks ago)` : `Next retest ${fmtShort(next)}` };
}
const benchUnit = kind => kind === 'reps' ? 'reps' : kind === 'sec' ? 's' : unit();
function benchSpark(series){ const pts = series.slice(-12); if (pts.length < 2) return '<span class="spark-empty"></span>';
  const W = 90, H = 30, vals = pts.map(p => p.value), lo = Math.min(...vals), hi = Math.max(...vals), rg = Math.max(1e-6, hi - lo) || 1;
  const xy = pts.map((p,i) => [2 + (W-4)*i/(pts.length-1), 3 + (H-6)*(1 - (hi === lo ? .5 : (p.value-lo)/rg))]);
  return `<svg class="spark sm" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend"><path d="${xy.map((q,i) => `${i?'L':'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('')}"/><circle cx="${xy[xy.length-1][0].toFixed(1)}" cy="${xy[xy.length-1][1].toFixed(1)}" r="3"/></svg>`; }
function benchRows(compact){
  return BENCH.map(([k, l, kind]) => { const s = benchSeries(k); if (compact && !s.length) return '';
    const last = s[s.length-1], best = s.length ? Math.max(...s.map(p => p.value)) : null, first = s[0], ch = last && first && s.length > 1 ? Math.round((last.value - first.value)*10)/10 : null, u = benchUnit(kind);
    const better = k === 'bw' ? null : ch > 0, sg = db.strength.find(g => g.key === k && !g.achieved), sgTxt = sg ? ` · goal <b data-v="goal">${sgTarget(sg)}</b> (${strengthProgress(sg).pct}%)` : '';
    return `<div class="list-row benchrow" data-bench="${k}"><div class="grow"><b>${l}${kind === '1rm' ? ' <small class="dim">est. 1RM</small>' : ''}</b><small>${last ? `Latest <b data-v="latest">${Math.round(last.value)}</b> ${u} · ${k === 'bw' ? `start <b data-v="start">${Math.round(first.value)}</b>` : `best <b data-v="best">${Math.round(best)}</b>`}${ch ? ` · <span class="${better === null ? '' : better ? 'up' : 'down'}">${signed(Math.round(ch))} ${u}</span>` : ''}${last.src === 'log' && kind === '1rm' ? ' · from logs' : ''}` : 'No test yet'}${sgTxt}</small></div>${benchSpark(s)}</div>`; }).join('');
}
function viewBenchmarks(){
  setHeader('Benchmarks', '', { parent:'#/stats' });
  const v = $('#view'), due = benchDue();
  v.innerHTML = `<div class="card" id="benchAll"><h2>Strength benchmarks</h2>${due.due ? `<div class="warnline nudge" style="margin:0 0 8px" id="retestDue">📏 ${esc(due.text)}</div>` : `<div class="hint" style="margin:-4px 0 8px" id="retestInfo">${due.last ? esc(due.text) : 'Retest every 6 weeks to see your progress.'}</div>`}${benchRows(false)}
    <button type="button" class="btn primary block" data-benchlog style="margin-top:12px">Log a test</button>
    <div class="hint" style="margin-top:8px">Squat, bench and deadlift show your entered 1RM, or an estimate from your logged sets (Epley: weight × (1 + reps ÷ 30)). Body weight comes from your weigh-ins.</div></div>`;
  wireBench(v);
}
function wireBench(root){ root.querySelectorAll('[data-benchlog]').forEach(b => b.onclick = benchSheet); }
function benchSheet(){
  const u = unit(), el = h(`<div><h3>Log a test</h3><div class="hint" style="margin:-6px 0 12px">Fill in what you tested today. Everything is optional.</div></div>`);
  const date = h(`<input class="input" type="date" value="${today()}" max="${today()}" id="bDate">`); el.appendChild(field('Date', date));
  const inp = {}, mk = (k, ph) => (inp[k] = h(`<input class="input" type="text" inputmode="decimal" placeholder="${ph}" data-b="${k}">`));
  const g1 = h('<div class="grid2"></div>'); g1.appendChild(field('Pull-ups (max reps)', mk('pullups', '—'))); g1.appendChild(field('Push-ups (max reps)', mk('pushups', '—'))); el.appendChild(g1);
  const g2 = h('<div class="grid2"></div>'); g2.appendChild(field('Dead hang (sec)', mk('hang', '—'))); g2.appendChild(field('Plank (sec)', mk('plank', '—'))); el.appendChild(g2);
  const lifts = {};
  [['squat','Squat'],['bench','Bench press'],['deadlift','Deadlift']].forEach(([k, l]) => {
    const row = h(`<div class="field"><label>${l}: weight × reps</label><div class="liftin"><input class="input" type="text" inputmode="decimal" placeholder="${u}" data-bw="${k}"><span>×</span><input class="input" type="text" inputmode="numeric" placeholder="reps" data-br="${k}"><b class="e1" data-e1="${k}"></b></div></div>`);
    const [w, r] = row.querySelectorAll('input'), out = row.querySelector('.e1');
    const upd = () => { const e = epley(num(w.value), num(r.value) || 1); out.textContent = e ? `≈ ${Math.round(e)} 1RM` : ''; };
    w.oninput = r.oninput = upd; lifts[k] = { w, r }; el.appendChild(row); });
  el.appendChild(field(`Body weight (${u})`, mk('bw', 'Optional')));
  const save_ = h(`<button type="button" class="btn primary block" id="bSave" style="margin-top:6px">Save test</button>`); el.appendChild(save_);
  save_.onclick = () => { const d = date.value || today(), recs = [], now = Date.now();
    ['pullups','pushups','hang','plank'].forEach(k => { const x = num(inp[k].value); if (x > 0) recs.push({ id:uid(), date:d, key:k, value:x, createdAt:now }); });
    Object.entries(lifts).forEach(([k, {w, r}]) => { const wv = num(w.value), rv = Math.max(1, Math.round(num(r.value) || 1)); if (wv > 0) recs.push({ id:uid(), date:d, key:k, value:Math.round(epley(wv, rv)*10)/10, w:wv, r:rv, u, createdAt:now }); });
    const bw = num(inp.bw.value); if (bw > 0) { recs.push({ id:uid(), date:d, key:'bw', value:bw, u, createdAt:now }); db.weights = db.weights.filter(x => x.date !== d || x.sample).concat({ id:uid(), date:d, w:r1(bw), u, createdAt:now }); }
    if (!recs.length) { toast('Enter at least one result'); return; }
    db.benchmarks = db.benchmarks.concat(sanitizeBench(recs)); save(); closeSheet(); toast(`Saved ${recs.length} result${recs.length === 1 ? '' : 's'}`); whenSettled(() => { route(); afterStrengthSave(); }); };
  openSheet(el, null, { closeLabel:'Cancel' });
}

/* ---- injuries & sore spots ---- */
const BODY_AREAS = ['Neck','Shoulder','Elbow','Wrist','Hand/fingers','Upper back','Lower back','Ribs','Hip','Groin','Hamstring','Knee','Ankle','Foot','Other'];
const SIDES = [['left','Left'],['right','Right'],['both','Both'],['','N/A']];
function sanitizeInjuries(l){ return (Array.isArray(l) ? l : []).filter(x => x && isoOk(x.date) && x.area).map(x => ({ id:String(x.id || uid()), area:String(x.area).slice(0, 40), side:['left','right','both'].includes(x.side) ? x.side : '', severity:clamp(Math.round(Number(x.severity)||1), 1, 5),
  date:x.date, notes:String(x.notes || ''), healed:isoOk(x.healed) ? x.healed : '', updates:(Array.isArray(x.updates) ? x.updates : []).filter(u => u && isoOk(u.date)).map(u => ({ date:u.date, severity:clamp(Math.round(Number(u.severity)||1), 1, 5) })),
  createdAt:Number(x.createdAt)||0, ...(x.sample ? { sample:true } : {}) })); }
const activeInjuries = () => db.injuries.filter(x => !x.healed).sort((a,b) => b.severity - a.severity || a.date.localeCompare(b.date));
const injName = x => `${x.side ? (x.side === 'both' ? 'Both ' : x.side[0].toUpperCase() + x.side.slice(1) + ' ') : ''}${x.side ? x.area.toLowerCase() : x.area}${x.side === 'both' && !/s$/.test(x.area) ? 's' : ''}`;
const injDay = x => daysBetween(x.date, x.healed || today()) + 1;
const injSeries = x => x.updates.length ? x.updates : [{ date:x.date, severity:x.severity }];
function sevChart(x){ const pts = injSeries(x); if (pts.length < 2) return '';
  const W = 300, H = 70, t0 = parse(pts[0].date).getTime(), t1 = Math.max(t0 + 864e5, parse(pts[pts.length-1].date).getTime());
  const xy = pts.map(p => [10 + (W-20) * (parse(p.date).getTime() - t0)/(t1 - t0), 8 + (H-24) * (5 - p.severity)/4]);
  return `<svg class="chart sev" viewBox="0 0 ${W} ${H}" role="img" aria-label="Severity over time">${[1,3,5].map(sv => `<line class="grid" x1="0" x2="${W}" y1="${8 + (H-24)*(5-sv)/4}" y2="${8 + (H-24)*(5-sv)/4}"/>`).join('')}<path class="line" d="${xy.map((q,i) => `${i?'L':'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('')}"/>${xy.map((q,i) => `<circle class="dot" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5"/><text x="${q[0].toFixed(1)}" y="${(q[1]-7).toFixed(1)}" text-anchor="middle">${pts[i].severity}</text>`).join('')}<text x="10" y="${H-3}">${fmtShort(pts[0].date).replace(/, \d{4}$/,'')}</text><text x="${W-10}" y="${H-3}" text-anchor="end">${fmtShort(pts[pts.length-1].date).replace(/, \d{4}$/,'')}</text></svg>`; }
function injuryCards(){
  return activeInjuries().slice(0, 2).map(x => `<div class="card inj" id="injCard-${esc(x.id)}" data-injcard><h2><span data-inj="label">${esc(injName(x))} · day ${injDay(x)} · severity ${x.severity}</span>${x.sample ? ' <span class="pill sample">Sample</span>' : ''}</h2>
    ${x.notes ? `<div class="hint" style="margin:-4px 0 6px">${esc(x.notes)}</div>` : ''}${sevChart(x)}
    <div style="display:flex;gap:10px;margin-top:8px"><button type="button" class="btn sm" data-injupd="${esc(x.id)}" style="flex:1">Update severity</button><button type="button" class="btn sm" data-injheal="${esc(x.id)}" style="flex:1">Mark healed</button></div></div>`).join('');
}
function wireInjuries(root){
  root.querySelectorAll('[data-injupd]').forEach(b => b.onclick = () => injUpdateSheet(b.dataset.injupd));
  root.querySelectorAll('[data-injheal]').forEach(b => b.onclick = () => { const x = db.injuries.find(i => i.id === b.dataset.injheal); if (!x) return; x.healed = today(); save(); undoToast(`${injName(x)} marked healed`, () => { x.healed = ''; save(); route(); }); route(); });
  root.querySelectorAll('[data-inj-open]').forEach(b => b.onclick = () => injurySheet(b.dataset.injOpen));
  root.querySelectorAll('[data-addinj]').forEach(b => b.onclick = () => injurySheet(null));
}
function injUpdateSheet(id){
  const x = db.injuries.find(i => i.id === id); if (!x) return; let sev = x.severity;
  const el = h(`<div><h3>${esc(injName(x))}</h3><div class="hint" style="margin:-6px 0 12px">How bad is it today? 1 = barely notice, 5 = can't train it.</div></div>`);
  el.appendChild(field('Severity today', seg([1,2,3,4,5].map(n => [n, String(n)]), sev, v => sev = v)));
  const b = h(`<button type="button" class="btn primary block" id="injUpdSave">Save update</button>`); el.appendChild(b);
  b.onclick = () => { const t = today(); if (!x.updates.length) x.updates = [{ date:x.date, severity:x.severity }];
    x.updates = x.updates.filter(u => u.date !== t).concat({ date:t, severity:sev }).sort((p,q) => p.date.localeCompare(q.date)); x.severity = sev; save(); closeSheet(); toast('Severity updated'); whenSettled(route); };
  openSheet(el, null, { closeLabel:'Cancel' });
}
function injurySheet(id){
  const ex = db.injuries.find(i => i.id === id), x = ex ? JSON.parse(JSON.stringify(ex)) : { id:uid(), area:'', side:'', severity:2, date:today(), notes:'', healed:'', updates:[], createdAt:Date.now() };
  const el = h(`<div><h3>${ex ? esc(injName(ex)) : 'Log injury or sore spot'}</h3></div>`);
  const chips = h(`<div class="focuschips" role="group" aria-label="Body area">${BODY_AREAS.map(a => `<button type="button" data-area="${a}">${a}</button>`).join('')}</div>`);
  const syncA = () => chips.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.area === x.area); b.setAttribute('aria-pressed', b.dataset.area === x.area); });
  chips.querySelectorAll('button').forEach(b => b.onclick = () => { x.area = b.dataset.area; syncA(); }); syncA();
  el.appendChild(field('Area', chips));
  el.appendChild(field('Side', seg(SIDES, x.side, v => x.side = v)));
  el.appendChild(field('Severity (1–5)', seg([1,2,3,4,5].map(n => [n, String(n)]), x.severity, v => x.severity = v)));
  const date = h(`<input class="input" type="date" value="${esc(x.date)}" max="${today()}" id="injDate">`); date.onchange = () => x.date = date.value || x.date; el.appendChild(field('Started', date));
  const nt = h(`<textarea class="input" rows="2" placeholder="What happened? What makes it worse?">${esc(x.notes)}</textarea>`); nt.oninput = () => x.notes = nt.value; el.appendChild(field('Notes', nt));
  if (ex) { const ch = sevChart(ex); if (ch) el.appendChild(field('Severity over time', h(`<div>${ch}</div>`))); }
  const btns = h(`<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">${ex ? `<button type="button" class="btn danger" data-del>Delete</button><button type="button" class="btn" data-heal>${ex.healed ? 'Not healed yet' : 'Mark healed'}</button>` : ''}<button type="button" class="btn primary" style="flex:1" data-save>${ex ? 'Save' : 'Save injury'}</button></div>`);
  btns.querySelector('[data-save]').onclick = () => { if (!x.area) { toast('Pick an area'); return; } const rec = sanitizeInjuries([{ ...x, sample:false }])[0]; db.injuries = db.injuries.filter(i => i.id !== rec.id).concat(rec); save(); closeSheet(); toast(ex ? 'Saved' : 'Injury logged'); if (!ex) offerMarksPause(rec.severity); whenSettled(route); };
  const heal = btns.querySelector('[data-heal]'); if (heal) heal.onclick = () => { ex.healed = ex.healed ? '' : today(); save(); closeSheet(); toast(ex.healed ? 'Marked healed' : 'Marked active'); whenSettled(route); };
  const del = btns.querySelector('[data-del]'); if (del) del.onclick = () => { const before = db.injuries.slice(); db.injuries = db.injuries.filter(i => i.id !== x.id); save(); closeSheet(); undoToast('Injury deleted', () => { db.injuries = before; save(); route(); }); whenSettled(route); };
  el.appendChild(btns); openSheet(el, null, { closeLabel:'Cancel' });
}
function injuryProfileCard(){
  const act = activeInjuries(), healed = db.injuries.filter(x => x.healed).sort((a,b) => b.healed.localeCompare(a.healed)).slice(0, 4);
  const row = x => `<button type="button" class="list-row" data-inj-open="${esc(x.id)}"><div class="grow"><b>${esc(injName(x))}</b><small>${x.healed ? `Healed ${fmtShort(x.healed)} · ${injDay(x)} days` : `Day ${injDay(x)} · severity ${x.severity}`}</small></div>${x.healed ? '<span class="pill">Healed</span>' : '<span class="pill res-loss">Active</span>'}</button>`;
  return h(`<div class="card" id="injuryCard"><h2>Injuries &amp; sore spots</h2>${act.length || healed.length ? act.concat(healed).map(row).join('') : '<div class="empty" style="padding:4px 0">Nothing logged. Track a sore spot to see how it heals.</div>'}<button type="button" class="btn block" data-addinj style="margin-top:12px">Log injury or sore spot</button></div>`);
}

/* ---- programs (lifting templates) ---- */
const tmplOf = id => PROG.templates.find(t => t.id === id);
const finOf = id => PROG.finishers.find(f => f.id === id);
const repsRange = r => Array.isArray(r) ? r : [r, r];
const repsText = (r, u) => { const [lo, hi] = repsRange(r); return `${lo === hi ? lo : `${lo}–${hi}`}${u === 'sec' ? ' s' : u === 'm' ? ' m' : ''}`; };
function sanitizeProgram(p){ const t = p && tmplOf(p.tid); if (!t || !isoOk(p.start)) return null;
  const weeks = t.lengths ? (t.lengths.includes(Number(p.weeks)) ? Number(p.weeks) : t.weeks) : t.weeks;
  const days = [...new Set((Array.isArray(p.days) ? p.days : []).map(Number).filter(d => d >= 0 && d <= 6))]; if (days.length !== t.days) return null;
  const swaps = {}; Object.entries(p.swaps || {}).forEach(([k, v]) => { if (PROG.library[k] && PROG.library[v]) swaps[k] = v; });
  return { uid:String(p.uid || uid()), tid:t.id, start:p.start, weeks, days:days.sort((a,b) => ((a+6)%7) - ((b+6)%7)), finishers:(Array.isArray(p.finishers) ? p.finishers : []).filter(finOf), swaps, startedAt:Number(p.startedAt)||0, ...(p.sample ? { sample:true } : {}) }; }
const activeProgram = () => db.program && tmplOf(db.program.tid) ? db.program : null;
/* sessions in order from the start date on the chosen weekdays: weeks × days-per-week items */
function progSchedule(p){
  const t = tmplOf(p.tid), out = [], total = p.weeks * t.days; let d = parse(p.start), guard = 0;
  while (out.length < total && guard++ < 400) { if (p.days.includes(d.getDay())) { const i = out.length, w = Math.floor(i / t.days) + 1, sess = t.sessions[i % t.days % t.sessions.length]; out.push({ i, w, key:sess.key, name:sess.name, date:iso(d) }); } d = addDays(d, 1); }
  return out;
}
const progDone = (p, i) => db.sessions.find(s => s.prog && s.prog.puid === p.uid && s.prog.i === i);
function progNext(p){ const sch = progSchedule(p), t = today(); const next = sch.find(x => !progDone(p, x.i)); if (!next) return { done:true, sch };
  return { item:next, sch, due:next.date <= t, today:next.date === t, doneN:sch.filter(x => progDone(p, x.i)).length }; }
function prescription(p, item){
  const t = tmplOf(p.tid), sess = t.sessions.find(s => s.key === item.key), phase = t.phases ? t.phases[p.weeks][item.w - 1] : null, deload = (t.deloadWeeks||[]).includes(item.w) && !t.phases;
  const mk = (e, fin) => { let sets = e.sets, reps = e.reps; if (phase) { if (e.main) { sets = phase.main.sets; reps = phase.main.reps; } else sets = Math.round(e.sets * (fin ? Math.min(1, phase.acc * 1.5) : phase.acc)); } if (deload) sets = Math.max(1, sets - 1);
    const name = (p.swaps||{})[e.name] || e.name, lib = PROG.library[name] || {}; return { ...e, orig:e.name, name, sets, reps, unit:lib.unit || 'reps', cue:lib.cue || '', each:!!lib.each, fin:fin || '' }; };
  const ex = sess.ex.map(e => mk(e)).concat((p.finishers||[]).flatMap(fid => finOf(fid).ex.map(e => mk(e, fid)))).filter(e => e.sets > 0);
  return { title:`Week ${item.w} · ${sess.name}`, note: phase ? phase.note : deload ? t.deload.note : '', phase: phase ? phase.name : deload ? 'Deload' : '', ex };
}
/* last logged sets of an exercise (most recent session first) */
function lastLog(name){ const k = name.trim().toLowerCase();
  for (const s of sorted()) { const e = (s.exercises||[]).find(x => x.name.trim().toLowerCase() === k && x.sets.some(y => num(y.reps) > 0)); if (e) return { ...e, date:s.date }; } return null; }
/* progression: all prescribed sets completed last time -> +5% (lower body) / +2.5% (upper) on the bar, or +1 rep (+5 s / +10 m) without load. Otherwise repeat. */
function suggest(name, rx, u = unit()){
  const lib = PROG.library[name] || {}, [lo, hi] = repsRange(rx.reps), last = lastLog(name);
  if (!last) return { weight:'', reps:lo, basis:'new' };
  const sets = last.sets.filter(x => num(x.reps) > 0), w = Math.max(0, ...sets.map(x => num(x.weight)));
  const need = last.plan ? last.plan.sets : rx.sets, target = last.plan ? last.plan.hi : hi;
  const complete = sets.length >= need && sets.every(x => num(x.reps) >= target);
  if (w > 0) { if (!complete) return { weight:w, reps:lo, basis:'repeat', last };
    const step = u === 'kg' ? 2.5 : 5, inc = lib.lower ? .05 : .025; let nw = Math.round(w * (1 + inc) / step) * step; if (nw <= w) nw = w + step;
    return { weight:nw, reps:lo, basis:'up', last }; }
  const best = Math.max(...sets.map(x => num(x.reps))), add = lib.unit === 'sec' ? 5 : lib.unit === 'm' ? 10 : 1;
  return complete ? { weight:'', reps:best + add, basis:'up', last } : { weight:'', reps:Math.max(lo, best), basis:'repeat', last };
}
function progExercise(e){ const sg = suggest(e.name, e), [lo, hi] = repsRange(e.reps), lib = PROG.library[e.name] || {};
  return { name:e.name, sets:Array.from({ length:e.sets }, () => ({ reps:sg.reps, weight:sg.weight, rpe:'' })), plan:{ sets:e.sets, lo, hi, unit:lib.unit || 'reps' }, _orig:e.orig || e.name, _rest:e.rest, _sugg:sg.basis }; }
function startProgramWorkout(i){
  const p = activeProgram(); if (!p) return; const item = progSchedule(p)[i]; if (!item) return;
  const rx = prescription(p, item);
  guardLeave(() => { form = blankSession('weights'); form.exercises = rx.ex.map(progExercise); form.prog = { puid:p.uid, tid:p.tid, i, w:item.w, key:item.key }; form.duration = Math.max(30, Math.min(60, rx.ex.length * 7)); form._durTouched = true; formBase = null; go('#/log'); });
}
function progCard(){
  const p = activeProgram(); if (!p) return ''; const t = tmplOf(p.tid), nx = progNext(p);
  if (nx.done) return `<div class="card" id="progCard"><h2>${esc(t.name)} <small>complete 🎉</small></h2><div class="hint" style="margin:-4px 0 10px">Nice work. Retest your benchmarks, then pick your next block.</div><a class="btn block" href="#/build">Programs</a></div>`;
  const it = nx.item, rx = prescription(p, it), when = nx.today ? 'Today' : nx.due ? `Catch up (planned ${DOW[parse(it.date).getDay()]})` : `Next: ${fmtDate(it.date).replace(/, \d{4}$/, '')}`;
  return `<div class="card" id="progCard"><h2>${when} <small>${esc(t.name)} · ${nx.doneN}/${nx.sch.length} done</small></h2>
    <div class="progtitle"><b>${esc(rx.title)}</b>${rx.phase ? `<span class="pill">${esc(rx.phase)}</span>` : ''}</div>
    <div class="progex">${rx.ex.filter(e => !e.fin).map(e => { const sg = suggest(e.name, e); return `<div><span>${esc(e.name)}</span><b>${e.sets} × ${repsText(e.reps, e.unit)}${e.each ? ' each' : ''}${sg.weight ? ` @ ${sg.weight}` : ''}</b></div>`; }).join('')}${rx.ex.some(e => e.fin) ? `<div><span>+ finishers</span><b>${(p.finishers||[]).map(f => finOf(f).name).join(', ')}</b></div>` : ''}</div>
    <button type="button" class="btn primary block" id="progStart" data-progi="${it.i}" style="margin-top:12px">${nx.due ? 'Start workout' : 'Start early'}</button></div>`;
}
function wireProg(root){ root.querySelectorAll('[data-progi]').forEach(b => b.onclick = () => startProgramWorkout(Number(b.dataset.progi))); }
function swapSheet(orig, current, onPick){
  const lib = PROG.library[orig] || PROG.library[current] || { alts:[] }, opts = [orig, ...lib.alts].filter((x, i, a) => PROG.library[x] && a.indexOf(x) === i);
  const el = h(`<div><h3>Swap ${esc(current)}</h3><div class="hint" style="margin:-6px 0 12px">Same movement pattern (${esc(lib.pattern || '')}). Pick what fits your gym or your body today.</div><div class="swaplist"></div></div>`);
  opts.forEach(n => { const L = PROG.library[n], b = h(`<button type="button" class="list-row ${n === current ? 'on' : ''}" data-swap="${esc(n)}"><div class="grow"><b>${esc(n)}${n === orig ? ' <small class="dim">(original)</small>' : ''}</b><small>${esc(L.equip)} · ${esc(L.cue)}</small></div>${n === current ? '<span class="pill">Current</span>' : ''}</button>`);
    b.onclick = () => { closeSheet(); onPick(n); }; el.querySelector('.swaplist').appendChild(b); });
  openSheet(el, null, { closeLabel:'Cancel' });
}
function setSwap(orig, name){ const p = activeProgram(); if (!p) return; const sw = { ...(p.swaps||{}) }; if (name === orig) delete sw[orig]; else sw[orig] = name; p.swaps = sw; save(); }
function viewProgram(id){
  const fin = id.startsWith('fin-') ? finOf(id.slice(4)) : null, t = fin ? null : tmplOf(id);
  if (!fin && !t) { go('#/build'); return; }
  setHeader(fin ? `${fin.name} finisher` : t.name, '', { parent:'#/build' });
  const v = $('#view'), p = activeProgram(), mine = p && t && p.tid === t.id;
  const exRow = (e, editable) => { const name = mine ? ((p.swaps||{})[e.name] || e.name) : e.name, L = PROG.library[name];
    return `<div class="pex" data-ex="${esc(e.name)}"><div class="pex-h"><b>${esc(name)}</b><span>${e.sets} × ${repsText(e.reps, L.unit)}${L.each ? ' each' : ''} · rest ${esc(e.rest)}</span></div><div class="cue">${esc(L.cue)}</div>
      <div class="pex-f"><small>${esc(L.pattern)} · ${esc(L.equip)}${e.main ? ' · main lift' : ''}</small>${editable ? `<button type="button" class="btn sm" data-swapex="${esc(e.name)}">Swap</button>` : ''}</div></div>`; };
  if (fin) {
    v.innerHTML = `<div class="card"><h2>${esc(fin.name)} <small>${esc(fin.short)}</small></h2>${fin.ex.map(e => exRow(e, false)).join('')}
      ${p ? `<button type="button" class="btn primary block" id="finToggle" style="margin-top:12px">${(p.finishers||[]).includes(fin.id) ? 'Remove from my program' : 'Add to my program'}</button>` : ''}<button type="button" class="btn block" id="finLog" style="margin-top:8px">Log it now</button></div>
      <div class="disclaimer">⚠️ ${esc(PROG.disclaimer)}</div>`;
    const tg = $('#finToggle'); if (tg) tg.onclick = () => { const s = new Set(p.finishers||[]); s.has(fin.id) ? s.delete(fin.id) : s.add(fin.id); p.finishers = [...s]; save(); toast(s.has(fin.id) ? `${fin.name} added to every session` : `${fin.name} removed`); route(); };
    $('#finLog').onclick = () => guardLeave(() => { form = blankSession('weights'); form.exercises = fin.ex.map(e => progExercise({ ...e, orig:e.name })); form.duration = 10; form._durTouched = true; formBase = null; go('#/log'); });
    return;
  }
  const weeks = t.lengths ? (mine ? p.weeks : t.weeks) : t.weeks;
  v.innerHTML = `<div class="card" id="tmplInfo"><h2>${esc(t.short)}</h2><div class="hint" style="margin:-4px 0 8px">${esc(t.blurb)}</div>
      <div class="wfacts"><div><span>Length</span><b>${t.lengths ? `${t.lengths[0]}–${t.lengths[t.lengths.length-1]} wk` : `${weeks} weeks`}</b><small>${t.days} days/week</small></div><div><span>Equipment</span><b style="font-size:14px;line-height:1.3">${esc(t.equipment)}</b></div></div>
      <div class="hint" style="margin-top:8px">${esc(PROG.rpeNote)}${t.deloadWeeks ? ` Lighter week: ${t.deloadWeeks.map(w => `week ${w}`).join(' and ')}.` : ''}</div>
      ${t.phases ? `<div class="phases">${t.phases[weeks].map((ph, i) => `<div><b>Wk ${i+1}</b><span>${esc(ph.name)}</span><small>${ph.main.sets}×${ph.main.reps}</small></div>`).join('')}</div>` : ''}
      ${mine ? '<div class="hint" style="margin-top:8px"><b>This is your current program.</b> Swaps you make apply to all future sessions.</div>' : `<button type="button" class="btn primary block" id="startProg" style="margin-top:12px">Start program</button>`}</div>
    ${t.sessions.map(s => `<div class="card"><h2>${esc(s.name)}</h2>${s.ex.map(e => exRow(e, mine)).join('')}</div>`).join('')}
    <div class="disclaimer" id="progDisclaimer">⚠️ ${esc(PROG.disclaimer)}</div>`;
  v.querySelectorAll('[data-swapex]').forEach(b => b.onclick = () => { const orig = b.dataset.swapex; swapSheet(orig, (p.swaps||{})[orig] || orig, n => { setSwap(orig, n); toast(n === orig ? `Back to ${orig}` : `Swapped to ${n}`); route(); }); });
  const st = $('#startProg'); if (st) st.onclick = () => startSheet(t);
}
function startSheet(t){
  const comp = nextComp(), defDays = t.days === 3 ? [1,3,5] : [2,4];
  const sch = (schedule().weights || []).slice(); let days = sch.length === t.days ? sch : defDays, weeks = t.weeks, fins = [];
  if (t.lengths) { const wk = comp ? Math.floor(daysTo(comp.date) / 7) : 6; weeks = clamp(wk, t.lengths[0], t.lengths[t.lengths.length-1]); }
  let start = today();
  if (t.comp && comp) { const s0 = iso(addDays(weekStart(parse(comp.date)), -(weeks - 1) * 7)); if (s0 > start) start = s0; }
  const el = h(`<div><h3>Start ${esc(t.name)}</h3></div>`);
  if (t.comp && comp) el.appendChild(h(`<div class="hint" style="margin:-6px 0 12px">Timed to finish the week of <b>${esc(comp.name)}</b> (${fmtShort(comp.date)}).</div>`));
  const sd = h(`<input class="input" type="date" value="${start}" min="${today()}" id="progStartDate">`); sd.onchange = () => start = sd.value || start;
  el.appendChild(field('Start date', sd));
  if (t.lengths) el.appendChild(field('Length', seg(t.lengths.map(n => [n, `${n} weeks`]), weeks, x => weeks = x)));
  const dp = h(`<div class="daypick big" role="group">${DOW_MON.map(d => `<button type="button" data-d="${d}">${DOW[d]}</button>`).join('')}</div>`);
  const syncD = () => dp.querySelectorAll('button').forEach(b => { const on = days.includes(Number(b.dataset.d)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  dp.querySelectorAll('button').forEach(b => b.onclick = () => { const d = Number(b.dataset.d); days = days.includes(d) ? days.filter(x => x !== d) : days.concat(d); syncD(); }); syncD();
  el.appendChild(field(`Lifting days (pick ${t.days})`, dp, 'Pick days after light rolling or before a rest day, not the day before hard sparring.'));
  const fc = h(`<div class="focuschips">${PROG.finishers.map(f => `<button type="button" data-fin="${f.id}">${esc(f.name)}</button>`).join('')}</div>`);
  fc.querySelectorAll('button').forEach(b => b.onclick = () => { const k = b.dataset.fin; fins = fins.includes(k) ? fins.filter(x => x !== k) : fins.concat(k); b.classList.toggle('on', fins.includes(k)); });
  el.appendChild(field('Add finishers (optional)', fc));
  el.appendChild(h(`<div class="disclaimer" style="margin:4px 0 12px">⚠️ ${esc(PROG.disclaimer)}</div>`));
  const go_ = h(`<button type="button" class="btn primary block" id="progGo">Start program</button>`); el.appendChild(go_);
  go_.onclick = () => { if (days.length !== t.days) { toast(`Pick ${t.days} days`); return; }
    const pr = sanitizeProgram({ uid:uid(), tid:t.id, start, weeks, days, finishers:fins, swaps:{}, startedAt:Date.now() }); if (!pr) return;
    db.program = pr; if (!enabled('weights')) db.profile.enabled = { ...(db.profile.enabled||{}), weights:true }; save(); closeSheet(); toast(`${t.name} started`); whenSettled(() => go('#/')); };
  openSheet(el, null, { closeLabel:'Cancel' });
}

/* ---- storage helpers for the new collections ---- */
/* ---------------- strength goals (3.1.0): PR targets per lift + rep goals, progress from logs/benchmarks ---------------- */
const SG_LIFTS = [['bench','Bench press',/^(barbell )?bench press$/i],['squat','Squat',/^(back |front )?squat$/i],['deadlift','Deadlift',/^(conventional |trap bar |sumo )?deadlift$/i],['ohp','Overhead press',/^(overhead|military|strict|standing) press$|^ohp$/i]];
const SG_REPS = [['pullups','Pull-ups','reps',/^pull-?ups?$/i],['pushups','Push-ups','reps',/^push-?ups?$/i],['hang','Dead hang','sec',/^dead ?hang$/i]];
const sgMethod = () => db.profile.strengthMethod === 'single' ? 'single' : 'e1rm';
const sgKindOf = key => SG_REPS.some(r => r[0] === key) ? 'reps' : 'lift';
const sgLabel = g => g.key === 'custom' ? g.name : ([...SG_LIFTS, ...SG_REPS].find(x => x[0] === g.key) || [, g.name])[1];
const sgUnit = g => g.kind === 'reps' ? (g.key === 'hang' ? 's' : 'reps') : unit();
const sgTarget = g => g.kind === 'lift' ? Math.round(convW(g.target, g.u || unit(), unit()) * 10) / 10 : g.target;
function sanitizeStrength(l){
  return (Array.isArray(l) ? l : []).filter(x => x && Number(x.target) > 0 && (x.key === 'custom' ? String(x.name||'').trim() : [...SG_LIFTS, ...SG_REPS].some(k => k[0] === x.key))).map(x => {
    const kind = sgKindOf(x.key);
    return { id:String(x.id || uid()), kind, key:x.key, ...(x.key === 'custom' ? { name:String(x.name).trim().slice(0, 60) } : {}), target:Math.round(Number(x.target) * 10) / 10,
      ...(kind === 'lift' ? { u: x.u === 'kg' ? 'kg' : 'lb' } : {}), ...(isoOk(x.date) ? { date:x.date } : {}),
      ...(x.achieved && isoOk(x.achieved.date) ? { achieved:{ date:x.achieved.date, value:Math.round(Number(x.achieved.value||0) * 10) / 10 } } : {}),
      createdAt:Number(x.createdAt) || 0, ...(x.sample ? { sample:true } : {}) };
  });
}
/* current best (current units) + the date it was first reached. Lifts: Epley est. 1RM (default) or heaviest set; reps: max reps / seconds. */
function strengthBest(g, method = sgMethod()){
  let best = 0, date = null; const put = (v, d) => { v = Math.round(v * 10) / 10; if (v > best || (v === best && d && date && d < date)) { best = v; date = d; } };
  if (g.kind === 'lift') {
    const rx = g.key === 'custom' ? null : SG_LIFTS.find(x => x[0] === g.key)[2], nm = String(g.name||'').trim().toLowerCase();
    db.sessions.forEach(s => (s.exercises||[]).forEach(e => { const n = String(e.name||'').trim(); if (rx ? !rx.test(n) : n.toLowerCase() !== nm) return;
      (e.sets||[]).forEach(x => { const w = Number(x.weight)||0, r = Math.round(Number(x.reps)||0); if (w > 0 && r > 0) put(method === 'single' ? w : epley(w, r), s.date); }); }));
    if (['bench','squat','deadlift'].includes(g.key)) db.benchmarks.filter(b => b.key === g.key).forEach(b => { const u0 = b.u || unit(); put(convW(method === 'single' ? (b.w || b.value) : b.value, u0, unit()), b.date); });
  } else {
    const rx = SG_REPS.find(x => x[0] === g.key)[3];
    db.benchmarks.filter(b => b.key === g.key).forEach(b => put(b.value, b.date));
    if (g.key !== 'hang') db.sessions.forEach(s => (s.exercises||[]).forEach(e => { if (!rx.test(String(e.name||'').trim())) return; (e.sets||[]).forEach(x => { const r = Math.round(Number(x.reps)||0); if (r > 0) put(r, s.date); }); }));
  }
  return { value:best, date };
}
function strengthProgress(g, method){
  const t = sgTarget(g), b = strengthBest(g, method), pct = t > 0 ? Math.min(100, Math.round(b.value / t * 100)) : 0;
  return { target:t, best:b.value, bestDate:b.date, pct, hit: !!g.achieved || b.value >= t, left: Math.max(0, Math.round((t - b.value) * 10) / 10) };
}
/* Mark goals hit by logged sets / tests (records the date); returns the newly hit goals. */
function checkStrengthGoals(){
  const hits = [];
  db.strength.forEach(g => { if (g.achieved) return; const p = strengthProgress(g); if (p.best > 0 && p.best >= p.target) { g.achieved = { date: p.bestDate && p.bestDate >= iso(new Date(g.createdAt || 0)) ? p.bestDate : today(), value:p.best }; hits.push(g); } });
  if (hits.length) save();
  return hits;
}
function nextTarget(g){
  const t = sgTarget(g);
  if (g.kind === 'reps') return g.key === 'hang' ? t + 15 : t + (t >= 20 ? 5 : 2);
  const step = unit() === 'kg' ? 2.5 : 5; return Math.ceil(t * 1.05 / step) * step;
}
function showGoalHits(hits){
  if (!hits || !hits.length) return;
  const m = sgMethod(), el = h(`<div id="goalHit" class="goalhit"><div class="big">🏆</div><h3>Goal hit! New PR</h3>
    ${hits.map(g => `<div class="list-row"><div class="grow"><b>${esc(sgLabel(g))}</b><small>Target ${sgTarget(g)} ${sgUnit(g)} · you hit <b>${g.achieved.value}</b>${g.kind === 'lift' ? (m === 'single' ? ' (heaviest set)' : ' (est. 1RM)') : ''} on ${fmtShort(g.achieved.date)}</small></div><span class="pill res-win">✓</span></div>`).join('')}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px"><button type="button" class="btn block" id="shareGoal">Share</button><button type="button" class="btn primary block" id="nextTarget">Set next target${hits.length === 1 ? ` (${nextTarget(hits[0])} ${sgUnit(hits[0])})` : ''}</button><button type="button" class="btn block ghost" data-cancel>Done</button></div></div>`);
  el.querySelector('[data-cancel]').onclick = () => closeSheet();
  el.querySelector('#shareGoal').onclick = () => { closeSheet(); whenSettled(() => shareSheet('goal', hits[0])); };
  el.querySelector('#nextTarget').onclick = () => { const g = hits[0]; closeSheet(); whenSettled(() => strengthSheet(null, { kind:g.kind, key:g.key, name:g.name, target:nextTarget(g), date:'' })); };
  openSheet(el);
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { const box = h('<div class="confetti" aria-hidden="true"></div>'), cols = ['#D7261E','#F5C542','#FFFFFF','#B48CF2','#6FD3A8'];
    for (let i = 0; i < 40; i++) box.appendChild(h(`<i style="left:${Math.random()*100}%;background:${cols[i % cols.length]};animation-delay:${(Math.random()*.35).toFixed(2)}s;animation-duration:${(1.3 + Math.random()*.9).toFixed(2)}s"></i>`));
    document.body.appendChild(box); setTimeout(() => box.remove(), 2600); }
}
/* run after a save: newly hit goals celebrate once the next screen is up */
function afterStrengthSave(){ const hits = checkStrengthGoals(); if (hits.length) setTimeout(() => whenSettled(() => showGoalHits(hits)), 450); return hits; }
function sgRow(g){
  const p = strengthProgress(g), u = sgUnit(g);
  return `<button type="button" class="list-row sgrow${g.achieved ? ' done' : ''}" data-sg="${esc(g.id)}"><div class="grow"><b>${esc(sgLabel(g))}${g.sample ? ' <span class="pill sample">Sample</span>' : ''}</b>
    <small><b data-v="best">${Math.round(p.best * 10) / 10 || '—'}</b> / <b data-v="target">${p.target}</b> ${u}${g.achieved ? ` · ✓ hit ${fmtShort(g.achieved.date)}` : g.date ? ` · by ${fmtShort(g.date)}` : ''}</small>
    <span class="sgbar"><i style="width:${g.achieved ? 100 : p.pct}%"></i></span></div><span class="pill${g.achieved ? ' res-win' : ''}" data-pct="${g.achieved ? 100 : p.pct}">${g.achieved ? 'Hit' : p.pct + '%'}</span></button>`;
}
function strengthList(){
  const open = db.strength.filter(g => !g.achieved).sort((a,b) => strengthProgress(b).pct - strengthProgress(a).pct), done = db.strength.filter(g => g.achieved).sort((a,b) => b.achieved.date.localeCompare(a.achieved.date));
  return open.map(sgRow).join('') + done.map(sgRow).join('');
}
function strengthCard(id = 'strengthCard'){
  const m = sgMethod();
  return `<div class="card" id="${id}"><h2>Strength goals <small>${m === 'single' ? 'heaviest set' : 'est. 1RM'}</small></h2>${db.strength.length ? strengthList() : '<div class="empty" style="padding:4px 0 10px">Set a PR target for bench, squat, deadlift or overhead press, or a rep goal like 15 pull-ups.</div>'}
    <button type="button" class="btn block" data-addsg style="margin-top:10px">Add strength goal</button></div>`;
}
function strengthProfileCard(){
  const c = h(strengthCard('strengthProfile'));
  const f = h('<div class="field" style="margin-top:12px"><label>Count lift progress by</label></div>');
  f.appendChild(seg([['e1rm','Est. 1RM'],['single','Heaviest set']], sgMethod(), x => { db.profile.strengthMethod = x; save(); toast(x === 'single' ? 'Using your heaviest set' : 'Using est. 1RM (Epley)'); route(); }));
  f.querySelector('.seg') && (f.querySelector('.seg').id = 'sgMethod');
  f.appendChild(h('<div class="hint">Est. 1RM turns your best weight × reps into a one-rep max (weight × (1 + reps ÷ 30)). Heaviest set uses the most weight you lifted.</div>'));
  c.insertBefore(f, c.querySelector('[data-addsg]')); return c;
}
function strengthHomeLine(){
  const open = db.strength.filter(g => !g.achieved); if (!open.length) return '';
  const g = open.map(g => [g, strengthProgress(g)]).sort((a,b) => b[1].pct - a[1].pct)[0], [goal, p] = g;
  return `<a class="card strline" id="strengthLine" href="#/stats"><span>💪 <b>${esc(sgLabel(goal))}</b> ${Math.round(p.best) || 0} / ${p.target} ${sgUnit(goal)}</span><span class="sgbar"><i style="width:${p.pct}%"></i></span><em>${p.pct}%</em></a>`;
}
function wireStrength(root){
  root.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => strengthSheet(b.dataset.sg));
  root.querySelectorAll('[data-addsg]').forEach(b => b.onclick = () => strengthSheet(null));
}
function exerciseOptions(){ const s = new Set(EXERCISES); db.sessions.forEach(x => (x.exercises||[]).forEach(e => e.name && s.add(String(e.name).trim()))); return [...s].sort((a,b) => a.localeCompare(b)); }
function strengthSheet(id, preset){
  const ex = id ? db.strength.find(g => g.id === id) : null;
  let kind = ex?.kind || preset?.kind || 'lift', key = ex?.key || preset?.key || 'bench';
  const el = h(`<div><h3>${ex ? 'Edit strength goal' : 'New strength goal'}</h3><div id="sgBody"></div></div>`), body = el.querySelector('#sgBody');
  const tIn = h(`<input class="input" type="text" inputmode="decimal" id="sgTarget" value="${ex ? sgTarget(ex) : preset?.target ?? ''}">`);
  const dIn = h(`<input class="input" type="date" id="sgDate" min="${today()}" value="${esc(ex?.date || preset?.date || '')}">`);
  const cIn = h(`<input class="input" type="text" list="sgExList" autocapitalize="words" id="sgCustom" placeholder="Exercise name" value="${esc(ex?.name || preset?.name || '')}">`);
  const dl = h(`<datalist id="sgExList">${exerciseOptions().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`);
  const draw = () => {
    body.innerHTML = '';
    body.appendChild(field('Type', seg([['lift','Lift PR'],['reps','Rep goal']], kind, x => { kind = x; key = x === 'lift' ? 'bench' : 'pullups'; draw(); })));
    const opts = kind === 'lift' ? [...SG_LIFTS.map(x => [x[0], x[1]]), ['custom','Other']] : SG_REPS.map(x => [x[0], x[1]]);
    const chips = h(`<div class="focuschips" id="sgKeys">${opts.map(([k, l]) => `<button type="button" data-sgkey="${k}" class="${k === key ? 'on' : ''}" aria-pressed="${k === key}">${esc(l)}</button>`).join('')}</div>`);
    chips.querySelectorAll('button').forEach(b => b.onclick = () => { key = b.dataset.sgkey; draw(); });
    body.appendChild(field(kind === 'lift' ? 'Lift' : 'Exercise', chips));
    if (key === 'custom') { const w = h('<div></div>'); w.appendChild(cIn); w.appendChild(dl); body.appendChild(field('Exercise (from your list)', w)); }
    const g0 = { kind, key, name:cIn.value, target:1, u:unit() }, cur = strengthBest(g0);
    tIn.placeholder = cur.value ? `Best now ${Math.round(cur.value)}` : kind === 'lift' ? `e.g. ${unit() === 'kg' ? 100 : 225}` : key === 'hang' ? 'e.g. 90' : 'e.g. 15';
    const g = h('<div class="grid2"></div>'); g.appendChild(field(`Target (${kind === 'lift' ? unit() + (sgMethod() === 'single' ? ', heaviest set' : ', 1RM') : key === 'hang' ? 'seconds' : 'reps'})`, tIn)); g.appendChild(field('Target date', dIn)); body.appendChild(g);
    if (cur.value) body.appendChild(h(`<div class="hint" id="sgCur">Your best so far: <b>${Math.round(cur.value * 10) / 10}</b> ${kind === 'lift' ? unit() : key === 'hang' ? 's' : 'reps'}${cur.date ? ` (${fmtShort(cur.date)})` : ''}.</div>`));
    const act = h(`<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px"><button type="button" class="btn primary block" id="sgSave">Save goal</button>${ex ? '<button type="button" class="btn block danger" id="sgDelete">Delete goal</button>' : ''}</div>`);
    body.appendChild(act);
    act.querySelector('#sgSave').onclick = () => {
      const t = num(tIn.value); if (!(t > 0)) { toast('Enter a target'); return; }
      if (key === 'custom' && !cIn.value.trim()) { toast('Pick an exercise'); return; }
      const rec = sanitizeStrength([{ id:ex?.id || uid(), kind, key, name:cIn.value.trim(), target:t, u:unit(), date:dIn.value, createdAt:ex?.createdAt || Date.now() }])[0];
      if (ex && ex.achieved && rec.target <= sgTarget(ex)) rec.achieved = ex.achieved;
      db.strength = ex ? db.strength.map(x => x.id === ex.id ? rec : x) : db.strength.concat(rec);
      save(); closeSheet(); toast('Strength goal saved'); whenSettled(() => { route(); afterStrengthSave(); });
    };
    const del = act.querySelector('#sgDelete');
    if (del) del.onclick = async () => { closeSheet(); await new Promise(r => whenSettled(r)); if (await confirmSheet('Delete this goal?', `${sgLabel(ex)} target ${sgTarget(ex)} ${sgUnit(ex)}.`)) { db.strength = db.strength.filter(x => x.id !== ex.id); save(); toast('Goal deleted'); route(); } };
  };
  draw(); openSheet(el, null, { closeLabel:'Cancel' });
}

function extrasOf(d){
  return { comps:sanitizeComps(d.comps), benchmarks:sanitizeBench(d.benchmarks), strength:sanitizeStrength(d.strength), game:sanitizeGame(d.game), reps:sanitizeReps(d.reps), injuries:sanitizeInjuries(d.injuries),
    challenges:(Array.isArray(d.challenges) ? d.challenges : []).filter(x => x && /^\d{4}-\d{2}$/.test(x.month)).filter((x, i, a) => a.findIndex(y => y.month === x.month) === i).map(x => ({ month:x.month, n:Math.max(0, Number(x.n)||0), target:Math.max(1, Number(x.target)||8), ...(x.sample ? { sample:true } : {}) })),
    program:sanitizeProgram(d.program), ...(d.archive && Object.keys(d.archive).length ? { archive:d.archive } : {}) };
}
const hasSampleData = () => db.sessions.some(s => s.sample) || db.comps.some(c => c.sample) || db.injuries.some(x => x.sample) || db.benchmarks.some(x => x.sample) || db.strength.some(x => x.sample);
function sampleExtras(){
  const d = n => iso(addDays(new Date(), n)), u = unit(), W = lb => Math.round(convW(lb, 'lb', u) * 10) / 10;
  const comps = [{ id:'sc1', name:'Riverside Open', date:d(6), sport:'BJJ', weightClass:'Medium heavy (Gi)', targetWeight:W(194), sample:true, createdAt:1 },
    { id:'sc2', name:'Fall Classic', date:d(-70), sport:'BJJ', weightClass:'Medium heavy', result:'medal', medal:'silver', notes:'Won two by points, lost the final to a sweep late. Work on top pressure.', sample:true, createdAt:2 },
    { id:'sc3', name:'Summer Submission Only', date:d(-120), sport:'No-Gi grappling', result:'loss', notes:'Heel hook first round. Leg lock defence!', sample:true, createdAt:3 }];
  const B = (n, key, value, extra={}) => ({ id:`sb-${key}-${n}`, date:d(n), key, value, sample:true, createdAt:n + 1000, ...extra });
  const benchmarks = [B(-86,'pullups',7), B(-44,'pullups',9), B(-3,'pullups',11), B(-86,'pushups',32), B(-44,'pushups',38), B(-3,'pushups',41), B(-86,'hang',48), B(-44,'hang',62), B(-3,'hang',75),
    B(-86,'plank',90), B(-44,'plank',105), B(-3,'plank',120), B(-86,'deadlift',W(365),{ u }), B(-44,'deadlift',W(380),{ u }), B(-3,'deadlift',W(395),{ u })];
  const injuries = [{ id:'si1', area:'Knee', side:'left', severity:2, date:d(-8), notes:'Tweaked it in a knee slice battle. Fine for drilling, careful with leg locks.', updates:[{ date:d(-8), severity:4 },{ date:d(-5), severity:3 },{ date:d(-2), severity:2 }], sample:true, createdAt:1 },
    { id:'si2', area:'Fingers', side:'right', severity:2, date:d(-60), healed:d(-41), notes:'Jammed ring finger, buddy taped.', updates:[], sample:true, createdAt:2 }];
  const G = (id, key, target, extra={}) => ({ id, key, target, u, sample:true, createdAt:Date.now() - 90*864e5, ...extra });
  const strength = [G('sg1','deadlift',W(405),{ date:d(60) }), G('sg2','bench',W(245),{ date:d(90) }), G('sg3','pullups',15,{ u:undefined }), G('sg4','pushups',40,{ u:undefined, achieved:{ date:d(-3), value:41 } })];
  return { comps, benchmarks, injuries, strength };
}

/* Forged 3.2.0: challenges, XP + ranks, badges, unlockable looks, share cards, friend challenge links.
   Loaded before app.js; everything here runs at call time and uses app.js helpers (db, iso, parse, ...).
   XP, challenge results and badges are recomputed from the saved data (pure functions), so existing users
   get credit for their history and nothing can drift. Only "seen" markers, the chosen look and the Pro week
   are stored in db.game. A future sync layer plugs in through ForgedSync (see docs/social-plan.md). */

/* ---------- sync seam (no server today) ---------- */
window.ForgedSync = window.ForgedSync || { enabled:false, adapter:null,
  emit(type, payload){ if (this.enabled && this.adapter && this.adapter.push) try { this.adapter.push({ type, payload, at:Date.now() }); } catch(e) { console.warn('sync', e); } } };

/* ---------- small helpers ---------- */
const G_DAY = 864e5;
const gHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const gRand = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gMonthEnd = m => { const [y, mo] = m.split('-').map(Number); return iso(new Date(y, mo, 0)); };
const gWeekKey = d => iso(weekStart(typeof d === 'string' ? parse(d) : d));
const sessMin = s => Number(s.duration) || 0;
/* anti-abuse-light: entries logged more than 7 days after their date don't count toward challenges */
const gFair = s => !s.createdAt || (s.createdAt - (parse(s.date).getTime() + G_DAY)) <= 7 * G_DAY;
function sanitizeGame(g){
  // 3.18.0: XP, ranks, medals, badges and looks are gone; only challenge history, friend challenges and head-to-head results are kept
  g = g && typeof g === 'object' ? g : {};
  const arr = a => Array.isArray(a) ? a : [];
  return { seenDone:arr(g.seenDone).map(String).slice(-400),
    friend:arr(g.friend).filter(x => x && x.code && x.title).slice(-20),
    h2h:Object.fromEntries(Object.entries(g.h2h && typeof g.h2h === 'object' ? g.h2h : {}).filter(([k, v]) => v && isoOk(v.end) && ['won','tied','lost'].includes(v.r)).slice(-200)) };
}
const game = () => (db.game = db.game && db.game.friend && !db.game.look ? db.game : sanitizeGame(db.game));

/* ---------- challenge pool ----------
   period d/w/m, tier 1-3 (Easy/Medium/Hard), need(): eligible for this user, val(ctx): progress value. */
const TIER = ['', 'Easy', 'Medium', 'Hard'];
const has = c => enabled(c);
const combat = () => ['grappling','striking','mma'].some(has);
const sumBy = (l, f) => l.reduce((a, x) => a + (f(x) || 0), 0);
const grRounds = s => s.category === 'grappling' ? (Number(s.rounds) || (s.rolls||[]).length || 0) : s.category === 'mma' ? (s.strike?.mix?.grappling || 0) : 0;
const sparRounds = s => (s.category === 'striking' || s.category === 'mma') ? (s.strike?.mix?.sparring || 0) : 0;
const setsOf = s => (s.exercises||[]).reduce((a, e) => a + (e.sets||[]).filter(x => Number(x.reps) > 0).length, 0);
const daysMeeting = (from, to, f) => { let n = 0; for (let d = parse(from); iso(d) <= to; d = addDays(d, 1)) if (f(iso(d))) n++; return n; };
/* ---------- bodyweight rep log (3.3.0): quick +10/+25 logging without a full workout ---------- */
const REP_EX = {
  pushups:{ label:'Push-ups', short:'push-ups', unit:'reps', steps:[10,25], re:/push[\s-]?ups?|press[\s-]?ups?/i },
  squats:{ label:'Air squats', short:'squats', unit:'reps', steps:[10,25], re:/\bsquats?\b/i, bw:true },
  situps:{ label:'Sit-ups', short:'sit-ups', unit:'reps', steps:[10,25], re:/sit[\s-]?ups?|crunch/i },
  lunges:{ label:'Lunges', short:'lunges', unit:'reps', steps:[10,20], re:/\blunges?\b/i, bw:true },
  burpees:{ label:'Burpees', short:'burpees', unit:'reps', steps:[5,10], re:/burpees?/i },
  dips:{ label:'Desk dips', short:'dips', unit:'reps', steps:[10,15], re:/\bdips?\b/i, bw:true },
  pullups:{ label:'Pull-ups', short:'pull-ups', unit:'reps', steps:[5,10], re:/pull[\s-]?ups?|chin[\s-]?ups?/i },
  plank:{ label:'Plank', short:'plank', unit:'sec', steps:[30,60] },
  wallsit:{ label:'Wall sit', short:'wall sit', unit:'sec', steps:[30,60] },
  mobility:{ label:'Mobility', short:'mobility', unit:'min', steps:[5,10] }
};
const REP_KEYS = Object.keys(REP_EX);
function sanitizeReps(list){
  return (Array.isArray(list) ? list : []).filter(x => x && REP_EX[x.ex] && isoOk(x.date) && Number(x.n) > 0)
    .map(x => ({ id:String(x.id || uid()), date:x.date, ex:x.ex, n:Math.min(10000, Math.round(Number(x.n))), createdAt:Number(x.createdAt) || 0, ...(x.sample ? { sample:true } : {}) }));
}
const fmtRep = (ex, n) => { const u = REP_EX[ex].unit; n = Math.round(n);
  if (u === 'sec') return n >= 60 && n % 60 === 0 ? `${n / 60} min` : n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n} s`;
  return u === 'min' ? `${n} min` : String(n); };
/* day → exercise → total, from the rep log plus matching sets in workouts (fair-logged only); cached */
let repIdx = null, repIdxKey = '';
function repIndex(){
  const r = db.reps || [], key = r.length + ':' + r.reduce((a, x) => a + x.n + (x.createdAt % 997), 0) + '|' + db.sessions.length + ':' + db.sessions.reduce((a, s) => a + (s.updatedAt || s.createdAt || 0) % 1e7 + (s.duration || 0), 0);
  if (repIdx && key === repIdxKey) return repIdx;
  const idx = {}, add = (d, ex, n) => { (idx[d] = idx[d] || {})[ex] = (idx[d][ex] || 0) + n; };
  r.forEach(x => { if (gFair(x)) add(x.date, x.ex, x.n); });
  db.sessions.forEach(s => { if (!gFair(s)) return;
    if (s.category === 'mobility') add(s.date, 'mobility', Number(s.duration) || 0);
    (s.exercises || []).forEach(e => { const nm = String(e.name || ''); const ex = REP_KEYS.find(k => REP_EX[k].re && REP_EX[k].re.test(nm)); if (!ex) return;
      (e.sets || []).forEach(x => { const reps = Number(x.reps) || 0; if (reps > 0 && !(REP_EX[ex].bw && Number(x.weight) > 0)) add(s.date, ex, reps); }); }); });
  repIdx = idx; repIdxKey = key; return idx;
}
function repTotal(ex, from, to){
  const idx = repIndex(); let n = 0;
  if (from === to) return (idx[from] && idx[from][ex]) || 0;
  for (let d = parse(from); iso(d) <= to; d = addDays(d, 1)) { const x = idx[iso(d)]; if (x && x[ex]) n += x[ex]; }
  return n;
}
const repKey = () => { const r = db.reps || []; return r.length + ':' + r.reduce((a, x) => a + x.n, 0); };
/* today's targets per exercise, from today's daily challenges */
function repGoalsToday(){ const g = {}; currentChallenges().filter(c => c.p === 'd' && c.parts).forEach(c => c.parts.forEach(([ex, n]) => { g[ex] = Math.max(g[ex] || 0, n); })); return g; }
function repsSheet(focus){
  const goals = repGoalsToday(), day = today();
  const order = [...new Set([focus, ...Object.keys(goals), ...REP_KEYS].filter(k => REP_EX[k]))];
  const el = h(`<div id="repsSheet"><h3>Log reps</h3><div class="hint" style="margin:-6px 0 12px">Quick log for today, no workout needed. Counts toward your challenges. Reps from logged workouts count too.</div><div id="repRows"></div></div>`);
  const rows = el.querySelector('#repRows'); let changed = false;
  const rowHtml = ex => { const R = REP_EX[ex], tot = repTotal(ex, day, day), g = goals[ex];
    return `<div class="reprow${ex === focus ? ' focus' : ''}${g && tot >= g ? ' met' : ''}" data-ex="${ex}"><div class="grow"><b>${R.label}</b><small><span data-tot>${fmtRep(ex, tot)}</span> today${g ? ` / ${fmtRep(ex, g)}` : ''}${g && tot >= g ? ' ✓' : ''}</small>${g ? `<span class="sgbar"><i style="width:${Math.min(100, tot / g * 100)}%"></i></span>` : ''}</div>
      <div class="repbtns">${R.steps.map(n => `<button type="button" class="btn sm" data-add-rep="${n}">+${R.unit === 'sec' ? fmtRep(ex, n) : R.unit === 'min' ? n + ' min' : n}</button>`).join('')}<button type="button" class="iconbtn" data-undo-rep aria-label="Undo last ${R.label}" ${(db.reps || []).some(x => x.ex === ex && x.date === day) ? '' : 'disabled'}>↶</button></div></div>`; };
  const draw = () => { rows.innerHTML = order.map(rowHtml).join(''); };
  rows.addEventListener('click', ev => {
    const row = ev.target.closest('.reprow'); if (!row) return; const ex = row.dataset.ex;
    const add = ev.target.closest('[data-add-rep]'), und = ev.target.closest('[data-undo-rep]');
    if (add) { db.reps = db.reps || []; db.reps.push({ id:uid(), date:day, ex, n:Number(add.dataset.addRep), createdAt:Date.now() }); }
    else if (und) { const mine = db.reps.filter(x => x.ex === ex && x.date === day); const last = mine[mine.length - 1]; if (!last) return; db.reps = db.reps.filter(x => x !== last); }
    else return;
    changed = true; save(); row.outerHTML = rowHtml(ex);
  });
  draw(); openSheet(el, () => { if (changed) whenSettled(route); }, { closeLabel:'Done' });
}
function markChallengeDone(key){
  const c = currentChallenges().find(x => x.key === key); if (!c || !c.parts) return;
  const day = today(), added = [];
  c.parts.forEach(([ex, n]) => { const left = n - repTotal(ex, day, day); if (left > 0) { const rec = { id:uid(), date:day, ex, n:left, createdAt:Date.now() }; (db.reps = db.reps || []).push(rec); added.push(rec.id); } });
  if (!added.length) return; save();
  chUndoPush(`Done: ${c.title}`, () => { db.reps = db.reps.filter(x => !added.includes(x.id)); save(); route(); });
  const y = window.scrollY; route(); window.scrollTo(0, y);
}
document.addEventListener('click', e => {
  const lr = e.target.closest('[data-logreps]'); if (lr) { e.preventDefault(); e.stopPropagation(); repsSheet(lr.dataset.logreps); return; }
  const tk = e.target.closest('[data-chtick]'); if (tk) { e.preventDefault(); e.stopPropagation(); chTick(tk.dataset.chtick, Number(tk.dataset.dir)); return; }
  const dn = e.target.closest('[data-chdone]'); if (dn) { e.preventDefault(); e.stopPropagation(); markChallengeDone(dn.dataset.chdone); }
});
const CH_POOL = [
  // daily: quick no-equipment bodyweight workouts (5–15 min, office or home), for everyone regardless of sport
  { id:'d-push30', p:'d', tier:1, t:'30 push-ups', parts:[['pushups',30]], how:'Any number of sets through the day.', scale:'Easier: knees or hands on a desk.' },
  { id:'d-squat50', p:'d', tier:1, t:'50 air squats', parts:[['squats',50]], how:'Feet shoulder-width, sit back, chest up.', scale:'Easier: squat to a chair.' },
  { id:'d-plank3', p:'d', tier:1, t:'3 × 1-min plank', parts:[['plank',180]], how:'Three 1-minute holds, rest as needed.', scale:'Easier: knees down.' },
  { id:'d-mob10', p:'d', tier:1, t:'10-min mobility flow', parts:[['mobility',10]], how:'Hips, shoulders, spine. Any stretches you like.', scale:'Follow along at your own pace.' },
  { id:'d-wall2', p:'d', tier:1, t:'2-min wall sit', parts:[['wallsit',120]], how:'Back flat on the wall, thighs parallel. Split it up if needed.', scale:'Easier: sit a little higher.' },
  { id:'d-push50', p:'d', tier:2, t:'50 push-ups', parts:[['pushups',50]], how:'Break it into sets of 10.', scale:'Easier: knees. Harder: feet on a chair.' },
  { id:'d-squat100', p:'d', tier:2, t:'100 air squats', parts:[['squats',100]], how:'Sets of 20–25 work well.', scale:'Easier: half depth.' },
  { id:'d-lunge50', p:'d', tier:2, t:'50 lunges', parts:[['lunges',50]], how:'Alternate legs; 25 each side.', scale:'Easier: hold a wall.' },
  { id:'d-dips30', p:'d', tier:2, t:'30 desk dips', parts:[['dips',30]], how:'Hands on a sturdy desk or chair edge, lower slowly.', scale:'Easier: bend your knees more.' },
  { id:'d-wall3', p:'d', tier:2, t:'3-min wall sit', parts:[['wallsit',180]], how:'Total time; split into holds.', scale:'Easier: sit a little higher.' },
  { id:'d-push100', p:'d', tier:3, t:'100 push-ups today', parts:[['pushups',100]], how:'Spread them out: 10 every hour adds up.', scale:'Easier: mix in knee push-ups.' },
  { id:'d-burpee30', p:'d', tier:3, t:'30 burpees', parts:[['burpees',30]], how:'Chest to floor, jump at the top. Sets of 5–10.', scale:'Easier: step back instead of jumping.' },
  { id:'d-5rounds', p:'d', tier:3, t:'5 rounds: 10 push-ups, 10 squats, 10 sit-ups', parts:[['pushups',50],['squats',50],['situps',50]], how:'Do 10 of each, 5 times. About 10 minutes.', scale:'Easier: 3 rounds, then finish later.' },
  { id:'d-squat150', p:'d', tier:3, t:'150 air squats', parts:[['squats',150]], how:'Sets of 25 with short rests.', scale:'Easier: half depth.' },
  { id:'d-plank5', p:'d', tier:3, t:'5 minutes of plank', parts:[['plank',300]], how:'Total time across holds.', scale:'Easier: knees down.' },
  // weekly
  { id:'w-3', p:'w', tier:1, t:'3 sessions this week', goal:3, val:c => c.s.length },
  { id:'w-mob2', p:'w', tier:1, need:() => has('mobility'), t:'2 mobility sessions', goal:2, val:c => c.s.filter(s => s.category === 'mobility').length },
  { id:'w-weigh3', p:'w', tier:1, need:() => has('weight'), t:'Weigh in 3 times', goal:3, val:c => weightSeries().filter(x => x.date >= c.from && x.date <= c.to).length },
  { id:'w-4', p:'w', tier:2, t:'4 sessions this week', goal:4, val:c => c.s.length },
  { id:'w-5h', p:'w', tier:2, t:'5 training hours', goal:300, unit:'min', fmt:v => `${hrs(v)} / 5 h`, val:c => sumBy(c.s, sessMin) },
  { id:'w-roll20', p:'w', tier:2, need:() => has('grappling') || has('mma'), t:'20 rounds of rolling', goal:20, unit:'rounds', val:c => sumBy(c.s, grRounds) },
  { id:'w-spar8', p:'w', tier:2, need:() => has('striking') || has('mma'), t:'8 sparring rounds', goal:8, unit:'rounds', val:c => sumBy(c.s, sparRounds) },
  { id:'w-cardio60', p:'w', tier:2, need:() => has('cardio'), t:'60 minutes of cardio', goal:60, unit:'min', val:c => sumBy(c.s.filter(s => s.category === 'cardio'), sessMin) },
  { id:'w-3cat', p:'w', tier:3, need:() => CAT_KEYS.filter(has).length >= 3, t:'Hit 3 different categories', goal:3, unit:'categories', val:c => new Set(c.s.map(s => s.category)).size },
  { id:'w-pr', p:'w', tier:3, need:() => has('weights'), t:'Hit a new PR', goal:1, unit:'PR', val:c => c.prs },
  { id:'w-6', p:'w', tier:3, t:'6 sessions this week', goal:6, val:c => c.s.length },
  { id:'w-feel3', p:'w', tier:1, t:'Log how 3 sessions felt', goal:3, val:c => c.s.filter(s => s.feel).length },
  { id:'w-plank5', p:'w', tier:2, t:'3-min plank, 5 days this week', goal:5, unit:'days', val:c => daysMeeting(c.from, c.to, d => repTotal('plank', d, d) >= 180) },
  { id:'w-pull50', p:'w', tier:2, t:'50 pull-ups this week', goal:50, unit:'reps', rep:'pullups', val:c => repTotal('pullups', c.from, c.to) },
  { id:'w-hard2', p:'w', tier:2, t:'2 sessions at effort 8+', goal:2, val:c => c.s.filter(s => rpeOf(s) >= 8).length },
  { id:'w-sets60', p:'w', tier:2, need:() => has('weights'), t:'Log 60 working sets', goal:60, unit:'sets', val:c => sumBy(c.s, setsOf) },
  { id:'w-roll5x3', p:'w', tier:2, need:() => has('grappling') || has('mma'), t:'3 sessions with 5+ rounds rolled', goal:3, val:c => c.s.filter(s => grRounds(s) >= 5).length },
  { id:'w-push100x5', p:'w', tier:3, t:'100 push-ups, 5 days this week', goal:5, unit:'days', rep:'pushups', val:c => daysMeeting(c.from, c.to, d => repTotal('pushups', d, d) >= 100) },
  { id:'w-squat100x5', p:'w', tier:3, t:'100 squats, 5 days this week', goal:5, unit:'days', rep:'squats', val:c => daysMeeting(c.from, c.to, d => repTotal('squats', d, d) >= 100) },
  { id:'w-double', p:'w', tier:3, t:'Two sessions in one day', goal:1, val:c => countBy(c.s.map(s => s.date)).filter(([, n]) => n >= 2).length },
  // monthly
  { id:'m-ring', p:'m', tier:1, t:'Hit your monthly workout goal', goal:() => clamp(Math.round(Number(db.profile.challengeTarget) || 8), 1, 31), val:c => c.s.length },
  { id:'m-bench', p:'m', tier:1, t:'Log a benchmark test', goal:1, val:c => db.benchmarks.filter(b => b.key !== 'bw' && b.date >= c.from && b.date <= c.to).length },
  { id:'m-12', p:'m', tier:2, t:'12 sessions this month', goal:12, val:c => c.s.length },
  { id:'m-2pr', p:'m', tier:2, need:() => has('weights'), t:'2 new PRs this month', goal:2, unit:'PRs', val:c => c.prs },
  { id:'m-20h', p:'m', tier:3, need:combat, t:'20 mat hours this month', goal:1200, unit:'min', fmt:v => `${hrs(v)} / 20 h`, val:c => sumBy(c.s.filter(s => ['grappling','striking','mma'].includes(s.category)), sessMin) },
  { id:'m-all', p:'m', tier:3, need:() => CAT_KEYS.filter(has).length >= 2, t:'Train every category you track', goal:() => CAT_KEYS.filter(has).length, unit:'categories', val:c => new Set(c.s.map(s => s.category).filter(has)).size },
  { id:'m-16', p:'m', tier:3, t:'16 sessions this month', goal:16, val:c => c.s.length },
  { id:'m-90day', p:'m', tier:2, need:combat, t:'90 minutes on the mats in one day', goal:1, val:c => Object.values(c.s.filter(s => ['grappling','striking','mma'].includes(s.category)).reduce((a, s) => { a[s.date] = (a[s.date] || 0) + sessMin(s); return a; }, {})).filter(m => m >= 90).length },
  { id:'m-push1000', p:'m', tier:3, t:'1,000 push-ups this month', goal:1000, unit:'reps', rep:'pushups', val:c => repTotal('pushups', c.from, c.to) }
];
const CH_COUNT = { d:3, w:3, m:3 };
const chTickable = t => t.p !== 'd' && !t.parts && !t.rep && !t.fmt && !['min','reps','sets','rounds'].includes(t.unit);
function chTick(key, dir){
  const c = currentChallenges().find(x => x.key === key); if (!c || !c.tick) return;
  const m = db.chManual = db.chManual || {}, prev = m[key];
  if (dir > 0) { if (c.value >= c.goal) return; m[key] = Math.min(c.goal, c.value + 1); }
  else { const nv = c.value - 1; if (nv <= c.auto) delete m[key]; else m[key] = nv; }
  save(); const y = window.scrollY; route(); window.scrollTo(0, y);
  if (dir > 0) chUndoPush(`Done: ${c.title} (${Math.min(c.goal, c.value + 1)} / ${c.goal})`, () => { if (prev === undefined) delete m[key]; else m[key] = prev; save(); const y2 = window.scrollY; route(); window.scrollTo(0, y2); });
}
const chGoal = t => t.parts ? (t.parts.length === 1 ? t.parts[0][1] : 100) : typeof t.goal === 'function' ? t.goal() : t.goal;
/* rep-based value: single exercise = its total; combos = % of the slowest part */
function partsVal(t, from, to){
  if (t.parts.length === 1) return repTotal(t.parts[0][0], from, to);
  return Math.round(Math.min(...t.parts.map(([ex, n]) => Math.min(1, repTotal(ex, from, to) / n))) * 100);
}
const partsProg = (t, from, to) => t.parts.map(([ex, n]) => `${fmtRep(ex, Math.min(n, repTotal(ex, from, to)))} / ${fmtRep(ex, n)}${t.parts.length > 1 ? ' ' + REP_EX[ex].short : ''}`).join(' · ');
function periodOf(p, day = today()){
  if (p === 'd') return { key:day, from:day, to:day };
  if (p === 'w') { const f = gWeekKey(day); return { key:'w' + f, from:f, to:iso(addDays(parse(f), 6)) }; }
  const m = day.slice(0, 7); return { key:'m' + m, from:m + '-01', to:gMonthEnd(m) };
}
/* deterministic pick: same date + same sports = same challenges; one per tier first */
function pickChallenges(p, key){
  const pool = CH_POOL.filter(t => t.p === p && (!t.need || t.need())), r = gRand(gHash(key + '|' + CAT_KEYS.filter(has).join(',')));
  const sh = pool.map(t => [r(), t]).sort((a, b) => a[0] - b[0]).map(x => x[1]), out = [];
  [1, 2, 3].forEach(tier => { const t = sh.find(x => x.tier === tier && !out.includes(x)); if (t) out.push(t); });
  sh.forEach(t => { if (out.length < CH_COUNT[p] && !out.includes(t)) out.push(t); });
  return out.slice(0, CH_COUNT[p]).sort((a, b) => a.tier - b.tier);
}
/* PR events: a weights set beating your previous best est. 1RM for that exercise (fair-logged only) */
function prEvents(){
  const best = {}, ev = [];
  db.sessions.filter(s => s.exercises && s.exercises.length).slice().sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt||0) - (b.createdAt||0)).forEach(s => {
    let n = 0;
    s.exercises.forEach(e => { const k = String(e.name||'').trim().toLowerCase(); if (!k) return; const v = Math.max(0, ...(e.sets||[]).map(x => e1rm(Number(x.weight)||0, Number(x.reps)||0)));
      if (!v) return; if (best[k] && v > best[k] + 0.01 && n < 3) { n++; ev.push({ date:s.date, name:e.name, v:Math.round(v), fair:gFair(s), id:s.id }); } best[k] = Math.max(best[k] || 0, v); });
  });
  return ev;
}
function evalChallenge(t, per, prs){
  const s = db.sessions.filter(x => x.date >= per.from && x.date <= per.to && gFair(x));
  const goal = chGoal(t), auto = (t.parts ? partsVal(t, per.from, per.to) : t.val({ s, from:per.from, to:per.to, prs:prs.filter(e => e.fair && e.date >= per.from && e.date <= per.to).length })) || 0;
  // manual check-offs: stored as a running total that already includes auto, so v = max(auto, manual) never double counts; capped at goal
  const tick = chTickable(t), man = tick ? Number((db.chManual || {})[`${per.key}:${t.id}`]) || 0 : 0, v = man > auto ? Math.min(goal, man) : auto;
  return { id:t.id, tick, auto, man:v > auto, key:`${per.key}:${t.id}`, p:t.p, tier:t.tier, title:t.t, goal, value:v, pct:Math.min(100, Math.round(v / goal * 100)), done:v >= goal,
    ...(t.parts ? { parts:t.parts, how:t.how, scale:t.scale, rep:t.parts[0][0] } : t.rep ? { rep:t.rep } : {}),
    progress:t.parts ? partsProg(t, per.from, per.to) : t.fmt ? t.fmt(v) : `${Math.min(v, goal) === v ? Math.round(v * 10) / 10 : Math.round(v)} / ${goal}${t.unit ? ' ' + t.unit : ''}`, from:per.from, to:per.to, period:per.key };
}
function currentChallenges(){ const prs = prEvents(); return ['d','w','m'].flatMap(p => { const per = periodOf(p); return pickChallenges(p, per.key).map(t => evalChallenge(t, per, prs)); }); }
function timeLeft(to){
  const end = addDays(parse(to), 1).getTime(), ms = Math.max(0, end - Date.now()), d = Math.floor(ms / G_DAY), hh = Math.floor(ms % G_DAY / 36e5), mm = Math.floor(ms % 36e5 / 6e4);
  return d >= 2 ? `${d} days left` : d === 1 ? `1 day ${hh}h left` : hh ? `${hh}h ${mm}m left` : `${mm}m left`;
}




function actionToast(msg, label, fn){
  const t = $('#toast'); t.innerHTML = `${esc(msg)} <button type="button" class="tbtn">${esc(label)}</button>`; t.classList.add('show', 'act');
  t.querySelector('.tbtn').onclick = () => { t.classList.remove('show','act'); fn(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show','act'), 5000);
}



/* 3.18.0: one daily challenge line on Home (replaces Today's marks and the challenges card) */
function dailyChallengeLine(){
  const c = currentChallenges().filter(x => x.p === 'd').sort((a, b) => Number(a.done) - Number(b.done) || a.tier - b.tier)[0];
  if (!c) return '';
  return `<a class="card chline${c.done ? ' done' : ''}" id="dailyChallenge" href="#/challenges"><span class="chl-k">Today's challenge</span><b>${esc(c.title)}</b><small>${c.done ? '✓ Done' : esc(c.progress)}</small>›</a>`;
}

/* ---------- Challenges screen ---------- */
function chActions(c){
  if (c.done) return `<div class="chact"><button type="button" class="btn sm" data-sharech="${esc(c.key)}">Share</button></div>`;
  if (c.tick) return `<div class="chact"><button type="button" class="btn sm primary" data-chtick="${esc(c.key)}" data-dir="1">Done</button></div>`;
  const lr = c.rep || '';
  return lr || c.parts ? `<div class="chact">${lr ? `<button type="button" class="btn sm" data-logreps="${lr}">Log reps</button>` : ''}${c.parts ? `<button type="button" class="btn sm primary" data-chdone="${esc(c.key)}">Done</button>` : ''}</div>` : '';
}
function chRow(c){
  return `<div class="list-row chrow${c.done ? ' done' : ''}" data-ch="${esc(c.key)}"><div class="grow"><b>${esc(c.title)} <span class="pill tier t${c.tier}">${TIER[c.tier]}</span></b>
    ${c.how && !c.done ? `<div class="chhow">${esc(c.how)}${c.scale ? ` <span class="chscale">${esc(c.scale)}</span>` : ''}</div>` : ''}
    <small data-prog>${esc(c.progress)}${c.done ? ' · ✓ done' : ''}</small><span class="sgbar"><i style="width:${c.pct}%"></i></span>${chActions(c)}</div>
    </div>`;
}
function viewChallenges(){
  setHeader('Challenges', `${socialOn() ? '<a class="btn sm" href="#/friends" id="friendsTop">Friends</a> ' : ''}<button type="button" class="btn sm" data-logreps="pushups" id="logRepsTop">Log reps</button>`, { parent:'#/' });
  const cur = currentChallenges(), v = $('#view');
  const sec = (p, title) => { const l = cur.filter(c => c.p === p); return l.length ? `<div class="card" id="ch-${p}"><h2>${title} <small data-left>${timeLeft(l[0].to)}</small></h2>${p === 'd' ? '<div class="hint chintro">Quick no-equipment workouts, 5–15 minutes, anywhere. Pick your level.</div>' : ''}${l.map(chRow).join('')}</div>` : ''; };
  const fr = game().friend.filter(x => x.to >= iso(addDays(new Date(), -7)));
  v.innerHTML = `${sec('d','Daily')}${sec('w','Weekly')}${sec('m','Monthly')}
    <div class="card" id="friendCard"><h2>Friend challenges</h2>${fr.length ? fr.map(friendRow).join('') : '<div class="hint" style="margin:-4px 0 8px">Send a challenge link. Your friend joins on their own phone and tracks it with their own workouts (self-reported, no accounts).</div>'}
      <button type="button" class="btn block" id="challengeFriend" style="margin-top:8px">Challenge a friend</button>${socialOn() ? '<a class="list-row" href="#/friends" id="friendsLink" style="text-decoration:none;color:inherit;margin-top:6px"><div class="grow"><b>Friends &amp; head-to-head</b><small>Live standings with friends (optional account)</small></div>›</a>' : ''}</div>
    <div class="hint" style="padding:0 6px 20px">New daily challenges at midnight, weekly on Monday, monthly on the 1st. Progress comes from what you log. Workouts added more than 7 days late don't count toward challenges.</div>`;
  v.querySelectorAll('[data-sharech]').forEach(b => b.onclick = () => shareSheet('challenge', cur.find(c => c.key === b.dataset.sharech)));
  $('#challengeFriend').onclick = friendSheet;
}

/* ---------- friend challenge links (no server: the challenge rides in the URL) ---------- */
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function friendCode(t, days, from, inv){ return b64u(JSON.stringify({ v:1, id:t.id, d:days, f:String(from||'').slice(0, 30), s:today(), ...(inv && INVITE_RE.test(inv) ? { i:inv } : {}) })); }
function readFriendCode(code){
  try { const o = JSON.parse(unb64u(code)); const t = CH_POOL.find(x => x.id === o.id); if (!t || o.v !== 1 || !isoOk(o.s)) return null;
    const days = clamp(Number(o.d) || 7, 1, 31); return { code, tid:t.id, title:t.t, from:o.f || 'A friend', days, inv:typeof o.i === 'string' && INVITE_RE.test(o.i) ? o.i : '' }; } catch(e) { return null; }
}
function friendRow(x){
  const t = CH_POOL.find(c => c.id === x.tid); if (!t) return '';
  const r = evalChallenge(t, { key:'f' + x.code.slice(0, 8), from:x.start, to:x.to }, prEvents());
  return `<div class="list-row chrow${r.done ? ' done' : ''}" data-friend="${esc(x.code)}"><div class="grow"><b>${esc(x.title)}</b><small>From ${esc(x.from)} · ${esc(r.progress)}${r.done ? ' · ✓ done' : ` · ${timeLeft(x.to)}`}</small><span class="sgbar"><i style="width:${r.pct}%"></i></span></div></div>`;
}
function friendSheet(){
  const pool = CH_POOL.filter(t => t.p !== 'd' && (!t.need || t.need()));
  let tid = pool[0].id, days = 7;
  const live = !!sUser();
  const el = h(`<div><h3>Challenge a friend</h3><div class="hint" style="margin:-6px 0 12px">${live ? 'They open the link on their phone. Signed in, they can add you as a friend from it and race you live; otherwise they track it on their own phone.' : 'They open the link on their phone and track it with their own workouts. No accounts, nothing uploaded.'}</div></div>`);
  const list = h(`<div class="focuschips" id="friendPick">${pool.map(t => `<button type="button" data-tid="${t.id}" class="${t.id === tid ? 'on' : ''}">${esc(t.t)}</button>`).join('')}</div>`);
  list.querySelectorAll('button').forEach(b => b.onclick = () => { tid = b.dataset.tid; list.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  el.appendChild(field('Challenge', list));
  el.appendChild(field('Time to do it', seg([[7,'1 week'],[14,'2 weeks'],[30,'30 days']], days, x => days = x)));
  const name = h(`<input class="input" type="text" id="friendFrom" placeholder="Your name (shown to them)" value="${esc(db.profile.name||'')}">`); el.appendChild(field('From', name));
  const btn = h('<button type="button" class="btn primary block" id="friendSend" style="margin-top:12px">Share challenge link</button>'); el.appendChild(btn);
  btn.onclick = async () => {
    let inv = ''; if (live) { inv = sCache().invite || ''; if (!inv) try { inv = await Cloud().myInvite(); } catch(e) { inv = ''; } }
    const t = CH_POOL.find(x => x.id === tid), url = location.href.split('#')[0] + '#/join/' + friendCode(t, days, name.value.trim(), inv), text = `${name.value.trim() || 'I'} challenged you on Forged: ${t.t} (${days} days)`;
    window.__lastFriendUrl = url;
    try { if (navigator.share) { await navigator.share({ title:'Forged challenge', text, url }); toast('Challenge sent'); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied. Paste it to your friend'); }
      else { prompt('Copy this link', url); } } catch(e) { if (e && e.name !== 'AbortError') toast('Could not share'); }
  };
  openSheet(el, null, { closeLabel:'Cancel' });
}
function viewJoin(code){
  const x = readFriendCode(code || '');
  if (!x) { toast('That challenge link is not valid'); replacing = true; location.replace('#/challenges'); return; }
  setHeader('Challenge', '', { parent:'#/challenges' });
  const already = game().friend.some(f => f.code === x.code);
  $('#view').innerHTML = `<div class="card" id="joinCard"><h2>${esc(x.from)} challenged you</h2><div class="joint">${esc(x.title)}</div><div class="hint">${x.days} days from when you accept. Progress comes from your own logged workouts and stays on your phone.</div>
    <button type="button" class="btn primary block" id="joinGo" style="margin-top:14px">${already ? 'Already joined: see challenges' : 'Accept challenge'}</button></div>
    ${x.inv && socialOn() ? `<div class="card" id="joinLive"><h2>Compete live</h2><div class="hint" style="margin:-4px 0 10px">Add ${esc(x.from)} as a friend to see each other's progress and start a head-to-head.</div><button type="button" class="btn block" id="joinFriend">${sUser() ? `Add ${esc(x.from)} as a friend` : `Sign in to add ${esc(x.from)}`}</button></div>` : ''}`;
  const jf = $('#joinFriend'); if (jf) jf.onclick = () => { if (sUser()) socialAccept(x.inv); else { sLS.set('invite', x.inv); go('#/signin'); } };
  $('#joinGo').onclick = () => { if (!already) { game().friend.push({ code:x.code, tid:x.tid, title:x.title, from:x.from, start:today(), to:iso(addDays(new Date(), x.days - 1)) }); save(); toast('Challenge accepted'); ForgedSync.emit('friend.join', { tid:x.tid }); } go('#/challenges'); };
}

/* ---------- 3.4.0: friends, head-to-head, leaderboards (optional account; network in social.js) ----------
   Off unless FORGED_CONFIG.social is true (config.js) or this phone opted into the preview with ?social=1.
   Local data stays the source of truth. Signed in, per-day counts sync through ForgedSync + an offline queue. */
const CFG = window.FORGED_CONFIG || {};
(() => { try { const q = new URLSearchParams(location.search).get('social');
  if (q === '1') localStorage.setItem('forged.social.preview', '1'); if (q === '0') localStorage.removeItem('forged.social.preview'); } catch(e) {} })();
(() => { try { const q = new URLSearchParams(location.search).get('uname'); if (q === '1') localStorage.setItem('forged.uname.preview', '1'); if (q === '0') localStorage.removeItem('forged.uname.preview'); } catch(e) {} })();
const unameOn = () => { try { return socialOn() && !!window.ForgedUsername && (!!CFG.usernames || localStorage.getItem('forged.uname.preview') === '1'); } catch(e) { return false; } };
const socialOn = () => { try { return !!(window.ForgedCloud && (CFG.social || localStorage.getItem('forged.social.preview') === '1')); } catch(e) { return false; } };
const Cloud = () => window.ForgedCloud;

/* ---------------- 3.7.0: Forged Pro paywall (flagged) ----------------
   Off unless FORGED_CONFIG.pro is true or this phone opted into the preview with ?pro=1 (?pro=0 turns it off).
   Payments is a stub: nothing is charged and isPro() still returns true for everyone. Replace purchase/restore with
   StoreKit / Play Billing (e.g. RevenueCat via Capacitor) or Stripe on the web when Pro goes live. */
(() => { try { const q = new URLSearchParams(location.search).get('pro');
  if (q === '1') localStorage.setItem('forged.pro.preview', '1'); if (q === '0') localStorage.removeItem('forged.pro.preview'); } catch(e) {} })();
const paywallOn = () => false;   // 3.13.5: Forged Pro removed
const proTag = () => paywallOn() ? '<a class="protag" href="#/pro" aria-label="Forged Pro feature">PRO</a>' : '';
const PRO_PLANS = [
  { id:'forged_pro_yearly', label:'Yearly', price:'$35.99', per:'/ year', note:'$3.00 / month · save 40%', best:true },
  { id:'forged_pro_monthly', label:'Monthly', price:'$4.99', per:'/ month', note:'Cancel anytime' }
];
const PRO_TRIAL_DAYS = 7;
const PRO_FEATURES = [
  ['🏋️', 'Programs & weight plans', 'Lifting programs built for fighters, plus eat-for-your-goal weight plans that adjust as you go.'],
  ['📋', 'Lifting templates', 'Ready-made strength, power and conditioning sessions with suggested weights.'],
  ['📈', 'Advanced stats', 'Training load, PR history, estimated 1RM trends and benchmark retests.'],
  ['👥', 'Social feed (coming soon)', 'See your training partners\' sessions and PRs.']
];
const Payments = {
  stub:true,
  products:() => PRO_PLANS.map(p => ({ id:p.id, price:p.price, trialDays:PRO_TRIAL_DAYS })),
  async purchase(id){ await new Promise(r => setTimeout(r, 250)); ForgedSync.emit('pro.purchase.stub', { id }); return { ok:false, stub:true, id }; },
  async restore(){ await new Promise(r => setTimeout(r, 250)); return { ok:false, stub:true, restored:0 }; }
};
function viewPro(){
  if (!paywallOn()) { go('#/settings'); return; }
  setHeader('Forged Pro', '', { parent:'#/settings' });
  let plan = PRO_PLANS[0].id;
  const v = $('#view');
  v.innerHTML = `<div class="paywall" id="paywall">
    <div class="pw-hero"><img src="brand/forged/forged-mark.svg" alt="" width="84" height="84"><h2>Forged <span>Pro</span></h2><p>Train with a plan. Every tool in Forged, unlocked.</p>
      <span class="pw-trial" id="pwTrial">${PRO_TRIAL_DAYS}-day free trial</span></div>
    <ul class="pw-feats" id="pwFeats">${PRO_FEATURES.map(([i, t, d]) => `<li><span class="pw-i" aria-hidden="true">${i}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ul>
    <div class="pw-plans" id="pwPlans" role="radiogroup" aria-label="Choose a plan">${PRO_PLANS.map(p => `<button type="button" class="pw-plan" role="radio" data-plan="${p.id}">${p.best ? '<em>Best value</em>' : ''}<b>${p.label}</b><span class="pw-price">${p.price}<small>${p.per}</small></span><small>${p.note}</small></button>`).join('')}</div>
    <button type="button" class="btn primary block" id="pwBuy">Start ${PRO_TRIAL_DAYS}-day free trial</button>
    <div class="hint pw-fine" id="pwFine"></div>
    <button type="button" class="btn block ghost" id="pwRestore">Restore purchases</button>
    <div class="hint pw-links"><a href="terms.html">Terms of Use</a> · <a href="privacy.html">Privacy Policy</a></div>
    <div class="pronote" id="pwPreview">Preview only. Payments aren't connected yet: nothing is charged, and every Pro feature is free for now.</div></div>`;
  const sync = () => { const p = PRO_PLANS.find(x => x.id === plan);
    v.querySelectorAll('.pw-plan').forEach(b => { const on = b.dataset.plan === plan; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('#pwFine').textContent = `Free for ${PRO_TRIAL_DAYS} days, then ${p.price} ${p.per.replace('/ ', 'per ')}. Renews automatically until you cancel. Cancel anytime in your App Store or Google Play settings at least 24 hours before the trial ends and you won't be charged.`; };
  v.querySelectorAll('.pw-plan').forEach(b => b.onclick = () => { plan = b.dataset.plan; sync(); }); sync();
  $('#pwBuy').onclick = async () => { const b = $('#pwBuy'); b.disabled = true; const r = await Payments.purchase(plan); b.disabled = false;
    toast(r.stub ? 'Preview only: nothing was charged. Pro is free for now.' : r.ok ? 'Welcome to Forged Pro' : 'Purchase didn\u2019t go through'); };
  $('#pwRestore').onclick = async () => { const r = await Payments.restore(); toast(r.stub ? 'Preview only: no purchases to restore' : `Restored ${r.restored}`); };
}
const sUser = () => socialOn() ? Cloud().user : null;
const S_ROUTES = ['friends','signin','invite','h2h','add'];
const S_METRIC = { sessions:{ label:'Sessions', unit:'sessions' }, pushups:{ label:'Push-ups', unit:'push-ups' }, mat_minutes:{ label:'Mat hours', unit:'h' }, daily_streak:{ label:'Daily challenge streak', unit:'days in a row' }, xp:{ label:'Workout XP', unit:'XP' } };
const S_SYNC = ['sessions','xp','pushups','mat_minutes','daily_done'];
const AV_COLORS = { flame:'#D7261E', ember:'#E5484D', gold:'#F5C542', steel:'#8FB0D9', jade:'#6FD3A8', violet:'#B48CF2', sky:'#38BDF8', rose:'#F472B6' };
const INVITE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
const sLS = {
  get(k, d){ try { const v = localStorage.getItem('forged.social.' + k); return v == null ? d : JSON.parse(v); } catch(e) { return d; } },
  set(k, v){ try { localStorage.setItem('forged.social.' + k, JSON.stringify(v)); } catch(e) {} },
  del(k){ try { localStorage.removeItem('forged.social.' + k); } catch(e) {} }
};
const sScore = (metric, v) => metric === 'mat_minutes' ? `${Math.round((v || 0) / 6) / 10}` : String(v || 0);
const sAvatar = (p, cls = '') => `<span class="av ${cls}" style="--av:${AV_COLORS[p && p.avatar_color] || AV_COLORS.flame}" aria-hidden="true">${esc((p && p.avatar_initial) || '?')}</span>`;
const sAgo = t => { if (!t) return 'not yet'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

/* What leaves the phone: per-day counts for the last 7 days. Nothing else (no notes, weight, food, details). */
function socialDaily(){
  const out = [], combatCats = ['grappling','striking','mma'];
  for (let i = 0; i < 7; i++) {
    const d = iso(addDays(new Date(), -i)), ss = db.sessions.filter(s => s.date === d && !s.sample && gFair(s)), n = Math.min(4, ss.length);
    out.push({ day:d, sessions:n, xp:Math.min(30, n * 10), pushups:Math.min(3000, Math.round(repTotal('pushups', d, d))),
      mat_minutes:Math.min(480, Math.round(sumBy(ss.filter(s => combatCats.includes(s.category)), sessMin))),
      daily_done:Math.min(3, currentChallenges().filter(c => c.p === 'd' && c.done && d === today()).length) });
  }
  return out;
}
/* Offline queue: day totals that differ from what the server last accepted. Survives reloads and offline days. */
function socialQueueDiff(){
  const sent = sLS.get('sent', {}), q = sLS.get('queue', {}), oldest = iso(addDays(new Date(), -6));
  socialDaily().forEach(r => S_SYNC.forEach(m => { const k = `${m}|${r.day}`;
    if (sent[k] === r[m] || (sent[k] === undefined && r[m] === 0)) delete q[k]; else q[k] = r[m]; }));
  Object.keys(q).forEach(k => { if (k.split('|')[1] < oldest) delete q[k]; });
  sLS.set('queue', q); return q;
}
function socialProfile(){
  const name = String(db.profile.name || '').trim().slice(0, 30) || 'Fighter';
  return { name, color:AV_COLORS[db.profile.avatarColor] ? db.profile.avatarColor : 'flame', rank:0, level:1, xp:0, belt:enabled('grappling') ? String(db.profile.belt || '') : '' };
}
let sTimer = null, sBusy = null, sPoll = null;
function socialSchedule(ms = 3000){ if (!sUser()) return; clearTimeout(sTimer); sTimer = setTimeout(() => socialSync(), ms); }
async function socialSync(force){
  if (!sUser()) return;
  if (sBusy) return sBusy;
  const q = socialQueueDiff();
  if (navigator.onLine === false) { socialStatus(); return; }
  sBusy = (async () => {
    try {
      const prof = socialProfile(), key = JSON.stringify(prof);
      if (force || sLS.get('prof', '') !== key) { await Cloud().saveProfile(prof); sLS.set('prof', key); }
      const keys = Object.keys(q).sort((a, b) => (a.startsWith('sessions') ? 0 : 1) - (b.startsWith('sessions') ? 0 : 1)).slice(0, 64);
      if (keys.length) {
        const entries = keys.map(k => { const [metric, day] = k.split('|'); return { metric, day, value:q[k] }; });
        await Cloud().submit(entries);   // rejected rows (e.g. too old) are dropped too, so the queue can't loop
        const sent = sLS.get('sent', {}), q2 = sLS.get('queue', {}), oldest = iso(addDays(new Date(), -8));
        entries.forEach(e => { const k = `${e.metric}|${e.day}`; sent[k] = e.value; if (q2[k] === e.value) delete q2[k]; });
        Object.keys(sent).forEach(k => { if (k.split('|')[1] < oldest) delete sent[k]; });
        sLS.set('sent', sent); sLS.set('queue', q2);
      }
      sLS.set('last', Date.now());
    } catch(e) { if (!e.offline) console.warn('Forged sync:', e.message); if (e.auth) await Cloud().signOut(); }
  })();
  const mine = sBusy; mine.finally(() => { if (sBusy === mine) sBusy = null; socialStatus(); });   // may settle synchronously: clear after assignment
  return mine;
}
function socialStatus(){
  const el = $('#sSync'); if (!el) return;
  const n = Object.keys(sLS.get('queue', {})).length;
  el.textContent = navigator.onLine === false ? `Offline · ${n ? `${n} update${n === 1 ? '' : 's'} waiting to sync` : 'nothing waiting'}` : n ? `${n} update${n === 1 ? '' : 's'} waiting to sync` : `Synced ${sAgo(sLS.get('last', 0))}`;
}
/* 3.16.0: Share my profile. Link = ?add=<invite code>&n=<name>; opening it adds the sharer through the invite flow. */
async function shareProfile(){
  if (!socialOn()) { toast('Friends are not available yet'); return; }
  if (!sUser()) { toast('Sign in once to get your friend link'); go('#/signin'); return; }
  if (unameOn()) { const un = sLS.get('uname', ''); if (!un) { unamePrompt(true); return; }
    const nm = socialProfile().name, who = nm && nm !== 'Fighter' ? nm : '';
    shareLink(`https://forgedfight.com/u/${encodeURIComponent(un)}`, `${who || 'I'} ${who ? 'is' : 'am'} on Forged as @${un}. Add me as a friend:`); return; }
  let inv = sCache().invite || ''; if (!inv) try { inv = await Cloud().myInvite(); } catch(e) { toast('Could not get your link. Try again online.'); return; }
  const name = socialProfile().name || (db.profile.name || '').trim(), url = `${location.origin}${location.pathname}?add=${inv}${name ? '&n=' + encodeURIComponent(name.slice(0, 30)) : ''}`;
  shareLink(url, `${name || 'I'} ${name ? 'is' : 'am'} training on Forged. Add me as a friend:`);
}
(() => { try { const q = new URLSearchParams(location.search), c = String(q.get('add') || '').toUpperCase();
  const raw = String(q.get('add') || ''), nm = String(q.get('n') || '').slice(0, 30);
  if (INVITE_RE.test(c) && raw === c) sLS.set('pendingAdd', { code:c, name:nm });
  else if (window.ForgedUsername && ForgedUsername.check(raw).ok) sLS.set('pendingAdd', { u:raw, name:nm });
  if (q.has('add')) history.replaceState(history.state, '', location.pathname + location.hash); } catch(e) {} })();
const pendingAdd = () => sLS.get('pendingAdd', null);
/* ----- 3.16.0 usernames ----- */
async function addByUsername(u){
  try { const f = await Cloud().addByUsername(u); toast(f.already ? `You and ${f.display_name} are already friends` : `You and ${f.display_name} are now friends`); sLS.del('friendTags'); go('#/friends'); return f; }
  catch(e) { toast(e.message); return null; }
}
function unameField(o = {}){
  const w = h(`<div class="unamebox"><div class="field"><label for="unIn">${o.label || 'Username'}</label><div style="display:flex;gap:8px;align-items:center"><span class="dim" style="font-weight:700">@</span><input class="input" id="unIn" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="24" placeholder="e.g. steve_bjj" value="${esc(o.value || '')}"></div>
    <div class="hint" id="unMsg" style="margin-top:6px">3–20 letters, numbers, _ or . No spaces.</div></div>${o.button ? `<button type="button" class="btn primary block" id="unGo">${o.button}</button>` : ''}</div>`);
  const inp = w.querySelector('#unIn'), msg = w.querySelector('#unMsg'); let seq = 0, okVal = '';
  const show = (t, bad) => { msg.textContent = t; msg.dataset.state = bad ? 'bad' : bad === false ? 'ok' : ''; msg.style.color = bad ? '#EF4B43' : bad === false ? '#3fbf6f' : ''; };
  const run = async () => { okVal = ''; const v = inp.value, c = ForgedUsername.check(v); if (!v) { show('3–20 letters, numbers, _ or . No spaces.'); return; }
    if (!c.ok) { show(c.msg, true); return; } if (!o.remote) { okVal = c.handle; show(`@${c.handle} looks good`, false); return; }
    const my = ++seq; show('Checking…'); let free = null; try { free = await Cloud().usernameAvailable(c.handle); } catch(e) {}
    if (my !== seq) return; if (free === false) { show(`@${c.handle} is taken`, true); return; } okVal = c.handle; show(free ? `@${c.handle} is available` : `@${c.handle} looks good`, false); };
  let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(run, 250); };
  w.value = () => okVal; w.check = run; w.setError = m => show(m, true);
  const b = w.querySelector('#unGo'); if (b) b.onclick = async () => { await run(); if (!okVal) { inp.focus(); return; } o.done && o.done(okVal, w); };
  if (o.value) setTimeout(run, 0);
  return w;
}
async function claimFrom(w, hd, after){ try { const r = await Cloud().claimUsername(hd); sLS.set('uname', r || hd); toast(`You're @${r || hd}`); after && after(); } catch(e) { w.setError(/taken|unique|duplicate/i.test(e.message) ? `@${hd} is taken` : e.message); } }
/* one-time prompt for accounts without a valid handle (no grandfathering: old display names like "CRUSHER CALDWELL" don't count) */
function unamePrompt(force){
  if (!unameOn() || !sUser() || sLS.get('uname', '') || (!force && sLS.get('unamePrompted', 0))) return;
  sLS.set('unamePrompted', 1);
  const nm = socialProfile().name, el = h(`<div id="unameSheet"><h3>Pick your username</h3><div class="hint" style="margin:-4px 0 12px">Usernames are new. Friends find, add and tag you by it. Like X or Instagram: no spaces, nothing offensive, and it has to be unique.</div></div>`);
  el.appendChild(unameField({ remote:true, value:nm && nm !== 'Fighter' ? nm : '', button:'Claim username', done:(hd, w) => claimFrom(w, hd, () => { closeSheet(); if (curRoute === 'friends') route(); }) }));
  openSheet(el);
}
async function viewAdd(u){
  if (!socialOn()) { replacing = true; location.replace('#/'); return; }
  u = decodeURIComponent(String(u || '')); setHeader('Add friend', '', { parent:'#/' });
  const v = $('#view'); if (!ForgedUsername.check(u).ok) { v.innerHTML = '<div class="card"><h2>Link not valid</h2><div class="hint">Ask your friend to send their profile link again.</div></div>'; return; }
  let p = null; if (sUser()) { v.innerHTML = '<div class="card"><div class="hint">Loading…</div></div>'; try { p = await Cloud().findUsername(u); } catch(e) {} if (curRoute !== 'add') return; }
  const name = (p && p.display_name) || sLS.get('addName', '') || u;
  v.innerHTML = `<div class="card" id="addView"><div class="frow">${sAvatar(p || { display_name:name, avatar_initial:name[0].toUpperCase(), avatar_color:'flame' }, 'lg')}<div class="grow"><b>${esc(name)}</b><small>@${esc(p ? p.username : u)}</small></div></div>
    <h2 style="margin-top:12px">Add ${esc(name)} as a friend?</h2>
    ${sUser() && !p ? '<div class="hint">We couldn\'t find that username.</div>' : ''}
    <button type="button" class="btn primary block" id="addGo" style="margin-top:12px" ${sUser() && !p ? 'disabled' : ''}>${sUser() ? `Add ${esc(name)}` : `Sign in to add ${esc(name)}`}</button>
    <div class="hint">Shows only username and display name. Never your email, notes, weight or food.</div></div>`;
  $('#addGo').onclick = () => { if (sUser()) addByUsername(u); else { sLS.set('addUser', u); go('#/signin'); } };
}
function renderUnameCard(){
  const box = $('#unameCard'); if (!box) return; const un = sLS.get('uname', '');
  if (!un) { box.innerHTML = '<h2>Pick your username</h2><div class="hint" style="margin:-4px 0 10px">Friends find, add and tag you by it. No spaces, and it has to be unique.</div>';
    const b = h('<button type="button" class="btn primary block" id="pickUname">Pick username</button>'); b.onclick = () => unamePrompt(true); box.appendChild(b);
    return; }
  box.innerHTML = `<h2>Add friends</h2><button type="button" class="btn primary block" id="shareUname">Invite friends</button><div class="hint" style="margin:6px 0 12px">Sends your link (forgedfight.com/u/${esc(un)}). Friends tap it to add you. No code needed.</div>
    <div class="addrow"><input class="input" id="findUname" style="text-transform:none;letter-spacing:normal" placeholder="Find by username" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="24"><button type="button" class="btn" id="findGo">Find</button></div><div id="findRes"></div>`;
  $('#shareUname').onclick = shareProfile;
  $('#findGo').onclick = async () => { const raw = $('#findUname').value.trim().replace(/^@/, ''), c = ForgedUsername.check(raw), out = $('#findRes');
    if (!c.ok && c.code !== 'reserved') { out.innerHTML = `<div class="hint" style="color:#EF4B43">${esc(c.msg)}</div>`; return; }
    out.innerHTML = '<div class="hint">Searching…</div>'; let p = null; try { p = await Cloud().findUsername(raw); } catch(e) {}
    if (!p) { out.innerHTML = `<div class="hint">No one has the username @${esc(raw)}</div>`; return; }
    out.innerHTML = `<div class="list-row" id="findRow" style="margin-top:10px">${sAvatar(p)}<div class="grow"><b>${esc(p.display_name)}</b><small>@${esc(p.username)}</small></div>${p.username.toLowerCase() === un.toLowerCase() ? '<span class="dim">You</span>' : '<button type="button" class="btn sm primary" id="findAdd">Add</button>'}</div>`;
    const a = $('#findAdd'); if (a) a.onclick = () => addByUsername(p.username); };
}
/* ----- 3.16.0 tags: @friends on clips/photos. Friends who turned tags off never show up here, and the server refuses them. ----- */
async function taggableFriends(){ const c = sLS.get('friendTags', null); if (c && Date.now() - c.at < 6e5) return c.list;
  let list = []; try { list = await Cloud().taggableFriends(); } catch(e) {} sLS.set('friendTags', { at:Date.now(), list }); return list; }
function tagPicker(){
  const w = h(`<div class="tagpick" style="margin-top:12px"><label class="dim" style="font-size:12px;font-weight:700;letter-spacing:.06em">TAG FRIENDS</label><div class="tagchips" id="tagChips" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0"></div>
    <input class="input" id="tagIn" placeholder="@ a friend" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"><div id="tagSug"></div></div>`);
  const chosen = [], chips = w.querySelector('#tagChips'), inp = w.querySelector('#tagIn'), sug = w.querySelector('#tagSug'); let all = [];
  taggableFriends().then(l => { all = l; draw(); });
  const drawChips = () => { chips.innerHTML = chosen.map(u => `<span class="pill tagchip" data-u="${esc(u)}" style="cursor:pointer;text-transform:none">@${esc(u)} ✕</span>`).join(''); chips.querySelectorAll('[data-u]').forEach(c => c.onclick = () => { chosen.splice(chosen.indexOf(c.dataset.u), 1); drawChips(); draw(); }); };
  const draw = () => { const q = inp.value.replace(/^@/, '').toLowerCase(); if (document.activeElement !== inp && !q) { sug.innerHTML = ''; return; }
    const m = all.filter(f => !chosen.includes(f.username) && (f.username.toLowerCase().includes(q) || (f.display_name || '').toLowerCase().includes(q))).slice(0, 5);
    sug.innerHTML = m.length ? m.map(f => `<div class="list-row" data-tag="${esc(f.username)}" style="cursor:pointer">${sAvatar(f)}<div class="grow"><b>@${esc(f.username)}</b><small>${esc(f.display_name || '')}</small></div></div>`).join('') : `<div class="hint">${all.length ? 'No friends match' : 'No friends to tag yet'}</div>`;
    sug.querySelectorAll('[data-tag]').forEach(r => r.onclick = () => { if (chosen.length < 10) chosen.push(r.dataset.tag); inp.value = ''; drawChips(); draw(); inp.focus(); }); };
  inp.oninput = draw; inp.onfocus = draw;
  w.tags = () => chosen.slice();
  return w;
}
const tagLine = p => (p.tags || []).length ? `<div class="mtags" style="margin-top:6px">${p.tags.map(u => `<span class="pill" style="text-transform:none">@${esc(u)}</span>`).join(' ')}</div>` : '';
function socialAttach(u){
  ForgedSync.enabled = !!u;
  ForgedSync.adapter = u ? { push:() => socialSchedule() } : null;
  if (!u) return;
  socialSchedule(400);
  const inv = sLS.get('invite', ''); if (inv) { sLS.del('invite'); socialAccept(inv); }
  if (unameOn()) { (async () => {
    const want = sLS.get('wantUname', ''); if (want) { sLS.del('wantUname'); try { sLS.set('uname', await Cloud().claimUsername(want)); } catch(e) { toast(`@${want}: ${e.message}`); } }
    if (!sLS.get('uname', '')) { try { const m = await Cloud().myUsername(); if (m && ForgedUsername.check(m).ok) sLS.set('uname', m); } catch(e) {} }
    const au = sLS.get('addUser', ''); if (au) { sLS.del('addUser'); addByUsername(au); }
    if (!sLS.get('uname', '')) whenSettled(unamePrompt);
  })(); }
}
function socialClearLocal(){ ['queue','sent','cache','prof','last','invite','openH2h','uname','addUser','unamePrompted','friendTags'].forEach(k => sLS.del(k)); }
async function socialRefresh(){
  await socialSync();
  const [invite, board, chs] = await Promise.all([sLS.get('cache', {}).invite || Cloud().myInvite(), Cloud().leaderboard(), Cloud().challenges()]);
  const boards = {};
  await Promise.all(chs.filter(c => c.ends_on >= iso(addDays(new Date(), -30))).slice(0, 12).map(c => Cloud().board(c.id).then(b => { boards[c.id] = b; }).catch(() => {})));
  const cache = { invite, board, challenges:chs, boards, at:Date.now(), uid:sUser() && sUser().id };
  sLS.set('cache', cache); try { h2hResults(chs, boards); } catch(e) {} return cache;
}
/* Head-to-head results: final one day after the end (late syncs count), then XP + badge once. */
const h2hFinal = ch => !!ch && ch.ends_on < iso(addDays(new Date(), -1));
function h2hOutcome(ch, board){
  const joined = (board || []).filter(b => b.status === 'joined'), me = joined.find(b => b.is_me);
  if (!h2hFinal(ch) || !me || joined.length < 2 || ch.my_status !== 'joined') return null;
  const top = Math.max(...joined.map(b => b.score || 0)); if (top <= 0) return null;
  const leaders = joined.filter(b => (b.score || 0) === top);
  return { r: me.score === top ? (leaders.length > 1 ? 'tied' : 'won') : 'lost', winners:leaders.map(b => b.display_name) };
}
function h2hResults(chs, boards){
  const g = game(); g.h2h = g.h2h || {}; const fresh = [];
  (chs || []).forEach(ch => { if (g.h2h[ch.id]) return; const o = h2hOutcome(ch, (boards || {})[ch.id]); if (!o) return;
    const them = ((boards || {})[ch.id] || []).filter(b => !b.is_me && b.status === 'joined').map(b => b.display_name);
    g.h2h[ch.id] = { end:ch.ends_on, metric:ch.metric, r:o.r, vs:them.slice(0, 3).join(', ').slice(0, 60) }; fresh.push(g.h2h[ch.id]); });
  if (!fresh.length) return [];
  saveDb(); const best = fresh.find(x => x.r === 'won') || fresh.find(x => x.r === 'tied') || fresh[0];
  if (!window.__FORGED_QUIET_H2H) toast(best.r === 'won' ? `You won vs ${best.vs}!` : best.r === 'tied' ? `Tied with ${best.vs}.` : `${best.vs} won this one. Run it back?`);
  return fresh;
}
const sCache = () => { const c = sLS.get('cache', {}); return c.uid && sUser() && c.uid === sUser().id ? c : {}; };
function socialPoll(fn){ clearInterval(sPoll); sPoll = setInterval(() => { if (!document.hidden && $('#sheet').hidden && S_ROUTES.includes(curRoute)) fn(); }, 20000); }
function socialBoot(){
  if (!socialOn()) return;
  Cloud().onAuth(u => { socialAttach(u); if (S_ROUTES.includes(curRoute)) route(); });
  const fromLink = /[?&]code=/.test(location.search);
  if (Cloud().hasStoredSession() || fromLink) Cloud().init().then(u => {
    if (fromLink) { history.replaceState(history.state, '', location.pathname + location.hash); if (!u) toast('That sign-in link opened outside the app. Enter the code from the email instead.'); }
    socialAttach(u);
  }).catch(() => {});
  window.addEventListener('online', () => socialSync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) socialSchedule(500); });
}
async function socialAccept(code){
  try { const f = await Cloud().acceptInvite(code); toast(f.already ? `You and ${f.display_name} are already friends` : `You and ${f.display_name} are now friends`); sLS.set('openH2h', f.friend_id); go('#/friends'); return f; }
  catch(e) { toast(e.message); return null; }
}
const privacyCard = () => `<div class="card privacy" id="privacyCard"><h2>What friends see</h2>
  <ul><li>Your name, initial and belt</li><li>Daily counts: sessions, push-ups, mat time, daily challenges done</li></ul>
  <p><b>Never shared:</b> notes, body weight, food, injuries or workout details. Your full log stays on this phone.</p></div>`;

/* ----- Friends screen ----- */
async function viewFriends(){
  mediaLoaded = false;
  if (!socialOn()) { replacing = true; location.replace('#/'); return; }
  setHeader('Friends');
  const v = $('#view');
  if (!Cloud().loaded && Cloud().hasStoredSession()) { v.innerHTML = '<div class="card"><div class="hint">Loading…</div></div>'; try { await Cloud().init(); } catch(e) {} if (curRoute !== 'friends') return; }
  const u = sUser();
  if (!u) {
    v.innerHTML = `<div class="card" id="friendsIntro"><h2>Train with friends</h2><p class="dim" style="margin:-4px 0 14px">Share clips and photos, add friends, see who trained most this week, and go head-to-head on sessions, push-ups, mat hours or daily challenge streaks.</p>
      <a class="btn primary block" href="#/signin" id="goSignin">Sign in with email</a>${CFG.apple ? '<button type="button" class="btn block" id="appleSignin" style="margin-top:10px"> Sign in with Apple</button>' : ''}
      <div class="hint" style="margin-top:10px">Accounts are optional. Everything else in Forged works offline without one.</div></div>${privacyCard()}`;
    const ap = $('#appleSignin'); if (ap) ap.onclick = () => Cloud().signInWithApple().catch(e => toast(e.message));
    return;
  }
  const render = c => {
    if (curRoute !== 'friends') return;
    const me = (c.board || []).find(x => x.is_me), friends = (c.board || []).filter(x => !x.is_me), prof = socialProfile();
    const meRow = me || { display_name:prof.name, avatar_initial:prof.name[0].toUpperCase(), avatar_color:prof.color };
    const chs = c.challenges || [], link = c.invite ? `${location.origin}${location.pathname}#/invite/${c.invite}` : '';
    v.innerHTML = `${navigator.onLine === false ? `<div class="card offline" id="offlineNote">You're offline. Showing what was last synced${c.at ? ` (${sAgo(c.at)})` : ''}. Your progress syncs when you're back online.</div>` : ''}
      <div class="card" id="youCard"><div class="frow me">${sAvatar(meRow, 'lg')}<div class="grow"><b>${esc(meRow.display_name)}</b><small>${esc(u.email)}</small></div><button type="button" class="btn sm" id="editMe">Edit</button></div></div>
      ${mediaOn() ? `<div class="card" id="mediaCard"><h2>Clips &amp; photos <small>30 days</small></h2><button type="button" class="btn primary block" id="shareMedia">📷 Share clip or photo</button><div id="mediaFeed" style="margin-top:12px">${mediaFeedHtml(mediaCache)}</div></div>` : ''}
      ${unameOn() ? `<div class="card" id="unameCard"></div>` : ''}
      <div class="card" id="inviteCard" ${unameOn() ? 'hidden' : ''}><h2>Add friends</h2>
        <div class="invrow"><div><small class="dim">Your invite code</small><div class="invcode" id="myCode">${esc(c.invite || '········')}</div></div><button type="button" class="btn primary" id="shareInvite" ${link ? '' : 'disabled'}>Share link</button></div>
        <div class="addrow"><input class="input" id="addCode" placeholder="Friend's code" autocapitalize="characters" autocomplete="off" maxlength="8"><button type="button" class="btn" id="addFriend">Add</button></div></div>
      <div class="card" id="h2hCard"><h2>Head-to-head</h2>${chs.length ? chs.map(ch => h2hRow(ch, (c.boards || {})[ch.id] || [])).join('') : `<div class="hint" style="margin:-4px 0 10px">${friends.length ? 'Pick a friend and a metric. Progress comes from what you both log.' : 'Add a friend first, then challenge them.'}</div>`}
        <button type="button" class="btn block" id="newH2h" ${friends.length ? '' : 'disabled'}>Challenge a friend</button></div>
      <div class="card" id="boardCard"><h2>This week <small>Mon–Sun</small></h2>${(c.board || [meRow]).map(friendBoardRow).join('')}
        ${friends.length ? '' : '<div class="hint">No friends yet. Share your code or link.</div>'}<div class="hint">Ranked by sessions logged this week.</div></div>
      ${privacyCard()}
      <div class="card" id="acctCard"><h2>Account</h2><div class="hint" id="sSync" style="margin:-4px 0 10px"></div>
        <div class="btnrow"><button type="button" class="btn" id="syncNow">Sync now</button><button type="button" class="btn" id="signOut">Sign out</button></div>
        <button type="button" class="btn block danger ghost" id="delAcct" style="margin-top:10px">Delete account</button>
        <div class="hint">Deleting your account removes your profile, friends and challenge progress from the server. Your workouts on this phone stay.</div></div>`;
    socialStatus();
    $('#editMe').onclick = profileSheet;
    if (unameOn()) { renderUnameCard(); if (!sLS.get('uname', '')) whenSettled(unamePrompt); }
    $('#shareInvite').onclick = () => shareLink(link, `Add me on Forged (code ${c.invite})`);
    $('#addFriend').onclick = () => { const code = $('#addCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!INVITE_RE.test(code)) { toast('Codes are 8 letters and numbers'); return; } socialAccept(code).then(f => { if (f) refresh(); }); };
    $('#newH2h').onclick = () => h2hSheet(c);
    if (mediaOn()) { $('#shareMedia').onclick = mediaPick; wireMediaFeed(); if (!mediaLoaded) { mediaLoaded = true; mediaRefresh(); } }
    $('#syncNow').onclick = async () => { await socialSync(true); refresh(); };
    $('#signOut').onclick = async () => { await Cloud().signOut(); socialClearLocal(); toast('Signed out'); route(); };
    $('#delAcct').onclick = async () => { if (!(await confirmSheet('Delete your account?', 'This removes your profile, friends and challenge results from the server for good. Your workouts on this phone are not touched.', 'Delete account'))) return;
      try { await Cloud().deleteAccount(); socialClearLocal(); toast('Account deleted'); route(); } catch(e) { toast(e.message); } };
    v.querySelectorAll('[data-h2h]').forEach(r => r.onclick = e => { if (e.target.closest('button')) return; go('#/h2h/' + r.dataset.h2h); });
    v.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => Cloud().respond(b.dataset.acc, b.dataset.yes === '1').then(() => { toast(b.dataset.yes === '1' ? 'Challenge accepted' : 'Challenge declined'); refresh(); }).catch(e => toast(e.message)));
    v.querySelectorAll('[data-fmenu]').forEach(b => b.onclick = () => friendMenu((c.board || []).find(x => x.user_id === b.dataset.fmenu), c));
    const open = sLS.get('openH2h', ''); if (open && friends.some(f => f.user_id === open)) { sLS.del('openH2h'); whenSettled(() => h2hSheet(c, open)); }
  };
  const refresh = () => socialRefresh().then(render).catch(e => { if (curRoute === 'friends') { if (!e.offline) toast(e.message); render(sCache()); } });
  render(sCache());
  refresh();
  socialPoll(refresh);
}
/* ---------- 3.12.0: share a clip or photo with friends (private bucket, friends-only, 30 days) ---------- */
const mediaOn = () => { try { return socialOn() && !!(CFG.media || localStorage.getItem('forged.media.preview') === '1'); } catch(e) { return false; } };
const MEDIA_MAX_MB = 25, MEDIA_MAX_S = 60, MEDIA_PX = 1600;
let mediaCache = null, mediaLoaded = false;
function mediaFeedHtml(list){
  if (!list) return '<div class="hint" id="mediaLoading">Loading…</div>';
  if (!list.length) return '<div class="hint" id="mediaEmpty">Nothing yet. Film a roll or snap a photo and share it with your friends.</div>';
  return list.map(p => `<div class="mpost" data-mid="${esc(p.id)}"><div class="frow">${sAvatar(p)}<div class="grow"><b>${esc(p.display_name)}${p.is_me ? ' <span class="pill">You</span>' : ''}</b><small>${sAgo(Date.parse(p.created_at))}</small></div>${p.is_me ? `<button type="button" class="btn sm ghost" data-mdel="${esc(p.id)}" aria-label="Delete post">Delete</button>` : ''}</div>
    <div class="mmedia">${!p.url ? '<div class="hint">Loading…</div>' : p.kind === 'video' ? `<video src="${esc(p.url)}" controls playsinline preload="metadata"></video>` : `<img src="${esc(p.url)}" alt="${esc(p.caption || 'Photo')}" loading="lazy">`}</div>
    ${p.caption ? `<div class="mcap">${esc(p.caption)}</div>` : ''}${tagLine(p)}</div>`).join('');
}
function wireMediaFeed(){
  document.querySelectorAll('[data-mdel]').forEach(b => b.onclick = async () => { const p = (mediaCache || []).find(x => x.id === b.dataset.mdel); if (!p) return;
    if (!(await confirmSheet('Delete this post?', 'It is removed for you and your friends.', 'Delete'))) return;
    try { await Cloud().mediaDelete(p); mediaCache = mediaCache.filter(x => x.id !== p.id); toast('Post deleted'); mediaPaint(); } catch(e) { toast(e.message); } });
}
function mediaPaint(){ const f = $('#mediaFeed'); if (f) { f.innerHTML = mediaFeedHtml(mediaCache); wireMediaFeed(); } }
async function mediaRefresh(){
  try { const list = await Cloud().mediaList(30); const urls = await Cloud().mediaUrls(list.map(p => p.path)).catch(() => ({}));
    mediaCache = list.map(p => ({ ...p, url:urls[p.path] || '' })); mediaPaint();
    Cloud().mediaCleanup().catch(() => {}); }
  catch(e) { if (!mediaCache) mediaCache = []; mediaPaint(); const f = $('#mediaFeed'); if (f && !e.offline) f.insertAdjacentHTML('afterbegin', `<div class="hint" id="mediaErr">Couldn't load posts. ${esc(e.message)}</div>`); }
}
function mediaPick(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,video/*'; inp.id = 'mediaInput'; inp.style.display = 'none';
  inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) mediaPrepare(f).then(r => r && mediaSheet(r)).catch(e => toast(e.message || 'Could not open that file')); };
  document.body.appendChild(inp); inp.click();
}
const videoSecs = f => new Promise(res => { const v = document.createElement('video'), u = URL.createObjectURL(f); let done = false; const fin = x => { if (done) return; done = true; URL.revokeObjectURL(u); res(x); };
  v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => fin(isFinite(v.duration) ? v.duration : 0); v.onerror = () => fin(0); setTimeout(() => fin(0), 5000); v.src = u; });
async function shrinkImage(f){
  const url = URL.createObjectURL(f);
  try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that photo')); i.src = url; });
    const k = Math.min(1, MEDIA_PX / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), hh = Math.round(img.naturalHeight * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; cv.getContext('2d').drawImage(img, 0, 0, w, hh);
    const b = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.82)); if (!b) throw new Error('Could not read that photo');
    return { blob:b, w, h:hh }; } finally { URL.revokeObjectURL(url); }
}
async function mediaPrepare(f){
  const isVid = /^video\//.test(f.type) || /\.(mov|mp4|m4v|webm)$/i.test(f.name || '');
  if (isVid) {
    if (f.size > MEDIA_MAX_MB * 1048576) { toast(`That clip is ${Math.round(f.size / 1048576)} MB. Keep it under ${MEDIA_MAX_MB} MB (about ${MEDIA_MAX_S} seconds). Trim it in Photos first.`); return null; }
    const d = await videoSecs(f); if (d > MEDIA_MAX_S + 1) { toast(`Clips can be up to ${MEDIA_MAX_S} seconds. This one is ${Math.round(d)} s. Trim it in Photos first.`); return null; }
    return { kind:'video', blob:f, secs:d };
  }
  if (!/^image\//.test(f.type) && !/\.(jpe?g|png|heic|webp)$/i.test(f.name || '')) { toast('Pick a photo or a video'); return null; }
  return { kind:'photo', ...(await shrinkImage(f)) };
}
function mediaSheet(m){
  const url = URL.createObjectURL(m.blob);
  const el = h(`<div id="mediaSheet"><h3>Share with friends</h3>
    <div class="mmedia">${m.kind === 'video' ? `<video src="${url}" controls playsinline muted></video>` : `<img src="${url}" alt="Preview">`}</div>
    <input class="input" id="mediaCap" maxlength="200" placeholder="Add a caption (optional)" style="margin-top:12px">
    <div id="tagSlot"></div>
    <div class="hint" style="margin-top:6px">Only your friends can see it. Gone after 30 days.</div>
    <button type="button" class="btn primary block" id="mediaPost" style="margin-top:12px">Post</button></div>`);
  const tp = unameOn() ? tagPicker() : null; if (tp) el.querySelector('#tagSlot').appendChild(tp);
  el.querySelector('#mediaPost').onclick = async () => { const b = el.querySelector('#mediaPost'); b.disabled = true; b.textContent = 'Posting…';
    try { const row = await Cloud().mediaPost(m.blob, { kind:m.kind, caption:el.querySelector('#mediaCap').value.trim().slice(0, 200) });
      if (tp && tp.tags().length && row && row.id) { try { await Cloud().tagMedia(row.id, tp.tags()); } catch(e) { toast(e.message); } } closeSheet(); toast('Shared with friends'); mediaRefresh(); }
    catch(e) { b.disabled = false; b.textContent = 'Post'; toast(/bucket|relation|media_posts|list_media|not found/i.test(e.message) ? 'Sharing isn\'t switched on yet.' : e.message); } };
  openSheet(el, () => URL.revokeObjectURL(url));
}
function friendBoardRow(x){
  return `<div class="frow${x.is_me ? ' me' : ''}" data-uid="${esc(x.user_id || '')}"><span class="place">${x.place || ''}</span>${sAvatar(x)}<div class="grow"><b>${esc(x.display_name)}${x.is_me ? ' <span class="pill">You</span>' : ''}</b></div>
    <div class="fstat"><b>${x.week_sessions || 0}</b><small>${(x.week_sessions || 0) === 1 ? 'session' : 'sessions'}</small></div>${x.is_me ? '' : `<button type="button" class="btn sm ghost fmenu" data-fmenu="${esc(x.user_id)}" aria-label="More for ${esc(x.display_name)}">⋯</button>`}</div>`;
}
function h2hRow(ch, board){
  const m = S_METRIC[ch.metric] || S_METRIC.sessions, me = board.find(b => b.is_me), them = board.filter(b => !b.is_me), lead = board[0];
  const vs = them.length === 1 ? `vs ${esc(them[0].display_name)}` : `${board.length} people`, ended = ch.ends_on < today();
  const status = ch.my_status === 'invited' ? `<div class="btnrow" style="margin-top:8px"><button type="button" class="btn sm primary" data-acc="${esc(ch.id)}" data-yes="1">Accept</button><button type="button" class="btn sm" data-acc="${esc(ch.id)}" data-yes="0">Decline</button></div>` : '';
  const line = me ? `You ${sScore(ch.metric, me.score)}${them.length === 1 ? ` · ${esc(them[0].display_name)} ${sScore(ch.metric, them[0].score)}` : lead ? ` · leader ${esc(lead.display_name)} ${sScore(ch.metric, lead.score)}` : ''}` : '';
  return `<div class="list-row h2hrow" data-h2h="${esc(ch.id)}"><div class="grow"><b>${esc(ch.title || m.label)} <span class="dim">${vs}</span></b><small>${line}${line ? ' · ' : ''}${ended ? 'Ended' : ch.starts_on > today() ? `Starts ${fmtShort(ch.starts_on)}` : timeLeft(ch.ends_on)}${ch.my_status === 'invited' ? ' · invited' : ''}</small>${status}</div>›</div>`;
}
async function shareLink(url, text){
  if (!url) return;
  try { if (navigator.share) { await navigator.share({ title:'Forged', text, url }); }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied'); }
    else prompt('Copy this link', url); } catch(e) { if (e && e.name !== 'AbortError') toast('Could not share'); }
  window.__lastInviteUrl = url;
}
function profileSheet(){
  let color = AV_COLORS[db.profile.avatarColor] ? db.profile.avatarColor : 'flame';
  const el = h(`<div><h3>Your public profile</h3><div class="hint" style="margin:-6px 0 12px">Friends see this name, an initial and your rank.</div></div>`);
  const nm = h(`<input class="input" id="sName" maxlength="30" value="${esc(db.profile.name || '')}" placeholder="Name friends know you by">`); el.appendChild(field('Name', nm));
  const sw = h(`<div class="avpick" id="avPick">${Object.entries(AV_COLORS).map(([k, c]) => `<button type="button" data-av="${k}" class="${k === color ? 'on' : ''}" style="--av:${c}" aria-label="${k}"></button>`).join('')}</div>`);
  sw.querySelectorAll('button').forEach(b => b.onclick = () => { color = b.dataset.av; sw.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  el.appendChild(field('Colour', sw));
  const btn = h('<button type="button" class="btn primary block" id="sSave" style="margin-top:12px">Save</button>'); el.appendChild(btn);
  btn.onclick = async () => { db.profile.name = nm.value.trim().slice(0, 30); db.profile.avatarColor = color; save(); closeSheet(); await socialSync(true); toast('Profile saved'); route(); };
  openSheet(el, null, { closeLabel:'Cancel' });
}
function friendMenu(f, c){
  if (!f) return;
  const el = h(`<div><h3>${esc(f.display_name)}</h3><p class="dim" style="margin:-6px 0 16px">${f.week_sessions || 0} sessions this week</p>
    <div style="display:flex;flex-direction:column;gap:10px"><button type="button" class="btn primary block" id="fmH2h">Challenge ${esc(f.display_name)}</button><button type="button" class="btn block danger ghost" id="fmRemove">Remove friend</button></div></div>`);
  el.querySelector('#fmH2h').onclick = () => { closeSheet(); whenSettled(() => h2hSheet(c, f.user_id)); };
  el.querySelector('#fmRemove').onclick = async () => { closeSheet(); try { await Cloud().removeFriend(f.user_id); toast(`Removed ${f.display_name}`); route(); } catch(e) { toast(e.message); } };
  openSheet(el, null, { closeLabel:'Close' });
}
function h2hSheet(c, pre, metric0){
  const friends = (c.board || []).filter(x => !x.is_me); if (!friends.length) return;
  const pick = new Set([pre && friends.some(f => f.user_id === pre) ? pre : friends[0].user_id]); let metric = S_METRIC[metric0] && metric0 !== 'xp' ? metric0 : 'sessions', days = 7;
  const el = h(`<div><h3>Challenge a friend</h3><div class="hint" style="margin:-6px 0 12px">Starts today. Progress syncs from what each of you logs; you'll see live standings.</div></div>`);
  const fl = h(`<div class="focuschips" id="h2hFriends">${friends.map(f => `<button type="button" data-f="${esc(f.user_id)}" class="${pick.has(f.user_id) ? 'on' : ''}">${esc(f.display_name)}</button>`).join('')}</div>`);
  fl.querySelectorAll('button').forEach(b => b.onclick = () => { if (pick.has(b.dataset.f)) { if (pick.size > 1) pick.delete(b.dataset.f); } else pick.add(b.dataset.f); fl.querySelectorAll('button').forEach(x => x.classList.toggle('on', pick.has(x.dataset.f))); });
  el.appendChild(field('Who (pick 2 or more for a group)', fl));
  el.appendChild(field('Metric', seg(Object.entries(S_METRIC).filter(([k]) => k !== 'xp').map(([k, m]) => [k, m.label]), metric, x => metric = x, true)));
  el.appendChild(field('How long', seg([[7,'1 week'],[14,'2 weeks'],[30,'30 days']], days, x => days = x)));
  const btn = h('<button type="button" class="btn primary block" id="h2hGo" style="margin-top:12px">Start challenge</button>'); el.appendChild(btn);
  btn.onclick = async () => {
    btn.disabled = true;
    try { const id = await Cloud().createChallenge({ kind:pick.size > 1 ? 'group' : 'h2h', metric, start:today(), end:iso(addDays(new Date(), days - 1)), friends:[...pick] });
      closeSheet(); toast('Challenge sent'); whenSettled(() => go('#/h2h/' + id)); }
    catch(e) { btn.disabled = false; toast(metric === 'xp' && /invalid metric/i.test(e.message) ? 'XP challenges aren\'t switched on yet. Pick another metric.' : e.message); }
  };
  openSheet(el, null, { closeLabel:'Cancel' });
}

/* ----- head-to-head detail: live standings ----- */
async function viewH2h(id){
  if (!socialOn()) { replacing = true; location.replace('#/'); return; }
  setHeader('Head-to-head', '', { parent:'#/friends' });
  const v = $('#view');
  if (!Cloud().loaded && Cloud().hasStoredSession()) { try { await Cloud().init(); } catch(e) {} if (curRoute !== 'h2h') return; }
  if (!sUser()) { go('#/friends'); return; }
  const render = (ch, board) => {
    if (curRoute !== 'h2h') return;
    if (!ch) { v.innerHTML = '<div class="card"><div class="hint">Loading…</div></div>'; return; }
    const m = S_METRIC[ch.metric] || S_METRIC.sessions, max = Math.max(1, ...board.map(b => b.score || 0)), ended = ch.ends_on < today();
    v.innerHTML = `${navigator.onLine === false ? '<div class="card offline" id="offlineNote">You\'re offline. Standings are from the last sync.</div>' : ''}
      <div class="card" id="h2hHead"><div class="eyebrow">${ch.kind === 'group' ? `Group challenge · ${board.length} people` : `You vs ${esc((board.find(x => !x.is_me) || {}).display_name || 'friend')}`}</div><h2 class="h2ht">${esc(ch.title || m.label)}</h2>
        <div class="dim">${fmtShort(ch.starts_on)} – ${fmtShort(ch.ends_on)} · ${ended ? 'Ended' : timeLeft(ch.ends_on)}</div></div>
      ${(() => { const o = h2hOutcome(ch, board), r = (game().h2h || {})[ch.id]; if (!o && !(h2hFinal(ch) && board[0])) return ''; const res = r ? r.r : o ? o.r : '';
        const txt = res === 'won' ? `You won!` : res === 'tied' ? 'Tied for first.' : o ? `${esc(o.winners.join(' & '))} won` : 'No winner this time';
        return `<div class="card h2hres ${res || 'done'}" id="h2hResult"><div class="eyebrow">Final</div><h2>${res === 'won' ? '🥊 ' : ''}${txt}</h2>${res === 'won' ? '<div class="hint">Badge earned: Head-to-head winner</div>' : ''}<button type="button" class="btn block" id="h2hRematch" style="margin-top:10px">Rematch</button></div>`; })()}
      <div class="card" id="h2hBoard"><h2>Standings <small>${esc(m.unit)}</small></h2>${board.map(b => `<div class="brow${b.is_me ? ' me' : ''}"><span class="place">${b.place}</span>${sAvatar(b)}<div class="grow"><b>${esc(b.display_name)}${b.is_me ? ' <span class="pill">You</span>' : ''}${b.status === 'invited' ? ' <span class="dim">(invited)</span>' : ''}</b><span class="sgbar"><i style="width:${Math.round((b.score || 0) / max * 100)}%"></i></span></div><b class="bscore" data-score>${sScore(ch.metric, b.score)}</b></div>`).join('')}
        <div class="hint">Synced from your log automatically. ${ended ? (h2hFinal(ch) ? '' : 'Final results tomorrow, once late logs sync.') : 'Updates every 20 seconds while this screen is open.'}</div>
        <div class="hint" id="sSync"></div></div>
      ${ch.my_status === 'invited' ? `<div class="btnrow"><button type="button" class="btn primary" id="h2hAccept">Accept</button><button type="button" class="btn" id="h2hDecline">Decline</button></div>` : `<button type="button" class="btn block ghost" id="h2hLeave">Leave challenge</button>`}`;
    socialStatus();
    const ac = $('#h2hAccept'), dc = $('#h2hDecline'), lv = $('#h2hLeave'), rm = $('#h2hRematch');
    if (rm) rm.onclick = () => { const opp = board.filter(b => !b.is_me && b.status === 'joined').map(b => b.user_id); h2hSheet({ board:board.filter(b => !b.is_me).map(b => ({ ...b })) }, opp[0], ch.metric); };
    if (lv && h2hFinal(ch)) lv.remove();
    if (ac) ac.onclick = () => Cloud().respond(id, true).then(() => { toast('Challenge accepted'); refresh(); }).catch(e => toast(e.message));
    if (dc) dc.onclick = () => Cloud().respond(id, false).then(() => { toast('Challenge declined'); go('#/friends'); }).catch(e => toast(e.message));
    if (lv) lv.onclick = async () => { if (!(await confirmSheet('Leave this challenge?', 'Your progress stops counting here. You can still see your own log.', 'Leave'))) return; Cloud().leave(id).then(() => { toast('Left the challenge'); go('#/friends'); }).catch(e => toast(e.message)); };
  };
  const fromCache = () => { const c = sCache(); return [(c.challenges || []).find(x => x.id === id), (c.boards || {})[id] || []]; };
  const refresh = async () => { try { await socialSync(); const [chs, board] = await Promise.all([Cloud().challenges(), Cloud().board(id)]);
      const c = sCache(); if (c.uid) { c.challenges = chs; c.boards = { ...(c.boards || {}), [id]:board }; sLS.set('cache', c); }
      const ch = chs.find(x => x.id === id); if (!ch) { toast('That challenge is no longer available'); go('#/friends'); return; } h2hResults([ch], { [id]:board }); render(ch, board); }
    catch(e) { if (curRoute === 'h2h') { if (!e.offline) toast(e.message); const [ch, b] = fromCache(); render(ch, b); } } };
  render(...fromCache()); refresh(); socialPoll(refresh);
}

/* ----- sign in: email one-time code (magic link works too when opened on this phone) ----- */
function viewSignin(){
  if (!socialOn()) { replacing = true; location.replace('#/'); return; }
  setHeader('Sign in', '', { parent:'#/friends' });
  if (sUser()) { go('#/friends'); return; }
  const inv = sLS.get('invite', '');
  $('#view').innerHTML = `<div class="card" id="signinCard"><h2>Sign in or create an account</h2><p class="dim" style="margin:-4px 0 14px">We'll email you a 6-digit code. No password.${inv ? ' Then we add your friend.' : ''}</p>
    <div class="field"><label for="siEmail">Email</label><input class="input" id="siEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="you@example.com" value="${esc(sLS.get('email', ''))}"></div>
    <button type="button" class="btn primary block" id="siSend">Email me a code</button>
    <div id="siCodeWrap" hidden><div class="field" style="margin-top:14px"><label for="siCode">Code from the email</label><input class="input otp" id="siCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"></div>
      <button type="button" class="btn primary block" id="siVerify">Sign in</button><button type="button" class="btn block ghost" id="siResend" style="margin-top:8px">Send a new code</button>
      <div class="hint">On this phone you can also tap the link in the email.</div></div>
    ${CFG.apple ? '<button type="button" class="btn block" id="appleSignin" style="margin-top:12px"> Sign in with Apple</button>' : ''}
    <div class="hint" style="margin-top:12px">Accounts are optional and only used for friends and head-to-head. Everything else works offline without one.</div></div>${privacyCard()}`;
  const em = $('#siEmail'), wrap = $('#siCodeWrap'), code = $('#siCode');
  let sentAt = 0;
  const send = async () => {
    const e = em.value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { toast('Enter your email address'); em.focus(); return; }
    if (Date.now() - sentAt < 60000) { toast('Wait a minute before asking for another code'); return; }
    const b = $('#siSend'); b.disabled = true;
    try { await Cloud().sendCode(e); sentAt = Date.now(); sLS.set('email', e); wrap.hidden = false; b.textContent = 'Code sent'; b.classList.remove('primary'); toast(`Code sent to ${e}`); code.focus(); }
    catch(err) { b.disabled = false; toast(err.message); }
  };
  $('#siSend').onclick = send; $('#siResend').onclick = () => { $('#siSend').disabled = false; send(); };
  em.onkeydown = e => { if (e.key === 'Enter') send(); };
  const verify = async () => {
    const t = code.value.replace(/\D/g, ''); if (t.length < 6) { toast('Enter the code from the email'); return; }
    const b = $('#siVerify'); b.disabled = true;
    try { await Cloud().verifyCode(em.value.trim(), t); toast('Signed in'); socialAttach(sUser()); if (!sLS.get('invite', '') && curRoute === 'signin') go('#/friends'); }
    catch(err) { b.disabled = false; toast(err.message); }
  };
  $('#siVerify').onclick = verify; code.oninput = () => { if (code.value.replace(/\D/g, '').length === 6) verify(); };
  const ap = $('#appleSignin'); if (ap) ap.onclick = () => Cloud().signInWithApple().catch(e => toast(e.message));
}

/* ----- #/invite/<code> ----- */
async function viewInvite(code){
  if (!socialOn()) { replacing = true; location.replace('#/'); return; }
  code = String(code || '').toUpperCase();
  setHeader('Invite', '', { parent:'#/' });
  const v = $('#view');
  if (!INVITE_RE.test(code)) { v.innerHTML = '<div class="card"><h2>Invite not valid</h2><div class="hint">Ask your friend to send the link again.</div></div>'; return; }
  v.innerHTML = '<div class="card" id="inviteView"><div class="hint">Loading…</div></div>';
  try { if (!Cloud().loaded) await Cloud().init(); } catch(e) {}
  let p = null, err = '';
  try { p = await Cloud().invitePreview(code); } catch(e) { err = e.message; }
  if (curRoute !== 'invite') return;
  const name = p ? p.display_name : (sLS.get('addName', '') || 'A friend');
  v.innerHTML = `<div class="card" id="inviteView">${p ? `<div class="frow">${sAvatar(p, 'lg')}<div class="grow"><b>${esc(name)}</b></div></div>` : ''}
    <h2 style="margin-top:12px">Add ${esc(name)} as a friend?</h2><div class="hint" style="margin-top:-4px">${esc(name)} invited you to train together on Forged.</div>
    ${err ? `<div class="hint">${esc(err)}</div>` : p && !p.valid ? '<div class="hint">This invite has expired. Ask for a new link.</div>' : !p ? '<div class="hint">We couldn\'t find this invite. Check the code.</div>' : ''}
    <button type="button" class="btn primary block" id="invGo" style="margin-top:12px">${sUser() ? `Add ${esc(name)}` : `Sign in to add ${esc(name)}`}</button>
    <div class="hint">Friends see each other's rank and weekly counts, never notes, weight or food.</div></div>`;
  $('#invGo').onclick = () => { if (sUser()) socialAccept(code); else { sLS.set('invite', code); go('#/signin'); } };
}



/* ---------- share cards (canvas → Web Share with files, or download) ---------- */
const SHARE_FMT = { square:[1080, 1080], story:[1080, 1920] };
let shareImgCache = null;
function loadShareImg(){ if (shareImgCache) return shareImgCache; shareImgCache = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'brand/forged/forged-mark.svg'; }); return shareImgCache; }
function shareContent(kind, x, showNums){
  const hide = v => showNums ? v : '•••', u = unit();
  if (kind === 'session') { const c = catOf(x), st = [];
    st.push([hide(`${x.duration || 0}`), 'min']); if (rpeOf(x)) st.push([hide(`${rpeOf(x)}/10`), 'effort']);
    if (c === 'weights') { const v = volumeOf(x); if (v) st.push([hide(Math.round(v).toLocaleString()), `${u} volume`]); }
    else if (x.rounds) st.push([hide(String(x.rounds)), 'rounds']);
    if (c === 'cardio' && x.cardio?.dist) st.push([hide(String(x.cardio.dist)), distU()]);
    return { eyebrow:'Workout logged', title:sessTitle(x), sub:fmtShort(x.date), stats:st.slice(0, 3), color:CATS[c]?.color || '#D7261E', foot:x.feel ? `Felt: ${(FEELS[x.feel-1]||[])[2] || ''}` : '' }; }
  if (kind === 'goal') return { eyebrow:'Goal hit · New PR', title:sgLabel(x), sub:x.achieved ? fmtShort(x.achieved.date) : fmtShort(today()), stats:[[hide(String(x.achieved ? x.achieved.value : sgTarget(x))), sgUnit(x)], [hide(String(sgTarget(x))), 'target']], color:'#F5C542' };
  if (kind === 'challenge') return { eyebrow:`${{ d:'Daily', w:'Weekly', m:'Monthly' }[x.p]} challenge complete`, title:x.title, sub:fmtShort(today()), stats:[[TIER[x.tier], 'tier']], color:'#6FD3A8' };
  if (kind === 'streak') return { eyebrow:'Streak', title:`${x.weeks}-week streak`, sub:'Training every week', stats:[[String(x.weeks), 'weeks'], [hide(String(x.sessions)), 'sessions']], color:'#D7261E' };
  if (kind === 'ring') return { eyebrow:'Monthly goal hit', title:x.label, sub:'Ring closed', stats:[[hide(`${x.n}`), 'workouts'], [hide(`${x.target}`), 'goal']], color:'#D7261E', ring:true };
  return { eyebrow:'Forged', title:'For the fight', sub:'', stats:[], color:'#D7261E' };
}
async function renderShareCard(kind, x, fmt = 'square', showNums = true){
  const [W, H] = SHARE_FMT[fmt] || SHARE_FMT.square, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), c = shareContent(kind, x, showNums), frame = 'classic', accent = '#D7261E';
  try { await Promise.all([document.fonts.load('800 120px "Barlow Condensed"'), document.fonts.load('600 40px "Barlow"')]); } catch(e) {}
  g.fillStyle = '#0B0B0C'; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * .5, H * 1.05, 40, W * .5, H * 1.05, H * .9); glow.addColorStop(0, 'rgba(215,38,30,.55)'); glow.addColorStop(.45, 'rgba(215,38,30,.12)'); glow.addColorStop(1, 'rgba(215,38,30,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // frame
  const fcol = { classic:accent, ember:'#E5484D', gold:'#F5C542', damascus:'#B48CF2' }[frame] || accent;
  g.lineWidth = frame === 'classic' ? 6 : 14; g.strokeStyle = fcol; if (frame === 'ember') { g.shadowColor = '#D7261E'; g.shadowBlur = 40; }
  g.strokeRect(36, 36, W - 72, H - 72); g.shadowBlur = 0;
  if (frame === 'damascus') { g.globalAlpha = .12; g.strokeStyle = '#B48CF2'; g.lineWidth = 3; for (let i = -H; i < W; i += 46) { g.beginPath(); g.moveTo(i, 0); g.bezierCurveTo(i + 120, H * .3, i - 120, H * .6, i + 60, H); g.stroke(); } g.globalAlpha = 1; }
  // category accent bar
  g.fillStyle = c.color; g.fillRect(36, 36, W - 72, 18);
  const top = fmt === 'story' ? 260 : 130, img = await loadShareImg();
  if (img) g.drawImage(img, 90, top - 40, 150, 150);
  g.fillStyle = '#FFFFFF'; g.font = '800 92px "Barlow Condensed", Impact, sans-serif'; g.textBaseline = 'alphabetic'; g.fillText('FORGED', 260, top + 52);
  g.fillStyle = '#9AA3AE'; g.font = '600 30px "Barlow", sans-serif'; g.fillText('F O R   T H E   F I G H T', 264, top + 96);
  const midY = fmt === 'story' ? 760 : 430;
  g.fillStyle = c.color; g.font = '600 40px "Barlow", sans-serif'; g.fillText(c.eyebrow.toUpperCase(), 90, midY);
  g.fillStyle = '#FFFFFF'; let fs = 120; g.font = `800 ${fs}px "Barlow Condensed", Impact, sans-serif`;
  const title = String(c.title || '').toUpperCase(); while (g.measureText(title).width > W - 180 && fs > 60) { fs -= 6; g.font = `800 ${fs}px "Barlow Condensed", Impact, sans-serif`; }
  g.fillText(title, 90, midY + fs + 10);
  g.fillStyle = '#C7CDD4'; g.font = '600 38px "Barlow", sans-serif'; if (c.sub) g.fillText(c.sub, 90, midY + fs + 70);
  const sy = fmt === 'story' ? 1300 : 790, cw = (W - 180) / Math.max(1, c.stats.length);
  c.stats.forEach(([v, l], i) => { const x0 = 90 + i * cw; g.fillStyle = '#FFFFFF'; g.font = '800 110px "Barlow Condensed", Impact, sans-serif'; g.fillText(String(v), x0, sy);
    g.fillStyle = '#9AA3AE'; g.font = '600 32px "Barlow", sans-serif'; g.fillText(String(l).toUpperCase(), x0 + 4, sy + 50); });
  if (c.foot) { g.fillStyle = '#C7CDD4'; g.font = '600 34px "Barlow", sans-serif'; g.fillText(c.foot, 90, sy + 120); }
  g.fillStyle = '#6B7280'; g.font = '600 28px "Barlow", sans-serif'; g.textAlign = 'right'; g.fillText('forgedfightapp.github.io', W - 90, H - 80); g.textAlign = 'left';
  return cv;
}
function shareSheet(kind, x){
  let fmt = 'square', nums = true;
  const el = h(`<div id="shareSheet"><h3>Share</h3><div class="sharepv"><img id="sharePreview" alt="Share card preview"></div></div>`);
  const draw = async () => { const cv = await renderShareCard(kind, x, fmt, nums); el.querySelector('#sharePreview').src = cv.toDataURL('image/png'); el.querySelector('#sharePreview').dataset.w = cv.width; el.querySelector('#sharePreview').dataset.h = cv.height; el._cv = cv; };
  el.appendChild(field('Size', seg([['square','Square 1080×1080'],['story','Story 1080×1920']], fmt, v => { fmt = v; draw(); })));
  const tg = h(`<label class="toggle"><span><b>Show numbers</b><small>Weights, times and other numbers on the card</small></span><input type="checkbox" role="switch" id="shareNums" checked><i></i></label>`);
  tg.querySelector('input').onchange = e => { nums = e.target.checked; draw(); }; el.appendChild(tg);
  const btn = h('<button type="button" class="btn primary block" id="shareGo" style="margin-top:14px">Share image</button>'); el.appendChild(btn);
  btn.onclick = async () => { if (!el._cv) await draw(); const blob = await new Promise(r => el._cv.toBlob(r, 'image/png')), name = `forged-${kind}-${today()}.png`;
    try { const file = new File([blob], name, { type:'image/png' });
      if (navigator.canShare && navigator.canShare({ files:[file] })) { await navigator.share({ files:[file], title:'Forged' }); return; } } catch(e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Image saved'); };
  openSheet(el, null, { closeLabel:'Close' }); draw();
}

/* In-context 'Set goal' links: confirm before leaving for Profile, warn about unsaved input, remember where to come back to. */
let goalsReturn = null;
/* ================= 3.18.0: onboarding assessment, Today's session, Build a workout ================= */
const GEN = window.FORGED_GEN;
const ARTS = [['bjj','BJJ'],['wrestling','Wrestling'],['judo','Judo'],['sambo','Sambo'],['muaythai','Muay Thai'],['boxing','Boxing'],['kickboxing','Kickboxing'],['mma','MMA'],['karate','Karate'],['taekwondo','Taekwondo']];
const ART_CAT = { bjj:'grappling', wrestling:'grappling', judo:'grappling', sambo:'grappling', muaythai:'striking', boxing:'striking', kickboxing:'striking', karate:'striking', taekwondo:'striking', mma:'mma' };
const NMA_TEXT = 'I understand Forged gives general training information, not medical advice. I\u2019ll check with a medical professional before training with an injury or health condition.';
const needsAssessment = () => !db.profile.assess?.done && !db.profile.sampleProfile;
/* prefill from what an existing user already has */
function assessDraft(){
  const p = db.profile, a = p.assess || {}, sch = p.schedule || {};
  const arts = a.arts || [...new Set([...(db.belts||[]).filter(x => !x.sample).map(artOf), ...(enabled('grappling') ? ['bjj'] : []), ...(enabled('striking') ? ['muaythai'] : []), ...(enabled('mma') ? ['mma'] : [])])];
  const mat = a.schedule?.mat || [...new Set([...(sch.grappling||[]), ...(sch.striking||[]), ...(sch.mma||[])])].sort();
  return { arts, primary:a.primary || arts[0] || '', belts:a.belts || Object.fromEntries(arts.filter(k => BELT_ARTS[k]).map(k => { const c = currentRank(k); return [k, { belt:c ? c.belt : 'white', stripes:c ? c.stripes : 0, date:c ? c.beltDate || '' : '' }]; })),
    schedule:{ mat, lift:a.schedule?.lift || (sch.weights || []).slice(), len:a.schedule?.len || 45 },
    locations:a.locations || [{ id:'l1', name:'Gym', type:'gym', equip:GEN.PRESET.gym.slice() }], loc:a.loc || 'l1',
    exp:a.exp || '', goal:a.goal || '', injuries:a.injuries || [...new Set(activeInjuries().map(x => x.area))], name:p.name || '', nma:!!p.nmaAt };
}
function viewAssess(){
  document.body.classList.add('setup-mode');
  const A = assessDraft(), redo = !!db.profile.assess?.done, steps = ['arts','belts','schedule','location','exp','goal','injuries','you'];
  let i = 0;
  const v = $('#view');
  const chips = (opts, on, multi, cb, id) => { const el = h(`<div class="focuschips" ${id ? `id="${id}"` : ''} role="group"></div>`);
    opts.forEach(([k, l]) => { const b = h(`<button type="button" data-k="${esc(String(k))}" aria-pressed="${on(k)}" class="${on(k) ? 'on' : ''}">${esc(l)}</button>`); b.onclick = () => { cb(k); draw(); }; el.appendChild(b); }); return el; };
  const tog = (arr, k) => arr.includes(k) ? arr.filter(x => x !== k) : arr.concat(k);
  const dayOpts = [1,2,3,4,5,6,0].map(d => [d, DOW[d]]);
  function draw(){
    const st = steps[i]; if (st === 'belts' && !A.arts.some(k => BELT_ARTS[k])) { i += 1; return draw(); }
    setHeader(redo ? 'Training assessment' : 'Welcome to Forged', '', redo ? { label:'Profile' } : null);
    v.innerHTML = `<div class="assess" data-step="${st}"><div class="hint" id="asStep">Step ${i + 1} of ${steps.length}</div><div id="asBody"></div><div class="grid2" style="margin-top:16px">${i ? '<button type="button" class="btn" id="asBack">Back</button>' : '<span></span>'}<button type="button" class="btn primary" id="asNext">${i === steps.length - 1 ? 'Finish' : 'Next'}</button></div></div>`;
    const B = $('#asBody'), card = (t, sub) => { const c = h(`<div class="card"><h2>${esc(t)}</h2>${sub ? `<div class="hint" style="margin:-4px 0 10px">${esc(sub)}</div>` : ''}</div>`); B.appendChild(c); return c; };
    if (st === 'arts') { const c = card('What do you train?', 'Pick every art you train, then your main one.');
      c.appendChild(chips(ARTS, k => A.arts.includes(k), true, k => { A.arts = tog(A.arts, k); if (!A.arts.includes(A.primary)) A.primary = A.arts[0] || ''; }, 'asArts'));
      if (!redo && !db.sessions.length) { const ls = h('<button type="button" class="btn block ghost" id="loadSample" style="margin-top:12px">Load sample data (demo)</button>'); ls.onclick = () => loadSample(); B.appendChild(ls); }
      if (A.arts.length > 1) { c.appendChild(h('<div class="label sect" style="margin-top:12px">Main art</div>')); c.appendChild(chips(ARTS.filter(x => A.arts.includes(x[0])), k => A.primary === k, false, k => A.primary = k, 'asPrimary')); } }
    if (st === 'belts') A.arts.filter(k => BELT_ARTS[k]).forEach(k => { const Ar = BELT_ARTS[k], b = A.belts[k] = A.belts[k] || { belt:Ar.belts[0], stripes:0, date:'' }, c = card(`${Ar.label} ${Ar.noun}`, 'This starts your belt tracker. The date is optional.');
      c.dataset.art = k; c.appendChild(chips(Ar.belts.map(x => [x, beltName(x, k)]), x => b.belt === x, false, x => { b.belt = x; b.stripes = 0; }));
      const sb = subOf(b.belt, k); if (sb) { c.appendChild(h(`<div class="label sect" style="margin-top:10px">${cap(sb.word)}s</div>`)); c.appendChild(chips([0, ...Array.from({ length:sb.to - sb.from + 1 }, (_, j) => sb.from + j)].map(n => [n, String(n)]), n => b.stripes === n, false, n => b.stripes = n)); }
      const d = h(`<input class="input" type="date" value="${esc(b.date)}" max="${today()}" aria-label="Date">`); d.onchange = () => b.date = d.value; c.appendChild(field('Date (optional)', d)); });
    if (st === 'schedule') { const c = card('Your week', 'Pick your exact days. Lift workouts are built around your mat days.');
      c.appendChild(h('<div class="label sect">Mat days</div>')); c.appendChild(chips(dayOpts, d => A.schedule.mat.includes(d), true, d => A.schedule.mat = tog(A.schedule.mat, d), 'asMat'));
      c.appendChild(h('<div class="label sect" style="margin-top:12px">Lift days</div>')); c.appendChild(chips(dayOpts, d => A.schedule.lift.includes(d), true, d => A.schedule.lift = tog(A.schedule.lift, d), 'asLift'));
      c.appendChild(h('<div class="label sect" style="margin-top:12px">Session length</div>')); c.appendChild(chips(GEN.LENGTHS, n => A.schedule.len === n, false, n => A.schedule.len = n, 'asLen')); }
    if (st === 'location') { const L = A.locations.find(x => x.id === A.loc) || A.locations[0], c = card('Where do you lift?', 'Save each place you train with its own equipment.');
      if (A.locations.length > 1) c.appendChild(chips(A.locations.map(x => [x.id, x.name]), id => L.id === id, false, id => A.loc = id, 'asLocs'));
      c.appendChild(chips(GEN.LOCATIONS, t => L.type === t, false, t => { L.type = t; L.equip = GEN.PRESET[t].slice(); if (/^(Gym|Garage|Home|Hotel|Bodyweight)/.test(L.name)) L.name = GEN.LOCATIONS.find(x => x[0] === t)[1].split(' ')[0]; }, 'asLocType'));
      const nm = h(`<input class="input" id="asLocName" maxlength="24" value="${esc(L.name)}">`); nm.oninput = () => L.name = nm.value; c.appendChild(field('Name', nm));
      c.appendChild(h('<div class="label sect">Equipment</div>')); c.appendChild(chips(GEN.EQUIP, e => L.equip.includes(e), true, e => L.equip = tog(L.equip, e), 'asEquip'));
      const add = h('<button type="button" class="btn block ghost" id="asAddLoc" style="margin-top:10px">+ Add another location</button>'); add.onclick = () => { const id = 'l' + Date.now().toString(36); A.locations.push({ id, name:'Garage', type:'garage', equip:GEN.PRESET.garage.slice() }); A.loc = id; draw(); }; c.appendChild(add);
      if (A.locations.length > 1) { const del = h('<button type="button" class="btn block ghost" id="asDelLoc">Remove this location</button>'); del.onclick = () => { A.locations = A.locations.filter(x => x.id !== L.id); A.loc = A.locations[0].id; draw(); }; c.appendChild(del); } }
    if (st === 'exp') { const c = card('Workout experience', 'Your lifting experience, separate from your belt.'), l = h('<div class="optlist" id="asExp"></div>');
      GEN.EXP.forEach(([k, t, d]) => { const b = h(`<button type="button" class="list-row ${A.exp === k ? 'on' : ''}" data-k="${k}" aria-pressed="${A.exp === k}"><div class="grow"><b>${t}</b><small>${esc(d)}</small></div></button>`); b.onclick = () => { A.exp = k; draw(); }; l.appendChild(b); }); c.appendChild(l); }
    if (st === 'goal') card('Main goal').appendChild(chips(GEN.GOALS, k => A.goal === k, false, k => A.goal = k, 'asGoal'));
    if (st === 'injuries') card('Any injuries?', 'Workouts skip moves that load these areas and add rehab and mobility work. Leave empty if none.').appendChild(chips(BODY_AREAS.map(x => [x, x]), k => A.injuries.includes(k), true, k => A.injuries = tog(A.injuries, k), 'asInj'));
    if (st === 'you') { const c = card('Your name');
      const nm = h(`<input class="input" id="asName" maxlength="30" placeholder="Name or nickname" value="${esc(A.name)}">`); nm.oninput = () => A.name = nm.value; c.appendChild(field('Display name', nm));
      if (unameOn() && !sLS.get('uname', '')) { const uf = unameField({ remote:true, label:'Username', value:sLS.get('wantUname', '') }); uf.id = 'asUname'; c.appendChild(uf); A._uf = uf; }
      const ck = h(`<label class="checkrow" id="asNma"><input type="checkbox" ${A.nma ? 'checked' : ''}><span>${esc(NMA_TEXT)} <a href="terms.html#medical" target="_blank" rel="noopener">Terms</a></span></label>`); ck.querySelector('input').onchange = e => A.nma = e.target.checked; c.appendChild(ck); }
    $('#asBack') && ($('#asBack').onclick = () => { do i--; while (i > 0 && steps[i] === 'belts' && !A.arts.some(k => BELT_ARTS[k])); draw(); });
    $('#asNext').onclick = async () => {
      const miss = { arts:!A.arts.length && 'Pick at least one art', schedule:!A.schedule.lift.length && 'Pick at least one lift day', exp:!A.exp && 'Pick your experience level', goal:!A.goal && 'Pick a goal', you:!A.nma && 'Please tick the not-medical-advice box' }[st];
      if (miss) { toast(miss); return; }
      if (st === 'location' && !A.locations.every(x => x.name.trim())) { toast('Name each location'); return; }
      if (i < steps.length - 1) { i++; draw(); window.scrollTo(0, 0); return; }
      if (A._uf) { const raw = $('#unIn')?.value.trim(); if (raw) { await A._uf.check(); const hd = A._uf.value(); if (!hd) { toast('Fix your username or clear it'); return; } sLS.set('wantUname', hd); } }
      saveAssessment(A); document.body.classList.remove('setup-mode'); toast(redo ? 'Assessment updated' : 'You\u2019re all set 🤙'); go('#/');
    };
  }
  draw();
}
function saveAssessment(A){
  const p = db.profile, { _uf, nma, name, ...a } = A;
  a.arts = a.arts.filter(k => ART_CAT[k]); a.done = true; a.at = today();
  const en = { ...(p.enabled || {}), weights:true }; a.arts.forEach(k => en[ART_CAT[k]] = true);
  const sch = { ...(p.schedule || {}), weights:a.schedule.lift.slice() }; ['grappling','striking','mma'].forEach(c => { if (en[c]) sch[c] = a.schedule.mat.filter(() => a.arts.some(k => ART_CAT[k] === c)); });
  db.profile = { ...p, assess:a, enabled:en, schedule:sch, name:name.trim() || p.name, nmaAt:p.nmaAt || new Date().toISOString(), setupDone:true };
  // seed the belt tracker once per art (never overwrites a logged history)
  Object.entries(a.belts || {}).filter(([k]) => a.arts.includes(k) && BELT_ARTS[k]).forEach(([k, b]) => {
    if ((db.belts||[]).some(x => !x.sample && artOf(x) === k)) return;
    const date = b.date || today(), ev = [{ id:uid(), date, belt:b.belt, kind:'belt', stripes:k === 'bjj' ? b.stripes : 0, art:k === 'bjj' ? undefined : k, notes:'From your assessment', createdAt:Date.now() }];
    if (k !== 'bjj' && b.stripes) ev.push({ id:uid(), date, belt:b.belt, kind:'stripe', stripes:b.stripes, art:k, createdAt:Date.now() + 1 });
    db.belts = sanitizeBelts((db.belts || []).concat(ev));
  });
  syncProfileRank(); save();
}
/* ---- generated workouts ---- */
const assess = () => db.profile.assess || {};
const curLoc = id => { const a = assess(), L = a.locations || []; return L.find(x => x.id === (id || a.loc)) || L[0] || { id:'bw', name:'Bodyweight', type:'bodyweight', equip:[] }; };
const genProfile = loc => { const a = assess(); return { exp:a.exp || 'beginner', goal:a.goal || 'strength', arts:a.arts || [], primary:a.primary, equip:curLoc(loc).equip, injuries:[...new Set((a.injuries || []).concat(activeInjuries().map(x => x.area)))] }; };
/* today's choices reset every day: Quick (~25 min) or Full (your session length), location, shuffle seed, swaps */
function todayState(){ const t = db.profile.today; if (t && t.date === today()) return t; db.profile.today = { date:today(), mode:'full', loc:assess().loc, seed:0, swaps:[] }; return db.profile.today; }
function todayPlan(){
  const a = assess(), plan = GEN.weekPlan(a), dow = new Date().getDay();
  const it = plan.find(x => x.dow === dow), nx = plan.find(x => x.dow > dow) || plan[0];
  return { it, nx, plan, mat:(a.schedule?.mat || []).includes(dow) };
}
function buildWorkout(type, st, lightLegs){
  const len = assess().schedule?.len || 45, minutes = st.mode === 'quick' ? GEN.QUICK_MIN : len;
  return GEN.workout(genProfile(st.loc), { type, minutes, lightLegs, seed:`${today()}|${type}|${st.loc}|${st.seed}`, swaps:st.swaps });
}
const TYPE_LABEL = { full:'Full body', upper:'Upper body', lower:'Lower body' };
function workoutHtml(w, id){
  const row = e => `<div class="list-row gx" data-ex="${esc(e.name)}"><div class="grow"><b>${esc(e.name)}</b><small>${e.sets} × ${esc(e.reps)} · rest ${e.rest >= 120 ? `${e.rest / 60} min` : `${e.rest}s`}</small><small class="dim">${esc(e.cue)}</small></div><button type="button" class="btn sm ghost" data-swapx="${esc(e.name)}">Swap</button></div>`;
  return `<div id="${id}"><div class="label sect">Warm-up</div><ul class="warm">${w.warmup.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="label sect">Main lifts</div>${w.main.map(row).join('')}
    ${w.acc.length ? `<div class="label sect">Accessories</div>${w.acc.map(row).join('')}` : ''}
    ${w.rehab.length ? `<div class="label sect">Rehab &amp; mobility</div><div id="gxRehab">${w.rehab.map(e => `<div class="list-row"><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.dose)} · ${esc(e.area)}</small><small class="dim">${esc(e.cue)}</small></div></div>`).join('')}</div><div class="disclaimer" id="gxNote">⚠️ ${esc(w.note)}</div>` : ''}
    ${w.main[0] ? `<div class="hint" style="margin-top:8px">📈 ${esc(w.main[0].prog)}</div>` : ''}</div>`;
}
const repsArr = r => { const m = String(r).match(/\d+/g) || ['10']; return [Number(m[0]), Number(m[1] || m[0])]; };
function startGenerated(w, type){
  const ex = w.main.concat(w.acc).map(e => progExercise({ name:e.name, sets:e.sets, reps:repsArr(e.reps), rest:e.rest }));
  guardLeave(() => { form = blankSession('weights'); form.exercises = ex; form.discipline = 'strength'; form.duration = w.est; form._durTouched = true; form.notes = `${TYPE_LABEL[type]} · generated`; formBase = null; go('#/log'); });
}
/* one control: Quick or Full; a location picker when more than one is saved; swap by equipment or by pain */
function genControls(st){
  const a = assess(), locs = a.locations || [];
  return `<div class="seg" id="qfSeg" role="radiogroup" aria-label="Session length"><button type="button" data-mode="quick" class="${st.mode === 'quick' ? 'on' : ''}">Quick · ~${GEN.QUICK_MIN} min</button><button type="button" data-mode="full" class="${st.mode === 'full' ? 'on' : ''}">Full · ${a.schedule?.len || 45} min</button></div>
    ${locs.length > 1 ? `<div class="seg" id="locSeg" style="margin-top:8px">${locs.map(L => `<button type="button" data-loc="${esc(L.id)}" class="${curLoc(st.loc).id === L.id ? 'on' : ''}">${esc(L.name)}</button>`).join('')}</div>` : ''}`;
}
function wireGen(root, st, w, type, redraw){
  root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { st.mode = b.dataset.mode; save(); redraw(); });
  root.querySelectorAll('[data-loc]').forEach(b => b.onclick = () => { st.loc = b.dataset.loc; st.swaps = []; save(); redraw(); });
  const sh = root.querySelector('[data-shuffle]'); if (sh) sh.onclick = () => { st.seed++; st.swaps = []; save(); redraw(); };
  const go1 = root.querySelector('[data-startgen]'); if (go1) go1.onclick = () => startGenerated(w, type);
  root.querySelectorAll('[data-swapx]').forEach(b => b.onclick = () => swapGenSheet(b.dataset.swapx, st, redraw));
}
function swapGenSheet(name, st, redraw){
  const gp = genProfile(st.loc); let pain = '';
  const el = h(`<div><h3>Swap ${esc(name)}</h3><div class="hint" style="margin:-6px 0 10px">Same movement, using the equipment at ${esc(curLoc(st.loc).name)}.</div><div class="label sect">Does something hurt?</div><div class="focuschips" id="painChips"></div><div class="swaplist" id="swapList" style="margin-top:10px"></div></div>`);
  const draw = () => { el.querySelector('#painChips').innerHTML = ['', 'Shoulder','Elbow','Wrist','Lower back','Knee','Hip','Neck','Ankle'].map(k => `<button type="button" data-pain="${k}" class="${pain === k ? 'on' : ''}">${k || 'No pain'}</button>`).join('');
    el.querySelectorAll('[data-pain]').forEach(b => b.onclick = () => { pain = b.dataset.pain; draw(); });
    const opts = GEN.swaps(gp, name, pain), L = el.querySelector('#swapList');
    L.innerHTML = opts.length ? opts.map(n => `<button type="button" class="list-row" data-to="${esc(n)}"><div class="grow"><b>${esc(n)}</b></div></button>`).join('') : '<div class="hint">No other option with this equipment. Try another location or skip it today.</div>';
    L.querySelectorAll('[data-to]').forEach(b => b.onclick = () => { st.swaps = st.swaps.filter(s => s[1] !== name).concat([[name, b.dataset.to]]); save(); closeSheet(); whenSettled(redraw); }); };
  draw(); openSheet(el, null, { closeLabel:'Cancel' });
}
/* Home: Today's session */
function todayCard(){
  if (!assess().done) return '';
  const st = todayState(), { it, nx, mat } = todayPlan();
  if (!it) return `<div class="card" id="todayCard"><h2>Today's session <small>${mat ? 'mat day' : 'rest day'}</small></h2><div class="hint" style="margin:0 0 10px">${mat ? 'Mat day: train hard and recover. ' : ''}${nx ? `Next lift: <b>${DOW[nx.dow]}</b> · ${TYPE_LABEL[nx.type]}` : 'Add lift days in your assessment.'}</div><a class="btn block" href="#/build">Build a workout anyway</a></div>`;
  const w = buildWorkout(it.type, st, it.lightLegs);
  return `<div class="card" id="todayCard" data-type="${it.type}"><h2>Today's session <small id="todayEst">about ${w.est} min · ${TYPE_LABEL[it.type]}${it.lightLegs ? ' · easy legs before mat day' : ''}</small></h2>
    ${genControls(st)}${workoutHtml(w, 'todayList')}
    <div class="grid2" style="margin-top:12px"><button type="button" class="btn" data-shuffle>Shuffle</button><button type="button" class="btn primary" data-startgen id="startSession">Start session</button></div></div>`;
}
function wireToday(v){ const c = v.querySelector('#todayCard'); if (!c || !c.dataset.type) return; const { it } = todayPlan(); wireGen(c, todayState(), buildWorkout(it.type, todayState(), it.lightLegs), it.type, () => route()); }
/* Build a workout: Generate (any day type) or Follow a program */
let buildType = 'full';
function viewBuild(tab){
  setHeader('Build a workout');
  const v = $('#view'), which = tab === 'program' ? 'program' : 'generate';
  const seg = `<div class="seg fuelseg" role="tablist"><a role="tab" href="#/build" class="${which === 'generate' ? 'on' : ''}">Generate</a><a role="tab" href="#/build/program" class="${which === 'program' ? 'on' : ''}">Follow a program</a></div>`;
  if (which === 'program') {
    const p = activeProgram(), t = p && tmplOf(p.tid), nx = p && progNext(p);
    v.innerHTML = `${seg}${p ? `<div class="card" id="activeProg"><h2>Current program</h2><div class="list-row"><div class="grow"><b>${esc(t.name)}</b><small>Started ${fmtShort(p.start)} · ${p.weeks} weeks · ${p.days.map(d => DOW[d]).join('/')} · ${nx.done ? 'complete' : `${nx.doneN}/${nx.sch.length} done`}</small></div></div>
      ${!nx.done ? `<button type="button" class="btn primary block" data-progi="${nx.item.i}" style="margin-top:10px">${nx.due ? 'Start today\u2019s workout' : 'Start next workout'}</button>` : ''}<button type="button" class="btn block ghost" id="endProg" style="margin-top:8px">End program</button></div>` : ''}
      <div class="card" id="progList"><h2>Programs</h2>${PROG.templates.map(x => `<a class="list-row tmpl" href="#/program/${x.id}" data-tmpl="${x.id}"><div class="grow"><b>${esc(x.name)}</b><small>${esc(x.short)} · ${x.days} days/wk</small></div>${p && p.tid === x.id ? '<span class="pill">Active</span>' : ''}<span class="chev">›</span></a>`).join('')}</div>
      <div class="card" id="finList"><h2>Add-on finishers <small>8–10 min after any session</small></h2>${PROG.finishers.map(f => `<a class="list-row" href="#/program/fin-${f.id}"><div class="grow"><b>${esc(f.name)}</b><small>${esc(f.short)}</small></div><span class="chev">›</span></a>`).join('')}</div>
      <div class="disclaimer" id="progDisclaimer">⚠️ ${esc(PROG.disclaimer)}</div>`;
    wireProg(v);
    const end = $('#endProg'); if (end) end.onclick = async () => { if (await confirmSheet('End this program?', 'Your logged workouts stay in History.', 'End program')) { db.program = null; save(); toast('Program ended'); route(); } };
    return;
  }
  if (!assess().done) { v.innerHTML = `${seg}<div class="card"><div class="empty">Take the quick assessment so workouts fit your schedule, equipment and experience.</div><a class="btn primary block" href="#/assess">Start assessment</a></div>`; return; }
  const st = todayState(), w = buildWorkout(buildType, st, false), { plan } = todayPlan(), a = assess();
  v.innerHTML = `${seg}<div class="card" id="buildCard" data-type="${buildType}"><h2>${TYPE_LABEL[buildType]} <small id="buildEst">about ${w.est} min</small></h2>
    <div class="seg" id="typeSeg" style="margin-bottom:8px">${Object.entries(TYPE_LABEL).map(([k, l]) => `<button type="button" data-type="${k}" class="${buildType === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${genControls(st)}${workoutHtml(w, 'buildList')}
    <div class="grid2" style="margin-top:12px"><button type="button" class="btn" data-shuffle>Shuffle</button><button type="button" class="btn primary" data-startgen>Start session</button></div></div>
    <div class="card" id="weekPlan"><h2>Your week <small>${a.schedule.len} min · ${esc(GEN.EXP.find(x => x[0] === a.exp)?.[1] || '')}</small></h2>${[1,2,3,4,5,6,0].map(d => { const it = plan.find(x => x.dow === d), m = a.schedule.mat.includes(d); return `<div class="list-row" data-dow="${d}"><div class="grow"><b>${DOW[d]}</b><small>${[m ? 'Mat' : '', it ? TYPE_LABEL[it.type] + (it.lightLegs ? ' (easy legs)' : '') : ''].filter(Boolean).join(' + ') || 'Rest'}</small></div></div>`; }).join('')}
    <a class="btn block ghost" href="#/assess" style="margin-top:8px">Change schedule or equipment</a></div>`;
  v.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { buildType = b.dataset.type; route(); });
  wireGen(v.querySelector('#buildCard'), st, w, buildType, () => route());
}

const RETURN_NAME = h0 => { const a = (h0 || '/').split('/')[1] || ''; return ({ '':'Home', food:'Food', stats:'Stats', history:'History', log:'Log', edit:'workout', comps:'Comps', benchmarks:'Benchmarks', session:'workout' })[a] || 'previous page'; };
function unsavedInput(){
  if (onForm() && formDirty()) return true;
  const scope = [...document.querySelectorAll('#sheet:not([hidden]) input, #sheet:not([hidden]) textarea')];
  return scope.some(i => !['hidden','file','checkbox','radio','button'].includes(i.type) && i.value !== i.defaultValue);
}
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a.setgoals'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  const dest = a.getAttribute('href') || '#/settings/goals', from = curHash || '/', dirty = unsavedInput();
  const ask = () => confirmSheet('Leave this page?', `You'll go to Profile to set your goals.${dirty ? ' What you entered here hasn\u2019t been saved and will be discarded.' : ''}`, 'Go to goals', dirty);
  const run = () => ask().then(ok => { if (!ok) return; goalsReturn = from; if (onForm()) { if (curRoute === 'log') draftClear(); form = null; formBase = null; } whenSettled(() => go(dest)); });
  if (!$('#sheet').hidden) { closeSheet(); whenSettled(run); } else run();
}, true);

/* ---------------- router ---------------- */
let formBase = null, curRoute = null, curHash = null, navIdx = -1, replacing = false;
const formSnap = f => JSON.stringify(f, (k, v) => k.startsWith('_') ? undefined : v);
const formDirty = () => !!form && formBase != null && formSnap(form) !== formBase;
const onForm = () => curRoute === 'log' || curRoute === 'edit';
/* Ask before throwing away a half-filled workout. */
function guardLeave(proceed){
  if (onForm() && formDirty()) {
    const editing = curRoute === 'edit';
    confirmSheet(editing ? 'Discard your changes?' : 'Discard this workout?', editing ? 'Your edits to this workout will be lost.' : 'What you entered will be lost.', 'Discard', true)
      .then(ok => { if (ok) { if (!editing) draftClear(); form = null; formBase = null; whenSettled(proceed); } });
  } else proceed();
}
function goBack(parent){
  guardLeave(() => whenSettled(() => {
    if (navIdx > 0) history.back();
    else { replacing = true; location.replace(parent); }
  }));
}
const TARGET_HINT = 'Used to track your progress on the Nutrition screen. You can change these anytime in Profile.';
const TARGET_LABEL = { cal:'Calories', p:'Protein (g)', c:'Carbs (g)', f:'Fat (g)' };
function route(){
  { const pa = pendingAdd(); if (pa && db.profile.setupDone && socialOn()) { sLS.del('pendingAdd'); sLS.set('addName', pa.name); location.replace(pa.u ? '#/add/' + encodeURIComponent(pa.u) : '#/invite/' + pa.code); return; } }
  document.body.classList.remove('setup-mode');
  const hash = location.hash.replace(/^#/, '') || '/';
  // leaving a half-filled workout via the browser/iOS back gesture or a link: put the form back and ask first
  if (onForm() && curHash !== hash && formDirty()) {
    const target = location.hash || '#/';
    history.pushState({ idx:navIdx }, '', '#' + curHash);
    guardLeave(() => go(target));
    return;
  }
  if (!$('#sheet').hidden) closeSheet({ noHistory:true });
  clearInterval(sPoll);
  { const st = history.state || {}; if (st.idx == null) history.replaceState({ ...st, idx: replacing ? Math.max(0, navIdx) : navIdx + 1 }, ''); navIdx = history.state.idx; replacing = false; }
  updateNav();
  const [, a, b] = hash.split('/');
  curRoute = a || ''; curHash = hash;
  if (a !== 'log' && a !== 'edit') delete document.body.dataset.theme;
  const tab = { '':'home', challenges:'home', join:'home', friends:'friends', h2h:'friends', signin:'friends', invite:'friends', add:'friends', settings:'settings', assess:'settings', history:'history', belts:'history', session:'history', benchmarks:'home', build:'build', program:'build', log:'log', edit:'history', stats:'home' }[a||''] || 'home';
  document.querySelectorAll('.tabbar a').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  if (a !== 'log' && a !== 'edit') form = (a === 'session' ? null : form && !form.id ? form : null);
  switch (a || '') {
    case 'history': viewHistory(); break;
    case 'belts': viewBelts(b); break;
    case 'comps': location.replace('#/belts'); break;
    case 'challenges': viewChallenges(); break;
    case 'rank': case 'badges': location.replace('#/settings'); break;
    case 'join': viewJoin(b); break;
    case 'friends': viewFriends(); break;
    case 'h2h': viewH2h(b || ''); break;
    case 'signin': viewSignin(); break;
    case 'invite': viewInvite(b); break;
    case 'add': viewAdd(b); break;
    case 'benchmarks': viewBenchmarks(); break;
    case 'program': viewProgram(b || ''); break;
    case 'session': viewSession(b); break;
    case 'log': viewForm(null); break;
    case 'edit': viewForm(b); break;
    case 'stats': viewStats(); break;
    case 'build': viewBuild(b); break;
    case 'assess': viewAssess(); break;
    case 'programs': case 'food': case 'supps': location.replace('#/build'); break;
    case 'settings': viewSettings(); break;
    case 'pro': location.replace('#/settings'); break;
    default: viewHome();
  }
  if (a !== 'settings') goalsReturn = null;
  window.scrollTo(0, 0);
  if (a === 'settings' && b === 'weight') { const g = $('#weightCard'); if (g) g.scrollIntoView({ block:'start' }); }
  if (a === 'settings' && b === 'schedule') { const g = $('#scheduleCard'); if (g) g.scrollIntoView({ block:'start' }); }
  if (window.FORGED_TUT) FORGED_TUT.check(curRoute);
}
window.DM_TEST = { mediaOn, mediaPrepare, MEDIA_MAX_MB, MEDIA_MAX_S, h2hOutcome, h2hResults, h2hFinal, compKind, compSports, compRecord, sanitizeComps, BELT_ARTS, artsUsed, artOf, currentRank, beltHistory, sanitizeBelts, nextRank, socialDaily, socialQueueDiff, socialOn, socialSync, repTotal, REP_EX, repGoalsToday, sanitizeReps, currentChallenges, pickChallenges, periodOf, evalChallenge, CH_POOL, renderShareCard, shareContent, readFriendCode, friendCode, prEvents, timeLeft, gFair, strengthBest, strengthProgress, checkStrengthGoals, sanitizeStrength, nextTarget, sgTarget, diffYMD, fmtSpan, beltGroups, rpeFromIntensity, rpeOf, loadOf, loadStatus, backToBack, epley, benchSeries, benchDue, challengeStatus, challengeMonths, daysTo, nextComp, suggest, progSchedule, prescription, progNext, activeProgram, injDay, injName, activeInjuries, isPro, typeLabel, paywallOn, proTag, Payments, PRO_PLANS, PRO_FEATURES, get db(){ return db; } };
window.addEventListener('hashchange', route);
// 3.16.2: in-sheet hash links (e.g. Today's marks > Food). Closing the sheet calls history.back(), which used to
// land after the link's own navigation and undo it (back to Home). Close first, then navigate once the pop settles.
$('#sheet').addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented) return;
  e.preventDefault(); e.stopPropagation();
  const href = a.getAttribute('href'); closeSheet(); go(href);
});
// Bottom nav: always closes whatever is open (sheet or form) and goes to that screen.
document.querySelector('.tabbar').addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href'), same = (location.hash || '#/') === href;
  if (same) { if (!$('#sheet').hidden) closeSheet(); else if (!onForm()) route(); window.scrollTo(0, 0); return; }
  guardLeave(() => { if (!$('#sheet').hidden) closeSheet(); go(href); });
});
window.addEventListener('storage', e => { if (e.key === STORE_KEY) { db = load(); if (db.belts.length) syncProfileRank(); route(); } });
db = load(); if (db.belts.length) syncProfileRank();   // profile rank always follows the event log (covers migrated logs)
if (readDraft() && /^#?\/?$/.test(location.hash)) { draftResume(); history.replaceState(history.state, '', '#/log'); }
route();
socialBoot();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e)));
}
})();
