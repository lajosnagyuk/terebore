import { test } from "node:test";
import assert from "node:assert/strict";
import { MatchLifecycle } from "./match-lifecycle";
test("a transient contact must restart its full dwell", () => {
  const m = new MatchLifecycle();
  m.observe([[1, 2, 3]], 0, 1);
  m.observe([], 0.1, 1);
  assert.deepEqual(m.observe([[1, 2, 3]], 0.2, 1), []);
  assert.deepEqual(m.observe([[1, 2, 3]], 0.3, 1), []);
  assert.equal(m.observe([[1, 2, 3]], 0.37, 1).length, 1);
});
test("order-independent groups commit once and retain the originating shot", () => {
  const m = new MatchLifecycle();
  const ids = [3, 1, 2];
  m.observe([ids], 0, 7);
  const armed = m.observe([[2, 3, 1]], 0.17, 7);
  assert.deepEqual(ids, [3, 1, 2]);
  assert.equal(armed.length, 1);
  assert.deepEqual(
    m.observe(
      [
        [1, 2, 3],
        [1, 2, 3, 4],
      ],
      0.2,
      8,
    ),
    [],
  );
  assert.deepEqual(m.takeReady(0.46), []);
  assert.deepEqual(m.takeReady(0.48), [{ ids: [1, 2, 3], at: 0.17, shot: 7 }]);
  assert.equal(m.size, 0);
  assert.deepEqual(m.takeReady(1), []);
});
test("independent groups clear together and reset cancels pending and committed work", () => {
  const m = new MatchLifecycle();
  const groups = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  m.observe(groups, 0, 1);
  assert.equal(m.observe(groups, 0.17, 1).length, 2);
  m.observe([[7, 8, 9]], 0.2, 1);
  m.reset();
  assert.equal(m.size, 0);
  assert.deepEqual(m.takeReady(10), []);
  assert.deepEqual(m.observe([[7, 8, 9]], 10, 2), []);
});
test("duplicate IDs or pairs cannot award a match", () => {
  const m = new MatchLifecycle();
  m.observe(
    [
      [1, 1, 2],
      [3, 4],
    ],
    0,
    1,
  );
  assert.deepEqual(
    m.observe(
      [
        [1, 1, 2],
        [3, 4],
      ],
      1,
      1,
    ),
    [],
  );
});
