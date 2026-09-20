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
    visited.add(ball.id);
    while (pending.length) {
      const current = pending.pop()!;
      group.push(current.id);
      for (const other of balls) {
        if (visited.has(other.id) || other.color !== current.color) continue;
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
    if (group.length >= 3) groups.push(group);
  }
  return groups;
}
