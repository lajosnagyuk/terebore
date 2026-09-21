import { test } from "node:test";
import assert from "node:assert/strict";
import { insideTriangle, clearsTriangle } from "./play-area";
const inside = { x: -2, z: -2 },
  outside = { x: 1, z: 1 };
test("triangle bounds include its walls and rail, but exclude the user area", () => {
  assert.equal(insideTriangle(inside), true);
  assert.equal(insideTriangle({ x: -3.04, z: 2.04 }), true);
  assert.equal(insideTriangle({ x: -3.041, z: -2 }), false);
  assert.equal(insideTriangle({ x: -2, z: -3.041 }), false);
  assert.equal(insideTriangle({ x: 0, z: 0 }), false);
});
test("only a match removing the last triangle occupants earns a clear bonus", () => {
  assert.equal(clearsTriangle([inside], [outside]), true);
  assert.equal(clearsTriangle([inside], []), true);
  assert.equal(clearsTriangle([inside], [inside]), false);
  assert.equal(clearsTriangle([outside], [outside]), false);
  assert.equal(clearsTriangle([], []), false);
});
