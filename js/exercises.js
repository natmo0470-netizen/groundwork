/* Groundwork — exercise library and equipment model.
   Each exercise: id, name, pattern (movement slot used by the planner), muscles,
   req (equipment ids ALL required; bodyweight needs none), diff (1 easy – 3 advanced),
   anim (demo animation key), prop (what the figure holds), cues (form tips),
   unit ('reps' | 'sec' | 'min'), lower (true = lower-body load increments),
   Every exercise is demonstrated with an animated figure (js/anim.js). */

const EQUIPMENT = [
  { id: 'dumbbell', short: 'Dumbbell',   label: 'Dumbbells',        group: 'Free weights' },
  { id: 'barbell', short: 'Barbell',    label: 'Barbell + rack',   group: 'Free weights' },
  { id: 'bench', short: 'Bench',      label: 'Bench',            group: 'Free weights' },
  { id: 'kettlebell', short: 'Kettlebell', label: 'Kettlebells',      group: 'Free weights' },
  { id: 'bands', short: 'Band',      label: 'Resistance bands', group: 'Free weights' },
  { id: 'pullup_bar', short: 'Pull-up bar', label: 'Pull-up bar',      group: 'Free weights' },
  { id: 'cable', short: 'Cable',      label: 'Cable machine',    group: 'Machines' },
  { id: 'smith', short: 'Smith',      label: 'Smith machine',    group: 'Machines' },
  { id: 'machines', short: 'Machine',   label: 'Weight machines',  group: 'Machines', note: 'Leg press, leg curl, chest press, dip station' },
  { id: 'treadmill', short: 'Treadmill',  label: 'Treadmill',        group: 'Cardio equipment' },
  { id: 'bike', short: 'Bike',       label: 'Stationary bike',  group: 'Cardio equipment' },
  { id: 'rower', short: 'Rower',      label: 'Rowing machine',   group: 'Cardio equipment' },
  { id: 'elliptical', short: 'Elliptical', label: 'Elliptical',       group: 'Cardio equipment' },
  { id: 'stair', short: 'Stairs',      label: 'Stair climber',    group: 'Cardio equipment' },
  { id: 'jumprope', short: 'Rope',   label: 'Jump rope',        group: 'Cardio equipment' },
];
const FULL_GYM = EQUIPMENT.map(e => e.id);

const PATTERN_GROUP = {
  squat: 'Legs', lunge: 'Legs', hinge: 'Legs', quad_iso: 'Legs', ham_iso: 'Legs', calf: 'Legs',
  glute: 'Glutes', hpush: 'Chest', chest_iso: 'Chest', vpush: 'Shoulders', side_delt: 'Shoulders',
  rear_delt: 'Shoulders', hpull: 'Back', vpull: 'Back', biceps: 'Arms', triceps: 'Arms',
  core: 'Core', cardio: 'Cardio', shrug: 'Back', forearm: 'Arms', adductor: 'Legs',
};

const EXERCISES = [];
function E(id, name, pattern, muscles, req, diff, anim, prop, cues, extra) {
  EXERCISES.push(Object.assign({ id, name, pattern, muscles, req, diff, anim, prop, cues, unit: 'reps', lower: false }, extra || {}));
}
const L = { lower: true };

// ---------- Squat pattern ----------
E('bb_back_squat', 'Barbell Back Squat', 'squat', ['Quads', 'Glutes', 'Core'], ['barbell'], 3, 'squat', 'barbell',
  ['Bar rests on your upper back, not your neck', 'Brace your core, then sit down and back', 'Knees track over your toes', 'Drive up through your whole foot'], L);
E('leg_press', 'Leg Press', 'squat', ['Quads', 'Glutes'], ['machines'], 1, 'legpress', 'none',
  ['Feet shoulder-width, mid-platform', 'Lower until knees reach about 90°', 'Keep your lower back on the pad', 'Push through heels; don\'t lock knees hard'], L);
E('smith_squat', 'Smith Machine Squat', 'squat', ['Quads', 'Glutes'], ['smith'], 2, 'squat', 'smith',
  ['Feet slightly in front of the bar', 'Unhook by twisting the bar', 'Sit down until thighs are parallel', 'Stand up tall and squeeze glutes'], L);
E('goblet_squat', 'Goblet Squat', 'squat', ['Quads', 'Glutes', 'Core'], ['dumbbell'], 1, 'squat', 'dumbbell',
  ['Hold one dumbbell at your chest', 'Elbows point down between your knees', 'Sit straight down, chest up', 'Push the floor away to stand'], L);
E('kb_goblet_squat', 'Kettlebell Goblet Squat', 'squat', ['Quads', 'Glutes', 'Core'], ['kettlebell'], 1, 'squat', 'kettlebell',
  ['Hold the bell by the horns at your chest', 'Sit between your heels', 'Keep your chest proud', 'Stand up without leaning forward'], L);
E('bb_front_squat', 'Barbell Front Squat', 'squat', ['Quads', 'Core'], ['barbell'], 3, 'squat', 'barbell',
  ['Bar sits on the front of your shoulders', 'Elbows high throughout', 'Stay upright as you descend', 'Drive elbows up as you stand'], L);
E('bw_squat', 'Bodyweight Squat', 'squat', ['Quads', 'Glutes'], [], 1, 'squat', 'none',
  ['Feet shoulder-width apart', 'Reach arms forward for balance', 'Sit back as if to a chair', 'Stand tall and squeeze glutes'], L);
E('band_squat', 'Banded Squat', 'squat', ['Quads', 'Glutes'], ['bands'], 1, 'squat', 'band',
  ['Stand on the band, handles at shoulders', 'Sit down and back', 'Keep tension in the band', 'Stand up fully each rep'], L);

// ---------- Hinge pattern ----------
E('bb_deadlift', 'Barbell Deadlift', 'hinge', ['Hamstrings', 'Glutes', 'Back'], ['barbell'], 3, 'deadlift', 'barbell',
  ['Bar over mid-foot, shins close', 'Flat back, chest up, brace hard', 'Push the floor away', 'Lock out by squeezing glutes, not leaning back'], L);
E('bb_rdl', 'Romanian Deadlift', 'hinge', ['Hamstrings', 'Glutes'], ['barbell'], 2, 'rdl', 'barbell',
  ['Soft knees, push hips back', 'Bar slides down your thighs', 'Stop when hamstrings are stretched', 'Drive hips forward to stand'], L);
E('db_rdl', 'Dumbbell Romanian Deadlift', 'hinge', ['Hamstrings', 'Glutes'], ['dumbbell'], 1, 'rdl', 'dumbbell',
  ['Dumbbells in front of thighs', 'Hinge at the hips, back flat', 'Lower to mid-shin', 'Squeeze glutes to stand'], L);
E('kb_deadlift', 'Kettlebell Deadlift', 'hinge', ['Hamstrings', 'Glutes'], ['kettlebell'], 1, 'deadlift', 'kettlebell',
  ['Bell between your feet', 'Hips back, flat back', 'Grip and pull your shoulders down', 'Stand tall, then lower with control'], L);
E('kb_swing', 'Kettlebell Swing', 'hinge', ['Glutes', 'Hamstrings', 'Core'], ['kettlebell'], 2, 'swing', 'kettlebell',
  ['Hike the bell back between your legs', 'Snap hips forward to float the bell', 'Arms are just ropes', 'Bell rises to chest height, no higher'], L);
E('smith_rdl', 'Smith Machine RDL', 'hinge', ['Hamstrings', 'Glutes'], ['smith'], 2, 'rdl', 'smith',
  ['Stand close to the bar', 'Push hips back, slight knee bend', 'Lower to mid-shin', 'Hips forward to stand'], L);
E('cable_pull_through', 'Cable Pull-Through', 'hinge', ['Glutes', 'Hamstrings'], ['cable'], 1, 'rdl', 'cable',
  ['Face away from a low pulley', 'Hinge back, rope between legs', 'Drive hips forward to stand', 'Squeeze glutes at the top'], L);
E('band_good_morning', 'Band Good Morning', 'hinge', ['Hamstrings', 'Glutes', 'Back'], ['bands'], 1, 'rdl', 'band',
  ['Band under feet and behind neck', 'Hinge forward with a flat back', 'Feel the stretch in hamstrings', 'Stand up tall'], L);
E('sl_hinge', 'Single-Leg Hip Hinge', 'hinge', ['Hamstrings', 'Glutes'], [], 2, 'rdl', 'none',
  ['Stand on one leg, soft knee', 'Reach forward as the back leg lifts', 'Keep hips level', 'Return slowly; switch sides'], L);
E('back_extension', 'Back Extension', 'hinge', ['Lower back', 'Glutes'], ['machines'], 1, 'rdl', 'none',
  ['Pad just below your hip bones', 'Lower with a flat back', 'Rise until body is straight', 'Don\'t over-arch at the top'], L);

// ---------- Lunge pattern ----------
E('db_lunge', 'Dumbbell Reverse Lunge', 'lunge', ['Quads', 'Glutes'], ['dumbbell'], 1, 'lunge', 'dumbbell',
  ['Step back into a long stride', 'Lower the back knee toward the floor', 'Front knee over the ankle', 'Push through the front heel'], L);
E('bw_lunge', 'Reverse Lunge', 'lunge', ['Quads', 'Glutes'], [], 1, 'lunge', 'none',
  ['Step back, chest up', 'Both knees bend to about 90°', 'Keep weight in the front heel', 'Alternate legs each rep'], L);
E('bulgarian_split', 'Bulgarian Split Squat', 'lunge', ['Quads', 'Glutes'], ['dumbbell', 'bench'], 2, 'lunge', 'dumbbell',
  ['Rear foot laces-down on a bench', 'Lower straight down', 'Front shin stays fairly vertical', 'Drive up through the front foot'], L);
E('split_squat', 'Split Squat', 'lunge', ['Quads', 'Glutes'], [], 1, 'lunge', 'none',
  ['Stagger your feet, hip-width apart', 'Drop the back knee straight down', 'Stay tall', 'Finish all reps, then switch'], L);
E('smith_split', 'Smith Machine Split Squat', 'lunge', ['Quads', 'Glutes'], ['smith'], 2, 'lunge', 'smith',
  ['Bar on upper back, staggered stance', 'Lower the back knee', 'Keep your torso upright', 'Push through the front heel'], L);
E('db_step_up', 'Dumbbell Step-Up', 'lunge', ['Quads', 'Glutes'], ['dumbbell', 'bench'], 1, 'lunge', 'dumbbell',
  ['Whole foot on the bench', 'Drive through that heel to stand up', 'Don\'t push off the back foot', 'Lower with control'], L);
E('kb_lunge', 'Goblet Reverse Lunge', 'lunge', ['Quads', 'Glutes'], ['kettlebell'], 1, 'lunge', 'kettlebell',
  ['Hold the bell at your chest', 'Step back into a lunge', 'Keep your chest tall', 'Drive back to standing'], L);

// ---------- Horizontal push ----------
E('bb_bench', 'Barbell Bench Press', 'hpush', ['Chest', 'Triceps', 'Shoulders'], ['barbell', 'bench'], 2, 'bench', 'barbell',
  ['Eyes under the bar, feet planted', 'Shoulder blades squeezed together', 'Lower to mid-chest', 'Press up and slightly back'], {});
E('db_bench', 'Dumbbell Bench Press', 'hpush', ['Chest', 'Triceps', 'Shoulders'], ['dumbbell', 'bench'], 1, 'bench', 'dumbbell',
  ['Dumbbells over your chest, palms forward', 'Lower until elbows are just below the bench', 'Elbows about 45° from your body', 'Press up and together'], {});
E('db_incline', 'Incline Dumbbell Press', 'hpush', ['Upper chest', 'Shoulders', 'Triceps'], ['dumbbell', 'bench'], 1, 'incline', 'dumbbell',
  ['Bench at 30–45°', 'Lower to upper chest', 'Keep wrists stacked over elbows', 'Press up without clanking'], {});
E('machine_chest', 'Machine Chest Press', 'hpush', ['Chest', 'Triceps'], ['machines'], 1, 'seated_press', 'handle',
  ['Handles at mid-chest height', 'Back flat against the pad', 'Press out without locking hard', 'Return slowly'], {});
E('smith_bench', 'Smith Machine Bench Press', 'hpush', ['Chest', 'Triceps'], ['smith', 'bench'], 1, 'bench', 'smith',
  ['Bench placed so bar meets mid-chest', 'Shoulder blades pinned back', 'Lower under control', 'Press to full extension'], {});
E('cable_press', 'Standing Cable Chest Press', 'hpush', ['Chest', 'Triceps'], ['cable'], 1, 'press_forward', 'cable',
  ['Pulleys at chest height, staggered stance', 'Brace your core', 'Press handles forward and together', 'Return to a chest stretch'], {});
E('incline_pushup', 'Incline Push-Up', 'hpush', ['Chest', 'Triceps'], [], 1, 'pushup', 'none',
  ['Hands on a bench, counter or wall', 'Body in one straight line', 'Lower your chest to the edge', 'Push away fully'], {});
E('pushup', 'Push-Up', 'hpush', ['Chest', 'Triceps', 'Core'], [], 2, 'pushup', 'none',
  ['Hands just outside shoulders', 'Squeeze glutes, body straight', 'Lower your chest to a fist\'s height', 'Push the floor away'], {});
E('band_press', 'Band Chest Press', 'hpush', ['Chest', 'Triceps'], ['bands'], 1, 'press_forward', 'band',
  ['Band anchored behind you at chest height', 'Staggered stance', 'Press forward until arms are straight', 'Control the return'], {});
E('bb_incline', 'Incline Barbell Press', 'hpush', ['Upper chest', 'Shoulders'], ['barbell', 'bench'], 3, 'incline', 'barbell',
  ['Bench at 30°', 'Lower to just below the collarbone', 'Elbows slightly tucked', 'Press straight up'], {});

// ---------- Vertical push ----------
E('bb_ohp', 'Barbell Overhead Press', 'vpush', ['Shoulders', 'Triceps', 'Core'], ['barbell'], 2, 'ohp', 'barbell',
  ['Bar on front of shoulders, grip just outside', 'Squeeze glutes and brace', 'Press straight up, head moves back then through', 'Lock out overhead'], {});
E('db_ohp', 'Dumbbell Shoulder Press', 'vpush', ['Shoulders', 'Triceps'], ['dumbbell'], 1, 'ohp', 'dumbbell',
  ['Dumbbells at ear height', 'Ribs down, core tight', 'Press up until arms are straight', 'Lower to ear height'], {});
E('machine_shoulder', 'Machine Shoulder Press', 'vpush', ['Shoulders', 'Triceps'], ['machines'], 1, 'ohp', 'handle',
  ['Seat so handles start at shoulder height', 'Back against the pad', 'Press overhead', 'Lower slowly'], {});
E('smith_ohp', 'Smith Machine Shoulder Press', 'vpush', ['Shoulders', 'Triceps'], ['smith'], 1, 'ohp', 'smith',
  ['Sit or stand so bar clears your face', 'Start at chin height', 'Press to full lockout', 'Control the descent'], {});
E('kb_press', 'Kettlebell Overhead Press', 'vpush', ['Shoulders', 'Triceps', 'Core'], ['kettlebell'], 2, 'ohp', 'kettlebell',
  ['Bell rests on the back of your forearm', 'Brace and squeeze glutes', 'Press straight up', 'Return to the rack position'], {});
E('band_ohp', 'Band Overhead Press', 'vpush', ['Shoulders', 'Triceps'], ['bands'], 1, 'ohp', 'band',
  ['Stand on the band', 'Handles at shoulders', 'Press overhead', 'Lower with control'], {});
E('pike_pushup', 'Pike Push-Up', 'vpush', ['Shoulders', 'Triceps'], [], 2, 'pike', 'none',
  ['Hips high, body in an upside-down V', 'Lower the top of your head toward the floor', 'Elbows track back', 'Push back up'], {});

// ---------- Horizontal pull ----------
E('bb_row', 'Barbell Row', 'hpull', ['Upper back', 'Lats', 'Biceps'], ['barbell'], 2, 'row', 'barbell',
  ['Hinge to about 45°, flat back', 'Pull the bar to your lower ribs', 'Squeeze shoulder blades', 'Lower until arms are straight'], {});
E('db_row', 'One-Arm Dumbbell Row', 'hpull', ['Lats', 'Upper back', 'Biceps'], ['dumbbell'], 1, 'row', 'dumbbell',
  ['Support yourself on a bench or your knee', 'Pull the dumbbell to your hip', 'Keep your torso still', 'Full stretch at the bottom'], {});
E('cable_row', 'Seated Cable Row', 'hpull', ['Lats', 'Upper back', 'Biceps'], ['cable'], 1, 'seated_row', 'cable',
  ['Sit tall, knees soft', 'Pull the handle to your belly', 'Squeeze shoulder blades together', 'Let your arms stretch forward'], {});
E('machine_row', 'Chest-Supported Machine Row', 'hpull', ['Upper back', 'Lats'], ['machines'], 1, 'seated_row', 'handle',
  ['Chest against the pad', 'Pull elbows back past your body', 'Pause and squeeze', 'Return slowly'], {});
E('kb_row', 'Kettlebell Row', 'hpull', ['Lats', 'Upper back'], ['kettlebell'], 1, 'row', 'kettlebell',
  ['Hinge forward, flat back', 'Row the bell to your hip', 'Squeeze at the top', 'Lower fully'], {});
E('band_row', 'Band Row', 'hpull', ['Upper back', 'Lats'], ['bands'], 1, 'seated_row', 'band',
  ['Anchor the band at chest height', 'Pull handles to your ribs', 'Squeeze shoulder blades', 'Control the return'], {});
E('smith_row', 'Smith Machine Row', 'hpull', ['Upper back', 'Lats'], ['smith'], 2, 'row', 'smith',
  ['Bar at knee height, hinge forward', 'Pull to lower ribs', 'Keep your back flat', 'Lower to full stretch'], {});
E('inverted_row', 'Inverted Row', 'hpull', ['Upper back', 'Lats', 'Biceps'], ['barbell'], 2, 'seated_row', 'none',
  ['Bar set in a rack at hip height', 'Hang underneath, body straight', 'Pull your chest to the bar', 'Lower all the way'], {});
E('doorway_row', 'Doorway Row', 'hpull', ['Upper back', 'Biceps'], [], 1, 'seated_row', 'none',
  ['Hold both sides of a sturdy door frame', 'Lean back with straight arms', 'Pull your chest toward the frame', 'Lower slowly'], {});

// ---------- Vertical pull ----------
E('lat_pulldown', 'Lat Pulldown', 'vpull', ['Lats', 'Biceps'], ['cable'], 1, 'pulldown', 'cable',
  ['Thighs locked under the pad', 'Grip slightly wider than shoulders', 'Pull the bar to your upper chest', 'Let it rise until arms are straight'], {});
E('pullup', 'Pull-Up', 'vpull', ['Lats', 'Biceps', 'Upper back'], ['pullup_bar'], 3, 'pullup', 'none',
  ['Overhand grip, shoulder-width', 'Start from a dead hang', 'Pull your chest toward the bar', 'Lower all the way down'], {});
E('chinup', 'Chin-Up', 'vpull', ['Lats', 'Biceps'], ['pullup_bar'], 2, 'pullup', 'none',
  ['Palms facing you', 'Squeeze shoulder blades down', 'Chin over the bar', 'Lower with control'], {});
E('assisted_pullup', 'Band-Assisted Pull-Up', 'vpull', ['Lats', 'Biceps'], ['pullup_bar', 'bands'], 1, 'pullup', 'none',
  ['Loop a band over the bar, knee or foot in it', 'Pull chest to the bar', 'Lower slowly', 'Use a lighter band as you get stronger'], {});
E('band_pulldown', 'Band Lat Pulldown', 'vpull', ['Lats'], ['bands'], 1, 'pulldown', 'band',
  ['Anchor the band high', 'Kneel or sit tall', 'Pull elbows down to your sides', 'Return with control'], {});
E('prone_y', 'Prone Y-Raise', 'vpull', ['Upper back', 'Rear delts'], [], 1, 'superman', 'none',
  ['Lie face down, arms in a Y', 'Thumbs up, lift arms off the floor', 'Squeeze shoulder blades down and back', 'Lower slowly'], {});

// ---------- Legs: isolation ----------
E('leg_extension', 'Leg Extension', 'quad_iso', ['Quads'], ['machines'], 1, 'legext', 'pad',
  ['Knee lined up with the machine pivot', 'Straighten your legs fully', 'Squeeze quads for a second', 'Lower slowly'], L);
E('wall_sit', 'Wall Sit', 'quad_iso', ['Quads'], [], 1, 'wallsit', 'none',
  ['Back flat against a wall', 'Slide down until thighs are parallel', 'Knees over ankles', 'Breathe and hold'], { unit: 'sec' });
E('leg_curl', 'Seated Leg Curl', 'ham_iso', ['Hamstrings'], ['machines'], 1, 'legcurl', 'pad',
  ['Pad just above your heels', 'Curl down as far as you can', 'Squeeze for a second', 'Let it rise slowly'], L);
E('band_leg_curl', 'Band Leg Curl', 'ham_iso', ['Hamstrings'], ['bands'], 1, 'legcurl', 'none',
  ['Anchor the band low in front', 'Loop it around your ankle', 'Curl your heel toward your glute', 'Return slowly'], L);
E('db_leg_curl', 'Dumbbell Leg Curl', 'ham_iso', ['Hamstrings'], ['dumbbell', 'bench'], 2, 'legcurl', 'none',
  ['Lie face down on a bench', 'Dumbbell held between your feet', 'Curl heels toward glutes', 'Lower slowly'], L);
E('standing_calf', 'Standing Calf Raise', 'calf', ['Calves'], [], 1, 'calf', 'none',
  ['Balls of feet on a step edge', 'Lower heels for a deep stretch', 'Rise as high as you can', 'Pause at the top'], L);
E('db_calf', 'Dumbbell Calf Raise', 'calf', ['Calves'], ['dumbbell'], 1, 'calf', 'dumbbell',
  ['Hold dumbbells at your sides', 'Rise onto the balls of your feet', 'Pause at the top', 'Lower all the way'], L);
E('smith_calf', 'Smith Machine Calf Raise', 'calf', ['Calves'], ['smith'], 1, 'calf', 'smith',
  ['Bar on your upper back', 'Toes on a plate or step', 'Rise high, pause', 'Full stretch at the bottom'], L);
E('machine_calf', 'Machine Calf Raise', 'calf', ['Calves'], ['machines'], 1, 'calf', 'none',
  ['Shoulders under the pads', 'Heels drop below the platform', 'Drive up onto your toes', 'Pause and lower slowly'], L);

// ---------- Glutes ----------
E('bb_hip_thrust', 'Barbell Hip Thrust', 'glute', ['Glutes', 'Hamstrings'], ['barbell', 'bench'], 2, 'hipthrust', 'barbell',
  ['Upper back on the bench edge, bar over hips', 'Feet flat, shins vertical at the top', 'Drive hips up, chin tucked', 'Squeeze glutes hard at the top'], L);
E('db_hip_thrust', 'Dumbbell Hip Thrust', 'glute', ['Glutes', 'Hamstrings'], ['dumbbell', 'bench'], 1, 'hipthrust', 'dumbbell',
  ['Upper back on the bench', 'Dumbbell on your hips', 'Push through heels to lift', 'Pause at the top'], L);
E('smith_hip_thrust', 'Smith Machine Hip Thrust', 'glute', ['Glutes'], ['smith', 'bench'], 1, 'hipthrust', 'smith',
  ['Bench behind you, bar over hips', 'Unhook and drive up', 'Squeeze at the top', 'Lower under control'], L);
E('glute_bridge', 'Glute Bridge', 'glute', ['Glutes', 'Hamstrings'], [], 1, 'bridge', 'none',
  ['Lie on your back, feet flat', 'Drive through heels', 'Lift hips until body is straight', 'Squeeze and lower slowly'], L);
E('band_bridge', 'Banded Glute Bridge', 'glute', ['Glutes'], ['bands'], 1, 'bridge', 'none',
  ['Mini band just above knees', 'Push knees out against the band', 'Lift hips up', 'Hold one second at the top'], L);
E('cable_kickback', 'Cable Glute Kickback', 'glute', ['Glutes'], ['cable'], 1, 'birddog', 'none',
  ['Ankle strap on a low pulley', 'Hold the frame, slight lean', 'Kick straight back', 'Don\'t arch your lower back'], L);

// ---------- Chest isolation ----------
E('db_fly', 'Dumbbell Fly', 'chest_iso', ['Chest'], ['dumbbell', 'bench'], 1, 'fly', 'dumbbell',
  ['Slight bend in the elbows, locked in', 'Open arms wide in an arc', 'Feel the chest stretch', 'Hug the dumbbells back up'], {});
E('cable_fly', 'Cable Fly', 'chest_iso', ['Chest'], ['cable'], 2, 'cable_fly', 'cable',
  ['Pulleys high, step forward', 'Slight elbow bend', 'Bring hands together in front', 'Return slowly to a stretch'], {});
E('pec_deck', 'Pec Deck', 'chest_iso', ['Chest'], ['machines'], 1, 'cable_fly', 'handle',
  ['Handles at chest height', 'Back against the pad', 'Squeeze arms together', 'Open slowly'], {});
E('band_fly', 'Band Fly', 'chest_iso', ['Chest'], ['bands'], 1, 'cable_fly', 'band',
  ['Anchor band behind you', 'Arms wide, slight bend', 'Bring hands together', 'Control the return'], {});

// ---------- Shoulders ----------
E('db_lateral', 'Dumbbell Lateral Raise', 'side_delt', ['Side delts'], ['dumbbell'], 1, 'raise', 'dumbbell',
  ['Slight lean forward, soft elbows', 'Raise arms out to the sides', 'Stop at shoulder height', 'Lower slowly, no swinging'], {});
E('cable_lateral', 'Cable Lateral Raise', 'side_delt', ['Side delts'], ['cable'], 1, 'raise', 'cable',
  ['Low pulley, cable across your body', 'Raise your arm out to the side', 'Lead with the elbow', 'Lower under control'], {});
E('band_lateral', 'Band Lateral Raise', 'side_delt', ['Side delts'], ['bands'], 1, 'raise', 'band',
  ['Stand on the band', 'Raise arms out to the sides', 'Stop at shoulder height', 'Lower slowly'], {});
E('machine_lateral', 'Machine Lateral Raise', 'side_delt', ['Side delts'], ['machines'], 1, 'raise', 'handle',
  ['Pads on the outside of your arms', 'Raise to shoulder height', 'Pause', 'Lower slowly'], {});
E('face_pull', 'Face Pull', 'rear_delt', ['Rear delts', 'Upper back'], ['cable'], 1, 'facepull', 'cable',
  ['Rope at upper-chest height', 'Pull toward your face, elbows high', 'Hands finish beside your ears', 'Return slowly'], {});
E('db_rear_fly', 'Dumbbell Rear Delt Fly', 'rear_delt', ['Rear delts'], ['dumbbell'], 1, 'row', 'dumbbell',
  ['Hinge forward, flat back', 'Raise arms out to the sides', 'Squeeze shoulder blades', 'Lower slowly'], {});
E('band_pull_apart', 'Band Pull-Apart', 'rear_delt', ['Rear delts', 'Upper back'], ['bands'], 1, 'facepull', 'band',
  ['Hold the band at shoulder height', 'Pull it apart to your chest', 'Squeeze shoulder blades', 'Return slowly'], {});
E('reverse_pec_deck', 'Reverse Pec Deck', 'rear_delt', ['Rear delts'], ['machines'], 1, 'facepull', 'handle',
  ['Face the pad', 'Arms straight, open wide', 'Squeeze shoulder blades', 'Return slowly'], {});

// ---------- Arms ----------
E('db_curl', 'Dumbbell Curl', 'biceps', ['Biceps'], ['dumbbell'], 1, 'curl', 'dumbbell',
  ['Elbows pinned to your sides', 'Curl up, turning palms up', 'Squeeze at the top', 'Lower all the way'], {});
E('bb_curl', 'Barbell Curl', 'biceps', ['Biceps'], ['barbell'], 1, 'curl', 'barbell',
  ['Shoulder-width underhand grip', 'Elbows stay still', 'Curl to your chest', 'Lower slowly without swinging'], {});
E('cable_curl', 'Cable Curl', 'biceps', ['Biceps'], ['cable'], 1, 'curl', 'cable',
  ['Low pulley, straight bar or rope', 'Elbows at your sides', 'Curl up and squeeze', 'Control the way down'], {});
E('hammer_curl', 'Hammer Curl', 'biceps', ['Biceps', 'Forearms'], ['dumbbell'], 1, 'curl', 'dumbbell',
  ['Palms face each other', 'Curl up without swinging', 'Squeeze at the top', 'Lower slowly'], {});
E('band_curl', 'Band Curl', 'biceps', ['Biceps'], ['bands'], 1, 'curl', 'band',
  ['Stand on the band', 'Elbows at your sides', 'Curl up', 'Lower with control'], {});
E('kb_curl', 'Kettlebell Curl', 'biceps', ['Biceps'], ['kettlebell'], 1, 'curl', 'kettlebell',
  ['Hold the bell by the horns', 'Elbows tucked', 'Curl to your chest', 'Lower slowly'], {});
E('cable_pushdown', 'Cable Triceps Pushdown', 'triceps', ['Triceps'], ['cable'], 1, 'pushdown', 'cable',
  ['High pulley, elbows at your sides', 'Push down until arms are straight', 'Squeeze triceps', 'Let it rise to 90°'], {});
E('db_overhead_ext', 'Overhead Dumbbell Extension', 'triceps', ['Triceps'], ['dumbbell'], 1, 'ohext', 'dumbbell',
  ['Hold one dumbbell overhead with both hands', 'Lower it behind your head', 'Keep elbows pointing up', 'Extend back to the top'], {});
E('skullcrusher', 'Skull Crusher', 'triceps', ['Triceps'], ['barbell', 'bench'], 2, 'skull', 'barbell',
  ['Lie on a bench, bar over your shoulders', 'Bend elbows to lower the bar behind your head', 'Upper arms stay still', 'Extend back up'], {});
E('dips', 'Dip', 'triceps', ['Triceps', 'Chest'], ['machines'], 2, 'dip', 'none',
  ['Grip the bars, arms straight', 'Lower until elbows reach 90°', 'Slight forward lean', 'Press back up'], {});
E('bench_dip', 'Bench Dip', 'triceps', ['Triceps'], ['bench'], 1, 'dip', 'none',
  ['Hands on the bench edge behind you', 'Lower by bending your elbows', 'Keep hips close to the bench', 'Press back up'], {});
E('band_pushdown', 'Band Triceps Pushdown', 'triceps', ['Triceps'], ['bands'], 1, 'pushdown', 'band',
  ['Anchor the band high', 'Elbows at your sides', 'Push down to straight arms', 'Return slowly'], {});
E('diamond_pushup', 'Close-Grip Push-Up', 'triceps', ['Triceps', 'Chest'], [], 2, 'pushup', 'none',
  ['Hands close under your chest', 'Elbows brush your sides', 'Lower your chest to your hands', 'Push up fully'], {});
E('close_grip_bench', 'Close-Grip Bench Press', 'triceps', ['Triceps', 'Chest'], ['barbell', 'bench'], 2, 'bench', 'barbell',
  ['Grip at shoulder width', 'Elbows tucked close', 'Lower to lower chest', 'Press up'], {});

// ---------- Core ----------
E('plank', 'Plank', 'core', ['Core'], [], 1, 'plank', 'none',
  ['Forearms under shoulders', 'Body straight from head to heels', 'Squeeze glutes and brace', 'Breathe steadily'], { unit: 'sec' });
E('dead_bug', 'Dead Bug', 'core', ['Core'], [], 1, 'deadbug', 'none',
  ['Lie on your back, arms up, knees at 90°', 'Press your lower back into the floor', 'Extend opposite arm and leg', 'Return and switch sides'], {});
E('crunch', 'Crunch', 'core', ['Abs'], [], 1, 'crunch', 'none',
  ['Knees bent, feet flat', 'Curl shoulders off the floor', 'Exhale as you rise', 'Lower slowly'], {});
E('hanging_knee_raise', 'Hanging Knee Raise', 'core', ['Abs', 'Hip flexors'], ['pullup_bar'], 2, 'hangraise', 'none',
  ['Hang from the bar, shoulders engaged', 'Raise knees toward your chest', 'Avoid swinging', 'Lower slowly'], {});
E('cable_crunch', 'Cable Crunch', 'core', ['Abs'], ['cable'], 2, 'crunch', 'none',
  ['Kneel facing a high pulley, rope at your head', 'Crunch your ribs toward your hips', 'Hips stay still', 'Return slowly'], {});
E('side_plank', 'Side Plank', 'core', ['Obliques'], [], 1, 'plank', 'none',
  ['Elbow under shoulder', 'Lift hips into a straight line', 'Stack your feet', 'Hold; switch sides'], { unit: 'sec' });
E('pallof_press', 'Pallof Press', 'core', ['Core', 'Obliques'], ['cable'], 1, 'press_forward', 'cable',
  ['Stand side-on to the cable at chest height', 'Press the handle straight out', 'Resist the twist', 'Bring it back to your chest'], {});
E('band_pallof', 'Band Pallof Press', 'core', ['Core', 'Obliques'], ['bands'], 1, 'press_forward', 'band',
  ['Band anchored to your side', 'Press straight out', 'Don\'t let it rotate you', 'Return to chest'], {});
E('mountain_climber', 'Mountain Climbers', 'core', ['Core', 'Cardio'], [], 1, 'climber', 'none',
  ['Start in a high plank', 'Drive one knee toward your chest', 'Switch legs quickly', 'Keep hips level'], { unit: 'sec' });
E('bird_dog', 'Bird Dog', 'core', ['Core', 'Lower back'], [], 1, 'birddog', 'none',
  ['Hands under shoulders, knees under hips', 'Reach opposite arm and leg long', 'Keep hips level', 'Return and switch'], {});

// ---------- Cardio ----------
E('incline_walk', 'Incline Treadmill Walk', 'cardio', ['Cardio'], ['treadmill'], 1, 'walk', 'treadmill',
  ['Set incline to 6–12%', 'Brisk pace you can talk at', 'Don\'t hold the rails', 'Stand tall'], { unit: 'min' });
E('treadmill_run', 'Treadmill Run', 'cardio', ['Cardio'], ['treadmill'], 2, 'run', 'treadmill',
  ['Start with a 5-minute walk', 'Run at a conversational pace', 'Short, quick steps', 'Cool down walking'], { unit: 'min' });
E('bike', 'Stationary Bike', 'cardio', ['Cardio', 'Quads'], ['bike'], 1, 'bike', 'none',
  ['Seat at hip height when standing', 'Slight knee bend at the bottom', 'Steady cadence', 'Add resistance to make it harder'], { unit: 'min' });
E('rower', 'Rowing Machine', 'cardio', ['Cardio', 'Back', 'Legs'], ['rower'], 2, 'rowmachine', 'none',
  ['Order: legs, then hips, then arms', 'Return: arms, hips, then legs', 'Keep your back tall', 'Smooth, powerful strokes'], { unit: 'min' });
E('elliptical', 'Elliptical', 'cardio', ['Cardio'], ['elliptical'], 1, 'walk', 'none',
  ['Stand tall, light grip on the handles', 'Push and pull with arms and legs', 'Steady pace', 'Raise resistance gradually'], { unit: 'min' });
E('stair_climber', 'Stair Climber', 'cardio', ['Cardio', 'Glutes'], ['stair'], 2, 'stairs', 'none',
  ['Whole foot on each step', 'Light hands on the rails', 'Stand tall, don\'t lean', 'Steady pace'], { unit: 'min' });
E('jump_rope', 'Jump Rope', 'cardio', ['Cardio', 'Calves'], ['jumprope'], 2, 'jumprope', 'none',
  ['Elbows close, turn with your wrists', 'Small hops on the balls of your feet', 'Stay relaxed', 'Rest when you trip; keep going'], { unit: 'min' });
E('brisk_walk', 'Brisk Walk', 'cardio', ['Cardio'], [], 1, 'walk', 'none',
  ['Walk fast enough to breathe harder', 'Swing your arms', 'Stand tall', 'Outdoors or indoors'], { unit: 'min' });
E('easy_run', 'Easy Run', 'cardio', ['Cardio'], [], 2, 'run', 'none',
  ['Conversational pace', 'Land under your hips', 'Relax shoulders', 'Walk breaks are fine'], { unit: 'min' });
E('jump_squat', 'Jump Squat', 'cardio', ['Quads', 'Cardio'], [], 2, 'jumpsquat', 'none',
  ['Squat down, arms back', 'Explode up, swing arms', 'Land softly, knees bent', 'Reset and repeat'], { unit: 'sec' });

// =====================================================================
// Expanded library (v1.3). Coverage checked against the major muscle groups in
// Muscle & Strength's exercise database; all form cues are written for Groundwork.
// =====================================================================

// ---------- Chest: presses ----------
E('decline_bench', 'Decline Barbell Bench Press', 'hpush', ['Lower chest', 'Triceps'], ['barbell', 'bench'], 2, 'bench', 'barbell',
  ['Hook your feet in and lie back on the decline', 'Unrack with straight arms over your chest', 'Lower to the bottom of your chest', 'Press up in a slight arc'], {});
E('db_decline', 'Decline Dumbbell Press', 'hpush', ['Lower chest', 'Triceps'], ['dumbbell', 'bench'], 2, 'bench', 'dumbbell',
  ['Secure your legs on the decline bench', 'Start with dumbbells over your lower chest', 'Lower until elbows are just below the bench', 'Press up and slightly together'], {});
E('neutral_db_press', 'Neutral-Grip Dumbbell Press', 'hpush', ['Chest', 'Triceps'], ['dumbbell', 'bench'], 1, 'bench', 'dumbbell',
  ['Palms face each other the whole set', 'Elbows stay close, about 30° from your body', 'Lower to the sides of your chest', 'Easy on the shoulders; great for beginners'], {});
E('db_floor_press', 'Dumbbell Floor Press', 'hpush', ['Chest', 'Triceps'], ['dumbbell'], 1, 'floorpress', 'dumbbell',
  ['Lie on the floor, knees bent', 'Lower until your upper arms touch the floor', 'Pause briefly, no bouncing', 'Press back up over your chest'], {});
E('smith_incline', 'Smith Machine Incline Press', 'hpush', ['Upper chest', 'Shoulders'], ['smith', 'bench'], 2, 'incline', 'smith',
  ['Set the bench at 30° under the bar', 'Bar touches just below your collarbone', 'Keep shoulder blades squeezed', 'Press to straight arms'], {});
E('machine_incline', 'Incline Machine Press', 'hpush', ['Upper chest', 'Triceps'], ['machines'], 1, 'seated_press', 'handle',
  ['Seat so handles line up with upper chest', 'Press up and out', 'Don\'t let shoulders roll forward', 'Return slowly'], {});
E('decline_pushup', 'Decline Push-Up', 'hpush', ['Upper chest', 'Shoulders', 'Triceps'], ['bench'], 2, 'pushup', 'none',
  ['Feet on a bench, hands on the floor', 'Body in one straight line', 'Lower your chest toward the floor', 'Push all the way up'], {});
E('wall_pushup', 'Wall Push-Up', 'hpush', ['Chest', 'Triceps'], [], 1, 'pushup', 'none',
  ['Hands on a wall at chest height', 'Step back so you lean in', 'Bend elbows to bring your chest to the wall', 'Push back; step farther away to make it harder'], {});
E('squeeze_press', 'Dumbbell Squeeze Press', 'hpush', ['Inner chest', 'Triceps'], ['dumbbell', 'bench'], 1, 'bench', 'dumbbell',
  ['Press the dumbbells together hard', 'Keep them touching the whole rep', 'Lower to mid-chest', 'Press up while still squeezing'], {});
E('chest_dip', 'Chest Dip', 'hpush', ['Lower chest', 'Triceps'], ['machines'], 2, 'dip', 'none',
  ['Lean your torso forward about 30°', 'Let elbows flare slightly', 'Lower until you feel a chest stretch', 'Press up without locking out hard'], {});

// ---------- Chest: flys and pullovers ----------
E('incline_db_fly', 'Incline Dumbbell Fly', 'chest_iso', ['Upper chest'], ['dumbbell', 'bench'], 1, 'fly', 'dumbbell',
  ['Bench at 30°', 'Slight bend in elbows, locked in place', 'Open wide until you feel a stretch', 'Bring the dumbbells up and together'], {});
E('low_high_fly', 'Low-to-High Cable Fly', 'chest_iso', ['Upper chest'], ['cable'], 2, 'cable_fly', 'cable',
  ['Pulleys set low, staggered stance', 'Sweep hands up and together to chin height', 'Squeeze for a second', 'Lower slowly'], {});
E('high_low_fly', 'High-to-Low Cable Fly', 'chest_iso', ['Lower chest'], ['cable'], 2, 'cable_fly', 'cable',
  ['Pulleys set high, lean slightly forward', 'Sweep hands down and together at your waist', 'Keep elbows softly bent', 'Return under control'], {});
E('db_pullover', 'Dumbbell Pullover', 'chest_iso', ['Chest', 'Lats'], ['dumbbell', 'bench'], 2, 'pullover', 'dumbbell',
  ['Hold one dumbbell over your chest with both hands', 'Lower it back behind your head in an arc', 'Keep a slight elbow bend', 'Pull it back over your chest'], {});

// ---------- Shoulders ----------
E('arnold_press', 'Arnold Press', 'vpush', ['Shoulders', 'Triceps'], ['dumbbell'], 2, 'ohp', 'dumbbell',
  ['Start with palms facing you at chin height', 'Rotate palms forward as you press up', 'Finish with arms straight overhead', 'Reverse the turn on the way down'], {});
E('seated_db_press', 'Seated Dumbbell Shoulder Press', 'vpush', ['Shoulders', 'Triceps'], ['dumbbell', 'bench'], 1, 'ohp', 'dumbbell',
  ['Bench upright, back against the pad', 'Dumbbells start at ear height', 'Press up without arching', 'Lower to ear height'], {});
E('seated_bb_press', 'Seated Barbell Shoulder Press', 'vpush', ['Shoulders', 'Triceps'], ['barbell', 'bench'], 2, 'ohp', 'barbell',
  ['Sit upright with the bar at your upper chest', 'Grip just outside shoulders', 'Press straight up, moving your head back', 'Lower to chin height'], {});
E('landmine_press', 'Half-Kneeling Landmine Press', 'vpush', ['Shoulders', 'Upper chest', 'Core'], ['barbell'], 2, 'ohp', 'barbell',
  ['Wedge one end of a barbell in a corner', 'Kneel on the same side as the working arm', 'Press up and forward', 'Shoulder-friendly; keep ribs down'], {});
E('seated_lateral', 'Seated Dumbbell Lateral Raise', 'side_delt', ['Side delts'], ['dumbbell', 'bench'], 1, 'raise', 'dumbbell',
  ['Sit tall at the end of a bench', 'Raise arms out to shoulder height', 'Lead with your elbows', 'Lower slowly; no swinging'], {});
E('db_front_raise', 'Dumbbell Front Raise', 'side_delt', ['Front delts'], ['dumbbell'], 1, 'raise', 'dumbbell',
  ['Dumbbells in front of thighs', 'Raise straight in front to shoulder height', 'Keep a soft elbow bend', 'Lower with control'], {});
E('plate_front_raise', 'Plate Front Raise', 'side_delt', ['Front delts'], ['barbell'], 1, 'raise', 'barbell',
  ['Hold a weight plate at 3 and 9 o\'clock', 'Raise it to eye level', 'Keep your torso still', 'Lower slowly'], {});
E('cable_upright_row', 'Cable Upright Row', 'side_delt', ['Side delts', 'Traps'], ['cable'], 2, 'upright_row', 'cable',
  ['Straight bar on a low pulley, shoulder-width grip', 'Pull up along your body, elbows leading', 'Stop when elbows reach shoulder height', 'Lower slowly'], {});
E('db_upright_row', 'Dumbbell Upright Row', 'side_delt', ['Side delts', 'Traps'], ['dumbbell'], 2, 'upright_row', 'dumbbell',
  ['Dumbbells in front of thighs', 'Pull elbows up and out', 'Stop at shoulder height', 'Wider hands are kinder to shoulders'], {});
E('bb_upright_row', 'Barbell Upright Row', 'side_delt', ['Side delts', 'Traps'], ['barbell'], 2, 'upright_row', 'barbell',
  ['Grip a little wider than shoulders', 'Pull the bar up close to your body', 'Elbows go no higher than shoulders', 'Lower to full arm extension'], {});
E('cable_rear_fly', 'Cable Reverse Fly', 'rear_delt', ['Rear delts', 'Upper back'], ['cable'], 1, 'facepull', 'cable',
  ['Cross the cables at shoulder height', 'Pull your arms wide and back', 'Squeeze your shoulder blades', 'Return slowly'], {});
E('incline_rear_fly', 'Chest-Supported Rear Delt Fly', 'rear_delt', ['Rear delts'], ['dumbbell', 'bench'], 1, 'row', 'dumbbell',
  ['Lie chest-down on an incline bench', 'Arms hang straight down', 'Raise arms out to the sides', 'Pause, then lower'], {});
E('wall_slide', 'Scapular Wall Slide', 'rear_delt', ['Upper back', 'Shoulders'], [], 1, 'ohp', 'none',
  ['Back, head and arms against a wall', 'Arms in a W shape', 'Slide up to a Y while staying in contact', 'Slide back down slowly'], {});

// ---------- Back: rows ----------
E('bent_db_row', 'Bent-Over Dumbbell Row', 'hpull', ['Upper back', 'Lats', 'Biceps'], ['dumbbell'], 1, 'row', 'dumbbell',
  ['Hinge forward with a flat back', 'Row both dumbbells to your hips', 'Squeeze shoulder blades together', 'Lower until arms are straight'], {});
E('pendlay_row', 'Pendlay Row', 'hpull', ['Upper back', 'Lats'], ['barbell'], 3, 'row', 'barbell',
  ['Torso nearly parallel to the floor', 'Bar starts on the floor each rep', 'Pull explosively to your lower chest', 'Set it down and reset'], {});
E('tbar_row', 'T-Bar Row', 'hpull', ['Upper back', 'Lats'], ['barbell'], 2, 'row', 'barbell',
  ['Straddle a landmined barbell with a V-handle', 'Hinge to about 45°', 'Pull the handle to your chest', 'Lower with control'], {});
E('machine_tbar', 'Machine T-Bar Row', 'hpull', ['Upper back', 'Lats'], ['machines'], 1, 'row', 'none',
  ['Chest on the pad, feet planted', 'Pull handles to your chest', 'Squeeze for a second', 'Let your arms stretch forward'], {});
E('cs_db_row', 'Chest-Supported Dumbbell Row', 'hpull', ['Upper back', 'Lats'], ['dumbbell', 'bench'], 1, 'row', 'dumbbell',
  ['Lie chest-down on an incline bench', 'Row both dumbbells up', 'No momentum: the bench holds you still', 'Lower to full stretch'], {});
E('meadows_row', 'Meadows Row', 'hpull', ['Lats', 'Upper back'], ['barbell'], 3, 'row', 'barbell',
  ['Stand side-on to a landmined bar', 'Grip the bar sleeve overhand', 'Row up and back toward your hip', 'Lower until your arm is straight'], {});
E('one_arm_cable_row', 'Single-Arm Cable Row', 'hpull', ['Lats', 'Upper back'], ['cable'], 1, 'seated_row', 'cable',
  ['Sit tall with one handle', 'Pull your elbow back past your ribs', 'Let your shoulder reach forward on the return', 'Finish all reps, then switch'], {});
E('renegade_row', 'Renegade Row', 'hpull', ['Lats', 'Core'], ['dumbbell'], 3, 'pushup', 'dumbbell',
  ['High plank on two dumbbells, feet wide', 'Row one dumbbell to your hip', 'Keep hips level and square', 'Alternate sides'], {});

// ---------- Back: vertical pulls ----------
E('wide_pullup', 'Wide-Grip Pull-Up', 'vpull', ['Lats', 'Upper back'], ['pullup_bar'], 3, 'pullup', 'none',
  ['Grip well outside shoulder width', 'Pull your chest toward the bar', 'Elbows drive down and back', 'Lower all the way'], {});
E('close_pulldown', 'Close-Grip Lat Pulldown', 'vpull', ['Lats', 'Biceps'], ['cable'], 1, 'pulldown', 'cable',
  ['V-handle or close grip', 'Lean back slightly', 'Pull to your upper chest', 'Stretch fully at the top'], {});
E('underhand_pulldown', 'Underhand Lat Pulldown', 'vpull', ['Lats', 'Biceps'], ['cable'], 1, 'pulldown', 'cable',
  ['Palms facing you, shoulder-width', 'Pull the bar to your collarbone', 'Squeeze lats at the bottom', 'Control the bar up'], {});
E('straight_arm_pulldown', 'Straight-Arm Pulldown', 'vpull', ['Lats'], ['cable'], 1, 'straightarm', 'cable',
  ['Face a high pulley, slight hip hinge', 'Arms nearly straight', 'Sweep the bar down to your thighs', 'Let it rise slowly overhead'], {});
E('pullup_negative', 'Pull-Up Negative', 'vpull', ['Lats', 'Biceps'], ['pullup_bar'], 2, 'pullup', 'none',
  ['Jump or step up so your chin is over the bar', 'Lower yourself as slowly as you can', 'Aim for 3–5 seconds down', 'Builds strength toward a full pull-up'], {});

// ---------- Traps ----------
E('db_shrug', 'Dumbbell Shrug', 'shrug', ['Traps'], ['dumbbell'], 1, 'shrug', 'dumbbell',
  ['Stand tall, dumbbells at your sides', 'Lift shoulders straight up to your ears', 'Hold for a second', 'Lower all the way; don\'t roll'], {});
E('bb_shrug', 'Barbell Shrug', 'shrug', ['Traps'], ['barbell'], 1, 'shrug', 'barbell',
  ['Hold the bar at your thighs, shoulder-width', 'Shrug straight up', 'Pause at the top', 'Lower slowly'], {});
E('cable_shrug', 'Cable Shrug', 'shrug', ['Traps'], ['cable'], 1, 'shrug', 'cable',
  ['Straight bar on a low pulley', 'Arms straight, shrug up', 'Squeeze at the top', 'Controlled lowering'], {});
E('smith_shrug', 'Smith Machine Shrug', 'shrug', ['Traps'], ['smith'], 1, 'shrug', 'smith',
  ['Bar at mid-thigh height', 'Shrug straight up along the rails', 'Pause at the top', 'Lower fully'], {});
E('high_pull', 'Barbell High Pull', 'shrug', ['Traps', 'Shoulders', 'Hamstrings'], ['barbell'], 3, 'upright_row', 'barbell',
  ['Start in a hinge with the bar at your knees', 'Drive hips forward explosively', 'Pull the bar to your chest, elbows high', 'Lower under control'], {});
E('kb_high_pull', 'Kettlebell Sumo High Pull', 'shrug', ['Traps', 'Glutes', 'Shoulders'], ['kettlebell'], 2, 'upright_row', 'kettlebell',
  ['Wide stance, bell between your feet', 'Stand up explosively', 'Pull the bell to chest height, elbows high', 'Lower and repeat'], {});

// ---------- Biceps ----------
E('incline_db_curl', 'Incline Dumbbell Curl', 'biceps', ['Biceps'], ['dumbbell', 'bench'], 2, 'curl', 'dumbbell',
  ['Bench at 45–60°, arms hanging straight', 'Curl without moving your upper arms', 'Squeeze at the top', 'Lower to a full stretch'], {});
E('concentration_curl', 'Concentration Curl', 'biceps', ['Biceps'], ['dumbbell'], 1, 'preacher', 'dumbbell',
  ['Sit, elbow braced on your inner thigh', 'Curl the dumbbell toward your shoulder', 'Turn your pinky up at the top', 'Lower slowly'], {});
E('ez_preacher', 'EZ-Bar Preacher Curl', 'biceps', ['Biceps'], ['barbell', 'machines'], 1, 'preacher', 'barbell',
  ['Armpits snug over the top of the pad', 'Curl up until forearms are vertical', 'Lower until arms are almost straight', 'No bouncing at the bottom'], {});
E('db_preacher', 'Dumbbell Preacher Curl', 'biceps', ['Biceps'], ['dumbbell', 'bench'], 1, 'preacher', 'dumbbell',
  ['Rest your upper arm on an incline bench back', 'Curl the dumbbell up', 'Squeeze at the top', 'Lower slowly'], {});
E('zottman_curl', 'Zottman Curl', 'biceps', ['Biceps', 'Forearms'], ['dumbbell'], 2, 'curl', 'dumbbell',
  ['Curl up with palms facing up', 'Turn palms down at the top', 'Lower slowly palms-down', 'Turn back at the bottom'], {});
E('rope_hammer_curl', 'Rope Hammer Curl', 'biceps', ['Biceps', 'Forearms'], ['cable'], 1, 'curl', 'cable',
  ['Rope on a low pulley, thumbs up', 'Elbows pinned to your sides', 'Curl to your chest', 'Lower under control'], {});
E('spider_curl', 'Spider Curl', 'biceps', ['Biceps'], ['dumbbell', 'bench'], 2, 'preacher', 'dumbbell',
  ['Lie chest-down on an incline bench', 'Arms hang straight down', 'Curl up without swinging', 'Squeeze hard at the top'], {});
E('cross_hammer_curl', 'Cross-Body Hammer Curl', 'biceps', ['Biceps', 'Forearms'], ['dumbbell'], 1, 'curl', 'dumbbell',
  ['Thumbs up, dumbbells at your sides', 'Curl across your body toward the opposite shoulder', 'Lower and alternate', 'Keep your torso still'], {});
E('machine_curl', 'Machine Biceps Curl', 'biceps', ['Biceps'], ['machines'], 1, 'preacher', 'handle',
  ['Elbows lined up with the machine pivot', 'Curl to the top', 'Pause and squeeze', 'Lower slowly'], {});
E('reverse_curl', 'Reverse-Grip Barbell Curl', 'biceps', ['Forearms', 'Biceps'], ['barbell'], 1, 'curl', 'barbell',
  ['Overhand grip, shoulder-width', 'Curl without moving your elbows', 'Keep wrists straight', 'Lower slowly'], {});

// ---------- Triceps ----------
E('rope_pushdown', 'Rope Triceps Pushdown', 'triceps', ['Triceps'], ['cable'], 1, 'pushdown', 'cable',
  ['Rope on a high pulley', 'Elbows pinned to your sides', 'Push down and spread the rope at the bottom', 'Let it rise to 90°'], {});
E('overhead_cable_ext', 'Overhead Cable Triceps Extension', 'triceps', ['Triceps'], ['cable'], 1, 'ohext', 'cable',
  ['Face away from the pulley, rope behind your head', 'Elbows point forward and stay still', 'Extend arms fully', 'Return to a deep stretch'], {});
E('db_kickback', 'Dumbbell Triceps Kickback', 'triceps', ['Triceps'], ['dumbbell'], 1, 'kickback', 'dumbbell',
  ['Hinge forward, upper arm parallel to the floor', 'Straighten your arm back', 'Squeeze for a second', 'Bend back to 90° only'], {});
E('lying_db_ext', 'Lying Dumbbell Triceps Extension', 'triceps', ['Triceps'], ['dumbbell', 'bench'], 1, 'skull', 'dumbbell',
  ['Lie on a bench, dumbbells over your shoulders', 'Bend elbows to lower beside your head', 'Upper arms stay still', 'Extend back up'], {});
E('tate_press', 'Tate Press', 'triceps', ['Triceps'], ['dumbbell', 'bench'], 2, 'skull', 'dumbbell',
  ['Dumbbells over your chest, palms facing your feet', 'Bend elbows out to the sides', 'Lower the dumbbells to your chest', 'Press back up with your triceps'], {});
E('machine_tricep', 'Machine Triceps Extension', 'triceps', ['Triceps'], ['machines'], 1, 'pushdown', 'handle',
  ['Elbows on the pad, aligned with the pivot', 'Extend fully', 'Squeeze at the bottom', 'Return slowly'], {});
E('seated_db_ext', 'Seated Overhead Dumbbell Extension', 'triceps', ['Triceps'], ['dumbbell', 'bench'], 1, 'ohext', 'dumbbell',
  ['Sit upright, one dumbbell overhead in both hands', 'Lower it behind your head', 'Keep elbows pointing up', 'Extend back to the top'], {});
E('reverse_pushdown', 'Reverse-Grip Pushdown', 'triceps', ['Triceps'], ['cable'], 1, 'pushdown', 'cable',
  ['Underhand grip on a straight bar', 'Elbows tight to your sides', 'Push down to straight arms', 'Lighter weight than a normal pushdown'], {});

// ---------- Forearms & grip ----------
E('wrist_curl', 'Dumbbell Wrist Curl', 'forearm', ['Forearms'], ['dumbbell', 'bench'], 1, 'wristcurl', 'dumbbell',
  ['Forearms on your thighs or a bench, palms up', 'Let the dumbbell roll to your fingertips', 'Curl your wrists up', 'Lower slowly'], {});
E('reverse_wrist_curl', 'Reverse Wrist Curl', 'forearm', ['Forearms'], ['dumbbell', 'bench'], 1, 'wristcurl', 'dumbbell',
  ['Forearms supported, palms down', 'Lift the backs of your hands up', 'Small, controlled range', 'Lower slowly'], {});
E('bb_wrist_curl', 'Barbell Wrist Curl', 'forearm', ['Forearms'], ['barbell', 'bench'], 1, 'wristcurl', 'barbell',
  ['Kneel behind a bench, forearms on it, palms up', 'Wrists hang off the edge', 'Curl the bar up', 'Lower to a stretch'], {});
E('farmer_carry', 'Farmer\'s Carry', 'forearm', ['Grip', 'Traps', 'Core'], ['dumbbell'], 1, 'carry', 'dumbbell',
  ['Pick up heavy dumbbells, one in each hand', 'Stand tall, shoulders back', 'Walk with short, steady steps', 'Set them down before your grip fails'], { unit: 'sec' });
E('kb_carry', 'Kettlebell Farmer\'s Carry', 'forearm', ['Grip', 'Traps', 'Core'], ['kettlebell'], 1, 'carry', 'kettlebell',
  ['A kettlebell in each hand', 'Ribs down, chest up', 'Walk without letting the bells swing', 'Turn around with small steps'], { unit: 'sec' });
E('dead_hang', 'Dead Hang', 'forearm', ['Grip', 'Lats'], ['pullup_bar'], 1, 'hang', 'none',
  ['Grip the bar shoulder-width', 'Hang with arms straight and relaxed', 'Breathe steadily', 'Builds grip and toward pull-ups'], { unit: 'sec' });

// ---------- Legs: squats & lunges ----------
E('db_squat', 'Dumbbell Squat', 'squat', ['Quads', 'Glutes'], ['dumbbell'], 1, 'squat', 'dumbbell',
  ['Dumbbells at your sides or on shoulders', 'Sit down and back, chest up', 'Thighs to at least parallel', 'Drive through your whole foot'], L);
E('hack_squat', 'Hack Squat Machine', 'squat', ['Quads', 'Glutes'], ['machines'], 2, 'squat', 'none',
  ['Back flat against the pad, shoulders under the pads', 'Feet shoulder-width, mid-platform', 'Lower until knees reach 90° or deeper', 'Press up without locking knees'], L);
E('box_squat', 'Box Squat', 'squat', ['Quads', 'Glutes', 'Hamstrings'], ['barbell', 'bench'], 2, 'squat', 'barbell',
  ['Set a box or bench at knee height behind you', 'Sit back until you touch the box', 'Stay tight; don\'t relax on it', 'Drive up hard'], L);
E('prisoner_squat', 'Prisoner Squat', 'squat', ['Quads', 'Glutes'], [], 1, 'squat', 'none',
  ['Hands behind your head, elbows wide', 'Chest stays proud', 'Squat to parallel', 'Stand up and squeeze glutes'], L);
E('sumo_squat', 'Sumo Squat', 'squat', ['Quads', 'Inner thighs', 'Glutes'], ['dumbbell'], 1, 'squat', 'dumbbell',
  ['Wide stance, toes turned out', 'Hold one dumbbell between your legs', 'Sit straight down, knees out', 'Stand tall'], L);
E('walking_lunge', 'Dumbbell Walking Lunge', 'lunge', ['Quads', 'Glutes'], ['dumbbell'], 2, 'lunge', 'dumbbell',
  ['Dumbbells at your sides', 'Step forward into a lunge', 'Push through the front heel to step through', 'Keep your torso upright'], L);
E('bw_walking_lunge', 'Walking Lunge', 'lunge', ['Quads', 'Glutes'], [], 1, 'lunge', 'none',
  ['Step forward with a long stride', 'Lower the back knee toward the floor', 'Bring the back foot through to the next step', 'Keep steps steady'], L);
E('lateral_lunge', 'Lateral Lunge', 'lunge', ['Quads', 'Glutes', 'Inner thighs'], [], 1, 'lunge', 'none',
  ['Step wide to one side', 'Sit back into that hip, other leg straight', 'Push off to return', 'Alternate sides'], L);
E('db_lateral_lunge', 'Dumbbell Lateral Lunge', 'lunge', ['Quads', 'Glutes', 'Inner thighs'], ['dumbbell'], 2, 'lunge', 'dumbbell',
  ['Hold a dumbbell at your chest', 'Step wide and sit into one hip', 'Keep the other leg straight', 'Drive back to center'], L);
E('curtsy_lunge', 'Curtsy Lunge', 'lunge', ['Glutes', 'Quads'], [], 1, 'lunge', 'none',
  ['Step one leg behind and across', 'Lower until both knees bend about 90°', 'Hips stay square', 'Return and alternate'], L);
E('bb_reverse_lunge', 'Barbell Reverse Lunge', 'lunge', ['Quads', 'Glutes'], ['barbell'], 3, 'lunge', 'barbell',
  ['Bar on your upper back', 'Step back into a long lunge', 'Lower the back knee under control', 'Drive through the front foot to stand'], L);
E('step_up', 'Step-Up', 'lunge', ['Quads', 'Glutes'], ['bench'], 1, 'lunge', 'none',
  ['Whole foot on a sturdy bench or step', 'Push through that heel to stand up', 'Lower slowly', 'Finish one side, then switch'], L);

// ---------- Legs: hinges & hamstrings ----------
E('sumo_deadlift', 'Sumo Deadlift', 'hinge', ['Glutes', 'Hamstrings', 'Inner thighs'], ['barbell'], 3, 'deadlift', 'barbell',
  ['Wide stance, toes out, hands inside your knees', 'Push knees out over your toes', 'Stand up by spreading the floor', 'Lock out with your glutes'], L);
E('db_deadlift', 'Dumbbell Deadlift', 'hinge', ['Hamstrings', 'Glutes', 'Back'], ['dumbbell'], 1, 'deadlift', 'dumbbell',
  ['Dumbbells at your sides, flat back', 'Hips back and down to reach mid-shin', 'Stand up by driving through your feet', 'Squeeze glutes at the top'], L);
E('good_morning', 'Barbell Good Morning', 'hinge', ['Hamstrings', 'Lower back', 'Glutes'], ['barbell'], 3, 'goodmorning', 'barbell',
  ['Bar on your upper back, soft knees', 'Push hips back, chest forward', 'Stop when your back would round', 'Drive hips forward to stand'], L);
E('kb_rdl', 'Kettlebell Romanian Deadlift', 'hinge', ['Hamstrings', 'Glutes'], ['kettlebell'], 1, 'rdl', 'kettlebell',
  ['Hold the bell in front of your thighs', 'Push hips back, back flat', 'Lower to mid-shin', 'Snap hips forward to stand'], L);
E('sl_db_rdl', 'Single-Leg Dumbbell RDL', 'hinge', ['Hamstrings', 'Glutes', 'Balance'], ['dumbbell'], 2, 'rdl', 'dumbbell',
  ['Hold a dumbbell in the hand opposite your standing leg', 'Hinge as the back leg lifts', 'Keep hips level', 'Return slowly; switch sides'], L);
E('rack_pull', 'Rack Pull', 'hinge', ['Back', 'Glutes', 'Traps'], ['barbell'], 2, 'deadlift', 'barbell',
  ['Bar on pins at knee height', 'Set your back flat', 'Stand up by driving hips forward', 'Lower to the pins'], L);
E('lying_leg_curl', 'Lying Leg Curl', 'ham_iso', ['Hamstrings'], ['machines'], 1, 'legcurl', 'pad',
  ['Lie face down, pad above your heels', 'Hips stay pressed into the bench', 'Curl heels toward your glutes', 'Lower slowly'], L);
E('sliding_leg_curl', 'Sliding Leg Curl', 'ham_iso', ['Hamstrings', 'Glutes'], [], 2, 'bridge', 'none',
  ['Lie on your back, heels on towels or sliders', 'Lift hips into a bridge', 'Slide heels out, then pull them back in', 'Keep hips high'], L);
E('single_leg_curl', 'Single-Leg Machine Curl', 'ham_iso', ['Hamstrings'], ['machines'], 1, 'legcurl', 'pad',
  ['One leg at a time on the leg curl', 'Curl as far as you can', 'Pause and squeeze', 'Lower slowly'], L);

// ---------- Glutes & hips ----------
E('sl_glute_bridge', 'Single-Leg Glute Bridge', 'glute', ['Glutes', 'Hamstrings'], [], 1, 'bridge', 'none',
  ['One foot flat, other leg straight', 'Drive through the planted heel', 'Lift until your body is straight', 'Lower slowly; switch sides'], L);
E('bw_hip_thrust', 'Bodyweight Hip Thrust', 'glute', ['Glutes'], ['bench'], 1, 'hipthrust', 'none',
  ['Upper back on a bench edge', 'Feet flat, about hip-width', 'Drive hips up, chin tucked', 'Squeeze glutes hard at the top'], L);
E('sl_hip_thrust', 'Single-Leg Hip Thrust', 'glute', ['Glutes'], ['bench'], 2, 'hipthrust', 'none',
  ['Upper back on a bench, one foot planted', 'Other knee pulled toward your chest', 'Drive up through the planted heel', 'Pause at the top'], L);
E('marching_bridge', 'Marching Glute Bridge', 'glute', ['Glutes', 'Core'], [], 1, 'bridge', 'none',
  ['Hold a glute bridge at the top', 'Lift one knee toward your chest', 'Keep hips level', 'Alternate legs'], L);
E('glute_kickback_machine', 'Glute Kickback Machine', 'glute', ['Glutes'], ['machines'], 1, 'birddog', 'none',
  ['Chest on the pad, foot on the plate', 'Push back and up with your heel', 'Squeeze glutes at the top', 'Return slowly'], L);
E('quadruped_kickback', 'Quadruped Glute Kickback', 'glute', ['Glutes'], [], 1, 'birddog', 'none',
  ['On hands and knees', 'Kick one heel up toward the ceiling', 'Keep your lower back neutral', 'Lower; finish the side, then switch'], L);
E('band_walk', 'Lateral Band Walk', 'glute', ['Glutes', 'Hips'], ['bands'], 1, 'walk', 'none',
  ['Mini band around your legs, quarter-squat', 'Step sideways, knees pushing out', 'Don\'t let feet snap together', 'Walk back the other way'], L);
E('clamshell', 'Clamshell', 'glute', ['Glutes', 'Hips'], [], 1, 'clam', 'none',
  ['Lie on your side, knees bent, feet together', 'Lift the top knee without rolling your hips back', 'Pause at the top', 'Add a mini band to make it harder'], L);
E('hip_abduction', 'Hip Abduction Machine', 'glute', ['Glutes', 'Hips'], ['machines'], 1, 'seated_hip', 'none',
  ['Sit tall, pads on the outside of your knees', 'Push your knees apart', 'Pause wide', 'Return slowly'], L);
E('hip_adduction', 'Hip Adduction Machine', 'adductor', ['Inner thighs'], ['machines'], 1, 'seated_hip', 'none',
  ['Pads on the inside of your knees', 'Squeeze your legs together', 'Pause briefly', 'Let them open slowly'], L);
E('copenhagen', 'Copenhagen Plank', 'adductor', ['Inner thighs', 'Obliques'], ['bench'], 3, 'plank', 'none',
  ['Side plank with your top foot on a bench', 'Bottom leg hangs free or lifts to the bench', 'Hips stay high', 'Start with short holds'], { unit: 'sec' });

// ---------- Calves ----------
E('seated_calf', 'Seated Calf Raise', 'calf', ['Calves'], ['machines'], 1, 'seated_calf', 'none',
  ['Pad snug on your lower thighs', 'Drop heels for a deep stretch', 'Press up onto the balls of your feet', 'Pause at the top'], L);
E('db_seated_calf', 'Seated Dumbbell Calf Raise', 'calf', ['Calves'], ['dumbbell', 'bench'], 1, 'seated_calf', 'none',
  ['Sit with dumbbells resting on your knees', 'Balls of feet on a plate or step', 'Raise heels as high as you can', 'Lower slowly'], L);
E('leg_press_calf', 'Leg Press Calf Raise', 'calf', ['Calves'], ['machines'], 1, 'legpress', 'none',
  ['Balls of feet on the bottom edge of the platform', 'Legs straight but not locked', 'Push the platform with your toes', 'Let it come back for a stretch'], L);
E('single_leg_calf', 'Single-Leg Calf Raise', 'calf', ['Calves'], [], 2, 'calf', 'none',
  ['Stand on one foot on a step edge', 'Hold something for balance', 'Rise high, pause', 'Lower below the step'], L);

// ---------- Core ----------
E('hanging_leg_raise', 'Hanging Leg Raise', 'core', ['Abs', 'Hip flexors'], ['pullup_bar'], 3, 'hangraise', 'none',
  ['Hang with shoulders engaged', 'Raise straight legs to hip height or higher', 'Curl your pelvis up at the top', 'Lower without swinging'], {});
E('lying_leg_raise', 'Lying Leg Raise', 'core', ['Lower abs'], [], 1, 'legraise', 'none',
  ['Lie flat, hands under your hips', 'Lower back stays pressed down', 'Raise legs to vertical', 'Lower slowly; stop before your back arches'], {});
E('sit_up', 'Sit-Up', 'core', ['Abs', 'Hip flexors'], [], 1, 'situp', 'none',
  ['Knees bent, feet anchored or flat', 'Arms crossed on your chest', 'Curl all the way up', 'Lower one vertebra at a time'], {});
E('decline_situp', 'Decline Sit-Up', 'core', ['Abs'], ['bench'], 2, 'situp', 'none',
  ['Hook your feet on a decline bench', 'Curl up toward your knees', 'Exhale on the way up', 'Lower with control'], {});
E('bicycle_crunch', 'Bicycle Crunch', 'core', ['Abs', 'Obliques'], [], 1, 'crunch', 'none',
  ['Hands lightly behind your head', 'Bring one elbow toward the opposite knee', 'Extend the other leg long', 'Alternate smoothly'], {});
E('russian_twist', 'Russian Twist', 'core', ['Obliques', 'Abs'], [], 1, 'twist', 'none',
  ['Sit leaning back, knees bent', 'Rotate your torso side to side', 'Tap the floor beside each hip', 'Hold a weight to make it harder'], {});
E('hollow_hold', 'Hollow Body Hold', 'core', ['Abs'], [], 2, 'crunch', 'none',
  ['Lie on your back, press your lower back down', 'Lift shoulders and legs off the floor', 'Arms reach overhead', 'Hold; bend knees to make it easier'], { unit: 'sec' });
E('ab_rollout', 'Barbell Ab Rollout', 'core', ['Abs', 'Lats'], ['barbell'], 3, 'rollout', 'dumbbell',
  ['Kneel holding a loaded barbell (round plates)', 'Roll forward with a braced core', 'Go only as far as you can without sagging', 'Pull back with your abs'], {});
E('shoulder_taps', 'Plank Shoulder Taps', 'core', ['Core', 'Shoulders'], [], 1, 'pushup', 'none',
  ['High plank, feet wider than hips', 'Tap one hand to the opposite shoulder', 'Keep hips from rocking', 'Alternate sides'], {});
E('cable_woodchop', 'Cable Woodchop', 'core', ['Obliques', 'Core'], ['cable'], 2, 'cable_fly', 'cable',
  ['Pulley set high, stand side-on', 'Pull diagonally down across your body', 'Rotate through your hips and torso', 'Return slowly; switch sides'], {});

const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
EXERCISES.forEach(e => { e.group = PATTERN_GROUP[e.pattern]; });

function exerciseAvailable(ex, equip) {
  return ex.req.every(r => equip.includes(r));
}
