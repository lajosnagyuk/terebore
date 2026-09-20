import { test } from "node:test";
import assert from "node:assert/strict";
import { Ray, Vector3 } from "three";
import * as CANNON from "cannon-es";
import {
  pickTarget,
  solveThrow,
  ThrowPreview,
  physicsStep,
  type AimTarget,
} from "./aiming";
import { roomGravity, throwOrigin } from "./room-feel";

const targets: AimTarget[] = [
  {
    surface: "floor",
    point: new Vector3(1.5, 0, 2),
    normal: new Vector3(0, 1, 0),
  },
  {
    surface: "floor",
    point: new Vector3(-1.5, 0, -1.4),
    normal: new Vector3(0, 1, 0),
  },
  {
    surface: "left wall",
    point: new Vector3(-3.04, 1.6, -1.4),
    normal: new Vector3(1, 0, 0),
  },
  {
    surface: "right wall",
    point: new Vector3(-1.4, 2, -3.04),
    normal: new Vector3(0, 0, 1),
  },
];
for (const target of targets) {
  test(`aim selection and damped flight reach ${target.surface} at ${target.point.toArray()}`, () => {
    const ray = new Ray(
      new Vector3(8, 8, 10),
      target.point
        .clone()
        .sub(new Vector3(8, 8, 10))
        .normalize(),
    );
    const hit = pickTarget(ray)!;
    assert.equal(hit.surface, target.surface);
    assert.ok(hit.point.distanceTo(target.point) < 1e-8);
    const shot = solveThrow(hit);
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(roomGravity.x, roomGravity.y, roomGravity.z),
    });
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(0.36),
      linearDamping: 0.18,
    });
    body.position.set(throwOrigin.x, throwOrigin.y, throwOrigin.z);
    body.velocity.set(shot.velocity.x, shot.velocity.y, shot.velocity.z);
    world.addBody(body);
    for (let i = 0; i < shot.steps; i++) world.step(physicsStep);
    assert.ok(
      new Vector3(body.position.x, body.position.y, body.position.z).distanceTo(
        shot.destination,
      ) < 1e-8,
    );
  });
}
test("rays away from the room do not produce a stale throw target", () => {
  assert.equal(
    pickTarget(
      new Ray(new Vector3(8, 8, 10), new Vector3(1, 1, 1).normalize()),
    ),
    null,
  );
});
test("guidance suggests bounded wall rebounds", () => {
  const guide = new ThrowPreview();
  const points = guide.trace(targets[2]);
  assert.ok(points.some((p, i) => i > 0 && p.x > points[i - 1].x));
  assert.ok(
    points.every(
      (p) => p.x >= -3.04 + 0.36 && p.z >= -3.04 + 0.36 && p.y >= 0.36,
    ),
  );
  assert.ok(guide.bounces <= 4);
  assert.ok(points.length <= 64);
});
test("guidance stops near the pile without predicting or mutating its response", () => {
  const guide = new ThrowPreview();
  const shot = solveThrow(targets[0]);
  const position = throwOrigin.clone().addScaledVector(shot.velocity, 0.12);
  const before = position.clone();
  const points = guide.trace(targets[0], [{ position }]);
  assert.ok(points.length < 10);
  assert.ok(position.equals(before));
});
test("guidance stays bounded across floor and wall targets", () => {
  const guide = new ThrowPreview();
  for (const target of targets) {
    const points = guide.trace(target);
    assert.ok(points.length > 1 && points.length <= 64);
    assert.ok(guide.bounces <= 4);
    assert.ok(points.every((p) => p.toArray().every(Number.isFinite)));
  }
});
