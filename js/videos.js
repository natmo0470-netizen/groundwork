/* Groundwork — exercise video links.
   Paste a YouTube link (or just the 11-character video ID) between the quotes for any exercise.
   A filled entry makes the "Watch a video tutorial" button open that exact video;
   an empty one opens a YouTube search for the exercise. */
const VIDEO_LINKS = {
  // ---- Legs ----
  bb_back_squat: '', // Barbell Back Squat
  leg_press: '', // Leg Press
  smith_squat: '', // Smith Machine Squat
  goblet_squat: '', // Goblet Squat
  kb_goblet_squat: '', // Kettlebell Goblet Squat
  bb_front_squat: '', // Barbell Front Squat
  bw_squat: '', // Bodyweight Squat
  band_squat: '', // Banded Squat
  bb_deadlift: '', // Barbell Deadlift
  bb_rdl: '', // Romanian Deadlift
  db_rdl: '', // Dumbbell Romanian Deadlift
  kb_deadlift: '', // Kettlebell Deadlift
  kb_swing: '', // Kettlebell Swing
  smith_rdl: '', // Smith Machine RDL
  cable_pull_through: '', // Cable Pull-Through
  band_good_morning: '', // Band Good Morning
  sl_hinge: '', // Single-Leg Hip Hinge
  back_extension: '', // Back Extension
  db_lunge: '', // Dumbbell Reverse Lunge
  bw_lunge: '', // Reverse Lunge
  bulgarian_split: '', // Bulgarian Split Squat
  split_squat: '', // Split Squat
  smith_split: '', // Smith Machine Split Squat
  db_step_up: '', // Dumbbell Step-Up
  kb_lunge: '', // Goblet Reverse Lunge
  // ---- Chest ----
  bb_bench: '', // Barbell Bench Press
  db_bench: '', // Dumbbell Bench Press
  db_incline: '', // Incline Dumbbell Press
  machine_chest: '', // Machine Chest Press
  smith_bench: '', // Smith Machine Bench Press
  cable_press: '', // Standing Cable Chest Press
  incline_pushup: '', // Incline Push-Up
  pushup: '', // Push-Up
  band_press: '', // Band Chest Press
  bb_incline: '', // Incline Barbell Press
  // ---- Shoulders ----
  bb_ohp: '', // Barbell Overhead Press
  db_ohp: '', // Dumbbell Shoulder Press
  machine_shoulder: '', // Machine Shoulder Press
  smith_ohp: '', // Smith Machine Shoulder Press
  kb_press: '', // Kettlebell Overhead Press
  band_ohp: '', // Band Overhead Press
  pike_pushup: '', // Pike Push-Up
  // ---- Back ----
  bb_row: '', // Barbell Row
  db_row: '', // One-Arm Dumbbell Row
  cable_row: '', // Seated Cable Row
  machine_row: '', // Chest-Supported Machine Row
  kb_row: '', // Kettlebell Row
  band_row: '', // Band Row
  smith_row: '', // Smith Machine Row
  inverted_row: '', // Inverted Row
  doorway_row: '', // Doorway Row
  lat_pulldown: '', // Lat Pulldown
  pullup: '', // Pull-Up
  chinup: '', // Chin-Up
  assisted_pullup: '', // Band-Assisted Pull-Up
  band_pulldown: '', // Band Lat Pulldown
  prone_y: '', // Prone Y-Raise
  // ---- Legs ----
  leg_extension: '', // Leg Extension
  wall_sit: '', // Wall Sit
  leg_curl: '', // Seated Leg Curl
  band_leg_curl: '', // Band Leg Curl
  db_leg_curl: '', // Dumbbell Leg Curl
  standing_calf: '', // Standing Calf Raise
  db_calf: '', // Dumbbell Calf Raise
  smith_calf: '', // Smith Machine Calf Raise
  machine_calf: '', // Machine Calf Raise
  // ---- Glutes ----
  bb_hip_thrust: '', // Barbell Hip Thrust
  db_hip_thrust: '', // Dumbbell Hip Thrust
  smith_hip_thrust: '', // Smith Machine Hip Thrust
  glute_bridge: '', // Glute Bridge
  band_bridge: '', // Banded Glute Bridge
  cable_kickback: '', // Cable Glute Kickback
  // ---- Chest ----
  db_fly: '', // Dumbbell Fly
  cable_fly: '', // Cable Fly
  pec_deck: '', // Pec Deck
  band_fly: '', // Band Fly
  // ---- Shoulders ----
  db_lateral: '', // Dumbbell Lateral Raise
  cable_lateral: '', // Cable Lateral Raise
  band_lateral: '', // Band Lateral Raise
  machine_lateral: '', // Machine Lateral Raise
  face_pull: '', // Face Pull
  db_rear_fly: '', // Dumbbell Rear Delt Fly
  band_pull_apart: '', // Band Pull-Apart
  reverse_pec_deck: '', // Reverse Pec Deck
  // ---- Arms ----
  db_curl: '', // Dumbbell Curl
  bb_curl: '', // Barbell Curl
  cable_curl: '', // Cable Curl
  hammer_curl: '', // Hammer Curl
  band_curl: '', // Band Curl
  kb_curl: '', // Kettlebell Curl
  cable_pushdown: '', // Cable Triceps Pushdown
  db_overhead_ext: '', // Overhead Dumbbell Extension
  skullcrusher: '', // Skull Crusher
  dips: '', // Dip
  bench_dip: '', // Bench Dip
  band_pushdown: '', // Band Triceps Pushdown
  diamond_pushup: '', // Close-Grip Push-Up
  close_grip_bench: '', // Close-Grip Bench Press
  // ---- Core ----
  plank: '', // Plank
  dead_bug: '', // Dead Bug
  crunch: '', // Crunch
  hanging_knee_raise: '', // Hanging Knee Raise
  cable_crunch: '', // Cable Crunch
  side_plank: '', // Side Plank
  pallof_press: '', // Pallof Press
  band_pallof: '', // Band Pallof Press
  mountain_climber: '', // Mountain Climbers
  bird_dog: '', // Bird Dog
  // ---- Cardio ----
  incline_walk: '', // Incline Treadmill Walk
  treadmill_run: '', // Treadmill Run
  bike: '', // Stationary Bike
  rower: '', // Rowing Machine
  elliptical: '', // Elliptical
  stair_climber: '', // Stair Climber
  jump_rope: '', // Jump Rope
  brisk_walk: '', // Brisk Walk
  easy_run: '', // Easy Run
  jump_squat: '', // Jump Squat
};

function youtubeId(v) {
  v = String(v || '').trim();
  if (!v) return '';
  const m = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
}
EXERCISES.forEach(e => { const id = youtubeId(VIDEO_LINKS[e.id]); if (id) e.videoId = id; });
