// Enough time to see a decision play out, with a cap so stray rolls never block play.
export function throwReadiness(
  age: number,
  reachedPile: boolean,
  speed: number,
) {
  return age >= 2.2 || (age >= 1.15 && (reachedPile || speed < 1.25));
}
export function clearScore(count: number, banked: boolean, chain: number) {
  return (
    count * 10 +
    Math.max(0, count - 3) * 5 +
    (banked ? 15 : 0) +
    Math.max(0, chain - 1) * 10
  );
}

export function nextChain(previous: number, age: number, sameThrow: boolean) {
  return sameThrow && age < 1.8 ? previous + 1 : 1;
}
