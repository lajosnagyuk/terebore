import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatches } from "./matches";
const ball = (id: number, color: number, x: number, y = 0, z = 0) => ({
  id,
  color,
  x,
  y,
  z,
});
test("clears connected chains of three, even if endpoints do not touch", () =>
  assert.deepEqual(
    findMatches([ball(1, 0, 0), ball(2, 0, 0.72), ball(3, 0, 1.44)], 0.72),
    [[1, 2, 3]],
  ));
test("does not match pairs, different colours, or disconnected balls", () =>
  assert.deepEqual(
    findMatches(
      [ball(1, 0, 0), ball(2, 0, 0.72), ball(3, 1, 1.44), ball(4, 0, 4)],
      0.72,
    ),
    [],
  ));
test("finds independent 3D clusters", () =>
  assert.equal(
    findMatches(
      [
        ball(1, 0, 0),
        ball(2, 0, 0, 0.72),
        ball(3, 0, 0, 0, 0.72),
        ball(4, 1, 5),
        ball(5, 1, 5, 0.72),
        ball(6, 1, 5, 0, 0.72),
      ],
      0.72,
    ).length,
    2,
  ));
