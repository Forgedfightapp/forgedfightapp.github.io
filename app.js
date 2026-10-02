/* Discipline > Motivation — BJJ Training Log
   Vanilla JS, no dependencies. Data lives in localStorage on this device. */
(() => {
'use strict';

const STORE_KEY = 'dm.bjj.v1';
const APP_VERSION = '1.0.0';

const SUBMISSIONS = ['Rear naked choke','Armbar','Triangle','Kimura','Guillotine','Americana','Darce','Anaconda','Arm triangle','Ezekiel','Bow and arrow','Cross collar choke','Loop choke','Baseball bat choke','North-south choke','Omoplata','Straight ankle lock','Heel hook','Kneebar','Toe hold','Calf slicer','Wrist lock','Gogoplata','Paper cutter','Clock choke','Von Flue choke','Banana split','Estima lock'];
const POSITIONS = ['Bottom side control','Bottom mount','Back taken','Turtle','Bottom half guard','Closed guard (bottom)','Stuck in closed guard','Knee on belly','North-south bottom','Can\'t pass half guard','Can\'t pass De La Riva','Can\'t pass butterfly','Leg entanglement','Front headlock','Getting stalled','Guard pulled on me'];
const TECHNIQUES = ['Scissor sweep','Hip bump sweep','Flower sweep','Butterfly sweep','Knee slice pass','Toreando pass','Over-under pass','Stack pass','Leg drag','Elbow-knee escape','Bridge and roll','Back take from turtle','Seatbelt control','Arm drag','Double leg','Single leg','Hip escape (shrimp)','Technical stand-up','Collar drag','De La Riva entry','X-guard sweep','Berimbolo','Mount maintenance','Side control transitions','Guard retention','Kimura trap','Body triangle','Ashi garami entry'];
const SESSION_TYPES = [['class','Class'],['open','Open mat'],['private','Private'],['comp','Competition']];
const BELTS = [['white','White','#f1f1f1'],['blue','Blue','#2563eb'],['purple','Purple','#7c3aed'],['brown','Brown','#7b4a26'],['black','Black','#151515']];
const INTENSITY = ['', 'Light','Easy','Moderate','Hard','All-out'];

/* ---------------- storage ---------------- */
const defaultProfile = () => ({ name:'', belt:'white', stripes:0, promotedOn:'', goalWeight:'', unit:'lb', sampleProfile:false });
function load(){
  try{
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.sessions)) return { sessions:d.sessions, profile:{...defaultProfile(), ...(d.profile||{})} };
  }catch(e){ console.warn('Could not read saved data', e); }
  return { sessions:[], profile:defaultProfile() };
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
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

function h(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/* ---------------- bottom sheet ---------------- */
function openSheet(content, onClose){
  const sheet = $('#sheet');
  sheet.innerHTML = '';
  const panel = h('<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div></div>');
  panel.appendChild(content);
  sheet.appendChild(panel);
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  sheet.onclick = e => { if (e.target === sheet) closeSheet(); };
  sheet._onClose = onClose;
}
function closeSheet(){
  const sheet = $('#sheet');
  sheet.hidden = true; sheet.innerHTML = ''; document.body.style.overflow = '';
  const cb = sheet._onClose; sheet._onClose = null; cb && cb();
}
function confirmSheet(title, body, okLabel='Delete', danger=true){
  return new Promise(resolve => {
    let result = false;
    const el = h(`<div><h3>${esc(title)}</h3><p style="color:var(--muted);margin:-6px 0 20px">${esc(body)}</p>
      <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn block ${danger?'danger':'primary'}" data-ok>${esc(okLabel)}</button>
      <button class="btn block ghost" data-cancel>Cancel</button></div></div>`);
    el.querySelector('[data-ok]').onclick = () => { result = true; closeSheet(); };
    el.querySelector('[data-cancel]').onclick = () => closeSheet();
    openSheet(el, () => resolve(result));
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
  input.addEventListener('blur', () => { if (input.value.trim()) add(input.value); });
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
  const weeks = Array.from({length:n}, (_,i) => { const d = addDays(start, -7*(n-1-i)); return { key:iso(d), date:d, min:0 }; });
  const idx = new Map(weeks.map((w,i) => [w.key, i]));
  db.sessions.forEach(s => { const k = iso(weekStart(parse(s.date))); if (idx.has(k)) weeks[idx.get(k)].min += Number(s.duration)||0; });
  return weeks;
}
function weightSeries(){
  return db.sessions.filter(s => s.weight !== '' && s.weight != null && !isNaN(Number(s.weight)))
    .map(s => ({ date:s.date, w:Number(s.weight) })).sort((a,b) => a.date.localeCompare(b.date));
}

/* ---------------- charts (inline SVG) ---------------- */
function barChart(weeks){
  const W = 340, H = 150, pt = 18, pb = 22, pl = 4, pr = 4;
  const max = Math.max(1, ...weeks.map(w => w.min/60));
  const nice = Math.ceil(max);
  const bw = (W - pl - pr) / weeks.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly mat hours, last ${weeks.length} weeks">`;
  for (let g = 0; g <= 2; g++) { const y = pt + (H-pt-pb) * g/2; s += `<line class="grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`; }
  weeks.forEach((w,i) => {
    const v = w.min/60, bh = (H-pt-pb) * v/nice, x = pl + i*bw + bw*0.18, y = H - pb - bh, cur = i === weeks.length-1;
    s += `<rect class="bar ${v===0?'dim':''}" x="${x.toFixed(1)}" y="${(v===0?H-pb-3:y).toFixed(1)}" width="${(bw*0.64).toFixed(1)}" height="${(v===0?3:bh).toFixed(1)}" rx="4" ${cur?'':'opacity=".55"'}/>`;
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
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend"><defs><linearGradient id="wgrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3ee8b5" stop-opacity=".28"/><stop offset="1" stop-color="#3ee8b5" stop-opacity="0"/></linearGradient></defs>`;
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
function beltCard(){
  const p = db.profile, b = BELTS.find(x => x[0]===p.belt) || BELTS[0];
  const stripes = Array.from({length:Number(p.stripes)||0}, () => '<i></i>').join('');
  let since = '';
  if (p.promotedOn) {
    const days = Math.floor((new Date() - parse(p.promotedOn)) / 864e5);
    const n = db.sessions.filter(s => s.date >= p.promotedOn).length;
    since = `<div class="belt-meta"><span>Promoted <b>${fmtShort(p.promotedOn)}</b></span><span><b>${days}</b> days · <b>${n}</b> sessions</span></div>`;
  } else since = `<div class="belt-meta"><span>Set your promotion date in <a href="#/settings" style="color:var(--accent)">Profile</a></span></div>`;
  return `<div class="card"><h2>${esc(b[1])} belt${p.stripes?` · ${p.stripes} stripe${p.stripes>1?'s':''}`:''} ${p.sampleProfile?'<span class="pill sample">Sample</span>':''}</h2>
    <div class="belt"><div class="beltbar ${b[0]}" style="background:${b[2]}"><div class="tip">${stripes}</div></div></div>${since}</div>`;
}

/* ---------------- views ---------------- */
function setHeader(title, action=''){
  const t = $('#title'), tg = $('#tagline');
  if (title) { t.textContent = title; tg.innerHTML = 'Discipline <span style="color:var(--accent)">&gt;</span> Motivation'; }
  else { t.innerHTML = 'Discipline <span class="gt">&gt;</span> Motivation'; tg.textContent = 'BJJ Training Log'; }
  $('#topAction').innerHTML = action;
}

function viewHome(){
  setHeader('');
  const v = $('#view');
  if (!db.sessions.length) {
    v.innerHTML = `<div class="welcome"><img class="logo" src="icons/icon.svg" alt=""><h2>Show up. Log it. Repeat.</h2>
      <p>Track sessions, rolls, submissions and weight. Everything stays on your phone.</p>
      <a class="btn primary" href="#/log">Log your first session</a>
      <button class="btn" id="loadSample">Load sample data (demo)</button></div>${beltCard()}`;
    $('#loadSample').onclick = loadSample;
    return;
  }
  const st = periodStats(), streak = weekStreak(), weeks = weeklyHours(12), ws = weightSeries();
  const landed = countBy(allRolls().flatMap(r => r.subsLanded||[])).slice(0,5);
  const caught = countBy(allRolls().flatMap(r => r.subsTapped||[])).slice(0,5);
  const hasSample = db.sessions.some(s => s.sample);
  const avg = weeks.slice(0,-1).reduce((a,w) => a+w.min, 0) / 60 / Math.max(1, weeks.length-1);
  let weightHtml = `<div class="empty">Add your body weight when you log a session to see the trend.</div>`;
  if (ws.length) {
    const first = ws[0].w, last = ws[ws.length-1].w, diff = Math.round((last-first)*10)/10;
    const goal = Number(db.profile.goalWeight) || null;
    weightHtml = `<div style="display:flex;align-items:baseline;gap:10px;margin:-4px 0 6px"><span style="font-size:30px;font-weight:760;letter-spacing:-.03em">${last}<small style="font-size:15px;color:var(--muted)"> ${unit()}</small></span>
      <span style="font-weight:700;color:${diff<=0?'var(--accent)':'var(--danger)'}">${diff>0?'+':''}${diff} ${unit()}</span><span style="color:var(--dim);font-size:13px">since ${fmtShort(ws[0].date)}</span></div>
      ${ws.length > 1 ? lineChart(ws, goal) : ''}${goal ? `<div class="hint">${Math.max(0, Math.round((last-goal)*10)/10)} ${unit()} to goal</div>` : ''}`;
  }
  const recent = sorted().slice(0,3);
  v.innerHTML = `
    ${hasSample ? `<div class="banner"><span>📋 <b>Sample data</b> is loaded for the demo.</span><button class="btn sm" id="rmSample">Remove</button></div>` : ''}
    <div class="statrow">
      <div class="stat hero"><div class="v">${st.week}</div><div class="l">Sessions this week</div></div>
      <div class="stat"><div class="v">${streak}<small>wk</small></div><div class="l">Training streak 🔥</div></div>
      <div class="stat"><div class="v">${st.month}</div><div class="l">Sessions in ${MONTHS[new Date().getMonth()]}</div></div>
      <div class="stat"><div class="v">${hrs(st.monthMin)}<small>h</small></div><div class="l">Mat hours this month</div></div>
    </div>
    <div class="card"><h2>Weekly mat hours <small>avg ${Math.round(avg*10)/10} h/wk</small></h2>${barChart(weeks)}</div>
    ${beltCard()}
    <div class="card"><h2>Submissions <a href="#/stats" style="color:var(--accent);text-decoration:none;text-transform:none;letter-spacing:0;font-size:13px">See all ›</a></h2>
      <div class="subcols"><div><h3 class="win">Landed</h3>${hbars(landed,'win')}</div><div><h3 class="loss">Caught by</h3>${hbars(caught,'loss')}</div></div></div>
    <div class="card"><h2>Weight trend</h2>${weightHtml}</div>
    <div class="card"><h2>Recent <a href="#/history" style="color:var(--accent);text-decoration:none;text-transform:none;letter-spacing:0;font-size:13px">History ›</a></h2>
      ${recent.map(sessRow).join('')}</div>
    <div class="foot">${st.total} sessions · ${hrs(st.totalMin)} total mat hours</div>`;
  const rm = $('#rmSample'); if (rm) rm.onclick = removeSample;
}

function sessRow(s){
  const d = parse(s.date), rolls = s.rolls||[];
  const w = rolls.filter(r => r.result==='win').length, l = rolls.filter(r => r.result==='loss').length;
  const dots = [1,2,3,4,5].map(i => `<i class="${i<=s.intensity?'on':''}"></i>`).join('');
  return `<a class="sess" href="#/session/${esc(s.id)}">
    <div class="d"><b>${d.getDate()}</b><span>${DOW[d.getDay()]}</span></div>
    <div class="m"><div class="t">${esc(typeLabel(s.type))} <span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>${s.sample?'<span class="pill sample">Sample</span>':''}</div>
      <div class="s">${s.duration} min · ${s.rounds||0} rounds${rolls.length?` · ${w}W ${l}L`:''} · <span class="dots" aria-label="Intensity ${s.intensity}">${dots}</span></div>
      ${(s.techniques||[]).length ? `<div class="tg">${esc(s.techniques.join(' · '))}</div>` : ''}</div></a>`;
}

let histFilter = 'all', histQuery = '';
function viewHistory(){
  setHeader('History');
  const v = $('#view');
  if (!db.sessions.length) { v.innerHTML = `<div class="empty" style="padding:60px 10px">No sessions yet.<br><br><a class="btn primary" href="#/log">Log a session</a></div>`; return; }
  v.innerHTML = `<div class="search"><input class="input" type="search" placeholder="Search techniques, partners, notes…" value="${esc(histQuery)}" id="q"></div>
    <div class="filters">${[['all','All'],['gi','Gi'],['nogi','No-Gi'],['comp','Competition'],['open','Open mat']].map(([k,l]) => `<button data-f="${k}" class="${histFilter===k?'on':''}">${l}</button>`).join('')}</div>
    <div id="list"></div>`;
  const draw = () => {
    const q = histQuery.toLowerCase();
    const list = sorted().filter(s => {
      if (histFilter==='gi' && s.gi!=='gi') return false;
      if (histFilter==='nogi' && s.gi!=='nogi') return false;
      if ((histFilter==='comp' || histFilter==='open') && s.type!==histFilter) return false;
      if (!q) return true;
      const hay = [s.notes, typeLabel(s.type), ...(s.techniques||[]), ...(s.rolls||[]).flatMap(r => [r.partner, ...(r.subsLanded||[]), ...(r.subsTapped||[]), ...(r.stuck||[])])].join(' ').toLowerCase();
      return hay.includes(q);
    });
    let html = '', cur = '';
    list.forEach(s => { const d = parse(s.date), m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; if (m !== cur) { cur = m; const n = list.filter(x => x.date.startsWith(s.date.slice(0,7))).length; html += `<div class="month">${m} · ${n}</div>`; } html += sessRow(s); });
    $('#list').innerHTML = html || `<div class="empty">No matching sessions.</div>`;
  };
  $('#q').oninput = e => { histQuery = e.target.value; draw(); };
  v.querySelectorAll('.filters button').forEach(b => b.onclick = () => { histFilter = b.dataset.f; v.querySelectorAll('.filters button').forEach(x => x.classList.toggle('on', x===b)); draw(); });
  draw();
}

function viewSession(id){
  const s = db.sessions.find(x => x.id === id);
  if (!s) { location.hash = '#/history'; return; }
  setHeader(typeLabel(s.type), `<a class="btn sm" href="#/edit/${esc(s.id)}">Edit</a>`);
  const rolls = s.rolls||[];
  $('#view').innerHTML = `
    <div style="color:var(--muted);font-weight:650;margin:0 4px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${fmtDate(s.date)} <span class="pill ${s.gi==='nogi'?'nogi':'gi'}">${s.gi==='nogi'?'No-Gi':'Gi'}</span>${s.sample?'<span class="pill sample">Sample</span>':''}</div>
    <div class="kv"><div><b>${s.duration}<small style="font-size:13px;color:var(--muted)"> min</small></b><span>Duration</span></div><div><b>${s.rounds||0}</b><span>Rounds</span></div><div><b>${s.intensity}/5</b><span>${INTENSITY[s.intensity]||''}</span></div></div>
    ${s.weight ? `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--muted);font-weight:650">Body weight</span><b style="font-size:20px">${esc(s.weight)} ${unit()}</b></div>` : ''}
    <div class="card"><h2>Techniques drilled</h2>${(s.techniques||[]).length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${s.techniques.map(t => `<span class="chip" style="padding:7px 12px">${esc(t)}</span>`).join('')}</div>` : '<div class="empty" style="padding:4px 0">—</div>'}</div>
    <div class="card"><h2>Rolls <small>${rolls.filter(r=>r.result==='win').length}W · ${rolls.filter(r=>r.result==='loss').length}L · ${rolls.filter(r=>r.result==='draw').length}D</small></h2>${rolls.length ? rolls.map((r,i) => rollCard(r,i,false)).join('') : '<div class="empty" style="padding:4px 0">No rolls logged</div>'}</div>
    ${s.notes ? `<div class="card"><h2>Notes</h2><div style="white-space:pre-wrap">${esc(s.notes)}</div></div>` : ''}
    <div style="display:flex;gap:10px;margin-top:6px"><a class="btn primary" style="flex:1" href="#/edit/${esc(s.id)}">Edit session</a><button class="btn danger" id="del">Delete</button></div>`;
  $('#del').onclick = async () => { if (await confirmSheet('Delete this session?', `${fmtDate(s.date)} · ${typeLabel(s.type)}. This can't be undone.`)) { db.sessions = db.sessions.filter(x => x.id !== s.id); save(); toast('Session deleted'); location.hash = '#/history'; } };
}

function rollCard(r, i, editable){
  const res = { win:'Won', loss:'Lost', draw:'Draw' }[r.result] || 'Draw';
  const chips = [...(r.subsLanded||[]).map(x => `<span class="chip">✓ ${esc(x)}</span>`), ...(r.subsTapped||[]).map(x => `<span class="chip loss">✕ ${esc(x)}</span>`), ...(r.stuck||[]).map(x => `<span class="chip neutral">⚠ ${esc(x)}</span>`)].join('');
  return `<div class="roll" data-i="${i}"><div class="roll-h"><span class="n">${i+1}</span><span class="who">${esc(r.partner || 'Partner not set')}</span><span class="res ${r.result||'draw'}">${res}</span>
    ${editable ? `<button type="button" class="iconbtn" data-edit aria-label="Edit roll"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>` : ''}</div>${chips ? `<div class="chips">${chips}</div>` : ''}</div>`;
}

/* ---------------- session form ---------------- */
let form = null;
function blankSession(){
  const last = sorted()[0];
  return { id:null, date:today(), gi:last?.gi || 'gi', type:'class', duration:last?.duration || 60, rounds:5, intensity:3, techniques:[], rolls:[], weight:'', notes:'' };
}
function viewForm(id){
  const editing = !!id;
  if (editing) {
    const s = db.sessions.find(x => x.id === id);
    if (!s) { location.hash = '#/history'; return; }
    if (!form || form.id !== id) form = JSON.parse(JSON.stringify(s));
  } else if (!form || form.id) form = blankSession();
  setHeader(editing ? 'Edit session' : 'Log session');
  const v = $('#view'); v.innerHTML = '';
  const f = form;

  const date = h(`<input class="input" type="date" value="${esc(f.date)}" max="${today()}">`);
  date.onchange = () => { f.date = date.value || today(); };
  v.appendChild(field('Date', date));
  v.appendChild(field('Uniform', seg([['gi','Gi'],['nogi','No-Gi']], f.gi, x => f.gi = x)));
  v.appendChild(field('Session type', seg(SESSION_TYPES, f.type, x => f.type = x, true)));
  const g = h('<div class="grid2"></div>');
  g.appendChild(field('Duration', stepper(f.duration, { step:15, min:0, max:600, unitLabel:'min', onChange:x => f.duration = x })));
  const roundsStep = stepper(f.rounds, { min:0, max:50, unitLabel:'rds', onChange:x => f.rounds = x });
  g.appendChild(field('Rounds', roundsStep));
  v.appendChild(g);

  const intens = h(`<div><div class="intensity">${[1,2,3,4,5].map(i => `<button type="button" data-i="${i}" aria-label="Intensity ${i}">${i}</button>`).join('')}</div><div class="hint" id="intLabel"></div></div>`);
  const syncI = () => { intens.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.i) === f.intensity)); intens.querySelector('#intLabel').textContent = INTENSITY[f.intensity]; };
  intens.querySelectorAll('button').forEach(b => b.onclick = () => { f.intensity = Number(b.dataset.i); syncI(); });
  syncI();
  v.appendChild(field('Intensity', intens));

  v.appendChild(field('Techniques drilled', tagField({ values:f.techniques, suggestions:() => uniqueMerge(usedTechniques(), TECHNIQUES), placeholder:'Add technique…' })));

  const rollsWrap = h(`<div class="field"><div class="label" style="display:flex;justify-content:space-between;align-items:center">Rolls <span style="text-transform:none;letter-spacing:0;color:var(--dim);font-weight:600" id="rollSum"></span></div><div id="rollList"></div><button type="button" class="btn block" id="addRoll"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add roll</button></div>`);
  v.appendChild(rollsWrap);
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
    const partner = h(`<input class="input" type="text" autocapitalize="words" placeholder="Optional" value="${esc(r.partner)}" list="partners"><datalist id="partners">${usedPartners().map(p => `<option value="${esc(p)}">`).join('')}</datalist>`);
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
    openSheet(el);
  };
  rollsWrap.querySelector('#addRoll').onclick = () => editRoll(null);
  drawRolls();

  const wt = h(`<div class="stepper" style="padding-left:14px"><input type="text" inputmode="decimal" placeholder="Optional" value="${esc(f.weight)}" style="text-align:left;font-weight:600"><span class="unit" style="padding-right:16px">${unit()}</span></div>`);
  const wi = wt.querySelector('input');
  wi.oninput = () => { f.weight = wi.value.replace(/[^\d.]/g,''); };
  const lastW = weightSeries().pop();
  v.appendChild(field('Body weight', wt, lastW ? `Last: ${lastW.w} ${unit()} on ${fmtShort(lastW.date)}` : 'Track your weight alongside training'));

  const notes = h(`<textarea class="input" placeholder="What clicked? What to work on next time?">${esc(f.notes)}</textarea>`);
  notes.oninput = () => f.notes = notes.value;
  v.appendChild(field('Notes', notes));

  const actions = h(`<div class="actions">${editing ? '<button type="button" class="btn danger" data-del style="flex:0 0 auto">Delete</button>' : ''}<button type="button" class="btn primary" data-save>${editing ? 'Save changes' : 'Save session'}</button></div>`);
  actions.querySelector('[data-save]').onclick = () => {
    const w = String(f.weight||'').trim();
    if (w && (isNaN(Number(w)) || Number(w) <= 0)) { toast('Weight should be a number'); return; }
    const rec = { ...f, weight: w ? Math.round(Number(w)*10)/10 : '', rounds: Math.max(f.rounds, f.rolls.length), updatedAt: Date.now() };
    if (editing) { const i = db.sessions.findIndex(x => x.id === f.id); rec.sample = false; db.sessions[i] = rec; }
    else { rec.id = uid(); rec.createdAt = Date.now(); db.sessions.push(rec); }
    save(); form = null;
    toast(editing ? 'Session updated' : 'Session saved 🤙');
    location.hash = editing ? `#/session/${rec.id}` : '#/';
  };
  const d = actions.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (await confirmSheet('Delete this session?', "This can't be undone.")) { db.sessions = db.sessions.filter(x => x.id !== f.id); save(); form = null; toast('Session deleted'); location.hash = '#/history'; } };
  v.appendChild(actions);
}

/* ---------------- subs / analysis ---------------- */
function viewStats(){
  setHeader('Submissions');
  const rolls = allRolls(), v = $('#view');
  if (!rolls.length) { v.innerHTML = `<div class="empty" style="padding:60px 10px">Log rolls inside a session to see your submission breakdown.</div>`; return; }
  const w = rolls.filter(r => r.result==='win').length, l = rolls.filter(r => r.result==='loss').length, d = rolls.length - w - l;
  const landed = countBy(rolls.flatMap(r => r.subsLanded||[])), caught = countBy(rolls.flatMap(r => r.subsTapped||[]));
  const stuck = countBy(rolls.flatMap(r => r.stuck||[])), tech = countBy(db.sessions.flatMap(s => s.techniques||[]));
  const split = g => { const rs = rolls.filter(r => r.session.gi===g); return { n:rs.length, w:rs.filter(r=>r.result==='win').length, l:rs.filter(r=>r.result==='loss').length,
    sl:rs.reduce((a,r)=>a+(r.subsLanded||[]).length,0), st:rs.reduce((a,r)=>a+(r.subsTapped||[]).length,0) }; };
  const gi = split('gi'), ng = split('nogi');
  const nl = landed.reduce((a,x)=>a+x[1],0), nc = caught.reduce((a,x)=>a+x[1],0);
  v.innerHTML = `
    <div class="grid3" style="margin-bottom:14px"><div class="stat hero"><div class="v">${w}</div><div class="l">Won</div></div><div class="stat"><div class="v">${d}</div><div class="l">Draw</div></div><div class="stat"><div class="v" style="color:var(--danger)">${l}</div><div class="l">Lost</div></div></div>
    <div class="card"><h2>Sub ratio <small>${nl} landed · ${nc} caught</small></h2>
      <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--surface2)"><i style="width:${nl+nc ? nl/(nl+nc)*100 : 50}%;background:var(--accent)"></i><i style="flex:1;background:var(--danger)"></i></div>
      <div class="hint" style="display:flex;justify-content:space-between"><span>${rolls.length} rolls logged</span><span>${nl+nc ? Math.round(nl/(nl+nc)*100) : 0}% finishes yours</span></div></div>
    <div class="card"><h2>Landed</h2>${hbars(landed.slice(0,10),'win')}</div>
    <div class="card"><h2>Caught by</h2>${hbars(caught.slice(0,10),'loss')}</div>
    <div class="card"><h2>Where I get stuck</h2>${hbars(stuck.slice(0,8),'loss')}</div>
    <div class="card"><h2>Gi vs No-Gi</h2>
      ${[['Gi',gi],['No-Gi',ng]].map(([n,x]) => `<div class="list-row"><div class="grow"><b>${n}</b><small>${x.n} rolls · ${x.w}W ${x.l}L</small></div><span class="chip" style="padding:5px 10px">✓ ${x.sl}</span><span class="chip loss" style="padding:5px 10px">✕ ${x.st}</span></div>`).join('')}</div>
    <div class="card"><h2>Most drilled</h2>${hbars(tech.slice(0,8),'win')}</div>`;
}

/* ---------------- settings ---------------- */
function viewSettings(){
  setHeader('Profile');
  const p = db.profile, v = $('#view'); v.innerHTML = '';
  const card = h('<div class="card"><h2>Rank</h2></div>');
  const belt = h(`<select class="input">${BELTS.map(([k,l]) => `<option value="${k}" ${p.belt===k?'selected':''}>${l} belt</option>`).join('')}</select>`);
  belt.onchange = () => { p.belt = belt.value; p.sampleProfile = false; save(); toast('Belt updated'); };
  card.appendChild(field('Belt', belt));
  card.appendChild(field('Stripes', seg([[0,'0'],[1,'1'],[2,'2'],[3,'3'],[4,'4']], Number(p.stripes)||0, x => { p.stripes = x; p.sampleProfile = false; save(); })));
  const promo = h(`<input class="input" type="date" value="${esc(p.promotedOn)}" max="${today()}">`);
  promo.onchange = () => { p.promotedOn = promo.value; p.sampleProfile = false; save(); toast('Promotion date saved'); };
  card.appendChild(field('Promotion date', promo));
  v.appendChild(card);

  const wcard = h('<div class="card"><h2>Weight</h2></div>');
  wcard.appendChild(field('Units', seg([['lb','lb'],['kg','kg']], unit(), x => { p.unit = x; save(); })));
  const goal = h(`<input class="input" type="text" inputmode="decimal" placeholder="Optional" value="${esc(p.goalWeight)}">`);
  goal.onchange = () => { p.goalWeight = goal.value.replace(/[^\d.]/g,''); save(); toast('Goal saved'); };
  wcard.appendChild(field('Goal weight', goal));
  v.appendChild(wcard);

  const hasSample = db.sessions.some(s => s.sample);
  const data = h(`<div class="card"><h2>Your data</h2>
    <p class="hint" style="margin:-4px 0 14px;font-size:13px">Stored only on this device. Export a backup regularly, especially before clearing Safari data.</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn block" id="exp"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Export backup (JSON)</button>
      <label class="btn block" for="impFile"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>Import backup</label>
      <input type="file" id="impFile" accept="application/json,.json" hidden>
      ${hasSample ? '<button class="btn block" id="rmS">Remove sample data</button>' : '<button class="btn block" id="ldS">Load sample data (demo)</button>'}
      <button class="btn block danger" id="clr">Clear all data</button>
    </div></div>`);
  v.appendChild(data);
  v.appendChild(h(`<div class="card"><h2>Install on iPhone</h2><div style="color:var(--muted);font-size:14px">In Safari, tap <b style="color:var(--text)">Share</b> → <b style="color:var(--text)">Add to Home Screen</b>. It opens full-screen and works offline.</div></div>`));
  v.appendChild(h(`<div class="foot">Discipline &gt; Motivation · v${APP_VERSION} · ${db.sessions.length} sessions stored</div>`));

  $('#exp').onclick = exportData;
  $('#impFile').onchange = e => importData(e.target.files[0]);
  const ld = $('#ldS'); if (ld) ld.onclick = loadSample;
  const rm = $('#rmS'); if (rm) rm.onclick = removeSample;
  $('#clr').onclick = async () => {
    if (await confirmSheet('Clear all data?', `This permanently deletes ${db.sessions.length} sessions and your profile from this device. Export a backup first if you want to keep them.`, 'Clear everything')) {
      db = { sessions:[], profile:defaultProfile() }; save(); form = null; toast('All data cleared'); route();
    }
  };
}

function exportData(){
  const payload = { app:'discipline-motivation-bjj', version:1, exportedAt:new Date().toISOString(), profile:db.profile, sessions:db.sessions };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `dm-bjj-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup exported');
}
async function importData(file){
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || !Array.isArray(d.sessions)) throw new Error('No sessions found');
    const valid = d.sessions.filter(s => s && typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)).map(s => ({
      id:String(s.id||uid()), date:s.date, gi:s.gi==='nogi'?'nogi':'gi', type:SESSION_TYPES.some(t=>t[0]===s.type)?s.type:'class',
      duration:Number(s.duration)||0, rounds:Number(s.rounds)||0, intensity:Math.min(5,Math.max(1,Number(s.intensity)||3)),
      techniques:Array.isArray(s.techniques)?s.techniques.map(String):[], notes:String(s.notes||''), weight:s.weight===''||s.weight==null?'':Number(s.weight)||'',
      rolls:Array.isArray(s.rolls)?s.rolls.map(r => ({ id:String(r.id||uid()), partner:String(r.partner||''), result:['win','loss','draw'].includes(r.result)?r.result:'draw',
        subsLanded:(r.subsLanded||[]).map(String), subsTapped:(r.subsTapped||[]).map(String), stuck:(r.stuck||[]).map(String) })):[],
      sample:!!s.sample, createdAt:s.createdAt||Date.now() }));
    if (await confirmSheet(`Import ${valid.length} sessions?`, `This replaces the ${db.sessions.length} sessions currently on this device.`, 'Replace & import', false)) {
      db = { sessions:valid, profile:{ ...defaultProfile(), ...(d.profile||{}) } }; save(); toast(`Imported ${valid.length} sessions`); route();
    }
  } catch(e) { console.warn(e); toast('That file isn\'t a valid backup'); }
  finally { const f = $('#impFile'); if (f) f.value = ''; }
}

/* ---------------- sample data ---------------- */
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
    sessions.push({ id:uid(), date:iso(d), gi: dow === 3 || (dow === 6 && rnd() < .5) ? 'nogi' : 'gi', type,
      duration: type==='open' ? 90 : type==='private' ? 60 : rnd() < .6 ? 75 : 60,
      rounds: Math.max(rolls.length, nRolls), intensity: Math.min(5, Math.max(1, Math.round(2.6 + rnd()*2.2))),
      techniques: [pick(TECHNIQUES), pick(TECHNIQUES)].filter((x,i,a) => a.indexOf(x)===i).concat(rnd()<.4?[pick(TECHNIQUES)]:[]),
      rolls, weight: rnd() < .7 ? Math.round(w*10)/10 : '', notes: rnd() < .55 ? pick(notes) : '', sample:true, createdAt:d.getTime() });
  }
  db.sessions = db.sessions.filter(s => !s.sample).concat(sessions);
  if (!db.profile.promotedOn) { db.profile = { ...db.profile, belt:'blue', stripes:2, promotedOn:iso(addDays(new Date(), -152)), goalWeight: db.profile.goalWeight || '195', sampleProfile:true }; }
  save(); toast(`Loaded ${sessions.length} sample sessions`); route();
}
function removeSample(){
  const n = db.sessions.filter(s => s.sample).length;
  db.sessions = db.sessions.filter(s => !s.sample);
  if (db.profile.sampleProfile) db.profile = { ...defaultProfile(), unit:db.profile.unit };
  save(); toast(`Removed ${n} sample sessions`); route();
}

/* ---------------- router ---------------- */
function route(){
  if (!$('#sheet').hidden) closeSheet();
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, a, b] = hash.split('/');
  const tab = { '':'home', history:'history', session:'history', log:'log', edit:'history', stats:'stats', settings:'settings' }[a||''] || 'home';
  document.querySelectorAll('.tabbar a').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  if (a !== 'log' && a !== 'edit') form = (a === 'session' ? null : form && !form.id ? form : null);
  switch (a || '') {
    case 'history': viewHistory(); break;
    case 'session': viewSession(b); break;
    case 'log': viewForm(null); break;
    case 'edit': viewForm(b); break;
    case 'stats': viewStats(); break;
    case 'settings': viewSettings(); break;
    default: viewHome();
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('storage', e => { if (e.key === STORE_KEY) { db = load(); route(); } });
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e)));
}
})();
