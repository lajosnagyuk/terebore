import { primaryColorCount, lightColor, clayColor } from "./palette";

const drawSlots = primaryColorCount * 8 + 2;

/** Clay keeps one slot; growing Light odds take slots only from primary colours. */
export function chooseNextColor(
  pile: readonly number[],
  random = Math.random,
  lightSteps = 1,
): number {
  const ticket = random() * drawSlots;
  if (ticket >= drawSlots - 1) return clayColor;
  if (ticket >= drawSlots - 1 - Math.min(lightSteps, drawSlots - 1))
    return lightColor;
  const primaryPile = pile.filter((color) => color < primaryColorCount);
  if (primaryPile.length && random() < 0.8)
    return primaryPile[Math.floor(random() * primaryPile.length)];
  return Math.floor(random() * primaryColorCount);
}

/** Match-earned Light chance belongs to future draws, never the existing pocket ball. */
export class ColorDraw {
  private lightSteps = 1;
  get lightChance() {
    return this.lightSteps / drawSlots;
  }
  recordMatch() {
    this.lightSteps = Math.min(this.lightSteps + 1, drawSlots - 1);
  }
  reset() {
    this.lightSteps = 1;
  }
  next(pile: readonly number[], random = Math.random): number {
    const color = chooseNextColor(pile, random, this.lightSteps);
    if (color === lightColor) this.reset();
    return color;
  }
}
