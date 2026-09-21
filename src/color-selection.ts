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
  private perfectSteps = Array<number>(primaryColorCount).fill(1);
  get perfectChances() {
    return this.perfectSteps.map((steps) => steps / 6);
  }
  get glow() {
    return {
      perfects: this.perfectSteps.map((steps) => (steps - 1) / 5),
      light: (this.lightSteps - 1) / 40,
    };
  }
  get lightChance() {
    return this.lightSteps / drawSlots;
  }
  recordMatch(colors: readonly number[] = []) {
    for (const color of new Set(colors)) {
      if (color >= 0 && color < primaryColorCount)
        this.perfectSteps[color] = Math.min(this.perfectSteps[color] + 1, 6);
    }
    this.lightSteps = Math.min(this.lightSteps + 1, drawSlots - 1);
  }
  reset() {
    this.lightSteps = 1;
    this.perfectSteps.fill(1);
  }
  next(pile: readonly number[], random = Math.random): number {
    const color = chooseNextColor(pile, random, this.lightSteps);
    if (color === lightColor) this.lightSteps = 1;
    return color;
  }
  /** One Perfect per five ordinary balls at base; only its own draw resets it. */
  piece(pile: readonly number[], random = Math.random) {
    const color = this.next(pile, random);
    const perfect =
      color < primaryColorCount && random() < this.perfectSteps[color] / 6;
    if (perfect) this.perfectSteps[color] = 1;
    return { color, perfect };
  }
}
