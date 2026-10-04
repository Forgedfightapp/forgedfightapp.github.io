/* Forged — For the fight. Training log for combat sports, weights, cardio and mobility
   Vanilla JS, no dependencies. Data lives in localStorage on this device. */
(() => {
'use strict';

const STORE_KEY = 'dm.bjj.v1';
const APP_VERSION = '3.2.0';

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
  ['grey','Grey','#9ca3af'],['yellow','Yellow','#facc15'],['orange','Orange','#f97316'],['green','Green','#16a34a']];
const ADULT_BELTS = ['white','blue','purple','brown','black'], KIDS_BELTS = ['grey','yellow','orange','green'];
const INTENSITY = ['', 'Light','Easy','Moderate','Hard','All-out'];

/* ---------------- storage ---------------- */
const SCHEMA = 7;
const defaultProfile = () => ({ name:'', belt:'white', stripes:0, promotedOn:'', goalWeight:'', startWeight:'', goalDate:'', unit:'lb', distUnit:'mi', maxHR:'', sampleProfile:false, setupDone:false, schedule:{}, challengeTarget:8,
  enabled:{ grappling:true, striking:false, mma:false, weights:false, cardio:false, mobility:false, food:true } });
const emptyDb = () => ({ schema:SCHEMA, sessions:[], profile:defaultProfile(), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], benchmarks:[], strength:[], game:sanitizeGame(null), injuries:[], challenges:[], program:null });
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
  unarchiveStriking(d); // safety net: never leave archived sessions hidden
  archiveSupps(d);      // supplements are archived (hidden) from 3.1.0 on
  (d.sessions||[]).forEach(s => { if (s && s.type) s.type = fixType(s.category, s.type); });   // Striking/MMA Open mat → Pad work
  d.schema = v; return d;
}
function load(){
  try{
    let d = JSON.parse(lastRaw = localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.sessions)) { const before = d.schema, oldBelts = (d.belts||[]).some(x => x && !x.kind); d = migrate(d); if (before !== d.schema || oldBelts) setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch(e){} }, 0);
      return { schema:d.schema, sessions:d.sessions, profile:{...defaultProfile(), ...(d.profile||{})}, nutrition:{ entries:d.nutrition?.entries||[], foods:d.nutrition?.foods||[], water:sanitizeWater(d.nutrition?.water) }, weights:sanitizeWeights(d.weights), belts:sanitizeBelts(d.belts), ...extrasOf(d) }; }
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
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.remove('act'); t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

function h(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/* ---------------- bottom sheet + in-app history ----------------
   Opening a sheet pushes a history entry so the iOS/browser back gesture closes it (popstate).
   Closing it in-app pops that entry again; navigation requested meanwhile waits for the pop. */
let sheetHist = false, popPending = false;
const afterPop = [];
function whenSettled(fn){ if (popPending) afterPop.push(fn); else fn(); }
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
/* Goal progress; direction (lose/gain) is inferred from start vs goal. */
function weightGoal(){
  const p = db.profile, ws = weightSeries(), r = x => Math.round(x*10)/10;
  const nz = v => { const n = Number(v); return n > 0 ? n : null; };
  const cur = ws.length ? ws[ws.length-1].w : nz(p.startWeight);
  const start = nz(p.startWeight) ?? (ws.length ? ws[0].w : null);
  const goal = nz(p.goalWeight);
  const out = { ws, cur, start, goal, dir:0, change:null, done:0, total:0, left:null, pct:0, reached:false, trend:weightTrend(ws), eta:null, goalDate:p.goalDate || '' };
  if (cur == null) return out;
  if (start != null) out.change = r(cur - start);
  if (goal != null && start != null) {
    out.dir = goal < start ? -1 : goal > start ? 1 : 0;
    if (!out.dir) out.dir = cur > goal ? -1 : cur < goal ? 1 : 0;
    out.total = r(Math.abs(goal - start));
    out.done = r((cur - start) * out.dir);
    out.left = r(Math.max(0, (goal - cur) * out.dir));
    out.reached = out.dir ? (goal - cur) * out.dir <= 0 : true;
    out.pct = out.reached ? 100 : out.total ? Math.max(0, Math.min(100, Math.round(out.done / out.total * 100))) : 0;
    const t = out.trend;
    if (!out.reached && t && t.perWeek * out.dir > 0.05) { const weeks = Math.abs(goal - cur) / Math.abs(t.perWeek); if (weeks <= 260) out.eta = iso(addDays(new Date(), Math.round(weeks*7))); }
  }
  return out;
}
function sparkline(ws){
  const pts = ws.slice(-20); if (pts.length < 2) return '';
  const W = 120, H = 40, vals = pts.map(p => p.w), lo = Math.min(...vals), hi = Math.max(...vals), rg = Math.max(0.5, hi-lo);
  const xy = pts.map((p,i) => [2 + (W-4) * i/(pts.length-1), 4 + (H-8) * (1 - (p.w-lo)/rg)]);
  const d = xy.map((q,i) => `${i?'L':'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('');
  const l = xy[xy.length-1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-label="Weight trend, last ${pts.length} weigh-ins" role="img"><path d="${d}"/><circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="3.5"/></svg>`;
}
const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
function weightCard(){
  const g = weightGoal(), u = unit();
  const logBtn = `<button type="button" class="btn primary block" id="logWeight" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log weight</button>`;
  if (g.cur == null) return `<div class="card" id="weightCard"><h2>Weight goal</h2><div class="empty" style="padding:2px 0 6px">Log your weight to track progress toward a goal.</div>${logBtn}</div>`;
  const doneLbl = g.dir > 0 ? 'Gained so far' : g.dir < 0 ? 'Lost so far' : 'Change';
  const doneVal = g.dir ? Math.max(0, g.done) : (g.change ?? 0);
  const rate = g.trend ? `${signed(g.trend.perWeek)} ${u}/wk` : '';
  let hint;
  if (g.goal == null) hint = `<a href="#/settings/weight" class="lnk setgoals">Set a goal weight</a> to see progress.`;
  else if (g.reached) hint = 'Goal reached 🎉';
  else hint = `${g.pct}% of the way${rate ? ` · ${rate}` : ''}${g.dir && g.done < 0 ? ` · ${signed(-g.done*g.dir)} ${u} from start` : ''}`;
  return `<div class="card" id="weightCard"><h2>Weight goal <a href="#/stats" class="lnk" id="weightMore">Trend ›</a></h2>
    <div class="wtop"><div class="wnow"><b data-w="current">${g.cur}<small> ${u}</small></b><span>Current</span></div>${sparkline(g.ws)}</div>
    ${g.goal != null ? `<div class="wgrid">
      <div><b data-w="goal">${g.goal}</b><span>Goal (${u})</span></div>
      <div><b data-w="done">${doneVal}</b><span>${doneLbl}</span></div>
      <div><b data-w="left">${g.left}</b><span>Left to go</span></div></div>
      <div class="mbar"><div class="b"><i data-w="pct" style="width:${g.pct}%"></i></div></div>` : ''}
    <div class="hint" id="weightHint">${hint}</div>${logBtn}</div>`;
}
/* Log weight: one tap opens it prefilled with the last value, one tap saves. */
function logWeightSheet(){
  const u = unit(), g = weightGoal(), step = u === 'kg' ? 0.1 : 0.2;
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
function weightStatsCard(){
  const g = weightGoal(), u = unit(), ws = g.ws;
  if (!ws.length) return `<div class="card" id="weightStats"><h2>Weight</h2><div class="empty">Log your weight (Home → Log weight) or add body weight to a workout to see the trend.</div></div>`;
  const recent = ws.filter(p => p.date >= iso(addDays(new Date(), -180)));
  const series = recent.length > 1 ? recent : ws;
  const t = g.trend;
  let proj = '';
  if (g.goal != null) {
    if (g.reached) proj = 'Goal reached 🎉';
    else if (g.eta) proj = `Projected goal date: <b id="eta">${fmtShort(g.eta)}</b>${g.goalDate ? (g.eta <= g.goalDate ? ' · on track for your target' : ` · target ${fmtShort(g.goalDate)}`) : ''}`;
    else if (t && t.perWeek * g.dir <= 0.05) proj = 'Trend isn’t moving toward your goal yet.';
    else proj = 'Log a few more weigh-ins over a week or two to project a goal date.';
  }
  const log = (db.weights||[]).slice().sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
  return `<div class="card" id="weightStats"><h2>Weight <small>${ws.length} entries</small></h2>
    <div style="display:flex;align-items:baseline;gap:10px;margin:-4px 0 6px;flex-wrap:wrap"><span style="font-size:30px;font-weight:760;letter-spacing:-.03em">${g.cur}<small style="font-size:15px;color:var(--muted)"> ${u}</small></span>
      ${g.change != null ? `<span style="font-weight:700;color:${g.change * (g.dir || -1) >= 0 ? 'var(--accent)' : 'var(--danger)'}">${signed(g.change)} ${u}</span><span style="color:var(--dim);font-size:13px">since start (${g.start} ${u})</span>` : ''}</div>
    ${series.length > 1 ? lineChart(series, g.goal) : ''}
    <div class="wfacts"><div><span>Weekly average</span><b id="wRate">${t ? `${signed(t.perWeek)} ${u}/wk` : '—'}</b><small>${t ? `last ${t.days} days` : 'needs 3+ entries over a week'}</small></div>
      <div><span>Goal</span><b>${g.goal != null ? `${g.goal} ${u}` : '—'}</b><small>${g.goal != null ? (g.reached ? 'reached' : `${g.left} ${u} to go · ${g.pct}%`) : '<a class="lnk setgoals" href="#/settings/weight">Set a goal</a>'}</small></div></div>
    ${proj ? `<div class="hint" id="wProj" style="margin-top:8px">${proj}</div>` : ''}
    ${log.length ? `<div class="month" style="margin-top:12px">Recent weigh-ins</div>${log.map(x => `<div class="list-row wrow"><div class="grow"><b>${Math.round(convW(x.w, x.u, u)*10)/10} ${u}</b><small>${fmtShort(x.date)}${x.sample ? ' · sample' : ''}</small></div><button type="button" class="iconbtn" data-wdel="${esc(x.id)}" aria-label="Delete weigh-in"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('')}` : ''}
    <button type="button" class="btn block" id="logWeight2" style="margin-top:12px">Log weight</button></div>`;
}
function wireWeight(root){
  root.querySelectorAll('#logWeight,#logWeight2').forEach(b => b.onclick = logWeightSheet);
  root.querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => { const before = JSON.parse(JSON.stringify(db.weights)); db.weights = db.weights.filter(x => x.id !== b.dataset.wdel); save(); route(); undoToast('Weigh-in deleted', () => { db.weights = before; save(); route(); }); });
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
function maxStripes(belt){ return belt === 'black' ? 6 : 4; }
/* 3.2.0: belt history is a list of dated events: kind 'belt' (belt earned, stripes reset to 0) or kind 'stripe' (stripe/degree n earned
   at that belt). Older entries were rank snapshots; they migrate here: same belt with a changed stripe count = stripe event, otherwise a
   belt event. A belt that starts with stripes already on it gets its belt event plus stripe events on the same date (marked approx). */
function sanitizeBelts(list){
  const base = (Array.isArray(list) ? list : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && BELTS.some(b => b[0] === x.belt))
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
const beltHistory = () => [...(db.belts||[])].sort((a,b) => a.date.localeCompare(b.date) || (a.kind === 'belt' ? 0 : 1) - (b.kind === 'belt' ? 0 : 1) || a.stripes - b.stripes || (a.createdAt||0) - (b.createdAt||0));
/* current rank: latest belt event + the highest stripe earned at that belt since; dates for "time at belt" and "since last stripe" */
const currentRank = () => { const h = beltHistory(); if (!h.length) return null;
  const be = [...h].reverse().find(e => e.kind === 'belt') || h[0], st = h.filter(e => e.kind === 'stripe' && e.belt === be.belt && e.date >= be.date);
  const top = st.reduce((a, e) => !a || e.stripes > a.stripes || (e.stripes === a.stripes && e.date > a.date) ? e : a, null), last = st.reduce((a, e) => !a || e.date > a.date ? e : a, null);
  return { ...be, stripes:top ? top.stripes : 0, date:last ? last.date : be.date, beltDate:be.date, lastStripe:last ? last.date : null, sample:be.sample }; };
const fmtYM = x => x.y ? `${x.y} yr${x.y > 1 ? 's' : ''} ${x.m} mo${x.m === 1 ? '' : 's'}` : x.m ? `${x.m} mo${x.m === 1 ? '' : 's'}` : `${x.d} day${x.d === 1 ? '' : 's'}`;
const stripeWord = (belt, n) => belt === 'black' ? `${n}${['','st','nd','rd'][n] || 'th'} degree` : `Stripe ${n}`;
const eventLabel = e => e.kind === 'stripe' ? `${stripeWord(e.belt, e.stripes)} earned` : `${beltOf(e.belt)[1]} belt earned`;
const rankLabel = (e, short) => e.stripes ? (e.belt === 'black' ? `${e.stripes}${['','st','nd','rd'][e.stripes] || 'th'} degree` : `${e.stripes} stripe${e.stripes > 1 ? 's' : ''}`) : (short ? 'No stripes' : `Promoted to ${beltOf(e.belt)[1].toLowerCase()} belt`);
function syncProfileRank(){ const c = currentRank(); db.profile = { ...db.profile, belt:c ? c.belt : 'white', stripes:c ? c.stripes : 0, promotedOn:c ? c.beltDate : '' }; }
/* mat time logged in [from, to) (to inclusive when it is today) */
function matIn(from, to, inclusive){ const ss = db.sessions.filter(s => catOf(s) === 'grappling' && s.date >= from && (inclusive ? s.date <= to : s.date < to)); return { n:ss.length, min:ss.reduce((a,s) => a + (Number(s.duration)||0), 0) }; }
/* consecutive entries at the same belt form one group; a group runs until the next belt's first entry (or today) */
function beltGroups(){
  const h = beltHistory(), t = today(), groups = [];
  h.forEach((e, i) => { const prev = h[i-1]; e = { ...e, took: prev ? diffYMD(prev.date, e.date) : null, end: h[i+1] ? h[i+1].date : t, current: i === h.length-1 };
    const g = groups[groups.length-1]; if (g && g.belt === e.belt) g.items.push(e); else groups.push({ belt:e.belt, start:e.date, items:[e] }); });
  groups.forEach((g, i) => { g.current = i === groups.length-1; g.end = g.current ? t : groups[i+1].start; g.span = diffYMD(g.start, g.end); g.mat = matIn(g.start, g.end, g.current); });
  return groups;
}
// Belt illustration (SVG). size 'lg' = tied belt with hanging tails; 'sm' = flat bar for lists/timeline.
function beltSVG(belt, stripes, size='lg', title){
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
const beltBar = (belt, stripes, cls='') => beltSVG(belt, stripes, cls === 'mini' ? 'sm' : 'lg');
const beltEmpty = () => `<div class="belt empty-belt">${beltSVG('white', 0, 'lg', 'White belt')}</div><div class="belt-prompt"><b>Track your belt journey</b><span>Log your belt and stripes to track time at each rank.</span></div>`;
function beltCard(){
  const cur = currentRank();
  if (!cur) return `<div class="card" id="beltCard"><h2>Belt</h2>${beltEmpty()}<button type="button" class="btn primary block" data-promo>Log promotion</button></div>`;
  const b = beltOf(cur.belt), atBelt = diffYMD(cur.beltDate, today()), m = matIn(cur.date, today(), true), sw = cur.belt === 'black' ? 'degree' : 'stripe';
  return `<div class="card tappable" id="beltCard" data-href="#/belts"><h2>${esc(b[1])} belt${cur.stripes ? ` · ${rankLabel(cur)}` : ''} ${cur.sample ? '<span class="pill sample">Sample</span>' : ''}<a class="lnk" href="#/belts">Timeline ›</a></h2>
    <div class="belt">${beltBar(cur.belt, cur.stripes)}</div>
    <div class="belt-meta"><span>Time at belt <b data-b="rank">${fmtYM(atBelt)}</b></span><span>Time since last ${sw} <b data-b="since">${cur.lastStripe ? fmtYM(diffYMD(cur.lastStripe, today())) : `no ${sw}s yet`}</b></span></div>
    <div class="belt-meta" style="margin-top:4px"><span>Belt earned <b data-b="beltdate">${fmtShort(cur.beltDate)}</b></span>${cur.lastStripe ? `<span>Last ${sw} <b data-b="stripedate">${fmtShort(cur.lastStripe)}</b></span>` : ''}</div>
    <div class="belt-meta" style="margin-top:4px"><span><b>${m.n}</b> session${m.n === 1 ? '' : 's'} · <b>${hrs(m.min)}</b> h since last promotion</span></div>
    <button type="button" class="btn block" data-promo style="margin-top:12px">Log promotion</button></div>`;
}
function wireBelt(root){
  root.querySelectorAll('[data-promo]').forEach(x => x.onclick = e => { e.stopPropagation(); promoSheet(null); });
  const c = root.querySelector('#beltCard.tappable'); if (c) c.onclick = e => { if (!e.target.closest('a,button')) go('#/belts'); };
  root.querySelectorAll('[data-pid]').forEach(x => x.onclick = () => promoSheet(x.dataset.pid));
  root.querySelectorAll('[data-addstripe]').forEach(x => x.onclick = e => { e.stopPropagation(); promoSheet(null, { kind:'stripe', belt:x.dataset.addstripe, stripes:Number(x.dataset.n) || 1 }); });
}
/* the next likely promotion, so logging is usually just "Log promotion" -> "Save" */
function nextRank(cur){
  if (!cur) return { belt:'white', stripes:0 };
  if (cur.stripes < maxStripes(cur.belt) && cur.belt !== 'black') return { belt:cur.belt, stripes:cur.stripes + 1 };
  if (cur.belt === 'black') return { belt:'black', stripes:Math.min(6, cur.stripes + 1) };
  const ai = ADULT_BELTS.indexOf(cur.belt), ki = KIDS_BELTS.indexOf(cur.belt);
  return { belt: ai >= 0 ? ADULT_BELTS[ai+1] : KIDS_BELTS[ki+1] || 'blue', stripes:0 };
}
/* missing stripe numbers at a belt (e.g. stripes 1 and 3 logged, 2 missing) */
function missingStripes(belt){ const have = new Set((db.belts||[]).filter(e => e.kind === 'stripe' && e.belt === belt).map(e => e.stripes)), top = Math.max(0, ...have); return Array.from({ length:top }, (_, i) => i + 1).filter(n => !have.has(n)); }
function promoSheet(id, preset){
  const ex = id ? db.belts.find(x => x.id === id) : null, cur = currentRank(), nx = nextRank(cur);
  const f = ex ? { ...ex } : preset ? { instructor:cur?.instructor || '', academy:cur?.academy || '', notes:'', date:today(), ...preset }
    : { kind: cur && nx.belt === cur.belt ? 'stripe' : 'belt', belt:nx.belt, stripes: cur && nx.belt === cur.belt ? nx.stripes : 0, date:today(), instructor:cur?.instructor || '', academy:cur?.academy || '', notes:'' };
  if (!f.kind) f.kind = f.stripes ? 'stripe' : 'belt';
  let kids = KIDS_BELTS.includes(f.belt);
  const el = h(`<div><h3>${ex ? (ex.kind === 'stripe' ? 'Edit stripe' : 'Edit belt') : 'Log promotion'}</h3>
    <div class="field" id="kindF"></div>
    <div class="field"><label id="beltLbl">Belt</label><div class="beltpick" id="beltPick"></div><button type="button" class="btn sm ghost" id="kidsT" style="margin-top:8px">Kids belts</button></div>
    <div class="field" id="stripeF"></div>
    <div class="field"><label id="dateLbl">Belt earned</label><input class="input" type="date" id="pDate" max="${today()}" value="${esc(f.approx ? '' : f.date)}"><div class="hint" id="dateHint">Defaults to today. Pick an earlier date to add a past promotion.</div></div>
    <details class="details" ${ex && (ex.instructor || ex.academy || (ex.notes && !ex.approx)) ? 'open' : ''}><summary><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add details <small>optional</small></summary><div class="det-body">
      <div class="field"><label>Instructor</label><input class="input" id="pInst" autocapitalize="words" value="${esc(f.instructor)}" placeholder="e.g. Prof. Silva"></div>
      <div class="field"><label>Academy</label><input class="input" id="pAcad" autocapitalize="words" value="${esc(f.academy)}" placeholder="e.g. Riverside BJJ"></div>
      <div class="field"><label>Notes</label><textarea class="input" id="pNotes" rows="2" placeholder="How it happened, what to work on next…">${esc(f.approx ? '' : f.notes)}</textarea></div></div></details>
    <div style="display:flex;gap:10px;margin-top:6px">${ex ? '<button type="button" class="btn danger" id="pDel">Delete</button>' : ''}<button type="button" class="btn primary" style="flex:1" id="pSave">${ex ? 'Save changes' : 'Save'}</button></div></div>`);
  if (f.approx) el.querySelector('#pDate').value = f.date;
  const pick = el.querySelector('#beltPick'), sf = el.querySelector('#stripeF'), kt = el.querySelector('#kidsT'), kf = el.querySelector('#kindF');
  const sync = () => { const st = f.kind === 'stripe'; el.querySelector('#dateLbl').textContent = st ? `${f.belt === 'black' ? 'Degree' : 'Stripe'} earned` : 'Belt earned'; el.querySelector('#beltLbl').textContent = st ? 'At belt' : 'New belt'; sf.hidden = !st; };
  const drawKind = () => { kf.innerHTML = '<label>What happened?</label>'; kf.appendChild(seg([['belt','New belt'],['stripe', f.belt === 'black' ? 'Degree' : 'Stripe']], f.kind, x => { f.kind = x; if (x === 'stripe' && !f.stripes) f.stripes = (missingStripes(f.belt)[0]) || Math.min(maxStripes(f.belt), (cur && cur.belt === f.belt ? cur.stripes : 0) + 1); drawStripes(); sync(); })); kf.querySelector('.seg').id = 'pKind'; };
  const drawStripes = () => { if (f.stripes > maxStripes(f.belt)) f.stripes = maxStripes(f.belt); if (f.stripes < 1) f.stripes = 1; sf.innerHTML = `<label>${f.belt === 'black' ? 'Which degree' : 'Which stripe'}</label>`;
    sf.appendChild(seg(Array.from({length:maxStripes(f.belt)}, (_, i) => [i + 1, String(i + 1)]), f.stripes, x => { f.stripes = x; })); sf.querySelector('.seg').id = 'pStripe';
    const miss = missingStripes(f.belt).filter(n => !ex || n !== ex.stripes); if (miss.length) sf.appendChild(h(`<div class="hint">Missing a date for stripe ${miss.join(', ')} at ${beltOf(f.belt)[1].toLowerCase()} belt.</div>`)); };
  const drawPick = () => { const list = kids ? ADULT_BELTS.concat(KIDS_BELTS) : ADULT_BELTS; kt.textContent = kids ? 'Hide kids belts' : 'Kids belts';
    pick.innerHTML = list.map(k => `<button type="button" data-belt="${k}" class="${f.belt === k ? 'on' : ''}" aria-pressed="${f.belt === k}"><i style="background:${beltOf(k)[2]}"></i>${beltOf(k)[1]}</button>`).join('');
    pick.querySelectorAll('button').forEach(x => x.onclick = () => { f.belt = x.dataset.belt; drawPick(); drawKind(); drawStripes(); sync(); }); };
  kt.onclick = () => { kids = !kids; if (!kids && KIDS_BELTS.includes(f.belt)) f.belt = 'white'; drawPick(); drawStripes(); };
  drawKind(); drawPick(); drawStripes(); sync();
  el.querySelector('#pSave').onclick = () => {
    const date = el.querySelector('#pDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) { toast('Pick a date (today or earlier)'); return; }
    if (f.kind === 'stripe' && (db.belts||[]).some(e => e.id !== f.id && e.kind === 'stripe' && e.belt === f.belt && e.stripes === f.stripes)) { toast(`${stripeWord(f.belt, f.stripes)} at ${beltOf(f.belt)[1].toLowerCase()} belt is already logged. Tap it on the timeline to edit.`); return; }
    if (f.kind === 'belt' && (db.belts||[]).some(e => e.id !== f.id && e.kind === 'belt' && e.belt === f.belt)) { toast(`${beltOf(f.belt)[1]} belt is already logged. Tap it on the timeline to edit.`); return; }
    const before = JSON.parse(JSON.stringify(db.belts));
    const rec = sanitizeBelts([{ ...f, stripes:f.kind === 'belt' ? 0 : f.stripes, id:ex ? ex.id : uid(), date, instructor:el.querySelector('#pInst').value.trim(), academy:el.querySelector('#pAcad').value.trim(), notes:el.querySelector('#pNotes').value.trim(), createdAt:ex ? ex.createdAt : Date.now() }])[0];
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
  const belts = enabled('grappling') || (db.belts||[]).length;
  return `<div class="seg fuelseg histseg" role="tablist"><a role="tab" href="#/history" class="${which === 'workouts' ? 'on' : ''}">Workouts</a>${belts ? `<a role="tab" href="#/belts" class="${which === 'belts' ? 'on' : ''}">Belts</a>` : ''}<a role="tab" href="#/comps" class="${which === 'comps' ? 'on' : ''}">Comps</a></div>`;
}
function viewBelts(){
  setHeader('History', `<a class="btn sm" href="#/stats">Stats</a>`);
  const v = $('#view'), groups = beltGroups().reverse();
  const items = g => [...g.items].reverse().map(e => `<button type="button" class="tl-item ${e.kind}${e.approx ? ' approx' : ''}" data-pid="${esc(e.id)}" data-kind="${e.kind}"><i class="tl-dot"></i><div class="grow"><b>${esc(eventLabel(e))}</b>
      <small>${fmtShort(e.date)}${e.instructor ? ` · ${esc(e.instructor)}` : ''}${e.academy ? ` · ${esc(e.academy)}` : ''}${e.sample ? ' · sample' : ''}</small>${e.notes ? `<small class="tl-note">${esc(e.notes)}</small>` : ''}</div>
      <span class="tl-took">${e.took ? `<b>${fmtSpan(e.took)}</b><small>after previous</small>` : '<small>start</small>'}</span></button>`).join('');
  v.innerHTML = `${histSeg('belts')}
    ${currentRank() ? beltCard().replace('card tappable', 'card').replace(/<button type="button" class="btn block" data-promo[^>]*>Log promotion<\/button>/, '').replace(/<a class="lnk" href="#\/belts">Timeline ›<\/a>/, '') : ''}
    <button type="button" class="btn primary block" data-promo style="margin-bottom:14px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log promotion</button>
    ${groups.length ? `<div class="timeline" id="timeline">${groups.map(g => { const b = beltOf(g.belt); return `<section class="tl-group ${g.current ? 'current' : ''}" data-belt="${g.belt}" style="--belt:${b[2]}">
      <div class="tl-head">${beltBar(g.belt, g.items[g.items.length-1].stripes, 'mini')}<div class="grow"><b>${esc(b[1])} belt</b><small>${fmtShort(g.start)} – ${g.current ? 'today' : fmtShort(g.end)}</small></div>
        <div class="tl-dur"><b data-span>${fmtSpan(g.span)}</b><small>${g.current ? 'so far' : 'at this belt'}</small></div></div>
      ${g.mat.n ? `<div class="tl-meta">${g.mat.n} session${g.mat.n > 1 ? 's' : ''} · ${hrs(g.mat.min)} h on the mat logged</div>` : ''}
      <div class="tl-items">${items(g)}</div>${(() => { const miss = missingStripes(g.belt), top = Math.max(0, ...g.items.filter(e => e.kind === 'stripe').map(e => e.stripes)), n = miss[0] || (top < maxStripes(g.belt) ? top + 1 : 0);
        return n ? `<button type="button" class="btn sm ghost addstripe" data-addstripe="${g.belt}" data-n="${n}">+ ${miss.length ? 'Add missing' : 'Add'} ${g.belt === 'black' ? 'degree' : 'stripe'} ${n} date</button>` : ''; })()}</section>`; }).join('')}</div>
      <div class="hint" style="text-align:center;margin-top:8px">Tap a belt or stripe to change its date or delete it. Add past belts and stripes in any order; they're sorted by date. A new belt starts at 0 stripes.</div>`
    : `<div class="empty" style="padding:30px 10px">No promotions yet. Log your current belt (and past ones if you like) to see your journey.</div>`}`;
  wireBelt(v);
}

/* ---------------- disciplines ---------------- */
const CATS = {
  grappling:{ label:'Grappling', sub:'BJJ, Wrestling, Judo', color:'#F2711C', dur:60, discLabel:'Sport', disc:[['bjj','BJJ'],['wrestling','Wrestling'],['judo','Judo'],['sambo','Sambo'],['subgrappling','Submission grappling']],
    icon:'<path d="M8 4a2 2 0 1 0 0 .1M16 4a2 2 0 1 0 0 .1M5 21l2-7-3-3 4-4h8l4 4-3 3 2 7M9 11l3 2 3-2"/>' },
  striking:{ label:'Striking', sub:'Boxing, Muay Thai, Kickboxing', color:'#F5C542', dur:60, discLabel:'Style', disc:[['boxing','Boxing'],['muaythai','Muay Thai'],['kickboxing','Kickboxing'],['karate','Karate/Taekwondo'],['other','Other']],
    icon:'<path d="M6 10a5 5 0 0 1 5-5h3a4 4 0 0 1 4 4v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM8 18v3h8v-3M9.5 10.5h5.5"/>' },
  mma:{ label:'MMA', sub:'Striking + grappling', color:'#E5484D', dur:60, disc:[['mma','MMA']],
    icon:'<path d="M4 20l6-6M14 10l6-6M15 4h5v5M9 20H4v-5M8 8l8 8"/>' },
  weights:{ label:'Weights', color:'#8FB0D9', dur:60, disc:[['strength','Strength']],
    icon:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>' },
  cardio:{ label:'Cardio', color:'#6FD3A8', dur:30, disc:[['run','Run'],['bike','Bike'],['row','Row'],['swim','Swim'],['rope','Jump rope'],['other','Other']],
    icon:'<path d="M3 12h4l2-5 4 10 2-5h6"/>' },
  mobility:{ label:'Mobility', sub:'Yoga, stretching, foam rolling', color:'#B48CF2', dur:20, discLabel:'Session type', disc:[['yoga','Yoga'],['stretch','Stretching'],['foam','Foam rolling'],['flow','Mobility flow'],['recovery','Recovery/other']],
    icon:'<path d="M12 5a2 2 0 1 0 0-.1M4 10c3 1 5 1 8 1s5 0 8-1M12 11v4l-4 6M12 15l4 6"/>' }
};
const CAT_KEYS = Object.keys(CATS);
const STRIKE_TECH = ['Jab','Cross','Lead hook','Rear hook','Uppercut','Teep','Roundhouse kick','Low kick','Body kick','Head kick','Knee','Elbow','Clinch','Check kick','Slip & counter','Roll under','Parry','Footwork','Head movement','1-2-3','Jab-cross-low kick','Level change','Cage work'];
const STRIKE_MIX = [['shadow','Shadow'],['pads','Pads'],['bag','Bag'],['drills','Drills'],['sparring','Sparring']];
const MMA_MIX = [['pads','Pad work'],['drills','Drilling'],['sparring','Sparring'],['grappling','Grappling rounds']];
const MIX_KEYS = [...new Set(STRIKE_MIX.concat(MMA_MIX).map(x => x[0]))];
const mixOf = c => c === 'mma' ? MMA_MIX : STRIKE_MIX;
const FOCUS = [['hips','Hips'],['hamstrings','Hamstrings'],['shoulders','Shoulders'],['back','Back'],['neck','Neck'],['ankles','Ankles'],['full','Full body']];
const COMBAT = c => c === 'grappling' || c === 'striking' || c === 'mma';
const EXERCISES = ['Back squat','Front squat','Bench press','Incline bench press','Deadlift','Romanian deadlift','Trap bar deadlift','Overhead press','Barbell row','Pull-up','Chin-up','Dip','Lat pulldown','Cable row','Hip thrust','Bulgarian split squat','Lunge','Leg press','Kettlebell swing','Turkish get-up','Farmer carry','Power clean','Bicep curl','Tricep extension','Face pull','Neck curl','Plank','Push-up'];
const catOf = s => CATS[s.category] ? s.category : 'grappling';
const discLabel = s => { const c = CATS[catOf(s)]; return (c.disc.find(d => d[0]===s.discipline) || c.disc[0])[1]; };
const enabled = k => { if (k === 'supps') return false; const e = db.profile.enabled || {}; return k in e ? !!e[k] : (k === 'grappling' || k === 'food'); };
const SECTION_KEYS = () => CAT_KEYS.concat(['weight','food']);
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
  const disc = CATS[cat].disc.some(d => d[0]===s.discipline) ? s.discipline : CATS[cat].disc[0][0];
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
  const fuel = $('.tabbar a[data-tab="food"]'); if (!fuel) return;
  if (!enabled('food')) { fuel.href = '#/stats'; fuel.dataset.tab = 'food'; fuel.querySelector('span').textContent = 'Stats'; fuel.dataset.mode = 'stats'; }
  else { fuel.href = '#/food'; fuel.querySelector('span').textContent = 'Food'; fuel.dataset.mode = 'fuel'; }
}

/* first-run: step 1 what you train, step 2 goals for only what was picked (all optional) */
let setupPick = null;
function viewSetup(step = 1){
  document.body.classList.add('setup-mode');
  setHeader('');
  const v = $('#view'), pick = setupPick || (setupPick = { grappling:true, striking:false, mma:false, mobility:false, weights:false, cardio:false, food:true, weight:false });
  if (step === 2) return viewSetupGoals();
  v.innerHTML = `<div class="welcome setup"><img class="lockup" src="brand/forged/wordmark.svg" alt="Forged: for the fight" width="926" height="327">
    <div class="stepper-dots" id="setupStep" aria-label="Step 1 of 2"><i class="on"></i><i></i><span>Step 1 of 2</span></div>
    <h2>What do you train?</h2><p>Pick all that apply. You can change this any time in Profile.</p>
    <div class="tiles" id="catTiles">${CAT_KEYS.map(k => `<button type="button" class="tile" data-k="${k}" aria-pressed="false"><svg viewBox="0 0 24 24">${CATS[k].icon}</svg><b>${CATS[k].label}</b><small>${CATS[k].sub || CATS[k].disc.map(d=>d[1]).slice(0,3).join(', ')}</small></button>`).join('')}</div>
    <h3>Also track</h3>
    <div class="tiles two" id="extraTiles"><button type="button" class="tile" data-k="food"><b>Food</b><small>Calories &amp; protein</small></button><button type="button" class="tile" data-k="weight"><b>Weight goal</b><small>Lose or gain</small></button></div>
    <button class="btn primary block" id="go" style="margin-top:18px">Next: set your goals</button>
    <button class="btn block ghost" id="loadSample" style="margin-top:10px">Load sample data (demo)</button></div>`;
  const sync = () => v.querySelectorAll('.tile').forEach(b => { b.classList.toggle('on', !!pick[b.dataset.k]); b.setAttribute('aria-pressed', !!pick[b.dataset.k]); });
  v.querySelectorAll('.tile').forEach(b => b.onclick = () => { pick[b.dataset.k] = !pick[b.dataset.k]; if (!CAT_KEYS.some(k => pick[k])) pick.grappling = true; sync(); });
  sync();
  $('#go').onclick = () => { db.profile = { ...db.profile, enabled:{ ...pick } }; viewSetup(2); window.scrollTo(0, 0); };
  $('#loadSample').onclick = () => { setupPick = null; loadSample(); };
}
function viewSetupGoals(){
  const v = $('#view'), pick = setupPick, cats = CAT_KEYS.filter(k => pick[k]);
  let wu = unit(), target = Number(db.profile.challengeTarget) || 8; const sch = {};
  v.innerHTML = `<div class="welcome setup goals"><div class="setup-top"><button type="button" class="backbtn" id="setupBack" aria-label="Back to step 1"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><span>Back</span></button>
    <div class="stepper-dots" id="setupStep" aria-label="Step 2 of 2"><i class="on"></i><i class="on"></i><span>Step 2 of 2</span></div></div>
    <h2>Set your goals</h2><p>Everything here is optional. You can change it any time in Profile.</p><div id="goalForm" style="text-align:left"></div>
    <button class="btn primary block" id="setupDone" style="margin-top:18px">Done</button>
    <button type="button" class="lnk skip" id="skipGoals">Skip for now</button></div>`;
  const F = $('#goalForm'), sec = (t, hint) => { const c = h(`<div class="card goalsec"><h2>${esc(t)}</h2>${hint ? `<div class="hint" style="margin:-6px 0 10px">${esc(hint)}</div>` : ''}</div>`); F.appendChild(c); return c; };
  const inp = (id, ph, mode='decimal') => h(`<input class="input" type="text" inputmode="${mode}" placeholder="${esc(ph)}" id="${id}">`);
  let wNow, wGoal, wDate, tIn = {}, water;
  if (pick.weight) { const c = sec('Weight goal');
    c.appendChild(field('Units', seg([['lb','lb'],['kg','kg']], wu, x => { wu = x; const l = $('#setupWater')?.closest('.field')?.querySelector('label'); if (l) { l.textContent = `Water (${x === 'kg' ? 'ml' : 'oz'})`; $('#setupWater').placeholder = x === 'kg' ? 'e.g. 2500' : 'e.g. 96'; } })));
    wNow = inp('setupW', 'Today'); wGoal = inp('setupGoal', 'Target'); wDate = h(`<input class="input" type="date" id="setupGoalDate" min="${today()}">`);
    const g = h('<div class="grid2"></div>'); g.appendChild(field('Current weight', wNow)); g.appendChild(field('Goal weight', wGoal)); c.appendChild(g); c.appendChild(field('Goal date (optional)', wDate));
    wNow.oninput = () => { const w = num(wNow.value); if (tIn.p) tIn.p.placeholder = w ? `e.g. ${Math.round(w * (wu === 'kg' ? 2.2 * .9 : .9))}` : 'e.g. 160'; }; }
  if (pick.food) { const c = sec('Daily nutrition', 'Rough guide: protein ≈ 0.8–1 g per lb of body weight (1.8–2.2 g per kg).'), g = h('<div class="grid2"></div>');
    [['cal','Calories','e.g. 2400'],['p','Protein (g)','e.g. 160'],['c','Carbs (g)','e.g. 250'],['f','Fat (g)','e.g. 75']].forEach(([k, l, ph]) => { tIn[k] = inp(`setupT-${k}`, ph, 'numeric'); g.appendChild(field(l, tIn[k])); });
    water = inp('setupWater', waterMetric() ? 'e.g. 2500' : 'e.g. 96'); g.appendChild(field(`Water (${waterU()})`, water)); c.appendChild(g); }
  const sgIn = {}; let sgDate;
  if (pick.weights) { const c = sec('Strength goals', 'PR targets. Leave any blank. Lifts count your est. 1RM (change in Profile).'), g = h('<div class="grid2"></div>'), lu = () => (pick.weight ? wu : unit());
    [['bench','Bench press', 'e.g. 225'],['squat','Squat','e.g. 315'],['deadlift','Deadlift','e.g. 405'],['ohp','Overhead press','e.g. 135'],['pullups','Pull-ups (reps)','e.g. 15'],['pushups','Push-ups (reps)','e.g. 50'],['hang','Dead hang (sec)','e.g. 90']].forEach(([k, l, ph]) => {
      sgIn[k] = inp(`setupSG-${k}`, ph); g.appendChild(field(sgKindOf(k) === 'lift' ? `${l} (${lu()})` : l, sgIn[k])); });
    sgDate = h(`<input class="input" type="date" min="${today()}" id="setupSGDate">`); g.appendChild(field('Target date', sgDate)); c.appendChild(g); }
  { const c = sec('Monthly workout goal', 'Total workouts per month, any type (BJJ, weights, cardio, etc.). Fills the ring on Home.');
    c.appendChild(stepper(target, { min:1, max:31, unitLabel:'/ month', onChange:x => target = x })); }
  { const c = sec('Usual training days', 'Tap the days you normally train. Home shows planned vs done.');
    cats.forEach(k => { const row = h(`<div class="schedrow"><span>${catDot(k)}${CATS[k].label}</span><div class="daypick" role="group">${DOW_MON.map(d => `<button type="button" data-d="${d}" aria-pressed="false" aria-label="${CATS[k].label} ${DOW[d]}">${DOW1[d]}</button>`).join('')}</div></div>`);
      sch[k] = []; row.querySelectorAll('button').forEach(b => b.onclick = () => { const d = Number(b.dataset.d); sch[k] = sch[k].includes(d) ? sch[k].filter(x => x !== d) : sch[k].concat(d).sort(); b.classList.toggle('on', sch[k].includes(d)); b.setAttribute('aria-pressed', sch[k].includes(d)); });
      c.appendChild(row); }); }
  let cName, cDate;
  { const c = sec('Next competition (optional)'); cName = h(`<input class="input" type="text" autocapitalize="words" placeholder="e.g. City Open" id="setupComp">`); cDate = h(`<input class="input" type="date" min="${today()}" id="setupCompDate">`);
    const g = h('<div class="grid2"></div>'); g.appendChild(field('Name', cName)); g.appendChild(field('Date', cDate)); c.appendChild(g); }
  const finish = saveGoals => {
    db.profile = { ...db.profile, enabled:{ ...pick }, setupDone:true };
    if (saveGoals) {
      if (pick.weight) { const now = num(wNow.value), gw = num(wGoal.value); db.profile.unit = wu;
        if (now) { db.weights.push({ id:uid(), date:today(), w:r1(now), u:wu, createdAt:Date.now() }); db.profile.startWeight = String(r1(now)); }
        if (gw) db.profile.goalWeight = String(r1(gw)); if (wDate.value) db.profile.goalDate = wDate.value; }
      if (pick.food) { const t = {}; Object.entries(tIn).forEach(([k, i]) => { const n = Math.round(num(i.value)); if (n > 0) t[k] = n; }); if (Object.keys(t).length) db.profile.targets = t;
        const ml = num(water.value) ? toMl(water.value) : 0; if (ml >= 250 && ml <= 10000) db.profile.waterGoal = Math.round(ml); }
      if (pick.weights) { const u0 = pick.weight ? wu : unit(); Object.entries(sgIn).forEach(([k, i]) => { const t = num(i.value); if (t > 0) db.strength.push(sanitizeStrength([{ id:uid(), key:k, target:t, u:u0, date:sgDate.value, createdAt:Date.now() }])[0]); }); }
      db.profile.challengeTarget = target;
      const sc = Object.fromEntries(Object.entries(sch).filter(([, a]) => a.length)); if (Object.keys(sc).length) db.profile.schedule = sc;
      if (cName.value.trim() && isoOk(cDate.value)) db.comps.push(sanitizeComps([{ id:uid(), name:cName.value.trim(), date:cDate.value, sport:pick.grappling ? 'BJJ' : pick.mma ? 'MMA' : pick.striking ? 'Muay Thai' : 'Other', createdAt:Date.now() }])[0]);
    }
    setupPick = null; save(); toast(saveGoals ? 'All set. Tap + to log a workout' : 'All set. Set goals any time in Profile'); route();
  };
  $('#setupBack').onclick = () => { viewSetup(1); window.scrollTo(0, 0); };
  $('#setupDone').onclick = () => finish(true);
  $('#skipGoals').onclick = () => finish(false);
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
  if (!db.profile.setupDone && !db.sessions.length) return viewSetup();
  setHeader('');
  const v = $('#view');
  const st = periodStats(), streak = weekStreak();
  const hasSample = hasSampleData();
  v.innerHTML = `
    ${hasSample ? `<div class="banner"><span>📋 <b>Sample data</b> is loaded for the demo.</span><button class="btn sm" id="rmSample">Remove</button></div>` : ''}
    ${rankChip()}
    <div class="statrow three">
      <div class="stat hero"><div class="v">${st.week}</div><div class="l">Sessions this week</div></div>
      <div class="stat"><div class="v">${hrs(st.weekMin)}<small>h</small></div><div class="l">Hours this week</div></div>
      <div class="stat"><div class="v">${streak}<small>wk</small></div><div class="l">Week streak 🔥</div></div>
    </div>
    ${compCard()}
    ${injuryCards()}
    ${weekCard()}
    ${challengeHome()}
    ${progCard()}
    ${strengthHomeLine()}
    <div class="card quick"><h2>Quick log</h2>${repeatButtons() || '<div class="empty" style="padding:2px 0 10px">Your recent workouts will show here for one-tap logging.</div>'}
      <a class="btn primary block" href="#/log" id="homeLog"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log a workout</a></div>
    ${enabled('weight') ? weightCard() : ''}
    ${enabled('food') ? nutritionCard() : ''}
    ${enabled('grappling') ? beltCard() : ''}
    <a class="btn block" href="#/stats" id="seeStats">See all stats ›</a>`;
  wireRepeat(v); wireWeight(v); wireBelt(v); wireComps(v); wireInjuries(v); wireProg(v);
  v.querySelectorAll('.tappable[data-comp]').forEach(c => c.onclick = e => { if (!e.target.closest('a,button')) compSheet(c.dataset.comp); });
  const rm = $('#rmSample'); if (rm) rm.onclick = removeSample;
  checkChallenge();
  gameCheck();
}

function sessSub(s){
  const c = catOf(s), rolls = s.rolls||[];
  if (c === 'cardio' && s.cardio) { const k = s.cardio; const bits = [k.distance ? `${r1(k.distance)} ${k.unit}` : '', k.sec ? fmtDur(k.sec) : `${s.duration} min`, s.discipline === 'bike' ? speedStr(k.sec, k.distance, k.unit) : paceStr(k.sec, k.distance, k.unit)]; return bits.filter(Boolean).join(' · '); }
  if (c === 'weights') { const ex = s.exercises||[]; return [`${s.duration} min`, ex.length ? `${ex.length} exercise${ex.length>1?'s':''}` : '', volumeOf(s) ? `${Math.round(volumeOf(s)).toLocaleString()} ${unit()} vol` : ''].filter(Boolean).join(' · '); }
  if (c === 'striking' || c === 'mma') { const m = s.strike?.mix || {}; return [`${s.duration} min`, s.rounds ? `${s.rounds} rds${s.strike ? ` × ${s.strike.roundLen} min` : ''}` : '', m.sparring ? `${m.sparring} sparring` : ''].filter(Boolean).join(' · '); }
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

function hrBlock(hr){
  if (!hr) return '';
  const z = hr.zones || [], tot = z.reduce((a,x) => a + (Number(x)||0), 0), cols = ['#5b8def','#6fd3a8','#f5b83d','#ff9a3c','#DC141F'];
  return `<div class="card"><h2>Heart rate</h2><div class="kv" style="margin-bottom:${tot?10:0}px"><div><b>${hr.avg||'—'}</b><span>Avg bpm</span></div><div><b>${hr.max||'—'}</b><span>Max bpm</span></div><div><b>${hr.cal||'—'}</b><span>kcal</span></div></div>
    ${tot ? `<div class="split">${z.map((x,i) => `<i style="width:${(Number(x)||0)/tot*100}%;background:${cols[i]}"></i>`).join('')}</div><div class="split-l zl">${z.map((x,i) => `<span><i style="background:${cols[i]}"></i>Z${i+1} ${r1(Number(x)||0)}m</span>`).join('')}</div>` : ''}</div>`;
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
  if (c === 'striking' || c === 'mma') { const m = s.strike?.mix || {}; body = `<div class="card"><h2>Rounds <small>${s.rounds||0} × ${s.strike?.roundLen||3} min</small></h2><div class="mix">${mixOf(c).map(([k,l]) => `<div><b>${m[k]||0}</b><span>${l}</span></div>`).join('')}</div></div>
    ${(s.strike?.spar||[]).length ? `<div class="card"><h2>Sparring notes</h2>${s.strike.spar.map(x => `<div class="list-row"><div class="grow"><b>${esc(x.partner||'Partner')}</b><small style="white-space:pre-wrap">${esc(x.notes)}</small></div></div>`).join('')}</div>` : ''}
    ${chipCard(s.techniques, c === 'mma' ? 'Striking techniques' : 'Worked on')}${c === 'mma' ? chipCard(s.gtech, 'Grappling techniques') : ''}`; }
  if (c === 'mobility') body = chipCard((s.focus||[]).map(k => (FOCUS.find(f => f[0] === k)||[k,k])[1]), 'Focus areas');
  if (c === 'weights') { const prs = prMap(s.id); body = `<div class="card"><h2>Exercises <small>${Math.round(volumeOf(s)).toLocaleString()} ${unit()} volume</small></h2>${(s.exercises||[]).length ? s.exercises.map(e => { const best = Math.max(0, ...e.sets.map(x => e1rm(Number(x.weight)||0, Number(x.reps)||0))); const pr = best && best > (prs[e.name.toLowerCase()]?.e1 || 0); return `<div class="ex-view"><div class="t"><b>${esc(e.name)}</b>${pr ? '<span class="pill pr">PR</span>' : ''}</div><div class="sets">${e.sets.map((x,i) => `<span>${i+1}. ${x.reps||0} × ${x.weight||0}${x.rpe!==''&&x.rpe!=null?` @${x.rpe}`:''}</span>`).join('')}</div></div>`; }).join('') : '<div class="empty" style="padding:4px 0">No exercises logged</div>'}</div>`; }
  if (c === 'cardio' && s.cardio) { const k = s.cardio; body = `<div class="kv"><div><b>${k.distance ? r1(k.distance) : '—'}<small style="font-size:13px;color:var(--muted)"> ${k.unit}</small></b><span>Distance</span></div><div><b>${k.sec ? fmtDur(k.sec) : s.duration+'m'}</b><span>Time</span></div><div><b>${(s.discipline==='bike' ? speedStr(k.sec,k.distance,k.unit) : paceStr(k.sec,k.distance,k.unit)) || '—'}</b><span>${s.discipline==='bike'?'Speed':'Pace'}</span></div></div>`; }
  $('#view').innerHTML = `
    <div class="sess-meta">${catDot(c)}${CATS[c].label} · ${fmtDate(s.date)} ${c==='grappling'&&s.discipline==='bjj' ? `<span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>` : ''}${s.sample?'<span class="pill sample">Sample</span>':''}${s.source?`<span class="pill">📎 ${esc(s.source)}</span>`:''}</div>
    <div class="kv"><div><b>${s.duration}<small style="font-size:13px;color:var(--muted)"> min</small></b><span>Duration</span></div><div><b>${c==='weights'||c==='cardio'||c==='mobility' ? loadOf(s) : (s.rounds||0)}</b><span>${c==='weights'||c==='cardio'||c==='mobility' ? 'Load' : 'Rounds'}</span></div><div><b data-effort>${rpeOf(s)}/10</b><span>Effort${s.rpe ? '' : ' (est.)'}</span></div></div>
    ${s.feel ? `<div class="card feelrow" style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--muted);font-weight:650">Felt</span><b style="font-size:20px" data-feel>${FEELS[s.feel-1][1]} ${FEELS[s.feel-1][2]}</b></div>` : ''}
    ${s.prog && tmplOf(s.prog.tid) ? `<div class="sess-meta" style="margin-top:-4px">🏋️ ${esc(tmplOf(s.prog.tid).name)} · week ${s.prog.w}</div>` : ''}
    ${body}${hrBlock(s.hr)}
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
  return { id:null, date:today(), category:cat, discipline:last?.discipline || CATS[cat].disc[0][0], gi:last?.gi || 'gi', type:'class',
    duration:last?.duration || CATS[cat].dur, rounds:cat==='grappling' ? 5 : (cat==='striking' || cat==='mma') ? (last?.rounds||6) : 0, intensity:3, rpe:'', feel:'', techniques:[], gtech:[], focus:[], rolls:[], weight:'', notes:'',
    strike:{ roundLen:last?.strike?.roundLen || (cat === 'mma' ? 5 : 3), mix:Object.fromEntries(mixOf(cat).map(([k]) => [k, 0])), spar:[] },
    exercises:[], cardio:{ distance:'', unit:distU(), sec:0 }, hr:{ avg:'', max:'', cal:'', zones:['','','','',''] }, _open:false };
}
function hydrate(s){
  const b = blankSession(catOf(s)), f = JSON.parse(JSON.stringify(s));
  f.strike = f.strike ? { ...b.strike, ...f.strike, mix:{ ...b.strike.mix, ...(f.strike.mix||{}) }, spar:f.strike.spar||[] } : b.strike;
  f.gtech = f.gtech || []; f.focus = f.focus || []; f.rpe = f.rpe || ''; f.feel = f.feel || '';
  f.exercises = f.exercises || []; f.cardio = f.cardio || b.cardio; f.hr = f.hr ? { ...b.hr, ...f.hr, zones:f.hr.zones||b.hr.zones } : b.hr;
  f._open = true; return f;
}
function toRecord(f){
  const c = f.category, out = { ...f };
  delete out._open; delete out._durTouched;
  if (c !== 'grappling') { out.rolls = []; }
  if (c !== 'striking' && c !== 'mma') delete out.strike; else out.strike = { ...f.strike, mix:Object.fromEntries(mixOf(c).map(([k]) => [k, Number(f.strike.mix[k])||0])) };
  if (c !== 'mma' || !f.gtech.length) delete out.gtech;
  if (c !== 'mobility' || !f.focus.length) delete out.focus;
  if (c === 'mobility') out.techniques = [];
  if (c === 'striking' || c === 'mma') out.rounds = Math.max(Number(f.rounds)||0, mixOf(c).reduce((a,[k]) => a + (Number(f.strike.mix[k])||0), 0));
  if (c !== 'weights') delete out.exercises; else out.exercises = f.exercises.map(e => ({ ...e, sets:e.sets.filter(x => x.reps !== '' || x.weight !== '') }));
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
  } else if (!form || form.id) { form = blankSession(); formBase = null; }
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
  if (C.disc.length > 1) { const ds = seg(C.disc, f.discipline, x => { f.discipline = x; if (f.category === 'grappling') redraw(); }, C.disc.length > 4); if (C.disc.length > 4) ds.classList.add('three'); v.appendChild(field(C.discLabel || (f.category === 'cardio' ? 'Activity' : 'Style'), ds)); }
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
  const imp = h(`<div class="field"><label>Import from device</label><label class="btn block" for="wkFile"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>GPX · TCX · FIT · CSV</label><input type="file" id="wkFile" accept=".gpx,.tcx,.fit,.csv,application/gpx+xml,application/vnd.garmin.tcx+xml,text/csv" hidden>${f.source ? `<div class="hint">📎 ${esc(f.source)}</div>` : '<div class="hint">Fills in date, time, distance, heart rate and calories from a watch or app export.</div>'}</div>`);
  imp.querySelector('#wkFile').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { const r = await parseWorkoutFile(file); applyImport(f, r, file.name); toast('Workout file imported'); redraw(); } catch(err) { console.warn(err); toast(`Couldn't read that file`); } };
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
  if (f.category === 'weights') { D.appendChild(exerciseEditor(f)); placeNotes(); }
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
  // body weight + notes
  const wt = h(`<div class="stepper" style="padding-left:14px"><input type="text" inputmode="decimal" placeholder="Optional" value="${esc(f.weight)}" style="text-align:left;font-weight:600"><span class="unit" style="padding-right:16px">${unit()}</span></div>`);
  const wi = wt.querySelector('input'); wi.oninput = () => { f.weight = wi.value.replace(/[^\d.]/g,''); };
  const lastW = weightSeries().pop();
  D.appendChild(field('Body weight', wt, lastW ? `Last: ${lastW.w} ${unit()} on ${fmtShort(lastW.date)}` : 'Track your weight alongside training'));
  D.appendChild(imp);
  // heart rate
  const hr = f.hr, hrEl = h(`<div class="hrbox"><div class="grid3"></div><div class="label sect" style="margin-top:10px">Minutes in zone</div><div class="zones"></div></div>`);
  [['avg','Avg HR'],['max','Max HR'],['cal','Calories']].forEach(([k2,l]) => { const i = h(`<input class="input num" type="text" inputmode="numeric" placeholder="—" value="${esc(hr[k2])}" data-hr="${k2}">`); i.oninput = () => hr[k2] = i.value.replace(/[^\d.]/g,''); hrEl.querySelector('.grid3').appendChild(field(l, i)); });
  hr.zones.forEach((z,i) => { const inp = h(`<input class="input num" type="text" inputmode="decimal" placeholder="—" value="${esc(z)}" aria-label="Zone ${i+1} minutes" data-z="${i}">`); inp.oninput = () => hr.zones[i] = inp.value.replace(/[^\d.]/g,''); const w = h(`<div class="z"><span>Z${i+1}</span></div>`); w.appendChild(inp); hrEl.querySelector('.zones').appendChild(w); });
  D.appendChild(field('Heart rate', hrEl));
  v.appendChild(det);

  const actions = h(`<div class="actions">${editing ? '<button type="button" class="btn danger" data-del style="flex:0 0 auto">Delete</button>' : ''}<button type="button" class="btn primary" data-save>${editing ? 'Save changes' : 'Save workout'}</button></div>`);
  actions.querySelector('[data-save]').onclick = () => {
    const w = String(f.weight||'').trim();
    if (w && (isNaN(Number(w)) || Number(w) <= 0)) { toast('Weight should be a number'); return; }
    if (!f.duration && !(f.category==='cardio' && f.cardio.sec)) { toast('Add a duration'); return; }
    const rec = sanitizeSession({ ...toRecord(f), weight: w ? Math.round(Number(w)*10)/10 : '', updatedAt: Date.now() });
    if (editing) { const i = db.sessions.findIndex(x => x.id === f.id); rec.sample = false; db.sessions[i] = rec; }
    else { rec.id = uid(); rec.createdAt = Date.now(); db.sessions.push(rec); }
    save(); form = null;
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

function exMeta(e){
  const L = e.plan && PROG.library[e.name]; if (!L) return '';
  const tgt = `${e.plan.sets} × ${e.plan.lo === e.plan.hi ? e.plan.lo : `${e.plan.lo}–${e.plan.hi}`}${e.plan.unit === 'sec' ? ' s' : e.plan.unit === 'm' ? ' m' : ''}${L.each ? ' each' : ''}`;
  const sg = e._sugg === 'up' ? ' · <b class="up">↑ progress</b>' : e._sugg === 'repeat' ? ' · repeat last' : '';
  return `<div class="excue"><div class="grow"><span>${esc(L.cue)}</span><small>Target ${tgt}${e._rest ? ` · rest ${esc(e._rest)}` : ''}${sg}</small></div><button type="button" class="btn sm" data-swap>Swap</button></div>`;
}
function exerciseEditor(f){
  const wrap = h(`<div class="field"><div class="label" style="display:flex;justify-content:space-between">Exercises <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:600" id="volSum"></span></div><div class="exlist"></div><button type="button" class="btn block" id="addEx"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add exercise</button></div>`);
  const list = wrap.querySelector('.exlist');
  const known = () => uniqueMerge(countBy(db.sessions.flatMap(s => (s.exercises||[]).map(e => e.name))).map(x => x[0]), EXERCISES);
  const prs = prMap(f.id);
  const drawSum = () => { const v = f.exercises.reduce((a,e) => a + e.sets.reduce((b,x) => b + num(x.reps)*num(x.weight), 0), 0); wrap.querySelector('#volSum').textContent = v ? `${Math.round(v).toLocaleString()} ${unit()} volume` : 'Optional'; };
  const draw = () => {
    list.innerHTML = '';
    f.exercises.forEach((e, ei) => {
      const card = h(`<div class="excard"><div class="exhead"><input class="input exname" type="text" autocapitalize="words" autocomplete="off" placeholder="Exercise" value="${esc(e.name)}"><button type="button" class="iconbtn big" aria-label="Remove exercise"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div><div class="sugg"></div>${exMeta(e)}
        <div class="sethead"><span>Set</span><span>Reps</span><span>${unit()}</span><span>RPE</span><span></span></div><div class="sets"></div><div class="exfoot"><button type="button" class="btn sm" data-addset>+ Add set</button><span class="prnote"></span></div></div>`);
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
        const row = h(`<div class="setrow"><span>${si+1}</span><input class="input" type="text" inputmode="numeric" value="${esc(x.reps)}" aria-label="Reps" data-f="reps"><input class="input" type="text" inputmode="decimal" value="${esc(x.weight)}" aria-label="Weight" data-f="weight"><input class="input" type="text" inputmode="decimal" value="${esc(x.rpe)}" placeholder="—" aria-label="RPE" data-f="rpe"><button type="button" class="iconbtn" aria-label="Remove set"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`);
        row.querySelectorAll('input').forEach(i => i.oninput = () => { x[i.dataset.f] = i.value.replace(/[^\d.]/g,''); drawSum(); drawPR(); });
        row.querySelector('button').onclick = () => { e.sets.splice(si,1); drawSets(); drawSum(); drawPR(); };
        setsEl.appendChild(row); }); };
      card.querySelector('[data-addset]').onclick = () => { const l = e.sets[e.sets.length-1]; e.sets.push(l ? { ...l } : { reps:'', weight:'', rpe:'' }); drawSets(); drawSum(); const ins = setsEl.querySelectorAll('.setrow:last-child input'); ins[0] && ins[0].focus(); };
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
  db.sessions.forEach(s => { if (s.date >= from && s.date <= today()) m[catOf(s)] += Number(s.duration)||0; });
  return m;
}
function catBreakdown(){
  const m30 = catHours(30), wk = Object.fromEntries(CAT_KEYS.map(k => [k, 0])), ws = iso(weekStart(new Date()));
  db.sessions.forEach(s => { if (s.date >= ws && s.date <= today()) wk[catOf(s)] += Number(s.duration)||0; });
  const tot = Object.values(m30).reduce((a,b) => a+b, 0);
  const keys = CAT_KEYS.filter(k => m30[k] || wk[k] || enabled(k));
  return `<div class="card" id="catCard"><h2>Hours by type <small>last 30 days</small></h2>
    ${tot ? `<div class="split">${keys.map(k => `<i style="width:${m30[k]/tot*100}%;background:${CATS[k].color}"></i>`).join('')}</div>` : '<div class="empty" style="padding:2px 0">No workouts in the last 30 days.</div>'}
    <div class="catrows">${keys.map(k => `<div class="list-row"><div class="grow">${catDot(k)}<b style="display:inline">${CATS[k].label}</b></div><span class="cv"><b>${hrs(m30[k])}</b> h<small>30 days</small></span><span class="cv"><b>${hrs(wk[k])}</b> h<small>this week</small></span></div>`).join('')}</div></div>`;
}
function prCard(){
  const m = prMap(), list = Object.values(m).filter(p => p.e1).sort((a,b) => b.date.localeCompare(a.date) || b.e1 - a.e1).slice(0,6);
  if (!list.length) return '';
  const recent = iso(addDays(new Date(), -14));
  return `<div class="card" id="prCard"><h2>Weights PRs <small>best set · est. 1RM</small></h2>${list.map(p => `<div class="list-row"><div class="grow"><b>${esc(p.name)}</b><small>${p.w} ${unit()} × ${p.r} · ${fmtShort(p.date)}</small></div>${p.date >= recent ? '<span class="pill pr">New</span>' : ''}<span class="cv"><b>${Math.round(p.e1)}</b><small>est. 1RM</small></span></div>`).join('')}</div>`;
}
function cardioCard(){
  const list = db.sessions.filter(s => catOf(s) === 'cardio' && s.cardio);
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
  if (!db.sessions.length) { v.innerHTML = `<div class="empty" style="padding:40px 10px">Log a few workouts to see your stats.<br><br><a class="btn primary" href="#/log">Log a workout</a></div>${benchCard()}${enabled('weight') || weightSeries().length ? weightStatsCard() : ''}`; wireWeight(v); wireBench(v); return; }
  const st = periodStats(), weeks = weeklyHours(12), ws = weightSeries();
  const avg = weeks.slice(0,-1).reduce((a,w) => a+w.min, 0) / 60 / Math.max(1, weeks.length-1);
  const avgS = weeks.slice(0,-1).reduce((a,w) => a+w.n, 0) / Math.max(1, weeks.length-1);
  const usedCats = CAT_KEYS.filter(k => db.sessions.some(s => catOf(s) === k));
  v.innerHTML = `
    <div class="statrow">
      <div class="stat"><div class="v">${st.month}</div><div class="l">Sessions in ${MONTHS[new Date().getMonth()]}</div></div>
      <div class="stat"><div class="v">${hrs(st.monthMin)}<small>h</small></div><div class="l">Hours this month</div></div>
      <div class="stat"><div class="v">${hrs(st.totalMin)}<small>h</small></div><div class="l">Total hours</div></div>
      <div class="stat"><div class="v">${st.total}</div><div class="l">Total sessions</div></div>
    </div>
    <div class="card"><h2>Weekly hours <small>avg ${Math.round(avg*10)/10} h · ${Math.round(avgS*10)/10} sessions/wk</small></h2>${barChart(weeks)}<div class="wkcounts">${weeks.map(w => `<span title="${w.key}">${w.n}</span>`).join('')}</div><div class="hint" style="text-align:center;margin-top:2px">Sessions per week (last 12 weeks)</div>
      ${usedCats.length > 1 ? `<div class="split-l legend">${usedCats.map(k => `<span><i style="background:${CATS[k].color}"></i>${CATS[k].label}</span>`).join('')}</div>` : ''}</div>
    ${loadCard()}
    ${catBreakdown()}
    ${benchCard()}
    ${strengthCard()}
    ${prCard()}
    ${cardioCard()}
    ${enabled('weight') || ws.length ? weightStatsCard() : ''}
    ${enabled('food') ? nutritionCard() : ''}
    ${grapplingStats()}
    <div class="card"><h2>Recent <a href="#/history" style="color:var(--accent);text-decoration:none;text-transform:none;letter-spacing:0;font-size:13px">History ›</a></h2>${sorted().slice(0,3).map(sessRow).join('')}</div>
    ${challengeHistory()}
    <div class="foot">${st.total} sessions · ${hrs(st.totalMin)} total hours</div>`;
  wireWeight(v); wireBench(v); wireStrength(v);
}

/* ---------------- workout file import (GPX / TCX / FIT / CSV), fully client-side ---------------- */
const haversine = (a, b) => { const R = 6371008.8, t = Math.PI/180, dLat = (b.lat-a.lat)*t, dLon = (b.lon-a.lon)*t;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
function sportToActivity(s){
  s = String(s||'').toLowerCase();
  if (/run|jog|trail/.test(s)) return 'run'; if (/bik|cycl|ride/.test(s)) return 'bike'; if (/row/.test(s)) return 'row';
  if (/swim/.test(s)) return 'swim'; if (/rope|jump/.test(s)) return 'rope'; return s ? 'other' : '';
}
function hrZones(samples, maxHr){ // samples: [{t(ms), hr}] -> minutes in zones 1-5 (50-60-70-80-90% of max)
  const mx = Number(db.profile.maxHR) || maxHr || 190, z = [0,0,0,0,0];
  for (let i = 1; i < samples.length; i++) { const a = samples[i-1]; if (!a.hr || !samples[i].t || !a.t) continue; const dt = Math.min(30, (samples[i].t - a.t)/1000); if (dt <= 0) continue;
    const p = a.hr / mx; if (p < .5) continue; z[Math.min(4, Math.floor((p - .5) / .1))] += dt; }
  return z.some(x => x > 0) ? z.map(s => r1(s/60)) : null;
}
function summarize({ start, sec, distM, hrs, cal, sport, samples }){
  const valid = hrs.filter(x => x > 0);
  return { date: start ? iso(new Date(start)) : '', sec: Math.round(sec||0), distM: distM || 0,
    avgHr: valid.length ? Math.round(valid.reduce((a,b) => a+b, 0) / valid.length) : null, maxHr: valid.length ? Math.max(...valid) : null,
    cal: cal ? Math.round(cal) : null, activity: sportToActivity(sport), zones: samples && samples.length > 1 ? hrZones(samples, valid.length ? Math.max(...valid) : 0) : null };
}
const byLocal = (el, name) => [...el.getElementsByTagNameNS('*', name)];
const kid = (el, name) => [...el.children].find(c => c.localName === name);
function parseGPX(text){
  const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('Bad GPX');
  const pts = byLocal(doc, 'trkpt').map(p => ({ lat:+p.getAttribute('lat'), lon:+p.getAttribute('lon'), t:Date.parse(kid(p,'time')?.textContent||''), hr:Number(byLocal(p,'hr')[0]?.textContent)||0 }));
  if (!pts.length) throw new Error('No track points');
  let d = 0; for (let i = 1; i < pts.length; i++) d += haversine(pts[i-1], pts[i]);
  const ts = pts.map(p => p.t).filter(Boolean), start = ts.length ? Math.min(...ts) : Date.parse(byLocal(doc,'time')[0]?.textContent||'');
  return summarize({ start, sec: ts.length ? (Math.max(...ts) - Math.min(...ts))/1000 : 0, distM:d, hrs:pts.map(p => p.hr), cal:null, sport:byLocal(doc,'type')[0]?.textContent, samples:pts });
}
function parseTCX(text){
  const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('Bad TCX');
  const act = byLocal(doc, 'Activity')[0]; if (!act) throw new Error('No activity');
  const laps = byLocal(act, 'Lap'); let sec = 0, dist = 0, cal = 0, maxHr = 0, hrW = 0, hrSum = 0;
  laps.forEach(l => { const s = +(kid(l,'TotalTimeSeconds')?.textContent||0); sec += s; dist += +(kid(l,'DistanceMeters')?.textContent||0); cal += +(kid(l,'Calories')?.textContent||0);
    const a = +(kid(l,'AverageHeartRateBpm') && kid(kid(l,'AverageHeartRateBpm'),'Value')?.textContent || 0); if (a) { hrSum += a*s; hrW += s; }
    const m = +(kid(l,'MaximumHeartRateBpm') && kid(kid(l,'MaximumHeartRateBpm'),'Value')?.textContent || 0); maxHr = Math.max(maxHr, m); });
  const tps = byLocal(act, 'Trackpoint').map(tp => ({ t:Date.parse(kid(tp,'Time')?.textContent||''), hr:Number(kid(tp,'HeartRateBpm') && kid(kid(tp,'HeartRateBpm'),'Value')?.textContent)||0 }));
  const start = Date.parse(kid(act,'Id')?.textContent || laps[0]?.getAttribute('StartTime') || '');
  const r = summarize({ start, sec, distM:dist, hrs:tps.map(t => t.hr), cal, sport:act.getAttribute('Sport'), samples:tps });
  if (hrW) r.avgHr = Math.round(hrSum / hrW); if (maxHr) r.maxHr = maxHr;
  return r;
}
/* Minimal FIT decoder: definition/data messages, compressed timestamps, developer fields skipped. Reads session(18) + record(20). */
function parseFIT(buf){
  const dv = new DataView(buf), hs = dv.getUint8(0);
  if (buf.byteLength < 14 || String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11)) !== '.FIT') throw new Error('Not a FIT file');
  const end = Math.min(buf.byteLength, hs + dv.getUint32(4, true)); let p = hs, lastTs = 0; const defs = {}, recs = []; let session = null; const FIT_EPOCH = 631065600;
  const SIZES = { 0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8 };
  const INVALID = { 0:0xFF,1:0x7F,2:0xFF,3:0x7FFF,4:0xFFFF,5:0x7FFFFFFF,6:0xFFFFFFFF,10:0,11:0,12:0 };
  const read = (f, le, at) => { const bt = f.type & 0x1F; if (SIZES[bt] !== f.size) return null; let v;
    switch (bt) { case 0: case 2: case 10: case 13: v = dv.getUint8(at); break; case 1: v = dv.getInt8(at); break; case 3: v = dv.getInt16(at, le); break; case 4: case 11: v = dv.getUint16(at, le); break;
      case 5: v = dv.getInt32(at, le); break; case 6: case 12: v = dv.getUint32(at, le); break; case 8: v = dv.getFloat32(at, le); break; case 9: v = dv.getFloat64(at, le); break; default: return null; }
    return v === INVALID[bt] ? null : v; };
  const msg = def => { const m = {}; let at = p; def.fields.forEach(f => { m[f.num] = read(f, def.le, at); at += f.size; }); p = at + def.dev; return m; };
  const handle = (num, m) => { if (num === 20) recs.push({ t:m[253] != null ? (m[253]+FIT_EPOCH)*1000 : 0, hr:m[3]||0, dist:m[5] }); if (num === 18 && !session) session = m; };
  while (p < end) {
    const hdr = dv.getUint8(p++);
    if (hdr & 0x80) { const def = defs[(hdr >> 5) & 3]; if (!def) break; const off = hdr & 0x1F; let ts = (lastTs & ~0x1F) | off; if (ts < lastTs) ts += 0x20; lastTs = ts; const m = msg(def); m[253] = ts; handle(def.num, m); continue; }
    const lt = hdr & 0x0F;
    if (hdr & 0x40) { p++; const le = dv.getUint8(p++) === 0; const num = dv.getUint16(p, le); p += 2; const nf = dv.getUint8(p++); const fields = [];
      for (let i = 0; i < nf; i++) { fields.push({ num:dv.getUint8(p), size:dv.getUint8(p+1), type:dv.getUint8(p+2) }); p += 3; }
      let dev = 0; if (hdr & 0x20) { const nd = dv.getUint8(p++); for (let i = 0; i < nd; i++) { dev += dv.getUint8(p+1); p += 3; } }
      defs[lt] = { num, le, fields, dev };
    } else { const def = defs[lt]; if (!def) break; const m = msg(def); if (m[253] != null) lastTs = m[253]; handle(def.num, m); }
  }
  const SPORT = { 1:'running', 2:'cycling', 5:'swimming', 15:'rowing', 11:'walking', 17:'hiking' };
  const ts = recs.map(r => r.t).filter(Boolean);
  if (session) { const r = summarize({ start: session[2] != null ? (session[2]+FIT_EPOCH)*1000 : ts[0], sec:(session[8] ?? session[7] ?? 0)/1000, distM:(session[9]||0)/100,
      hrs:recs.map(r => r.hr), cal:session[11], sport:SPORT[session[5]] || (session[5] != null ? 'other' : ''), samples:recs });
    if (session[16]) r.avgHr = session[16]; if (session[17]) r.maxHr = session[17]; return r; }
  if (!recs.length) throw new Error('No FIT data');
  const dists = recs.map(r => r.dist).filter(x => x != null);
  return summarize({ start:ts[0], sec: ts.length ? (Math.max(...ts) - Math.min(...ts))/1000 : 0, distM: dists.length ? Math.max(...dists)/100 : 0, hrs:recs.map(r => r.hr), cal:null, sport:'', samples:recs });
}
function parseCSV(text){
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i+1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',' || c === ';' && !text.slice(0, 200).includes(',')) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim())) rows.push(row); row = []; } else cell += c; }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('CSV needs a header row and data');
  const head = rows[0].map(x => x.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
  return rows.slice(1).map(r => Object.fromEntries(head.map((k,i) => [k, (r[i]||'').trim()])));
}
const pickF = (o, ...keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return ''; };
const hmsToSec = v => { v = String(v||'').trim(); if (!v) return 0; if (/^\d+(\.\d+)?$/.test(v)) return Number(v)*60; const p = v.split(':').map(Number); return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : 0; };
function normDate(v){ v = String(v||'').trim(); let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`; m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) return `${m[3].length===2?'20'+m[3]:m[3]}-${pad(+m[1])}-${pad(+m[2])}`; const t = Date.parse(v); return isNaN(t) ? '' : iso(new Date(t)); }
function csvRowToSession(o){
  const date = normDate(pickF(o, 'date', 'day', 'start_time', 'start', 'activity_date')); if (!date) return null;
  const rawCat = pickF(o, 'category', 'workout', 'type', 'workout_type').toLowerCase(), rawDisc = pickF(o, 'discipline', 'activity', 'activity_type', 'sport', 'style').toLowerCase();
  let cat = CAT_KEYS.find(k => rawCat.startsWith(k.slice(0,5)) || CATS[k].label.toLowerCase() === rawCat) || '';
  const findDisc = c => CATS[c].disc.find(d => rawDisc && (d[0] === rawDisc || d[1].toLowerCase() === rawDisc || rawDisc.includes(d[1].toLowerCase())));
  if (!cat) cat = CAT_KEYS.find(k => findDisc(k)) || (sportToActivity(rawDisc || rawCat) && sportToActivity(rawDisc || rawCat) !== 'other' ? 'cardio' : /lift|weight|strength|gym/.test(rawCat+rawDisc) ? 'weights' : 'grappling');
  const disc = findDisc(cat)?.[0] || (cat === 'cardio' ? sportToActivity(rawDisc || rawCat) || 'other' : '');
  const sec = hmsToSec(pickF(o, 'time', 'moving_time', 'elapsed_time', 'duration_hms')) || Number(pickF(o, 'duration_sec', 'seconds'))||0;
  const dur = Number(pickF(o, 'duration_min', 'duration', 'minutes', 'mins')) || (sec ? Math.round(sec/60) : 0);
  let dist = Number(pickF(o, 'distance', 'distance_mi', 'distance_km', 'dist')) || 0, du = pickF(o, 'unit', 'distance_unit').toLowerCase() || (o.distance_km ? 'km' : o.distance_mi ? 'mi' : distU());
  if (du.startsWith('m') && du !== 'mi') { dist = dist / 1000; du = 'km'; } // meters
  const hr = { avg:pickF(o, 'avg_hr', 'average_heart_rate', 'avg_heart_rate', 'hr_avg'), max:pickF(o, 'max_hr', 'max_heart_rate', 'hr_max'), cal:pickF(o, 'calories', 'kcal', 'calories_burned', 'cal'), zones:[1,2,3,4,5].map(i => pickF(o, `z${i}`, `zone_${i}`, `zone${i}`)) };
  return sanitizeSession({ date, category:cat, discipline:disc, duration:dur || (sec ? Math.round(sec/60) : CATS[cat].dur), rounds:pickF(o, 'rounds'), intensity:pickF(o, 'intensity', 'rpe') || 3, notes:pickF(o, 'notes', 'description', 'title', 'name'),
    gi:/no.?gi/.test(pickF(o,'gi','uniform').toLowerCase()) ? 'nogi' : 'gi', type:pickF(o,'session_type').toLowerCase() || 'class',
    ...(cat === 'cardio' && (dist || sec) ? { cardio:{ distance:dist ? r2(dist) : '', unit:du === 'km' ? 'km' : 'mi', sec:sec || dur*60 } } : {}), hr, source:'CSV import' });
}
async function parseWorkoutFile(file){
  const name = file.name.toLowerCase();
  if (name.endsWith('.fit')) return parseFIT(await file.arrayBuffer());
  const text = await file.text();
  if (name.endsWith('.gpx') || /<gpx[\s>]/i.test(text.slice(0, 500))) return parseGPX(text);
  if (name.endsWith('.tcx') || /TrainingCenterDatabase/.test(text.slice(0, 800))) return parseTCX(text);
  if (name.endsWith('.csv')) { const s = parseCSV(text).map(csvRowToSession).filter(Boolean)[0]; if (!s) throw new Error('No rows'); return { csv:s }; }
  throw new Error('Unsupported file type');
}
function applyImport(f, r, fileName){
  if (r.csv) { const s = r.csv; Object.assign(f, { date:s.date, category:s.category, discipline:s.discipline, duration:s.duration, intensity:s.intensity, notes:s.notes || f.notes });
    if (s.cardio) f.cardio = { ...s.cardio }; if (s.hr) f.hr = { ...f.hr, ...s.hr }; f.source = fileName; f._durTouched = true; return; }
  if (r.date) f.date = r.date > today() ? today() : r.date;
  if (r.activity || r.distM > 0) { if (f.category !== 'cardio' && r.distM > 0) { f.category = 'cardio'; f.discipline = r.activity || 'other'; } else if (f.category === 'cardio' && r.activity) f.discipline = r.activity; }
  if (r.sec) { f.duration = Math.max(1, Math.round(r.sec/60)); f._durTouched = true; }
  if (f.category === 'cardio') { const u = f.cardio.unit || distU(); f.cardio = { unit:u, distance: r.distM ? r2(toUnit(r.distM/1000, 'km', u)) : f.cardio.distance, sec: r.sec || f.cardio.sec }; }
  f.hr = { ...f.hr, ...(r.avgHr ? { avg:r.avgHr } : {}), ...(r.maxHr ? { max:r.maxHr } : {}), ...(r.cal ? { cal:r.cal } : {}), ...(r.zones ? { zones:r.zones } : {}) };
  f.source = fileName;
}
async function importCSVWorkouts(file){
  if (!file) return;
  try {
    const list = parseCSV(await file.text()).map(csvRowToSession).filter(Boolean);
    if (!list.length) throw new Error('No valid rows');
    if (await confirmSheet(`Add ${list.length} workout${list.length>1?'s':''}?`, 'They are added to your history; nothing is replaced. Rows need at least a date column.', 'Add workouts', false)) {
      db.sessions.push(...list); list.forEach(s => { if (!enabled(s.category)) db.profile.enabled = { ...(db.profile.enabled||{}), [s.category]:true }; }); save(); toast(`Added ${list.length} workouts`); route();
    }
  } catch(e) { console.warn(e); toast(`Couldn't read that CSV`); }
  finally { const f = $('#csvFile'); if (f) f.value = ''; }
}

/* ---------------- nutrition ---------------- */
const MEALS = [['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['snack','Snacks']];
const MACROS = [['cal','Calories','kcal'],['p','Protein','g'],['c','Carbs','g'],['f','Fat','g']];
const EXTRAS = [['fiber','Fiber','g'],['sugar','Sugar','g'],['sodium','Sodium','mg']];
const defaultTargets = () => ({ cal:2400, p:180, c:250, f:75 });
const defaultNutrition = () => ({ entries:[], foods:[] });
const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
const r1 = n => Math.round(n*10)/10;
const targets = () => ({ ...defaultTargets(), ...(db.profile.targets||{}) });
/* goals the user actually set (null = not set; no made-up defaults) */
const goals = () => { const t = db.profile.targets || {}; return Object.fromEntries(['cal','p','c','f'].map(k => [k, Number(t[k]) > 0 ? Number(t[k]) : null])); };
const setGoalsLink = (id='setGoals') => `<a class="lnk setgoals" id="${id}" href="#/settings/goals">Set your goals ›</a>`;
const entriesOn = d => db.nutrition.entries.filter(e => e.date === d);
function totals(list){
  const t = { cal:0, p:0, c:0, f:0, fiber:0, sugar:0, sodium:0 };
  list.forEach(e => { const q = num(e.qty) || 1; Object.keys(t).forEach(k => { t[k] += num(e[k]) * q; }); });
  return t;
}
function knownFoods(){
  // saved foods first, then distinct previously-logged foods (most recent wins)
  const seen = new Map();
  db.nutrition.foods.forEach(f => seen.set(f.name.toLowerCase(), { ...f, saved:true }));
  [...db.nutrition.entries].sort((a,b) => b.date.localeCompare(a.date)).forEach(e => { const k = e.name.toLowerCase(); if (!seen.has(k)) seen.set(k, { name:e.name, serving:e.serving, cal:e.cal, p:e.p, c:e.c, f:e.f, fiber:e.fiber, sugar:e.sugar, sodium:e.sodium, saved:false }); });
  return [...seen.values()];
}
function dailyTotals(n=7, end=today()){
  const e = parse(end);
  return Array.from({length:n}, (_,i) => { const d = iso(addDays(e, -(n-1-i))); const list = entriesOn(d); return { date:d, logged:list.length>0, ...totals(list) }; });
}
function weekSummary(end=today()){
  const days = dailyTotals(7, end), logged = days.filter(d => d.logged);
  const avg = k => logged.length ? logged.reduce((a,d) => a+d[k], 0) / logged.length : 0;
  return { days, n:logged.length, cal:avg('cal'), p:avg('p'), c:avg('c'), f:avg('f') };
}
function ring(value, target, label, sub){
  if (!target) return `<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="${esc(label)} ${Math.round(value)}"><circle cx="64" cy="64" r="52" class="ring-bg"/><text x="64" y="62" text-anchor="middle" class="ring-v">${Math.round(value)}</text><text x="64" y="82" text-anchor="middle" class="ring-l">kcal today</text></svg>`;
  const R = 52, C = 2*Math.PI*R, pct = target ? value/target : 0, over = pct > 1.05;
  const dash = Math.min(1, pct) * C;
  return `<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="${esc(label)} ${Math.round(value)} of ${target}">
    <circle cx="64" cy="64" r="${R}" class="ring-bg"/><circle cx="64" cy="64" r="${R}" class="ring-fg ${over?'over':''}" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 64 64)"/>
    <text x="64" y="62" text-anchor="middle" class="ring-v">${Math.round(value)}</text><text x="64" y="82" text-anchor="middle" class="ring-l">${esc(sub)}</text></svg>`;
}
function macroBar(label, value, target, u, cls=''){
  if (!target) return `<div class="mbar ${cls} nogoal"><div class="t"><span>${esc(label)}</span><span><b>${u === 'kcal' ? Math.round(value) : r1(value)}</b> ${u}</span></div></div>`;
  const pct = target ? Math.min(100, value/target*100) : 0, over = target && value > target*1.05;
  return `<div class="mbar ${cls}"><div class="t"><span>${esc(label)}</span><span><b>${u === 'kcal' ? Math.round(value) : r1(value)}</b> / ${target} ${u}</span></div><div class="b"><i class="${over?'over':''}" style="width:${pct}%"></i></div></div>`;
}
function macroSplit(t){
  const pc = t.p*4, cc = t.c*4, fc = t.f*9, sum = pc+cc+fc;
  if (!sum) return `<div class="empty" style="padding:4px 0">Log food to see your macro split.</div>`;
  const P = Math.round(pc/sum*100), Cc = Math.round(cc/sum*100), F = 100 - P - Cc;
  return `<div class="split"><i class="sp" style="width:${P}%"></i><i class="sc" style="width:${Cc}%"></i><i class="sf" style="width:${F}%"></i></div>
    <div class="split-l"><span><i class="sp"></i>Protein ${P}%</span><span><i class="sc"></i>Carbs ${Cc}%</span><span><i class="sf"></i>Fat ${F}%</span></div>`;
}
function calChart(days, target){
  const W = 340, H = 140, pt = 16, pb = 22, pl = 4, pr = 4;
  const max = Math.max((target||0)*1.15, ...days.map(d => d.cal), 1);
  const bw = (W-pl-pr)/days.length, Y = v => H - pb - (H-pt-pb) * v/max;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day, last ${days.length} days">`;
  days.forEach((d,i) => {
    const x = pl + i*bw + bw*0.2, y = Y(d.cal), cur = d.date === today();
    s += `<rect class="bar ${d.cal?'':'dim'} ${target && d.cal > target*1.05 ? 'over' : ''}" x="${x.toFixed(1)}" y="${(d.cal?y:H-pb-3).toFixed(1)}" width="${(bw*0.6).toFixed(1)}" height="${(d.cal?H-pb-y:3).toFixed(1)}" rx="4" ${cur?'':'opacity=".6"'}/>`;
    if (d.cal) s += `<text x="${(x+bw*0.3).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle" style="fill:${cur?'var(--accent)':'var(--muted)'}">${Math.round(d.cal)}</text>`;
    s += `<text x="${(x+bw*0.3).toFixed(1)}" y="${H-6}" text-anchor="middle">${cur ? 'Today' : DOW[parse(d.date).getDay()]}</text>`;
  });
  if (target) { const ty = Y(target); s += `<line class="goal" x1="0" x2="${W}" y1="${ty}" y2="${ty}"/><text x="${W-pr}" y="${ty-4}" text-anchor="end" style="fill:#ffc43d">Goal ${target}</text>`; }
  return s + '</svg>';
}
function nutritionCard(){
  const t = totals(entriesOn(today())), tg = goals(), wk = weekSummary();
  const ws = weightSeries(); let wnote = '';
  if (ws.length > 1 && !enabled('weight')) {
    const recent = ws.filter(p => p.date >= iso(addDays(new Date(), -28)));
    if (recent.length > 1) { const span = Math.max(1, (parse(recent[recent.length-1].date) - parse(recent[0].date)) / 864e5 / 7); const rate = r1((recent[recent.length-1].w - recent[0].w) / span); wnote = ` · weight ${rate>0?'+':''}${rate} ${unit()}/wk (4 wk)`; }
  }
  return `<div class="card" id="nutriCard"><h2>Nutrition today <a href="#/food" style="color:var(--accent);text-decoration:none;text-transform:none;letter-spacing:0;font-size:13px">Food log ›</a></h2>
    ${macroBar('Calories', t.cal, tg.cal, 'kcal', 'cal')}${macroBar('Protein', t.p, tg.p, 'g', 'pro')}${!tg.cal || !tg.p ? `<div class="hint">${setGoalsLink('setGoalsHome')} to track progress.</div>` : ''}
    <div class="wline" id="homeWater">💧 Water <b>${fromMl(waterOn(today()))}</b>${waterGoalMl() ? ` / ${fromMl(waterGoalMl())}` : ''} ${waterU()}${waterGoalMl() ? `<span class="mini"><i style="width:${Math.min(100, waterOn(today()) / waterGoalMl() * 100)}%"></i></span>` : ''}</div>
    <div class="hint">${wk.n ? `7-day avg ${Math.round(wk.cal)} kcal · ${Math.round(wk.p)} g protein${wnote}` : 'No food logged this week yet.'}</div>
    <a class="btn block" style="margin-top:12px" href="#/food">Log food</a></div>`;
}

let foodDate = null;
function viewFood(d){
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) foodDate = d;
  if (!foodDate) foodDate = today();
  const day = foodDate, isToday = day === today();
  setHeader('Food', `<button class="btn sm" id="savedFoods">My foods</button>`);
  const list = entriesOn(day), t = totals(list), tg = goals(), wk = weekSummary(day);
  const v = $('#view');
  v.innerHTML = `
    <div class="daynav"><a class="iconbtn big" href="#/food/${iso(addDays(parse(day),-1))}" aria-label="Previous day"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <div class="dn-t"><b>${isToday ? 'Today' : fmtDate(day).replace(/, \d{4}$/,'')}</b>${isToday ? `<span>${fmtShort(day)}</span>` : `<a href="#/food/${today()}">Jump to today</a>`}</div>
      ${isToday ? '<span class="iconbtn big" style="opacity:.25"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>' : `<a class="iconbtn big" href="#/food/${iso(addDays(parse(day),1))}" aria-label="Next day"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></a>`}</div>
    ${quickFoods().length ? `<div class="card quickfood"><h2>Quick add <small>tap = 1 serving</small></h2><div class="qf">${quickFoods().map((f,i) => `<button type="button" class="qfb" data-qf="${i}"><b>${esc(f.name)}</b><small>${Math.round(num(f.cal))} kcal · ${r1(num(f.p))} g P</small></button>`).join('')}</div></div>` : ''}
    <div class="card nutri-top">
      <div class="ringwrap">${ring(t.cal, tg.cal, 'Calories', `of ${tg.cal} kcal`)}<div class="left">${!tg.cal ? setGoalsLink() : t.cal <= tg.cal ? `<b>${Math.round(tg.cal - t.cal)}</b> kcal left` : `<b class="over">${Math.round(t.cal - tg.cal)}</b> kcal over`}</div></div>
      <div class="mbars">${macroBar('Protein', t.p, tg.p, 'g', 'pro')}${macroBar('Carbs', t.c, tg.c, 'g', 'carb')}${macroBar('Fat', t.f, tg.f, 'g', 'fat')}</div>
    </div>
    ${waterCard(day)}
    <div class="card"><h2>Macro split</h2>${macroSplit(t)}
      <div class="extras">${EXTRAS.map(([k,l,u]) => `<div><b>${r1(t[k])}<small> ${u}</small></b><span>${l}</span></div>`).join('')}</div></div>
    ${MEALS.map(([k,l]) => { const items = list.filter(e => e.meal === k), mt = totals(items); return `<div class="card meal" data-meal="${k}"><h2>${l} <small>${Math.round(mt.cal)} kcal · ${r1(mt.p)} g P</small></h2>
      ${items.map(e => `<button type="button" class="food-row" data-id="${esc(e.id)}"><div class="grow"><b>${esc(e.name)}</b><small>${r1(num(e.qty)||1)} × ${esc(e.serving||'serving')} · P ${r1(num(e.p)*(num(e.qty)||1))} · C ${r1(num(e.c)*(num(e.qty)||1))} · F ${r1(num(e.f)*(num(e.qty)||1))}</small></div><span class="kcal">${Math.round(num(e.cal)*(num(e.qty)||1))}</span></button>`).join('')}
      <button type="button" class="btn block addfood" data-add="${k}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add ${l === 'Snacks' ? 'snack' : l.toLowerCase()}</button></div>`; }).join('')}
    <div class="card"><h2>Last 7 days <small>${wk.n} day${wk.n===1?'':'s'} logged</small></h2>
      <div class="kv" style="margin-bottom:8px"><div><b>${Math.round(wk.cal)}</b><span>Avg kcal</span></div><div><b>${Math.round(wk.p)}<small style="font-size:13px;color:var(--muted)"> g</small></b><span>Avg protein</span></div><div><b>${tg.p ? `${wk.days.filter(x => x.logged && x.p >= tg.p*0.95).length}/7` : '—'}</b><span>Protein goal hit</span></div></div>
      ${calChart(wk.days, tg.cal)}<div class="hint">Avg carbs ${Math.round(wk.c)} g · fat ${Math.round(wk.f)} g (days with food logged)</div></div>`;
  v.querySelectorAll('[data-add]').forEach(b => b.onclick = () => foodForm({ meal:b.dataset.add }));
  wireWater(v, day);
  const qf = quickFoods();
  v.querySelectorAll('[data-qf]').forEach(b => b.onclick = () => {
    const f = qf[Number(b.dataset.qf)], hr = new Date().getHours();
    const meal = day !== today() ? 'snack' : hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
    const rec = { id:uid(), date:day, meal, name:f.name, serving:f.serving||'1 serving', qty:1, cal:num(f.cal), p:num(f.p), c:num(f.c), f:num(f.f), fiber:f.fiber??'', sugar:f.sugar??'', sodium:f.sodium??'', createdAt:Date.now() };
    db.nutrition.entries.push(rec); save();
    undoToast(`Added ${f.name} to ${MEALS.find(m => m[0]===meal)[1].toLowerCase()}`, () => { db.nutrition.entries = db.nutrition.entries.filter(e => e.id !== rec.id); save(); route(); });
    const y = window.scrollY; route(); window.scrollTo(0, y);
  });
  v.querySelectorAll('.food-row').forEach(b => b.onclick = () => foodForm({ id:b.dataset.id }));
  $('#savedFoods').onclick = savedFoodsSheet;
}

function foodForm({ id=null, meal=null, preset=null }){
  const existing = id ? db.nutrition.entries.find(e => e.id === id) : null;
  const guessMeal = () => { const hr = new Date().getHours(); return hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr < 21 ? 'dinner' : 'snack'; };
  const e = existing ? { ...existing } : { id:null, date:foodDate || today(), meal:meal || guessMeal(), name:'', serving:'1 serving', qty:1, cal:'', p:'', c:'', f:'', fiber:'', sugar:'', sodium:'', ...(preset||{}) };
  const el = h(`<div class="foodform"><h3>${existing ? 'Edit food' : 'Add food'}</h3></div>`);
  const name = h(`<input class="input" type="text" autocapitalize="sentences" autocomplete="off" placeholder="e.g. Chicken breast" value="${esc(e.name)}">`);
  const sugg = h('<div class="sugg"></div>');
  const nameWrap = h('<div></div>'); nameWrap.appendChild(name); nameWrap.appendChild(sugg);
  el.appendChild(field('Food', nameWrap));
  el.appendChild(field('Meal', seg(MEALS, e.meal, x => e.meal = x)));
  const numIn = (k, ph, mode='decimal') => { const i = h(`<input class="input num" type="text" inputmode="${mode}" placeholder="${ph}" value="${esc(e[k])}" data-k="${k}">`); i.oninput = () => { e[k] = i.value.replace(/[^\d.]/g,''); if (i.value !== e[k]) i.value = e[k]; drawTotal(); }; return i; };
  const g1 = h('<div class="grid2"></div>');
  const serving = h(`<input class="input" type="text" placeholder="e.g. 100 g, 1 cup" value="${esc(e.serving)}">`); serving.oninput = () => e.serving = serving.value;
  g1.appendChild(field('Serving size', serving));
  const qty = h(`<div class="stepper"><button type="button" aria-label="Fewer servings">−</button><input type="text" inputmode="decimal" value="${esc(e.qty)}" data-k="qty"><span class="unit">×</span><button type="button" aria-label="More servings">+</button></div>`);
  const qi = qty.querySelector('input'), [qd, qu] = qty.querySelectorAll('button');
  const setQ = v => { v = Math.max(0.25, Math.min(50, Math.round(v*4)/4)); e.qty = v; qi.value = v; drawTotal(); };
  qd.onclick = () => setQ((num(qi.value)||1) - 0.5); qu.onclick = () => setQ((num(qi.value)||1) + 0.5);
  qi.oninput = () => { e.qty = qi.value.replace(/[^\d.]/g,''); drawTotal(); }; qi.onchange = () => setQ(num(qi.value)||1);
  g1.appendChild(field('Servings', qty));
  el.appendChild(g1);
  el.appendChild(h('<div class="label sect">Per serving</div>'));
  const g2 = h('<div class="grid2"></div>');
  g2.appendChild(field('Calories (kcal)', numIn('cal','0','numeric')));
  g2.appendChild(field('Protein (g)', numIn('p','0')));
  g2.appendChild(field('Carbs (g)', numIn('c','0')));
  g2.appendChild(field('Fat (g)', numIn('f','0')));
  el.appendChild(g2);
  const more = h(`<details class="more" ${num(e.fiber)||num(e.sugar)||num(e.sodium)?'open':''}><summary>Fiber, sugar, sodium (optional)</summary></details>`);
  const g3 = h('<div class="grid3"></div>');
  g3.appendChild(field('Fiber g', numIn('fiber','—'))); g3.appendChild(field('Sugar g', numIn('sugar','—'))); g3.appendChild(field('Sodium mg', numIn('sodium','—','numeric')));
  more.appendChild(g3); el.appendChild(more);
  const totalEl = h('<div class="foodtotal"></div>'); el.appendChild(totalEl);
  const isSaved = () => db.nutrition.foods.some(f => f.name.toLowerCase() === (e.name||'').trim().toLowerCase());
  const saveChk = h(`<label class="check"><input type="checkbox" ${existing ? '' : 'checked'}><span>Save to My foods for quick re-adding</span></label>`);
  el.appendChild(saveChk);
  function drawTotal(){
    const q = num(e.qty) || 1, c = num(e.cal)*q;
    totalEl.innerHTML = `<span>Total</span><b>${Math.round(c)} kcal</b><span>P ${r1(num(e.p)*q)} · C ${r1(num(e.c)*q)} · F ${r1(num(e.f)*q)} g</span>`;
  }
  const fill = f => {
    e.name = f.name; name.value = f.name; e.serving = f.serving || '1 serving'; serving.value = e.serving;
    ['cal','p','c','f','fiber','sugar','sodium'].forEach(k => { e[k] = f[k] === '' || f[k] == null ? '' : String(f[k]); const i = el.querySelector(`input[data-k="${k}"]`); if (i) i.value = e[k]; });
    if (num(e.fiber)||num(e.sugar)||num(e.sodium)) more.open = true;
    saveChk.querySelector('input').checked = !f.saved; drawSugg(); drawTotal();
  };
  function drawSugg(){
    const q = name.value.trim().toLowerCase();
    const list = knownFoods().filter(f => !q || f.name.toLowerCase().includes(q)).filter(f => f.name.toLowerCase() !== q)
      .sort((a,b) => q ? (a.name.toLowerCase().startsWith(q)?0:1) - (b.name.toLowerCase().startsWith(q)?0:1) : 0).slice(0,12);
    sugg.innerHTML = '';
    list.forEach(f => { const b = h(`<button type="button">${f.saved?'★ ':''}${esc(f.name)} <small>${Math.round(num(f.cal))}</small></button>`); b.onclick = () => fill(f); sugg.appendChild(b); });
  }
  sugg.addEventListener('mousedown', ev => ev.preventDefault());
  name.oninput = () => { e.name = name.value; drawSugg(); };
  const btns = h(`<div style="display:flex;gap:10px;margin-top:14px">${existing ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}<button type="button" class="btn primary" style="flex:1" data-save>${existing ? 'Save changes' : 'Add food'}</button></div>`);
  btns.querySelector('[data-save]').onclick = () => {
    const nm = (name.value||'').trim().replace(/\s+/g,' ');
    if (!nm) { toast('Enter a food name'); name.focus(); return; }
    if (!num(e.cal) && !num(e.p) && !num(e.c) && !num(e.f)) { toast('Enter calories or macros'); return; }
    const clean = k => e[k] === '' || e[k] == null || isNaN(Number(e[k])) ? '' : r1(Number(e[k]));
    const rec = { id: existing ? existing.id : uid(), date:e.date, meal:e.meal, name:nm, serving:(e.serving||'').trim() || '1 serving', qty: num(e.qty) || 1,
      cal:clean('cal')||0, p:clean('p')||0, c:clean('c')||0, f:clean('f')||0, fiber:clean('fiber'), sugar:clean('sugar'), sodium:clean('sodium'), createdAt: existing?.createdAt || Date.now() };
    if (existing) { const i = db.nutrition.entries.findIndex(x => x.id === existing.id); db.nutrition.entries[i] = rec; }
    else db.nutrition.entries.push(rec);
    if (saveChk.querySelector('input').checked) {
      const food = { name:nm, serving:rec.serving, cal:rec.cal, p:rec.p, c:rec.c, f:rec.f, fiber:rec.fiber, sugar:rec.sugar, sodium:rec.sodium };
      const i = db.nutrition.foods.findIndex(f => f.name.toLowerCase() === nm.toLowerCase());
      if (i >= 0) { const nf = { ...db.nutrition.foods[i], ...food }; delete nf.sample; db.nutrition.foods[i] = nf; } else db.nutrition.foods.push({ id:uid(), ...food });
    }
    save(); closeSheet(); toast(existing ? 'Food updated' : `Added ${nm}`); route();
  };
  const del = btns.querySelector('[data-del]');
  if (del) del.onclick = () => { db.nutrition.entries = db.nutrition.entries.filter(x => x.id !== existing.id); save(); closeSheet(); toast('Food removed'); route(); };
  el.appendChild(btns);
  drawSugg(); drawTotal();
  openSheet(el, null, { closeLabel:'Cancel' });
  if (!existing && !preset) name.focus({ preventScroll:true }); // synchronous, inside the tap gesture (iOS only shows the keyboard then)
}

function quickFoods(){ // most recent distinct logged foods first, then saved foods
  const seen = new Set(), out = [];
  [...db.nutrition.entries].sort((a,b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).forEach(e => { const k = e.name.toLowerCase(); if (!seen.has(k) && out.length < 8) { seen.add(k); out.push(e); } });
  db.nutrition.foods.forEach(f => { const k = f.name.toLowerCase(); if (!seen.has(k) && out.length < 10) { seen.add(k); out.push(f); } });
  return out;
}
function savedFoodsSheet(){
  const el = h(`<div><h3>My foods</h3><p class="hint" style="margin:-8px 0 12px">Tap + to add a serving to ${foodDate === today() ? 'today' : fmtShort(foodDate)}. Foods you save while logging appear here.</p><div class="search" style="margin-bottom:10px"><input class="input" type="search" placeholder="Search my foods…"></div><div class="flist"></div></div>`);
  const q = el.querySelector('input'), listEl = el.querySelector('.flist');
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const foods = [...db.nutrition.foods].sort((a,b) => a.name.localeCompare(b.name)).filter(f => !s || f.name.toLowerCase().includes(s));
    listEl.innerHTML = foods.length ? foods.map(f => `<div class="list-row" data-id="${esc(f.id)}"><div class="grow"><b>${esc(f.name)}</b><small>${esc(f.serving||'serving')} · ${Math.round(num(f.cal))} kcal · P ${r1(num(f.p))} C ${r1(num(f.c))} F ${r1(num(f.f))}</small></div>
      <button type="button" class="iconbtn big" data-rm aria-label="Remove ${esc(f.name)} from My foods"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button>
      <button type="button" class="iconbtn big accent" data-quick aria-label="Add ${esc(f.name)}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div>`).join('') : '<div class="empty">No saved foods yet.</div>';
    listEl.querySelectorAll('.list-row').forEach(row => {
      const f = db.nutrition.foods.find(x => x.id === row.dataset.id);
      row.querySelector('[data-quick]').onclick = () => { closeSheet(); foodForm({ preset:{ ...f, id:null, qty:1 } }); };
      row.querySelector('[data-rm]').onclick = async () => { if (await confirmSheet(`Remove ${f.name}?`, 'It is removed from My foods only; logged entries stay.', 'Remove')) { db.nutrition.foods = db.nutrition.foods.filter(x => x.id !== f.id); save(); toast('Removed from My foods'); } savedFoodsSheet(); };
    });
  };
  q.oninput = draw; draw(); openSheet(el);
}

function sampleWater(){
  // ~2–3 L a day for the last 2 weeks; today partly done
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const out = [];
  for (let i = 13; i >= 0; i--) { const d = addDays(new Date(), -i), n = i === 0 ? 3 : 5 + Math.floor(rnd()*4);
    for (let j = 0; j < n; j++) { const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7 + j*2, 0).getTime(); if (at > Date.now()) break;
      out.push({ id:uid(), date:iso(d), ml: rnd() < .5 ? 237 : 500, createdAt:at, sample:true }); } }
  return out;
}
function sampleNutrition(){
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const F = (name, serving, cal, p, c, f, fiber='', sugar='', sodium='') => ({ id:uid(), name, serving, cal, p, c, f, fiber, sugar, sodium, sample:true });
  const foods = {
    breakfast:[F('Greek yogurt','1 cup (227 g)',150,23,9,0,0,7,85), F('Oatmeal','1 cup cooked',166,6,28,3.6,4,0.6,9), F('Eggs, scrambled','2 large',182,12,2,14,0,1.4,340), F('Banana','1 medium',105,1.3,27,0.4,3.1,14,1), F('Protein shake','1 scoop + milk',250,32,14,6,1,12,220)],
    lunch:[F('Chicken breast','6 oz grilled',280,53,0,6,0,0,125), F('White rice','1 cup cooked',205,4.3,45,0.4,0.6,0,2), F('Burrito bowl','1 bowl',720,42,78,24,14,6,1650), F('Turkey sandwich','1 sandwich',430,30,44,14,4,6,1100), F('Mixed salad','1 large bowl',120,4,12,7,5,5,180)],
    dinner:[F('Salmon fillet','6 oz',350,34,0,22,0,0,100), F('Sweet potato','1 medium',112,2,26,0.1,3.9,5.4,72), F('Lean ground beef','6 oz',340,42,0,18,0,0,120), F('Pasta','2 cups cooked',400,15,80,2.4,5,1.6,4), F('Steamed broccoli','1 cup',55,3.7,11,0.6,5.1,2.2,64)],
    snack:[F('Almonds','1 oz',164,6,6,14,3.5,1.2,0), F('Apple','1 medium',95,0.5,25,0.3,4.4,19,2), F('Protein bar','1 bar',210,20,23,7,10,1,200), F('Cottage cheese','1/2 cup',110,12,5,5,0,4,400)]
  };
  const entries = [], end = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = iso(addDays(end, -i));
    if (i > 0 && rnd() < .12) continue; // a few unlogged days
    MEALS.forEach(([m]) => {
      if (i === 0 && (m === 'dinner' || m === 'snack')) return; // today: partially logged
      const n = m === 'snack' ? (rnd() < .7 ? 1 : 0) : m === 'breakfast' ? 2 : 2 + (rnd() < .4 ? 1 : 0);
      const pool = [...foods[m]];
      for (let k = 0; k < n && pool.length; k++) {
        const f = pool.splice(Math.floor(rnd()*pool.length), 1)[0];
        entries.push({ id:uid(), date:d, meal:m, name:f.name, serving:f.serving, qty: rnd() < .2 ? 1.5 : 1, cal:f.cal, p:f.p, c:f.c, f:f.f, fiber:f.fiber, sugar:f.sugar, sodium:f.sodium, sample:true, createdAt:Date.now() });
      }
    });
  }
  return { entries, foods:Object.values(foods).flat() };
}
function sanitizeNutrition(n){
  const nz = v => v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
  const food = x => ({ name:String(x.name||'').trim(), serving:String(x.serving||'1 serving'), cal:Number(x.cal)||0, p:Number(x.p)||0, c:Number(x.c)||0, f:Number(x.f)||0, fiber:nz(x.fiber), sugar:nz(x.sugar), sodium:nz(x.sodium), ...(x.sample ? { sample:true } : {}) });
  const entries = Array.isArray(n?.entries) ? n.entries.filter(e => e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.name)
    .map(e => ({ id:String(e.id||uid()), date:e.date, meal:MEALS.some(m => m[0]===e.meal) ? e.meal : 'snack', qty:Number(e.qty)||1, ...food(e), createdAt:e.createdAt||Date.now() })) : [];
  const foods = Array.isArray(n?.foods) ? n.foods.filter(f => f && f.name).map(f => ({ id:String(f.id||uid()), ...food(f) })) : [];
  return { entries, foods, water:sanitizeWater(n?.water) };
}
/* water: stored in ml, shown in oz (lb users) or ml (kg users) */
function sanitizeWater(list){
  return (Array.isArray(list) ? list : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && Number(x.ml) > 0 && Number(x.ml) < 10000)
    .map(x => ({ id:String(x.id || ('h' + Date.now().toString(36) + Math.random().toString(36).slice(2,8))), date:String(x.date), ml:Math.round(Number(x.ml)), createdAt:Number(x.createdAt)||0, ...(x.sample ? { sample:true } : {}) }));
}
const ML_PER_OZ = 29.5735;
const waterMetric = () => unit() === 'kg';
const waterU = () => waterMetric() ? 'ml' : 'oz';
const fromMl = ml => waterMetric() ? Math.round(ml) : Math.round(ml / ML_PER_OZ * 10) / 10;
const toMl = v => waterMetric() ? Number(v) : Number(v) * ML_PER_OZ;
const waterOn = day => (db.nutrition.water||[]).filter(x => x.date === day).reduce((a,x) => a + x.ml, 0);
const waterGoalMl = () => Number(db.profile.waterGoal) > 0 ? Number(db.profile.waterGoal) : null;
const WATER_BTNS = () => waterMetric() ? [['glass', 250, '+250 ml', 'Glass'], ['bottle', 500, '+500 ml', 'Bottle']] : [['glass', 8 * ML_PER_OZ, '+8 oz', 'Glass'], ['bottle', 500, '+16.9 oz', 'Bottle']];
function addWater(ml, day){
  const rec = { id:uid(), date:day || today(), ml:Math.round(ml), createdAt:Date.now() };
  db.nutrition.water = (db.nutrition.water||[]).concat(rec); save();
  undoToast(`+${fromMl(rec.ml)} ${waterU()} water`, () => { db.nutrition.water = db.nutrition.water.filter(x => x.id !== rec.id); save(); route(); });
  route();
}
function waterCard(day){
  const tot = waterOn(day), g = waterGoalMl(), pct = g ? Math.min(100, tot / g * 100) : 0;
  return `<div class="card" id="waterCard"><h2>Water <small>${day === today() ? 'today' : fmtShort(day)}</small></h2>
    <div class="wtot"><b id="waterTotal">${fromMl(tot)}</b><span>${g ? ` / ${fromMl(g)} ${waterU()}` : ` ${waterU()}`}</span>${g ? `<em>${Math.round(tot / g * 100)}%</em>` : setGoalsLink('setWaterGoal').replace('Set your goals', 'Set goal')}</div>
    ${g ? `<div class="mbar water"><div class="b"><i style="width:${pct}%"></i></div></div>` : ''}
    <div class="wbtns">${WATER_BTNS().map(([k, ml, lbl, sub]) => `<button type="button" class="btn" data-water="${ml}" data-wk="${k}"><b>${lbl}</b><small>${sub}</small></button>`).join('')}<button type="button" class="btn" id="waterCustom"><b>+ Custom</b><small>${waterU()}</small></button></div></div>`;
}
function wireWater(root, day){
  root.querySelectorAll('[data-water]').forEach(b => b.onclick = () => addWater(Number(b.dataset.water), day));
  const c = root.querySelector('#waterCustom'); if (c) c.onclick = () => {
    const el = h(`<div><h3>Add water</h3><div class="field"><label>Amount (${waterU()})</label><input class="input" id="waterAmt" type="text" inputmode="decimal" placeholder="${waterMetric() ? 'e.g. 330' : 'e.g. 12'}"></div><button type="button" class="btn primary block" id="waterAdd">Add water</button></div>`);
    const inp = el.querySelector('#waterAmt');
    el.querySelector('#waterAdd').onclick = () => { const v = Number(String(inp.value).replace(',', '.')); const ml = toMl(v); if (!(ml >= 10 && ml <= 5000)) { toast(`Enter an amount in ${waterU()}`); inp.focus(); return; } closeSheet(); whenSettled(() => addWater(ml, day)); };
    openSheet(el, null, { closeLabel:'Cancel' }); inp.focus({ preventScroll:true });
  };
}

/* ---------------- undo toast ---------------- */
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
  const sec = h(`<div class="card" id="sectionsCard"><h2>What I track</h2><div class="toggles"></div><div class="hint">Hidden sections disappear from the app. Your data is kept.</div></div>`);
  [...CAT_KEYS.map(k => [k, CATS[k].label, CATS[k].disc.map(d => d[1]).join(', ')]), ['weight','Weight goal','Weigh-ins & progress'], ['food','Food','Calories, protein, meals']].forEach(([k,l,sub]) => {
    const row = h(`<label class="toggle"><span><b>${l}</b><small>${esc(sub)}</small></span><input type="checkbox" role="switch" data-sec="${k}" ${enabled(k)?'checked':''}><i></i></label>`);
    row.querySelector('input').onchange = e => { const en = { ...(p.enabled||{}) }; SECTION_KEYS().forEach(x => { if (!(x in en)) en[x] = enabled(x); }); en[k] = e.target.checked;
      if (!CAT_KEYS.some(x => en[x])) { e.target.checked = true; toast('Keep at least one workout type'); return; }
      p.enabled = en; save(); updateNav(); toast(`${l} ${e.target.checked ? 'shown' : 'hidden'}`); };
    sec.querySelector('.toggles').appendChild(row);
  });
  v.appendChild(sec);
  const card = h(`<div class="card" id="rankCard"><h2>Belt <a class="lnk" href="#/belts">Timeline ›</a></h2>${currentRank() ? `<div class="belt">${beltBar(currentRank().belt, currentRank().stripes)}</div><div class="belt-meta"><span><b>${esc(beltOf(currentRank().belt)[1])} belt</b>${currentRank().stripes ? ` · ${rankLabel(currentRank())}` : ''}</span><span>since ${fmtShort(beltGroups().slice(-1)[0].start)}</span></div>` : beltEmpty()}
    <button type="button" class="btn primary block" data-promo style="margin-top:12px">Log promotion</button><div class="hint" style="margin-top:8px">${(db.belts||[]).length} promotion${(db.belts||[]).length === 1 ? '' : 's'} in your history. Edit or delete them on the timeline.</div></div>`);
  v.appendChild(scheduleCard());
  wireBelt(card);
  if (enabled('grappling')) v.appendChild(card);
  const up = db.comps.filter(c => c.date >= today()).sort((a,b) => a.date.localeCompare(b.date));
  const cc = h(`<div class="card" id="compsProfile"><h2>Competitions <a class="lnk" href="#/comps">All ›</a></h2>${up.length ? compsList(up.slice(0, 3)) : '<div class="hint" style="margin:-4px 0 6px">Add an event to get a countdown on Home and taper tips in the final week.</div>'}<button type="button" class="btn block" data-addcomp style="margin-top:10px">Add competition</button></div>`);
  wireComps(cc); v.appendChild(cc);
  const ic = injuryProfileCard(); wireInjuries(ic); v.appendChild(ic);
  if (isPro()) v.appendChild(programProfileCard());
  if (enabled('weights') || db.strength.length) { const sc = strengthProfileCard(); wireStrength(sc); v.appendChild(sc); }
  v.appendChild(gameProfileCard());

  const wcard = h('<div class="card"><h2>Weight</h2></div>');
  wcard.appendChild(field('Units', seg([['lb','lb'],['kg','kg']], unit(), x => { if (x === unit()) return; const from = unit(), cv = v => v === '' || v == null || !(Number(v) > 0) ? v : Math.round(convW(Number(v), from, x)*10)/10;
    p.startWeight = cv(p.startWeight); p.goalWeight = cv(p.goalWeight); db.sessions.forEach(s => { s.weight = cv(s.weight); }); p.unit = x; save(); toast(`Weights shown in ${x}`); viewSettings(); })));
  const firstW = weightSeries()[0];
  const wnum = (val, ph, id) => h(`<input class="input" type="text" inputmode="decimal" placeholder="${esc(ph)}" value="${esc(val)}" id="${id}">`);
  const startIn = wnum(p.startWeight, firstW ? `${firstW.w} (first weigh-in)` : 'e.g. 210', 'startW');
  startIn.onchange = () => { p.startWeight = startIn.value.replace(/[^\d.]/g,''); p.sampleProfile = false; save(); toast('Starting weight saved'); };
  const curRow = h(`<div class="field"><label>Current weight</label><div style="display:flex;gap:10px;align-items:center"><b style="font-size:20px;flex:1" id="curW">${weightGoal().cur != null ? `${weightGoal().cur} ${unit()}` : '—'}</b><button type="button" class="btn sm" id="logWeightP">Log weight</button></div></div>`);
  curRow.querySelector('#logWeightP').onclick = logWeightSheet;
  const goal = wnum(p.goalWeight, 'Optional', 'goalW');
  goal.onchange = () => { p.goalWeight = goal.value.replace(/[^\d.]/g,''); p.sampleProfile = false; save(); toast('Goal saved'); };
  const gdate = h(`<input class="input" type="date" id="goalDate" value="${esc(p.goalDate||'')}" min="${today()}">`);
  gdate.onchange = () => { p.goalDate = gdate.value; save(); toast(gdate.value ? 'Goal date saved' : 'Goal date cleared'); };
  if (enabled('weight')) { wcard.appendChild(field('Starting weight', startIn, 'Leave blank to use your first weigh-in.')); wcard.appendChild(curRow); }
  const g2 = h('<div class="grid2"></div>'); g2.appendChild(field('Goal weight', goal)); g2.appendChild(field('Goal date (optional)', gdate));
  wcard.appendChild(g2);
  if (enabled('cardio')) wcard.appendChild(field('Distance', seg([['mi','Miles'],['km','Kilometers']], distU(), x => { p.distUnit = x; save(); })));
  const mhr = h(`<input class="input" type="text" inputmode="numeric" placeholder="e.g. 190" value="${esc(p.maxHR||'')}">`);
  mhr.onchange = () => { p.maxHR = mhr.value.replace(/\D/g,''); save(); toast('Max heart rate saved'); };
  wcard.appendChild(field('Max heart rate', mhr, 'Used to work out heart-rate zones from imported workout files.'));
  wcard.querySelector('h2').textContent = 'Body & units';
  v.appendChild(wcard);

  const tcard = h('<div class="card" id="targetsCard"><h2>Daily nutrition goals</h2><div class="grid2"></div></div>');
  const tg = goals(), tgrid = tcard.querySelector('.grid2');
  MACROS.forEach(([k,l,u]) => {
    const i = h(`<input class="input" type="text" inputmode="numeric" value="${esc(tg[k] ?? '')}" placeholder="e.g. ${defaultTargets()[k]}" data-target="${k}">`);
    i.onchange = () => { const raw = i.value.replace(/[^\d.]/g,''), n = Math.round(num(raw)); const t = { ...(db.profile.targets||{}) };
      if (!raw) { delete t[k]; db.profile.targets = t; save(); toast(`${l} goal cleared`); return; }
      if (!n) { i.value = tg[k] ?? ''; toast('Enter a number'); return; }
      i.value = n; t[k] = n; db.profile.targets = t; save(); toast(`${l} goal saved`); };
    tgrid.appendChild(field(TARGET_LABEL[k] || `${l} (${u})`, i));
  });
  const wg = h(`<input class="input" type="text" inputmode="decimal" id="waterGoal" value="${waterGoalMl() ? fromMl(waterGoalMl()) : ''}" placeholder="${waterMetric() ? 'e.g. 2500' : 'e.g. 96'}">`);
  wg.onchange = () => { const raw = wg.value.replace(/[^\d.]/g,''); if (!raw) { db.profile.waterGoal = ''; save(); toast('Water goal cleared'); return; } const ml = toMl(raw); if (!(ml >= 250 && ml <= 10000)) { toast(`Enter a goal in ${waterU()}`); return; } db.profile.waterGoal = Math.round(ml); save(); toast('Water goal saved'); };
  tgrid.appendChild(field(`Water (${waterU()})`, wg));
  tcard.appendChild(h(`<div class="hint">${TARGET_HINT} Rough guide: protein ≈ 0.8–1 g per lb of body weight.</div>`));
  if (enabled('food')) v.appendChild(tcard);

  const hasSample = hasSampleData();
  const data = h(`<div class="card"><h2>Your data</h2>
    <p class="hint" style="margin:-4px 0 14px;font-size:13px">Stored only on this device. Export a backup regularly, especially before clearing Safari data.</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn block" id="exp"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Export backup (JSON)</button>
      <label class="btn block" for="impFile"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>Import backup</label>
      <input type="file" id="impFile" accept="application/json,.json" hidden>
      <label class="btn block" for="csvFile"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/></svg>Import workouts from CSV</label>
      <input type="file" id="csvFile" accept=".csv,text/csv" hidden>
      <button class="btn block" id="ldS">Load sample data (demo)</button>
      ${hasSample ? '<button class="btn block" id="rmS">Remove sample data</button>' : ''}
      <button class="btn block danger" id="clr">Clear all data</button>
    </div>${db.archive?.supps ? `<div class="hint" id="suppArchiveNote" style="margin-top:12px">Supplement tracking was removed in 3.1. Your ${(db.archive.supps.items||[]).length} supplement${(db.archive.supps.items||[]).length === 1 ? '' : 's'} and ${(db.archive.supps.log||[]).length} check-off${(db.archive.supps.log||[]).length === 1 ? '' : 's'} are kept, hidden, on this device and in your backups.</div>` : ''}</div>`);
  v.appendChild(data);
  v.appendChild(h(`<div class="card"><h2>Install on iPhone</h2><div style="color:var(--muted);font-size:14px">In Safari, tap <b style="color:var(--text)">Share</b> → <b style="color:var(--text)">Add to Home Screen</b>. It opens full-screen and works offline.</div></div>`));
  v.appendChild(h(`<div class="foot">Forged · v${APP_VERSION} · ${db.sessions.length} sessions · ${db.nutrition.entries.length} food entries stored</div>`));

  $('#exp').onclick = exportData;
  $('#impFile').onchange = e => importData(e.target.files[0]);
  $('#csvFile').onchange = e => importCSVWorkouts(e.target.files[0]);
  const ld = $('#ldS'); if (ld) ld.onclick = loadSample;
  const rm = $('#rmS'); if (rm) rm.onclick = removeSample;
  $('#clr').onclick = async () => {
    if (await confirmSheet('Clear all data?', `This permanently deletes ${db.sessions.length} sessions, ${db.nutrition.entries.length} food entries, saved foods, ${db.weights.length} weigh-ins, ${db.belts.length} belt promotions, competitions, benchmarks, injuries, your program and your profile from this device. Export a backup first if you want to keep them.`, 'Clear everything')) {
      db = emptyDb(); save(); form = null; foodDate = null; toast('All data cleared'); go('#/');
    }
  };
}

function exportData(){
  const payload = { app:'forged', version:APP_VERSION, schema:SCHEMA, exportedAt:new Date().toISOString(), profile:db.profile, sessions:db.sessions, nutrition:db.nutrition, weights:db.weights, belts:db.belts, comps:db.comps, benchmarks:db.benchmarks, strength:db.strength, game:db.game, injuries:db.injuries, challenges:db.challenges, program:db.program, ...(db.archive ? { archive:db.archive } : {}) };
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
    const nut = sanitizeNutrition(d.nutrition), wts = sanitizeWeights(src.weights), blt = sanitizeBelts(src.belts), ex = extrasOf(src);
    if (await confirmSheet(`Import ${valid.length} sessions and ${nut.entries.length} food entries?`, `This replaces the ${db.sessions.length} sessions, ${db.nutrition.entries.length} food entries and ${db.weights.length} weigh-ins currently on this device.`, 'Replace & import', false)) {
      db = { schema:SCHEMA, sessions:valid, profile:{ ...defaultProfile(), ...(src.profile||{}), setupDone:true }, nutrition:nut, weights:wts, belts:blt, ...ex }; syncProfileRank(); save(); gameCheck(true); toast(`Imported ${valid.length} sessions`); route();
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
        strike:{ roundLen:3, mix, spar: mix.sparring ? [{ partner:pick(partners), notes:pick(sparNotes) }] : [] }, techniques:[pick(STRIKE_TECH), pick(STRIKE_TECH)].filter((x,j,a) => a.indexOf(x)===j),
        hr: rnd() < .6 ? { avg:148 + Math.round(rnd()*12), max:178 + Math.round(rnd()*10), cal:620 + Math.round(rnd()*150), zones:[4,10,18,20,8] } : undefined, sample:true, createdAt:created });
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
      out.push({ id:uid(), date, category:'cardio', discipline: bike ? 'bike' : 'run', duration:Math.round(sec/60), intensity: 3, cardio:{ distance:dist, unit:'mi', sec },
        hr: { avg: bike ? 132 : 151 + Math.round(rnd()*8), max: bike ? 158 : 172 + Math.round(rnd()*8), cal: Math.round(sec/60 * (bike ? 9 : 12)), zones: bike ? [10, 30, 20, 4, 0].map(x => Math.round(x * sec/3840)) : [2, 6, 12, 8, 2].map(x => Math.round(x * sec/1800)) }, sample:true, createdAt:created });
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
  db.profile = { ...db.profile, setupDone:true, enabled:{ grappling:true, striking:true, mma:true, weights:true, cardio:true, mobility:true, food:true, weight:true } };
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
  const nut = sampleNutrition(), names = new Set(db.nutrition.foods.map(f => f.name.toLowerCase()));
  db.nutrition = { entries: db.nutrition.entries.filter(e => !e.sample).concat(nut.entries), foods: db.nutrition.foods.filter(f => !f.sample).concat(nut.foods.filter(f => !names.has(f.name.toLowerCase()))), water:(db.nutrition.water||[]).filter(x => !x.sample).concat(sampleWater()) };
  if (!db.profile.waterGoal) db.profile = { ...db.profile, waterGoal:2840 };
  if (!db.profile.targets) db.profile = { ...db.profile, targets:{ cal:2300, p:190, c:220, f:75 } };
  if (!db.profile.sampleProfile && !db.profile.goalWeight) db.profile = { ...db.profile, goalWeight:'195', sampleProfile:true };
  if (!db.profile.startWeight && !(db.weights||[]).some(x => !x.sample)) db.profile = { ...db.profile, goalWeight: db.profile.goalWeight || String(Math.round(convW(195, 'lb', unit())*10)/10), startWeight: String(Math.round(convW(215, 'lb', unit())*10)/10), goalDate: db.profile.goalDate || iso(addDays(new Date(), 70)) };
  save(); gameCheck(true); toast(`Loaded ${sessions.length} sample sessions`); route();
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
  db.nutrition = { entries: db.nutrition.entries.filter(e => !e.sample), foods: db.nutrition.foods.filter(f => !f.sample), water:(db.nutrition.water||[]).filter(x => !x.sample) };
  if (db.profile.sampleProfile) db.profile = { ...defaultProfile(), unit:db.profile.unit };
  syncProfileRank();
  save(); gameCheck(true); toast(`Removed ${n} sample sessions`); route();
}

/* ================= 3.1.0: schedule, effort & load, competitions, benchmarks, injuries, monthly challenge, programs ================= */
const isPro = () => true || proActive(); // the one gate for Pro features. Everything is free for now; a earned Pro week (db.game.proUntil) will count once Pro is paid.
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
function weeklyLoad(n=12){
  const start = weekStart(new Date());
  return Array.from({length:n}, (_,i) => { const d = addDays(start, -7*(n-1-i)), k = iso(d); return { key:k, date:d, load:loadBetween(k, iso(addDays(d, 6))) }; });
}
/* hard sessions (effort >= 8) on back-to-back days, from the day before this week's Monday up to today */
function backToBack(ref = new Date()){
  const from = iso(addDays(weekStart(ref), -1)), to = iso(ref), hard = new Set(db.sessions.filter(s => s.date >= from && s.date <= to && rpeOf(s) >= 8).map(s => s.date));
  return [...hard].sort().filter(d => hard.has(iso(addDays(parse(d), -1))) && d > from);
}
function loadChart(weeks){
  const W = 340, H = 150, pt = 18, pb = 22, max = Math.max(1, ...weeks.map(w => w.load)), bw = (W - 8) / weeks.length;
  const avg = weeks.slice(-5, -1).reduce((a,w) => a + w.load, 0) / 4;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly training load, last ${weeks.length} weeks">`;
  for (let g = 0; g <= 2; g++) { const y = pt + (H-pt-pb) * g/2; s += `<line class="grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`; }
  weeks.forEach((w,i) => { const bh = (H-pt-pb) * w.load/max, x = 4 + i*bw + bw*.18, y = H - pb - bh, cur = i === weeks.length - 1;
    s += `<rect class="bar" x="${x.toFixed(1)}" y="${(w.load ? y : H-pb-3).toFixed(1)}" width="${(bw*.64).toFixed(1)}" height="${(w.load ? bh : 3).toFixed(1)}" rx="2" style="fill:${cur ? 'var(--brand)' : '#5a3a22'}"/>`;
    if (w.load && (cur || i % 3 === 2)) s += `<text x="${(x+bw*.32).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" style="fill:${cur?'var(--accent)':'var(--muted)'}">${w.load >= 1000 ? (Math.round(w.load/100)/10) + 'k' : w.load}</text>`;
    if (i % 3 === 2 || cur) s += `<text x="${(x+bw*.32).toFixed(1)}" y="${H-6}" text-anchor="middle">${cur ? 'This wk' : `${w.date.getMonth()+1}/${w.date.getDate()}`}</text>`; });
  if (avg > 0) { const y = H - pb - (H-pt-pb) * avg/max; s += `<line class="goal" x1="0" x2="${W}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text x="${W-2}" y="${(y-4).toFixed(1)}" text-anchor="end" style="fill:#ffc43d">4-wk avg</text>`; }
  return s + '</svg>';
}
function loadCard(){
  const st = loadStatus(), weeks = weeklyLoad(12);
  return `<div class="card" id="loadCard"><h2>Training load <small>minutes × effort</small></h2>
    <div class="acwr"><div><b id="acwrRatio">${st.ratio != null ? st.ratio.toFixed(2) : '—'}</b><span>This week vs 4-wk avg</span></div>${st.label ? `<span class="loadpill ${st.label === 'High load' ? 'high' : st.label === 'Fresh' ? 'fresh' : 'ok'}" id="acwrLabel">${st.label}</span>` : ''}</div>
    <div class="hint" id="acwrText" style="margin:-2px 0 10px">${esc(st.text)}</div>
    ${loadChart(weeks)}
    <div class="wfacts"><div><span>Last 7 days</span><b id="loadAcute">${st.acute.toLocaleString()}</b><small>load</small></div><div><span>4-week average</span><b id="loadChronic">${st.chronic.toLocaleString()}</b><small>load per week</small></div></div>
    <div class="hint" style="margin-top:8px">Load = minutes × effort (RPE 1–10). Fresh &lt; 0.8 · Building 0.8–1.3 · High load &gt; 1.3.</div></div>`;
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
function weekCard(){
  const days = weekDays(), t = today(), hasPlan = Object.values(schedule()).some(a => (a||[]).length) || !!activeProgram();
  const plannedN = days.reduce((a,x) => a + x.planned.length, 0), doneN = days.reduce((a,x) => a + x.planned.filter(c => x.done.includes(c)).length, 0);
  const warn = weekWarnings(), ch = challengeStatus(), bm = benchDue();
  const dot = (c, on) => `<i class="wd ${on ? 'on' : ''}" style="--c:${CATS[c].color}" title="${CATS[c].label}${on ? ' done' : ' planned'}"></i>`;
  return `<div class="card" id="weekCard"><h2>This week ${hasPlan ? `<small>${doneN} of ${plannedN} planned done</small>` : ''}<a class="lnk" href="#/settings/schedule">Schedule ›</a></h2>
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
  toast('Monthly goal hit! 🎉');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('<div class="confetti" aria-hidden="true"></div>'), cols = ['#F2711C','#F5C542','#FFFFFF','#B48CF2','#6FD3A8','#E5484D'];
  for (let i = 0; i < 48; i++) box.appendChild(h(`<i style="left:${Math.random()*100}%;background:${cols[i % cols.length]};animation-delay:${(Math.random()*.35).toFixed(2)}s;animation-duration:${(1.3 + Math.random()*.9).toFixed(2)}s;transform:rotate(${Math.round(Math.random()*360)}deg)"></i>`));
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
}
function challengeHistory(){
  const list = db.challenges.slice().sort((a,b) => b.month.localeCompare(a.month));
  return `<div class="card" id="challengeHist"><h2>Monthly goal <small>${list.length} month${list.length === 1 ? '' : 's'} achieved</small></h2>${list.length ? list.slice(0, 12).map(x => { const [y, m] = x.month.split('-').map(Number); return `<div class="list-row"><div class="grow"><b>${MONTHS[m-1]} ${y}</b><small>${x.n} workouts · goal ${x.target}</small></div><button type="button" class="btn sm" data-sharering="${x.month}" aria-label="Share ${MONTHS[m-1]} ${y}">Share</button></div>`; }).join('') : '<div class="empty" style="padding:4px 0">Hit your monthly goal to start a streak of months.</div>'}</div>`;
}

/* ---- competitions ---- */
const COMP_SPORTS = ['BJJ','No-Gi grappling','Wrestling','Judo','Sambo','Muay Thai','Boxing','Kickboxing','MMA','Other'];
const TAPER_TIPS = ['Cut training volume by about a third to a half', 'Keep the intensity: short, sharp rounds and drilling', 'Sleep 8+ hours, especially the last 3 nights', 'Make weight safely: no crash cuts or severe dehydration; ask a coach if you need to cut', 'Nothing new: same food, same gear, same warm-up'];
function sanitizeComps(l){ return (Array.isArray(l) ? l : []).filter(c => c && isoOk(c.date)).map(c => ({ id:String(c.id || uid()), name:String(c.name || 'Competition').slice(0, 80), date:c.date, sport:String(c.sport || ''), weightClass:String(c.weightClass || ''),
  targetWeight:posOr(c.targetWeight), result:['win','loss','medal'].includes(c.result) ? c.result : '', medal:['gold','silver','bronze'].includes(c.medal) ? c.medal : '', notes:String(c.notes || ''), createdAt:Number(c.createdAt)||0, ...(c.sample ? { sample:true } : {}) })); }
const nextComp = () => db.comps.filter(c => c.date >= today()).sort((a,b) => a.date.localeCompare(b.date))[0];
const daysTo = date => daysBetween(today(), date);
const resultLabel = c => c.result === 'win' ? 'Win' : c.result === 'loss' ? 'Loss' : c.result === 'medal' ? ({ gold:'🥇 Gold', silver:'🥈 Silver', bronze:'🥉 Bronze' }[c.medal] || 'Medal') : '';
function compCard(){
  const c = nextComp(), recent = db.comps.filter(x => x.date < today() && !x.result && daysTo(x.date) >= -7).sort((a,b) => b.date.localeCompare(a.date))[0];
  if (!c && !recent) return '';
  if (!c) return `<div class="card" id="compCard"><h2>${esc(recent.name)} <small>${fmtShort(recent.date)}</small></h2><div class="hint" style="margin:0 0 10px">How did it go? Add your result.</div><button type="button" class="btn block" data-comp="${esc(recent.id)}">Add result</button></div>`;
  const n = daysTo(c.date), g = weightGoal(), tw = Number(c.targetWeight) || 0, gap = tw && g.cur != null ? Math.round((g.cur - tw) * 10) / 10 : null;
  return `<div class="card comp tappable" id="compCard" data-comp="${esc(c.id)}"><div class="cd"><b id="compDays">${n}</b><span>day${n === 1 ? '' : 's'}</span></div>
    <div class="grow"><h2 id="compTitle">${n === 0 ? `Today: ${esc(c.name)}` : `${n} day${n === 1 ? '' : 's'} to ${esc(c.name)}`}${c.sample ? ' <span class="pill sample">Sample</span>' : ''}</h2>
    <div class="cmeta">${[fmtDate(c.date), c.sport, c.weightClass].filter(Boolean).map(esc).join(' · ')}</div>
    ${tw ? `<div class="cmeta">Target weight <b>${tw} ${unit()}</b>${gap != null ? ` · ${gap > 0 ? `${gap} ${unit()} to go` : 'on weight ✓'}` : ''}</div>` : ''}</div>
    ${n <= 7 ? `<div class="taper" id="taperTips"><b>Final week</b><ul>${TAPER_TIPS.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}</div>`;
}
function compSheet(id){
  const ex = db.comps.find(c => c.id === id), c = ex ? { ...ex } : { id:uid(), name:'', date:iso(addDays(new Date(), 28)), sport:enabled('grappling') ? 'BJJ' : COMP_SPORTS[5], weightClass:'', targetWeight:'', result:'', medal:'', notes:'', createdAt:Date.now() };
  const past = () => c.date < today();
  const el = h(`<div><h3>${ex ? 'Competition' : 'Add competition'}</h3></div>`);
  const name = h(`<input class="input" type="text" autocapitalize="words" placeholder="e.g. Riverside Open" value="${esc(c.name)}" id="compName">`); name.oninput = () => c.name = name.value;
  const date = h(`<input class="input" type="date" value="${esc(c.date)}" id="compDate">`);
  el.appendChild(field('Name', name)); el.appendChild(field('Date', date));
  el.appendChild(field('Sport', seg(COMP_SPORTS.map(x => [x, x]), c.sport, x => c.sport = x, true)));
  const g = h('<div class="grid2"></div>');
  const wc = h(`<input class="input" type="text" placeholder="Optional" value="${esc(c.weightClass)}" id="compClass">`); wc.oninput = () => c.weightClass = wc.value;
  const tw = h(`<input class="input" type="text" inputmode="decimal" placeholder="Optional" value="${esc(c.targetWeight)}" id="compTarget">`); tw.oninput = () => c.targetWeight = tw.value.replace(/[^\d.]/g, '');
  g.appendChild(field('Weight class', wc)); g.appendChild(field(`Target weight (${unit()})`, tw)); el.appendChild(g);
  const res = h('<div id="compResult"></div>');
  const drawRes = () => { res.innerHTML = ''; if (!past()) return;
    res.appendChild(field('Result', seg([['win','Win'],['loss','Loss'],['medal','Medal']], c.result, x => { c.result = x; drawRes(); })));
    if (c.result === 'medal') res.appendChild(field('Medal', seg([['gold','🥇 Gold'],['silver','🥈 Silver'],['bronze','🥉 Bronze']], c.medal, x => c.medal = x)));
    const nt = h(`<textarea class="input" rows="3" placeholder="How did it go? What to work on?">${esc(c.notes)}</textarea>`); nt.oninput = () => c.notes = nt.value; res.appendChild(field('Notes', nt)); };
  date.onchange = () => { c.date = date.value || c.date; drawRes(); };
  el.appendChild(res); drawRes();
  const btns = h(`<div style="display:flex;gap:10px;margin-top:8px">${ex ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}<button type="button" class="btn primary" style="flex:1" data-save>${ex ? 'Save' : 'Add competition'}</button></div>`);
  btns.querySelector('[data-save]').onclick = () => { if (!c.name.trim()) { toast('Add a name'); name.focus(); return; }
    const rec = sanitizeComps([{ ...c, name:c.name.trim(), sample:false }])[0]; db.comps = db.comps.filter(x => x.id !== rec.id).concat(rec); save(); closeSheet(); toast(ex ? 'Competition saved' : 'Competition added'); whenSettled(route); };
  const del = btns.querySelector('[data-del]'); if (del) del.onclick = () => { const before = db.comps.slice(); db.comps = db.comps.filter(x => x.id !== c.id); save(); closeSheet(); undoToast('Competition deleted', () => { db.comps = before; save(); route(); }); whenSettled(route); };
  el.appendChild(btns); openSheet(el, null, { closeLabel:'Cancel' });
}
function compsList(list){ return list.map(c => `<button type="button" class="list-row comprow" data-comp="${esc(c.id)}"><div class="grow"><b>${esc(c.name)}</b><small>${[fmtShort(c.date), c.sport, c.weightClass].filter(Boolean).map(esc).join(' · ')}${c.notes && c.date < today() ? ` · ${esc(c.notes.slice(0, 60))}` : ''}</small></div>${c.date >= today() ? `<span class="pill">${daysTo(c.date)} d</span>` : c.result ? `<span class="pill res-${c.result}">${resultLabel(c)}</span>` : '<span class="pill">Add result</span>'}${c.sample ? '<span class="pill sample">Sample</span>' : ''}</button>`).join(''); }
function wireComps(root){ root.querySelectorAll('[data-comp]').forEach(b => b.onclick = e => { if (e.target.closest('a')) return; compSheet(b.dataset.comp); }); root.querySelectorAll('[data-addcomp]').forEach(b => b.onclick = () => compSheet(null)); }
function viewComps(){
  setHeader('History', `<a class="btn sm" href="#/stats">Stats</a>`);
  const v = $('#view'), up = db.comps.filter(c => c.date >= today()).sort((a,b) => a.date.localeCompare(b.date)), past = db.comps.filter(c => c.date < today()).sort((a,b) => b.date.localeCompare(a.date));
  const w = past.filter(c => c.result === 'win').length, l = past.filter(c => c.result === 'loss').length, m = past.filter(c => c.result === 'medal').length;
  v.innerHTML = `${histSeg('comps')}<div class="card" id="compsCard"><h2>Upcoming</h2>${up.length ? compsList(up) : '<div class="empty" style="padding:4px 0">No upcoming competitions.</div>'}<button type="button" class="btn primary block" data-addcomp style="margin-top:12px">Add competition</button></div>
    <div class="card" id="pastComps"><h2>Past <small>${w}W · ${l}L · ${m} medal${m === 1 ? '' : 's'}</small></h2>${past.length ? compsList(past) : '<div class="empty" style="padding:4px 0">Past competitions and results show here.</div>'}</div>`;
  wireComps(v);
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
function benchCard(){
  const due = benchDue();
  return `<div class="card" id="benchCard"><h2>Benchmarks <a class="lnk" href="#/benchmarks">All ›</a></h2>${due.due ? `<div class="warnline nudge" style="margin:0 0 8px">📏 ${esc(due.text)}</div>` : due.last ? `<div class="hint" style="margin:-4px 0 6px">${esc(due.text)}</div>` : ''}${benchRows(true) || '<div class="empty" style="padding:4px 0 10px">Test pull-ups, push-ups, dead hang, plank and your main lifts every 6 weeks.</div>'}<button type="button" class="btn block" data-benchlog style="margin-top:10px">Log a test</button></div>`;
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
  btns.querySelector('[data-save]').onclick = () => { if (!x.area) { toast('Pick an area'); return; } const rec = sanitizeInjuries([{ ...x, sample:false }])[0]; db.injuries = db.injuries.filter(i => i.id !== rec.id).concat(rec); save(); closeSheet(); toast(ex ? 'Saved' : 'Injury logged'); whenSettled(route); };
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
  if (nx.done) return `<div class="card" id="progCard"><h2>${esc(t.name)} <small>complete 🎉</small></h2><div class="hint" style="margin:-4px 0 10px">Nice work. Retest your benchmarks, then pick your next block.</div><a class="btn block" href="#/programs">Programs</a></div>`;
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
function viewPrograms(){
  setHeader('Programs', '', { parent:'#/settings' });
  const v = $('#view');
  if (!isPro()) { v.innerHTML = `<div class="card"><h2>Programs</h2><div class="empty">Lifting programs for grapplers are part of Forged Pro.</div></div>`; return; }
  const p = activeProgram(), t = p && tmplOf(p.tid), nx = p && progNext(p);
  v.innerHTML = `${p ? `<div class="card" id="activeProg"><h2>Current program</h2><div class="list-row"><div class="grow"><b>${esc(t.name)}</b><small>Started ${fmtShort(p.start)} · ${p.weeks} weeks · ${p.days.map(d => DOW[d]).join('/')} · ${nx.done ? 'complete' : `${nx.doneN}/${nx.sch.length} done`}</small></div></div>
      ${!nx.done ? `<button type="button" class="btn primary block" data-progi="${nx.item.i}" style="margin-top:10px">${nx.due ? 'Start today\u2019s workout' : 'Start next workout'}</button>` : ''}<button type="button" class="btn block ghost" id="endProg" style="margin-top:8px">End program</button></div>` : ''}
    <div class="card" id="progList"><h2>Strength programs for grapplers</h2>${PROG.templates.map(x => `<a class="list-row tmpl" href="#/program/${x.id}" data-tmpl="${x.id}"><div class="grow"><b>${esc(x.name)}</b><small>${esc(x.short)} · ${x.lengths ? `${x.lengths[0]}–${x.lengths[x.lengths.length-1]}` : x.weeks} weeks · ${x.days} days/wk</small></div>${p && p.tid === x.id ? '<span class="pill">Active</span>' : ''}<span class="chev">›</span></a>`).join('')}</div>
    <div class="card" id="finList"><h2>Add-on finishers <small>8–10 min after any session</small></h2>${PROG.finishers.map(f => `<a class="list-row" href="#/program/fin-${f.id}"><div class="grow"><b>${esc(f.name)}</b><small>${esc(f.short)} · ${f.ex.length} exercises</small></div>${p && (p.finishers||[]).includes(f.id) ? '<span class="pill">Added</span>' : ''}<span class="chev">›</span></a>`).join('')}</div>
    <div class="disclaimer" id="progDisclaimer">⚠️ ${esc(PROG.disclaimer)}</div>`;
  wireProg(v);
  const end = $('#endProg'); if (end) end.onclick = async () => { if (await confirmSheet('End this program?', 'Your logged workouts stay in History.', 'End program')) { db.program = null; save(); toast('Program ended'); route(); } };
}
function viewProgram(id){
  const fin = id.startsWith('fin-') ? finOf(id.slice(4)) : null, t = fin ? null : tmplOf(id);
  if (!fin && !t) { go('#/programs'); return; }
  setHeader(fin ? `${fin.name} finisher` : t.name, '', { parent:'#/programs' });
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
function programProfileCard(){
  const p = activeProgram(), t = p && tmplOf(p.tid), nx = p && progNext(p);
  return h(`<div class="card" id="programsCard"><h2>Programs <a class="lnk" href="#/programs">Browse ›</a></h2>${p ? `<div class="list-row"><div class="grow"><b>${esc(t.name)}</b><small>${nx.done ? 'Complete' : `${nx.doneN}/${nx.sch.length} sessions · next ${fmtShort(nx.item.date)}`}</small></div></div>` : '<div class="hint" style="margin:-4px 0 10px">Lifting templates built around your mat training: 2-day, 3-day, home, comp prep and finishers.</div>'}<a class="btn block" href="#/programs" style="margin-top:8px">${p ? 'Manage program' : 'See programs'}</a></div>`);
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
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { const box = h('<div class="confetti" aria-hidden="true"></div>'), cols = ['#F2711C','#F5C542','#FFFFFF','#B48CF2','#6FD3A8'];
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
  return { comps:sanitizeComps(d.comps), benchmarks:sanitizeBench(d.benchmarks), strength:sanitizeStrength(d.strength), game:sanitizeGame(d.game), injuries:sanitizeInjuries(d.injuries),
    challenges:(Array.isArray(d.challenges) ? d.challenges : []).filter(x => x && /^\d{4}-\d{2}$/.test(x.month)).filter((x, i, a) => a.findIndex(y => y.month === x.month) === i).map(x => ({ month:x.month, n:Math.max(0, Number(x.n)||0), target:Math.max(1, Number(x.target)||8), ...(x.sample ? { sample:true } : {}) })),
    program:sanitizeProgram(d.program), ...(d.archive && Object.keys(d.archive).length ? { archive:d.archive } : {}) };
}
const hasSampleData = () => db.sessions.some(s => s.sample) || db.nutrition.entries.some(e => e.sample) || db.comps.some(c => c.sample) || db.injuries.some(x => x.sample) || db.benchmarks.some(x => x.sample) || db.strength.some(x => x.sample);
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
  g = g && typeof g === 'object' ? g : {};
  const arr = a => Array.isArray(a) ? a : [];
  return { ...(Number.isFinite(g.rankSeen) ? { rankSeen:g.rankSeen } : {}), ...(Number.isFinite(g.levelSeen) ? { levelSeen:g.levelSeen } : {}),
    seenDone:arr(g.seenDone).map(String).slice(-400), seenBadges:arr(g.seenBadges).map(String),
    look:{ accent:String(g.look?.accent || 'flame'), frame:String(g.look?.frame || 'classic'), flair:String(g.look?.flair || 'none') },
    ...(isoOk(g.proUntil) ? { proUntil:g.proUntil, proGranted:isoOk(g.proGranted) ? g.proGranted : g.proUntil } : {}),
    friend:arr(g.friend).filter(x => x && x.code && x.title).slice(-20) };
}
const game = () => (db.game = db.game && db.game.look ? db.game : sanitizeGame(db.game));

/* ---------- challenge pool ----------
   period d/w/m, tier 1-3 (Easy/Medium/Hard), need(): eligible for this user, val(ctx): progress value. */
const TIER = ['', 'Easy', 'Medium', 'Hard'];
const CH_XP = { d:[0, 30, 50, 75], w:[0, 100, 150, 200], m:[0, 300, 400, 500] };
const has = c => enabled(c);
const combat = () => ['grappling','striking','mma'].some(has);
const sumBy = (l, f) => l.reduce((a, x) => a + (f(x) || 0), 0);
const grRounds = s => s.category === 'grappling' ? (Number(s.rounds) || (s.rolls||[]).length || 0) : s.category === 'mma' ? (s.strike?.mix?.grappling || 0) : 0;
const sparRounds = s => (s.category === 'striking' || s.category === 'mma') ? (s.strike?.mix?.sparring || 0) : 0;
const setsOf = s => (s.exercises||[]).reduce((a, e) => a + (e.sets||[]).filter(x => Number(x.reps) > 0).length, 0);
const daysMeeting = (from, to, f) => { let n = 0; for (let d = parse(from); iso(d) <= to; d = addDays(d, 1)) if (f(iso(d))) n++; return n; };
const waterOk = day => waterGoalMl() && waterOn(day) >= waterGoalMl();
const protOk = day => goals().p && totals(entriesOn(day)).p >= goals().p;
const CH_POOL = [
  // daily
  { id:'d-log', p:'d', tier:1, t:'Log a workout today', goal:1, val:c => c.s.length },
  { id:'d-feel', p:'d', tier:1, t:'Log how a session felt', goal:1, val:c => c.s.filter(s => s.feel).length },
  { id:'d-mob', p:'d', tier:1, need:() => has('mobility'), t:'Log a mobility session', goal:1, val:c => c.s.filter(s => s.category === 'mobility').length },
  { id:'d-water', p:'d', tier:1, need:() => has('food') && waterGoalMl(), t:'Hit your water goal today', goal:1, val:c => waterOk(c.from) ? 1 : 0 },
  { id:'d-cardio', p:'d', tier:1, need:() => has('cardio'), t:'20 minutes of cardio', goal:20, unit:'min', val:c => sumBy(c.s.filter(s => s.category === 'cardio'), sessMin) },
  { id:'d-roll5', p:'d', tier:2, need:() => has('grappling') || has('mma'), t:'Roll 5 rounds today', goal:5, unit:'rounds', val:c => sumBy(c.s, grRounds) },
  { id:'d-spar3', p:'d', tier:2, need:() => has('striking') || has('mma'), t:'Spar 3 rounds today', goal:3, unit:'rounds', val:c => sumBy(c.s, sparRounds) },
  { id:'d-60', p:'d', tier:2, t:'Train 60 minutes today', goal:60, unit:'min', val:c => sumBy(c.s, sessMin) },
  { id:'d-sets', p:'d', tier:2, need:() => has('weights'), t:'Log 15 working sets', goal:15, unit:'sets', val:c => sumBy(c.s, setsOf) },
  { id:'d-protein', p:'d', tier:2, need:() => has('food') && goals().p, t:'Hit your protein goal today', goal:1, val:c => protOk(c.from) ? 1 : 0 },
  { id:'d-hard', p:'d', tier:3, t:'Go hard: a session at effort 8+', goal:1, val:c => c.s.filter(s => rpeOf(s) >= 8).length },
  { id:'d-double', p:'d', tier:3, t:'Two sessions in one day', goal:2, val:c => c.s.length },
  { id:'d-90', p:'d', tier:3, need:combat, t:'90 minutes on the mats', goal:90, unit:'min', val:c => sumBy(c.s.filter(s => ['grappling','striking','mma'].includes(s.category)), sessMin) },
  // weekly
  { id:'w-3', p:'w', tier:1, t:'3 sessions this week', goal:3, val:c => c.s.length },
  { id:'w-mob2', p:'w', tier:1, need:() => has('mobility'), t:'2 mobility sessions', goal:2, val:c => c.s.filter(s => s.category === 'mobility').length },
  { id:'w-weigh3', p:'w', tier:1, need:() => has('weight'), t:'Weigh in 3 times', goal:3, val:c => weightSeries().filter(x => x.date >= c.from && x.date <= c.to).length },
  { id:'w-4', p:'w', tier:2, t:'4 sessions this week', goal:4, val:c => c.s.length },
  { id:'w-5h', p:'w', tier:2, t:'5 training hours', goal:300, unit:'min', fmt:v => `${hrs(v)} / 5 h`, val:c => sumBy(c.s, sessMin) },
  { id:'w-water5', p:'w', tier:2, need:() => has('food') && waterGoalMl(), t:'Drink your water goal 5 days', goal:5, unit:'days', val:c => daysMeeting(c.from, c.to, waterOk) },
  { id:'w-roll20', p:'w', tier:2, need:() => has('grappling') || has('mma'), t:'20 rounds of rolling', goal:20, unit:'rounds', val:c => sumBy(c.s, grRounds) },
  { id:'w-spar8', p:'w', tier:2, need:() => has('striking') || has('mma'), t:'8 sparring rounds', goal:8, unit:'rounds', val:c => sumBy(c.s, sparRounds) },
  { id:'w-cardio60', p:'w', tier:2, need:() => has('cardio'), t:'60 minutes of cardio', goal:60, unit:'min', val:c => sumBy(c.s.filter(s => s.category === 'cardio'), sessMin) },
  { id:'w-3cat', p:'w', tier:3, need:() => CAT_KEYS.filter(has).length >= 3, t:'Hit 3 different categories', goal:3, unit:'categories', val:c => new Set(c.s.map(s => s.category)).size },
  { id:'w-pr', p:'w', tier:3, need:() => has('weights'), t:'Hit a new PR', goal:1, unit:'PR', val:c => c.prs },
  { id:'w-6', p:'w', tier:3, t:'6 sessions this week', goal:6, val:c => c.s.length },
  // monthly
  { id:'m-ring', p:'m', tier:1, t:'Hit your monthly workout goal', goal:() => clamp(Math.round(Number(db.profile.challengeTarget) || 8), 1, 31), val:c => c.s.length },
  { id:'m-bench', p:'m', tier:1, t:'Log a benchmark test', goal:1, val:c => db.benchmarks.filter(b => b.key !== 'bw' && b.date >= c.from && b.date <= c.to).length },
  { id:'m-12', p:'m', tier:2, t:'12 sessions this month', goal:12, val:c => c.s.length },
  { id:'m-water20', p:'m', tier:2, need:() => has('food') && waterGoalMl(), t:'Water goal on 20 days', goal:20, unit:'days', val:c => daysMeeting(c.from, c.to, waterOk) },
  { id:'m-2pr', p:'m', tier:2, need:() => has('weights'), t:'2 new PRs this month', goal:2, unit:'PRs', val:c => c.prs },
  { id:'m-20h', p:'m', tier:3, need:combat, t:'20 mat hours this month', goal:1200, unit:'min', fmt:v => `${hrs(v)} / 20 h`, val:c => sumBy(c.s.filter(s => ['grappling','striking','mma'].includes(s.category)), sessMin) },
  { id:'m-all', p:'m', tier:3, need:() => CAT_KEYS.filter(has).length >= 2, t:'Train every category you track', goal:() => CAT_KEYS.filter(has).length, unit:'categories', val:c => new Set(c.s.map(s => s.category).filter(has)).size },
  { id:'m-16', p:'m', tier:3, t:'16 sessions this month', goal:16, val:c => c.s.length }
];
const CH_COUNT = { d:3, w:3, m:3 };
const chGoal = t => typeof t.goal === 'function' ? t.goal() : t.goal;
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
  const goal = chGoal(t), v = t.val({ s, from:per.from, to:per.to, prs:prs.filter(e => e.fair && e.date >= per.from && e.date <= per.to).length }) || 0;
  return { id:t.id, key:`${per.key}:${t.id}`, p:t.p, tier:t.tier, title:t.t, goal, value:v, pct:Math.min(100, Math.round(v / goal * 100)), done:v >= goal, xp:CH_XP[t.p][t.tier],
    progress:t.fmt ? t.fmt(v) : `${Math.min(v, goal) === v ? Math.round(v * 10) / 10 : Math.round(v)} / ${goal}${t.unit ? ' ' + t.unit : ''}`, from:per.from, to:per.to, period:per.key };
}
function currentChallenges(){ const prs = prEvents(); return ['d','w','m'].flatMap(p => { const per = periodOf(p); return pickChallenges(p, per.key).map(t => evalChallenge(t, per, prs)); }); }
function timeLeft(to){
  const end = addDays(parse(to), 1).getTime(), ms = Math.max(0, end - Date.now()), d = Math.floor(ms / G_DAY), hh = Math.floor(ms % G_DAY / 36e5), mm = Math.floor(ms % 36e5 / 6e4);
  return d >= 2 ? `${d} days left` : d === 1 ? `1 day ${hh}h left` : hh ? `${hh}h ${mm}m left` : `${mm}m left`;
}

/* ---------- XP (recomputed from history) ---------- */
const XP_LOG = 10, XP_LOG_CAP = 30, XP_STREAK = 20, XP_PR = 25, XP_GOAL = 50, XP_RING = 100;
const RANKS = [['Apprentice',1],['Striker',5],['Journeyman',10],['Smith',15],['Blacksmith',20],['Master Smith',25],['Forgemaster',30],['Forged',35]];
const PRO_RANK = 5; // reaching Master Smith grants 7 days of Pro
const xpForLevel = L => 100 * L * (L - 1);
const levelOf = xp => { let L = 1; while (xpForLevel(L + 1) <= xp) L++; return L; };
const rankIdx = L => RANKS.reduce((a, r, i) => L >= r[1] ? i : a, 0);
let gCache = null, gCacheKey = '';
function gameState(){
  const key = JSON.stringify([db.sessions.length, db.sessions.reduce((a, s) => a + (s.updatedAt || s.createdAt || 0) % 1e7 + (s.duration||0), 0), db.strength.length, db.strength.filter(g => g.achieved).length, db.benchmarks.length, (db.nutrition.water||[]).length, db.nutrition.entries.length, db.weights.length, db.profile.challengeTarget, JSON.stringify(db.profile.enabled), db.profile.waterGoal, JSON.stringify(db.profile.targets||{}), db.comps.length, (db.belts||[]).length, today()]);
  if (gCache && gCacheKey === key) return gCache;
  const parts = { log:0, challenges:0, streak:0, pr:0, goals:0, ring:0 }, done = [];
  // logging: 10 XP per workout, max 30 XP per day
  const perDay = countBy(db.sessions.map(s => s.date));
  perDay.forEach(([, n]) => parts.log += Math.min(XP_LOG_CAP, n * XP_LOG));
  // week streaks: every week that continues a streak
  const weeks = new Set(db.sessions.map(s => gWeekKey(s.date)));
  weeks.forEach(w => { if (weeks.has(iso(addDays(parse(w), -7)))) parts.streak += XP_STREAK; });
  // PRs + strength goals hit
  const prs = prEvents(); parts.pr = prs.length * XP_PR;
  parts.goals = db.strength.filter(g => g.achieved).length * XP_GOAL;
  // monthly target
  const months = countBy(db.sessions.map(s => s.date.slice(0, 7))), tgt = clamp(Math.round(Number(db.profile.challengeTarget) || 8), 1, 31);
  months.forEach(([m, n]) => { const rec = db.challenges.find(x => x.month === m); if (n >= (rec ? rec.target : tgt)) parts.ring += XP_RING; });
  // challenges: every day/week/month since the first workout (only finished ones, or current ones already complete)
  const dates = db.sessions.map(s => s.date).sort();
  if (dates.length) {
    const first = dates[0] < iso(addDays(new Date(), -730)) ? iso(addDays(new Date(), -730)) : dates[0], t0 = today(), seen = new Set();
    for (let d = parse(first); iso(d) <= t0; d = addDays(d, 1)) {
      const day = iso(d);
      ['d','w','m'].forEach(p => { const per = periodOf(p, day); if (seen.has(per.key)) return; seen.add(per.key);
        pickChallenges(p, per.key).forEach(t => { const r = evalChallenge(t, per, prs); if (r.done) { done.push(r); parts.challenges += r.xp; } }); });
    }
  }
  const xp = Object.values(parts).reduce((a, b) => a + b, 0), level = levelOf(xp), ri = rankIdx(level);
  gCache = { xp, parts, level, rank:RANKS[ri][0], rankIdx:ri, next:xpForLevel(level + 1), cur:xpForLevel(level), done, prs,
    nextRank: RANKS[ri + 1] ? { name:RANKS[ri + 1][0], level:RANKS[ri + 1][1], xp:xpForLevel(RANKS[ri + 1][1]) } : null };
  gCache.pct = Math.min(100, Math.round((xp - gCache.cur) / Math.max(1, gCache.next - gCache.cur) * 100));
  gCacheKey = key; return gCache;
}
const proActive = () => !!(game().proUntil && game().proUntil >= today());

/* ---------- badges ---------- */
function dayStreakMax(){
  const days = [...new Set(db.sessions.map(s => s.date))].sort(); let best = 0, run = 0, prev = null;
  days.forEach(d => { run = prev && iso(addDays(parse(prev), 1)) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}
const BADGES = [
  { id:'first', icon:'🔨', name:'First strike', how:'Log your first workout', test:s => s.n >= 1 },
  { id:'s10', icon:'🔥', name:'10 sessions', how:'Log 10 workouts', test:s => s.n >= 10 },
  { id:'s50', icon:'⚒️', name:'50 sessions', how:'Log 50 workouts', test:s => s.n >= 50 },
  { id:'s100', icon:'🛡️', name:'100 sessions', how:'Log 100 workouts', test:s => s.n >= 100 },
  { id:'s250', icon:'🏛️', name:'250 sessions', how:'Log 250 workouts', test:s => s.n >= 250 },
  { id:'d7', icon:'📅', name:'7-day streak', how:'Train 7 days in a row', test:s => s.ds >= 7 },
  { id:'d30', icon:'🗓️', name:'30-day streak', how:'Train 30 days in a row', test:s => s.ds >= 30 },
  { id:'d100', icon:'💯', name:'100-day streak', how:'Train 100 days in a row', test:s => s.ds >= 100 },
  { id:'comp', icon:'🥋', name:'Competitor', how:'Compete once (add a past competition or log a Competition session)', test:s => s.comp },
  { id:'medal', icon:'🥇', name:'On the podium', how:'Win a medal at a competition', test:() => db.comps.some(c => c.result === 'medal') },
  { id:'pr', icon:'📈', name:'First PR', how:'Beat a lift you logged before', test:s => s.prs >= 1 },
  { id:'goal', icon:'🎯', name:'Goal crusher', how:'Hit a strength goal', test:() => db.strength.some(g => g.achieved) },
  { id:'belt', icon:'🎖️', name:'Promoted', how:'Log a belt or stripe promotion', test:() => (db.belts||[]).length >= 2 },
  { id:'allcats', icon:'🌐', name:'All-rounder', how:'Try all six workout types', test:() => CAT_KEYS.every(c => db.sessions.some(s => s.category === c)) },
  { id:'ch1', icon:'⭐', name:'Challenger', how:'Complete a challenge', test:s => s.ch >= 1 },
  { id:'ch25', icon:'🌟', name:'Challenge hunter', how:'Complete 25 challenges', test:s => s.ch >= 25 },
  { id:'ring', icon:'⭕', name:'Ring closed', how:'Hit your monthly workout goal', test:s => s.ring },
  { id:'bench', icon:'📏', name:'Tested', how:'Log a benchmark test', test:() => db.benchmarks.some(b => b.key !== 'bw') },
  { id:'h100', icon:'⏱️', name:'100 hours', how:'Train 100 hours in total', test:s => s.min >= 6000 },
  { id:'lv10', icon:'⚙️', name:'Journeyman', how:'Reach level 10', test:s => s.level >= 10 }
];
function badgeState(){
  const gs = gameState(), st = { n:db.sessions.length, ds:dayStreakMax(), comp:db.comps.some(c => c.date < today()) || db.sessions.some(s => s.type === 'comp'), prs:gs.prs.length, ch:gs.done.length, ring:gs.parts.ring > 0, min:sumBy(db.sessions, sessMin), level:gs.level };
  return BADGES.map(b => ({ ...b, earned:!!b.test(st) }));
}

/* ---------- unlockable looks ---------- */
const LOOKS = {
  accent:[
    { id:'flame', name:'Flame', col:'#F2711C', how:'Default' },
    { id:'ember', name:'Ember', col:'#E5484D', how:'Reach Striker (level 5)', unlock:g => g.level >= 5 },
    { id:'steel', name:'Steel', col:'#8FB0D9', how:'Reach Journeyman (level 10)', unlock:g => g.level >= 10 },
    { id:'gold', name:'Molten gold', col:'#F5C542', how:'Reach Smith (level 15)', unlock:g => g.level >= 15 },
    { id:'jade', name:'Jade', col:'#6FD3A8', how:'Earn the 50 sessions badge', unlock:(g, b) => b.s50 },
    { id:'violet', name:'Damascus violet', col:'#B48CF2', how:'Reach Blacksmith (level 20)', unlock:g => g.level >= 20 }
  ],
  frame:[
    { id:'classic', name:'Classic', how:'Default' },
    { id:'ember', name:'Ember glow', how:'Earn the Challenger badge', unlock:(g, b) => b.ch1 },
    { id:'gold', name:'Gold edge', how:'Earn the First PR badge', unlock:(g, b) => b.pr },
    { id:'damascus', name:'Damascus', how:'Reach Master Smith (level 25)', unlock:g => g.level >= 25 }
  ],
  flair:[
    { id:'none', name:'None', sym:'', how:'Default' },
    { id:'flame', name:'Flame', sym:'🔥', how:'Earn the 10 sessions badge', unlock:(g, b) => b.s10 },
    { id:'hammer', name:'Hammers', sym:'⚒️', how:'Earn the 7-day streak badge', unlock:(g, b) => b.d7 },
    { id:'medal', name:'Medal', sym:'🥇', how:'Earn the Competitor badge', unlock:(g, b) => b.comp },
    { id:'crown', name:'Crown', sym:'👑', how:'Reach Forgemaster (level 30)', unlock:g => g.level >= 30 }
  ]
};
function lookUnlocked(kind, id){ const it = LOOKS[kind].find(x => x.id === id); if (!it) return false; if (!it.unlock) return true;
  const b = Object.fromEntries(badgeState().map(x => [x.id, x.earned])); return !!it.unlock(gameState(), b); }
function currentLook(){ const l = game().look; return { accent: lookUnlocked('accent', l.accent) ? l.accent : 'flame', frame: lookUnlocked('frame', l.frame) ? l.frame : 'classic', flair: lookUnlocked('flair', l.flair) ? l.flair : 'none' }; }
function applyLook(){ try { const a = currentLook().accent; if (a === 'flame') delete document.documentElement.dataset.look; else document.documentElement.dataset.look = a; } catch(e) {} }
const flairSym = () => (LOOKS.flair.find(x => x.id === currentLook().flair) || {}).sym || '';

/* ---------- celebrations: run after renders; first run after upgrade/sample load records silently ---------- */
function gameCheck(silent){
  // storage changed outside this tab's view of it (another tab, a restore): never overwrite it from a background check
  try { const raw = localStorage.getItem(STORE_KEY); if (!silent && lastRaw != null && raw != null && raw !== lastRaw) return; } catch(e) {}
  const before = JSON.stringify(db.game || null);
  const save = () => { if (JSON.stringify(db.game) !== before) saveDb(); };
  const g = game(), gs = gameState(), cur = currentChallenges(), doneNow = cur.filter(c => c.done).map(c => c.key);
  const allDone = gs.done.map(c => c.key), bs = badgeState().filter(b => b.earned).map(b => b.id);
  if (silent || g.rankSeen == null) {
    gPending = null;   // sample load / import / first run: drop celebrations queued for the old data
    const first = g.rankSeen == null && !silent && db.sessions.some(s => !s.sample);
    g.rankSeen = gs.rankIdx; g.levelSeen = gs.level; g.seenDone = [...new Set([...g.seenDone, ...allDone, ...doneNow])].slice(-400); g.seenBadges = bs;
    if (gs.rankIdx >= PRO_RANK && !g.proUntil && !silent && db.sessions.some(s => !s.sample)) grantPro();
    save(); if (first) toast(`You start at ${gs.rank} · level ${gs.level} (${gs.xp.toLocaleString()} XP from your history)`); return;
  }
  const fresh = doneNow.filter(k => !g.seenDone.includes(k)), newBadges = bs.filter(b => !g.seenBadges.includes(b));
  g.seenDone = [...new Set([...g.seenDone, ...allDone, ...doneNow])].slice(-400); g.seenBadges = bs;
  let rankUp = null;
  if (gs.rankIdx > g.rankSeen) { rankUp = gs; if (gs.rankIdx >= PRO_RANK && !g.proUntil) grantPro(); }
  const lvlUp = gs.level > (g.levelSeen || 0); g.rankSeen = Math.max(g.rankSeen, gs.rankIdx); g.levelSeen = Math.max(g.levelSeen || 0, gs.level); save();
  fresh.forEach(k => { const c = cur.find(x => x.key === k); ForgedSync.emit('challenge.done', { key:k, xp:c.xp }); });
  newBadges.forEach(b => ForgedSync.emit('badge.earned', { id:b }));
  // queue celebrations (merged with any not yet shown); a later reset of the data drops them
  if (!(rankUp || fresh.length || newBadges.length || lvlUp)) return;
  const q = gPending && gPending.db === db ? gPending : { db, fresh:[], badges:[] };
  if (rankUp) q.rankUp = rankUp; if (lvlUp) q.lvl = gs;
  q.fresh.push(...fresh.map(k => cur.find(x => x.key === k))); q.badges.push(...newBadges);
  const scheduled = gPending === q; gPending = q; if (scheduled) return;
  const run = () => {
    const p = gPending; gPending = null; if (!p || p.db !== db) return;
    if (p.rankUp) return rankUpSheet(p.rankUp);
    if (p.fresh.length) { const c = p.fresh[0]; return actionToast(`Challenge complete: ${c.title} · +${c.xp} XP`, 'Share', () => shareSheet('challenge', c)); }
    if (p.badges.length) { const b = BADGES.find(x => x.id === p.badges[0]); return actionToast(`Badge earned: ${b.icon} ${b.name}`, 'See', () => go('#/badges')); }
    if (p.lvl) toast(`Level ${p.lvl.level} · ${p.lvl.rank}`);
  };
  // wait for open sheets and undo toasts so a celebration never replaces them
  const tryRun = (n = 0) => { if (gPending !== q) return; if (!$('#sheet').hidden || $('#toast').classList.contains('act')) { if (n < 12) setTimeout(() => tryRun(n + 1), 1200); else gPending = null; return; } run(); };
  setTimeout(() => whenSettled(() => tryRun()), 700);
}
let gPending = null;
function grantPro(){ const g = game(); g.proGranted = today(); g.proUntil = iso(addDays(new Date(), 7)); ForgedSync.emit('pro.granted', { until:g.proUntil }); }
function actionToast(msg, label, fn){
  const t = $('#toast'); t.innerHTML = `${esc(msg)} <button type="button" class="tbtn">${esc(label)}</button>`; t.classList.add('show', 'act');
  t.querySelector('.tbtn').onclick = () => { t.classList.remove('show','act'); fn(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show','act'), 5000);
}
function confettiBurst(){
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('<div class="confetti" aria-hidden="true"></div>'), cols = ['#F2711C','#F5C542','#FFFFFF','#E5484D','#B48CF2'];
  for (let i = 0; i < 44; i++) box.appendChild(h(`<i style="left:${Math.random()*100}%;background:${cols[i % cols.length]};animation-delay:${(Math.random()*.35).toFixed(2)}s;animation-duration:${(1.3 + Math.random()*.9).toFixed(2)}s"></i>`));
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
}
function rankEmblem(ri, size = 96){
  const col = ['#9AA3AE','#F2711C','#E5484D','#8FB0D9','#F5C542','#6FD3A8','#B48CF2','#FFFFFF'][ri] || '#F2711C';
  return `<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4 90 22v28c0 24-17 40-40 46C27 90 10 74 10 50V22z" fill="#141416" stroke="${col}" stroke-width="5"/><path d="M30 56h40l-6 8H36zM34 46h32v8H34zM46 64h8v12h-8z" fill="${col}"/><path d="M50 18c6 8 10 12 4 22 8-3 10-9 8-14 6 6 6 16-2 20H40c-8-5-6-14 2-20-1 5 1 9 5 11-3-8 1-13 3-19z" fill="${col}" opacity=".9"/><text x="50" y="94" text-anchor="middle" font-size="0">${ri}</text></svg>`;
}
function rankUpSheet(gs){
  const el = h(`<div class="rankup" id="rankUp">${rankEmblem(gs.rankIdx, 120)}<div class="eyebrow">Rank up</div><h3>${esc(gs.rank)}</h3><p class="dim">Level ${gs.level} · ${gs.xp.toLocaleString()} XP</p>
    ${gs.rankIdx >= PRO_RANK && game().proUntil ? `<div class="pronote" id="proNote">🎁 <b>Pro week earned.</b> 7 days of Pro, until ${fmtShort(game().proUntil)}.</div>` : ''}
    ${unlocksAt(gs.level).length ? `<div class="hint">Unlocked: ${unlocksAt(gs.level).map(esc).join(', ')}. Pick them in Profile → Looks.</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px"><button type="button" class="btn primary block" id="shareRank">Share</button><button type="button" class="btn block ghost" data-cancel>Nice</button></div></div>`);
  el.querySelector('[data-cancel]').onclick = () => closeSheet();
  el.querySelector('#shareRank').onclick = () => { closeSheet(); whenSettled(() => shareSheet('rank', gs)); };
  openSheet(el); confettiBurst(); ForgedSync.emit('rank.up', { rank:gs.rank, level:gs.level });
}
const unlocksAt = L => ['accent','frame','flair'].flatMap(k => LOOKS[k].filter(x => x.unlock && x.how.includes(`level ${L})`)).map(x => x.name));

/* ---------- Home pieces (max: rank chip + one challenge card) ---------- */
function rankChip(){
  const gs = gameState();
  return `<a class="rankchip" id="rankChip" href="#/rank"><span class="rc-l">${flairSym() ? `<i class="flair">${flairSym()}</i>` : ''}<b>Lv ${gs.level}</b> ${esc(gs.rank)}</span><span class="sgbar"><i style="width:${gs.pct}%"></i></span><em>${gs.xp.toLocaleString()} XP</em></a>`;
}
function challengeHome(){
  const cur = currentChallenges(), open = cur.filter(c => !c.done).sort((a, b) => b.pct - a.pct || a.to.localeCompare(b.to));
  const c = open[0]; const doneN = cur.filter(x => x.done).length;
  if (!c) return `<div class="card chcard" id="challengeHome"><h2>Challenges <a class="lnk" href="#/challenges">See all ›</a></h2><div class="hint">All ${cur.length} current challenges done. New ones tomorrow.</div></div>`;
  return `<div class="card chcard" id="challengeHome"><h2>Challenges <small>${doneN}/${cur.length} done</small><a class="lnk" href="#/challenges">See all ›</a></h2>
    <div class="list-row chrow"><div class="grow"><b>${esc(c.title)}</b><small>${esc(c.progress)} · <span data-left>${timeLeft(c.to)}</span></small><span class="sgbar"><i style="width:${c.pct}%"></i></span></div><span class="pill xp">+${c.xp} XP</span></div></div>`;
}

/* ---------- Challenges screen ---------- */
function chRow(c){
  return `<div class="list-row chrow${c.done ? ' done' : ''}" data-ch="${esc(c.key)}"><div class="grow"><b>${esc(c.title)} <span class="pill tier t${c.tier}">${TIER[c.tier]}</span></b>
    <small data-prog>${esc(c.progress)}${c.done ? ' · ✓ done' : ''}</small><span class="sgbar"><i style="width:${c.pct}%"></i></span></div>
    ${c.done ? `<button type="button" class="btn sm" data-sharech="${esc(c.key)}">Share</button>` : `<span class="pill xp">+${c.xp} XP</span>`}</div>`;
}
function viewChallenges(){
  setHeader('Challenges', '', { parent:'#/' });
  const cur = currentChallenges(), gs = gameState(), v = $('#view');
  const sec = (p, title) => { const l = cur.filter(c => c.p === p); return l.length ? `<div class="card" id="ch-${p}"><h2>${title} <small data-left>${timeLeft(l[0].to)}</small></h2>${l.map(chRow).join('')}</div>` : ''; };
  const fr = game().friend.filter(x => x.to >= iso(addDays(new Date(), -7)));
  v.innerHTML = `${rankChip()}${sec('d','Daily')}${sec('w','Weekly')}${sec('m','Monthly')}
    <div class="card" id="friendCard"><h2>Friend challenges</h2>${fr.length ? fr.map(friendRow).join('') : '<div class="hint" style="margin:-4px 0 8px">Send a challenge link. Your friend joins on their own phone and tracks it with their own workouts (self-reported, no accounts).</div>'}
      <button type="button" class="btn block" id="challengeFriend" style="margin-top:8px">Challenge a friend</button></div>
    <div class="hint" style="padding:0 6px 20px">New daily challenges at midnight, weekly on Monday, monthly on the 1st. Progress comes from what you log. Workouts added more than 7 days late don't count toward challenges. ${gs.done.length} completed so far.</div>`;
  v.querySelectorAll('[data-sharech]').forEach(b => b.onclick = () => shareSheet('challenge', cur.find(c => c.key === b.dataset.sharech)));
  $('#challengeFriend').onclick = friendSheet;
}

/* ---------- friend challenge links (no server: the challenge rides in the URL) ---------- */
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function friendCode(t, days, from){ return b64u(JSON.stringify({ v:1, id:t.id, d:days, f:String(from||'').slice(0, 30), s:today() })); }
function readFriendCode(code){
  try { const o = JSON.parse(unb64u(code)); const t = CH_POOL.find(x => x.id === o.id); if (!t || o.v !== 1 || !isoOk(o.s)) return null;
    const days = clamp(Number(o.d) || 7, 1, 31); return { code, tid:t.id, title:t.t, from:o.f || 'A friend', days }; } catch(e) { return null; }
}
function friendRow(x){
  const t = CH_POOL.find(c => c.id === x.tid); if (!t) return '';
  const r = evalChallenge(t, { key:'f' + x.code.slice(0, 8), from:x.start, to:x.to }, prEvents());
  return `<div class="list-row chrow${r.done ? ' done' : ''}" data-friend="${esc(x.code)}"><div class="grow"><b>${esc(x.title)}</b><small>From ${esc(x.from)} · ${esc(r.progress)}${r.done ? ' · ✓ done' : ` · ${timeLeft(x.to)}`}</small><span class="sgbar"><i style="width:${r.pct}%"></i></span></div></div>`;
}
function friendSheet(){
  const pool = CH_POOL.filter(t => t.p !== 'd' && (!t.need || t.need()));
  let tid = pool[0].id, days = 7;
  const el = h(`<div><h3>Challenge a friend</h3><div class="hint" style="margin:-6px 0 12px">They open the link on their phone and track it with their own workouts. No accounts, nothing uploaded.</div></div>`);
  const list = h(`<div class="focuschips" id="friendPick">${pool.map(t => `<button type="button" data-tid="${t.id}" class="${t.id === tid ? 'on' : ''}">${esc(t.t)}</button>`).join('')}</div>`);
  list.querySelectorAll('button').forEach(b => b.onclick = () => { tid = b.dataset.tid; list.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  el.appendChild(field('Challenge', list));
  el.appendChild(field('Time to do it', seg([[7,'1 week'],[14,'2 weeks'],[30,'30 days']], days, x => days = x)));
  const name = h(`<input class="input" type="text" id="friendFrom" placeholder="Your name (shown to them)" value="${esc(db.profile.name||'')}">`); el.appendChild(field('From', name));
  const btn = h('<button type="button" class="btn primary block" id="friendSend" style="margin-top:12px">Share challenge link</button>'); el.appendChild(btn);
  btn.onclick = async () => {
    const t = CH_POOL.find(x => x.id === tid), url = location.href.split('#')[0] + '#/join/' + friendCode(t, days, name.value.trim()), text = `${name.value.trim() || 'I'} challenged you on Forged: ${t.t} (${days} days)`;
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
    <button type="button" class="btn primary block" id="joinGo" style="margin-top:14px">${already ? 'Already joined: see challenges' : 'Accept challenge'}</button></div>`;
  $('#joinGo').onclick = () => { if (!already) { game().friend.push({ code:x.code, tid:x.tid, title:x.title, from:x.from, start:today(), to:iso(addDays(new Date(), x.days - 1)) }); save(); toast('Challenge accepted'); ForgedSync.emit('friend.join', { tid:x.tid }); } go('#/challenges'); };
}

/* ---------- Rank screen ---------- */
function viewRank(){
  setHeader('Rank', '', { parent:'#/' });
  const gs = gameState(), g = game(), p = gs.parts, v = $('#view');
  v.innerHTML = `<div class="card rankhero" id="rankHero">${rankEmblem(gs.rankIdx, 88)}<div><div class="eyebrow">Level ${gs.level}</div><h2 class="rk">${flairSym() ? flairSym() + ' ' : ''}${esc(gs.rank)}</h2>
      <div class="dim" id="xpLine">${gs.xp.toLocaleString()} XP · ${(gs.next - gs.xp).toLocaleString()} to level ${gs.level + 1}</div><span class="sgbar big"><i style="width:${gs.pct}%"></i></span>
      ${gs.nextRank ? `<div class="hint" id="nextRank">${esc(gs.nextRank.name)} at level ${gs.nextRank.level} (${(gs.nextRank.xp - gs.xp).toLocaleString()} XP to go)</div>` : '<div class="hint">Top rank. Forged.</div>'}</div></div>
    ${proActive() ? `<div class="card pronote" id="proNote">🎁 <b>Pro week earned</b> for reaching ${RANKS[PRO_RANK][0]}. Pro until ${fmtShort(g.proUntil)}.</div>` : g.proUntil ? `<div class="hint" style="padding:0 6px 10px">Pro week earned ${fmtShort(g.proGranted)} (ended ${fmtShort(g.proUntil)}).</div>` : `<div class="hint" style="padding:0 6px 10px">Reach ${RANKS[PRO_RANK][0]} (level ${RANKS[PRO_RANK][1]}) to earn 7 days of Pro.</div>`}
    <div class="card" id="xpBreak"><h2>Where your XP comes from</h2>${[['Challenges', p.challenges],['Logging workouts', p.log],['Week streaks', p.streak],['PRs', p.pr],['Strength goals hit', p.goals],['Monthly goal', p.ring]].map(([l, x]) => `<div class="list-row"><div class="grow">${l}</div><b>${x.toLocaleString()}</b></div>`).join('')}
      <div class="hint" style="margin-top:8px">Logging: ${XP_LOG} XP per workout (max ${XP_LOG_CAP} a day). Challenges: Easy/Medium/Hard daily ${CH_XP.d.slice(1).join('/')}, weekly ${CH_XP.w.slice(1).join('/')}, monthly ${CH_XP.m.slice(1).join('/')}. Week streak +${XP_STREAK}, PR +${XP_PR}, strength goal +${XP_GOAL}, monthly goal +${XP_RING}.</div></div>
    <div class="card" id="ladder"><h2>Ranks</h2>${RANKS.map(([n, L], i) => `<div class="list-row ladder${i === gs.rankIdx ? ' cur' : ''}${i > gs.rankIdx ? ' locked' : ''}"><span class="lvl">Lv ${L}+</span><div class="grow"><b>${n}</b>${i === PRO_RANK ? '<small>🎁 7 days of Pro</small>' : ''}</div>${i <= gs.rankIdx ? '✓' : ''}</div>`).join('')}</div>
    <div class="btnrow" style="display:flex;gap:10px;padding:0 0 20px"><button type="button" class="btn primary" id="shareRank" style="flex:1">Share rank</button><a class="btn" href="#/badges" style="flex:1">Badges</a></div>${weekStreak() >= 2 ? `<button type="button" class="btn block" data-sharestreak id="shareStreak" style="margin-bottom:20px">Share your ${weekStreak()}-week streak</button>` : ''}`;
  $('#shareRank').onclick = () => shareSheet('rank', gs);
}

/* ---------- Badges screen ---------- */
function viewBadges(){
  setHeader('Badges', '', { parent:'#/settings' });
  const bs = badgeState(), n = bs.filter(b => b.earned).length;
  $('#view').innerHTML = `<div class="card" id="badgeCase"><h2>Badge case <small>${n} of ${bs.length}</small></h2><div class="badgegrid">${bs.map(b => `<div class="badge${b.earned ? ' on' : ' locked'}" data-badge="${b.id}"><span class="bi">${b.earned ? b.icon : '🔒'}</span><b>${esc(b.name)}</b><small>${esc(b.earned ? 'Earned' : b.how)}</small></div>`).join('')}</div></div>
    <div class="hint" style="padding:0 6px 20px">Badges come from your history and update as you log. Locked badges show how to earn them.</div>`;
}

/* ---------- Profile card: rank, badges, looks, Pro week ---------- */
function gameProfileCard(){
  const gs = gameState(), bs = badgeState(), n = bs.filter(b => b.earned).length, lk = currentLook();
  const card = h(`<div class="card" id="gameProfile"><h2>Rank, badges &amp; looks</h2>
    <a class="list-row" href="#/rank" style="text-decoration:none;color:inherit"><div class="grow"><b>${flairSym() ? flairSym() + ' ' : ''}${esc(gs.rank)} · level ${gs.level}</b><small>${gs.xp.toLocaleString()} XP${proActive() ? ` · 🎁 Pro week earned (until ${fmtShort(game().proUntil)})` : ''}</small></div>›</a>
    <a class="list-row" href="#/badges" id="badgesLink" style="text-decoration:none;color:inherit"><div class="grow"><b>Badge case</b><small>${n} of ${bs.length} earned</small></div><span class="badgepeek">${bs.filter(b => b.earned).slice(-4).map(b => b.icon).join('')}</span>›</a>
    <div id="looks"></div></div>`);
  const L = card.querySelector('#looks');
  const picker = (kind, label) => {
    const wrap = h(`<div class="field"><label>${label}</label><div class="lookgrid" data-kind="${kind}">${LOOKS[kind].map(x => { const un = lookUnlocked(kind, x.id);
      return `<button type="button" data-look="${x.id}" class="${lk[kind] === x.id ? 'on' : ''}${un ? '' : ' locked'}" aria-pressed="${lk[kind] === x.id}" ${un ? '' : 'aria-disabled="true"'} title="${esc(x.how)}">${kind === 'accent' ? `<i class="sw" style="background:${x.col}"></i>` : kind === 'flair' ? `<i class="sy">${x.sym || '–'}</i>` : `<i class="fr fr-${x.id}"></i>`}<span>${esc(x.name)}</span>${un ? '' : `<small>🔒 ${esc(x.how)}</small>`}</button>`; }).join('')}</div></div>`);
    wrap.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.classList.contains('locked')) { toast(`Locked: ${b.title}`); return; }
      game().look = { ...game().look, [kind]:b.dataset.look }; save(); applyLook(); toast(`${label}: ${b.querySelector('span').textContent}`); route(); });
    L.appendChild(wrap);
  };
  picker('accent', 'Accent colour'); picker('frame', 'Share card frame'); picker('flair', 'Rank flair');
  L.appendChild(h('<div class="hint">The log form still uses each workout type\'s colour.</div>'));
  return card;
}

document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('[data-sharering]'); if (r) { const x = db.challenges.find(c => c.month === r.dataset.sharering); if (x) { const [y, m] = x.month.split('-').map(Number); shareSheet('ring', { label:`${MONTHS[m-1]} ${y}`, n:x.n, target:x.target }); } return; }
  const st = e.target.closest && e.target.closest('[data-sharestreak]'); if (st) shareSheet('streak', { weeks:weekStreak(), sessions:db.sessions.filter(s => s.date >= iso(addDays(weekStart(new Date()), -7 * (weekStreak() - 1)))).length });
});
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
    return { eyebrow:'Workout logged', title:sessTitle(x), sub:fmtShort(x.date), stats:st.slice(0, 3), color:CATS[c]?.color || '#F2711C', foot:x.feel ? `Felt: ${(FEELS[x.feel-1]||[])[2] || ''}` : '' }; }
  if (kind === 'goal') return { eyebrow:'Goal hit · New PR', title:sgLabel(x), sub:x.achieved ? fmtShort(x.achieved.date) : fmtShort(today()), stats:[[hide(String(x.achieved ? x.achieved.value : sgTarget(x))), sgUnit(x)], [hide(String(sgTarget(x))), 'target']], color:'#F5C542' };
  if (kind === 'rank') return { eyebrow:`Level ${x.level}`, title:x.rank, sub:'Rank on Forged', stats:[[hide(x.xp.toLocaleString()), 'XP'], [String(badgeState().filter(b => b.earned).length), 'badges']], color:'#F2711C', emblem:x.rankIdx };
  if (kind === 'challenge') return { eyebrow:`${{ d:'Daily', w:'Weekly', m:'Monthly' }[x.p]} challenge complete`, title:x.title, sub:fmtShort(today()), stats:[[`+${x.xp}`, 'XP'], [TIER[x.tier], 'tier']], color:'#6FD3A8' };
  if (kind === 'streak') return { eyebrow:'Streak', title:`${x.weeks}-week streak`, sub:'Training every week', stats:[[String(x.weeks), 'weeks'], [hide(String(x.sessions)), 'sessions']], color:'#F2711C' };
  if (kind === 'ring') return { eyebrow:'Monthly goal hit', title:x.label, sub:'Ring closed', stats:[[hide(`${x.n}`), 'workouts'], [hide(`${x.target}`), 'goal']], color:'#F2711C', ring:true };
  return { eyebrow:'Forged', title:'For the fight', sub:'', stats:[], color:'#F2711C' };
}
async function renderShareCard(kind, x, fmt = 'square', showNums = true){
  const [W, H] = SHARE_FMT[fmt] || SHARE_FMT.square, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), c = shareContent(kind, x, showNums), frame = currentLook().frame, accent = (LOOKS.accent.find(a => a.id === currentLook().accent) || LOOKS.accent[0]).col;
  try { await Promise.all([document.fonts.load('800 120px "Barlow Condensed"'), document.fonts.load('600 40px "Barlow"')]); } catch(e) {}
  g.fillStyle = '#0B0B0C'; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * .5, H * 1.05, 40, W * .5, H * 1.05, H * .9); glow.addColorStop(0, 'rgba(242,113,28,.55)'); glow.addColorStop(.45, 'rgba(242,113,28,.12)'); glow.addColorStop(1, 'rgba(242,113,28,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // frame
  const fcol = { classic:accent, ember:'#E5484D', gold:'#F5C542', damascus:'#B48CF2' }[frame] || accent;
  g.lineWidth = frame === 'classic' ? 6 : 14; g.strokeStyle = fcol; if (frame === 'ember') { g.shadowColor = '#F2711C'; g.shadowBlur = 40; }
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
  const run = () => ask().then(ok => { if (!ok) return; goalsReturn = from; if (onForm()) { form = null; formBase = null; } whenSettled(() => go(dest)); });
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
      .then(ok => { if (ok) { form = null; formBase = null; whenSettled(proceed); } });
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
  { const st = history.state || {}; if (st.idx == null) history.replaceState({ ...st, idx: replacing ? Math.max(0, navIdx) : navIdx + 1 }, ''); navIdx = history.state.idx; replacing = false; }
  updateNav();
  const [, a, b] = hash.split('/');
  curRoute = a || ''; curHash = hash;
  if (a !== 'log' && a !== 'edit') delete document.body.dataset.theme;
  const tab = { '':'home', challenges:'home', rank:'home', join:'home', badges:'settings', history:'history', belts:'history', comps:'history', session:'history', benchmarks:'home', programs:'settings', program:'settings', log:'log', edit:'history', stats:($('.tabbar a[data-tab="food"]')?.dataset.mode === 'stats' ? 'food' : 'home'), settings:'settings', food:'food', supps:'food' }[a||''] || 'home';
  document.querySelectorAll('.tabbar a').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  if (a !== 'log' && a !== 'edit') form = (a === 'session' ? null : form && !form.id ? form : null);
  switch (a || '') {
    case 'history': viewHistory(); break;
    case 'belts': viewBelts(); break;
    case 'comps': viewComps(); break;
    case 'challenges': viewChallenges(); break;
    case 'rank': viewRank(); break;
    case 'badges': viewBadges(); break;
    case 'join': viewJoin(b); break;
    case 'benchmarks': viewBenchmarks(); break;
    case 'programs': viewPrograms(); break;
    case 'program': viewProgram(b || ''); break;
    case 'session': viewSession(b); break;
    case 'log': viewForm(null); break;
    case 'edit': viewForm(b); break;
    case 'stats': viewStats(); break;
    case 'food': viewFood(b); break;
    case 'supps': go('#/food'); return;
    case 'settings': viewSettings(); break;
    default: viewHome();
  }
  if (a !== 'settings') goalsReturn = null;
  window.scrollTo(0, 0);
  if (a === 'settings' && b === 'weight') { const g = $('#goalW')?.closest('.card'); if (g) g.scrollIntoView({ block:'start' }); }
  if (a === 'settings' && b === 'goals') { const g = $('#targetsCard'); if (g) g.scrollIntoView({ block:'start' }); }
  if (a === 'settings' && b === 'schedule') { const g = $('#scheduleCard'); if (g) g.scrollIntoView({ block:'start' }); }
}
window.DM_TEST = { gameState, currentChallenges, pickChallenges, periodOf, evalChallenge, CH_POOL, badgeState, levelOf, xpForLevel, rankIdx, RANKS, renderShareCard, shareContent, readFriendCode, friendCode, lookUnlocked, currentLook, proActive, prEvents, timeLeft, gFair, strengthBest, strengthProgress, checkStrengthGoals, sanitizeStrength, nextTarget, sgTarget, diffYMD, fmtSpan, beltGroups, rpeFromIntensity, rpeOf, loadOf, loadStatus, weeklyLoad, backToBack, epley, benchSeries, benchDue, challengeStatus, challengeMonths, daysTo, nextComp, suggest, progSchedule, prescription, progNext, activeProgram, injDay, injName, activeInjuries, isPro, typeLabel, get db(){ return db; } };
window.addEventListener('hashchange', route);
// Bottom nav: always closes whatever is open (sheet or form) and goes to that screen.
document.querySelector('.tabbar').addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href'), same = (location.hash || '#/') === href;
  if (same) { if (!$('#sheet').hidden) closeSheet(); else if (!onForm()) route(); window.scrollTo(0, 0); return; }
  guardLeave(() => { if (!$('#sheet').hidden) closeSheet(); go(href); });
});
window.addEventListener('storage', e => { if (e.key === STORE_KEY) { db = load(); if (db.belts.length) syncProfileRank(); applyLook(); route(); } });
db = load(); if (db.belts.length) syncProfileRank();   // profile rank always follows the event log (covers migrated logs)
applyLook();
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e)));
}
})();
