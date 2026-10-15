/* Movla — ready-made training programs.
   Program styles follow the classic formats found on sites like Muscle & Strength (full body,
   5×5, power/size upper-lower, push/pull/legs, one-muscle-a-day splits). Exercise picks and
   wording are Movla's own.

   Each session item: [slot, preferredExerciseIds, sets, minReps, maxReps, restSec, unit]
   - The first preferred exercise the user has equipment for is used; otherwise the planner
     picks the best match for that movement slot, so every program works with any equipment.
   - unit is 'min' or 'sec' for timed work; omitted means reps. */

const PROGRAM_FILTERS = [
  ['all', 'All'], ['beginner', 'Beginner'], ['muscle', 'Build muscle'], ['strength', 'Strength'],
  ['fatloss', 'Fat loss'], ['home', 'Home / no gym'],
];

const PROGRAMS = [
  {
    id: 'starter3', name: 'Beginner Full Body', days: 3, weeks: 8, level: 'beginner', tags: ['beginner', 'muscle'],
    equip: 'Gym or dumbbells', tagline: 'Learn the main lifts with three full-body days a week.',
    about: 'Every session trains your whole body with simple, low-skill exercises. Hitting each muscle three times a week is the fastest way for a beginner to build strength and confidence.',
    sessions: [
      { name: 'Full Body A', items: [
        ['squat', ['goblet_squat', 'leg_press', 'db_squat'], 3, 8, 12, 90],
        ['hpush', ['db_bench', 'machine_chest', 'pushup'], 3, 8, 12, 90],
        ['hpull', ['cable_row', 'db_row', 'machine_seated_row'], 3, 10, 12, 75],
        ['ham_iso', ['leg_curl', 'db_leg_curl'], 2, 10, 15, 60],
        ['side_delt', ['db_lateral', 'machine_lateral'], 2, 12, 15, 60],
        ['core', ['plank'], 3, 20, 40, 45, 'sec'],
      ] },
      { name: 'Full Body B', items: [
        ['hinge', ['db_rdl', 'kb_deadlift', 'bb_rdl'], 3, 8, 12, 90],
        ['vpush', ['db_ohp', 'machine_shoulder', 'seated_db_press'], 3, 8, 12, 90],
        ['vpull', ['lat_pulldown', 'assisted_pullup_machine', 'machine_pulldown'], 3, 10, 12, 75],
        ['lunge', ['db_step_up', 'split_squat', 'db_lunge'], 2, 8, 12, 75],
        ['biceps', ['db_curl', 'cable_curl'], 2, 10, 15, 60],
        ['core', ['dead_bug'], 3, 8, 12, 45],
      ] },
      { name: 'Full Body C', items: [
        ['squat', ['leg_press', 'goblet_squat', 'smith_squat'], 3, 10, 12, 90],
        ['hpush', ['db_incline', 'machine_incline', 'incline_pushup'], 3, 8, 12, 90],
        ['hpull', ['machine_seated_row', 'cs_db_row', 'db_row'], 3, 10, 12, 75],
        ['glute', ['db_hip_thrust', 'glute_bridge'], 3, 10, 15, 75],
        ['triceps', ['cable_pushdown', 'db_overhead_ext'], 2, 10, 15, 60],
        ['core', ['crunch'], 3, 12, 15, 45],
      ] },
    ],
  },
  {
    id: 'fivebyfive', name: 'Classic 5×5 Strength', days: 3, weeks: 12, level: 'beginner', tags: ['strength', 'beginner'], cycle: true,
    equip: 'Barbell + rack', tagline: 'Two alternating barbell workouts. Add weight every session.',
    about: 'Workouts A and B alternate across your training days (A-B-A one week, B-A-B the next). Five heavy sets of five on the big lifts, with small weight jumps whenever you complete every rep.',
    sessions: [
      { name: 'Workout A', items: [
        ['squat', ['bb_back_squat', 'smith_squat', 'goblet_squat'], 5, 5, 5, 180],
        ['hpush', ['bb_bench', 'smith_bench', 'db_bench'], 5, 5, 5, 180],
        ['hpull', ['bb_row', 'pendlay_row', 'db_row'], 5, 5, 5, 150],
        ['core', ['plank'], 3, 30, 45, 45, 'sec'],
      ] },
      { name: 'Workout B', items: [
        ['squat', ['bb_back_squat', 'smith_squat', 'goblet_squat'], 5, 5, 5, 180],
        ['vpush', ['bb_ohp', 'smith_ohp', 'db_ohp'], 5, 5, 5, 180],
        ['hinge', ['bb_deadlift', 'db_deadlift', 'kb_deadlift'], 1, 5, 5, 180],
        ['vpull', ['chinup', 'pullup', 'lat_pulldown'], 3, 5, 8, 120],
      ] },
    ],
  },
  {
    id: 'phul', name: 'Power + Size Upper/Lower', days: 4, weeks: 12, level: 'intermediate', tags: ['strength', 'muscle'],
    equip: 'Full gym', tagline: 'Two heavy days for strength, two higher-rep days for size.',
    about: 'A power-hypertrophy upper/lower split. Early in the week you lift heavy for 3–5 reps; later in the week you use moderate weights for 8–12 reps to build muscle.',
    sessions: [
      { name: 'Upper Power', items: [
        ['hpush', ['bb_bench', 'smith_bench', 'db_bench'], 4, 3, 5, 180],
        ['hpull', ['bb_row', 'pendlay_row', 'db_row'], 4, 3, 5, 180],
        ['vpush', ['db_ohp', 'bb_ohp'], 3, 5, 8, 120],
        ['vpull', ['pullup', 'lat_pulldown'], 3, 6, 10, 120],
        ['biceps', ['bb_curl', 'ez_curl', 'db_curl'], 3, 6, 10, 75],
        ['triceps', ['skullcrusher', 'close_grip_bench', 'cable_pushdown'], 3, 6, 10, 75],
      ] },
      { name: 'Lower Power', items: [
        ['squat', ['bb_back_squat', 'smith_squat', 'goblet_squat'], 4, 3, 5, 180],
        ['hinge', ['bb_deadlift', 'db_deadlift'], 3, 3, 5, 180],
        ['squat', ['leg_press', 'hack_squat'], 3, 10, 15, 120],
        ['ham_iso', ['leg_curl', 'lying_leg_curl'], 3, 6, 10, 75],
        ['calf', ['standing_calf', 'machine_calf', 'db_calf'], 4, 6, 10, 60],
      ] },
      { name: 'Upper Size', items: [
        ['hpush', ['db_incline', 'bb_incline', 'machine_incline'], 4, 8, 12, 90],
        ['chest_iso', ['db_fly', 'cable_fly', 'pec_deck'], 3, 8, 12, 60],
        ['hpull', ['cable_row', 'machine_seated_row'], 4, 8, 12, 90],
        ['hpull', ['db_row', 'cs_db_row'], 3, 8, 12, 75],
        ['side_delt', ['db_lateral', 'cable_lateral'], 3, 8, 12, 60],
        ['biceps', ['incline_db_curl', 'db_curl'], 3, 8, 12, 60],
        ['triceps', ['rope_pushdown', 'cable_pushdown'], 3, 8, 12, 60],
      ] },
      { name: 'Lower Size', items: [
        ['squat', ['bb_front_squat', 'hack_squat', 'goblet_squat'], 4, 8, 12, 120],
        ['lunge', ['db_lunge', 'bulgarian_split'], 3, 8, 12, 90],
        ['quad_iso', ['leg_extension', 'single_leg_ext'], 3, 10, 15, 60],
        ['ham_iso', ['lying_leg_curl', 'leg_curl'], 3, 10, 15, 60],
        ['calf', ['seated_calf', 'db_seated_calf'], 4, 8, 12, 60],
      ] },
    ],
  },
  {
    id: 'ppl6', name: 'Push / Pull / Legs', days: 6, weeks: 8, level: 'intermediate', tags: ['muscle'],
    equip: 'Full gym', tagline: 'Each muscle trained twice a week, six days on.',
    about: 'Push days hit chest, shoulders and triceps; pull days hit back and biceps; leg days cover everything below the waist. The second half of the week uses different exercises so nothing gets stale.',
    sessions: [
      { name: 'Push A', items: [
        ['hpush', ['bb_bench', 'db_bench', 'machine_chest'], 4, 6, 8, 150],
        ['vpush', ['db_ohp', 'machine_shoulder'], 3, 8, 10, 90],
        ['hpush', ['db_incline', 'machine_incline'], 3, 8, 12, 90],
        ['side_delt', ['db_lateral', 'cable_lateral'], 4, 12, 15, 60],
        ['triceps', ['rope_pushdown', 'cable_pushdown'], 3, 10, 12, 60],
        ['triceps', ['overhead_cable_ext', 'db_overhead_ext'], 3, 10, 12, 60],
      ] },
      { name: 'Pull A', items: [
        ['vpull', ['pullup', 'lat_pulldown', 'assisted_pullup_machine'], 4, 6, 10, 120],
        ['hpull', ['bb_row', 'cable_row'], 4, 8, 10, 120],
        ['hpull', ['cs_db_row', 'machine_seated_row', 'db_row'], 3, 10, 12, 75],
        ['rear_delt', ['face_pull', 'band_face_pull'], 3, 12, 15, 60],
        ['biceps', ['ez_curl', 'bb_curl', 'db_curl'], 3, 8, 12, 60],
        ['biceps', ['hammer_curl', 'rope_hammer_curl'], 3, 10, 12, 60],
      ] },
      { name: 'Legs A', items: [
        ['squat', ['bb_back_squat', 'hack_squat', 'goblet_squat'], 4, 6, 8, 150],
        ['hinge', ['bb_rdl', 'db_rdl'], 3, 8, 10, 120],
        ['squat', ['leg_press', 'db_squat'], 3, 10, 12, 90],
        ['ham_iso', ['leg_curl', 'lying_leg_curl'], 3, 10, 15, 60],
        ['quad_iso', ['leg_extension'], 3, 12, 15, 60],
        ['calf', ['standing_calf', 'machine_calf'], 4, 10, 15, 60],
      ] },
      { name: 'Push B', items: [
        ['vpush', ['bb_ohp', 'seated_db_press', 'db_ohp'], 4, 6, 8, 150],
        ['hpush', ['db_incline', 'bb_incline'], 3, 8, 12, 90],
        ['chest_iso', ['cable_crossover', 'pec_deck', 'db_fly'], 3, 12, 15, 60],
        ['side_delt', ['cable_lateral', 'leaning_lateral', 'db_lateral'], 3, 12, 15, 60],
        ['triceps', ['skullcrusher', 'ez_overhead_ext'], 3, 8, 12, 75],
        ['triceps', ['dips', 'bench_dip'], 2, 8, 12, 75],
      ] },
      { name: 'Pull B', items: [
        ['hpull', ['pendlay_row', 'tbar_row', 'bb_row'], 4, 6, 8, 150],
        ['vpull', ['chinup', 'underhand_pulldown'], 3, 8, 10, 90],
        ['vpull', ['straight_arm_pulldown', 'cable_pullover'], 3, 12, 15, 60],
        ['rear_delt', ['reverse_pec_deck', 'db_rear_fly'], 3, 12, 15, 60],
        ['biceps', ['incline_db_curl', 'db_curl'], 3, 10, 12, 60],
        ['shrug', ['db_shrug', 'bb_shrug'], 3, 10, 15, 60],
      ] },
      { name: 'Legs B', items: [
        ['hinge', ['bb_deadlift', 'db_deadlift'], 3, 4, 6, 180],
        ['squat', ['bb_front_squat', 'smith_squat', 'goblet_squat'], 3, 8, 10, 120],
        ['lunge', ['bulgarian_split', 'db_lunge'], 3, 8, 12, 90],
        ['glute', ['bb_hip_thrust', 'db_hip_thrust'], 3, 8, 12, 90],
        ['calf', ['seated_calf', 'db_seated_calf'], 4, 12, 15, 45],
        ['core', ['hanging_leg_raise', 'lying_leg_raise'], 3, 10, 15, 45],
      ] },
    ],
  },
  {
    id: 'split5', name: 'Classic 5-Day Split', days: 5, weeks: 8, level: 'intermediate', tags: ['muscle'],
    equip: 'Full gym', tagline: 'One muscle group a day: chest, back, shoulders, legs, arms.',
    about: 'The traditional bodybuilding week. Each day focuses on one area with lots of variety, so every muscle gets a big workout once a week and a full week to recover.',
    sessions: [
      { name: 'Chest', items: [
        ['hpush', ['bb_bench', 'db_bench', 'machine_chest'], 4, 6, 10, 120],
        ['hpush', ['db_incline', 'bb_incline', 'machine_incline'], 3, 8, 12, 90],
        ['hpush', ['chest_dip', 'decline_bench', 'db_decline'], 3, 8, 12, 90],
        ['chest_iso', ['cable_crossover', 'db_fly'], 3, 10, 15, 60],
        ['chest_iso', ['pec_deck', 'machine_fly', 'incline_db_fly'], 2, 12, 15, 60],
        ['core', ['cable_crunch', 'crunch'], 3, 12, 15, 45],
      ] },
      { name: 'Back', items: [
        ['vpull', ['pullup', 'wide_pullup', 'lat_pulldown'], 4, 6, 10, 120],
        ['hpull', ['bb_row', 'tbar_row'], 4, 8, 10, 120],
        ['hpull', ['one_arm_cable_row', 'db_row'], 3, 10, 12, 75],
        ['vpull', ['straight_arm_pulldown', 'cable_pullover'], 3, 12, 15, 60],
        ['hinge', ['back_extension', 'good_morning'], 3, 12, 15, 60],
        ['shrug', ['bb_shrug', 'db_shrug'], 3, 10, 15, 60],
      ] },
      { name: 'Shoulders', items: [
        ['vpush', ['seated_db_press', 'bb_ohp', 'machine_shoulder'], 4, 6, 10, 120],
        ['vpush', ['arnold_press', 'db_ohp'], 3, 8, 12, 90],
        ['side_delt', ['db_lateral', 'machine_lateral'], 4, 12, 15, 60],
        ['side_delt', ['cable_lateral', 'leaning_lateral'], 3, 12, 15, 60],
        ['rear_delt', ['reverse_pec_deck', 'db_rear_fly'], 3, 12, 15, 60],
        ['rear_delt', ['face_pull', 'band_face_pull'], 3, 15, 20, 60],
      ] },
      { name: 'Legs', items: [
        ['squat', ['bb_back_squat', 'hack_squat', 'goblet_squat'], 4, 6, 10, 150],
        ['squat', ['leg_press', 'pendulum_squat'], 3, 10, 12, 90],
        ['hinge', ['bb_rdl', 'db_rdl'], 3, 8, 10, 120],
        ['quad_iso', ['leg_extension'], 3, 12, 15, 60],
        ['ham_iso', ['leg_curl', 'lying_leg_curl'], 3, 10, 15, 60],
        ['calf', ['standing_calf', 'donkey_calf', 'machine_calf'], 4, 10, 15, 60],
      ] },
      { name: 'Arms', items: [
        ['biceps', ['ez_curl', 'bb_curl', 'db_curl'], 3, 8, 12, 75],
        ['triceps', ['close_grip_bench', 'dips'], 3, 6, 10, 90],
        ['biceps', ['incline_db_curl', 'bayesian_curl'], 3, 10, 12, 60],
        ['triceps', ['rope_pushdown', 'cable_pushdown'], 3, 10, 15, 60],
        ['biceps', ['hammer_curl', 'rope_hammer_curl'], 3, 10, 12, 60],
        ['triceps', ['overhead_cable_ext', 'db_overhead_ext'], 3, 10, 15, 60],
        ['forearm', ['wrist_curl', 'bb_wrist_curl'], 2, 15, 20, 45],
      ] },
    ],
  },
  {
    id: 'db3', name: 'Dumbbell-Only Full Body', days: 3, weeks: 8, level: 'beginner', tags: ['beginner', 'home', 'muscle'],
    equip: 'Dumbbells (bench helps)', tagline: 'A complete plan with nothing but a pair of dumbbells.',
    about: 'Built for home or a crowded gym. Three full-body sessions using only dumbbells; a bench opens up a few more pressing options but isn\'t required.',
    sessions: [
      { name: 'Dumbbell A', items: [
        ['squat', ['goblet_squat', 'db_squat'], 3, 10, 12, 90],
        ['hpush', ['db_bench', 'db_floor_press', 'pushup'], 3, 8, 12, 90],
        ['hpull', ['db_row', 'bent_db_row'], 3, 10, 12, 75],
        ['hinge', ['db_rdl'], 3, 10, 12, 90],
        ['side_delt', ['db_lateral'], 2, 12, 15, 60],
        ['biceps', ['db_curl'], 2, 10, 12, 60],
      ] },
      { name: 'Dumbbell B', items: [
        ['lunge', ['db_lunge', 'db_step_up'], 3, 8, 12, 90],
        ['vpush', ['db_ohp', 'seated_db_press'], 3, 8, 12, 90],
        ['hpull', ['bent_db_row', 'db_row'], 3, 10, 12, 75],
        ['glute', ['db_hip_thrust', 'sl_glute_bridge'], 3, 10, 15, 75],
        ['triceps', ['db_overhead_ext', 'db_kickback'], 2, 10, 15, 60],
        ['core', ['dead_bug'], 3, 8, 12, 45],
      ] },
      { name: 'Dumbbell C', items: [
        ['squat', ['db_squat', 'heel_goblet_squat', 'goblet_squat'], 3, 10, 12, 90],
        ['hpush', ['db_incline', 'neutral_db_press', 'db_floor_press'], 3, 10, 12, 90],
        ['hpull', ['cs_db_row', 'renegade_row', 'db_row'], 3, 10, 12, 75],
        ['hinge', ['sl_db_rdl', 'db_rdl'], 3, 8, 10, 75],
        ['biceps', ['hammer_curl'], 2, 10, 12, 60],
        ['core', ['suitcase_carry', 'plank'], 3, 20, 40, 45, 'sec'],
      ] },
    ],
  },
  {
    id: 'bw3', name: 'Bodyweight Anywhere', days: 3, weeks: 6, level: 'beginner', tags: ['beginner', 'home'],
    equip: 'No equipment', tagline: 'Three short sessions you can do in a living room or hotel.',
    about: 'Uses only your body weight. Progress by adding reps, slowing the lowering phase, or moving to the harder variation the logger suggests.',
    sessions: [
      { name: 'Bodyweight A', items: [
        ['squat', ['bw_squat'], 3, 12, 20, 60],
        ['hpush', ['pushup', 'incline_pushup'], 3, 6, 15, 75],
        ['hpull', ['inverted_row', 'doorway_row'], 3, 8, 12, 75],
        ['lunge', ['bw_lunge'], 3, 8, 12, 60],
        ['glute', ['glute_bridge'], 3, 12, 20, 45],
        ['core', ['plank'], 3, 20, 45, 45, 'sec'],
      ] },
      { name: 'Bodyweight B', items: [
        ['lunge', ['bw_walking_lunge', 'step_up'], 3, 10, 14, 60],
        ['vpush', ['pike_pushup'], 3, 6, 12, 75],
        ['hpull', ['doorway_row', 'inverted_row'], 3, 10, 15, 60],
        ['glute', ['sl_glute_bridge', 'frog_pump'], 3, 10, 15, 45],
        ['core', ['hollow_hold'], 3, 15, 30, 45, 'sec'],
        ['cardio', ['mountain_climber', 'high_knees'], 3, 20, 30, 40, 'sec'],
      ] },
      { name: 'Bodyweight C', items: [
        ['squat', ['prisoner_squat', 'bw_squat'], 3, 12, 20, 60],
        ['hpush', ['decline_pushup', 'pushup'], 3, 6, 12, 75],
        ['vpull', ['prone_y'], 3, 10, 15, 45],
        ['lunge', ['lateral_lunge', 'cossack_squat'], 3, 8, 12, 60],
        ['core', ['dead_bug', 'bird_dog'], 3, 8, 12, 45],
        ['cardio', ['burpee', 'jumping_jacks'], 3, 20, 30, 40, 'sec'],
      ] },
    ],
  },
  {
    id: 'fatloss4', name: 'Fat Loss: Lift + Condition', days: 4, weeks: 12, level: 'beginner', tags: ['fatloss', 'beginner'],
    equip: 'Gym or dumbbells', tagline: 'Two strength days to keep muscle, two conditioning days to burn more.',
    about: 'Lifting keeps your muscle while you diet; the conditioning days raise your weekly calorie burn without beating up your joints. Pair it with the fat-loss calorie target in Nutrition.',
    sessions: [
      { name: 'Strength A', items: [
        ['squat', ['goblet_squat', 'leg_press', 'bb_back_squat'], 3, 8, 12, 90],
        ['hpush', ['db_bench', 'machine_chest', 'pushup'], 3, 8, 12, 90],
        ['hpull', ['cable_row', 'db_row'], 3, 10, 12, 75],
        ['hinge', ['db_rdl', 'bb_rdl'], 3, 10, 12, 90],
        ['core', ['plank'], 3, 30, 45, 45, 'sec'],
        ['cardio', ['bike_intervals', 'row_intervals', 'treadmill_intervals', 'jumping_jacks'], 1, 8, 10, 0, 'min'],
      ] },
      { name: 'Conditioning 1', items: [
        ['cardio', ['row_intervals', 'bike_intervals', 'treadmill_intervals', 'brisk_walk'], 1, 20, 25, 0, 'min'],
        ['hinge', ['kb_swing', 'band_pull_through', 'db_rdl'], 4, 15, 20, 45],
        ['cardio', ['burpee', 'jumping_jacks'], 3, 20, 30, 40, 'sec'],
        ['core', ['mountain_climber', 'dead_bug'], 3, 20, 30, 40, 'sec'],
      ] },
      { name: 'Strength B', items: [
        ['lunge', ['db_lunge', 'db_step_up', 'bw_lunge'], 3, 8, 12, 75],
        ['vpush', ['db_ohp', 'machine_shoulder'], 3, 8, 12, 90],
        ['vpull', ['lat_pulldown', 'assisted_pullup_machine', 'band_pulldown'], 3, 10, 12, 75],
        ['glute', ['db_hip_thrust', 'glute_bridge'], 3, 10, 15, 75],
        ['core', ['dead_bug'], 3, 8, 12, 45],
        ['cardio', ['treadmill_intervals', 'bike_intervals', 'high_knees'], 1, 8, 10, 0, 'min'],
      ] },
      { name: 'Conditioning 2', items: [
        ['cardio', ['incline_walk', 'stair_climber', 'elliptical', 'brisk_walk'], 1, 25, 35, 0, 'min'],
        ['core', ['russian_twist', 'bicycle_crunch'], 3, 12, 20, 45],
        ['core', ['side_plank'], 2, 20, 40, 45, 'sec'],
      ] },
    ],
  },
  {
    id: 'glute4', name: 'Lower Body + Glute Focus', days: 4, weeks: 10, level: 'beginner', tags: ['muscle', 'beginner'],
    equip: 'Gym or dumbbells', tagline: 'Three lower-body days with extra glute work, plus one upper day.',
    about: 'Hip thrusts, split squats and hinges do the heavy lifting, with abduction and kickbacks to finish. One upper-body day keeps the rest of you balanced.',
    sessions: [
      { name: 'Glutes + Hamstrings', items: [
        ['glute', ['bb_hip_thrust', 'db_hip_thrust', 'smith_hip_thrust'], 4, 8, 12, 120],
        ['lunge', ['bulgarian_split', 'db_lunge'], 3, 8, 12, 90],
        ['hinge', ['bb_rdl', 'db_rdl'], 3, 8, 10, 90],
        ['glute', ['hip_abduction', 'band_walk', 'band_seated_abduction'], 3, 15, 20, 45],
        ['glute', ['cable_kickback', 'quadruped_kickback'], 3, 12, 15, 45],
      ] },
      { name: 'Upper Body', items: [
        ['hpush', ['db_bench', 'machine_chest', 'pushup'], 3, 8, 12, 90],
        ['vpull', ['lat_pulldown', 'assisted_pullup_machine'], 3, 10, 12, 75],
        ['vpush', ['db_ohp', 'machine_shoulder'], 3, 8, 12, 75],
        ['hpull', ['cable_row', 'db_row'], 3, 10, 12, 75],
        ['side_delt', ['db_lateral'], 3, 12, 15, 45],
        ['triceps', ['rope_pushdown', 'db_overhead_ext'], 2, 10, 15, 45],
      ] },
      { name: 'Quads + Glutes', items: [
        ['squat', ['bb_back_squat', 'goblet_squat', 'smith_squat'], 4, 6, 10, 120],
        ['squat', ['leg_press', 'db_squat'], 3, 10, 15, 90],
        ['lunge', ['db_step_up', 'step_up'], 3, 10, 12, 75],
        ['ham_iso', ['leg_curl', 'db_leg_curl'], 3, 10, 15, 60],
        ['glute', ['frog_pump', 'glute_bridge'], 2, 20, 25, 45],
      ] },
      { name: 'Full Lower', items: [
        ['hinge', ['sumo_deadlift', 'kb_swing', 'db_deadlift'], 3, 6, 10, 120],
        ['glute', ['sl_hip_thrust', 'sl_glute_bridge'], 3, 10, 12, 60],
        ['lunge', ['walking_lunge', 'bw_walking_lunge'], 3, 10, 14, 75],
        ['adductor', ['hip_adduction', 'cable_adduction', 'side_lying_adduction'], 3, 12, 15, 45],
        ['calf', ['standing_calf', 'db_calf'], 3, 12, 15, 45],
        ['core', ['side_plank'], 2, 20, 40, 45, 'sec'],
      ] },
    ],
  },
  {
    id: 'min2', name: 'Minimalist 2-Day', days: 2, weeks: 8, level: 'beginner', tags: ['beginner', 'strength'],
    equip: 'Any', tagline: 'Two efficient sessions for busy weeks.',
    about: 'Four big movements per session, every major muscle covered twice a week. Perfect when life is busy: consistency beats complexity.',
    sessions: [
      { name: 'Session A', items: [
        ['squat', ['bb_back_squat', 'goblet_squat', 'leg_press', 'bw_squat'], 3, 6, 10, 120],
        ['hpush', ['bb_bench', 'db_bench', 'pushup'], 3, 6, 10, 120],
        ['hpull', ['bb_row', 'db_row', 'inverted_row'], 3, 8, 12, 90],
        ['core', ['plank'], 2, 30, 60, 45, 'sec'],
      ] },
      { name: 'Session B', items: [
        ['hinge', ['bb_deadlift', 'db_rdl', 'kb_swing'], 3, 5, 8, 150],
        ['vpush', ['bb_ohp', 'db_ohp', 'pike_pushup'], 3, 6, 10, 120],
        ['vpull', ['pullup', 'lat_pulldown', 'band_pulldown', 'prone_y'], 3, 6, 10, 90],
        ['lunge', ['db_lunge', 'bw_lunge'], 2, 8, 12, 75],
      ] },
    ],
  },
  {
    id: 'classic6', name: 'Old-School Bodybuilding', days: 6, weeks: 8, level: 'advanced', tags: ['muscle'],
    equip: 'Full gym', tagline: 'Chest + back, shoulders + arms, legs, twice a week. High volume.',
    about: 'A golden-era style split that pairs opposing muscles in the same session. Lots of sets and short rests; best for lifters with a few years of training behind them.',
    sessions: [
      { name: 'Chest + Back', items: [
        ['hpush', ['bb_bench', 'db_bench'], 4, 8, 10, 90],
        ['vpull', ['wide_pullup', 'pullup', 'lat_pulldown'], 4, 8, 10, 90],
        ['hpush', ['bb_incline', 'db_incline'], 3, 8, 12, 75],
        ['hpull', ['bb_row', 'tbar_row'], 3, 8, 12, 75],
        ['chest_iso', ['db_fly', 'cable_crossover'], 3, 10, 12, 60],
        ['chest_iso', ['db_pullover', 'cable_pullover'], 3, 10, 12, 60],
        ['core', ['hanging_knee_raise', 'crunch'], 3, 12, 20, 45],
      ] },
      { name: 'Shoulders + Arms', items: [
        ['vpush', ['seated_bb_press', 'seated_db_press', 'bb_ohp'], 4, 8, 10, 90],
        ['side_delt', ['db_lateral', 'cable_lateral'], 4, 10, 15, 60],
        ['rear_delt', ['db_rear_fly', 'reverse_pec_deck'], 3, 12, 15, 60],
        ['biceps', ['bb_curl', 'ez_curl'], 3, 8, 12, 60],
        ['triceps', ['close_grip_bench', 'skullcrusher'], 3, 8, 12, 60],
        ['biceps', ['concentration_curl', 'db_preacher'], 3, 10, 12, 45],
        ['triceps', ['db_overhead_ext', 'overhead_cable_ext'], 3, 10, 12, 45],
      ] },
      { name: 'Legs', items: [
        ['squat', ['bb_back_squat', 'hack_squat'], 4, 8, 12, 120],
        ['squat', ['leg_press', 'pendulum_squat'], 3, 10, 15, 90],
        ['hinge', ['stiff_leg_deadlift', 'bb_rdl'], 3, 8, 12, 90],
        ['lunge', ['walking_lunge', 'db_lunge'], 3, 10, 12, 75],
        ['quad_iso', ['leg_extension'], 3, 12, 15, 45],
        ['ham_iso', ['lying_leg_curl', 'leg_curl'], 3, 10, 15, 45],
        ['calf', ['standing_calf', 'donkey_calf'], 5, 10, 15, 45],
      ] },
    ],
  },
  {
    id: 'hybrid7', name: 'Seven-Day Hybrid', days: 7, weeks: 8, level: 'intermediate', tags: ['muscle', 'fatloss'],
    equip: 'Full gym', tagline: 'Five lifting days, one conditioning day and one easy recovery day.',
    about: 'For people who want to move every day. The conditioning and recovery days are deliberately easy so you can keep training hard on the other five. Take a full rest day whenever you feel run down.',
    sessions: [
      { name: 'Push', items: [
        ['hpush', ['bb_bench', 'db_bench'], 4, 6, 10, 120],
        ['vpush', ['db_ohp', 'machine_shoulder'], 3, 8, 12, 90],
        ['hpush', ['db_incline', 'machine_incline'], 3, 10, 12, 75],
        ['side_delt', ['db_lateral', 'cable_lateral'], 3, 12, 15, 45],
        ['triceps', ['rope_pushdown', 'cable_pushdown'], 3, 10, 15, 45],
      ] },
      { name: 'Pull', items: [
        ['vpull', ['pullup', 'lat_pulldown'], 4, 6, 10, 120],
        ['hpull', ['cable_row', 'bb_row'], 3, 8, 12, 90],
        ['hpull', ['db_row', 'cs_db_row'], 3, 10, 12, 75],
        ['rear_delt', ['face_pull'], 3, 12, 15, 45],
        ['biceps', ['db_curl', 'ez_curl'], 3, 10, 12, 45],
      ] },
      { name: 'Legs', items: [
        ['squat', ['bb_back_squat', 'hack_squat', 'goblet_squat'], 4, 6, 10, 150],
        ['hinge', ['bb_rdl', 'db_rdl'], 3, 8, 10, 120],
        ['lunge', ['bulgarian_split', 'db_lunge'], 3, 8, 12, 75],
        ['ham_iso', ['leg_curl'], 3, 10, 15, 45],
        ['calf', ['standing_calf', 'machine_calf'], 3, 12, 15, 45],
      ] },
      { name: 'Conditioning + Core', items: [
        ['cardio', ['row_intervals', 'bike_intervals', 'treadmill_intervals'], 1, 20, 25, 0, 'min'],
        ['core', ['hanging_leg_raise', 'reverse_crunch'], 3, 10, 15, 45],
        ['core', ['pallof_press', 'band_pallof'], 3, 10, 12, 45],
        ['core', ['side_plank'], 2, 20, 40, 45, 'sec'],
      ] },
      { name: 'Upper', items: [
        ['hpush', ['db_incline', 'bb_incline'], 3, 8, 12, 90],
        ['vpull', ['close_pulldown', 'chinup'], 3, 8, 12, 90],
        ['vpush', ['arnold_press', 'seated_db_press'], 3, 8, 12, 75],
        ['hpull', ['machine_seated_row', 'one_arm_cable_row'], 3, 10, 12, 75],
        ['biceps', ['hammer_curl'], 2, 10, 12, 45],
        ['triceps', ['overhead_cable_ext', 'db_overhead_ext'], 2, 10, 12, 45],
      ] },
      { name: 'Lower', items: [
        ['hinge', ['bb_deadlift', 'db_deadlift'], 3, 4, 6, 180],
        ['squat', ['leg_press', 'goblet_squat'], 3, 10, 12, 90],
        ['glute', ['bb_hip_thrust', 'db_hip_thrust'], 3, 8, 12, 90],
        ['quad_iso', ['leg_extension'], 3, 12, 15, 45],
        ['calf', ['seated_calf'], 3, 12, 15, 45],
      ] },
      { name: 'Active Recovery', items: [
        ['cardio', ['brisk_walk', 'incline_walk', 'bike', 'elliptical'], 1, 25, 40, 0, 'min'],
        ['core', ['bird_dog'], 2, 8, 10, 30],
        ['core', ['dead_bug'], 2, 8, 10, 30],
        ['rear_delt', ['band_pull_apart', 'wall_slide'], 2, 15, 20, 30],
      ] },
    ],
  },
];
const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map(p => [p.id, p]));
const RECOMMENDED_DAYS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

/* Turn one program session into a workout using the user's equipment. */
function buildProgramSession(prog, idx, state, equip) {
  const p = state.profile, sess = prog.sessions[idx];
  const used = new Set(), items = [];
  sess.items.forEach(([slot, prefs, sets, min, max, rest, unit]) => {
    let ex = prefs.map(id => EX_BY_ID[id]).find(e => e && exerciseAvailable(e, equip) && !used.has(e.id) && !(typeof isBlockedEx === 'function' && isBlockedEx(e)));
    if (!ex) ex = candidates(slot, equip, p.experience).find(e => !used.has(e.id));
    if (!ex) return;
    used.add(ex.id);
    const want = unit || 'reps';
    const rx = ex.unit === want
      ? { sets, min, max, rest: rest != null ? rest : (max <= 6 ? 180 : max <= 10 ? 90 : 60) }
      : prescribe(p.goal, p.experience, ex, false, state.schedule.minutes);
    items.push({ exId: ex.id, slot, ...rx });
  });
  const groups = [...new Set(items.map(i => EX_BY_ID[i.exId].group))];
  return { id: `pg_${prog.id}_${idx}`, key: `pg_${idx}`, name: sess.name, focus: groups.slice(0, 4).join(' · '), cardio: items.every(i => EX_BY_ID[i.exId].pattern === 'cardio' || EX_BY_ID[i.exId].pattern === 'core'), items, program: prog.id };
}

function buildProgramPlan(state, prog, block) {
  const equip = equipList(state);
  const days = state.schedule.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const workouts = prog.sessions.map((_, i) => buildProgramSession(prog, i, state, equip));
  const dayMap = {};
  days.forEach((d, i) => { dayMap[d] = workouts[i % workouts.length].id; });
  // Rotate sessions across training days when the program alternates (5×5) or the user picked
  // a different number of days than the program was written for.
  const cycle = (prog.cycle || days.length !== prog.sessions.length) ? workouts.map(w => w.id) : null;
  return { split: prog.name, program: prog.id, weeks: prog.weeks, createdAt: todayKey(), workouts, dayMap, cycle, week: 1, block: block || 1, overrides: {}, pinned: {} };
}

function programFits(prog, state) {
  const equip = equipList(state);
  let missing = 0, total = 0;
  prog.sessions.forEach(s => s.items.forEach(([, prefs]) => { total++; if (!prefs.some(id => EX_BY_ID[id] && exerciseAvailable(EX_BY_ID[id], equip))) missing++; }));
  return { missing, total };
}
