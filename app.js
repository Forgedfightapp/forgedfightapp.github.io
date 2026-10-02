/* Discipline > Motivation — BJJ Training Log
   Vanilla JS, no dependencies. Data lives in localStorage on this device. */
(() => {
'use strict';

const STORE_KEY = 'dm.bjj.v1';
const APP_VERSION = '2.3.0';

const SUBMISSIONS = ['Rear naked choke','Armbar','Triangle','Kimura','Guillotine','Americana','Darce','Anaconda','Arm triangle','Ezekiel','Bow and arrow','Cross collar choke','Loop choke','Baseball bat choke','North-south choke','Omoplata','Straight ankle lock','Heel hook','Kneebar','Toe hold','Calf slicer','Wrist lock','Gogoplata','Paper cutter','Clock choke','Von Flue choke','Banana split','Estima lock'];
const POSITIONS = ['Bottom side control','Bottom mount','Back taken','Turtle','Bottom half guard','Closed guard (bottom)','Stuck in closed guard','Knee on belly','North-south bottom','Can\'t pass half guard','Can\'t pass De La Riva','Can\'t pass butterfly','Leg entanglement','Front headlock','Getting stalled','Guard pulled on me'];
const TECHNIQUES = ['Scissor sweep','Hip bump sweep','Flower sweep','Butterfly sweep','Knee slice pass','Toreando pass','Over-under pass','Stack pass','Leg drag','Elbow-knee escape','Bridge and roll','Back take from turtle','Seatbelt control','Arm drag','Double leg','Single leg','Hip escape (shrimp)','Technical stand-up','Collar drag','De La Riva entry','X-guard sweep','Berimbolo','Mount maintenance','Side control transitions','Guard retention','Kimura trap','Body triangle','Ashi garami entry'];
const SESSION_TYPES = [['class','Class'],['open','Open mat'],['drill','Drilling'],['private','Private'],['comp','Competition'],['seminar','Seminar'],['other','Other']];
const BELTS = [['white','White','#f1f1f1'],['blue','Blue','#2563eb'],['purple','Purple','#7c3aed'],['brown','Brown','#7b4a26'],['black','Black','#151515'],
  ['grey','Grey','#9ca3af'],['yellow','Yellow','#facc15'],['orange','Orange','#f97316'],['green','Green','#16a34a']];
const ADULT_BELTS = ['white','blue','purple','brown','black'], KIDS_BELTS = ['grey','yellow','orange','green'];
const INTENSITY = ['', 'Light','Easy','Moderate','Hard','All-out'];

/* ---------------- storage ---------------- */
const SCHEMA = 5;
const defaultProfile = () => ({ name:'', belt:'white', stripes:0, promotedOn:'', goalWeight:'', startWeight:'', goalDate:'', unit:'lb', distUnit:'mi', maxHR:'', sampleProfile:false, setupDone:false,
  enabled:{ grappling:true, weights:false, cardio:false, food:true, supps:true } });
const emptyDb = () => ({ schema:SCHEMA, sessions:[], profile:defaultProfile(), nutrition:{ entries:[], foods:[], water:[] }, supps:{ items:[], log:[] }, weights:[], belts:[], archive:{ striking:[] } });
/* Striking was removed in 2.3.0. Striking sessions are never deleted or converted: they are moved, untouched, into
   db.archive.striking (kept in storage, export and import; hidden from the UI and stats). */
function archiveStriking(d){ const ar = Array.isArray(d.archive?.striking) ? d.archive.striking : [], keep = [], moved = [];
  (d.sessions||[]).forEach(s => (s && s.category === 'striking' ? moved : keep).push(s));
  const ids = new Set(ar.map(x => x && x.id)); d.sessions = keep; d.archive = { ...(d.archive||{}), striking: ar.concat(moved.filter(x => !ids.has(x.id))) }; return moved.length; }
/* Versioned schema. v1 (BJJ-only) -> v2 (multi-discipline): sessions gain category/discipline; a copy of the
   pre-migration data is kept under STORE_KEY + '.backup.v1' so nothing can be lost. */
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
  if (v < 5) { // v5: Striking removed. Striking sessions move untouched into archive.striking (still stored + exported).
    if (v === 4) { try { if (!localStorage.getItem(STORE_KEY + '.backup.v4')) localStorage.setItem(STORE_KEY + '.backup.v4', JSON.stringify(d)); } catch(e) { console.warn('backup failed', e); } }
    if (d.profile?.enabled) { const { striking, ...rest } = d.profile.enabled; d.profile = { ...d.profile, enabled:rest }; }
    v = 5;
  }
  archiveStriking(d); // also catches striking sessions in any later import
  d.schema = v; return d;
}
function load(){
  try{
    let d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.sessions)) { const before = d.schema; d = migrate(d); if (before !== d.schema) setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch(e){} }, 0);
      return { schema:d.schema, sessions:d.sessions, profile:{...defaultProfile(), ...(d.profile||{})}, nutrition:{ entries:d.nutrition?.entries||[], foods:d.nutrition?.foods||[], water:sanitizeWater(d.nutrition?.water) }, supps:{ items:d.supps?.items||[], log:d.supps?.log||[] }, weights:sanitizeWeights(d.weights), belts:sanitizeBelts(d.belts), archive:{ striking:Array.isArray(d.archive?.striking) ? d.archive.striking : [] } }; }
  }catch(e){ console.warn('Could not read saved data', e);
    // never silently lose data: keep the unreadable copy before starting fresh
    try { const raw = localStorage.getItem(STORE_KEY); if (raw && !localStorage.getItem(STORE_KEY + '.unreadable')) localStorage.setItem(STORE_KEY + '.unreadable', raw); } catch(_) {} }
  return emptyDb();
}
let db = load();
function save(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
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
const typeLabel = t => (SESSION_TYPES.find(x => x[0]===t)||[,'Session'])[1];
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
  if (g.goal == null) hint = `<a href="#/settings" class="lnk">Set a goal weight</a> to see progress.`;
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
      <div><span>Goal</span><b>${g.goal != null ? `${g.goal} ${u}` : '—'}</b><small>${g.goal != null ? (g.reached ? 'reached' : `${g.left} ${u} to go · ${g.pct}%`) : '<a class="lnk" href="#/settings">Set a goal</a>'}</small></div></div>
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
function sanitizeBelts(list){
  return (Array.isArray(list) ? list : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && BELTS.some(b => b[0] === x.belt))
    .map(x => ({ id:String(x.id || ('b' + Date.now().toString(36) + Math.random().toString(36).slice(2,8))), date:String(x.date), belt:x.belt,
      stripes:Math.max(0, Math.min(maxStripes(x.belt), Math.round(Number(x.stripes) || 0))), instructor:String(x.instructor||''), academy:String(x.academy||''), notes:String(x.notes||''),
      createdAt:Number(x.createdAt) || 0, ...(x.sample ? { sample:true } : {}) }));
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
const beltHistory = () => [...(db.belts||[])].sort((a,b) => a.date.localeCompare(b.date) || (a.createdAt||0) - (b.createdAt||0));
const currentRank = () => { const h = beltHistory(); return h.length ? h[h.length-1] : null; };
const rankLabel = (e, short) => e.stripes ? (e.belt === 'black' ? `${e.stripes}${['','st','nd','rd'][e.stripes] || 'th'} degree` : `${e.stripes} stripe${e.stripes > 1 ? 's' : ''}`) : (short ? 'No stripes' : `Promoted to ${beltOf(e.belt)[1].toLowerCase()} belt`);
function syncProfileRank(){ const c = currentRank(); db.profile = { ...db.profile, belt:c ? c.belt : 'white', stripes:c ? c.stripes : 0, promotedOn:c ? c.date : '' }; }
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
  const g = beltGroups(), cg = g[g.length-1], b = beltOf(cur.belt), sinceLast = diffYMD(cur.date, today()), m = matIn(cur.date, today(), true);
  const stripeLine = cur.date === cg.start ? `<span>Last stripe <b>none yet</b></span>` : `<span>Since last ${cur.belt === 'black' ? 'degree' : 'stripe'} <b data-b="since">${fmtSpan(sinceLast)}</b></span>`;
  return `<div class="card tappable" id="beltCard" data-href="#/belts"><h2>${esc(b[1])} belt${cur.stripes ? ` · ${rankLabel(cur)}` : ''} ${cur.sample ? '<span class="pill sample">Sample</span>' : ''}<a class="lnk" href="#/belts">Timeline ›</a></h2>
    <div class="belt">${beltBar(cur.belt, cur.stripes)}</div>
    <div class="belt-meta"><span>At ${esc(b[1].toLowerCase())} belt <b data-b="rank">${fmtSpan(cg.span)}</b></span>${stripeLine}</div>
    <div class="belt-meta" style="margin-top:4px"><span><b>${m.n}</b> session${m.n === 1 ? '' : 's'} · <b>${hrs(m.min)}</b> h since last promotion</span></div>
    <button type="button" class="btn block" data-promo style="margin-top:12px">Log promotion</button></div>`;
}
function wireBelt(root){
  root.querySelectorAll('[data-promo]').forEach(x => x.onclick = e => { e.stopPropagation(); promoSheet(null); });
  const c = root.querySelector('#beltCard.tappable'); if (c) c.onclick = e => { if (!e.target.closest('a,button')) go('#/belts'); };
  root.querySelectorAll('[data-pid]').forEach(x => x.onclick = () => promoSheet(x.dataset.pid));
}
/* the next likely promotion, so logging is usually just "Log promotion" -> "Save" */
function nextRank(cur){
  if (!cur) return { belt:'white', stripes:0 };
  if (cur.stripes < maxStripes(cur.belt) && cur.belt !== 'black') return { belt:cur.belt, stripes:cur.stripes + 1 };
  if (cur.belt === 'black') return { belt:'black', stripes:Math.min(6, cur.stripes + 1) };
  const ai = ADULT_BELTS.indexOf(cur.belt), ki = KIDS_BELTS.indexOf(cur.belt);
  return { belt: ai >= 0 ? ADULT_BELTS[ai+1] : KIDS_BELTS[ki+1] || 'blue', stripes:0 };
}
function promoSheet(id){
  const ex = id ? db.belts.find(x => x.id === id) : null;
  const f = ex ? { ...ex } : { ...nextRank(currentRank()), date:today(), instructor:currentRank()?.instructor || '', academy:currentRank()?.academy || '', notes:'' };
  let kids = KIDS_BELTS.includes(f.belt);
  const el = h(`<div><h3>${ex ? 'Edit promotion' : 'Log promotion'}</h3>
    <div class="field"><label>Belt</label><div class="beltpick" id="beltPick"></div><button type="button" class="btn sm ghost" id="kidsT" style="margin-top:8px">Kids belts</button></div>
    <div class="field" id="stripeF"></div>
    <div class="field"><label>Date</label><input class="input" type="date" id="pDate" max="${today()}" value="${esc(f.date)}"></div>
    <details class="details" ${ex && (ex.instructor || ex.academy || ex.notes) ? 'open' : ''}><summary><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add details <small>optional</small></summary><div class="det-body">
      <div class="field"><label>Instructor</label><input class="input" id="pInst" autocapitalize="words" value="${esc(f.instructor)}" placeholder="e.g. Prof. Silva"></div>
      <div class="field"><label>Academy</label><input class="input" id="pAcad" autocapitalize="words" value="${esc(f.academy)}" placeholder="e.g. Riverside BJJ"></div>
      <div class="field"><label>Notes</label><textarea class="input" id="pNotes" rows="2" placeholder="How it happened, what to work on next…">${esc(f.notes)}</textarea></div></div></details>
    <div style="display:flex;gap:10px;margin-top:6px">${ex ? '<button type="button" class="btn danger" id="pDel">Delete</button>' : ''}<button type="button" class="btn primary" style="flex:1" id="pSave">${ex ? 'Save changes' : 'Save promotion'}</button></div></div>`);
  const pick = el.querySelector('#beltPick'), sf = el.querySelector('#stripeF'), kt = el.querySelector('#kidsT');
  const drawStripes = () => { if (f.stripes > maxStripes(f.belt)) f.stripes = maxStripes(f.belt); sf.innerHTML = `<label>${f.belt === 'black' ? 'Degree' : 'Stripes'}</label>`;
    sf.appendChild(seg(Array.from({length:maxStripes(f.belt)+1}, (_, i) => [i, String(i)]), f.stripes, x => { f.stripes = x; })); };
  const drawPick = () => { const list = kids ? ADULT_BELTS.concat(KIDS_BELTS) : ADULT_BELTS; kt.textContent = kids ? 'Hide kids belts' : 'Kids belts';
    pick.innerHTML = list.map(k => `<button type="button" data-belt="${k}" class="${f.belt === k ? 'on' : ''}" aria-pressed="${f.belt === k}"><i style="background:${beltOf(k)[2]}"></i>${beltOf(k)[1]}</button>`).join('');
    pick.querySelectorAll('button').forEach(x => x.onclick = () => { f.belt = x.dataset.belt; drawPick(); drawStripes(); }); };
  kt.onclick = () => { kids = !kids; if (!kids && KIDS_BELTS.includes(f.belt)) f.belt = 'white'; drawPick(); drawStripes(); };
  drawPick(); drawStripes();
  el.querySelector('#pSave').onclick = () => {
    const date = el.querySelector('#pDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) { toast('Pick a date (today or earlier)'); return; }
    const before = JSON.parse(JSON.stringify(db.belts));
    const rec = sanitizeBelts([{ ...f, id:ex ? ex.id : uid(), date, instructor:el.querySelector('#pInst').value.trim(), academy:el.querySelector('#pAcad').value.trim(), notes:el.querySelector('#pNotes').value.trim(), createdAt:ex ? ex.createdAt : Date.now() }])[0];
    if (ex && ex.notes.startsWith('Date unknown') && rec.notes === ex.notes && date !== ex.date) rec.notes = '';
    delete rec.sample;
    db.belts = db.belts.filter(x => x.id !== rec.id).concat(rec); syncProfileRank(); save(); closeSheet();
    undoToast(`${ex ? 'Updated' : 'Logged'}: ${beltOf(rec.belt)[1]} belt${rec.stripes ? ', ' + rankLabel(rec) : ''}`, () => { db.belts = before; syncProfileRank(); save(); route(); });
    whenSettled(route);
  };
  const del = el.querySelector('#pDel');
  if (del) del.onclick = () => { const before = JSON.parse(JSON.stringify(db.belts)); db.belts = db.belts.filter(x => x.id !== ex.id); syncProfileRank(); save(); closeSheet();
    undoToast('Promotion deleted', () => { db.belts = before; syncProfileRank(); save(); route(); }); whenSettled(route); };
  openSheet(el, null, { closeLabel:'Cancel' });
}
function histSeg(which){
  if (!enabled('grappling') && !(db.belts||[]).length) return '';
  return `<div class="seg fuelseg histseg" role="tablist"><a role="tab" href="#/history" class="${which === 'workouts' ? 'on' : ''}">Workouts</a><a role="tab" href="#/belts" class="${which === 'belts' ? 'on' : ''}">Belts</a></div>`;
}
function viewBelts(){
  setHeader('History', `<a class="btn sm" href="#/stats">Stats</a>`);
  const v = $('#view'), groups = beltGroups().reverse();
  const items = g => [...g.items].reverse().map(e => `<button type="button" class="tl-item" data-pid="${esc(e.id)}"><i class="tl-dot"></i><div class="grow"><b>${esc(rankLabel(e))}</b>
      <small>${fmtShort(e.date)}${e.instructor ? ` · ${esc(e.instructor)}` : ''}${e.academy ? ` · ${esc(e.academy)}` : ''}${e.sample ? ' · sample' : ''}</small>${e.notes ? `<small class="tl-note">${esc(e.notes)}</small>` : ''}</div>
      <span class="tl-took">${e.took ? `<b>${fmtSpan(e.took)}</b><small>after previous</small>` : '<small>start</small>'}</span></button>`).join('');
  v.innerHTML = `${histSeg('belts')}
    <button type="button" class="btn primary block" data-promo style="margin-bottom:14px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log promotion</button>
    ${groups.length ? `<div class="timeline" id="timeline">${groups.map(g => { const b = beltOf(g.belt); return `<section class="tl-group ${g.current ? 'current' : ''}" data-belt="${g.belt}" style="--belt:${b[2]}">
      <div class="tl-head">${beltBar(g.belt, g.items[g.items.length-1].stripes, 'mini')}<div class="grow"><b>${esc(b[1])} belt</b><small>${fmtShort(g.start)} – ${g.current ? 'today' : fmtShort(g.end)}</small></div>
        <div class="tl-dur"><b data-span>${fmtSpan(g.span)}</b><small>${g.current ? 'so far' : 'at this belt'}</small></div></div>
      ${g.mat.n ? `<div class="tl-meta">${g.mat.n} session${g.mat.n > 1 ? 's' : ''} · ${hrs(g.mat.min)} h on the mat logged</div>` : ''}
      <div class="tl-items">${items(g)}</div></section>`; }).join('')}</div>
      <div class="hint" style="text-align:center;margin-top:8px">Tap an entry to edit or delete it. Add past promotions in any order — they're sorted by date.</div>`
    : `<div class="empty" style="padding:30px 10px">No promotions yet. Log your current belt (and past ones if you like) to see your journey.</div>`}`;
  wireBelt(v);
}

/* ---------------- disciplines ---------------- */
const CATS = {
  grappling:{ label:'BJJ', sub:'Gi, No-Gi', color:'#DC141F', dur:60, disc:[['bjj','BJJ'],['wrestling','Wrestling'],['judo','Judo']],
    icon:'<path d="M8 4a2 2 0 1 0 0 .1M16 4a2 2 0 1 0 0 .1M5 21l2-7-3-3 4-4h8l4 4-3 3 2 7M9 11l3 2 3-2"/>' },
  weights:{ label:'Weights', color:'#8FB0D9', dur:60, disc:[['strength','Strength']],
    icon:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>' },
  cardio:{ label:'Cardio', color:'#6FD3A8', dur:30, disc:[['run','Run'],['bike','Bike'],['row','Row'],['swim','Swim'],['rope','Jump rope'],['other','Other']],
    icon:'<path d="M3 12h4l2-5 4 10 2-5h6"/>' }
};
const CAT_KEYS = Object.keys(CATS);
const EXERCISES = ['Back squat','Front squat','Bench press','Incline bench press','Deadlift','Romanian deadlift','Trap bar deadlift','Overhead press','Barbell row','Pull-up','Chin-up','Dip','Lat pulldown','Cable row','Hip thrust','Bulgarian split squat','Lunge','Leg press','Kettlebell swing','Turkish get-up','Farmer carry','Power clean','Bicep curl','Tricep extension','Face pull','Neck curl','Plank','Push-up'];
const catOf = s => CATS[s.category] ? s.category : 'grappling';
const discLabel = s => { const c = CATS[catOf(s)]; return (c.disc.find(d => d[0]===s.discipline) || c.disc[0])[1]; };
const enabled = k => { const e = db.profile.enabled || {}; return k in e ? !!e[k] : (k === 'grappling' || k === 'food' || k === 'supps'); };
const SECTION_KEYS = () => CAT_KEYS.concat(['weight','food','supps']);
const enabledCats = () => { const l = CAT_KEYS.filter(enabled); return l.length ? l : ['grappling']; };
const distU = () => db.profile.distUnit === 'km' ? 'km' : 'mi';
const toUnit = (d, from, to) => from === to ? d : (to === 'km' ? d * 1.609344 : d / 1.609344);
const fmtDur = sec => { sec = Math.round(sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`; };
const paceStr = (sec, dist, unit) => dist > 0 && sec > 0 ? `${fmtDur(sec/dist)} /${unit}` : '';
const speedStr = (sec, dist, unit) => dist > 0 && sec > 0 ? `${r1(dist/(sec/3600))} ${unit==='km'?'km/h':'mph'}` : '';
const e1rm = (w, r) => w > 0 && r > 0 ? w * (1 + Math.min(r, 12)/30) : 0;
const volumeOf = s => (s.exercises||[]).reduce((a,e) => a + e.sets.reduce((b,x) => b + (Number(x.reps)||0)*(Number(x.weight)||0), 0), 0);
function sessTitle(s){ const c = catOf(s); if (c === 'grappling') { const t = (s.type && s.type !== 'class') ? ` · ${typeLabel(s.type)}` : ''; return discLabel(s) + t; } return c === 'weights' ? 'Weights' : discLabel(s); }
function catDot(c){ return `<i class="catdot" style="background:${CATS[c].color}"></i>`; }

/* schema-2 session sanitizer: used for import, migration and every save (so stored == exported == re-imported) */
function sanitizeSession(s){
  const n = v => v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
  const cat = CATS[s.category] ? s.category : 'grappling';
  const disc = CATS[cat].disc.some(d => d[0]===s.discipline) ? s.discipline : CATS[cat].disc[0][0];
  const out = { id:String(s.id||uid()), date:s.date, category:cat, discipline:disc, gi:s.gi==='nogi'?'nogi':'gi',
    type:SESSION_TYPES.some(t => t[0]===s.type) ? s.type : 'class', duration:Math.max(0, Math.round(Number(s.duration)||0)), rounds:Math.max(0, Number(s.rounds)||0),
    intensity:Math.min(5, Math.max(1, Number(s.intensity)||3)), techniques:Array.isArray(s.techniques) ? s.techniques.map(String) : [],
    notes:String(s.notes||''), weight:n(s.weight),
    rolls:Array.isArray(s.rolls) ? s.rolls.map(r => ({ id:String(r.id||uid()), partner:String(r.partner||''), result:['win','loss','draw'].includes(r.result)?r.result:'draw',
      subsLanded:(r.subsLanded||[]).map(String), subsTapped:(r.subsTapped||[]).map(String), stuck:(r.stuck||[]).map(String) })) : [],
    sample:!!s.sample, createdAt:s.createdAt||Date.now() };
  if (s.updatedAt) out.updatedAt = s.updatedAt;
  if (Array.isArray(s.exercises)) out.exercises = s.exercises.filter(e => e && String(e.name||'').trim()).map(e => ({ name:String(e.name).trim(), sets:(e.sets||[]).map(x => ({ reps:n(x.reps), weight:n(x.weight), rpe:n(x.rpe) })) }));
  if (s.cardio) out.cardio = { distance:n(s.cardio.distance), unit:s.cardio.unit==='km'?'km':'mi', sec:Math.max(0, Math.round(Number(s.cardio.sec)||0)) };
  if (s.hr) { const hr = { avg:n(s.hr.avg), max:n(s.hr.max), cal:n(s.hr.cal), zones:[0,1,2,3,4].map(i => n(s.hr.zones?.[i])) }; if (hr.avg!==''||hr.max!==''||hr.cal!==''||hr.zones.some(z => z!=='')) out.hr = hr; }
  if (s.source) out.source = String(s.source);
  return out;
}

/* ---------------- views ---------------- */
function setHeader(title, action='', back=null){
  const t = $('#title'), tg = $('#tagline'), br = $('#backRow');
  br.hidden = !back;
  if (back) { br.querySelector('span').textContent = back.label || 'Back'; br.querySelector('button').setAttribute('aria-label', back.label || 'Back'); br.querySelector('button').onclick = () => goBack(back.parent || '#/'); }
  if (title) { t.textContent = title; tg.innerHTML = 'Discipline <span style="color:var(--accent);font-weight:700">&gt;</span> Motivation'; }
  else { t.innerHTML = '<img class="banner-logo" src="brand/wordmark-header.svg" alt="Discipline &gt; Motivation" width="1149" height="120">'; tg.innerHTML = '<b>Training Log</b><span>Track your progress</span>'; }
  document.querySelector('.topbar').classList.toggle('home', !title);
  $('#topAction').innerHTML = action;
}
function updateNav(){
  const fuel = $('.tabbar a[data-tab="food"]'); if (!fuel) return;
  const f = enabled('food'), s = enabled('supps');
  if (!f && !s) { fuel.href = '#/stats'; fuel.dataset.tab = 'food'; fuel.querySelector('span').textContent = 'Stats'; fuel.dataset.mode = 'stats'; }
  else { fuel.href = f ? '#/food' : '#/supps'; fuel.querySelector('span').textContent = f && s ? 'Nutrition' : f ? 'Food' : 'Supplements'; fuel.dataset.mode = 'fuel'; }
}

/* first-run */
function viewSetup(){
  document.body.classList.add('setup-mode');
  setHeader('');
  const v = $('#view'), pick = { grappling:true, weights:false, cardio:false, food:true, supps:false, weight:false };
  v.innerHTML = `<div class="welcome setup"><img class="mark" src="brand/chevron_mark_transparent_1024.svg" alt="" width="64" height="64">
    <h2>What do you train?</h2><p>Pick all that apply. You can change this any time in Profile.</p>
    <div class="tiles" id="catTiles">${CAT_KEYS.map(k => `<button type="button" class="tile" data-k="${k}" aria-pressed="false"><svg viewBox="0 0 24 24">${CATS[k].icon}</svg><b>${CATS[k].label}</b><small>${CATS[k].sub || CATS[k].disc.map(d=>d[1]).slice(0,3).join(', ')}</small></button>`).join('')}</div>
    <h3>Also track</h3>
    <div class="tiles two" id="extraTiles"><button type="button" class="tile" data-k="food"><b>Food</b><small>Calories &amp; protein</small></button><button type="button" class="tile" data-k="supps"><b>Supplements</b><small>Daily checklist</small></button><button type="button" class="tile" data-k="weight"><b>Weight goal</b><small>Lose or gain</small></button></div>
    <div id="wtWrap" style="text-align:left;margin-top:6px"></div>
    <button class="btn primary block" id="go" style="margin-top:18px">Get started</button>
    <button class="btn block ghost" id="loadSample" style="margin-top:10px">Load sample data (demo)</button></div>`;
  const wt = $('#wtWrap'); let wu = unit();
  const wNow = h(`<input class="input" type="text" inputmode="decimal" placeholder="Today" id="setupW">`), wGoal = h(`<input class="input" type="text" inputmode="decimal" placeholder="Target" id="setupGoal">`), wDate = h(`<input class="input" type="date" id="setupGoalDate" min="${today()}">`);
  wt.appendChild(field('Units', seg([['lb','lb'],['kg','kg']], wu, x => { wu = x; })));
  const wg = h('<div class="grid2"></div>'); wg.appendChild(field('Current weight', wNow)); wg.appendChild(field('Goal weight', wGoal)); wt.appendChild(wg);
  wt.appendChild(field('Goal date (optional)', wDate));
  const sync = () => { v.querySelectorAll('.tile').forEach(b => { b.classList.toggle('on', !!pick[b.dataset.k]); b.setAttribute('aria-pressed', !!pick[b.dataset.k]); }); wt.hidden = !pick.weight; };
  v.querySelectorAll('.tile').forEach(b => b.onclick = () => { pick[b.dataset.k] = !pick[b.dataset.k]; if (!CAT_KEYS.some(k => pick[k])) pick.grappling = true; sync(); });
  sync();
  $('#go').onclick = () => {
    db.profile = { ...db.profile, enabled:{ ...pick }, setupDone:true };
    if (pick.weight) { const now = num(wNow.value), gw = num(wGoal.value); db.profile.unit = wu;
      if (now) { db.weights.push({ id:uid(), date:today(), w:r1(now), u:wu, createdAt:Date.now() }); db.profile.startWeight = String(r1(now)); }
      if (gw) db.profile.goalWeight = String(r1(gw)); if (wDate.value) db.profile.goalDate = wDate.value; }
    save(); toast('All set. Tap + to log a workout'); route();
  };
  $('#loadSample').onclick = loadSample;
}

/* quick log helpers */
function lastOf(cat){ return sorted().find(s => catOf(s) === cat); }
function templates(){ return enabledCats().map(lastOf).filter(Boolean); }
function repeatSession(src){
  const rec = sanitizeSession({ category:catOf(src), discipline:src.discipline, gi:src.gi, type:src.type, duration:src.duration, rounds:src.rounds, intensity:src.intensity,
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
  const hasSample = db.sessions.some(s => s.sample) || db.nutrition.entries.some(e => e.sample) || db.supps.items.some(i => i.sample);
  v.innerHTML = `
    ${hasSample ? `<div class="banner"><span>📋 <b>Sample data</b> is loaded for the demo.</span><button class="btn sm" id="rmSample">Remove</button></div>` : ''}
    <div class="statrow three">
      <div class="stat hero"><div class="v">${st.week}</div><div class="l">Sessions this week</div></div>
      <div class="stat"><div class="v">${hrs(st.weekMin)}<small>h</small></div><div class="l">Hours this week</div></div>
      <div class="stat"><div class="v">${streak}<small>wk</small></div><div class="l">Week streak 🔥</div></div>
    </div>
    <div class="card quick"><h2>Quick log</h2>${repeatButtons() || '<div class="empty" style="padding:2px 0 10px">Your recent workouts will show here for one-tap logging.</div>'}
      <a class="btn primary block" href="#/log" id="homeLog"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Log a workout</a></div>
    ${enabled('weight') ? weightCard() : ''}
    ${enabled('food') ? nutritionCard() : ''}
    ${enabled('supps') ? suppCard() : ''}
    ${enabled('grappling') ? beltCard() : ''}
    <a class="btn block" href="#/stats" id="seeStats">See all stats ›</a>`;
  wireRepeat(v); wireWeight(v); wireBelt(v);
  const rm = $('#rmSample'); if (rm) rm.onclick = removeSample;
}

function sessSub(s){
  const c = catOf(s), rolls = s.rolls||[];
  if (c === 'cardio' && s.cardio) { const k = s.cardio; const bits = [k.distance ? `${r1(k.distance)} ${k.unit}` : '', k.sec ? fmtDur(k.sec) : `${s.duration} min`, s.discipline === 'bike' ? speedStr(k.sec, k.distance, k.unit) : paceStr(k.sec, k.distance, k.unit)]; return bits.filter(Boolean).join(' · '); }
  if (c === 'weights') { const ex = s.exercises||[]; return [`${s.duration} min`, ex.length ? `${ex.length} exercise${ex.length>1?'s':''}` : '', volumeOf(s) ? `${Math.round(volumeOf(s)).toLocaleString()} ${unit()} vol` : ''].filter(Boolean).join(' · '); }
  const w = rolls.filter(r => r.result==='win').length, l = rolls.filter(r => r.result==='loss').length;
  return [`${s.duration} min`, `${s.rounds||0} rounds`, rolls.length ? `${w}W ${l}L` : ''].filter(Boolean).join(' · ');
}
function sessRow(s){
  const d = parse(s.date), c = catOf(s);
  const dots = [1,2,3,4,5].map(i => `<i class="${i<=s.intensity?'on':''}"></i>`).join('');
  const tags = c === 'weights' ? (s.exercises||[]).map(e => e.name) : (s.techniques||[]);
  return `<a class="sess" href="#/session/${esc(s.id)}" style="--cat:${CATS[c].color}">
    <div class="d"><b>${d.getDate()}</b><span>${DOW[d.getDay()]}</span></div>
    <div class="m"><div class="t">${catDot(c)}${esc(sessTitle(s))} ${c==='grappling' && s.discipline==='bjj' ? `<span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>` : ''}${s.sample?'<span class="pill sample">Sample</span>':''}</div>
      <div class="s">${esc(sessSub(s))} · <span class="dots" aria-label="Intensity ${s.intensity}">${dots}</span></div>
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
      const hay = [s.notes, sessTitle(s), CATS[catOf(s)].label, ...(s.techniques||[]), ...(s.exercises||[]).map(e => e.name),
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
  if (c === 'weights') { const prs = prMap(s.id); body = `<div class="card"><h2>Exercises <small>${Math.round(volumeOf(s)).toLocaleString()} ${unit()} volume</small></h2>${(s.exercises||[]).length ? s.exercises.map(e => { const best = Math.max(0, ...e.sets.map(x => e1rm(Number(x.weight)||0, Number(x.reps)||0))); const pr = best && best > (prs[e.name.toLowerCase()]?.e1 || 0); return `<div class="ex-view"><div class="t"><b>${esc(e.name)}</b>${pr ? '<span class="pill pr">PR</span>' : ''}</div><div class="sets">${e.sets.map((x,i) => `<span>${i+1}. ${x.reps||0} × ${x.weight||0}${x.rpe!==''&&x.rpe!=null?` @${x.rpe}`:''}</span>`).join('')}</div></div>`; }).join('') : '<div class="empty" style="padding:4px 0">No exercises logged</div>'}</div>`; }
  if (c === 'cardio' && s.cardio) { const k = s.cardio; body = `<div class="kv"><div><b>${k.distance ? r1(k.distance) : '—'}<small style="font-size:13px;color:var(--muted)"> ${k.unit}</small></b><span>Distance</span></div><div><b>${k.sec ? fmtDur(k.sec) : s.duration+'m'}</b><span>Time</span></div><div><b>${(s.discipline==='bike' ? speedStr(k.sec,k.distance,k.unit) : paceStr(k.sec,k.distance,k.unit)) || '—'}</b><span>${s.discipline==='bike'?'Speed':'Pace'}</span></div></div>`; }
  $('#view').innerHTML = `
    <div class="sess-meta">${catDot(c)}${CATS[c].label} · ${fmtDate(s.date)} ${c==='grappling'&&s.discipline==='bjj' ? `<span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>` : ''}${s.sample?'<span class="pill sample">Sample</span>':''}${s.source?`<span class="pill">📎 ${esc(s.source)}</span>`:''}</div>
    <div class="kv"><div><b>${s.duration}<small style="font-size:13px;color:var(--muted)"> min</small></b><span>Duration</span></div><div><b>${c==='weights'||c==='cardio' ? (INTENSITY[s.intensity]||'') : (s.rounds||0)}</b><span>${c==='weights'||c==='cardio' ? 'Effort' : 'Rounds'}</span></div><div><b>${s.intensity}/5</b><span>Intensity</span></div></div>
    ${body}${hrBlock(s.hr)}
    ${s.weight ? `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--muted);font-weight:650">Body weight</span><b style="font-size:20px">${esc(s.weight)} ${unit()}</b></div>` : ''}
    ${s.notes ? `<div class="card"><h2>Notes</h2><div style="white-space:pre-wrap">${esc(s.notes)}</div></div>` : ''}
    <div style="display:flex;gap:10px;margin-top:6px"><a class="btn primary" style="flex:1" href="#/edit/${esc(s.id)}">Edit</a><button class="btn danger" id="del">Delete</button></div>`;
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
    duration:last?.duration || CATS[cat].dur, rounds:cat==='grappling' ? 5 : 0, intensity:3, techniques:[], rolls:[], weight:'', notes:'',
    exercises:[], cardio:{ distance:'', unit:distU(), sec:0 }, hr:{ avg:'', max:'', cal:'', zones:['','','','',''] }, _open:false };
}
function hydrate(s){
  const b = blankSession(catOf(s)), f = JSON.parse(JSON.stringify(s));
  f.exercises = f.exercises || []; f.cardio = f.cardio || b.cardio; f.hr = f.hr ? { ...b.hr, ...f.hr, zones:f.hr.zones||b.hr.zones } : b.hr;
  f._open = true; return f;
}
function toRecord(f){
  const c = f.category, out = { ...f };
  delete out._open; delete out._durTouched;
  if (c !== 'grappling') { out.rolls = []; }
  delete out.strike;
  if (c !== 'weights') delete out.exercises; else out.exercises = f.exercises.map(e => ({ ...e, sets:e.sets.filter(x => x.reps !== '' || x.weight !== '') }));
  if (c !== 'cardio') delete out.cardio; else if (!f.cardio.distance && !f.cardio.sec) delete out.cardio;
  if (c === 'grappling') out.rounds = Math.max(Number(f.rounds)||0, f.rolls.length);
  if (c === 'cardio' && f.cardio.sec) out.duration = Math.max(1, Math.round(f.cardio.sec/60));
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
  const catEl = h(`<div class="cats n${cats.length}" role="radiogroup">${cats.map(k => `<button type="button" role="radio" data-c="${k}" class="${f.category===k?'on':''}" aria-checked="${f.category===k}" style="--cat:${CATS[k].color}"><svg viewBox="0 0 24 24">${CATS[k].icon}</svg>${CATS[k].label}</button>`).join('')}</div>`);
  catEl.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (f.category === b.dataset.c) return;
    const nb = blankSession(b.dataset.c);
    f.category = nb.category; f.discipline = nb.discipline; f.gi = nb.gi;
    if (!f._durTouched) f.duration = nb.duration;
    redraw();
  });
  v.appendChild(field('Workout', catEl));
  // 2. discipline (+ gi for BJJ)
  const C = CATS[f.category];
  if (C.disc.length > 1 && (f.category !== 'grappling' || f.discipline !== 'bjj')) { const ds = seg(C.disc, f.discipline, x => { f.discipline = x; if (f.category === 'grappling') redraw(); }, C.disc.length > 4); if (C.disc.length > 4) ds.classList.add('three'); v.appendChild(field(f.category === 'cardio' ? 'Activity' : 'Style', ds)); }
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
  const placeNotes = () => { if (!notesPlaced) { D.appendChild(notesF); notesPlaced = true; } };
  if (f.category === 'grappling') {
    D.appendChild(field('Session type', seg(SESSION_TYPES, f.type, x => f.type = x, true)));
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
  if (f.category === 'grappling' || f.category === 'weights' || f.category === 'cardio') {
    const intens = h(`<div><div class="intensity">${[1,2,3,4,5].map(i => `<button type="button" data-i="${i}" aria-label="Intensity ${i}">${i}</button>`).join('')}</div><div class="hint" id="intLabel"></div></div>`);
    const syncI = () => { intens.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.i) === f.intensity)); intens.querySelector('#intLabel').textContent = INTENSITY[f.intensity]; };
    intens.querySelectorAll('button').forEach(b => b.onclick = () => { f.intensity = Number(b.dataset.i); syncI(); });
    syncI(); D.appendChild(field('Intensity', intens));
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
  };
  if (formBase == null) formBase = formSnap(f);
  const d = actions.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (await confirmSheet('Delete this workout?', "This can't be undone.")) { db.sessions = db.sessions.filter(x => x.id !== f.id); save(); form = null; toast('Workout deleted'); go('#/history'); } };
  actions.classList.add('stick');
  v.appendChild(actions);
}
const r2 = n => Math.round(n*100)/100;

function exerciseEditor(f){
  const wrap = h(`<div class="field"><div class="label" style="display:flex;justify-content:space-between">Exercises <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:600" id="volSum"></span></div><div class="exlist"></div><button type="button" class="btn block" id="addEx"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add exercise</button></div>`);
  const list = wrap.querySelector('.exlist');
  const known = () => uniqueMerge(countBy(db.sessions.flatMap(s => (s.exercises||[]).map(e => e.name))).map(x => x[0]), EXERCISES);
  const prs = prMap(f.id);
  const drawSum = () => { const v = f.exercises.reduce((a,e) => a + e.sets.reduce((b,x) => b + num(x.reps)*num(x.weight), 0), 0); wrap.querySelector('#volSum').textContent = v ? `${Math.round(v).toLocaleString()} ${unit()} volume` : 'Optional'; };
  const draw = () => {
    list.innerHTML = '';
    f.exercises.forEach((e, ei) => {
      const card = h(`<div class="excard"><div class="exhead"><input class="input exname" type="text" autocapitalize="words" autocomplete="off" placeholder="Exercise" value="${esc(e.name)}"><button type="button" class="iconbtn big" aria-label="Remove exercise"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div><div class="sugg"></div>
        <div class="sethead"><span>Set</span><span>Reps</span><span>${unit()}</span><span>RPE</span><span></span></div><div class="sets"></div><div class="exfoot"><button type="button" class="btn sm" data-addset>+ Add set</button><span class="prnote"></span></div></div>`);
      const name = card.querySelector('.exname'), sugg = card.querySelector('.sugg');
      const drawSugg = () => { const q = name.value.trim().toLowerCase(); sugg.innerHTML = ''; if (document.activeElement !== name && e.name) return;
        known().filter(x => !q || x.toLowerCase().includes(q)).filter(x => x.toLowerCase() !== q).slice(0,10).forEach(x => { const b = h(`<button type="button">${esc(x)}</button>`); b.onclick = () => { e.name = x; name.value = x; sugg.innerHTML = ''; drawPR(); }; sugg.appendChild(b); }); };
      sugg.addEventListener('mousedown', ev => ev.preventDefault());
      name.oninput = () => { e.name = name.value; drawSugg(); drawPR(); }; name.onfocus = drawSugg; name.onblur = () => setTimeout(() => { sugg.innerHTML = ''; }, 150);
      card.querySelector('.exhead .iconbtn').onclick = () => { f.exercises.splice(ei,1); draw(); };
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
  return `<h3 class="sect-h">BJJ</h3>
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
  if (!db.sessions.length) { v.innerHTML = `<div class="empty" style="padding:40px 10px">Log a few workouts to see your stats.<br><br><a class="btn primary" href="#/log">Log a workout</a></div>${enabled('weight') || weightSeries().length ? weightStatsCard() : ''}`; wireWeight(v); return; }
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
    ${catBreakdown()}
    ${prCard()}
    ${cardioCard()}
    ${enabled('weight') || ws.length ? weightStatsCard() : ''}
    ${enabled('food') ? nutritionCard() : ''}
    ${grapplingStats()}
    <div class="card"><h2>Recent <a href="#/history" style="color:var(--accent);text-decoration:none;text-transform:none;letter-spacing:0;font-size:13px">History ›</a></h2>${sorted().slice(0,3).map(sessRow).join('')}</div>
    <div class="foot">${st.total} sessions · ${hrs(st.totalMin)} total hours</div>`;
  wireWeight(v);
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
  if (/strik|boxing|muay|kickbox|\bmma\b/.test(rawCat + ' ' + rawDisc)) return null; // striking is no longer tracked
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
  v.innerHTML = `${fuelSwitch('food')}
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

/* ---------------- supplements ---------------- */
const SUPP_TIMES = [['morning','Morning'],['pre','Pre-training'],['post','Post-training'],['afternoon','Afternoon'],['evening','Evening'],['bed','Bedtime'],['any','Any time']];
const SUPP_UNITS = ['g','mg','mcg','IU','ml','caps','tabs','scoop','serving'];
const defaultSupps = () => ({ items:[], log:[] });
const timeLabel = t => (SUPP_TIMES.find(x => x[0]===t)||[,'Any time'])[1];
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
function suppScheduledOn(it, d){
  if (d < (it.start || '0000')) return false;
  const s = it.schedule || { type:'daily' };
  if (s.type === 'weekdays') return (s.days||[]).includes(parse(d).getDay());
  if (s.type === 'interval') { const n = Math.max(1, Number(s.every)||1); return daysBetween(it.start || d, d) % n === 0; }
  return true;
}
function schedLabel(it){
  const s = it.schedule || { type:'daily' };
  if (s.type === 'weekdays') { const ds = [...(s.days||[])].sort((a,b) => ((a+6)%7)-((b+6)%7)); return ds.length === 7 ? 'Daily' : ds.length === 1 ? `${DOW[ds[0]]}s only` : ds.map(x => DOW[x]).join(' · '); }
  if (s.type === 'interval') return Number(s.every) > 1 ? `Every ${s.every} days` : 'Daily';
  return 'Daily';
}
const activeSupps = () => db.supps.items.filter(i => !i.archived);
const takenRec = (id, d) => db.supps.log.find(l => l.itemId === id && l.date === d);
function suppToday(d=today()){
  const items = activeSupps().filter(i => suppScheduledOn(i, d));
  return { items, taken: items.filter(i => takenRec(i.id, d)).length };
}
// Adherence over the last n days. Today's still-pending doses aren't counted as misses.
function itemAdherence(it, n){
  let due = 0, done = 0; const t = today();
  for (let k = 0; k < n; k++) { const d = iso(addDays(parse(t), -k)); if (!suppScheduledOn(it, d)) continue; const tk = !!takenRec(it.id, d); if (d === t && !tk) continue; due++; if (tk) done++; }
  return { due, done, pct: due ? Math.round(done/due*100) : null };
}
function itemStreak(it){
  let n = 0, d = parse(today());
  for (let k = 0; k < 800; k++, d = addDays(d, -1)) {
    const ds = iso(d); if (ds < (it.start||'0000')) break;
    if (!suppScheduledOn(it, ds)) continue;
    if (takenRec(it.id, ds)) n++; else if (ds === today()) continue; else break;
  }
  return n;
}
function overallAdherence(n){
  let due = 0, done = 0; activeSupps().forEach(it => { const a = itemAdherence(it, n); due += a.due; done += a.done; });
  return due ? Math.round(done/due*100) : null;
}
function overallStreak(){ // consecutive days on which every scheduled item was taken
  const items = activeSupps(); if (!items.length) return 0;
  let n = 0, d = parse(today());
  for (let k = 0; k < 800; k++, d = addDays(d, -1)) {
    const ds = iso(d), due = items.filter(i => suppScheduledOn(i, ds));
    if (!due.length) { if (items.every(i => ds < (i.start||'0000'))) break; continue; }
    const all = due.every(i => takenRec(i.id, ds));
    if (all) n++; else if (ds === today()) continue; else break;
  }
  return n;
}
const fmtTime = ts => { const d = new Date(ts); let h = d.getHours(); const m = pad(d.getMinutes()), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m} ${ap}`; };
function suppCard(){
  if (!db.supps.items.length) return `<div class="card" id="suppCard"><h2>Supplements</h2><div class="empty" style="padding:4px 0 10px">Set up your stack to get a daily checklist.</div><a class="btn block" href="#/supps">Set up supplements</a></div>`;
  const st = suppToday(), a7 = overallAdherence(7), pct = st.items.length ? st.taken/st.items.length*100 : 0;
  return `<div class="card" id="suppCard"><h2>Supplements today <a href="#/supps" style="color:var(--accent);text-decoration:none;text-transform:none;letter-spacing:0;font-size:13px">Checklist ›</a></h2>
    <div class="supp-sum"><b>${st.taken}<small>/${st.items.length}</small></b><span>taken today</span><span class="r">${a7==null?'—':a7+'%'}<small>7-day adherence</small></span></div>
    <div class="mbar"><div class="b"><i style="width:${pct}%"></i></div></div>
    ${st.items.length && st.taken < st.items.length ? `<div class="hint">Next: ${esc(st.items.filter(i => !takenRec(i.id, today())).slice(0,3).map(i => i.name).join(', '))}</div>` : st.items.length ? '<div class="hint">All done for today ✓</div>' : '<div class="hint">Nothing scheduled today.</div>'}</div>`;
}
function fuelSwitch(which){
  if (!(enabled('food') && enabled('supps'))) return '';
  return `<div class="seg fuelseg" role="tablist"><a role="tab" href="#/food" class="${which==='food'?'on':''}">Food</a><a role="tab" href="#/supps" class="${which==='supps'?'on':''}">Supplements</a></div>`;
}

let suppDate = null;
function viewSupps(d){
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) suppDate = d;
  if (!suppDate || suppDate > today()) suppDate = today();
  const day = suppDate, isToday = day === today();
  setHeader('Supplements', `<button class="btn sm" id="manageStack">My stack</button>`);
  const v = $('#view');
  const items = activeSupps().filter(i => suppScheduledOn(i, day));
  const taken = items.filter(i => takenRec(i.id, day)).length;
  const groups = SUPP_TIMES.map(([k,l]) => [k, l, items.filter(i => (i.time||'any') === k)]).filter(g => g[2].length);
  const a7 = overallAdherence(7), a30 = overallAdherence(30), streak = overallStreak();
  v.innerHTML = `${fuelSwitch('supps')}
    <div class="daynav"><a class="iconbtn big" href="#/supps/${iso(addDays(parse(day),-1))}" aria-label="Previous day"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <div class="dn-t"><b>${isToday ? 'Today' : fmtDate(day).replace(/, \d{4}$/,'')}</b>${isToday ? `<span>${fmtShort(day)}</span>` : `<a href="#/supps/${today()}">Jump to today</a>`}</div>
      ${isToday ? '<span class="iconbtn big" style="opacity:.25"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>' : `<a class="iconbtn big" href="#/supps/${iso(addDays(parse(day),1))}" aria-label="Next day"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></a>`}</div>
    ${!db.supps.items.length ? `<div class="welcome" style="padding-top:10px"><h2>Build your stack</h2><p>Add each supplement with its dose, time of day and schedule. You'll get a one-tap daily checklist and adherence stats.</p><button class="btn primary" id="firstSupp">Add a supplement</button></div>` : `
    <div class="card supp-head"><div><b id="suppCount">${taken}<small>/${items.length}</small></b><span>taken ${isToday ? 'today' : 'this day'}</span></div><div class="mbar" style="flex:1"><div class="b"><i style="width:${items.length ? taken/items.length*100 : 0}%"></i></div></div></div>
    ${groups.length ? groups.map(([k,l,list]) => `<div class="supp-group"><div class="month grp">${l}${list.some(it => !takenRec(it.id, day)) ? `<button type="button" class="btn sm allbtn" data-all="${k}">Mark all taken</button>` : '<span class="alldone">All taken ✓</span>'}</div>${list.map(it => { const r = takenRec(it.id, day); return `<button type="button" class="supp-item ${r?'done':''}" data-id="${esc(it.id)}" aria-pressed="${!!r}">
        <span class="tick">${r ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span>
        <span class="grow"><b>${esc(it.name)}</b><small>${esc(it.dose)} ${esc(it.unit)} · ${esc(schedLabel(it))}</small></span>
        <span class="when">${r ? `Taken<br>${fmtTime(r.takenAt)}` : 'Tap to<br>mark taken'}</span></button>`; }).join('')}</div>`).join('') : '<div class="empty">Nothing scheduled for this day.</div>'}
    <div class="card"><h2>Adherence</h2>
      <div class="kv" style="margin-bottom:10px"><div><b>${a7==null?'—':a7+'%'}</b><span>Last 7 days</span></div><div><b>${a30==null?'—':a30+'%'}</b><span>Last 30 days</span></div><div><b>${streak}<small style="font-size:13px;color:var(--muted)"> d</small></b><span>All-taken streak</span></div></div>
      ${activeSupps().map(it => { const w = itemAdherence(it, 7), m = itemAdherence(it, 30), s = itemStreak(it); return `<div class="list-row adh"><div class="grow"><b>${esc(it.name)}</b><small>${esc(schedLabel(it))} · streak ${s}</small></div><span class="pct ${w.pct!=null&&w.pct<70?'low':''}">${w.pct==null?'—':w.pct+'%'}<small>7d</small></span><span class="pct ${m.pct!=null&&m.pct<70?'low':''}">${m.pct==null?'—':m.pct+'%'}<small>30d</small></span></div>`; }).join('')}
      <div class="hint">Streak = consecutive scheduled doses taken. Today's pending doses don't count as missed.</div></div>`}`;
  v.querySelectorAll('.supp-item').forEach(b => b.onclick = () => toggleSupp(b.dataset.id, day));
  v.querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
    const pend = items.filter(it => (it.time||'any') === b.dataset.all && !takenRec(it.id, day)), now = Date.now();
    const ts = day === today() ? now : (() => { const d = parse(day); d.setHours(12,0,0,0); return d.getTime(); })();
    const recs = pend.map(it => ({ id:uid(), itemId:it.id, date:day, takenAt:ts })); db.supps.log.push(...recs); save();
    const ids = new Set(recs.map(r => r.id));
    undoToast(`${recs.length} marked taken ✓`, () => { db.supps.log = db.supps.log.filter(l => !ids.has(l.id)); save(); route(); });
    const y = window.scrollY; route(); window.scrollTo(0, y);
  });
  $('#manageStack').onclick = stackSheet;
  const fs = $('#firstSupp'); if (fs) fs.onclick = () => suppForm(null);
}
function toggleSupp(id, day){
  const r = takenRec(id, day), it = db.supps.items.find(x => x.id === id);
  if (r) { db.supps.log = db.supps.log.filter(l => l !== r); save(); toast(`Unmarked ${it.name}`); }
  else {
    const now = new Date(); let ts = now.getTime();
    if (day !== today()) { const d = parse(day); d.setHours(12,0,0,0); ts = d.getTime(); } // backfilled day: noon placeholder
    const rec = { id:uid(), itemId:id, date:day, takenAt:ts }; db.supps.log.push(rec); save();
    undoToast(`${it.name} taken ✓`, () => { db.supps.log = db.supps.log.filter(l => l.id !== rec.id); save(); route(); });
  }
  const y = window.scrollY; route(); window.scrollTo(0, y);
}
function undoToast(msg, undo){
  const t = $('#toast'); t.innerHTML = `${esc(msg)} <button type="button" class="undo">Undo</button>`; t.classList.add('show', 'act');
  t.querySelector('.undo').onclick = () => { t.classList.remove('show','act'); undo(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show','act'), 4000);
}
function stackSheet(){
  const el = h(`<div><h3>My stack</h3><div class="slist"></div><button type="button" class="btn primary block" id="addSupp" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add supplement</button></div>`);
  const list = el.querySelector('.slist');
  const rows = arr => arr.map(it => `<button type="button" class="list-row srow ${it.archived?'arch':''}" data-id="${esc(it.id)}"><div class="grow"><b>${esc(it.name)}</b><small>${esc(it.dose)} ${esc(it.unit)} · ${esc(timeLabel(it.time))} · ${esc(schedLabel(it))}</small></div><svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>`).join('');
  const act = db.supps.items.filter(i => !i.archived), arch = db.supps.items.filter(i => i.archived);
  list.innerHTML = (act.length ? rows(act) : '<div class="empty">No active supplements.</div>') + (arch.length ? `<div class="month">Archived</div>${rows(arch)}` : '');
  list.querySelectorAll('.srow').forEach(b => b.onclick = () => suppForm(b.dataset.id));
  el.querySelector('#addSupp').onclick = () => suppForm(null);
  openSheet(el);
}
function suppForm(id){
  const ex = id ? db.supps.items.find(i => i.id === id) : null;
  const it = ex ? JSON.parse(JSON.stringify(ex)) : { id:null, name:'', dose:'', unit:'g', time:'morning', schedule:{ type:'daily', days:[], every:2 }, start:today(), archived:false };
  it.schedule = { type:'daily', days:[], every:2, ...it.schedule }; if (!it.schedule.days.length) it.schedule.days = [parse(today()).getDay()];
  const el = h(`<div class="suppform"><h3>${ex ? 'Edit supplement' : 'Add supplement'}</h3></div>`);
  const name = h(`<input class="input" type="text" autocapitalize="words" autocomplete="off" placeholder="e.g. Creatine" value="${esc(it.name)}">`);
  name.oninput = () => it.name = name.value; el.appendChild(field('Name', name));
  const g = h('<div class="grid2"></div>');
  const dose = h(`<input class="input" type="text" inputmode="decimal" placeholder="e.g. 5" value="${esc(it.dose)}">`); dose.oninput = () => it.dose = dose.value.trim();
  g.appendChild(field('Dose', dose));
  const unitSel = h(`<select class="input">${SUPP_UNITS.map(u => `<option ${it.unit===u?'selected':''}>${u}</option>`).join('')}</select>`); unitSel.onchange = () => it.unit = unitSel.value;
  g.appendChild(field('Unit', unitSel)); el.appendChild(g);
  el.appendChild(field('Time of day', seg(SUPP_TIMES, it.time, x => it.time = x, true)));
  const schedWrap = h('<div></div>');
  const days = h(`<div class="daychips">${[1,2,3,4,5,6,0].map(dw => `<button type="button" data-d="${dw}" aria-pressed="false">${DOW[dw].slice(0,2)}</button>`).join('')}</div>`);
  const syncDays = () => days.querySelectorAll('button').forEach(b => { const on = it.schedule.days.includes(Number(b.dataset.d)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  days.querySelectorAll('button').forEach(b => b.onclick = () => { const dw = Number(b.dataset.d), s = it.schedule; s.days = s.days.includes(dw) ? s.days.filter(x => x !== dw) : [...s.days, dw]; syncDays(); });
  const every = stepper(it.schedule.every || 2, { min:2, max:60, unitLabel:'days', onChange:x => it.schedule.every = x });
  const start = h(`<input class="input" type="date" value="${esc(it.start)}">`); start.onchange = () => it.start = start.value || today();
  const extra = h('<div class="sched-extra"></div>');
  const drawSched = () => { extra.innerHTML = ''; if (it.schedule.type === 'weekdays') { extra.appendChild(field('On these days', days)); syncDays(); } else if (it.schedule.type === 'interval') { extra.appendChild(field('Every', every)); } };
  schedWrap.appendChild(field('Schedule', seg([['daily','Daily'],['weekdays','Specific days'],['interval','Every N days']], it.schedule.type, x => { it.schedule.type = x; drawSched(); })));
  schedWrap.appendChild(extra); el.appendChild(schedWrap); drawSched();
  el.appendChild(field('Start date', start, 'Adherence and "every N days" are counted from this date.'));
  const btns = h(`<div class="suppbtns"><button type="button" class="btn primary block" data-save>${ex ? 'Save changes' : 'Add to stack'}</button>${ex ? `<div style="display:flex;gap:10px"><button type="button" class="btn" style="flex:1" data-arch>${ex.archived ? 'Restore' : 'Archive'}</button><button type="button" class="btn danger" style="flex:1" data-del>Delete</button></div>` : ''}</div>`);
  btns.querySelector('[data-save]').onclick = () => {
    const nm = (name.value||'').trim(); if (!nm) { toast('Enter a name'); return; }
    if (it.schedule.type === 'weekdays' && !it.schedule.days.length) { toast('Pick at least one day'); return; }
    const rec = { id: ex ? ex.id : uid(), name:nm, dose:String(it.dose||'').trim(), unit:it.unit, time:it.time, schedule:{ type:it.schedule.type, days:[...it.schedule.days].sort(), every:Number(it.schedule.every)||2 }, start:it.start || today(), archived:!!it.archived, createdAt: ex?.createdAt || Date.now() };
    if (ex) db.supps.items[db.supps.items.findIndex(i => i.id === ex.id)] = rec; else db.supps.items.push(rec);
    save(); closeSheet(); toast(ex ? 'Supplement updated' : `${nm} added to stack`); route();
  };
  const ar = btns.querySelector('[data-arch]'); if (ar) ar.onclick = () => { ex.archived = !ex.archived; save(); closeSheet(); toast(ex.archived ? `${ex.name} archived` : `${ex.name} restored`); route(); };
  const dl = btns.querySelector('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmSheet(`Delete ${ex.name}?`, 'This removes the item and its whole taken history. Archive instead to keep the history.')) { db.supps.items = db.supps.items.filter(i => i.id !== ex.id); db.supps.log = db.supps.log.filter(l => l.itemId !== ex.id); save(); toast('Supplement deleted'); route(); } };
  el.appendChild(btns);
  openSheet(el, null, { closeLabel:'Cancel' });
  if (!ex) name.focus({ preventScroll:true });
}
function sampleSupps(){
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const start = iso(addDays(new Date(), -42));
  const S = (name, dose, unit, time, schedule) => ({ id:uid(), name, dose, unit, time, schedule:{ days:[], every:2, ...schedule }, start, archived:false, sample:true, createdAt:Date.now() });
  const items = [
    S('Creatine monohydrate','5','g','morning',{ type:'daily' }),
    S('Multivitamin','1','tabs','morning',{ type:'daily' }),
    S('Fish oil','2','caps','morning',{ type:'daily' }),
    S('Protein shake','1','scoop','post',{ type:'weekdays', days:[1,3,6] }),
    S('Magnesium glycinate','400','mg','evening',{ type:'daily' }),
    S('Vitamin D3','50000','IU','morning',{ type:'weekdays', days:[6] }),
    S('Collagen + vitamin C','10','g','pre',{ type:'interval', every:2 })
  ];
  const log = [], t = today();
  for (let k = 42; k >= 0; k--) {
    const d = iso(addDays(new Date(), -k));
    items.forEach(it => {
      if (!suppScheduledOn(it, d)) return;
      if (d === t && it.time !== 'morning') return; // today: only morning items done so far
      const miss = it.schedule.type === 'weekdays' && it.schedule.days.length === 1 ? 0 : it.time === 'evening' ? .2 : .1;
      if (rnd() < miss && !(d === t)) return;
      const base = parse(d); base.setHours({ morning:7, pre:17, post:19, evening:21 }[it.time] || 12, Math.floor(rnd()*50), 0, 0);
      log.push({ id:uid(), itemId:it.id, date:d, takenAt:Math.min(base.getTime(), Date.now()), sample:true });
    });
  }
  return { items, log };
}
function sanitizeSupps(s){
  const items = Array.isArray(s?.items) ? s.items.filter(i => i && i.name).map(i => ({ id:String(i.id||uid()), name:String(i.name), dose:String(i.dose??''), unit:String(i.unit||''),
    time:SUPP_TIMES.some(t => t[0]===i.time) ? i.time : 'any',
    schedule:{ type:['daily','weekdays','interval'].includes(i.schedule?.type) ? i.schedule.type : 'daily', days:Array.isArray(i.schedule?.days) ? i.schedule.days.map(Number).filter(x => x>=0 && x<=6) : [], every:Math.max(1, Number(i.schedule?.every)||2) },
    start:/^\d{4}-\d{2}-\d{2}$/.test(i.start||'') ? i.start : today(), archived:!!i.archived, ...(i.sample ? { sample:true } : {}), createdAt:i.createdAt||Date.now() })) : [];
  const ids = new Set(items.map(i => i.id));
  const log = Array.isArray(s?.log) ? s.log.filter(l => l && ids.has(String(l.itemId)) && /^\d{4}-\d{2}-\d{2}$/.test(l.date||'')).map(l => ({ id:String(l.id||uid()), itemId:String(l.itemId), date:l.date, takenAt:Number(l.takenAt)||parse(l.date).getTime(), ...(l.sample ? { sample:true } : {}) })) : [];
  return { items, log };
}

/* ---------------- settings ---------------- */
function viewSettings(){
  setHeader('Profile');
  const p = db.profile, v = $('#view'); v.innerHTML = '';
  const sec = h(`<div class="card" id="sectionsCard"><h2>What I track</h2><div class="toggles"></div><div class="hint">Hidden sections disappear from the app. Your data is kept.</div></div>`);
  [...CAT_KEYS.map(k => [k, CATS[k].label, CATS[k].disc.map(d => d[1]).join(', ')]), ['weight','Weight goal','Weigh-ins & progress'], ['food','Food','Calories, protein, meals'], ['supps','Supplements','Daily checklist']].forEach(([k,l,sub]) => {
    const row = h(`<label class="toggle"><span><b>${l}</b><small>${esc(sub)}</small></span><input type="checkbox" role="switch" data-sec="${k}" ${enabled(k)?'checked':''}><i></i></label>`);
    row.querySelector('input').onchange = e => { const en = { ...(p.enabled||{}) }; SECTION_KEYS().forEach(x => { if (!(x in en)) en[x] = enabled(x); }); en[k] = e.target.checked;
      if (!CAT_KEYS.some(x => en[x])) { e.target.checked = true; toast('Keep at least one workout type'); return; }
      p.enabled = en; save(); updateNav(); toast(`${l} ${e.target.checked ? 'shown' : 'hidden'}`); };
    sec.querySelector('.toggles').appendChild(row);
  });
  v.appendChild(sec);
  const card = h(`<div class="card" id="rankCard"><h2>Belt <a class="lnk" href="#/belts">Timeline ›</a></h2>${currentRank() ? `<div class="belt">${beltBar(currentRank().belt, currentRank().stripes)}</div><div class="belt-meta"><span><b>${esc(beltOf(currentRank().belt)[1])} belt</b>${currentRank().stripes ? ` · ${rankLabel(currentRank())}` : ''}</span><span>since ${fmtShort(beltGroups().slice(-1)[0].start)}</span></div>` : beltEmpty()}
    <button type="button" class="btn primary block" data-promo style="margin-top:12px">Log promotion</button><div class="hint" style="margin-top:8px">${(db.belts||[]).length} promotion${(db.belts||[]).length === 1 ? '' : 's'} in your history. Edit or delete them on the timeline.</div></div>`);
  wireBelt(card);
  if (enabled('grappling')) v.appendChild(card);

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

  const hasSample = db.sessions.some(s => s.sample) || db.nutrition.entries.some(e => e.sample) || db.supps.items.some(i => i.sample);
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
    </div>${(db.archive?.striking||[]).length ? `<p class="hint" id="archNote" style="margin-top:12px">${db.archive.striking.length} striking session${db.archive.striking.length === 1 ? '' : 's'} from an earlier version ${db.archive.striking.length === 1 ? 'is' : 'are'} kept on this device and included in Export backup, but hidden because striking is no longer tracked.</p>` : ''}</div>`);
  v.appendChild(data);
  v.appendChild(h(`<div class="card"><h2>Install on iPhone</h2><div style="color:var(--muted);font-size:14px">In Safari, tap <b style="color:var(--text)">Share</b> → <b style="color:var(--text)">Add to Home Screen</b>. It opens full-screen and works offline.</div></div>`));
  v.appendChild(h(`<div class="foot">Discipline &gt; Motivation · v${APP_VERSION} · ${db.sessions.length} sessions · ${db.nutrition.entries.length} food entries stored</div>`));

  $('#exp').onclick = exportData;
  $('#impFile').onchange = e => importData(e.target.files[0]);
  $('#csvFile').onchange = e => importCSVWorkouts(e.target.files[0]);
  const ld = $('#ldS'); if (ld) ld.onclick = loadSample;
  const rm = $('#rmS'); if (rm) rm.onclick = removeSample;
  $('#clr').onclick = async () => {
    if (await confirmSheet('Clear all data?', `This permanently deletes ${db.sessions.length} sessions, ${db.nutrition.entries.length} food entries, saved foods, ${db.supps.items.length} supplements with their history, ${db.weights.length} weigh-ins, ${db.belts.length} belt promotions and your profile from this device. Export a backup first if you want to keep them.`, 'Clear everything')) {
      db = emptyDb(); save(); form = null; foodDate = null; suppDate = null; toast('All data cleared'); go('#/');
    }
  };
}

function exportData(){
  const payload = { app:'discipline-motivation', version:APP_VERSION, schema:SCHEMA, exportedAt:new Date().toISOString(), profile:db.profile, sessions:db.sessions, nutrition:db.nutrition, supps:db.supps, weights:db.weights, belts:db.belts, archive:db.archive || { striking:[] } };
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
    const nut = sanitizeNutrition(d.nutrition), sup = sanitizeSupps(d.supps), wts = sanitizeWeights(src.weights), blt = sanitizeBelts(src.belts);
    if (await confirmSheet(`Import ${valid.length} sessions, ${nut.entries.length} food entries and ${sup.items.length} supplements?`, `This replaces the ${db.sessions.length} sessions, ${db.nutrition.entries.length} food entries and ${db.weights.length} weigh-ins currently on this device.`, 'Replace & import', false)) {
      db = { schema:SCHEMA, sessions:valid, profile:{ ...defaultProfile(), ...(src.profile||{}), setupDone:true }, nutrition:nut, supps:sup, weights:wts, belts:blt, archive:{ striking:src.archive?.striking || [] } }; syncProfileRank(); save(); toast(`Imported ${valid.length} sessions`); route();
    }
  } catch(e) { console.warn(e); toast('That file isn\'t a valid backup'); }
  finally { const f = $('#impFile'); if (f) f.value = ''; }
}

/* ---------------- sample data ---------------- */
function sampleOtherWorkouts(){
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd()*a.length)], out = [], start = addDays(new Date(), -84), total = 84;
  const lifts = [['Back squat', 245, 275, 5], ['Bench press', 185, 205, 5], ['Deadlift', 315, 355, 3], ['Overhead press', 115, 130, 5], ['Pull-up', 0, 0, 8], ['Barbell row', 155, 175, 8]];
  for (let d = new Date(start), i = 0; d <= new Date(); d = addDays(d, 1), i++) {
    const dow = d.getDay(), prog = i / total, date = iso(d), created = Math.min(Date.now() - 120000, d.getTime() - 3600e3);
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
  db.sessions = db.sessions.filter(s => !s.sample).concat(sessions.map(sanitizeSession));
  db.profile = { ...db.profile, setupDone:true, enabled:{ grappling:true, weights:true, cardio:true, food:true, supps:true, weight:true } };
  db.weights = (db.weights||[]).filter(x => !x.sample).concat(sampleWeights());
  if (!(db.belts||[]).some(x => !x.sample)) { db.belts = sampleBelts(); syncProfileRank(); }
  const nut = sampleNutrition(), names = new Set(db.nutrition.foods.map(f => f.name.toLowerCase()));
  const sup = sampleSupps(); db.supps = { items: db.supps.items.filter(i => !i.sample).concat(sup.items), log: db.supps.log.filter(l => !l.sample).concat(sup.log) };
  db.nutrition = { entries: db.nutrition.entries.filter(e => !e.sample).concat(nut.entries), foods: db.nutrition.foods.filter(f => !f.sample).concat(nut.foods.filter(f => !names.has(f.name.toLowerCase()))), water:(db.nutrition.water||[]).filter(x => !x.sample).concat(sampleWater()) };
  if (!db.profile.waterGoal) db.profile = { ...db.profile, waterGoal:2840 };
  if (!db.profile.targets) db.profile = { ...db.profile, targets:{ cal:2300, p:190, c:220, f:75 } };
  if (!db.profile.sampleProfile && !db.profile.goalWeight) db.profile = { ...db.profile, goalWeight:'195', sampleProfile:true };
  if (!db.profile.startWeight && !(db.weights||[]).some(x => !x.sample)) db.profile = { ...db.profile, goalWeight: db.profile.goalWeight || String(Math.round(convW(195, 'lb', unit())*10)/10), startWeight: String(Math.round(convW(215, 'lb', unit())*10)/10), goalDate: db.profile.goalDate || iso(addDays(new Date(), 70)) };
  save(); toast(`Loaded ${sessions.length} sample sessions`); route();
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
  return [[1150,'white',0,'Started BJJ'],[965,'white',1,''],[800,'white',2,''],[640,'white',3,'First competition the week before.'],[480,'white',4,''],[300,'blue',0,'Promoted at the end-of-year seminar.'],[115,'blue',1,'']]
    .map(([n, belt, stripes, notes], i) => ({ id:'sb' + i, date:d(n), belt, stripes, instructor:'Prof. Ana Silva', academy:'Riverside BJJ', notes, createdAt:i + 1, sample:true }));
}
function removeSample(){
  const n = db.sessions.filter(s => s.sample).length;
  db.belts = (db.belts||[]).filter(x => !x.sample);
  db.weights = (db.weights||[]).filter(x => !x.sample);
  db.sessions = db.sessions.filter(s => !s.sample);
  if (db.archive?.striking) db.archive.striking = db.archive.striking.filter(s => !s?.sample);
  db.nutrition = { entries: db.nutrition.entries.filter(e => !e.sample), foods: db.nutrition.foods.filter(f => !f.sample), water:(db.nutrition.water||[]).filter(x => !x.sample) };
  const sids = new Set(db.supps.items.filter(i => i.sample).map(i => i.id));
  db.supps = { items: db.supps.items.filter(i => !i.sample), log: db.supps.log.filter(l => !l.sample && !sids.has(l.itemId)) };
  if (db.profile.sampleProfile) db.profile = { ...defaultProfile(), unit:db.profile.unit };
  syncProfileRank();
  save(); toast(`Removed ${n} sample sessions`); route();
}

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
  const tab = { '':'home', history:'history', belts:'history', session:'history', log:'log', edit:'history', stats:($('.tabbar a[data-tab="food"]')?.dataset.mode === 'stats' ? 'food' : 'home'), settings:'settings', food:'food', supps:'food' }[a||''] || 'home';
  document.querySelectorAll('.tabbar a').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  if (a !== 'log' && a !== 'edit') form = (a === 'session' ? null : form && !form.id ? form : null);
  switch (a || '') {
    case 'history': viewHistory(); break;
    case 'belts': viewBelts(); break;
    case 'session': viewSession(b); break;
    case 'log': viewForm(null); break;
    case 'edit': viewForm(b); break;
    case 'stats': viewStats(); break;
    case 'food': viewFood(b); break;
    case 'supps': viewSupps(b); break;
    case 'settings': viewSettings(); break;
    default: viewHome();
  }
  window.scrollTo(0, 0);
  if (a === 'settings' && b === 'goals') { const g = $('#targetsCard'); if (g) g.scrollIntoView({ block:'start' }); }
}
window.DM_TEST = { diffYMD, fmtSpan, beltGroups };
window.addEventListener('hashchange', route);
// Bottom nav: always closes whatever is open (sheet or form) and goes to that screen.
document.querySelector('.tabbar').addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href'), same = (location.hash || '#/') === href;
  if (same) { if (!$('#sheet').hidden) closeSheet(); else if (!onForm()) route(); window.scrollTo(0, 0); return; }
  guardLeave(() => { if (!$('#sheet').hidden) closeSheet(); go(href); });
});
window.addEventListener('storage', e => { if (e.key === STORE_KEY) { db = load(); route(); } });
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e)));
}
})();
