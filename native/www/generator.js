/* Forged 3.18.0 workout generator: pure functions, no storage (loaded before app.js; also require()-able in tests).
   Library tags: pattern, equipment needed, difficulty 1-3, injury areas a move loads, arts it carries over to, heavy-legs flag. */
(function(root){
  const EQUIP = [['barbell','Barbell'],['rack','Squat rack'],['bench','Bench'],['dumbbell','Dumbbells'],['kettlebell','Kettlebells'],['trapbar','Trap bar'],['pullup','Pull-up bar'],['band','Bands'],['cable','Cable machine'],['landmine','Landmine'],['plate','Weight plates'],['box','Box / step']];
  const LOCATIONS = [['gym','Gym'],['garage','Garage / home gym'],['home','Home'],['hotel','Hotel'],['bodyweight','Bodyweight only']];
  const PRESET = { gym:EQUIP.map(e => e[0]), garage:['barbell','rack','bench','dumbbell','kettlebell','pullup','band','plate','box'], home:['dumbbell','band','box'], hotel:['dumbbell','bench'], bodyweight:[] };
  const EXP = [['beginner','Beginner','New to lifting or back after a long break. Simple moves, learn the patterns.'],['intermediate','Intermediate','Lifting regularly for 6+ months. Comfortable with the main lifts.'],['advanced','Advanced','Years of consistent training. Ready for heavier, more complex work.']];
  const GOALS = [['strength','Strength'],['mobility','Mobility'],['conditioning','Conditioning'],['injury','Injury-proofing']];
  const LENGTHS = [[30,'30 min'],[45,'45 min'],[60,'60+ min']];
  const QUICK_MIN = 25;
  // name, pattern, equipment (all needed), difficulty, loads injury areas, arts, cue, heavy legs, unit
  const G = ['bjj','wrestling','judo','mma'], S = ['muaythai','boxing','kickboxing','mma'], A = G.concat(S);
  const LIB = [
    ['Trap bar deadlift','hinge',['trapbar'],2,['Lower back','Hamstring'],G,'Hips and shoulders rise together; push the floor away.',1],
    ['Conventional deadlift','hinge',['barbell'],3,['Lower back','Hamstring'],G,'Bar over mid-foot, lats tight, brace before you pull.',1],
    ['Romanian deadlift','hinge',['barbell'],2,['Lower back','Hamstring'],G,'Soft knees, hips back until the hamstrings load.',1],
    ['Kettlebell deadlift','hinge',['kettlebell'],1,['Lower back'],A,'Flat back, stand tall by driving the hips forward.',0],
    ['Single-leg RDL','hinge',['dumbbell'],2,['Hamstring','Ankle'],A,'Reach the free leg back, hips square, move slowly.',0],
    ['Hip hinge good morning','hinge',[],1,['Lower back'],A,'Hands on hips, push the hips back with a long spine.',0],
    ['Back squat','squat',['barbell','rack'],3,['Knee','Lower back','Hip'],G,'Brace hard, knees track over toes, control the descent.',1],
    ['Front squat','squat',['barbell','rack'],3,['Knee','Wrist','Lower back'],G,'Elbows high, chest tall, drive through mid-foot.',1],
    ['Goblet squat','squat',['kettlebell'],1,['Knee'],A,'Elbows inside the knees, sit between your hips.',1],
    ['Dumbbell goblet squat','squat',['dumbbell'],1,['Knee'],A,'Hold one bell at the chest, sit down between the heels.',1],
    ['Bodyweight squat','squat',[],1,['Knee'],A,'Arms forward, sit back and down, stand tall.',0],
    ['Bulgarian split squat','single-leg',['dumbbell','bench'],2,['Knee','Hip'],A,'Rear foot on a bench, slow on the way down.',1],
    ['Reverse lunge','single-leg',['dumbbell'],1,['Knee'],A,'Step back softly, push up through the front heel.',0],
    ['Step-up','single-leg',['box'],1,['Knee'],A,'Whole foot on the box, drive through the top leg.',0],
    ['Split squat','single-leg',[],1,['Knee'],A,'Long stance, back knee to just above the floor.',0],
    ['Bench press','h-push',['barbell','bench','rack'],2,['Shoulder','Elbow','Wrist'],A,'Shoulder blades pinned, touch the low chest.'],
    ['Dumbbell bench press','h-push',['dumbbell','bench'],1,['Shoulder','Elbow'],A,'Elbows about 45°, press up and slightly together.'],
    ['Push-up','h-push',[],1,['Shoulder','Wrist'],A,'Body in one line, chest to fist height.'],
    ['Overhead press','v-push',['barbell','rack'],3,['Shoulder','Lower back'],S,'Squeeze the glutes, ribs down, press up and back.'],
    ['Half-kneeling landmine press','v-push',['landmine'],2,['Shoulder'],A,'Squeeze the down-knee glute, press up and forward.'],
    ['Dumbbell overhead press','v-push',['dumbbell'],1,['Shoulder','Elbow'],S,'Ribs down, press in a slight arc.'],
    ['Pike push-up','v-push',[],2,['Shoulder','Wrist'],S,'Hips high, lower the head between the hands.'],
    ['Pull-up','v-pull',['pullup'],2,['Shoulder','Elbow','Hand/fingers'],G,'Full hang, chin over the bar, no kipping.'],
    ['Band-assisted pull-up','v-pull',['pullup','band'],1,['Shoulder','Elbow'],G,'Same strict rep as a pull-up with a band.'],
    ['Lat pulldown','v-pull',['cable'],1,['Shoulder','Elbow'],A,'Chest up, pull the bar to the upper chest.'],
    ['Band lat pulldown','v-pull',['band'],1,['Shoulder'],A,'Anchor high, drive the elbows to the ribs.'],
    ['Barbell row','h-pull',['barbell'],3,['Lower back','Elbow'],G,'Hinge to 45°, flat back, row to the lower ribs.'],
    ['One-arm dumbbell row','h-pull',['dumbbell'],1,['Elbow'],A,'Elbow to the hip, pause, no twisting.'],
    ['Inverted row','h-pull',['rack'],1,['Elbow','Hand/fingers'],G,'Body straight under the bar, chest to the bar.'],
    ['Towel door row','h-pull',[],1,['Hand/fingers','Elbow'],G,'Towel around a sturdy door handle, lean back and row.'],
    ['Band row','h-pull',['band'],1,['Elbow'],A,'Squeeze the shoulder blades, pause at the chest.'],
    ['Hip thrust','hip-ext',['barbell','bench'],2,['Hip','Lower back'],G,'Chin tucked, ribs down, lock out with the glutes.'],
    ['Glute bridge','hip-ext',[],1,['Hip'],A,'Drive through the heels, squeeze at the top.'],
    ['Kettlebell swing','power',['kettlebell'],2,['Lower back','Hamstring'],A,'Hinge, snap the hips, let the bell float.',0],
    ['Med-ball style slam (bodyweight burpee)','power',[],1,['Wrist','Shoulder','Knee'],A,'Down to the floor and back up fast, land soft.',0],
    ['Box jump','power',['box'],2,['Knee','Ankle','Foot'],S,'Jump up, land soft and quiet, step down.',1],
    ['Farmer carry','carry',['dumbbell'],1,['Hand/fingers','Wrist'],G,'Tall posture, short quick steps, crush the handles.',0,'m'],
    ['Suitcase carry','carry',['kettlebell'],1,['Hand/fingers','Lower back'],A,'One side loaded, stay perfectly upright.',0,'m'],
    ['Plank','core',[],1,['Lower back','Shoulder'],A,'Ribs down, squeeze the glutes, breathe.',0,'sec'],
    ['Dead bug','core',[],1,[],A,'Low back pressed down, move slow.'],
    ['Pallof press','anti-rotation',['band'],1,['Ribs'],S,'Press out and hold, don\'t let the band turn you.'],
    ['Side plank','anti-rotation',[],1,['Shoulder','Ribs'],A,'Hips high, straight line from head to feet.',0,'sec'],
    ['Russian twist','rotation',[],1,['Lower back','Ribs'],S,'Rotate from the ribs, not just the arms.'],
    ['Landmine rotation','rotation',['landmine'],2,['Lower back','Ribs'],S,'Pivot the back foot and rotate the bar side to side.'],
    ['Neck isometric holds','neck',[],1,['Neck'],G,'Press into your hand, 50% effort, hold steady.',0,'sec'],
    ['Band neck work (4-way)','neck',['band'],2,['Neck'],G,'Slow controlled range, light band.'],
    ['Dead hang','grip',['pullup'],1,['Shoulder','Hand/fingers'],G,'Shoulders active, crush the bar.',0,'sec'],
    ['Gi or towel hang','grip',['pullup'],2,['Shoulder','Hand/fingers','Elbow'],['bjj','judo'],'Grip the towels like lapels and hang.',0,'sec'],
    ['Plate pinch hold','grip',['plate'],1,['Hand/fingers'],G,'Pinch two plates smooth side out.',0,'sec'],
    ['Band pull-apart','shoulder-health',['band'],1,[],A,'Straight arms, pull to the chest, slow return.'],
    ['Face pull','shoulder-health',['cable'],1,[],A,'Pull to the eyes, elbows high, rotate out.'],
    ['Tibialis raise','knee-health',[],1,[],A,'Back against a wall, lift the toes high.'],
    ['Copenhagen plank','adductor',['bench'],2,['Groin'],G,'Top leg on the bench, lift the hips, hold.',0,'sec'],
    ['90/90 hip switch','mobility',[],1,[],A,'Rotate the knees side to side, tall spine.'],
    ['Cossack squat','mobility',[],2,['Knee','Groin'],A,'Shift side to side, heel down, other leg straight.'],
  ].map(([name, pattern, equip, diff, inj, arts, cue, heavyLegs, unit]) => ({ name, pattern, equip, diff, inj, arts, cue, heavyLegs:!!heavyLegs, unit:unit || 'reps' }));
  const LOWER = ['hinge','squat','single-leg','hip-ext'], UPPER = ['h-push','v-push','h-pull','v-pull'];
  const ACC = { strength:['carry','core','grip','neck','anti-rotation','shoulder-health','power'], conditioning:['power','carry','core','rotation','anti-rotation'], mobility:['mobility','core','shoulder-health','knee-health','adductor'], injury:['neck','shoulder-health','knee-health','adductor','grip','core'] };
  const DAY_MAIN = { full:['squat','h-pull','hinge','h-push','v-pull'], lower:['squat','hinge','single-leg','hip-ext'], upper:['h-push','h-pull','v-push','v-pull'] };
  const REHAB = { Neck:[['Chin tucks','2 × 10','Slide the chin straight back, hold 2s.'],['Neck isometrics (light)','2 × 20s','Press gently in each direction.']],
    Shoulder:[['Band external rotation','2 × 15','Elbow by your side, rotate out slowly.'],['Wall slides','2 × 10','Forearms on the wall, slide up without shrugging.'],['Scap push-up','2 × 12','Arms straight, move only the shoulder blades.']],
    Elbow:[['Wrist flexor/extensor curls (light)','2 × 15','Slow tempo, light weight.'],['Eccentric wrist extension','2 × 12','Lower slowly over 3s.']],
    Wrist:[['Wrist circles','2 × 10 each way','Gentle range.'],['Rice bucket or fist opens','2 × 20','Open and close fully.']],
    'Hand/fingers':[['Band finger extensions','2 × 20','Spread the fingers against a band.'],['Tendon glides','2 × 5','Move through each fist position slowly.']],
    'Upper back':[['Thoracic open book','2 × 8 each','Rotate the top arm open, follow with your eyes.'],['Cat-cow','2 × 10','Move one segment at a time.']],
    'Lower back':[['Bird dog','2 × 8 each','Long spine, slow reach.'],['McGill curl-up','2 × 8','Hands under the low back, lift head and shoulders slightly.'],['Glute bridge hold','2 × 30s','Squeeze the glutes, ribs down.']],
    Ribs:[['90/90 breathing','2 × 5 breaths','Full exhale, ribs down.'],['Dead bug (slow)','2 × 6 each','Low back stays down.']],
    Hip:[['90/90 hip switch','2 × 8','Tall spine, rotate slowly.'],['Clamshell','2 × 15 each','Hips stacked, open the knee.']],
    Groin:[['Adductor rock-back','2 × 10','Kneel, one leg out, rock the hips back.'],['Short-lever Copenhagen','2 × 15s each','Knee on the bench, lift the hips.']],
    Hamstring:[['Hamstring floss','2 × 10 each','Lying, straighten the knee gently.'],['Glute bridge walkout','2 × 6','Walk the heels out slowly and back.']],
    Knee:[['Spanish squat hold (band)','3 × 30s','Band behind the knees, sit back, shins vertical.'],['Terminal knee extension','2 × 15','Band behind the knee, straighten fully.'],['Tibialis raise','2 × 15','Back on the wall, lift the toes.']],
    Ankle:[['Ankle circles','2 × 10 each way','Slow full range.'],['Knee-to-wall','2 × 10','Drive the knee over the toes, heel down.'],['Single-leg balance','2 × 30s','Soft knee, eyes forward.']],
    Foot:[['Towel scrunches','2 × 15','Pull the towel in with your toes.'],['Calf raise (slow)','2 × 12','3s down.']],
    Other:[['Easy mobility flow','5 min','Move gently through comfortable ranges.']] };
  const WARMUP = { full:['Jumping jacks or skipping · 2 min','World\'s greatest stretch · 5 each side','Bodyweight squat · 10','Band pull-apart or arm circles · 15'],
    lower:['Easy bike, skip or jog · 2 min','Leg swings · 10 each way','Glute bridge · 12','Bodyweight squat · 10'],
    upper:['Arm circles · 10 each way','Band pull-apart or scap push-up · 15','Push-up (easy) · 8','Thoracic open book · 5 each side'] };
  const MED_NOTE = 'Not medical advice. Stop if anything hurts and see a medical professional for an injury.';

  function rand(seed){ let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const maxDiff = exp => exp === 'advanced' ? 3 : exp === 'intermediate' ? 2 : 1;
  const hasEquip = (x, eq) => x.equip.every(e => eq.includes(e));
  const loadsInjury = (x, inj) => x.inj.some(a => inj.includes(a));
  /* rx by experience (volume), role and goal; progression note scales with experience */
  function rx(x, role, exp, goal){
    const hold = x.unit === 'sec', carry = x.unit === 'm';
    const sets = role === 'main' ? { beginner:2, intermediate:3, advanced:4 }[exp] : { beginner:2, intermediate:3, advanced:3 }[exp];
    let reps = hold ? '20–30s' : carry ? '20–30 m' : role === 'main' ? (goal === 'strength' ? { beginner:'8–10', intermediate:'5–8', advanced:'3–6' }[exp] : goal === 'conditioning' ? '10–15' : { beginner:'8–12', intermediate:'6–10', advanced:'5–8' }[exp]) : '10–15';
    if (x.pattern === 'power') reps = x.name === 'Kettlebell swing' ? '12–15' : '5–8';
    const rest = role === 'main' ? (goal === 'conditioning' ? 60 : { beginner:90, intermediate:120, advanced:150 }[exp]) : goal === 'conditioning' ? 30 : 60;
    const prog = { beginner:'Add a rep each session; add weight once you hit the top of the range on every set.', intermediate:'Add a little weight each week while you keep 2 reps in reserve.', advanced:'Work up to a top set, then back off 10% for the rest.' }[exp];
    return { name:x.name, pattern:x.pattern, sets, reps, rest, cue:x.cue, unit:x.unit, role, prog, diff:x.diff };
  }
  /* weekly plan: exact lift days; lower/full focus never lands the day before a mat day (light legs if unavoidable) */
  function weekPlan(a){
    const mat = (a.schedule && a.schedule.mat) || [], lift = ((a.schedule && a.schedule.lift) || []).slice().sort((x, y) => x - y);
    const types = lift.length === 1 ? ['full'] : lift.length === 2 ? ['full','full'] : lift.length === 3 ? ['lower','upper','full'] : lift.map((_, i) => i % 2 ? 'upper' : 'lower');
    const ok = d => !mat.includes((d + 1) % 7);
    const legDays = lift.filter(ok), other = lift.filter(d => !ok(d));
    const legTypes = types.filter(t => t !== 'upper'), upTypes = types.filter(t => t === 'upper');
    const out = {}, order = legDays.concat(other); const q = legTypes.concat(upTypes);
    // fill leg-friendly days with leg types first, then the rest
    order.forEach((d, i) => { const t = q[i] === 'lower' && !ok(d) ? 'full' : q[i]; out[d] = { dow:d, type:t, lightLegs:!ok(d) && t !== 'upper', beforeMat:!ok(d) }; });
    return lift.map(d => out[d]);
  }
  /* one workout. a = assessment {exp, goal, arts, primary, injuries, equip}; opts {type, minutes, lightLegs, seed, swaps} */
  function workout(a, opts){
    const exp = a.exp || 'beginner', goal = a.goal || 'strength', inj = a.injuries || [], eq = a.equip || [], arts = a.arts || [];
    const r = rand(opts.seed || 'x'), dmax = maxDiff(exp), type = opts.type || 'full', minutes = opts.minutes || 45;
    const pool = LIB.filter(x => hasEquip(x, eq) && !loadsInjury(x, inj) && !(opts.lightLegs && x.heavyLegs));
    const score = x => r() + (x.diff <= dmax ? 1 : -5) + (x.diff === dmax ? .3 : 0) + (x.arts.some(k => arts.includes(k)) ? .3 : 0) + (a.primary && x.arts.includes(a.primary) ? .2 : 0) + Math.min(x.equip.length, 2) * .35;
    const pickFrom = (pat, used) => pool.filter(x => x.pattern === pat && !used.has(x.name)).map(x => [score(x), x]).sort((p, q) => q[0] - p[0]).map(p => p[1])[0];
    const n = minutes <= 30 ? 4 : minutes <= 45 ? 5 : 6, nMain = exp === 'beginner' ? 2 : 3;
    const pats = new Set(), names = new Set(), list = [];
    const add = (pat, role) => { if (pats.has(pat)) return; const x = pickFrom(pat, names); if (x) { pats.add(pat); names.add(x.name); list.push(rx(x, role, exp, goal)); } };
    let mains = DAY_MAIN[type].slice(); if (opts.lightLegs) mains = mains.filter(p => !['squat','hinge'].includes(p)).concat(['h-pull','v-pull','h-push','v-push']);
    for (const p of mains) { if (list.length >= nMain) break; add(p, 'main'); }
    const acc = ACC[goal].concat(ACC.strength, LOWER, UPPER, ['mobility','core']);
    for (const p of acc) { if (list.length >= n) break; add(p, 'acc'); }
    (opts.swaps || []).forEach(([from, to]) => { const i = list.findIndex(e => e.name === from), x = LIB.find(y => y.name === to); if (i >= 0 && x) list[i] = rx(x, list[i].role, exp, goal); });
    const rehab = inj.filter((k, i, arr) => REHAB[k] && arr.indexOf(k) === i).flatMap(k => REHAB[k].slice(0, 3).map(([name, dose, cue]) => ({ name, dose, cue, area:k, role:'rehab' })));
    /* fit the clock: rehab 2 per area (min), then trim accessory sets, then main sets (never below 2) */
    const estOf = () => 6 + Math.round(list.reduce((s, e) => s + e.sets * (45 + e.rest), 0) / 60) + rehab.length * 2;
    const areas = [...new Set(rehab.map(x => x.area))];
    if (estOf() > minutes + 3) areas.forEach(k => { const own = rehab.filter(x => x.area === k); if (own.length > 2) rehab.splice(rehab.indexOf(own[2]), 1); });
    for (const role of ['acc', 'main']) for (let guard = 0; estOf() > minutes + 3 && guard < 20; guard++) { const e = list.filter(x => x.role === role && x.sets > 2).sort((p, q) => q.sets - p.sets)[0]; if (!e) break; e.sets--; }
    for (let guard = 0; estOf() > minutes + 3 && guard < 20; guard++) { const e = list.filter(x => x.rest > 60).sort((p, q) => q.rest - p.rest)[0]; if (!e) break; e.rest -= 30; }
    const sets = list.reduce((s, e) => s + e.sets, 0), est = estOf();
    return { type, minutes, warmup:WARMUP[type], main:list.filter(e => e.role === 'main'), acc:list.filter(e => e.role === 'acc'), rehab, est, sets, note:rehab.length ? MED_NOTE : '' };
  }
  /* swap options: same pattern, available equipment, by pain (skip moves that load the area) */
  function swaps(a, name, painArea){
    const x = LIB.find(y => y.name === name); if (!x) return [];
    const inj = (a.injuries || []).concat(painArea ? [painArea] : []);
    return LIB.filter(y => y.pattern === x.pattern && y.name !== name && hasEquip(y, a.equip || []) && !loadsInjury(y, inj)).map(y => y.name);
  }
  const api = { EQUIP, LOCATIONS, PRESET, EXP, GOALS, LENGTHS, QUICK_MIN, LIB, REHAB, WARMUP, MED_NOTE, weekPlan, workout, swaps, maxDiff };
  root.FORGED_GEN = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
