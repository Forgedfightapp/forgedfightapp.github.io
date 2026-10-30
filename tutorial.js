/* Forged first-visit tutorials: a short coach-mark tour the first time each page opens. */
(function(){
const KEY = 'forged.tut.seen';
const T = {
  home:{ title:'Home', steps:[
    ['.tabbar a[data-tab="log"]', 'Log a workout', 'Tap + any time to log a session. It takes a few taps.'],
    ['#todayCard', 'Today\'s session', 'Your workout for today, built from your assessment. Pick Quick or Full, then tap Start session.'],
    ['#weekCard', 'This week', 'Your week at a glance.'],
    ['.tabbar', 'Get around', () => document.querySelector('.tabbar a[data-tab="friends"]:not([hidden])') ? 'Use the bar at the bottom to move between Home, History, Friends, Build and Profile.' : 'Use the bar at the bottom to move between Home, History, Food and Profile.'] ] },
  log:{ title:'Log session', steps:[
    ['#view .field', 'What did you do?', 'Pick the type of training, then set time and how hard it was.'],
    ['#detailsSec', 'Details', 'Add rounds, techniques and notes if you want. All optional.'],
    ['#view .actions', 'Save', 'Tap Save. It shows up in History and counts toward your challenges.'] ] },
  history:{ title:'History', steps:[
    ['#q', 'Search', 'Find any past workout by type, technique or note.'],
    ['#list', 'Your workouts', 'Tap one to see details, edit it or log it again.'] ] },
  build:{ title:'Build a workout', steps:[
    ['#buildCard, #view .card', 'Generate', 'Pick full, upper or lower body and Quick or Full. Swap anything that hurts or needs gear you don\'t have.'],
    ['#weekPlan', 'Your week', 'Lift days fit around your mat days, with easy legs the day before you roll.'] ] },
  stats:{ title:'Stats', steps:[
    ['#view .card', 'Your numbers', 'See time on the mat, training load and your strength PRs.'] ] },
  challenges:{ title:'Challenges', steps:[
    ['#view .card', 'Weekly challenges', 'Quick daily, weekly and monthly challenges.'],
    ['#logRepsTop', 'Reps', 'Log push-ups, pull-ups and more toward rep challenges.'],
    ['#friendsTop, #friendCard', 'Friends', 'Add friends and challenge them head to head.'] ] },
  friends:{ title:'Friends', steps:[
    ['#friendsIntro, #goSignin, #youCard', 'Sign in', 'Sign in with your email to use Friends. Everything else works without an account.'],
    ['#inviteCard, #shareInvite', 'Invite', 'Share your invite link or code so friends can add you.'],
    ['#shareMedia', 'Share a clip', 'Film a roll or snap a photo and share it with friends. Gone after 30 days.'],
    ['#boardCard', 'Leaderboard', 'See how you stack up this week. Friends never see your notes or weight.'] ] },
  belts:{ title:'Belt tracker', steps:[
    ['#artSwitch, #view .seg', 'Your art', 'Switch between martial arts if you train more than one.'],
    ['#timeline, #view > .btn.primary', 'Your journey', 'Log belts and stripes with dates. We show time at each rank.'],
    ['#addArt', 'Add an art', 'Track a new martial art here.'] ] },
  benchmarks:{ title:'Strength', steps:[
    ['#view .card', 'Benchmarks', 'Log tests like your best lift. Set goals and watch your progress.'] ] },
  settings:{ title:'Profile', steps:[
    ['#beltsProfile .card, #injuryCard', 'Belt & injuries', 'Your belt rank and any injuries live here.'],
    ['#assessCard', 'Training profile', 'Redo your assessment any time your schedule, gear or injuries change.'],
    ['#tutReplay', 'Need a refresher?', 'Tap Replay tutorials to see these tips again.'] ] }
};
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) { return {}; } };
const mark = k => { const s = seen(); s[k] = 1; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e) {} };
// automated browsers (the existing test suites) don't get surprise overlays unless they opt in
const enabled = () => { try { return !navigator.webdriver || localStorage.getItem('forged.tut.force') === '1'; } catch(e) { return true; } };
const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const find = sel => { for (const s of sel.split(',')) { const el = document.querySelector(s.trim()); if (vis(el)) return el; } return null; };
let open = null, timer = null;
function close(done){ if (!open) return; const { root, key, onKey } = open; root.remove(); document.removeEventListener('keydown', onKey); document.body.classList.remove('tut-on'); if (done) mark(key); open = null; }
function show(key, force){
  const t = T[key]; if (!t || open) return false;
  const steps = t.steps.filter(([sel]) => find(sel)); if (!steps.length) steps.push([null, t.title, t.steps[0][2]]);
  const root = document.createElement('div'); root.className = 'tut'; root.id = 'tut'; root.dataset.page = key;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', `${t.title} tutorial`);
  root.innerHTML = '<div class="tut-hole"></div><div class="tut-card"><div class="tut-n"></div><h3></h3><p></p><div class="tut-btns"><button type="button" class="btn" id="tutSkip">Skip</button><button type="button" class="btn primary" id="tutNext">Next</button></div></div>';
  document.body.appendChild(root); document.body.classList.add('tut-on');
  let i = 0;
  const hole = root.querySelector('.tut-hole'), card = root.querySelector('.tut-card');
  const draw = () => {
    const [sel, h, p] = steps[i], el = sel && find(sel);
    root.querySelector('.tut-n').textContent = `${t.title} · ${i + 1} of ${steps.length}`;
    root.querySelector('h3').textContent = h; root.querySelector('p').textContent = typeof p === 'function' ? p() : p;
    const last = i === steps.length - 1; root.querySelector('#tutNext').textContent = last ? 'Done' : 'Next';
    if (el) {
      el.scrollIntoView({ block:'center' });
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(hole.style, { display:'block', left:`${r.left - pad}px`, top:`${r.top - pad}px`, width:`${r.width + pad*2}px`, height:`${Math.min(r.height + pad*2, innerHeight * 0.6)}px` });
      const below = r.top + r.height / 2 < innerHeight / 2;
      card.style.top = below ? `${Math.min(r.bottom + 16, innerHeight - 220)}px` : ''; card.style.bottom = below ? '' : `${Math.max(innerHeight - r.top + 16, 16)}px`;
      if (!below && innerHeight - r.top + 16 > innerHeight - 220) { card.style.bottom = ''; card.style.top = '16px'; }
    } else { hole.style.display = 'none'; card.style.top = '35%'; card.style.bottom = ''; }
  };
  root.querySelector('#tutNext').onclick = () => { if (i < steps.length - 1) { i++; draw(); } else close(true); };
  root.querySelector('#tutSkip').onclick = () => close(true);
  const onKey = e => { if (e.key === 'Escape') close(true); };
  document.addEventListener('keydown', onKey);
  open = { root, key, onKey };
  draw(); root.querySelector('#tutNext').focus({ preventScroll:true });
  return true;
}
function check(page){
  clearTimeout(timer); if (open) close(false);
  timer = setTimeout(() => {
    if (!enabled() || document.body.classList.contains('setup-mode')) return;
    const sheet = document.getElementById('sheet'); if (sheet && !sheet.hidden) return;
    const s = seen(); let k = page === '' ? 'home' : page === 'edit' ? 'log' : page;
    if (k === 'home' && s.home && !s.weight && find('#weightCard')) k = 'weight';
    if (T[k] && !s[k]) show(k);
  }, 450);
}
window.FORGED_TUT = { check, show, close:() => close(false), reset(){ try { localStorage.removeItem(KEY); } catch(e) {} }, seen, pages:Object.keys(T), T };
})();
