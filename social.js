/* Forged 3.4.0 cloud layer: optional account, friends, head-to-head challenges, leaderboards (Supabase).
   Network only, no UI (the screens live in app.js). supabase-js is vendored and loaded on demand, so nothing
   is downloaded unless Friends is switched on and used. Tests replace window.supabase with an in-memory mock.
   Only summaries ever leave the phone: name, initial/colour, rank, level, XP, belt, and per-day counts. */
(function(){
  'use strict';
  const C = () => window.FORGED_CONFIG || {};
  let client = null, loading = null, user = null;
  const listeners = [];
  const toUser = s => s && s.user ? { id:s.user.id, email:s.user.email || '' } : null;
  const setUser = (u, ev) => {
    const changed = (u && u.id) !== (user && user.id); user = u;
    if (changed) listeners.forEach(f => { try { f(user, ev); } catch(e) { console.warn(e); } });
  };
  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to fetch ' + src));
      document.head.appendChild(s);
    });
  }
  function sb(){
    if (client) return Promise.resolve(client);
    if (!loading) loading = (async () => {
      if (!window.supabase || !window.supabase.createClient) await loadScript(C().supabaseJs);
      const c = window.supabase.createClient(C().supabaseUrl, C().supabaseKey, {
        auth:{ flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'forged.auth' }
      });
      c.auth.onAuthStateChange((ev, session) => setUser(toUser(session), ev));
      const { data } = await c.auth.getSession();
      client = c; setUser(toUser(data && data.session), 'INITIAL_SESSION');
      return c;
    })().catch(e => { loading = null; throw friendly(e); });
    return loading;
  }
  // Turn library / network / Postgres errors into one short sentence for a toast.
  function friendly(e){
    if (e && e.friendly) return e;
    const m = String((e && (e.message || e.error_description || e.msg)) || e || '');
    let out;
    if ((typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|networkerror|load failed|network request failed|offline/i.test(m))
      out = Object.assign(new Error("You're offline. Try again when you're connected."), { offline:true });
    else if (/jwt|not signed in|session/i.test(m) && !/code/i.test(m)) out = Object.assign(new Error('Please sign in again.'), { auth:true });
    else if (/token has expired or is invalid|otp/i.test(m)) out = new Error('That code is wrong or expired. Request a new one.');
    else out = new Error(m.replace(/^(error|postgrest error)[:\s]*/i, '').slice(0, 160) || 'Something went wrong. Try again.');
    out.friendly = true; return out;
  }
  async function rpc(name, args){
    if (navigator.onLine === false) throw friendly('offline');
    const c = await sb();
    const { data, error } = await c.rpc(name, args || {});
    if (error) throw friendly(error);
    return data;
  }
  const first = r => Array.isArray(r) ? r[0] || null : r || null;

  window.ForgedCloud = {
    get user(){ return user; },
    get loaded(){ return !!client; },
    onAuth(f){ listeners.push(f); },
    hasStoredSession(){ try { return !!localStorage.getItem('forged.auth'); } catch(e) { return false; } },
    init(){ return sb().then(() => user); },
    friendly,
    // --- auth: email one-time code / magic link (Sign in with Apple hook for the App Store build) ---
    async sendCode(email){
      const c = await sb();
      const { error } = await c.auth.signInWithOtp({ email, options:{ emailRedirectTo:C().redirectTo, shouldCreateUser:true } });
      if (error) throw friendly(error);
    },
    async verifyCode(email, token){
      const c = await sb();
      const { data, error } = await c.auth.verifyOtp({ email, token, type:'email' });
      if (error) throw friendly(error);
      setUser(toUser(data && data.session) || (data && data.user ? { id:data.user.id, email:data.user.email } : null), 'SIGNED_IN');
      return user;
    },
    async signInWithApple(){   // hook: enable FORGED_CONFIG.apple + the Apple provider in Supabase
      const c = await sb();
      const { error } = await c.auth.signInWithOAuth({ provider:'apple', options:{ redirectTo:C().redirectTo } });
      if (error) throw friendly(error);
    },
    async signOut(){
      try { const c = await sb(); await c.auth.signOut({ scope:'local' }); } catch(e) { /* offline: drop the local session anyway */ }
      try { localStorage.removeItem('forged.auth'); } catch(e) {}
      setUser(null, 'SIGNED_OUT');
    },
    async deleteAccount(){ await rpc('delete_account'); await this.signOut(); },
    // --- profile, friends, invites ---
    saveProfile(p){ return rpc('upsert_profile', { p_display_name:p.name, p_avatar_color:p.color, p_rank_idx:p.rank, p_level:p.level, p_xp:p.xp, p_belt:p.belt }); },
    myInvite(){ return rpc('create_invite'); },
    invitePreview(code){ return rpc('get_invite', { p_code:code }).then(first); },
    acceptInvite(code){ return rpc('accept_invite', { p_code:code }).then(first); },
    removeFriend(id){ return rpc('remove_friend', { p_friend:id }); },
    async leaderboard(){
      if (navigator.onLine === false) throw friendly('offline');
      const c = await sb();
      const { data, error } = await c.from('friends_leaderboard').select('*').order('place', { ascending:true });
      if (error) throw friendly(error);
      return data || [];
    },
    // --- challenges ---
    challenges(){ return rpc('my_challenges').then(r => r || []); },
    board(id){ return rpc('get_challenge_board', { p_challenge:id }).then(r => r || []); },
    createChallenge(o){ return rpc('create_challenge', { p_kind:o.kind, p_metric:o.metric, p_starts_on:o.start, p_ends_on:o.end, p_friends:o.friends, p_title:o.title || '' }); },
    respond(id, accept){ return rpc('respond_challenge', { p_challenge:id, p_accept:!!accept }); },
    leave(id){ return rpc('leave_challenge', { p_challenge:id }); },
    // --- progress (per-day totals; the server validates the same rules as the app) ---
    submit(entries){ return rpc('submit_progress', { p_entries:entries }); }
  };
})();
