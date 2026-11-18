/* Forged usernames (3.16.0): X/Instagram-style handles. Mirrored server-side in supabase/migrations/005_username.sql.
   3-20 chars, letters/numbers/_/. only, no spaces, no leading/trailing or double period. Unique case-insensitively
   (stored with the user's casing, compared lowercase). Offensive and reserved handles are refused. */
(function(root){
  const RESERVED = ['admin','administrator','forged','forgedapp','forgedfight','ferro','ferroco','support','matfinder','help','official',
    'staff','moderator','mod','root','system','team','security','owner','api','www','null','undefined','me','you','everyone'];
  // substring matches after normalising (long/unambiguous terms only)
  const BLOCK = ['nigger','nigga','faggot','fagot','retard','tranny','chink','spick','kike','wetback','gook','coon','raghead','beaner',
    'fuck','fuk','shit','cunt','bitch','whore','slut','pussy','dick','cock','penis','vagina','porn','rape','rapist','nazi','hitler','kkk',
    'molest','pedo','incest','anal','cum','jizz','twat','wank','bastard','motherf','asshole','dildo','blowjob','handjob','boob','tits','nude'];
  // whole-handle matches only (too short to match inside other words)
  const EXACT = ['ass','fag','tit','sex','kys','hoe','arse','damn','crap','piss','nig','spic'];
  // terms that would false-positive inside normal words (e.g. "scumbag" vs "cucumber") are allowed through these exceptions
  const ALLOW = ['cucumber','document','circumstance','scunthorpe','dickson','dickens','hancock','peacock','cockpit','analysis','analyst','canal','banal','shitake','shiitake','classic','grappler'];
  const LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '@':'a', '5':'s', '$':'s', '7':'t', '8':'b', '9':'g', '!':'i', '|':'l' };
  function variants(s){
    const base = s.toLowerCase().replace(/[._\-\s]/g, '');
    const a = base.replace(/[01345789@$!|]/g, c => LEET[c]), b = base.replace(/[01345789@$!|]/g, c => c === '1' ? 'l' : LEET[c]);
    const sq = x => x.replace(/(.)\1+/g, '$1');   // fuuuck -> fuck
    return [...new Set([a, b, sq(a), sq(b)])];
  }
  function offensive(name){
    return variants(name).some(v => { if (ALLOW.some(w => v.includes(w))) { v = ALLOW.reduce((x, w) => x.split(w).join(''), v); }
      return EXACT.includes(v) || BLOCK.some(w => v.includes(w)); });
  }
  function reserved(name){ return variants(name).some(v => RESERVED.includes(v)) || RESERVED.includes(name.toLowerCase()); }
  /* returns { ok, code, msg, handle }  codes: empty, space, chars, short, long, period, reserved, offensive */
  function check(raw){
    const s = String(raw == null ? '' : raw).replace(/^@/, '');
    if (!s.trim()) return { ok:false, code:'empty', msg:'Pick a username' };
    if (/\s/.test(s)) return { ok:false, code:'space', msg:'Usernames can\'t have spaces. Try _ or . instead' };
    if (/[^A-Za-z0-9_.]/.test(s)) return { ok:false, code:'chars', msg:'Only letters, numbers, _ and . are allowed' };
    if (s.length < 3) return { ok:false, code:'short', msg:'Too short: use at least 3 characters' };
    if (s.length > 20) return { ok:false, code:'long', msg:'Too long: 20 characters max' };
    if (/^\.|\.$|\.\./.test(s)) return { ok:false, code:'period', msg:'Can\'t start or end with a period, or use two in a row' };
    if (reserved(s)) return { ok:false, code:'reserved', msg:'That username is reserved' };
    if (offensive(s)) return { ok:false, code:'offensive', msg:'That username isn\'t allowed' };
    return { ok:true, code:'ok', msg:'', handle:s };
  }
  const api = { check, offensive, reserved, variants, RESERVED, BLOCK, EXACT, key:s => String(s || '').replace(/^@/, '').toLowerCase() };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ForgedUsername = api;
})(typeof window !== 'undefined' ? window : globalThis);
