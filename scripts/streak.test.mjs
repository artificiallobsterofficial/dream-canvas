// Run with: node scripts/streak.test.mjs
import assert from "node:assert";
import { calculateStreak, isFreezeActive, todayKey } from "../src/utils/helpers.js";

// Build tracker content from day-offsets that are "done" (0 = today, 1 = yesterday...)
const content = (...doneOffsets) => {
  const td = {};
  for (const off of doneOffsets) {
    const d = new Date();
    d.setDate(d.getDate() - off);
    td[todayKey(d)] = { status: "done", event: "" };
  }
  return JSON.stringify(td);
};

const cases = [
  // [name, doneOffsets, expectedStreak, expectedFreeze]
  ["empty tracker", [], 0, false],
  ["only today", [0], 1, false],
  ["5 consecutive days incl today", [0, 1, 2, 3, 4], 5, false],
  ["today not done yet, 3 prior days", [1, 2, 3], 3, false],
  ["single missed day is forgiven (freeze)", [0, 2, 3, 4], 4, true],
  ["freeze without today done yet", [2, 3], 2, true],
  ["two consecutive misses break streak", [0, 3, 4], 1, false],
  ["two misses with nothing after", [3, 4], 0, false],
  ["multiple separate single misses all forgiven", [0, 2, 4, 6], 4, true],
  ["long streak with one gap", [0, 1, 2, 4, 5, 6, 7], 7, false],
  ["nothing done in last two days, older streak dead", [5, 6, 7], 0, false],
];

let failed = 0;
for (const [name, offsets, expStreak, expFreeze] of cases) {
  const c = content(...offsets);
  const streak = calculateStreak(c);
  const freeze = isFreezeActive(c);
  try {
    assert.strictEqual(streak, expStreak, `streak: expected ${expStreak}, got ${streak}`);
    assert.strictEqual(freeze, expFreeze, `freeze: expected ${expFreeze}, got ${freeze}`);
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name} — ${e.message}`);
  }
}

// Legacy format compatibility: plain `true` and bare string statuses
const legacy = {};
const d1 = new Date();
legacy[todayKey(d1)] = true;
const d2 = new Date();
d2.setDate(d2.getDate() - 1);
legacy[todayKey(d2)] = "done";
const legacyStreak = calculateStreak(JSON.stringify(legacy));
if (legacyStreak === 2) console.log("PASS  legacy day formats (true / 'done')");
else {
  failed++;
  console.error(`FAIL  legacy day formats — expected 2, got ${legacyStreak}`);
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll streak tests passed");
