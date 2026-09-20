import { test } from "node:test";
import assert from "node:assert/strict";
import { Texture, Vector3, Quaternion } from "three";
import { MatchMist } from "./smoke";
test("match mist stays bounded during chains and clears for restart", () => {
  const mist = new MatchMist(new Texture());
  const position = new Vector3(0, 1, 0),
    rotation = new Quaternion();
  for (let i = 0; i < 3; i++) mist.emit(position, "#ee4776");
  mist.update(0.1, rotation);
  assert.equal(mist.mesh.count, 15);
  for (let i = 0; i < 100; i++) mist.emit(position, "#008dce");
  mist.update(0.1, rotation);
  assert.equal(mist.mesh.count, 256);
  mist.clear();
  mist.update(0.1, rotation);
  assert.equal(mist.mesh.count, 0);
  mist.emit(position, "#ee4776");
  mist.update(1.2, rotation);
  assert.equal(mist.mesh.count, 0);
});
