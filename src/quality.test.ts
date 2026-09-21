import { test } from "node:test";
import assert from "node:assert/strict";
import { AdaptiveQuality, pixelRatioCeiling } from "./quality";

test("4K at 170% is limited to 1.6 million shaded pixels", () => {
  const ratio = pixelRatioCeiling(2259, 1271, 1.7);
  assert.ok(2259 * 1271 * ratio * ratio <= 1_600_001);
  assert.ok(ratio < 1);
});
test("sustained slow frames reduce resolution without falling below the floor", () => {
  const q = new AdaptiveQuality(2259, 1271, 1.7),
    initial = q.ratio;
  for (let i = 0; i < 600; i++) q.sample(33.3);
  assert.ok(q.ratio < initial);
  assert.equal(q.ratio, q.ceiling * 0.55);
});
test("very slow rendering is measured and triggers adaptation", () => {
  const q = new AdaptiveQuality(2259, 1271, 1.7),
    initial = q.ratio;
  for (let i = 0; i < 12; i++) q.sample(300);
  assert.ok(q.ratio < initial);
  assert.equal(Math.round(1000 / q.frameMs), 3);
});
test("brief stutters do not lower quality and healthy frames recover gradually", () => {
  const q = new AdaptiveQuality(1280, 720, 1.7);
  const initial = q.ratio;
  q.sample(100);
  for (let i = 0; i < 59; i++) q.sample(16.67);
  assert.equal(q.ratio, initial);
  for (let i = 0; i < 120; i++) q.sample(30);
  const reduced = q.ratio;
  for (let i = 0; i < 660; i++) q.sample(16.67);
  assert.ok(q.ratio > reduced);
  assert.ok(q.ratio <= q.ceiling);
});
test("resize preserves the quality fraction, and tab reset forgets old timing", () => {
  const q = new AdaptiveQuality(2000, 1000, 1.7);
  for (let i = 0; i < 120; i++) q.sample(30);
  const fraction = q.ratio / q.ceiling;
  q.resize(390, 844, 2);
  assert.ok(Math.abs(q.ratio / q.ceiling - fraction) < 1e-10);
  assert.ok(q.ratio <= 1.5);
  q.sample(5000);
  assert.equal(q.ratio / q.ceiling, fraction);
});

test("invalid timing samples do not poison later measurements", () => {
  const quality = new AdaptiveQuality(800, 600, 1);
  for (const value of [NaN, Infinity, -Infinity, 0, -1])
    assert.equal(quality.sample(value), false);
  for (let i = 0; i < 60; i++) quality.sample(16);
  assert.equal(quality.frameMs, 16);
  assert.equal(quality.ratio, 1);
});
