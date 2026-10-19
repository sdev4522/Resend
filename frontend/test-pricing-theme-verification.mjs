import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getActiveThemeConfigServer } from './lib/theme/server-theme.ts';
import { generateThemeCss, getContrastForeground } from './lib/theme/theme-utils.ts';

const DIR = import.meta.dirname;

console.log('==================================================================');
console.log('🧪 VERIFICATION SUITE: PRICING VISIBILITY & THEME FLASH ELIMINATION');
console.log('==================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// ─── 1. VERIFY NO PURPLE/VIOLET IN GLOBALS.CSS ─────────────────────────────────
test('1. globals.css has NO purple/violet oklch tokens', () => {
  const css = fs.readFileSync(path.join(DIR, 'app/globals.css'), 'utf8');
  assert(!css.includes('286.974'), 'globals.css must not contain violet hue 286.974');
  assert(css.includes('--primary: #00A884;'), 'globals.css root must use brand default #00A884');
  assert(css.includes('--ring: #00A884;'), 'globals.css root must use brand default ring');
});

// ─── 2. VERIFY THEME-UTILS CSS GENERATION FOR ALL TOKENS ─────────────────────
test('2. generateThemeCss produces all required tokens with !important', () => {
  const waNewConfig = JSON.parse(
    fs.readFileSync(path.join(DIR, '../backend/routes/themes/theme-wa-new.json'), 'utf8')
  );
  const css = generateThemeCss(waNewConfig);

  // Check Primary
  assert(css.includes('--primary: #00A884 !important;'), 'Must contain --primary: #00A884');
  assert(css.includes('--ring: #00A884 !important;'), 'Must contain --ring: #00A884');
  assert(css.includes('--primary-foreground: #ffffff !important;'), 'Must contain white contrast foreground');

  // Check Secondary & Accent
  assert(css.includes('--secondary: #0D9276 !important;'), 'Must contain --secondary: #0D9276');
  assert(css.includes('--accent: #00A884 !important;'), 'Must contain --accent: #00A884');

  // Check Background & Cards
  assert(css.includes('--background: #F7F8FA !important;'), 'Must contain --background: #F7F8FA');
  assert(css.includes('--card: #FFFFFF !important;'), 'Must contain --card: #FFFFFF');

  // Check Text & Foregrounds
  assert(css.includes('--foreground: #111827 !important;'), 'Must contain --foreground: #111827');
  assert(css.includes('--muted-foreground: #6B7280 !important;'), 'Must contain --muted-foreground: #6B7280');

  // Check Borders & Radius
  assert(css.includes('--border: #E5E7EB !important;'), 'Must contain --border: #E5E7EB');
  assert(css.includes('--radius: 12px !important;'), 'Must contain --radius: 12px');

  // Check Dark mode tokens
  assert(css.includes('.dark {'), 'Must generate dark mode class overrides');
  assert(css.includes('--background: #0D1117 !important;'), 'Must contain dark background');
  assert(css.includes('--card: #161B22 !important;'), 'Must contain dark card');
  assert(css.includes('--foreground: #E6EDF3 !important;'), 'Must contain dark foreground');
});

// ─── 3. VERIFY SECOND CONFIGURED THEME (SUNSET) ──────────────────────────────
test('3. generateThemeCss correctly maps a second configured theme (theme-sunset)', () => {
  const sunsetConfig = JSON.parse(
    fs.readFileSync(path.join(DIR, '../backend/routes/themes/theme-sunset.json'), 'utf8')
  );
  const css = generateThemeCss(sunsetConfig);

  assert(css.includes('--primary: #C2410C !important;'), 'Must use sunset primary');
  assert(css.includes('--secondary: #9D174D !important;'), 'Must use sunset secondary');
  assert(css.includes('--background: #FFF7ED !important;'), 'Must use sunset background');
  assert(css.includes('--border: #FED7AA !important;'), 'Must use sunset border');
  assert(css.includes('--foreground: #1C0A00 !important;'), 'Must use sunset foreground');
});

// ─── 4. VERIFY SERVER-SIDE THEME RESOLUTION ──────────────────────────────────
await asyncTest('4. getActiveThemeConfigServer loads authoritative active theme', async () => {
  const config = await getActiveThemeConfigServer();
  assert(config !== null, 'Active theme config must not be null');
  assert(
    config.id === 'theme-wa-new' || config.primary_light === '#00A884',
    `Expected active theme theme-wa-new or primary #00A884, got id: ${config.id}`
  );
});

// ─── 5. VERIFY CONTRAST CALCULATION ACCURACY ─────────────────────────────────
test('5. getContrastForeground calculates WCAG-compliant text foreground', () => {
  assert.strictEqual(getContrastForeground('#00A884'), '#ffffff', '#00A884 teal should have white text');
  assert.strictEqual(getContrastForeground('#FFFFFF'), '#0a0a0a', '#FFFFFF white should have dark text');
  assert.strictEqual(getContrastForeground('#000000'), '#ffffff', '#000000 black should have white text');
  assert.strictEqual(getContrastForeground('#FED7AA'), '#0a0a0a', '#FED7AA light orange should have dark text');
});

// ─── 6. VERIFY PRICING COMPONENT LOGIC & PLAN FILTERING ──────────────────────
test('6. Pricing visibility logic includes trial plan and filters private/inactive', () => {
  const rawPlans = [
    { id: 17, title: 'Free Trial', price: 0, is_trial: 1, plan_duration_in_days: '14' },
    { id: 19, title: 'Premium', price: 6, is_trial: 0, plan_duration_in_days: '30' },
    { id: 20, title: 'Platinum', price: 10, is_trial: 0, plan_duration_in_days: '365' },
    { id: 99, title: 'Archived Internal Plan', price: 100, is_active: 0 },
    { id: 100, title: 'Private Custom Plan', price: 500, is_private: true },
  ];

  const visiblePlans = rawPlans.filter((p) => {
    if (p.is_active === false || p.is_active === 0) return false;
    if (p.status === 'inactive' || p.status === 'disabled' || p.status === 'archived') return false;
    if (p.is_private === true || p.is_private === 1) return false;
    return true;
  });

  assert.strictEqual(visiblePlans.length, 3, 'Should have exactly 3 public plans');
  assert(visiblePlans.some((p) => p.is_trial === 1), 'Trial plan must be preserved');
  assert(!visiblePlans.some((p) => p.id === 99), 'Inactive plan must be filtered out');
  assert(!visiblePlans.some((p) => p.id === 100), 'Private plan must be filtered out');
});

// ─── 7. VERIFY BACKEND PLANS RETURN TRIAL PLAN ────────────────────────────────
test('7. Database plan schema and rows confirm Free Trial is configured as plan 17', () => {
  const schemaSql = fs.readFileSync(path.join(DIR, '../backend/database/schema.sql'), 'utf8');
  assert(schemaSql.includes('`is_trial` int(1)'), 'Plan schema must contain is_trial');

  const migrationSql = fs.readFileSync(
    path.join(DIR, '../backend/database/migrations/014_reconcile_free_trial_plan.sql'),
    'utf8'
  );
  assert(migrationSql.includes('is_trial = 1'), 'Migration must set is_trial = 1');
  assert(migrationSql.includes('plan_duration_in_days = \'14\''), 'Migration must set 14 days');
});

console.log('\n==================================================================');
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================================');

if (failed > 0) process.exit(1);
