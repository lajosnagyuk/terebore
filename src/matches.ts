import { lightColor, clayColor } from "./palette";

export interface MatchBall {
  id: number;
  color: number;
  x: number;
  y: number;
  z: number;
}
/** Qualify each colour with Light separately, then merge clears sharing a wildcard. */
export function findMatches(balls: MatchBall[], diameter: number): number[][] {
  const neighbours = balls.map(() => [] as number[]);
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (
        a.color !== b.color &&
        a.color !== lightColor &&
        b.color !== lightColor
      )
        continue;
      // A tiny tolerance absorbs separation introduced by the physics solver.
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= diameter + 0.035) {
        neighbours[i].push(j);
        neighbours[j].push(i);
      }
    }
  }
  const parents = balls.map((_, i) => i);
  const matched = new Set<number>();
  const root = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  for (const color of new Set(balls.map((ball) => ball.color))) {
    const visited = new Set<number>();
    for (let i = 0; i < balls.length; i++) {
      if (
        visited.has(i) ||
        (balls[i].color !== color && balls[i].color !== lightColor)
      )
        continue;
      const pending = [i],
        group: number[] = [];
      let hasLight = false;
      visited.add(i);
      while (pending.length) {
        const current = pending.pop()!;
        group.push(current);
        hasLight ||= balls[current].color === lightColor;
        for (const other of neighbours[current]) {
          if (
            visited.has(other) ||
            (balls[other].color !== color && balls[other].color !== lightColor)
          )
            continue;
          visited.add(other);
          pending.push(other);
        }
      }
      if (group.length < 3 || (color === clayColor && !hasLight)) continue;
      // A shared Light clears once, together with every independently qualifying family.
      for (const index of group) {
        matched.add(index);
        parents[root(index)] = root(group[0]);
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (const index of matched) {
    const key = root(index);
    const group = groups.get(key) ?? [];
    group.push(balls[index].id);
    groups.set(key, group);
  }
  return [...groups.values()];
}
