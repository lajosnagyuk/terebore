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

test("each match adds a Light step, and only drawing Light or resetting consumes it", async () => {
  const { ColorDraw } = await import("./color-selection");
  const draw = new ColorDraw();
  assert.equal(draw.lightChance, 1 / 42);
  draw.recordMatch();
  draw.recordMatch();
  assert.equal(draw.lightChance, 3 / 42);
  assert.equal(
    draw.next([], () => 0.99),
    clayColor,
  );
  assert.equal(draw.lightChance, 3 / 42);
  assert.equal(
    draw.next([], () => 0),
    0,
  );
  assert.equal(draw.lightChance, 3 / 42);
  assert.equal(
    draw.next([], () => 38.5 / 42),
    lightColor,
  );
  assert.equal(draw.lightChance, 1 / 42);
  draw.recordMatch();
  draw.reset();
  assert.equal(draw.lightChance, 1 / 42);
  for (let i = 0; i < 100; i++) draw.recordMatch();
  assert.equal(draw.lightChance, 41 / 42);
  assert.equal(
    draw.next([], () => 0.99),
    clayColor,
  );
  assert.equal(draw.lightChance, 41 / 42);
});
test("Light increases additively without changing the Clay interval", () => {
  for (const steps of [1, 2, 3, 20, 41, 100]) {
    const counts = Array(7).fill(0);
    for (let slot = 0; slot < 42; slot++)
      counts[chooseNextColor([], () => (slot + 0.5) / 42, steps)]++;
    assert.equal(counts[clayColor], 1);
    assert.equal(counts[lightColor], Math.min(steps, 41));
  }
});

test("Perfect chances advance once per matched family and reset independently on draw", async () => {
  const { ColorDraw } = await import("./color-selection");
  const draw = new ColorDraw();
  assert.deepEqual(draw.perfectChances, Array(5).fill(1 / 6));
  assert.deepEqual(draw.glow, { perfects: [0, 0, 0, 0, 0], light: 0 });
  draw.recordMatch([0, 0, 1, lightColor, clayColor, -1]);
  assert.deepEqual(draw.perfectChances, [2 / 6, 2 / 6, 1 / 6, 1 / 6, 1 / 6]);
  assert.deepEqual(draw.glow, { perfects: [0.2, 0.2, 0, 0, 0], light: 1 / 40 });
  const ordinary = [0, 0, 0.9];
  assert.deepEqual(
    draw.piece([], () => ordinary.shift()!),
    { color: 0, perfect: false },
  );
  assert.equal(draw.perfectChances[0], 2 / 6);
  assert.deepEqual(
    draw.piece([], () => 0),
    { color: 0, perfect: true },
  );
  assert.deepEqual(draw.perfectChances, [1 / 6, 2 / 6, 1 / 6, 1 / 6, 1 / 6]);
  assert.equal(draw.lightChance, 2 / 42);
  assert.deepEqual(
    draw.piece([], () => 0.95),
    { color: lightColor, perfect: false },
  );
  assert.equal(draw.perfectChances[1], 2 / 6);
  assert.deepEqual(
    draw.piece([], () => 0.99),
    { color: clayColor, perfect: false },
  );
  for (let i = 0; i < 20; i++) draw.recordMatch([1]);
  assert.equal(draw.perfectChances[1], 1);
  assert.equal(draw.glow.perfects[1], 1);
  // Select primary family 1, then use a near-one Perfect ticket at the cap.
  const certain = [0, 0.2, 0.999];
  assert.deepEqual(
    draw.piece([], () => certain.shift()!),
    { color: 1, perfect: true },
  );
  draw.recordMatch([2]);
  draw.reset();
  assert.deepEqual(draw.perfectChances, Array(5).fill(1 / 6));
  assert.deepEqual(draw.glow, { perfects: [0, 0, 0, 0, 0], light: 0 });
});

test("base Perfect draws are one fifth as common as ordinary draws of the same colour", async () => {
  const { ColorDraw } = await import("./color-selection");
  let perfects = 0;
  for (let ticket = 0; ticket < 600; ticket++) {
    const values = [0, 0.6, (ticket + 0.5) / 600];
    const piece = new ColorDraw().piece([], () => values.shift()!);
    assert.equal(piece.color, 3);
    perfects += Number(piece.perfect);
  }
  assert.equal(perfects, 100);
});
