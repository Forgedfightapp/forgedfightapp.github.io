/* Forged: built-in strength programs for grapplers (data only, loaded before app.js).
   General, conservative programming: standard compound lifts, 2-3 reps in reserve, low volume around mat training.
   Every exercise has a movement pattern, equipment, a one-line coaching cue and swap alternatives.
   unit: 'reps' (default) | 'sec' (holds) | 'm' (carries). load: false = bodyweight / band (progress by reps, not weight). */
window.FORGED_PROGRAMS = (() => {
  const L = {}; // exercise library
  const ex = (name, pattern, equip, cue, alts, o={}) => { L[name] = { name, pattern, equip, cue, alts, load:true, unit:'reps', lower:false, ...o }; };
  // hinge
  ex('Trap bar deadlift', 'hinge', 'trap bar', 'Hips and shoulders rise together; push the floor away and stop 2 reps short of a grind.', ['Conventional deadlift','Romanian deadlift','Kettlebell deadlift','Single-leg RDL'], { lower:true });
  ex('Conventional deadlift', 'hinge', 'barbell', 'Bar over mid-foot, lats tight, brace before you pull; no grinding reps.', ['Trap bar deadlift','Romanian deadlift','Kettlebell deadlift'], { lower:true });
  ex('Romanian deadlift', 'hinge', 'barbell', 'Soft knees, push the hips back until the hamstrings load; keep the bar against your legs.', ['Single-leg RDL','Kettlebell deadlift','Glute bridge'], { lower:true });
  ex('Kettlebell deadlift', 'hinge', 'kettlebell', 'Bell between the feet, flat back, stand up tall by driving the hips forward.', ['Trap bar deadlift','Romanian deadlift','Kettlebell swing'], { lower:true });
  ex('Kettlebell swing', 'hinge', 'kettlebell', 'Hinge, don\'t squat: snap the hips and let the bell float to chest height.', ['Kettlebell deadlift','Glute bridge','Romanian deadlift'], { lower:true });
  ex('Single-leg RDL', 'hinge', 'dumbbell', 'Reach the free leg back, hips square, move slowly and own the balance.', ['Romanian deadlift','Kettlebell deadlift','Glute bridge'], { lower:true, each:true });
  // squat / single leg
  ex('Goblet squat', 'squat', 'kettlebell', 'Elbows inside the knees, sit between your hips, chest tall.', ['Front squat','Back squat','Split squat'], { lower:true });
  ex('Front squat', 'squat', 'barbell', 'Elbows high, brace hard, control the way down, drive up through mid-foot.', ['Goblet squat','Back squat','Bulgarian split squat'], { lower:true });
  ex('Back squat', 'squat', 'barbell', 'Bar on the upper back, knees track over toes, stay braced the whole rep.', ['Front squat','Goblet squat','Bulgarian split squat'], { lower:true });
  ex('Split squat', 'single-leg', 'dumbbell', 'Long stance, front heel down, back knee to just above the floor.', ['Bulgarian split squat','Reverse lunge','Step-up'], { lower:true, each:true });
  ex('Bulgarian split squat', 'single-leg', 'dumbbell', 'Rear foot on a bench, torso slightly forward, slow on the way down.', ['Split squat','Reverse lunge','Step-up'], { lower:true, each:true });
  ex('Reverse lunge', 'single-leg', 'dumbbell', 'Step back softly, front shin vertical, push back up through the front heel.', ['Split squat','Step-up','Bulgarian split squat'], { lower:true, each:true });
  ex('Step-up', 'single-leg', 'dumbbell', 'Whole foot on the box, drive through the top leg, don\'t push off the back foot.', ['Split squat','Reverse lunge'], { lower:true, each:true });
  // push
  ex('Bench press', 'h-push', 'barbell', 'Shoulder blades pinned, feet planted, touch the low chest and leave 2 reps in the tank.', ['Dumbbell bench press','Push-up','Feet-elevated push-up'], {});
  ex('Dumbbell bench press', 'h-push', 'dumbbell', 'Elbows about 45°, lower under control, press the bells up and slightly together.', ['Bench press','Push-up'], {});
  ex('Push-up', 'h-push', 'bodyweight', 'Body in one straight line, elbows about 45°, chest to fist height.', ['Feet-elevated push-up','Dumbbell bench press','Bench press'], { load:false });
  ex('Feet-elevated push-up', 'h-push', 'bodyweight', 'Feet on a bench, keep the hips level and the core tight.', ['Push-up','Dumbbell bench press'], { load:false });
  ex('Overhead press', 'v-push', 'barbell', 'Squeeze the glutes, ribs down, press up and slightly back over your head.', ['Half-kneeling landmine press','Kettlebell press','Dumbbell overhead press'], {});
  ex('Half-kneeling landmine press', 'v-push', 'landmine', 'Shoulder-friendly press: squeeze the down-knee glute, press up and forward.', ['Kettlebell press','Dumbbell overhead press','Overhead press'], { each:true });
  ex('Kettlebell press', 'v-push', 'kettlebell', 'Bell in the rack, forearm vertical, press without leaning back.', ['Half-kneeling landmine press','Dumbbell overhead press'], { each:true });
  ex('Dumbbell overhead press', 'v-push', 'dumbbell', 'Seated or standing, ribs down, press in a slight arc and lock out softly.', ['Half-kneeling landmine press','Kettlebell press','Overhead press'], {});
  // pull
  ex('Pull-up', 'v-pull', 'pull-up bar', 'Start from a full hang, chin over the bar, no kipping; use a band if you need it.', ['Chin-up','Band-assisted pull-up','Lat pulldown'], { load:false });
  ex('Chin-up', 'v-pull', 'pull-up bar', 'Palms facing you, pull the elbows to the ribs, lower all the way down.', ['Pull-up','Band-assisted pull-up','Lat pulldown'], { load:false });
  ex('Band-assisted pull-up', 'v-pull', 'band', 'Band under the knee or foot, same strict rep as a pull-up.', ['Pull-up','Lat pulldown','Inverted row'], { load:false });
  ex('Lat pulldown', 'v-pull', 'cable', 'Chest up, pull the bar to the upper chest, control it back up.', ['Pull-up','Band-assisted pull-up'], {});
  ex('One-arm dumbbell row', 'h-pull', 'dumbbell', 'Pull the elbow towards the hip, pause, don\'t twist the torso.', ['Chest-supported row','Inverted row','Band row'], { each:true });
  ex('Chest-supported row', 'h-pull', 'dumbbell', 'Chest on an incline bench, squeeze the shoulder blades, pause at the top.', ['One-arm dumbbell row','Barbell row','Inverted row'], {});
  ex('Barbell row', 'h-pull', 'barbell', 'Hinge to about 45°, flat back, row to the lower ribs without jerking.', ['Chest-supported row','One-arm dumbbell row'], {});
  ex('Inverted row', 'h-pull', 'bodyweight', 'Body straight under a bar or rings, pull the chest up, lower slowly.', ['One-arm dumbbell row','Band row','Chest-supported row'], { load:false });
  ex('Band row', 'h-pull', 'band', 'Sit or stand tall, pull to the ribs and squeeze for a second.', ['Inverted row','One-arm dumbbell row'], { load:false });
  // hips
  ex('Hip thrust', 'hip-ext', 'barbell', 'Chin tucked, ribs down, drive through the heels and pause at the top.', ['Glute bridge','Single-leg glute bridge','Kettlebell swing'], { lower:true });
  ex('Glute bridge', 'hip-ext', 'bodyweight', 'Heels close, squeeze the glutes to lift, hold 2 seconds at the top.', ['Single-leg glute bridge','Hip thrust'], { load:false });
  ex('Single-leg glute bridge', 'hip-ext', 'bodyweight', 'Other knee hugged in, hips level, slow lower.', ['Glute bridge','Hip thrust'], { load:false, each:true });
  // carries / core
  ex('Farmer carry', 'carry', 'dumbbell', 'Tall posture, crush the handles, short quick steps.', ['Suitcase carry','Kettlebell rack carry'], { unit:'m' });
  ex('Suitcase carry', 'carry', 'kettlebell', 'One weight, don\'t lean: stay perfectly upright while you walk.', ['Farmer carry','Kettlebell rack carry'], { unit:'m', each:true });
  ex('Kettlebell rack carry', 'carry', 'kettlebell', 'Bell in the front rack, ribs down, walk slowly without arching.', ['Farmer carry','Suitcase carry'], { unit:'m', each:true });
  ex('Pallof press', 'anti-rotation', 'band', 'Press the band straight out and hold 2 seconds; don\'t let it turn you.', ['Dead bug','Side plank','Suitcase carry'], { load:false, each:true });
  ex('Dead bug', 'core', 'bodyweight', 'Low back pressed into the floor, move slowly and breathe out fully.', ['Pallof press','Plank'], { load:false, each:true });
  ex('Plank', 'core', 'bodyweight', 'Squeeze glutes and quads, ribs down, breathe; stop when the hips sag.', ['Dead bug','Side plank'], { load:false, unit:'sec' });
  ex('Side plank', 'core', 'bodyweight', 'Straight line from head to feet, push the floor away with the elbow.', ['Copenhagen plank','Pallof press'], { load:false, unit:'sec', each:true });
  ex('Copenhagen plank', 'core', 'bench', 'Start short-lever (knee on the bench); adductors and obliques, stop before cramping.', ['Side plank','Pallof press'], { load:false, unit:'sec', each:true });
  ex('90/90 hip switch', 'hips', 'bodyweight', 'Sit tall, rotate both knees side to side slowly; hands behind you if needed.', ['Glute bridge','Dead bug'], { load:false, each:true });
  // neck (light, controlled, never to pain)
  ex('Band neck work (4-way)', 'neck', 'band', 'Light band, slow controlled reps front, back and sides; never to pain or fatigue.', ['Neck isometric holds','Lying plate neck curl'], { load:false });
  ex('Neck isometric holds', 'neck', 'bodyweight', 'Press your head gently into your hand in each direction; about 50% effort, no movement.', ['Band neck work (4-way)'], { load:false, unit:'sec' });
  ex('Lying plate neck curl', 'neck', 'plate', 'Light plate on a folded towel, slow small reps, stop well short of fatigue.', ['Band neck work (4-way)','Neck isometric holds'], {});
  ex('Supported neck bridge', 'neck', 'bodyweight', 'Only if pain-free and coached: hands take most of the weight, small range, never roll onto the top of the head.', ['Neck isometric holds','Band neck work (4-way)'], { load:false, unit:'sec' });
  // grip
  ex('Gi or towel hang', 'grip', 'pull-up bar', 'Grip the gi or a towel over the bar, shoulders active, stop before the grip fully fails.', ['Dead hang','Plate pinch hold','Farmer carry'], { load:false, unit:'sec' });
  ex('Dead hang', 'grip', 'pull-up bar', 'Overhand grip, shoulders slightly engaged, breathe and hold.', ['Gi or towel hang','Farmer carry'], { load:false, unit:'sec' });
  ex('Plate pinch hold', 'grip', 'plate', 'Pinch two plates smooth side out, stand tall, hold.', ['Gi or towel hang','Farmer carry'], { unit:'sec' });
  ex('Band finger extensions', 'grip', 'band', 'Rubber band around the fingertips, open the hand fully; balances all the gripping.', ['Dead hang'], { load:false });
  // joint health
  ex('Band pull-apart', 'shoulder health', 'band', 'Arms straight, pull the band to the chest by squeezing the shoulder blades.', ['Face pull','Band external rotation'], { load:false });
  ex('Face pull', 'shoulder health', 'cable', 'Pull the rope to the eyes, elbows high, rotate the hands back.', ['Band pull-apart','Band external rotation'], {});
  ex('Band external rotation', 'shoulder health', 'band', 'Elbow pinned to your side, rotate out slowly, light resistance.', ['Band pull-apart','Face pull'], { load:false, each:true });
  ex('Spanish squat hold', 'knee health', 'band', 'Heavy band behind the knees, sit back with vertical shins and hold; knee-friendly quad work.', ['Wall sit','Terminal knee extension'], { load:false, unit:'sec' });
  ex('Wall sit', 'knee health', 'bodyweight', 'Back flat on the wall, knees over ankles, only as deep as pain-free.', ['Spanish squat hold','Terminal knee extension'], { load:false, unit:'sec' });
  ex('Terminal knee extension', 'knee health', 'band', 'Band behind the knee, straighten the leg fully and squeeze the quad.', ['Spanish squat hold','Wall sit'], { load:false, each:true });
  ex('Tibialis raise', 'knee health', 'bodyweight', 'Back against a wall, heels forward, lift the toes up and down slowly.', ['Terminal knee extension'], { load:false });

  const E = (name, sets, reps, rest, o={}) => ({ name, sets, reps, rest, ...o }); // reps: number or [lo, hi]
  const RPE = 'Leave 2–3 reps in reserve (RPE 7–8). Never train through sharp pain.';
  const deload = { sets:-1, note:'Lighter week: one set fewer on everything, same weights.' };
  const templates = [
    { id:'full2', pro:true, name:'2-day full body', short:'Rolling 4–5× a week', weeks:8, days:2, deloadWeeks:[4,8], deload, equipment:'Gym: trap bar, barbell, dumbbells, band',
      blurb:'Two short full-body sessions that build strength without wrecking your rolling. Lift after light days or before rest days, never right before hard sparring.',
      sessions:[
        { key:'A', name:'Day A', ex:[ E('Trap bar deadlift',3,5,'2–3 min',{ main:true }), E('Bench press',3,6,'2 min',{ main:true }), E('One-arm dumbbell row',3,[8,10],'90 s'), E('Split squat',2,8,'90 s'), E('Pallof press',2,10,'60 s'), E('Farmer carry',3,30,'60 s') ] },
        { key:'B', name:'Day B', ex:[ E('Goblet squat',3,[6,8],'2 min',{ main:true }), E('Pull-up',3,[5,8],'2 min',{ main:true }), E('Half-kneeling landmine press',3,8,'90 s'), E('Hip thrust',3,8,'90 s'), E('Band neck work (4-way)',2,15,'60 s'), E('Dead bug',2,8,'60 s') ] } ] },
    { id:'luf3', pro:true, name:'3-day lower / upper / full', short:'Rolling 2–3× a week', weeks:8, days:3, deloadWeeks:[4,8], deload, equipment:'Gym: barbell, trap bar, dumbbells, landmine, cable, bands',
      blurb:'A classic split for when you have more time off the mats: one lower, one upper and one full-body day each week.',
      sessions:[
        { key:'L', name:'Lower', ex:[ E('Front squat',4,5,'2–3 min',{ main:true }), E('Romanian deadlift',3,8,'2 min'), E('Bulgarian split squat',3,8,'90 s'), E('Copenhagen plank',2,20,'60 s'), E('Suitcase carry',3,30,'60 s') ] },
        { key:'U', name:'Upper', ex:[ E('Bench press',4,5,'2–3 min',{ main:true }), E('Pull-up',4,[5,8],'2 min',{ main:true }), E('Half-kneeling landmine press',3,8,'90 s'), E('Chest-supported row',3,10,'90 s'), E('Face pull',2,15,'60 s'), E('Band neck work (4-way)',2,15,'60 s') ] },
        { key:'F', name:'Full body', ex:[ E('Trap bar deadlift',3,4,'2–3 min',{ main:true }), E('Push-up',3,[10,15],'90 s'), E('Inverted row',3,[8,12],'90 s'), E('Hip thrust',3,8,'90 s'), E('Pallof press',2,10,'60 s'), E('Farmer carry',3,30,'60 s') ] } ] },
    { id:'home', pro:true, name:'Home / minimal equipment', short:'Kettlebell, bands, bodyweight', weeks:6, days:2, deloadWeeks:[6], deload, equipment:'One or two kettlebells, a long band, a pull-up bar or sturdy table',
      blurb:'Everything you need at home or in a hotel room. Progress by adding reps first, then a heavier bell.',
      sessions:[
        { key:'A', name:'Day A', ex:[ E('Kettlebell swing',4,12,'60–90 s',{ main:true }), E('Goblet squat',3,10,'90 s',{ main:true }), E('Push-up',3,[10,15],'90 s'), E('Band row',3,[12,15],'60 s'), E('Reverse lunge',2,8,'60 s'), E('Side plank',2,30,'45 s') ] },
        { key:'B', name:'Day B', ex:[ E('Single-leg RDL',3,8,'90 s',{ main:true }), E('Kettlebell press',3,8,'90 s',{ main:true }), E('Inverted row',3,[6,10],'90 s'), E('Single-leg glute bridge',3,10,'60 s'), E('Suitcase carry',3,30,'60 s'), E('Pallof press',2,10,'45 s') ] } ] },
    { id:'comp', pro:true, comp:true, name:'Comp prep block', short:'4–6 weeks: peak, then taper', weeks:6, lengths:[4,5,6], days:2, equipment:'Gym: trap bar, barbell, dumbbells, pull-up bar',
      blurb:'Two sessions a week while mat training ramps up. Heavier, lower-rep work peaks two weeks out, then volume drops while weights stay up so you arrive fresh. Last lift at least 4 days before the event.',
      phases:{
        6:[ { name:'Build', main:{ sets:3, reps:6 }, acc:1, note:'Build: smooth reps, RPE 7.' }, { name:'Build', main:{ sets:4, reps:5 }, acc:1, note:'Build: RPE 7–8.' }, { name:'Strength', main:{ sets:4, reps:4 }, acc:1, note:'Strength: heavier, RPE 8, full rest.' },
            { name:'Peak', main:{ sets:3, reps:3 }, acc:.67, note:'Peak: heaviest week, RPE 8. No grinding.' }, { name:'Taper', main:{ sets:2, reps:3 }, acc:.5, note:'Taper: cut volume about 40%, keep the weight on the bar.' }, { name:'Comp week', main:{ sets:2, reps:2 }, acc:0, note:'Comp week: one short, light session (RPE 6) at least 4 days out. Sleep, make weight safely.' } ],
        5:[ { name:'Build', main:{ sets:4, reps:5 }, acc:1, note:'Build: RPE 7–8.' }, { name:'Strength', main:{ sets:4, reps:4 }, acc:1, note:'Strength: heavier, RPE 8.' }, { name:'Peak', main:{ sets:3, reps:3 }, acc:.67, note:'Peak: heaviest week, RPE 8.' },
            { name:'Taper', main:{ sets:2, reps:3 }, acc:.5, note:'Taper: cut volume, keep intensity.' }, { name:'Comp week', main:{ sets:2, reps:2 }, acc:0, note:'Comp week: light session only, at least 4 days out.' } ],
        4:[ { name:'Build', main:{ sets:4, reps:5 }, acc:1, note:'Build: RPE 7–8.' }, { name:'Peak', main:{ sets:3, reps:3 }, acc:.67, note:'Peak: heaviest week, RPE 8.' },
            { name:'Taper', main:{ sets:2, reps:3 }, acc:.5, note:'Taper: cut volume, keep intensity.' }, { name:'Comp week', main:{ sets:2, reps:2 }, acc:0, note:'Comp week: light session only, at least 4 days out.' } ] },
      sessions:[
        { key:'A', name:'Day A', ex:[ E('Trap bar deadlift',3,5,'2–3 min',{ main:true }), E('Bench press',3,5,'2–3 min',{ main:true }), E('One-arm dumbbell row',2,8,'90 s'), E('Pallof press',2,10,'60 s') ] },
        { key:'B', name:'Day B', ex:[ E('Front squat',3,5,'2–3 min',{ main:true }), E('Pull-up',3,5,'2 min',{ main:true }), E('Hip thrust',2,8,'90 s'), E('Band neck work (4-way)',2,15,'60 s') ] } ] }
  ];
  const finishers = [
    { id:'grip', pro:true, name:'Grip', short:'Gi grips, hangs, pinches', ex:[ E('Gi or towel hang',3,30,'60 s'), E('Plate pinch hold',2,20,'60 s'), E('Band finger extensions',2,20,'30 s') ] },
    { id:'neck', pro:true, name:'Neck', short:'Light, controlled, never to pain', ex:[ E('Band neck work (4-way)',2,15,'45 s'), E('Neck isometric holds',2,10,'30 s') ] },
    { id:'core', pro:true, name:'Core & hips', short:'Anti-rotation, adductors, hip mobility', ex:[ E('Pallof press',2,10,'45 s'), E('Copenhagen plank',2,15,'45 s'), E('90/90 hip switch',2,8,'30 s'), E('Dead bug',2,8,'45 s') ] },
    { id:'joints', pro:true, name:'Joint health', short:'Shoulders and knees', ex:[ E('Band pull-apart',2,15,'30 s'), E('Band external rotation',2,12,'30 s'), E('Spanish squat hold',3,30,'45 s'), E('Tibialis raise',2,15,'30 s') ] }
  ];
  const disclaimer = 'These are general training programs, not medical advice or a plan made for you. If you have an injury, pain or a health condition, get checked by a doctor or physio first, and work with a qualified coach. Stop any exercise that hurts.';
  return { library:L, templates, finishers, disclaimer, rpeNote:RPE };
})();
