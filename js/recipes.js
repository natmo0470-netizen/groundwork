/* Movla — ingredient catalog and built-in recipe library.
   Ingredient row: [key, name, aisle, unit, kcal, protein, carbs, fat, price per unit (USD, estimate),
                    flags, store search term, pantry staple?]
   Flags: m = meat/poultry, f = fish, h = shellfish, d = dairy, g = gluten, e = egg, n = nuts/peanuts, s = soy, p = pork, b = beef
   Nutrition values are approximate USD/USDA-style per unit (raw weight for meat and fish). */
const INGREDIENT_ROWS = [
  // Meat & seafood (per oz raw)
  ['chicken_breast', 'Chicken breast', 'Meat & Seafood', 'oz', 34, 6.5, 0, 0.7, 0.25, 'm', 'boneless skinless chicken breast'],
  ['chicken_thigh', 'Chicken thighs', 'Meat & Seafood', 'oz', 34, 5.6, 0, 1.2, 0.2, 'm', 'boneless skinless chicken thighs'],
  ['ground_turkey', 'Ground turkey 93/7', 'Meat & Seafood', 'oz', 42, 5.3, 0, 2.3, 0.3, 'm', '93% lean ground turkey'],
  ['ground_beef', 'Lean ground beef 90/10', 'Meat & Seafood', 'oz', 50, 5.7, 0, 2.8, 0.35, 'mb', '90% lean ground beef'],
  ['sirloin', 'Sirloin steak', 'Meat & Seafood', 'oz', 45, 6.2, 0, 2.1, 0.6, 'mb', 'sirloin steak'],
  ['pork_tenderloin', 'Pork tenderloin', 'Meat & Seafood', 'oz', 34, 5.9, 0, 1, 0.3, 'mp', 'pork tenderloin'],
  ['salmon', 'Salmon fillet', 'Meat & Seafood', 'oz', 58, 5.6, 0, 3.8, 0.7, 'f', 'salmon fillet'],
  ['shrimp', 'Shrimp, peeled', 'Meat & Seafood', 'oz', 24, 5.7, 0, 0.1, 0.6, 'h', 'peeled shrimp'],
  ['cod', 'Cod fillet', 'Meat & Seafood', 'oz', 23, 5, 0, 0.2, 0.55, 'f', 'cod fillet'],
  ['turkey_deli', 'Sliced deli turkey', 'Meat & Seafood', 'oz', 30, 6, 0.5, 0.5, 0.6, 'm', 'sliced turkey breast deli'],
  ['bacon', 'Bacon', 'Meat & Seafood', 'slice', 43, 3, 0, 3.3, 0.4, 'mp', 'bacon'],
  ['chicken_sausage', 'Chicken sausage', 'Meat & Seafood', 'link', 140, 14, 3, 8, 1.5, 'm', 'chicken sausage links'],
  ['tuna', 'Tuna, canned in water', 'Canned & Jarred', 'can', 150, 33, 0, 1, 1.5, 'f', 'canned tuna in water'],
  ['jerky', 'Beef jerky', 'Snacks', 'oz', 116, 9, 3, 7, 1.5, 'mb', 'beef jerky'],
  // Dairy & eggs
  ['egg', 'Eggs', 'Dairy & Eggs', 'egg', 72, 6.3, 0.4, 4.8, 0.3, 'e', 'eggs'],
  ['egg_white', 'Liquid egg whites', 'Dairy & Eggs', 'cup', 126, 26, 2, 0, 1.3, 'e', 'liquid egg whites'],
  ['greek_yogurt', 'Greek yogurt, nonfat plain', 'Dairy & Eggs', 'cup', 130, 23, 9, 0.7, 1.4, 'd', 'plain nonfat greek yogurt'],
  ['cottage_cheese', 'Cottage cheese, low-fat', 'Dairy & Eggs', 'cup', 180, 24, 10, 5, 1.5, 'd', 'low fat cottage cheese'],
  ['milk', 'Milk, 2%', 'Dairy & Eggs', 'cup', 122, 8, 12, 5, 0.25, 'd', '2% milk'],
  ['almond_milk', 'Almond milk, unsweetened', 'Dairy & Eggs', 'cup', 30, 1, 1, 2.5, 0.25, 'n', 'unsweetened almond milk'],
  ['cheddar', 'Cheddar cheese', 'Dairy & Eggs', 'oz', 114, 7, 0.4, 9.4, 0.4, 'd', 'shredded cheddar cheese'],
  ['mozzarella', 'Mozzarella, part-skim', 'Dairy & Eggs', 'oz', 72, 7, 1, 4.5, 0.4, 'd', 'part skim mozzarella'],
  ['feta', 'Feta cheese', 'Dairy & Eggs', 'oz', 75, 4, 1, 6, 0.6, 'd', 'crumbled feta'],
  ['parmesan', 'Parmesan, grated', 'Dairy & Eggs', 'tbsp', 21, 2, 0.2, 1.4, 0.3, 'd', 'grated parmesan'],
  ['butter', 'Butter', 'Dairy & Eggs', 'tbsp', 102, 0, 0, 11.5, 0.15, 'd', 'butter'],
  ['string_cheese', 'String cheese', 'Dairy & Eggs', 'stick', 80, 7, 1, 6, 0.5, 'd', 'string cheese'],
  ['tofu', 'Firm tofu', 'Produce', 'oz', 22, 2.5, 0.6, 1.3, 0.2, 's', 'firm tofu'],
  // Protein & supplements
  ['whey', 'Whey protein powder', 'Protein & Supplements', 'scoop', 120, 24, 3, 1.5, 1.0, 'd', 'whey protein powder'],
  ['plant_protein', 'Plant protein powder', 'Protein & Supplements', 'scoop', 130, 21, 6, 3, 1.3, '', 'plant protein powder'],
  ['protein_bar', 'Protein bar', 'Protein & Supplements', 'bar', 210, 20, 22, 7, 1.8, 'd', 'protein bar'],
  // Grains, bread & pasta
  ['oats', 'Rolled oats', 'Grains & Pasta', 'cup', 300, 10, 54, 5, 0.5, '', 'old fashioned rolled oats'],
  ['rice', 'White rice (cooked)', 'Grains & Pasta', 'cup', 205, 4.3, 45, 0.4, 0.15, '', 'long grain white rice'],
  ['brown_rice', 'Brown rice (cooked)', 'Grains & Pasta', 'cup', 218, 4.5, 46, 1.6, 0.2, '', 'brown rice'],
  ['quinoa', 'Quinoa (cooked)', 'Grains & Pasta', 'cup', 222, 8, 39, 3.6, 0.6, '', 'quinoa'],
  ['pasta', 'Pasta (dry)', 'Grains & Pasta', 'oz', 100, 3.5, 20, 0.4, 0.12, 'g', 'penne pasta'],
  ['ww_pasta', 'Whole wheat pasta (dry)', 'Grains & Pasta', 'oz', 100, 4, 20, 0.6, 0.15, 'g', 'whole wheat pasta'],
  ['rice_noodles', 'Rice noodles (dry)', 'Grains & Pasta', 'oz', 104, 1.7, 24, 0.2, 0.25, '', 'rice noodles'],
  ['bread', 'Whole wheat bread', 'Bakery', 'slice', 82, 4, 14, 1, 0.2, 'g', 'whole wheat bread'],
  ['tortilla', 'Flour tortillas, 8"', 'Bakery', 'tortilla', 146, 4, 25, 3.5, 0.3, 'g', 'flour tortillas'],
  ['corn_tortilla', 'Corn tortillas', 'Bakery', 'tortilla', 57, 1.5, 12, 0.7, 0.1, '', 'corn tortillas'],
  ['english_muffin', 'Whole wheat English muffins', 'Bakery', 'muffin', 134, 5, 26, 1, 0.5, 'g', 'whole wheat english muffins'],
  ['pita', 'Whole wheat pita', 'Bakery', 'pita', 170, 6, 35, 1.7, 0.6, 'g', 'whole wheat pita'],
  ['granola', 'Granola', 'Grains & Pasta', 'cup', 540, 12, 76, 22, 2.0, 'n', 'granola'],
  ['rice_cakes', 'Rice cakes', 'Snacks', 'cake', 35, 0.7, 7.3, 0.3, 0.2, '', 'plain rice cakes'],
  ['popcorn', 'Popcorn (popped)', 'Snacks', 'cup', 31, 1, 6, 0.4, 0.1, '', 'popcorn kernels'],
  // Produce
  ['banana', 'Bananas', 'Produce', 'banana', 105, 1.3, 27, 0.4, 0.25, '', 'bananas'],
  ['apple', 'Apples', 'Produce', 'apple', 95, 0.5, 25, 0.3, 0.7, '', 'apples'],
  ['orange', 'Oranges', 'Produce', 'orange', 62, 1.2, 15, 0.2, 0.7, '', 'oranges'],
  ['berries', 'Mixed berries (frozen)', 'Frozen', 'cup', 70, 1, 17, 0.5, 1.5, '', 'frozen mixed berries'],
  ['strawberries', 'Strawberries', 'Produce', 'cup', 49, 1, 12, 0.5, 1.2, '', 'strawberries'],
  ['spinach', 'Baby spinach', 'Produce', 'cup', 7, 0.9, 1.1, 0.1, 0.4, '', 'baby spinach'],
  ['greens', 'Mixed greens / romaine', 'Produce', 'cup', 8, 0.6, 1.5, 0.1, 0.5, '', 'romaine lettuce'],
  ['broccoli', 'Broccoli', 'Produce', 'cup', 31, 2.6, 6, 0.3, 0.6, '', 'broccoli crowns'],
  ['bell_pepper', 'Bell peppers', 'Produce', 'pepper', 31, 1, 7, 0.4, 1.0, '', 'bell peppers'],
  ['onion', 'Onions', 'Produce', 'onion', 44, 1.2, 10, 0.1, 0.6, '', 'yellow onions'],
  ['garlic', 'Garlic', 'Produce', 'clove', 4, 0.2, 1, 0, 0.1, '', 'garlic'],
  ['tomato', 'Tomatoes', 'Produce', 'tomato', 22, 1, 5, 0.2, 0.6, '', 'tomatoes'],
  ['cherry_tomatoes', 'Cherry tomatoes', 'Produce', 'cup', 27, 1.3, 6, 0.3, 1.2, '', 'cherry tomatoes'],
  ['cucumber', 'Cucumbers', 'Produce', 'cucumber', 45, 2, 11, 0.3, 0.8, '', 'cucumbers'],
  ['carrot', 'Carrots', 'Produce', 'carrot', 25, 0.6, 6, 0.1, 0.2, '', 'carrots'],
  ['zucchini', 'Zucchini', 'Produce', 'zucchini', 33, 2.4, 6, 0.6, 0.9, '', 'zucchini'],
  ['avocado', 'Avocados', 'Produce', 'avocado', 240, 3, 13, 22, 1.2, '', 'avocados'],
  ['lemon', 'Lemons', 'Produce', 'lemon', 17, 0.6, 5, 0.2, 0.6, '', 'lemons'],
  ['lime', 'Limes', 'Produce', 'lime', 20, 0.5, 7, 0.1, 0.4, '', 'limes'],
  ['green_beans', 'Green beans', 'Produce', 'cup', 31, 1.8, 7, 0.2, 0.6, '', 'green beans'],
  ['asparagus', 'Asparagus', 'Produce', 'cup', 27, 3, 5, 0.2, 1.5, '', 'asparagus'],
  ['mushrooms', 'Mushrooms', 'Produce', 'cup', 15, 2.2, 2.3, 0.2, 0.8, '', 'sliced mushrooms'],
  ['cilantro', 'Cilantro', 'Produce', 'bunch', 5, 0.5, 1, 0.1, 1.0, '', 'cilantro'],
  ['potato', 'Potatoes', 'Produce', 'potato', 161, 4.3, 37, 0.2, 0.5, '', 'russet potatoes'],
  ['sweet_potato', 'Sweet potatoes', 'Produce', 'sweet potato', 112, 2, 26, 0.1, 0.8, '', 'sweet potatoes'],
  ['frozen_veg', 'Frozen stir-fry vegetables', 'Frozen', 'cup', 59, 3, 12, 0.1, 0.7, '', 'frozen stir fry vegetables'],
  ['corn', 'Frozen corn', 'Frozen', 'cup', 125, 4.5, 27, 2, 0.5, '', 'frozen sweet corn'],
  ['edamame', 'Shelled edamame (frozen)', 'Frozen', 'cup', 188, 18, 14, 8, 1.2, 's', 'frozen shelled edamame'],
  // Canned, jarred & legumes
  ['black_beans', 'Black beans (canned)', 'Canned & Jarred', 'cup', 220, 14, 40, 1, 0.6, '', 'canned black beans'],
  ['chickpeas', 'Chickpeas (canned)', 'Canned & Jarred', 'cup', 270, 14, 45, 4, 0.6, '', 'canned chickpeas'],
  ['white_beans', 'White beans (canned)', 'Canned & Jarred', 'cup', 250, 17, 45, 0.6, 0.6, '', 'canned cannellini beans'],
  ['lentils', 'Lentils (cooked)', 'Canned & Jarred', 'cup', 230, 18, 40, 0.8, 0.3, '', 'dry lentils'],
  ['marinara', 'Marinara sauce', 'Canned & Jarred', 'cup', 140, 4, 22, 4, 1.2, '', 'marinara sauce'],
  ['diced_tomatoes', 'Diced tomatoes (canned)', 'Canned & Jarred', 'cup', 40, 2, 9, 0, 0.6, '', 'canned diced tomatoes'],
  ['coconut_milk', 'Light coconut milk', 'Canned & Jarred', 'cup', 150, 1, 3, 15, 1.5, '', 'light coconut milk'],
  ['chicken_broth', 'Chicken broth', 'Canned & Jarred', 'cup', 15, 2, 1, 0.5, 0.4, 'm', 'low sodium chicken broth'],
  ['veg_broth', 'Vegetable broth', 'Canned & Jarred', 'cup', 15, 0.5, 3, 0, 0.4, '', 'vegetable broth'],
  ['salsa', 'Salsa', 'Canned & Jarred', 'tbsp', 5, 0.3, 1, 0, 0.1, '', 'salsa'],
  ['hummus', 'Hummus', 'Dairy & Eggs', 'tbsp', 35, 1, 2, 2.5, 0.2, '', 'hummus'],
  ['peanut_butter', 'Peanut butter', 'Condiments & Spices', 'tbsp', 95, 3.5, 3.5, 8, 0.12, 'n', 'peanut butter'],
  ['pesto', 'Basil pesto', 'Canned & Jarred', 'tbsp', 80, 1, 1, 8, 0.4, 'dn', 'basil pesto'],
  // Snacks & nuts
  ['almonds', 'Almonds', 'Snacks', 'oz', 164, 6, 6, 14, 0.5, 'n', 'almonds'],
  ['mixed_nuts', 'Mixed nuts', 'Snacks', 'oz', 170, 5, 7, 15, 0.6, 'n', 'mixed nuts'],
  ['dark_choc', 'Dark chocolate 70%', 'Snacks', 'oz', 170, 2, 13, 12, 0.8, '', 'dark chocolate bar'],
  ['chia', 'Chia seeds', 'Snacks', 'tbsp', 58, 2, 5, 3.7, 0.3, '', 'chia seeds'],
  // Pantry staples
  ['olive_oil', 'Olive oil', 'Condiments & Spices', 'tbsp', 119, 0, 0, 13.5, 0.15, '', 'olive oil', true],
  ['soy_sauce', 'Soy sauce', 'Condiments & Spices', 'tbsp', 9, 1, 1, 0, 0.1, 'gs', 'soy sauce', true],
  ['teriyaki', 'Teriyaki sauce', 'Condiments & Spices', 'tbsp', 16, 1, 3, 0, 0.15, 'gs', 'teriyaki sauce', true],
  ['honey', 'Honey', 'Condiments & Spices', 'tbsp', 64, 0, 17, 0, 0.15, '', 'honey', true],
  ['maple', 'Maple syrup', 'Condiments & Spices', 'tbsp', 52, 0, 13, 0, 0.4, '', 'maple syrup', true],
  ['mayo', 'Mayonnaise', 'Condiments & Spices', 'tbsp', 94, 0, 0, 10, 0.1, 'e', 'mayonnaise', true],
  ['vinaigrette', 'Vinaigrette dressing', 'Condiments & Spices', 'tbsp', 45, 0, 1.5, 4.5, 0.15, '', 'balsamic vinaigrette', true],
  ['mustard', 'Mustard', 'Condiments & Spices', 'tsp', 3, 0.2, 0.3, 0.2, 0.03, '', 'dijon mustard', true],
  ['taco_seasoning', 'Taco seasoning', 'Condiments & Spices', 'tbsp', 20, 0, 4, 0, 0.2, '', 'taco seasoning', true],
  ['italian_seasoning', 'Italian seasoning', 'Condiments & Spices', 'tsp', 3, 0.1, 0.6, 0.1, 0.05, '', 'italian seasoning', true],
  ['chili_powder', 'Chili powder', 'Condiments & Spices', 'tsp', 8, 0.4, 1.4, 0.4, 0.05, '', 'chili powder', true],
  ['cumin', 'Ground cumin', 'Condiments & Spices', 'tsp', 8, 0.4, 0.9, 0.5, 0.05, '', 'ground cumin', true],
  ['curry_powder', 'Curry powder', 'Condiments & Spices', 'tsp', 7, 0.3, 1.2, 0.3, 0.05, '', 'curry powder', true],
  ['cinnamon', 'Cinnamon', 'Condiments & Spices', 'tsp', 6, 0.1, 2, 0, 0.05, '', 'ground cinnamon', true],
  ['sriracha', 'Sriracha', 'Condiments & Spices', 'tsp', 5, 0.1, 1, 0, 0.05, '', 'sriracha', true],
];
const INGR = {};
INGREDIENT_ROWS.forEach(r => {
  INGR[r[0]] = { key: r[0], name: r[1], aisle: r[2], unit: r[3], kcal: r[4], p: r[5], c: r[6], f: r[7], price: r[8], flags: r[9], q: r[10], pantry: !!r[11] };
});

/* Recipe: R(id, name, meal types, minutes, ingredients per serving [[key, qty]], steps, options)
   options: batch (keeps well as next-day leftovers), note */
const RECIPES = [];
function R(id, name, meals, minutes, ingredients, steps, opts) {
  RECIPES.push(Object.assign({ id, name, meals, minutes, ingredients, steps, batch: false, source: 'built-in' }, opts || {}));
}
const LD = ['lunch', 'dinner'];

// ---------- Breakfast ----------
R('protein_oats', 'Overnight protein oats', ['breakfast'], 5, [['oats', 0.5], ['whey', 1], ['milk', 0.75], ['chia', 1], ['berries', 0.5]],
  ['Stir oats, protein powder, chia and milk in a jar.', 'Top with berries.', 'Refrigerate overnight; eat cold or warmed.']);
R('df_oats', 'Dairy-free overnight oats', ['breakfast'], 5, [['oats', 0.5], ['plant_protein', 1], ['almond_milk', 1], ['chia', 1], ['banana', 0.5]],
  ['Mix oats, protein powder, chia and almond milk.', 'Slice banana on top.', 'Refrigerate overnight.']);
R('yogurt_parfait', 'Greek yogurt parfait', ['breakfast', 'snack'], 5, [['greek_yogurt', 1], ['berries', 0.5], ['granola', 0.25], ['honey', 0.5]],
  ['Layer yogurt and berries in a bowl or jar.', 'Top with granola and a drizzle of honey.']);
R('veggie_scramble', 'Veggie egg scramble with toast', ['breakfast'], 12, [['egg', 3], ['spinach', 1], ['bell_pepper', 0.5], ['cheddar', 0.5], ['bread', 1], ['olive_oil', 0.5]],
  ['Sauté diced pepper in oil for 2 minutes, add spinach until wilted.', 'Add beaten eggs and stir gently until just set.', 'Top with cheddar; serve with toast.']);
R('egg_white_omelet', 'Egg white omelet with feta', ['breakfast'], 12, [['egg_white', 1], ['egg', 1], ['mushrooms', 0.5], ['spinach', 1], ['feta', 0.5], ['bread', 1]],
  ['Cook mushrooms in a nonstick pan until browned.', 'Pour in whisked egg whites and egg; add spinach.', 'Fold with feta inside; serve with toast.']);
R('breakfast_burrito', 'Breakfast burrito', ['breakfast'], 12, [['egg', 2], ['black_beans', 0.25], ['cheddar', 0.5], ['tortilla', 1], ['salsa', 2]],
  ['Scramble eggs; warm beans.', 'Fill tortilla with eggs, beans, cheese and salsa.', 'Roll up; toast seam-side down for a minute.'], { note: 'Make 5 and freeze for busy mornings.' });
R('pb_banana_toast', 'Peanut butter banana toast', ['breakfast'], 5, [['bread', 2], ['peanut_butter', 1.5], ['banana', 1], ['cinnamon', 0.25]],
  ['Toast bread.', 'Spread peanut butter, top with sliced banana and cinnamon.']);
R('protein_pancakes', 'Banana oat protein pancakes', ['breakfast'], 15, [['oats', 0.5], ['egg', 1], ['egg_white', 0.5], ['banana', 0.5], ['maple', 1]],
  ['Blend oats, egg, egg whites and banana into a batter.', 'Cook small pancakes on a hot nonstick pan, 2 minutes per side.', 'Serve with maple syrup.']);
R('cottage_bowl', 'Cottage cheese berry bowl', ['breakfast', 'snack'], 3, [['cottage_cheese', 1], ['berries', 0.75], ['almonds', 0.5], ['honey', 0.5]],
  ['Spoon cottage cheese into a bowl.', 'Top with berries, chopped almonds and honey.']);
R('berry_smoothie', 'Berry protein smoothie', ['breakfast'], 5, [['whey', 1], ['berries', 1], ['banana', 0.5], ['milk', 1], ['peanut_butter', 1]],
  ['Blend everything until smooth.', 'Add ice or water to thin.']);
R('vegan_smoothie', 'Vegan berry smoothie', ['breakfast'], 5, [['plant_protein', 1], ['almond_milk', 1], ['berries', 1], ['banana', 0.5], ['chia', 1]],
  ['Blend everything until smooth.']);
R('avocado_egg_toast', 'Avocado toast with eggs', ['breakfast'], 10, [['bread', 2], ['avocado', 0.5], ['egg', 2]],
  ['Toast bread and mash avocado on top with salt and pepper.', 'Fry or poach eggs and place on the toast.']);
R('bacon_eggs_potatoes', 'Bacon, eggs and potatoes', ['breakfast'], 20, [['egg', 2], ['bacon', 2], ['potato', 0.75], ['olive_oil', 0.5]],
  ['Dice potato and pan-fry in oil until crisp, about 12 minutes.', 'Cook bacon in another pan.', 'Fry eggs and serve together.']);
R('tofu_scramble', 'Tofu scramble tacos', ['breakfast'], 12, [['tofu', 6], ['spinach', 1], ['bell_pepper', 0.5], ['onion', 0.25], ['olive_oil', 0.5], ['corn_tortilla', 2], ['cumin', 0.5]],
  ['Crumble tofu into a pan with oil, onion and pepper.', 'Season with cumin, salt and pepper; add spinach.', 'Serve in warm tortillas.']);
R('muffin_sandwich', 'Egg and turkey breakfast sandwich', ['breakfast'], 8, [['english_muffin', 1], ['egg', 1], ['egg_white', 0.25], ['cheddar', 0.5], ['turkey_deli', 1]],
  ['Toast the muffin.', 'Cook egg and egg whites as a flat omelet.', 'Stack with turkey and cheese.']);
R('chia_pudding', 'Vanilla chia pudding', ['breakfast', 'snack'], 5, [['chia', 3], ['almond_milk', 1], ['plant_protein', 0.5], ['berries', 0.5], ['maple', 0.5]],
  ['Whisk chia, almond milk, protein powder and maple.', 'Refrigerate at least 4 hours.', 'Top with berries.']);

// ---------- Lunch & dinner ----------
R('chicken_rice_broccoli', 'Chicken, rice and broccoli', LD, 25, [['chicken_breast', 5], ['rice', 1], ['broccoli', 1], ['olive_oil', 0.5], ['soy_sauce', 1], ['garlic', 1]],
  ['Season chicken; sear in oil 5–6 minutes per side until 165°F inside.', 'Steam broccoli 4 minutes.', 'Slice chicken over rice and broccoli; drizzle soy sauce.'], { batch: true });
R('chicken_burrito_bowl', 'Chicken burrito bowl', LD, 25, [['chicken_breast', 5], ['brown_rice', 0.75], ['black_beans', 0.5], ['salsa', 3], ['cheddar', 0.5], ['greens', 1], ['taco_seasoning', 0.5]],
  ['Toss chicken in taco seasoning and cook through.', 'Warm rice and beans.', 'Build bowls: greens, rice, beans, chicken, salsa and cheese.'], { batch: true });
R('turkey_tacos', 'Turkey tacos', LD, 15, [['ground_turkey', 4], ['corn_tortilla', 3], ['taco_seasoning', 0.5], ['salsa', 2], ['avocado', 0.25], ['greens', 0.5]],
  ['Brown turkey; add taco seasoning and a splash of water.', 'Warm tortillas.', 'Fill with turkey, lettuce, avocado and salsa.']);
R('beef_broccoli', 'Beef and broccoli stir-fry', LD, 20, [['sirloin', 5], ['broccoli', 1.5], ['rice', 1], ['soy_sauce', 1.5], ['garlic', 1], ['olive_oil', 0.5]],
  ['Slice steak thin; sear in a hot pan 2 minutes.', 'Add broccoli, garlic and a splash of water; cover 3 minutes.', 'Stir in soy sauce; serve over rice.'], { batch: true });
R('salmon_sweet_potato', 'Salmon, sweet potato and green beans', ['dinner'], 30, [['salmon', 5], ['sweet_potato', 1], ['green_beans', 1], ['olive_oil', 0.5], ['lemon', 0.25]],
  ['Cube sweet potato, toss in half the oil; roast at 425°F for 25 minutes.', 'Add salmon and green beans to the pan for the last 12 minutes.', 'Finish with lemon.']);
R('shrimp_fried_rice', 'Shrimp fried rice', LD, 15, [['shrimp', 5], ['rice', 1], ['frozen_veg', 1], ['egg', 1], ['soy_sauce', 1.5], ['olive_oil', 0.5]],
  ['Cook shrimp in oil 2 minutes; set aside.', 'Stir-fry vegetables, push aside and scramble the egg.', 'Add rice, shrimp and soy sauce; toss until hot.']);
R('turkey_chili', 'Turkey and bean chili', LD, 35, [['ground_turkey', 4], ['black_beans', 0.5], ['diced_tomatoes', 0.75], ['onion', 0.25], ['chili_powder', 1], ['cumin', 0.5], ['cheddar', 0.25]],
  ['Brown turkey and onion.', 'Add beans, tomatoes and spices; simmer 20 minutes.', 'Top with cheddar.'], { batch: true });
R('lentil_soup', 'Hearty lentil soup', LD, 35, [['lentils', 1], ['carrot', 1], ['onion', 0.25], ['diced_tomatoes', 0.5], ['veg_broth', 1.5], ['spinach', 1], ['olive_oil', 0.5], ['cumin', 0.5]],
  ['Soften onion and carrot in oil.', 'Add lentils, tomatoes, broth and cumin; simmer 20 minutes.', 'Stir in spinach before serving.'], { batch: true });
R('chickpea_curry', 'Chickpea spinach curry', LD, 25, [['chickpeas', 0.75], ['coconut_milk', 0.5], ['diced_tomatoes', 0.5], ['spinach', 1], ['onion', 0.25], ['rice', 0.75], ['curry_powder', 1]],
  ['Soften onion; add curry powder for 30 seconds.', 'Add chickpeas, tomatoes and coconut milk; simmer 10 minutes.', 'Stir in spinach; serve over rice.'], { batch: true });
R('tofu_teriyaki', 'Teriyaki tofu bowl', LD, 25, [['tofu', 6], ['brown_rice', 0.75], ['broccoli', 1], ['teriyaki', 2], ['edamame', 0.25], ['olive_oil', 0.5]],
  ['Press and cube tofu; pan-fry in oil until golden.', 'Steam broccoli and edamame.', 'Toss tofu in teriyaki; serve over rice.']);
R('turkey_pasta', 'Turkey bolognese pasta', LD, 25, [['ww_pasta', 3], ['ground_turkey', 4], ['marinara', 0.5], ['parmesan', 1], ['spinach', 1]],
  ['Boil pasta.', 'Brown turkey; add marinara and spinach, simmer 5 minutes.', 'Toss with pasta; top with parmesan.'], { batch: true });
R('chicken_pesto_pasta', 'Chicken pesto pasta', LD, 20, [['pasta', 2.5], ['chicken_breast', 4], ['pesto', 1.5], ['cherry_tomatoes', 0.5], ['spinach', 1]],
  ['Boil pasta.', 'Cook diced chicken through.', 'Toss everything with pesto and halved tomatoes.'], { batch: true });
R('greek_chicken_wrap', 'Greek chicken wrap', ['lunch'], 15, [['tortilla', 1], ['chicken_breast', 4], ['cucumber', 0.25], ['tomato', 0.5], ['feta', 0.5], ['hummus', 2], ['greens', 0.5]],
  ['Cook and slice chicken (or use leftover chicken).', 'Spread hummus on the tortilla.', 'Add chicken, veg and feta; roll tight.']);
R('tuna_sandwich', 'Tuna salad sandwich', ['lunch'], 8, [['tuna', 1], ['mayo', 1], ['greek_yogurt', 0.25], ['bread', 2], ['greens', 0.5]],
  ['Mix tuna with mayo and yogurt; season.', 'Pile onto bread with lettuce.']);
R('turkey_sandwich', 'Turkey and cheddar sandwich with apple', ['lunch'], 5, [['bread', 2], ['turkey_deli', 4], ['cheddar', 0.5], ['mustard', 1], ['tomato', 0.5], ['apple', 1]],
  ['Layer turkey, cheese, tomato and mustard on bread.', 'Serve with an apple.']);
R('chicken_caesar', 'Chicken Caesar-style salad', ['lunch', 'dinner'], 15, [['chicken_breast', 5], ['greens', 3], ['parmesan', 2], ['vinaigrette', 2], ['pita', 0.5]],
  ['Cook and slice chicken.', 'Toss romaine with dressing and parmesan.', 'Top with chicken; serve with toasted pita.']);
R('cobb_salad', 'Cobb salad', LD, 20, [['chicken_breast', 4], ['egg', 1], ['bacon', 1], ['avocado', 0.25], ['greens', 3], ['cherry_tomatoes', 0.5], ['vinaigrette', 1.5]],
  ['Cook chicken and bacon; hard-boil the egg.', 'Arrange everything in rows over the greens.', 'Drizzle with dressing.']);
R('quinoa_bean_salad', 'Quinoa black bean salad', LD, 20, [['quinoa', 1], ['black_beans', 0.5], ['corn', 0.5], ['bell_pepper', 0.5], ['lime', 0.5], ['olive_oil', 0.5], ['cilantro', 0.25]],
  ['Cook quinoa and let it cool.', 'Toss with beans, corn, diced pepper and cilantro.', 'Dress with lime juice, oil, salt and pepper.'], { batch: true });
R('med_chickpea_bowl', 'Mediterranean chickpea bowl', LD, 15, [['quinoa', 0.75], ['chickpeas', 0.5], ['cucumber', 0.5], ['cherry_tomatoes', 0.5], ['feta', 0.5], ['hummus', 2], ['lemon', 0.25], ['olive_oil', 0.5]],
  ['Warm quinoa and chickpeas.', 'Top with chopped cucumber, tomatoes and feta.', 'Add hummus, lemon and a drizzle of oil.'], { batch: true });
R('chicken_fajitas', 'Sheet-pan chicken fajitas', LD, 25, [['chicken_breast', 5], ['bell_pepper', 1], ['onion', 0.5], ['tortilla', 2], ['olive_oil', 0.5], ['taco_seasoning', 0.5], ['salsa', 2]],
  ['Slice chicken, peppers and onion; toss with oil and seasoning.', 'Roast at 425°F for 18–20 minutes.', 'Serve in warm tortillas with salsa.'], { batch: true });
R('pork_potatoes', 'Pork tenderloin, potatoes and green beans', ['dinner'], 35, [['pork_tenderloin', 5], ['potato', 1], ['green_beans', 1], ['olive_oil', 0.5], ['garlic', 1]],
  ['Rub pork with garlic, salt and pepper; sear all sides.', 'Roast with cubed potatoes at 425°F for 20 minutes (145°F inside).', 'Steam green beans; rest pork 5 minutes before slicing.'], { batch: true });
R('garlic_shrimp_pasta', 'Garlic shrimp zucchini pasta', ['dinner'], 20, [['shrimp', 5], ['pasta', 2], ['zucchini', 1], ['garlic', 2], ['olive_oil', 0.75], ['parmesan', 1], ['lemon', 0.25]],
  ['Boil pasta.', 'Sauté garlic and sliced zucchini in oil; add shrimp for 3 minutes.', 'Toss with pasta, lemon and parmesan.']);
R('cod_tacos', 'Cod fish tacos', LD, 20, [['cod', 5], ['corn_tortilla', 3], ['greens', 0.5], ['avocado', 0.25], ['lime', 0.5], ['salsa', 2], ['chili_powder', 0.5]],
  ['Season cod with chili powder; bake at 400°F for 10–12 minutes.', 'Flake into warm tortillas.', 'Top with lettuce, avocado, salsa and lime.']);
R('sausage_sheet_pan', 'Chicken sausage sheet-pan dinner', LD, 30, [['chicken_sausage', 1.5], ['sweet_potato', 0.75], ['broccoli', 1], ['bell_pepper', 0.5], ['olive_oil', 0.5]],
  ['Cube sweet potato and veg; toss with oil.', 'Add sliced sausage.', 'Roast at 425°F for 25 minutes, stirring once.'], { batch: true });
R('beef_taco_bowl', 'Beef taco rice bowl', LD, 20, [['ground_beef', 4], ['rice', 0.75], ['black_beans', 0.25], ['corn', 0.25], ['salsa', 2], ['cheddar', 0.5], ['taco_seasoning', 0.5]],
  ['Brown beef with taco seasoning.', 'Warm rice, beans and corn.', 'Assemble with salsa and cheese.'], { batch: true });
R('veg_fried_rice', 'Vegetable egg fried rice', LD, 15, [['egg', 3], ['rice', 1], ['frozen_veg', 1], ['edamame', 0.5], ['soy_sauce', 1], ['olive_oil', 0.5]],
  ['Stir-fry vegetables and edamame in oil.', 'Push aside; scramble eggs.', 'Add rice and soy sauce; toss until hot.']);
R('loaded_potato', 'Loaded baked potato', LD, 15, [['potato', 1], ['greek_yogurt', 0.5], ['cheddar', 0.5], ['broccoli', 1], ['black_beans', 0.25]],
  ['Microwave a pierced potato 6–8 minutes until soft.', 'Steam broccoli; warm beans.', 'Split potato; top with beans, broccoli, cheese and yogurt.']);
R('peanut_tofu_noodles', 'Peanut tofu noodles', LD, 20, [['rice_noodles', 2], ['tofu', 5], ['peanut_butter', 1.5], ['soy_sauce', 1], ['frozen_veg', 1], ['lime', 0.5]],
  ['Soak or boil rice noodles.', 'Pan-fry tofu; stir-fry vegetables.', 'Whisk peanut butter, soy sauce, lime and warm water; toss everything.']);
R('coconut_chicken_curry', 'Coconut chicken curry', LD, 30, [['chicken_thigh', 5], ['coconut_milk', 0.5], ['frozen_veg', 1], ['rice', 0.75], ['curry_powder', 1], ['onion', 0.25]],
  ['Brown diced chicken and onion.', 'Add curry powder, coconut milk and vegetables; simmer 15 minutes.', 'Serve over rice.'], { batch: true });
R('turkey_burger', 'Turkey burger with sweet potato wedges', ['dinner'], 30, [['ground_turkey', 5], ['english_muffin', 1], ['sweet_potato', 1], ['olive_oil', 0.5], ['greens', 0.5], ['tomato', 0.5]],
  ['Cut sweet potato into wedges; roast at 425°F for 25 minutes.', 'Form turkey into a patty; cook 5 minutes per side (165°F).', 'Serve on a toasted muffin with lettuce and tomato.']);
R('steak_potato', 'Steak, potatoes and asparagus', ['dinner'], 30, [['sirloin', 6], ['potato', 1], ['asparagus', 1], ['olive_oil', 0.5], ['butter', 0.5]],
  ['Roast cubed potatoes at 425°F for 25 minutes; add asparagus for the last 10.', 'Sear steak 3–4 minutes per side; rest 5 minutes.', 'Top steak with butter.']);
R('lemon_salmon_quinoa', 'Lemon herb salmon and quinoa', ['dinner'], 25, [['salmon', 5], ['quinoa', 0.75], ['asparagus', 1], ['lemon', 0.25], ['olive_oil', 0.5]],
  ['Bake salmon and asparagus at 400°F for 12–14 minutes.', 'Warm quinoa.', 'Finish with lemon and olive oil.']);
R('bean_quesadilla', 'Bean and cheese quesadilla', LD, 12, [['tortilla', 2], ['black_beans', 0.5], ['cheddar', 1], ['salsa', 3], ['bell_pepper', 0.5], ['greek_yogurt', 0.25]],
  ['Fill one tortilla with beans, cheese and pepper; top with the second.', 'Cook in a dry pan 3 minutes per side.', 'Serve with salsa and yogurt.']);
R('chicken_soup', 'Chicken noodle soup', LD, 30, [['chicken_breast', 4], ['pasta', 1.5], ['carrot', 1], ['onion', 0.25], ['chicken_broth', 2], ['spinach', 1]],
  ['Simmer diced chicken, carrot and onion in broth 15 minutes.', 'Add pasta; cook until tender.', 'Stir in spinach.'], { batch: true });
R('shrimp_noodle_stirfry', 'Teriyaki shrimp noodle stir-fry', LD, 15, [['shrimp', 5], ['rice_noodles', 2], ['frozen_veg', 1.5], ['teriyaki', 2], ['garlic', 1]],
  ['Soak noodles.', 'Stir-fry shrimp and vegetables with garlic.', 'Add noodles and teriyaki; toss.']);
R('tuna_poke_bowl', 'Tuna rice bowl', ['lunch'], 10, [['tuna', 1], ['rice', 0.75], ['cucumber', 0.5], ['edamame', 0.5], ['avocado', 0.25], ['soy_sauce', 1], ['sriracha', 1]],
  ['Warm rice.', 'Top with tuna, sliced cucumber, edamame and avocado.', 'Drizzle with soy sauce and sriracha.']);
R('thigh_roast_veg', 'Roast chicken thighs and vegetables', ['dinner'], 35, [['chicken_thigh', 5], ['zucchini', 1], ['bell_pepper', 0.5], ['onion', 0.25], ['potato', 0.75], ['olive_oil', 0.5], ['italian_seasoning', 1]],
  ['Toss chicken and chopped vegetables with oil and seasoning.', 'Roast at 425°F for 30 minutes (165°F inside).'], { batch: true });
R('pita_pizza', 'Pita pizza with side salad', LD, 12, [['pita', 1], ['marinara', 0.25], ['mozzarella', 1.5], ['mushrooms', 0.5], ['bell_pepper', 0.25], ['greens', 1], ['vinaigrette', 1]],
  ['Top pita with sauce, cheese and veg.', 'Bake at 425°F for 8 minutes.', 'Serve with dressed greens.']);
R('sweet_potato_tacos', 'Black bean sweet potato tacos', LD, 25, [['sweet_potato', 0.75], ['black_beans', 0.5], ['corn_tortilla', 3], ['avocado', 0.25], ['lime', 0.5], ['salsa', 2], ['cumin', 0.5]],
  ['Dice sweet potato; roast with cumin at 425°F for 20 minutes.', 'Warm beans and tortillas.', 'Fill tacos; top with avocado, salsa and lime.']);
R('white_bean_pasta', 'White bean and spinach pasta', LD, 20, [['ww_pasta', 3], ['white_beans', 0.5], ['spinach', 1], ['cherry_tomatoes', 0.5], ['garlic', 2], ['olive_oil', 0.75], ['parmesan', 1]],
  ['Boil pasta.', 'Sauté garlic and tomatoes in oil; add beans and spinach.', 'Toss with pasta and parmesan.'], { batch: true });

// ---------- Snacks ----------
R('yogurt_honey', 'Greek yogurt with honey', ['snack'], 2, [['greek_yogurt', 0.75], ['honey', 0.5]], ['Top yogurt with honey.']);
R('apple_pb', 'Apple and peanut butter', ['snack'], 2, [['apple', 1], ['peanut_butter', 1.5]], ['Slice apple; dip in peanut butter.']);
R('whey_shake', 'Protein shake', ['snack'], 2, [['whey', 1], ['milk', 1]], ['Shake protein powder with cold milk.']);
R('plant_shake', 'Plant protein shake', ['snack'], 2, [['plant_protein', 1], ['almond_milk', 1]], ['Shake protein powder with almond milk.']);
R('cottage_fruit', 'Cottage cheese and berries', ['snack'], 2, [['cottage_cheese', 0.5], ['berries', 0.5]], ['Top cottage cheese with berries.']);
R('hummus_veg', 'Hummus and veggies', ['snack'], 5, [['hummus', 3], ['carrot', 1], ['cucumber', 0.5]], ['Cut carrot and cucumber into sticks; dip.']);
R('boiled_eggs', 'Hard-boiled eggs', ['snack'], 12, [['egg', 2]], ['Boil eggs 10 minutes; cool in cold water.', 'Make a batch for the week.']);
R('cheese_almonds', 'String cheese and almonds', ['snack'], 1, [['string_cheese', 1], ['almonds', 0.5]], ['Grab and go.']);
R('jerky_orange', 'Jerky and an orange', ['snack'], 1, [['jerky', 1], ['orange', 1]], ['Grab and go.']);
R('bar_snack', 'Protein bar', ['snack'], 1, [['protein_bar', 1]], ['Grab and go.']);
R('ricecake_pb', 'Rice cakes with peanut butter and banana', ['snack'], 3, [['rice_cakes', 2], ['peanut_butter', 1], ['banana', 0.5]], ['Spread peanut butter on rice cakes; top with banana slices.']);
R('nuts_berries', 'Mixed nuts and strawberries', ['snack'], 1, [['mixed_nuts', 1], ['strawberries', 1]], ['Portion a small handful of nuts with fruit.']);
R('edamame_snack', 'Salted edamame', ['snack'], 5, [['edamame', 0.75]], ['Microwave frozen edamame 3 minutes; salt.']);
R('popcorn_choc', 'Popcorn and dark chocolate', ['snack'], 5, [['popcorn', 3], ['dark_choc', 0.5]], ['Air-pop popcorn; enjoy with a square of dark chocolate.']);
R('tuna_ricecakes', 'Tuna on rice cakes', ['snack'], 4, [['tuna', 0.5], ['rice_cakes', 2], ['mayo', 0.5], ['sriracha', 0.5]], ['Mix tuna with mayo and sriracha; spoon onto rice cakes.']);

/* ---------- derived values ---------- */
const RECIPE_BY_ID = {};
RECIPES.forEach(r => {
  const t = { kcal: 0, p: 0, c: 0, f: 0, cost: 0 };
  const flags = new Set();
  r.ingredients.forEach(([k, q]) => {
    const g = INGR[k];
    if (!g) { console.warn('Unknown ingredient', k, 'in', r.id); return; }
    t.kcal += g.kcal * q; t.p += g.p * q; t.c += g.c * q; t.f += g.f * q; t.cost += g.price * q;
    g.flags.split('').forEach(fl => flags.add(fl));
  });
  r.kcal = Math.round(t.kcal); r.p = Math.round(t.p); r.c = Math.round(t.c); r.f = Math.round(t.f);
  r.cost = Math.round(t.cost * 100) / 100;
  r.flags = [...flags].join('');
  RECIPE_BY_ID[r.id] = r;
});
