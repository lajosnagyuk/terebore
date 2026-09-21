import { test } from "node:test";
import assert from "node:assert/strict";
import { Group, Vector3 } from "three";
import { ContactShadows } from "./contact-shadows";

const ball = (id: number, y = 0.36) => ({
  body: { id },
  mesh: { position: new Vector3(-2, y, -2) },
});
test("stationary shadows reuse buffers, while motion and replacement update them", () => {
  const shadows = new ContactShadows(new Group(), 0.36);
  const first = ball(1);
  shadows.update([first]);
  assert.equal(shadows.mesh.count, 3);
  const version = shadows.mesh.instanceMatrix.version;
  shadows.update([first]);
  assert.equal(shadows.mesh.instanceMatrix.version, version);
  first.mesh.position.y = 1;
  shadows.update([first]);
  assert.ok(shadows.mesh.instanceMatrix.version > version);
  const moved = shadows.mesh.instanceMatrix.version;
  shadows.forget(1);
  shadows.update([ball(2)]);
  assert.ok(shadows.mesh.instanceMatrix.version > moved);
  shadows.update([]);
  assert.equal(shadows.mesh.count, 0);
  shadows.dispose();
});
test("growing shadow batches release old geometry and retain a reusable capacity", () => {
  const parent = new Group();
  const shadows = new ContactShadows(parent, 0.36);
  const old = shadows.mesh;
  let released = 0;
  old.geometry.addEventListener("dispose", () => released++);
  old.addEventListener("dispose", () => released++);
  shadows.update(Array.from({ length: 65 }, (_, i) => ball(i, i / 20)));
  assert.equal(released, 2);
  assert.equal(parent.children.length, 1);
  assert.equal(shadows.mesh.count, 195);
  assert.ok(shadows.mesh.instanceMatrix.count >= 195);
  const grown = shadows.mesh;
  shadows.update([ball(0)]);
  assert.equal(shadows.mesh, grown);
  shadows.dispose();
  assert.equal(parent.children.length, 0);
});
