import { test } from "node:test";
import assert from "node:assert/strict";
import { throwReadiness, clearScore, nextChain } from "./cadence";
test("rapid repeat clicks wait for a meaningful landing", () => {
  assert.equal(throwReadiness(0.3, true, 0), false);
  assert.equal(throwReadiness(1.2, false, 4), false);
  assert.equal(throwReadiness(1.2, true, 4), true);
  assert.equal(throwReadiness(1.2, false, 0.5), true);
});
test("a stray marble cannot hold up play indefinitely", () =>
  assert.equal(throwReadiness(2.2, false, 8), true));
test("banked clears and settling chains reward placement without reducing ordinary clears", () => {
  assert.equal(clearScore(3, false, 1), 30);
  assert.equal(clearScore(3, true, 1), 45);
  assert.equal(clearScore(4, false, 2), 55);
});

test("chain bonuses reward settling, not rushing the next throw", () => {
  assert.equal(nextChain(1, 0.8, true), 2);
  assert.equal(nextChain(1, 0.8, false), 1);
  assert.equal(nextChain(1, 3, true), 1);
});
