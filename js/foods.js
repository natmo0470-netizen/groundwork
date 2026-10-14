/* Groundwork — built-in food database (approximate USDA values per listed serving).
   Row: [name, serving label, kcal, protein g, carbs g, fat g, category]
   Online search (Open Food Facts) supplements this list when the network allows. */
const FOOD_ROWS = [
  // Protein — meat, fish, eggs
  ['Chicken breast, cooked', '4 oz (113 g)', 187, 35, 0, 4, 'Protein'],
  ['Chicken thigh, cooked, skinless', '4 oz (113 g)', 232, 28, 0, 13, 'Protein'],
  ['Ground beef 90/10, cooked', '4 oz (113 g)', 245, 30, 0, 13, 'Protein'],
  ['Ground beef 80/20, cooked', '4 oz (113 g)', 307, 29, 0, 20, 'Protein'],
  ['Ground turkey 93/7, cooked', '4 oz (113 g)', 213, 27, 0, 11, 'Protein'],
  ['Sirloin steak, cooked', '4 oz (113 g)', 230, 34, 0, 10, 'Protein'],
  ['Ribeye steak, cooked', '4 oz (113 g)', 330, 27, 0, 24, 'Protein'],
  ['Pork tenderloin, cooked', '4 oz (113 g)', 162, 30, 0, 4, 'Protein'],
  ['Pork chop, cooked', '4 oz (113 g)', 231, 32, 0, 11, 'Protein'],
  ['Bacon', '2 slices (16 g)', 86, 6, 0, 7, 'Protein'],
  ['Ham, deli sliced', '2 oz (56 g)', 60, 10, 1, 2, 'Protein'],
  ['Turkey breast, deli sliced', '2 oz (56 g)', 60, 12, 1, 1, 'Protein'],
  ['Salmon, cooked', '4 oz (113 g)', 233, 25, 0, 14, 'Protein'],
  ['Tuna, canned in water', '1 can (142 g drained)', 150, 33, 0, 1, 'Protein'],
  ['Tilapia, cooked', '4 oz (113 g)', 145, 30, 0, 3, 'Protein'],
  ['Shrimp, cooked', '4 oz (113 g)', 112, 27, 0, 1, 'Protein'],
  ['Cod, cooked', '4 oz (113 g)', 119, 26, 0, 1, 'Protein'],
  ['Egg, large', '1 egg (50 g)', 72, 6, 0, 5, 'Protein'],
  ['Egg whites', '1/2 cup (122 g)', 63, 13, 1, 0, 'Protein'],
  ['Rotisserie chicken, with skin', '4 oz (113 g)', 250, 29, 0, 14, 'Protein'],
  ['Beef jerky', '1 oz (28 g)', 116, 9, 3, 7, 'Protein'],
  ['Tofu, firm', '1/2 cup (126 g)', 181, 22, 4, 11, 'Protein'],
  ['Tempeh', '3 oz (85 g)', 162, 17, 8, 9, 'Protein'],
  ['Whey protein powder', '1 scoop (30 g)', 120, 24, 3, 1.5, 'Protein'],
  ['Plant protein powder', '1 scoop (33 g)', 130, 21, 6, 3, 'Protein'],
  ['Protein bar (typical)', '1 bar (60 g)', 210, 20, 22, 7, 'Protein'],
  ['Ready-to-drink protein shake', '1 bottle (325 ml)', 160, 30, 5, 3, 'Protein'],
  // Dairy
  ['Greek yogurt, nonfat plain', '3/4 cup (170 g)', 100, 17, 6, 0, 'Dairy'],
  ['Greek yogurt, 2% plain', '3/4 cup (170 g)', 140, 17, 7, 4, 'Dairy'],
  ['Yogurt, flavored low-fat', '6 oz (170 g)', 150, 6, 26, 2, 'Dairy'],
  ['Cottage cheese, low-fat', '1/2 cup (113 g)', 90, 12, 5, 2.5, 'Dairy'],
  ['Milk, whole', '1 cup (240 ml)', 149, 8, 12, 8, 'Dairy'],
  ['Milk, 2%', '1 cup (240 ml)', 122, 8, 12, 5, 'Dairy'],
  ['Milk, skim', '1 cup (240 ml)', 83, 8, 12, 0, 'Dairy'],
  ['Almond milk, unsweetened', '1 cup (240 ml)', 30, 1, 1, 2.5, 'Dairy'],
  ['Oat milk', '1 cup (240 ml)', 120, 3, 16, 5, 'Dairy'],
  ['Cheddar cheese', '1 oz (28 g)', 114, 7, 0, 9, 'Dairy'],
  ['Mozzarella, part-skim', '1 oz (28 g)', 72, 7, 1, 4.5, 'Dairy'],
  ['String cheese', '1 stick (28 g)', 80, 7, 1, 6, 'Dairy'],
  ['Parmesan, grated', '2 tbsp (10 g)', 42, 4, 0, 3, 'Dairy'],
  ['Feta cheese', '1 oz (28 g)', 75, 4, 1, 6, 'Dairy'],
  ['Cream cheese', '2 tbsp (29 g)', 99, 2, 2, 10, 'Dairy'],
  ['Butter', '1 tbsp (14 g)', 102, 0, 0, 12, 'Fats'],
  ['Ice cream, vanilla', '1/2 cup (66 g)', 137, 2, 16, 7, 'Dairy'],
  // Grains & starches
  ['White rice, cooked', '1 cup (158 g)', 205, 4, 45, 0.4, 'Grains'],
  ['Brown rice, cooked', '1 cup (195 g)', 218, 5, 46, 2, 'Grains'],
  ['Jasmine rice, cooked', '1 cup (158 g)', 205, 4, 45, 0.4, 'Grains'],
  ['Quinoa, cooked', '1 cup (185 g)', 222, 8, 39, 4, 'Grains'],
  ['Oats, dry (rolled)', '1/2 cup (40 g)', 150, 5, 27, 3, 'Grains'],
  ['Oatmeal, cooked with water', '1 cup (234 g)', 166, 6, 28, 4, 'Grains'],
  ['Pasta, cooked', '1 cup (140 g)', 221, 8, 43, 1, 'Grains'],
  ['Whole wheat pasta, cooked', '1 cup (140 g)', 174, 7, 37, 1, 'Grains'],
  ['Bread, whole wheat', '1 slice (32 g)', 82, 4, 14, 1, 'Grains'],
  ['Bread, white', '1 slice (28 g)', 75, 2, 14, 1, 'Grains'],
  ['Sourdough bread', '1 slice (50 g)', 130, 5, 25, 1, 'Grains'],
  ['Bagel, plain', '1 medium (105 g)', 277, 11, 55, 1.4, 'Grains'],
  ['English muffin', '1 muffin (57 g)', 134, 4, 26, 1, 'Grains'],
  ['Flour tortilla, 8"', '1 tortilla (49 g)', 146, 4, 25, 3.5, 'Grains'],
  ['Corn tortilla', '1 tortilla (26 g)', 57, 1.5, 12, 0.7, 'Grains'],
  ['Cereal, Cheerios-style', '1 cup (28 g)', 100, 3, 20, 2, 'Grains'],
  ['Granola', '1/2 cup (60 g)', 270, 6, 38, 11, 'Grains'],
  ['Pancakes, plain', '2 medium (154 g)', 350, 10, 44, 15, 'Grains'],
  ['Waffle, frozen', '2 waffles (70 g)', 190, 4, 30, 6, 'Grains'],
  ['Rice cakes', '2 cakes (18 g)', 70, 1.5, 15, 0.5, 'Grains'],
  ['Crackers, whole grain', '6 crackers (30 g)', 130, 3, 21, 4, 'Grains'],
  ['Potato, baked with skin', '1 medium (173 g)', 161, 4, 37, 0.2, 'Grains'],
  ['Sweet potato, baked', '1 medium (114 g)', 103, 2, 24, 0.2, 'Grains'],
  ['French fries', 'medium order (117 g)', 365, 4, 48, 17, 'Grains'],
  ['Popcorn, air-popped', '3 cups (24 g)', 93, 3, 19, 1, 'Grains'],
  // Fruit
  ['Banana', '1 medium (118 g)', 105, 1, 27, 0.4, 'Fruit'],
  ['Apple', '1 medium (182 g)', 95, 0.5, 25, 0.3, 'Fruit'],
  ['Orange', '1 medium (131 g)', 62, 1, 15, 0.2, 'Fruit'],
  ['Blueberries', '1 cup (148 g)', 84, 1, 21, 0.5, 'Fruit'],
  ['Strawberries', '1 cup (152 g)', 49, 1, 12, 0.5, 'Fruit'],
  ['Raspberries', '1 cup (123 g)', 64, 1.5, 15, 0.8, 'Fruit'],
  ['Grapes', '1 cup (151 g)', 104, 1, 27, 0.2, 'Fruit'],
  ['Pineapple', '1 cup (165 g)', 82, 1, 22, 0.2, 'Fruit'],
  ['Mango', '1 cup (165 g)', 99, 1.4, 25, 0.6, 'Fruit'],
  ['Watermelon', '1 cup (152 g)', 46, 1, 12, 0.2, 'Fruit'],
  ['Peach', '1 medium (150 g)', 59, 1.4, 14, 0.4, 'Fruit'],
  ['Pear', '1 medium (178 g)', 101, 0.6, 27, 0.2, 'Fruit'],
  ['Raisins', '1/4 cup (40 g)', 120, 1, 32, 0.2, 'Fruit'],
  ['Dates, Medjool', '2 dates (48 g)', 133, 1, 36, 0, 'Fruit'],
  ['Avocado', '1/2 avocado (68 g)', 114, 1.3, 6, 10.5, 'Fats'],
  // Vegetables
  ['Broccoli, cooked', '1 cup (156 g)', 55, 4, 11, 0.6, 'Vegetables'],
  ['Spinach, raw', '2 cups (60 g)', 14, 2, 2, 0.2, 'Vegetables'],
  ['Mixed salad greens', '2 cups (85 g)', 15, 1, 3, 0, 'Vegetables'],
  ['Carrots, raw', '1 cup (128 g)', 52, 1, 12, 0.3, 'Vegetables'],
  ['Baby carrots', '10 carrots (100 g)', 35, 0.6, 8, 0.1, 'Vegetables'],
  ['Green beans, cooked', '1 cup (125 g)', 44, 2, 10, 0.4, 'Vegetables'],
  ['Bell pepper', '1 medium (119 g)', 31, 1, 7, 0.4, 'Vegetables'],
  ['Cucumber', '1 cup sliced (119 g)', 16, 0.8, 4, 0.1, 'Vegetables'],
  ['Tomato', '1 medium (123 g)', 22, 1, 5, 0.2, 'Vegetables'],
  ['Onion', '1/2 cup chopped (80 g)', 32, 1, 7, 0.1, 'Vegetables'],
  ['Zucchini, cooked', '1 cup (180 g)', 27, 2, 5, 0.6, 'Vegetables'],
  ['Asparagus, cooked', '6 spears (90 g)', 20, 2, 4, 0.2, 'Vegetables'],
  ['Brussels sprouts, cooked', '1 cup (156 g)', 56, 4, 11, 0.8, 'Vegetables'],
  ['Cauliflower, cooked', '1 cup (124 g)', 29, 2, 5, 0.6, 'Vegetables'],
  ['Corn, sweet', '1 cup (145 g)', 125, 5, 27, 2, 'Vegetables'],
  ['Peas, green', '1 cup (160 g)', 134, 9, 25, 0.4, 'Vegetables'],
  ['Mushrooms, cooked', '1 cup (156 g)', 44, 3, 8, 0.7, 'Vegetables'],
  ['Kale, raw', '2 cups (42 g)', 20, 1.8, 3.7, 0.4, 'Vegetables'],
  ['Mixed frozen vegetables', '1 cup (91 g)', 59, 3, 12, 0.1, 'Vegetables'],
  // Legumes
  ['Black beans, cooked', '1/2 cup (86 g)', 114, 8, 20, 0.5, 'Legumes'],
  ['Chickpeas, cooked', '1/2 cup (82 g)', 134, 7, 22, 2, 'Legumes'],
  ['Lentils, cooked', '1/2 cup (99 g)', 115, 9, 20, 0.4, 'Legumes'],
  ['Kidney beans, cooked', '1/2 cup (89 g)', 112, 8, 20, 0.4, 'Legumes'],
  ['Edamame, shelled', '1/2 cup (78 g)', 94, 9, 7, 4, 'Legumes'],
  ['Hummus', '2 tbsp (30 g)', 70, 2, 4, 5, 'Legumes'],
  ['Refried beans', '1/2 cup (121 g)', 110, 6, 18, 1.5, 'Legumes'],
  // Fats, nuts, seeds
  ['Peanut butter', '2 tbsp (32 g)', 190, 7, 7, 16, 'Fats'],
  ['Almond butter', '2 tbsp (32 g)', 196, 7, 6, 18, 'Fats'],
  ['Almonds', '1 oz (28 g)', 164, 6, 6, 14, 'Fats'],
  ['Peanuts', '1 oz (28 g)', 161, 7, 5, 14, 'Fats'],
  ['Walnuts', '1 oz (28 g)', 185, 4, 4, 18.5, 'Fats'],
  ['Cashews', '1 oz (28 g)', 157, 5, 9, 12, 'Fats'],
  ['Chia seeds', '1 tbsp (12 g)', 58, 2, 5, 3.7, 'Fats'],
  ['Flaxseed, ground', '1 tbsp (7 g)', 37, 1.3, 2, 3, 'Fats'],
  ['Olive oil', '1 tbsp (14 g)', 119, 0, 0, 13.5, 'Fats'],
  ['Mayonnaise', '1 tbsp (14 g)', 94, 0, 0, 10, 'Fats'],
  ['Ranch dressing', '2 tbsp (30 g)', 129, 0.4, 2, 13, 'Fats'],
  ['Trail mix', '1/4 cup (38 g)', 173, 5, 17, 11, 'Fats'],
  ['Dark chocolate 70%', '1 oz (28 g)', 170, 2, 13, 12, 'Snacks'],
  // Snacks & sweets
  ['Potato chips', '1 oz (28 g)', 152, 2, 15, 10, 'Snacks'],
  ['Tortilla chips', '1 oz (28 g)', 140, 2, 18, 7, 'Snacks'],
  ['Pretzels', '1 oz (28 g)', 108, 3, 23, 1, 'Snacks'],
  ['Chocolate chip cookie', '1 cookie (30 g)', 140, 2, 19, 7, 'Snacks'],
  ['Granola bar', '1 bar (42 g)', 190, 4, 29, 7, 'Snacks'],
  ['Honey', '1 tbsp (21 g)', 64, 0, 17, 0, 'Snacks'],
  ['Maple syrup', '2 tbsp (40 g)', 104, 0, 27, 0, 'Snacks'],
  ['Jam / jelly', '1 tbsp (20 g)', 56, 0, 14, 0, 'Snacks'],
  ['Donut, glazed', '1 donut (60 g)', 240, 3, 30, 12, 'Snacks'],
  ['Muffin, blueberry', '1 muffin (113 g)', 426, 6, 54, 21, 'Snacks'],
  // Drinks
  ['Coffee, black', '1 cup (240 ml)', 2, 0, 0, 0, 'Drinks'],
  ['Latte, 2% milk', '16 oz (grande)', 190, 13, 19, 7, 'Drinks'],
  ['Orange juice', '1 cup (248 ml)', 112, 2, 26, 0.5, 'Drinks'],
  ['Soda, regular', '12 oz can', 140, 0, 39, 0, 'Drinks'],
  ['Sports drink', '20 oz bottle', 140, 0, 36, 0, 'Drinks'],
  ['Beer, regular', '12 oz', 153, 2, 13, 0, 'Drinks'],
  ['Beer, light', '12 oz', 103, 1, 6, 0, 'Drinks'],
  ['Wine, red', '5 oz glass', 125, 0, 4, 0, 'Drinks'],
  ['Smoothie, fruit', '16 oz', 250, 4, 58, 1, 'Drinks'],
  // Common meals
  ['Cheeseburger, fast food', '1 burger', 300, 15, 33, 13, 'Meals'],
  ['Double cheeseburger', '1 burger', 450, 25, 34, 24, 'Meals'],
  ['Pizza, cheese', '1 slice (107 g)', 285, 12, 36, 10, 'Meals'],
  ['Pizza, pepperoni', '1 slice (111 g)', 313, 13, 35, 13, 'Meals'],
  ['Burrito bowl, chicken', '1 bowl', 650, 45, 70, 20, 'Meals'],
  ['Chicken burrito', '1 burrito', 1000, 55, 110, 35, 'Meals'],
  ['Grilled chicken sandwich', '1 sandwich', 390, 37, 44, 7, 'Meals'],
  ['Fried chicken sandwich', '1 sandwich', 440, 28, 40, 19, 'Meals'],
  ['Chicken nuggets', '6 pieces', 250, 14, 15, 15, 'Meals'],
  ['Turkey sandwich', '1 sandwich', 350, 25, 40, 10, 'Meals'],
  ['Caesar salad with chicken', '1 entree', 450, 35, 15, 28, 'Meals'],
  ['Spaghetti with meat sauce', '1.5 cups', 480, 24, 60, 15, 'Meals'],
  ['Chicken stir-fry with rice', '1 plate', 550, 35, 65, 15, 'Meals'],
  ['Sushi roll, California', '8 pieces', 255, 9, 38, 7, 'Meals'],
  ['Chicken noodle soup', '1 cup', 62, 3, 7, 2, 'Meals'],
  ['Mac and cheese', '1 cup', 350, 13, 45, 13, 'Meals'],
  ['Tacos, beef', '2 tacos', 340, 16, 26, 19, 'Meals'],
  ['Breakfast sandwich, egg & cheese', '1 sandwich', 300, 15, 30, 13, 'Meals'],
  ['Overnight oats with protein', '1 jar', 380, 30, 45, 9, 'Meals'],
  ['Chicken & rice meal prep', '1 container', 500, 42, 55, 10, 'Meals'],
  ['Salmon, rice & veggies', '1 plate', 560, 35, 55, 20, 'Meals'],
  ['Scrambled eggs (3) with toast', '1 plate', 380, 22, 28, 20, 'Meals'],
  ['Peanut butter & jelly sandwich', '1 sandwich', 390, 13, 48, 17, 'Meals'],
  ['Protein pancakes', '3 pancakes', 320, 25, 35, 8, 'Meals'],
  ['Greek yogurt parfait', '1 cup', 280, 18, 38, 6, 'Meals'],
];

const FOODS = FOOD_ROWS.map((r, i) => ({
  id: 'f' + i, name: r[0], serving: r[1], kcal: r[2], p: r[3], c: r[4], f: r[5], cat: r[6], source: 'built-in',
}));

function searchLocalFoods(q, extra) {
  const pool = (extra || []).concat(FOODS);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return pool
    .map(f => {
      const n = f.name.toLowerCase();
      if (!terms.every(t => n.includes(t))) return null;
      const score = (n.startsWith(terms[0]) ? 0 : 1) + (f.cat === 'Meals' || f.cat === 'Snacks' ? 0.5 : 0) + n.length / 100;
      return { f, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 40)
    .map(x => x.f);
}

/* Open Food Facts — free, no key. Returns per-serving values when the product lists a
   serving, otherwise per 100 g. Fails quietly where the network is restricted. */
async function searchOnlineFoods(q) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=25'
    + '&fields=code,product_name,brands,nutriments,serving_size,serving_quantity&search_terms=' + encodeURIComponent(q);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return (data.products || []).map(p => offToFood(p, p.code)).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

function offToFood(p, code) {
  const n = p.nutriments || {};
  const hasServing = n['energy-kcal_serving'] != null && p.serving_size;
  const k = hasServing ? '_serving' : '_100g';
  const kcal = n['energy-kcal' + k] ?? (n['energy' + k] != null ? n['energy' + k] / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  return {
    id: 'off_' + code, barcode: code,
    name: p.product_name.trim() + (p.brands ? ' · ' + p.brands.split(',')[0].trim() : ''),
    serving: hasServing ? p.serving_size : '100 g',
    kcal: Math.round(kcal),
    p: round1(n['proteins' + k] || 0),
    c: round1(n['carbohydrates' + k] || 0),
    f: round1(n['fat' + k] || 0),
    cat: 'Online', source: 'Open Food Facts',
  };
}

/* Barcode lookup: the user's own saved foods first (works offline), then Open Food Facts.
   Returns { food } on success, { notFound: true } or throws on network failure. */
async function lookupBarcode(code, customFoods) {
  code = String(code).replace(/\D/g, '');
  const mine = (customFoods || []).find(f => f.barcode === code);
  if (mine) return { food: mine };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=code,product_name,brands,nutriments,serving_size', { signal: ctrl.signal });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return { notFound: true };
    const food = offToFood(data.product, code);
    return food ? { food } : { notFound: true, partial: data.product.product_name || '' };
  } finally { clearTimeout(timer); }
}
function round1(x) { return Math.round(x * 10) / 10; }
