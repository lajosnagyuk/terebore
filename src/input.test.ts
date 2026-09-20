import { test } from "node:test";
import assert from "node:assert/strict";
import { pointerAim } from "./input";
test("touch offsets the target while mouse and pen keep direct aiming", () => {
  assert.deepEqual(pointerAim(200, 430, true, 390, 844), { x: 200, y: 346 });
  assert.deepEqual(pointerAim(200, 430, false, 390, 844), { x: 200, y: 430 });
  assert.deepEqual(pointerAim(200, 10, true, 390, 844), { x: 200, y: 20 });
});
test("off-screen touch releases cannot be clamped into a valid throw", () => {
  for (const [x, y] of [
    [-1, 100],
    [100, -1],
    [391, 100],
    [100, 845],
    [NaN, 0],
    [0, Infinity],
  ])
    assert.equal(pointerAim(x, y, true, 390, 844), null);
  assert.deepEqual(pointerAim(390, 844, true, 390, 844), { x: 390, y: 760 });
});
