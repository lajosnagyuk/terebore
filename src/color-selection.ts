import { primaryColorCount, lightColor, clayColor } from "./palette";

/** Relative weights 8:8:8:8:8:1:1; pile assistance applies only to primaries. */
export function chooseNextColor(
  pile: readonly number[],
  random = Math.random,
): number {
  const ticket = random() * (primaryColorCount * 8 + 2);
  if (ticket >= primaryColorCount * 8 + 1) return clayColor;
  if (ticket >= primaryColorCount * 8) return lightColor;
  const primaryPile = pile.filter((color) => color < primaryColorCount);
  if (primaryPile.length && random() < 0.8)
    return primaryPile[Math.floor(random() * primaryPile.length)];
  return Math.floor(random() * primaryColorCount);
}
