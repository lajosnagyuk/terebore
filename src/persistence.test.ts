import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBest, loadBest, saveBest } from "./persistence";
test("corrupt, negative and non-integral saved scores are discarded", () => {
  for (const value of [
    null,
    "",
    " ",
    "NaN",
    "Infinity",
    "-Infinity",
    "-1",
    "1.5",
    "oops",
    "9007199254740992",
  ])
    assert.equal(parseBest(value), 0);
  for (const value of ["0", "650", " 30 "])
    assert.equal(parseBest(value), Number(value));
});
test("denied storage access and quota failures never prevent play", () => {
  assert.equal(
    loadBest(() => {
      throw new Error("denied");
    }),
    0,
  );
  assert.equal(
    loadBest(() => ({
      getItem() {
        throw new Error("denied");
      },
    })),
    0,
  );
  assert.doesNotThrow(() =>
    saveBest(30, () => {
      throw new Error("denied");
    }),
  );
  assert.doesNotThrow(() =>
    saveBest(30, () => ({
      setItem() {
        throw new Error("quota");
      },
    })),
  );
});
test("best scores round-trip without writing invalid data", () => {
  const values = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  saveBest(650, storage);
  assert.equal(loadBest(storage), 650);
  for (const n of [NaN, Infinity, -1, 1.5]) saveBest(n, storage);
  assert.equal(loadBest(storage), 650);
});
