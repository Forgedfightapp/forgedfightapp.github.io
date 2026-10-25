/* In-memory stand-in for supabase-js, injected with page.addInitScript() before the app loads (no network).
   It mirrors the server rules in supabase/migrations/001_social.sql (RLS visibility, invite flow, friends-only
   challenges, 7-day backdate limit, per-metric maxima, 30 XP/day and <= 10 XP per session).
   State lives in localStorage['mock.sb'] so it survives reloads. Test handle: window.__mockSb. */
(() => {
  const K = 'mock.sb', ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const MAX = { sessions:4, pushups:3000, mat_minutes:480, daily_done:3, xp:30 };
  const METRICS = ['sessions','pushups','mat_minutes','daily_streak','xp'];
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const today = () => iso(new Date());
  const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
  const blank = () => ({ users:{}, profiles:{}, invites:{}, friends:[], challenges:{}, parts:[], progress:{}, session:null, otp:{}, n:0, media:[], objects:{} });
  let S; try { S = JSON.parse(localStorage.getItem(K)) || blank(); } catch(e) { S = blank(); }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch(e) {} };
  const listeners = [];
  const M = window.__mockSb = {
    get state(){ return S; }, offline:false, calls:[], lastOtp:null,
    reset(){ S = blank(); save(); },
    addUser(o){ const id = o.id || ('u-' + (++S.n)); S.users[id] = { id, email:o.email || id + '@test' };
      S.profiles[id] = { id, display_name:o.name || 'Friend', avatar_initial:(o.name || 'F')[0].toUpperCase(), avatar_color:o.color || 'sky', rank_idx:o.rank || 0, level:o.level || 1, xp:o.xp || 0, belt:o.belt || '' };
      if (o.username) S.profiles[id].username = o.username; if (o.allowTags === false) S.profiles[id].allow_tags = false;
      if (o.invite) S.invites[o.invite] = { code:o.invite, inviter_id:id, uses:0, max_uses:25, expires:Date.now() + 30 * 864e5 }; save(); return id; },
    befriend(a, b){ if (!isFriend(a, b)) S.friends.push([a, b], [b, a]); save(); },
    progress(uid, metric, day, value){ S.progress[`${uid}|${metric}|${day}`] = value; save(); },
    challengeFrom(uid, metric, friendIds, days = 7){ const id = 'c' + (++S.n); S.challenges[id] = { id, kind:friendIds.length > 1 ? 'group' : 'h2h', metric, title:'', starts_on:today(), ends_on:addD(today(), days - 1), created_by:uid };
      S.parts.push({ c:id, u:uid, status:'joined' }, ...friendIds.map(f => ({ c:id, u:f, status:'invited' }))); save(); return id; },
    me(){ return S.session && S.session.user.id; },
    mediaOff:false,   // true = migration 004 not run yet
    postAs(uid, kind, caption, ageDays = 0){ const id = 'm' + (++S.n), path = `${uid}/${id}.${kind === 'photo' ? 'jpg' : 'mp4'}`; S.objects[path] = { size:1000, type:kind === 'photo' ? 'image/jpeg' : 'video/mp4' };
      S.media.push({ id, owner:uid, kind, path, caption:caption || '', created_at:new Date(Date.now() - ageDays * 864e5).toISOString() }); save(); return id; }
  };
  const isFriend = (a, b) => S.friends.some(([x, y]) => x === a && y === b);
  const uid = () => S.session && S.session.user.id;
  const err = message => ({ data:null, error:{ message } });
  const netDown = () => M.offline || navigator.onLine === false;
  const notify = (ev) => listeners.forEach(f => { try { f(ev, S.session); } catch(e) {} });
  const prof = id => S.profiles[id];
  const ensure = id => { if (!S.profiles[id]) S.profiles[id] = { id, display_name:'Fighter', avatar_initial:'F', avatar_color:'flame', rank_idx:0, level:1, xp:0, belt:'' }; };
  const active = (c, u) => S.parts.find(p => p.c === c && p.u === u && (p.status === 'invited' || p.status === 'joined'));
  const PIX = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#2a2a2e"/><circle cx="400" cy="300" r="120" fill="#F2711C"/></svg>');
  const canSee = path => { const o = path.split('/')[0]; return o === uid() || isFriend(uid(), o); };
  const mediaRow = m => { const p = prof(m.owner) || {}; return { ...m, tags:(m.tags || []).map(t => (prof(t) || {}).username).filter(Boolean), display_name:p.display_name || 'Fighter', avatar_initial:p.avatar_initial || 'F', avatar_color:p.avatar_color || 'flame', is_me:m.owner === uid() }; };
  const RPC = {
    list_media(a){ if (M.mediaOff) return err('Could not find the function public.list_media'); const cut = Date.now() - 30 * 864e5;
      return { data:S.media.filter(m => canSee(m.path) && Date.parse(m.created_at) > cut).sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, a.p_limit || 30).map(mediaRow), error:null }; },
    my_expired_media(){ const cut = Date.now() - 30 * 864e5; return { data:S.media.filter(m => m.owner === uid() && Date.parse(m.created_at) <= cut).map(m => ({ id:m.id, path:m.path })), error:null }; },
    upsert_profile(a){ const u = uid(); let nm = String(a.p_display_name || '').replace(/[\u0000-\u001f<>]/g, '').trim(); if (!nm) nm = 'Fighter';
      if (nm.length > 30) return err('Name is too long (max 30)'); if (!(a.p_rank_idx >= 0 && a.p_rank_idx <= 7)) return err('Invalid rank');
      if (!(a.p_level >= 1 && a.p_level <= 200)) return err('Invalid level'); if (!(a.p_xp >= 0 && a.p_xp <= 5e6)) return err('Invalid XP');
      S.profiles[u] = { id:u, display_name:nm, avatar_initial:nm[0].toUpperCase(), avatar_color:a.p_avatar_color || 'flame', rank_idx:a.p_rank_idx, level:a.p_level, xp:a.p_xp, belt:a.p_belt || '' };
      return { data:S.profiles[u], error:null }; },
    my_username(){ const p = S.profiles[uid()]; return { data:p ? p.username || null : null, error:null }; },
    username_available(a){ const n = String(a.p_username || '').toLowerCase(), U = window.ForgedUsername; if (U && !U.check(n).ok) return { data:false, error:null };
      return { data:!Object.values(S.profiles).some(p => p.username && p.username.toLowerCase() === n && p.id !== uid()), error:null }; },
    claim_username(a){ const u = uid(); ensure(u); const n = String(a.p_username || '').replace(/^@/, '').trim(), c = window.ForgedUsername.check(n); if (!c.ok) return err(c.msg);
      if (Object.values(S.profiles).some(p => p.username && p.username.toLowerCase() === n.toLowerCase() && p.id !== u)) return err('That username is taken');
      S.profiles[u].username = n; return { data:n, error:null }; },
    find_username(a){ const n = String(a.p_username || '').replace(/^@/, '').toLowerCase(), p = Object.values(S.profiles).find(p => p.username && p.username.toLowerCase() === n);
      return { data:p ? [{ username:p.username, display_name:p.display_name, avatar_initial:p.avatar_initial, avatar_color:p.avatar_color, belt:p.belt || '' }] : [], error:null }; },
    taggable_friends(){ const u = uid(); return { data:Object.values(S.profiles).filter(p => p.id !== u && p.username && p.allow_tags !== false && isFriend(u, p.id)).map(p => ({ username:p.username, display_name:p.display_name, avatar_initial:p.avatar_initial, avatar_color:p.avatar_color })), error:null }; },
    tag_media(a){ const u = uid(), post = S.media.find(x => x.id === a.p_post && x.owner === u); if (!post) return err('Post not found');
      for (const n of a.p_usernames || []) { const p = Object.values(S.profiles).find(p => p.username && p.username.toLowerCase() === String(n).toLowerCase());
        if (!p || !isFriend(u, p.id)) return err(`@${n} isn't your friend`); if (p.allow_tags === false) return err(`@${n} has tags turned off`); post.tags = [...new Set([...(post.tags || []), p.id])]; } save(); return { data:null, error:null }; },
    set_allow_tags(a){ const u = uid(); ensure(u); S.profiles[u].allow_tags = !!a.p_allow; if (!a.p_allow) S.media.forEach(x => { if (x.tags) x.tags = x.tags.filter(t => t !== u); }); save(); return { data:null, error:null }; },
    add_friend_by_username(a){ const u = uid(); ensure(u); const n = String(a.p_username || '').replace(/^@/, '').toLowerCase(), p = Object.values(S.profiles).find(p => p.username && p.username.toLowerCase() === n);
      if (!p) return err('No one has that username'); if (p.id === u) return err('That is your own username'); const was = isFriend(u, p.id); if (!was) S.friends.push([u, p.id], [p.id, u]);
      return { data:[{ friend_id:p.id, display_name:p.display_name, avatar_initial:p.avatar_initial, avatar_color:p.avatar_color, rank_idx:p.rank_idx, already:was }], error:null }; },
    create_invite(){ const u = uid(); ensure(u); const ex = Object.values(S.invites).find(i => i.inviter_id === u && i.uses < i.max_uses && i.expires > Date.now() + 3 * 864e5);
      if (ex) return { data:ex.code, error:null };
      let c = ''; for (let i = 0; i < 8; i++) c += ALPHA[Math.floor(Math.random() * 32)];
      S.invites[c] = { code:c, inviter_id:u, uses:0, max_uses:25, expires:Date.now() + 30 * 864e5 }; return { data:c, error:null }; },
    get_invite(a){ const i = S.invites[String(a.p_code || '').trim().toUpperCase()]; if (!i) return { data:[], error:null };
      const p = prof(i.inviter_id); return { data:[{ display_name:p.display_name, avatar_initial:p.avatar_initial, avatar_color:p.avatar_color, rank_idx:p.rank_idx, valid:i.expires > Date.now() && i.uses < i.max_uses }], error:null }; },
    accept_invite(a){ const u = uid(); ensure(u); const i = S.invites[String(a.p_code || '').trim().toUpperCase()];
      if (!i) return err('Invite code not found'); if (i.inviter_id === u) return err('That is your own invite code');
      const was = isFriend(u, i.inviter_id);
      if (!was) { if (i.expires <= Date.now() || i.uses >= i.max_uses) return err('This invite has expired'); S.friends.push([u, i.inviter_id], [i.inviter_id, u]); i.uses++; }
      const p = prof(i.inviter_id); return { data:[{ friend_id:p.id, display_name:p.display_name, avatar_initial:p.avatar_initial, avatar_color:p.avatar_color, rank_idx:p.rank_idx, already:was }], error:null }; },
    remove_friend(a){ const u = uid(); S.friends = S.friends.filter(([x, y]) => !((x === u && y === a.p_friend) || (x === a.p_friend && y === u))); return { data:null, error:null }; },
    create_challenge(a){ const u = uid(), fr = [...new Set((a.p_friends || []).filter(x => x && x !== u))];
      if (!['h2h','group'].includes(a.p_kind)) return err('Invalid challenge type'); if (!METRICS.includes(a.p_metric)) return err('Invalid metric');
      const len = (new Date(a.p_ends_on) - new Date(a.p_starts_on)) / 864e5; if (!(len >= 0 && len <= 30)) return err('A challenge lasts 1 to 31 days');
      if (a.p_starts_on < addD(today(), -7) || a.p_starts_on > addD(today(), 14)) return err('Start date must be within the last 7 days or the next 14');
      if ((a.p_kind === 'h2h' && fr.length !== 1) || (a.p_kind === 'group' && (fr.length < 2 || fr.length > 19))) return err('Pick 1 friend for head-to-head, 2 to 19 for a group');
      if (fr.some(f => !isFriend(u, f))) return err('You can only challenge friends');
      const id = 'c' + (++S.n); S.challenges[id] = { id, kind:a.p_kind, metric:a.p_metric, title:a.p_title || '', starts_on:a.p_starts_on, ends_on:a.p_ends_on, created_by:u };
      S.parts.push({ c:id, u, status:'joined' }, ...fr.map(f => ({ c:id, u:f, status:'invited' }))); return { data:id, error:null }; },
    respond_challenge(a){ const p = active(a.p_challenge, uid()); if (!p) return err('Challenge not found'); p.status = a.p_accept ? 'joined' : 'declined'; return { data:null, error:null }; },
    leave_challenge(a){ const p = S.parts.find(x => x.c === a.p_challenge && x.u === uid()); if (!p) return err('Challenge not found'); p.status = 'left'; return { data:null, error:null }; },
    my_challenges(){ const u = uid();
      return { data:S.parts.filter(p => p.u === u && (p.status === 'invited' || p.status === 'joined')).map(p => { const c = S.challenges[p.c];
        return { ...c, my_status:p.status, created_by_name:(prof(c.created_by) || {}).display_name, participants:S.parts.filter(x => x.c === c.id && (x.status === 'invited' || x.status === 'joined')).length }; })
        .sort((a, b) => (b.ends_on >= today()) - (a.ends_on >= today()) || (a.starts_on < b.starts_on ? 1 : -1)), error:null }; },
    get_challenge_board(a){ const u = uid(), c = S.challenges[a.p_challenge]; if (!c || !active(c.id, u)) return err('Challenge not found');
      const src = c.metric === 'daily_streak' ? 'daily_done' : c.metric;
      const rows = S.parts.filter(p => p.c === c.id && (p.status === 'invited' || p.status === 'joined')).map(p => {
        const days = []; for (let d = c.starts_on; d <= c.ends_on; d = addD(d, 1)) days.push(S.progress[`${p.u}|${src}|${d}`] || 0);
        let score = 0; if (c.metric === 'daily_streak') { let run = 0; days.forEach(v => { run = v > 0 ? run + 1 : 0; score = Math.max(score, run); }); } else score = days.reduce((x, y) => x + y, 0);
        const pr = prof(p.u); return { user_id:p.u, display_name:pr.display_name, avatar_initial:pr.avatar_initial, avatar_color:pr.avatar_color, rank_idx:pr.rank_idx, status:p.status, score, is_me:p.u === u }; });
      rows.sort((x, y) => y.score - x.score || x.display_name.localeCompare(y.display_name)); rows.forEach(r => r.place = 1 + rows.filter(o => o.score > r.score).length);
      return { data:rows, error:null }; },
    submit_progress(a){ const u = uid(), e = a.p_entries; if (!Array.isArray(e)) return err('Expected an array'); if (e.length > 64) return err('Too many entries (max 64)');
      ensure(u); let ok = 0; const bad = [];
      [...e].sort((x, y) => (y.metric === 'sessions') - (x.metric === 'sessions')).forEach(x => {
        const r = reason => bad.push({ metric:x.metric, day:x.day, reason });
        if (!(x.metric in MAX)) return r('metric'); if (!/^\d{4}-\d\d-\d\d$/.test(x.day || '') || x.day > addD(today(), 1)) return r('date');
        if (x.day < addD(today(), -7)) return r('too_old');
        if (!Number.isInteger(x.value) || x.value < 0 || x.value > MAX[x.metric]) return r('value');
        if (x.metric === 'xp' && x.value > 10 * (S.progress[`${u}|sessions|${x.day}`] || 0)) return r('value');
        S.progress[`${u}|${x.metric}|${x.day}`] = x.value; ok++; });
      M.calls.push({ fn:'submit_progress', entries:e }); return { data:{ accepted:ok, rejected:bad }, error:null }; },
    delete_account(){ const u = uid(); delete S.users[u]; delete S.profiles[u]; S.friends = S.friends.filter(([x, y]) => x !== u && y !== u);
      S.parts = S.parts.filter(p => p.u !== u); Object.keys(S.progress).forEach(k => { if (k.startsWith(u + '|')) delete S.progress[k]; });
      Object.keys(S.invites).forEach(k => { if (S.invites[k].inviter_id === u) delete S.invites[k]; }); return { data:null, error:null }; }
  };
  function leaderboard(){
    const u = uid(), ws = weekStart(), ids = [u, ...S.friends.filter(([x]) => x === u).map(([, y]) => y)];
    const sum = (id, m) => Object.entries(S.progress).filter(([k]) => { const [a, b, d] = k.split('|'); return a === id && b === m && d >= ws && d < addD(ws, 7); }).reduce((x, [, v]) => x + v, 0);
    const rows = ids.filter(id => prof(id)).map(id => ({ user_id:id, ...prof(id), week_sessions:sum(id, 'sessions'), week_xp:sum(id, 'xp'), week_pushups:sum(id, 'pushups'), week_mat_minutes:sum(id, 'mat_minutes'), is_me:id === u }));
    rows.forEach(r => r.place = 1 + rows.filter(o => o.week_xp > r.week_xp || (o.week_xp === r.week_xp && o.week_sessions > r.week_sessions)).length);
    return rows.sort((a, b) => a.place - b.place);
  }
  const async = v => new Promise(r => setTimeout(() => r(v), 15));
  const client = {
    auth:{
      async getSession(){ return { data:{ session:S.session }, error:null }; },
      onAuthStateChange(cb){ listeners.push(cb); return { data:{ subscription:{ unsubscribe(){} } } }; },
      async signInWithOtp({ email, options }){ M.calls.push({ fn:'signInWithOtp', email, options }); if (netDown()) return err('TypeError: Failed to fetch');
        S.otp[email] = '123456'; M.lastOtp = { email, options }; save(); return async({ data:{}, error:null }); },
      async verifyOtp({ email, token, type }){ M.calls.push({ fn:'verifyOtp', email, type }); if (netDown()) return err('TypeError: Failed to fetch');
        if (S.otp[email] !== token) return async(err('Token has expired or is invalid'));
        let user = Object.values(S.users).find(x => x.email === email); if (!user) { const id = 'u-' + (++S.n); user = S.users[id] = { id, email }; }
        S.session = { access_token:'mock', user }; localStorage.setItem('forged.auth', '{"mock":true}'); save(); setTimeout(() => notify('SIGNED_IN'), 0);
        return async({ data:{ session:S.session, user }, error:null }); },
      async signInWithOAuth(o){ M.calls.push({ fn:'signInWithOAuth', o }); return { data:{}, error:null }; },
      async signOut(){ S.session = null; localStorage.removeItem('forged.auth'); save(); notify('SIGNED_OUT'); return { error:null }; }
    },
    async rpc(name, args){
      M.calls.push({ fn:name, args });
      if (netDown()) return async(err('TypeError: Failed to fetch'));
      if (!RPC[name]) return err(`Could not find the function public.${name}`);
      if (name !== 'get_invite' && !uid()) return err('Not signed in');
      const r = RPC[name](args || {}); save(); return async(r);
    },
    storage:{ from(bucket){ return {
      async upload(path, blob, o){ M.calls.push({ fn:'upload', bucket, path, size:blob.size, type:o && o.contentType }); if (netDown()) return err('Failed to fetch'); if (M.mediaOff) return err('Bucket not found');
        if (!uid() || path.split('/')[0] !== uid()) return err('new row violates row-level security policy'); if (blob.size > 25 * 1048576) return err('The object exceeded the maximum allowed size');
        S.objects[path] = { size:blob.size, type:o && o.contentType }; save(); return { data:{ path }, error:null }; },
      async createSignedUrls(paths){ return { data:paths.filter(p => S.objects[p] && canSee(p)).map(p => ({ path:p, signedUrl:PIX + '#' + p })), error:null }; },
      async remove(paths){ M.calls.push({ fn:'remove', paths }); paths.forEach(p => { if (p.split('/')[0] === uid()) delete S.objects[p]; }); save(); return { data:[], error:null }; } }; } },
    from(table){
      if (table === 'media_posts') { let op = null, row = null, eqId = null;
        const q = { insert(r){ op = 'insert'; row = r; return q; }, delete(){ op = 'delete'; return q; }, eq(k, v){ eqId = v; return q; }, select(){ return q; }, single(){ return q; },
          then(res, rej){ M.calls.push({ fn:'media_posts.' + op, row, eqId }); let out;
            if (M.mediaOff) out = err('relation "public.media_posts" does not exist'); else if (!uid()) out = err('permission denied');
            else if (op === 'insert') { if (row.path.split('/')[0] !== uid()) out = err('row-level security'); else { const m = { id:'m' + (++S.n), owner:uid(), kind:row.kind, path:row.path, caption:row.caption || '', created_at:new Date().toISOString() }; S.media.push(m); save(); out = { data:m, error:null }; } }
            else { S.media = S.media.filter(m => !(m.id === eqId && m.owner === uid())); save(); out = { data:null, error:null }; }
            return async(out).then(res, rej); } };
        return q; }
      const q = { select(){ return q; }, order(){ return q; },
        then(res, rej){ M.calls.push({ fn:'from', table }); const out = netDown() ? err('TypeError: Failed to fetch') : !uid() ? err('permission denied') : table === 'friends_leaderboard' ? { data:leaderboard(), error:null } : err('not mocked');
          return async(out).then(res, rej); } };
      return q;
    }
  };
  window.supabase = { createClient(url, key, opts){ M.created = { url, key, opts }; return client; } };
})();
