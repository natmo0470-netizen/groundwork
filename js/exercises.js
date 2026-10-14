/* Groundwork — exercise library and equipment model.
   Each exercise: id, name, pattern (movement slot used by the planner), muscles,
   req (equipment ids ALL required; bodyweight needs none), diff (1 easy – 3 advanced),
   anim (demo animation key), prop (what the figure holds), cues (form tips),
   unit ('reps' | 'sec' | 'min'), lower (true = lower-body load increments),
   videoId (optional YouTube id; when set, the guide links straight to that video). */

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
  core: 'Core', cardio: 'Cardio',
};

const EXERCISES = [];
function E(id, name, pattern, muscles, req, diff, anim, prop, cues, extra) {
  EXERCISES.push(Object.assign({ id, name, pattern, muscles, req, diff, anim, prop, cues, unit: 'reps', lower: false, videoId: '' }, extra || {}));
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

const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
EXERCISES.forEach(e => { e.group = PATTERN_GROUP[e.pattern]; });

function exerciseAvailable(ex, equip) {
  return ex.req.every(r => equip.includes(r));
}
function videoUrl(ex) {
  if (ex.videoId) return 'https://www.youtube.com/watch?v=' + ex.videoId;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent('how to do ' + ex.name + ' proper form');
}
