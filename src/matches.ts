import { lightColor, clayColor } from "./palette";

export interface MatchBall {
  id: number;
  color: number;
  x: number;
  y: number;
  z: number;
}
/** Connected groups count, including chains; a tiny tolerance absorbs solver separation. */
export function findMatches(balls: MatchBall[], diameter: number): number[][] {
  const visited = new Set<number>();
  const groups: number[][] = [];
  for (const ball of balls) {
    if (visited.has(ball.id)) continue;
    const pending = [ball];
    const group: number[] = [];
    let onlyClay = true;
    visited.add(ball.id);
    while (pending.length) {
      const current = pending.pop()!;
      group.push(current.id);
      onlyClay &&= current.color === clayColor;
      for (const other of balls) {
        if (visited.has(other.id)) continue;
        // Light bridges colours and ignites connected Clay; Clay-only groups stay inert.
        const compatible =
          current.color === lightColor ||
          other.color === lightColor ||
          current.color === other.color;
        if (!compatible) continue;
        if (
          Math.hypot(
            current.x - other.x,
            current.y - other.y,
            current.z - other.z,
          ) <=
          diameter + 0.035
        ) {
          visited.add(other.id);
          pending.push(other);
        }
      }
    }
    if (group.length >= 3 && !onlyClay) groups.push(group);
  }
  return groups;
}
