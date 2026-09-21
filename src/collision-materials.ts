import { ContactMaterial, Material, type World } from "cannon-es";
import { clayColor, lightColor } from "./palette";

/** Ball-pair modifiers are separate from the shared room-contact baseline. */
export function createCollisionMaterials(world: World) {
  const ordinary = new Material("marble");
  const clay = new Material("clay");
  const light = new Material("light");
  const room = new Material("room");
  const balls = [ordinary, clay, light];
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    world.addContactMaterial(
      new ContactMaterial(a, room, {
        friction: 0.22,
        restitution: 0.56,
      }),
    );
    for (let j = i; j < balls.length; j++) {
      const b = balls[j];
      // Apply each special type once, including Clay–Clay and Light–Light.
      const clayFactor = a === clay || b === clay ? 0.9 : 1;
      const lightFactor = a === light || b === light ? 1.05 : 1;
      world.addContactMaterial(
        new ContactMaterial(a, b, {
          friction: 0.12,
          restitution: 0.221 * clayFactor * lightFactor,
        }),
      );
    }
  }
  return {
    room,
    forColor: (color: number) =>
      color === clayColor ? clay : color === lightColor ? light : ordinary,
  };
}
