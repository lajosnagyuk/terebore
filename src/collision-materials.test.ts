import { test } from "node:test";
import assert from "node:assert/strict";
import { World, Body, Sphere, Plane, Vec3 } from "cannon-es";
import { createCollisionMaterials } from "./collision-materials";
import { clayColor, lightColor } from "./palette";

function contact(first: number, second: number | "room") {
  const world = new World({ gravity: new Vec3(0, 0, 0) });
  const materials = createCollisionMaterials(world);
  const a = new Body({
    mass: 1,
    shape: new Sphere(0.36),
    material: materials.forColor(first),
  });
  const b = new Body({
    mass: second === "room" ? 0 : 1,
    shape: second === "room" ? new Plane() : new Sphere(0.36),
    material: second === "room" ? materials.room : materials.forColor(second),
  });
  a.position.z = second === "room" ? 0.35 : 0.71;
  a.velocity.z = -2;
  world.addBody(a);
  world.addBody(b);
  world.step(1 / 240);
  assert.equal(world.contacts.length, 1);
  return world.contacts[0].restitution;
}

test("the solver uses the special ball bounce in either contact order", () => {
  const pairs = [
    [0, 1, 0.221],
    [0, clayColor, 0.221 * 0.9],
    [clayColor, clayColor, 0.221 * 0.9],
    [0, lightColor, 0.221 * 1.05],
    [lightColor, lightColor, 0.221 * 1.05],
    [clayColor, lightColor, 0.221 * 0.9 * 1.05],
  ];
  for (const [a, b, expected] of pairs) {
    assert.equal(contact(a, b), expected);
    assert.equal(contact(b, a), expected);
  }
});
test("every colour retains the same restitution against room surfaces", () => {
  for (let color = 0; color < 7; color++)
    assert.equal(contact(color, "room"), 0.56);
});
test("primary families share one material and contact tables are symmetric with unchanged friction", () => {
  const world = new World();
  const materials = createCollisionMaterials(world);
  for (let color = 0; color < 5; color++)
    assert.equal(materials.forColor(color), materials.forColor(0));
  assert.equal(world.contactmaterials.length, 9);
  for (const a of [0, clayColor, lightColor]) {
    for (const b of [0, clayColor, lightColor]) {
      const forward = world.getContactMaterial(
        materials.forColor(a),
        materials.forColor(b),
      );
      assert.equal(
        forward,
        world.getContactMaterial(materials.forColor(b), materials.forColor(a)),
      );
      assert.equal(forward.friction, 0.12);
    }
    assert.equal(
      world.getContactMaterial(materials.forColor(a), materials.room).friction,
      0.22,
    );
  }
});
