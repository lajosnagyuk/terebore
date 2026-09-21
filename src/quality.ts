/** Limit actual shaded pixels, independently of display scaling. UI stays native-resolution. */
export function pixelRatioCeiling(width: number, height: number, dpr: number) {
  return Math.min(dpr, 1.5, Math.sqrt(1_600_000 / Math.max(1, width * height)));
}

export class AdaptiveQuality {
  ratio: number;
  ceiling: number;
  frameMs = 0;
  private samples: number[] = [];
  private stableMs = 0;
  private windowMs = 0;
  constructor(width: number, height: number, dpr: number) {
    this.ceiling = pixelRatioCeiling(width, height, dpr);
    this.ratio = this.ceiling;
  }
  resize(width: number, height: number, dpr: number) {
    const fraction = this.ratio / this.ceiling;
    this.ceiling = pixelRatioCeiling(width, height, dpr);
    this.ratio = this.ceiling * fraction;
    this.reset();
  }
  reset() {
    this.samples = [];
    this.stableMs = 0;
    this.windowMs = 0;
  }
  sample(ms: number): boolean {
    // Ignore debugger stops, background-tab resumes, and zero-duration frames.
    if (!Number.isFinite(ms) || ms <= 0 || ms > 1000) return false;
    this.samples.push(ms);
    this.windowMs += ms;
    if (
      this.samples.length < 60 &&
      (this.samples.length < 8 || this.windowMs < 1200)
    )
      return false;
    const sorted = this.samples.slice().sort((a, b) => a - b);
    this.frameMs =
      this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const windowMs = this.windowMs;
    this.windowMs = 0;
    this.samples = [];
    const old = this.ratio;
    if (this.frameMs > 19.2 && p90 > 20) {
      this.ratio = Math.max(this.ceiling * 0.55, this.ratio * 0.85);
      this.stableMs = 0;
    } else if (this.frameMs < 17.2 && p90 < 18) {
      this.stableMs += windowMs;
      if (this.stableMs > 8000) {
        this.ratio = Math.min(this.ceiling, this.ratio * 1.06);
        this.stableMs = 0;
      }
    } else this.stableMs = 0;
    return Math.abs(this.ratio - old) > 0.001;
  }
}
