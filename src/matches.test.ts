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

test("matching agrees with a connectivity oracle across seeded piles and input orders", () => {
  let seed = 1729;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const canonical = (groups: number[][]) =>
    groups.map((g) => [...g].sort((a, b) => a - b).join(",")).sort();
  for (let trial = 0; trial < 100; trial++) {
    const pile = Array.from({ length: 24 }, (_, id) =>
      ball(
        id,
        Math.floor(random() * (trial < 50 ? 3 : 7)),
        random() * 2,
        random() * 2,
        random() * 2,
      ),
    );
    // Independent transitive-closure oracle rather than another traversal.
    const connected = pile.map((a) =>
      pile.map(
        (b) =>
          (a.color === 5 ||
            b.color === 5 ||
            (a.color < 5 && a.color === b.color)) &&
          Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 0.755,
      ),
    );
    for (let k = 0; k < pile.length; k++)
      for (let i = 0; i < pile.length; i++)
        for (let j = 0; j < pile.length; j++)
          connected[i][j] ||= connected[i][k] && connected[k][j];
    const expected = [
      ...new Set(
        connected.map((row) =>
          row.flatMap((yes, id) => (yes ? [id] : [])).join(","),
        ),
      ),
    ]
      .map((s) => s.split(",").map(Number))
      .filter((g) => g.length >= 3);
    assert.deepEqual(canonical(findMatches(pile, 0.72)), canonical(expected));
    assert.deepEqual(
      canonical(findMatches([...pile].reverse(), 0.72)),
      canonical(expected),
    );
  }
});

test("Light bridges any two touching colours, including Clay, but pairs do not clear", () => {
  for (const colors of [
    [0, 5, 1],
    [6, 5, 6],
    [5, 5, 5],
  ]) {
    const pile = colors.map((color, id) => ball(id, color, id * 0.72));
    assert.equal(findMatches(pile, 0.72)[0].length, 3);
    assert.equal(findMatches([...pile].reverse(), 0.72)[0].length, 3);
  }
  assert.deepEqual(findMatches([ball(0, 5, 0), ball(1, 6, 0.72)], 0.72), []);
});
test("Clay neither matches itself nor relays a wildcard to another Clay ball", () => {
  assert.deepEqual(
    findMatches([ball(0, 6, 0), ball(1, 6, 0.72), ball(2, 6, 1.44)], 0.72),
    [],
  );
  assert.deepEqual(
    findMatches([ball(0, 5, 0), ball(1, 6, 0.72), ball(2, 6, 1.44)], 0.72),
    [],
  );
  assert.deepEqual(
    findMatches([ball(0, 0, 0), ball(1, 6, 0.72), ball(2, 0, 1.44)], 0.72),
    [],
  );
});
