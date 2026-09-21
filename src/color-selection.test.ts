import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseNextColor } from "./color-selection";
import { lightColor, clayColor } from "./palette";
test("rare pieces keep their weights even when the pile contains only specials", () => {
  let seed = 9876;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const counts = Array(7).fill(0);
  for (let i = 0; i < 84000; i++)
    counts[chooseNextColor([lightColor, clayColor], random)]++;
  for (let color = 0; color < 5; color++)
    assert.ok(Math.abs(counts[color] - 16000) < 700);
  assert.ok(Math.abs(counts[lightColor] - 2000) < 200);
  assert.ok(Math.abs(counts[clayColor] - 2000) < 200);
});
test("primary assistance never copies a rare piece from the pile", () => {
  const draws = [0, 0, 0.99];
  assert.equal(
    chooseNextColor([lightColor, 3, clayColor], () => draws.shift()!),
    3,
  );
  assert.equal(
    chooseNextColor([], () => 0),
    0,
  );
  const uniform = [0, 0.9, 0.4];
  assert.equal(
    chooseNextColor([3], () => uniform.shift()!),
    2,
  );
});
