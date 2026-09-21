import { clearCornerPoints } from "./play-area";
import { lightColor, palette } from "./palette";
import { MathUtils } from "three";

interface ClearDetails {
  colors?: readonly number[];
  perfects?: number;
  perfectBonus?: number;
  lights?: number;
  shot?: number;
}
interface Burst {
  element: HTMLDivElement;
  number: HTMLElement;
  detail: HTMLDivElement;
  created: number;
  shot?: number;
  points: number;
  count: number;
  clears: number;
  colors: Set<number>;
  perfects: number;
  perfectBonus: number;
  lights: number;
  wallBonus: number;
  chainBonus: number;
  groupBonus: number;
  cornerBonus: number;
  timer?: ReturnType<typeof setTimeout>;
  motion?: Animation;
}
const multiColor = "#39576f";

/** Bounded, pile-anchored score bursts; nearby clears from one throw share a number. */
export class ScoreToken {
  private readonly bursts: Burst[] = [];
  constructor(
    private readonly container: HTMLElement,
    private readonly header: HTMLElement,
  ) {}

  private remove(burst: Burst) {
    clearTimeout(burst.timer);
    burst.motion?.cancel();
    burst.element.remove();
    const index = this.bursts.indexOf(burst);
    if (index >= 0) this.bursts.splice(index, 1);
  }
  dismiss() {
    for (const burst of [...this.bursts]) this.remove(burst);
  }
  show(
    points: number,
    count: number,
    banked: boolean,
    screen: { x: number; y: number },
    chain: number,
    clearedCorner = false,
    details: ClearDetails = {},
  ) {
    const now = performance.now();
    let burst = this.bursts.find((b) =>
      details.shot === undefined
        ? now - b.created < 320
        : b.shot === details.shot && now - b.created < 1800,
    );
    const fresh = !burst;
    if (!burst) {
      if (this.bursts.length === 3) this.remove(this.bursts[0]);
      const element = document.createElement("div");
      element.className = "score-pop";
      element.setAttribute("aria-atomic", "true");
      const number = document.createElement("strong");
      number.className = "score-points";
      const detail = document.createElement("div");
      detail.className = "score-detail";
      element.append(number, detail);
      this.container.append(element);
      burst = {
        element,
        number,
        detail,
        created: now,
        shot: details.shot,
        points: 0,
        count: 0,
        clears: 0,
        colors: new Set(),
        perfects: 0,
        perfectBonus: 0,
        lights: 0,
        wallBonus: 0,
        chainBonus: 0,
        groupBonus: 0,
        cornerBonus: 0,
      };
      this.bursts.push(burst);
    }
    burst.points += points;
    burst.count += count;
    burst.clears++;
    for (const color of details.colors ?? []) burst.colors.add(color);
    burst.perfects += details.perfects ?? 0;
    burst.perfectBonus += details.perfectBonus ?? 0;
    burst.lights += details.lights ?? 0;
    burst.wallBonus += banked ? 15 : 0;
    burst.chainBonus += Math.max(0, chain - 1) * 10;
    burst.groupBonus += Math.max(0, count - 3) * 5;
    burst.cornerBonus += clearedCorner ? clearCornerPoints : 0;
    const families = [...burst.colors].filter((color) => color !== lightColor);
    const mixed = burst.clears > 1 || families.length > 1;
    const color = mixed ? multiColor : palette[families[0] ?? lightColor].color;
    burst.element.style.setProperty("--score-color", color);
    burst.number.textContent = `+${burst.points}`;
    const lines = [`${burst.count} cleared${mixed ? " · Multi" : ""}`];
    const specials = [];
    if (burst.lights) specials.push("Light");
    if (burst.perfects)
      specials.push(
        `${burst.perfects} Perfect${burst.perfects === 1 ? "" : "s"} +${burst.perfectBonus}`,
      );
    if (specials.length) lines.push(specials.join(" · "));
    const bonuses = [
      burst.groupBonus ? `Group +${burst.groupBonus}` : "",
      burst.wallBonus ? `Wall +${burst.wallBonus}` : "",
      burst.chainBonus ? `Chain +${burst.chainBonus}` : "",
      burst.cornerBonus ? `Corner +${burst.cornerBonus}` : "",
    ].filter(Boolean);
    if (bonuses.length) lines.push(bonuses.join(" · "));
    burst.detail.textContent = lines.join("\n");
    if (!fresh) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = burst.element.offsetWidth;
    const height = burst.element.offsetHeight;
    const ceiling = this.header.getBoundingClientRect().bottom + 14;
    const handTop =
      document.querySelector(".hand-label")?.getBoundingClientRect().top ??
      innerHeight;
    const bottom = Math.max(
      ceiling + height,
      Math.min(innerHeight - 100, handTop - 24),
    );
    const x = MathUtils.clamp(
      ((screen.x + 1) * innerWidth) / 2,
      width / 2 + 12,
      innerWidth - width / 2 - 12,
    );
    const y = MathUtils.clamp(
      ((1 - screen.y) * innerHeight) / 2 + (this.bursts.length - 1) * 22,
      ceiling + height,
      bottom,
    );
    const rise = Math.min(115, Math.max(0, y - height - ceiling - 48));
    burst.element.style.left = `${x}px`;
    burst.element.style.top = `${y}px`;
    if (!reduced) {
      const pose = (up: number, scale = 1) =>
        `translate(-50%, calc(-100% - ${up}px)) scale(${scale})`;
      burst.motion = burst.element.animate(
        [
          {
            transform: pose(0, 0.92),
            opacity: 0,
            offset: 0,
            easing: "cubic-bezier(.16,.7,.3,1)",
          },
          {
            transform: pose(rise * 0.48),
            opacity: 1,
            offset: 0.16,
            easing: "ease-out",
          },
          {
            transform: pose(rise * 0.7),
            opacity: 1,
            offset: 0.79,
            easing: "cubic-bezier(.55,0,1,.45)",
          },
          { transform: pose(rise), opacity: 0, offset: 1 },
        ],
        { duration: 3200, fill: "forwards" },
      );
    }
    const current = burst;
    burst.timer = setTimeout(() => this.remove(current), 3200);
  }
}
