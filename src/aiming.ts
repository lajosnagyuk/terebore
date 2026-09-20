import { MathUtils, Ray, Vector3 } from "three";
import { roomGravity, throwOrigin } from "./room-feel";

export type AimSurface = "floor" | "left wall" | "right wall";
export type AimTarget = {
  point: Vector3;
  normal: Vector3;
  surface: AimSurface;
};
export const ballRadius = 0.36;
export const physicsStep = 1 / 90;

/** Intersect room-local surfaces. Marbles and the rail don't obstruct selecting an intention. */
export function pickTarget(ray: Ray): AimTarget | null {
  const surfaces = [
    {
      axis: "y" as const,
      value: 0,
      normal: new Vector3(0, 1, 0),
      surface: "floor" as const,
    },
    {
      axis: "x" as const,
      value: -3.04,
      normal: new Vector3(1, 0, 0),
      surface: "left wall" as const,
    },
    {
      axis: "z" as const,
      value: -3.04,
      normal: new Vector3(0, 0, 1),
      surface: "right wall" as const,
    },
  ];
  let nearest = Infinity,
    result: AimTarget | null = null;
  for (const s of surfaces) {
    const denominator = ray.direction[s.axis];
    if (Math.abs(denominator) < 1e-6) continue;
    const t = (s.value - ray.origin[s.axis]) / denominator;
    if (t <= 0 || t >= nearest) continue;
    const point = ray.at(t, new Vector3());
    if (point.x < -3.05 || point.z < -3.05 || point.y < -0.001) continue;
    if (s.surface === "floor") {
      point.x = MathUtils.clamp(point.x, -2.66, 5.5);
      point.z = MathUtils.clamp(point.z, -2.66, 6.5);
    } else {
      point.y = MathUtils.clamp(point.y, 0.4, 4);
      const along = s.axis === "x" ? "z" : "x";
      point[along] = MathUtils.clamp(point[along], -2.66, 2);
    }
    nearest = t;
    result = { point, normal: s.normal, surface: s.surface };
  }
  return result;
}

/** Solve the same damped, fixed-step flight used by the actual physics engine. */
export function solveThrow(target: AimTarget) {
  const destination = target.point
    .clone()
    .addScaledVector(target.normal, ballRadius);
  const distance = Math.hypot(
    destination.x - throwOrigin.x,
    destination.z - throwOrigin.z,
  );
  const duration =
    target.surface === "floor"
      ? 0.36 + distance * 0.034
      : 0.44 + distance * 0.035 + Math.max(0, destination.y - 2) * 0.06;
  const steps = Math.round(MathUtils.clamp(duration, 0.32, 0.95) / physicsStep);
  const damping = Math.pow(0.82, physicsStep);
  let velocityWeight = 1,
    gravityWeight = 0,
    positionWeight = 0,
    accelerationWeight = 0;
  for (let i = 0; i < steps; i++) {
    velocityWeight *= damping;
    gravityWeight = gravityWeight * damping + physicsStep;
    positionWeight += velocityWeight * physicsStep;
    accelerationWeight += gravityWeight * physicsStep;
  }
  const velocity = destination
    .clone()
    .sub(throwOrigin)
    .addScaledVector(roomGravity, -accelerationWeight)
    .divideScalar(positionWeight);
  return { origin: throwOrigin.clone(), velocity, steps, destination };
}

/** A bounded aiming sketch, not a second physics world. */
export class ThrowPreview {
  bounces = 0;
  trace(
    target: AimTarget,
    pile: { position: { x: number; y: number; z: number } }[] = [],
  ) {
    const shot = solveThrow(target);
    const position = shot.origin.clone();
    const velocity = shot.velocity.clone();
    const points: Vector3[] = [];
    const damping = Math.pow(0.82, physicsStep);
    this.bounces = 0;
    // At most four simple room rebounds; no spin, friction solver, or pile outcome.
    for (let step = 0; step < 300; step++) {
      velocity
        .multiplyScalar(damping)
        .addScaledVector(roomGravity, physicsStep);
      position.addScaledVector(velocity, physicsStep);
      let bounced = false;
      if (position.y < ballRadius && velocity.y < 0) {
        position.y = ballRadius;
        velocity.y *= -0.56;
        velocity.x *= 0.86;
        velocity.z *= 0.86;
        bounced = true;
      }
      for (const axis of ["x", "z"] as const) {
        if (position[axis] < -3.04 + ballRadius && velocity[axis] < 0) {
          position[axis] = -3.04 + ballRadius;
          velocity[axis] *= -0.56;
          bounced = true;
        }
      }
      if (bounced) this.bounces++;
      // Rail edges and the live pile are where the player discovers the result.
      const railAcross = (position.x + position.z + 1) / Math.SQRT2;
      const railAlong = (position.x - position.z) / Math.SQRT2;
      const nearRail =
        Math.abs(railAcross) < 0.09 + ballRadius &&
        Math.abs(railAlong) < 3.55 + ballRadius &&
        position.y < 0.25 + ballRadius;
      const nearPile = pile.some(
        ({ position: p }) =>
          (p.x - position.x) ** 2 +
            (p.y - position.y) ** 2 +
            (p.z - position.z) ** 2 <
          (ballRadius * 2 + 0.04) ** 2,
      );
      const finished =
        nearRail ||
        nearPile ||
        this.bounces >= 4 ||
        (bounced && position.y === ballRadius && velocity.y < 0.9);
      if (step % 5 === 0 || bounced || finished) points.push(position.clone());
      if (finished) break;
    }
    return points;
  }
}
