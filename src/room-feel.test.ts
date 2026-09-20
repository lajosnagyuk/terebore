import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import * as CANNON from "cannon-es";
import { roomGravity, roomRotation, roomOffset } from "./room-feel";

test("room has a gentle real incline, anchored at its corner", () => {
  const up = new Vector3(0, 1, 0).applyQuaternion(roomRotation);
  const degrees = (Math.acos(up.y) * 180) / Math.PI;
  assert.ok(degrees > 5 && degrees < 6);
  const corner = new Vector3(-3, 0, -3)
    .applyQuaternion(roomRotation)
    .add(roomOffset);
  assert.ok(corner.distanceTo(new Vector3(-3, 0, -3)) < 1e-10);
  assert.ok(
    roomGravity
      .clone()
      .applyQuaternion(roomRotation)
      .distanceTo(new Vector3(0, -10, 0)) < 1e-10,
  );
});
test("a loose marble rolls gently towards the corner without an extra push", () => {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(roomGravity.x, roomGravity.y, roomGravity.z),
  });
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  const ball = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(0.36),
    linearDamping: 0.18,
    angularDamping: 0.4,
  });
  ball.position.set(0, 0.36, 0);
  world.addBody(ball);
  for (let i = 0; i < 180; i++) world.step(1 / 90);
  assert.ok(ball.position.x < -0.15 && ball.position.z < -0.15);
  assert.ok(
    ball.velocity.length() < 1.5,
    "slope should assist, not accelerate marbles aggressively",
  );
  assert.ok(ball.position.y > 0.35);
});
