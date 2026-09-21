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
    // Independent matrix closure qualifies each family, then joins overlapping clears.
    const close = (matrix: boolean[][]) => {
      for (let k = 0; k < pile.length; k++)
        for (let i = 0; i < pile.length; i++)
          for (let j = 0; j < pile.length; j++)
            matrix[i][j] ||= matrix[i][k] && matrix[k][j];
    };
    const clears = pile.map(() => pile.map(() => false));
    for (let family = 0; family < 7; family++) {
      const allowed = (color: number) => color === family || color === 5;
      const connected = pile.map((a) =>
        pile.map(
          (b) =>
            allowed(a.color) &&
            allowed(b.color) &&
            Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 0.755,
        ),
      );
      close(connected);
      for (const row of connected) {
        const members = row.flatMap((yes, id) => (yes ? [id] : []));
        if (
          members.length < 3 ||
          (family === 6 && !members.some((id) => pile[id].color === 5))
        )
          continue;
        for (const i of members) for (const j of members) clears[i][j] = true;
      }
    }
    close(clears);
    const expected = [
      ...new Set(
        clears.map((row) =>
          row.flatMap((yes, id) => (yes ? [id] : [])).join(","),
        ),
      ),
    ]
      .filter(Boolean)
      .map((s) => s.split(",").map(Number));
    assert.deepEqual(canonical(findMatches(pile, 0.72)), canonical(expected));
    assert.deepEqual(
      canonical(findMatches([...pile].reverse(), 0.72)),
      canonical(expected),
    );
  }
});

test("Light completes one colour or Clay, but pairs do not clear", () => {
  for (const colors of [
    [0, 5, 0],
    [6, 5, 6],
    [5, 5, 5],
  ]) {
    const pile = colors.map((color, id) => ball(id, color, id * 0.72));
    assert.equal(findMatches(pile, 0.72)[0].length, 3);
    assert.equal(findMatches([...pile].reverse(), 0.72)[0].length, 3);
  }
  assert.deepEqual(findMatches([ball(0, 5, 0), ball(1, 6, 0.72)], 0.72), []);
});
test("Clay alone stays inert and cannot bridge ordinary colours", () => {
  assert.deepEqual(
    findMatches([ball(0, 6, 0), ball(1, 6, 0.72), ball(2, 6, 1.44)], 0.72),
    [],
  );
  assert.deepEqual(
    findMatches([ball(0, 5, 0), ball(1, 6, 0.72), ball(2, 6, 1.44)], 0.72),
    [[0, 1, 2]],
  );
  assert.deepEqual(
    findMatches([ball(0, 0, 0), ball(1, 6, 0.72), ball(2, 0, 1.44)], 0.72),
    [],
  );
});

test("Light ignites the entire connected Clay cluster, regardless of traversal order", () => {
  const pile = [
    ball(0, 5, 0),
    ...Array.from({ length: 5 }, (_, i) => ball(i + 1, 6, (i + 1) * 0.72)),
  ];
  // A separate Clay cluster and an ordinary colour touching the far end are excluded.
  pile.push(
    ball(6, 0, 4.32),
    ball(7, 6, 8),
    ball(8, 6, 8.72),
    ball(9, 6, 9.44),
  );
  for (let offset = 0; offset < pile.length; offset++) {
    const ordered = [...pile.slice(offset), ...pile.slice(0, offset)];
    assert.deepEqual(
      findMatches(ordered, 0.72).map((group) => group.sort((a, b) => a - b)),
      [[0, 1, 2, 3, 4, 5]],
    );
  }
  assert.deepEqual(
    findMatches(
      pile.filter((b) => b.color !== 5),
      0.72,
    ),
    [],
  );
});

test("Light does not combine different colours to reach three or absorb a stray colour", () => {
  assert.deepEqual(
    findMatches([ball(0, 0, 0), ball(1, 5, 0.72), ball(2, 1, 1.44)], 0.72),
    [],
  );
  const pile = [
    ball(0, 0, 0),
    ball(1, 0, 0.72),
    ball(2, 5, 1.44),
    ball(3, 1, 2.16),
  ];
  assert.deepEqual(findMatches(pile, 0.72), [[0, 1, 2]]);
  assert.deepEqual(
    findMatches([ball(0, 0, 0), ball(1, 5, 0.72), ball(2, 6, 1.44)], 0.72),
    [],
  );
});
test("one Light completes both colour pairs together without being counted twice", () => {
  const pile = [
    ball(0, 0, 0),
    ball(1, 0, 0.72),
    ball(2, 5, 1.44),
    ball(3, 1, 2.16),
    ball(4, 1, 2.88),
  ];
  for (let offset = 0; offset < pile.length; offset++) {
    const ordered = [...pile.slice(offset), ...pile.slice(0, offset)];
    assert.deepEqual(
      findMatches(ordered, 0.72).map((g) => g.sort((a, b) => a - b)),
      [[0, 1, 2, 3, 4]],
    );
  }
});
test("shared Lights merge transitive qualifying groups but leave unrelated pairs", () => {
  const pile = [
    ball(0, 0, 0),
    ball(1, 0, 0.72),
    ball(2, 5, 1.44),
    ball(3, 1, 2.16),
    ball(4, 5, 2.88),
    ball(5, 6, 3.6),
    ball(6, 6, 4.32),
    ball(7, 2, 10),
    ball(8, 2, 10.72),
  ];
  assert.deepEqual(
    findMatches(pile, 0.72).map((g) => g.sort((a, b) => a - b)),
    [[0, 1, 2, 3, 4, 5, 6]],
  );
  assert.deepEqual(findMatches([], 0.72), []);
});
