import { clearCornerPoints } from "./play-area";
import { MathUtils } from "three";
const { clamp } = MathUtils;

/** Owns the score card's merged message, animation, and dismissal timer. */
export class ScoreToken {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private motion: Animation | undefined;
  private totalPoints = 0;
  private marbles = 0;
  private banked = false;
  private cornerBonus = 0;
  constructor(
    private readonly element: HTMLElement,
    private readonly points: HTMLElement,
    private readonly message: HTMLElement,
    private readonly header: HTMLElement,
  ) {}
  dismiss() {
    clearTimeout(this.timer);
    this.motion?.cancel();
    this.element.classList.remove("show");
    this.totalPoints = this.marbles = 0;
    this.banked = false;
    this.cornerBonus = 0;
  }
  show(
    points: number,
    count: number,
    banked: boolean,
    screen: { x: number; y: number },
    chain: number,
    clearedCorner = false,
  ) {
    const toast = this.element;
    const active = toast.classList.contains("show");
    this.totalPoints = active ? this.totalPoints + points : points;
    this.marbles = active ? this.marbles + count : count;
    this.banked = (active && this.banked) || banked;
    this.cornerBonus =
      (active ? this.cornerBonus : 0) + (clearedCorner ? clearCornerPoints : 0);
    this.points.textContent = `+${this.totalPoints}`;
    this.message.textContent =
      this.cornerBonus > 0
        ? `CLEAR CORNER · +${this.cornerBonus} BONUS`
        : `${this.marbles} TOGETHER${this.banked ? " · WALL BONUS" : chain > 1 ? " · CHAIN " + chain : ""}`;
    clearTimeout(this.timer);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active) {
      this.motion?.cancel();
      toast.classList.add("show");
      const width = toast.offsetWidth;
      const compact = innerWidth < 640;
      const dockX = compact ? 16 + width / 2 : 24 + width / 2;
      const dockY = compact
        ? this.header.getBoundingClientRect().bottom + 20
        : innerHeight * 0.63;
      toast.style.left = `${dockX}px`;
      toast.style.top = `${dockY}px`;
      const startX = clamp(
        ((screen.x + 1) * innerWidth) / 2,
        width / 2 + 12,
        innerWidth - width / 2 - 12,
      );
      const startY = clamp(
        ((1 - screen.y) * innerHeight) / 2 - 35,
        100,
        innerHeight - 150,
      );
      const dx = compact ? 0 : startX - dockX,
        dy = compact ? 18 : startY - dockY;
      const pose = (x: number, y: number, tilt: number, scale = 1) =>
        `translate(calc(-50% + ${x}px), ${y}px) rotate(${tilt}deg) scale(${scale})`;
      this.motion = toast.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { transform: pose(dx, dy + 8, -3, 0.92), opacity: 0, offset: 0 },
              {
                transform: pose(dx * 0.94, dy - 16, -5),
                opacity: 1,
                offset: 0.16,
              },
              { transform: pose(-5, -5, 1.5), opacity: 1, offset: 0.78 },
              { transform: pose(0, 0, 0), opacity: 1, offset: 1 },
            ],
        {
          duration: reduced ? 180 : 1050,
          easing: "cubic-bezier(.22,.65,.3,1)",
        },
      );
    } else if (this.motion?.id === "score-exit") {
      // A fresh clear keeps the same token, without jumping back into play.
      this.motion.cancel();
    }
    this.timer = setTimeout(() => {
      this.motion = toast.animate(
        [
          { opacity: 1, transform: "translate(-50%, 0)" },
          { opacity: 0, transform: `translate(-50%, ${reduced ? 0 : 8}px)` },
        ],
        { duration: 650, easing: "ease-in", fill: "forwards" },
      );
      this.motion.id = "score-exit";
      this.motion.onfinish = () => this.dismiss();
    }, 4200);
  }
}
