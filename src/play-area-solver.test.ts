import { test } from "node:test";
import assert from "node:assert/strict";
import { Body, Box, ContactEquation, Sphere, Vec3, World } from "cannon-es";
import { createCollisionMaterials } from "./collision-materials";
import { PlayAreaSolver } from "./play-area-solver";

test("all ball colours bounce less only on the triangle floor, without accumulating the reduction", () => {
  for (let color = 0; color < 7; color++) {
    const world = new World({ gravity: new Vec3(0, -9.8, 0) });
    const materials = createCollisionMaterials(world);
    const floor = new Body({
      mass: 0,
      material: materials.room,
      shape: new Box(new Vec3(25, 0.15, 25)),
    });
    floor.position.set(10, -0.15, 10);
    const ball = new Body({
      mass: 1,
      material: materials.forColor(color),
      shape: new Sphere(0.36),
    });
    world.solver = new PlayAreaSolver(floor);
    world.addBody(floor);
    world.addBody(ball);
    for (const [x, z, expected] of [
      [-2, -2, 0.504],
      [-2, -2, 0.504],
      [1, 1, 0.56],
      [-2, 1.1, 0.56],
      [-4, -2, 0.56],
      [-2, -4, 0.56],
      [-2, -2, 0.504],
    ]) {
      ball.position.set(x, 0.35, z);
      ball.velocity.set(0, -2, 0);
      ball.aabbNeedsUpdate = true;
      world.step(1 / 90);
      assert.equal(world.contacts.length, 1);
      assert.ok(Math.abs(world.contacts[0].restitution - expected) < 1e-12);
      assert.ok(ball.velocity.y > 0, "the real solver still rebounds the ball");
    }
  }
});

test("contact ordering does not change the floor rule; walls, rail, other balls and the floor underside are excluded", () => {
  const world = new World();
  const floor = new Body({ mass: 0 });
  const ball = new Body({ mass: 1 });
  const other = new Body({ mass: 0 });
  const solver = new PlayAreaSolver(floor);
  const make = (a: Body, b: Body, normalY: number) => {
    const c = new ContactEquation(a, b);
    c.ni.set(0, normalY, 0);
    c.ri.set(-2, 0, -2);
    c.rj.set(-2, 0, -2);
    c.restitution = 0.56;
    return c;
  };
  world.contacts = [
    make(floor, ball, 1),
    make(ball, floor, -1),
    make(floor, ball, -1),
    make(floor, ball, 0),
    make(other, ball, 1),
    make(ball, other, -1),
  ];
  solver.solve(1 / 90, world);
  assert.deepEqual(
    world.contacts.map((c) => c.restitution),
    [0.56 * 0.9, 0.56 * 0.9, 0.56, 0.56, 0.56, 0.56],
  );
});
