import { GSSolver, Vec3, type Body, type World } from "cannon-es";
import { insideTriangle } from "./play-area";

/** Adjust floor contacts by location before the solver computes their bounce. */
export class PlayAreaSolver extends GSSolver {
  private readonly contactPoint = new Vec3();

  constructor(private readonly floor: Body) {
    super();
  }

  override solve(dt: number, world: World): number {
    for (const contact of world.contacts) {
      const floorFirst = contact.bi === this.floor;
      if (!floorFirst && contact.bj !== this.floor) continue;
      const upwardNormal = floorFirst ? contact.ni.y : -contact.ni.y;
      if (upwardNormal < 0.5) continue;
      this.floor.position.vadd(
        floorFirst ? contact.ri : contact.rj,
        this.contactPoint,
      );
      if (insideTriangle(this.contactPoint)) contact.restitution *= 0.9;
    }
    return super.solve(dt, world);
  }
}
