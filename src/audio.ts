/** Optional procedural audio; one context is shared by all voices. */
export class GameAudio {
  muted = true;
  private context: AudioContext | undefined;
  tone(freq: number, volume = 0.035, duration = 0.15) {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
      const osc = this.context.createOscillator(),
        gain = this.context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        freq * 0.65,
        this.context.currentTime + duration,
      );
      gain.gain.setValueAtTime(volume, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.context.currentTime + duration,
      );
      osc.connect(gain).connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + duration);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      /* Audio is optional. */
    }
  }
  // Two short, nearly fixed resonances: a rounded hollow body and a stiff shell.
  // A quick attack avoids clicks; pitch varies subtly between manufactured balls.
  impact(impact: number, color: number, ballContact: boolean, volume: number) {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
      const now = this.context.currentTime;
      const pitch = 1 + (color - 2) * 0.012;
      const fundamental = (ballContact ? 290 : 235) * pitch;
      for (const [frequency, level, decay] of [
        [fundamental, 1, 0.125],
        [fundamental * 2.73, 0.17, 0.032],
        [fundamental * 4.1, Math.min(0.07, impact * 0.007), 0.015],
      ]) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.frequency.setValueAtTime(frequency * 1.04, now);
        osc.frequency.exponentialRampToValueAtTime(frequency, now + 0.022);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * level, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        osc.connect(gain).connect(this.context.destination);
        osc.start(now);
        osc.stop(now + decay);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      }
    } catch {
      /* Audio is optional. */
    }
  }
}
