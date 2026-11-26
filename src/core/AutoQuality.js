// Adjusts the render pixel ratio to keep the frame rate smooth.
// Steps down quickly when the frame rate drops, and back up slowly.
export class AutoQuality {
  constructor({ min = 0.75, max = 2, start = max, onChange, enabled = true } = {}) {
    Object.assign(this, { min, max, value: start, onChange, enabled });
    this.frames = 0; this.time = 0; this.good = 0; this.warmup = 1.5;
  }

  tick(dt) {
    if (!this.enabled) return;
    if (this.warmup > 0) { this.warmup -= dt; return; }
    this.frames++; this.time += dt;
    if (this.time < 1.5) return;
    const fps = this.frames / this.time;
    this.frames = 0; this.time = 0;
    if (fps < 45 && this.value > this.min) { this.set(this.value - 0.25); this.good = 0; }
    else if (fps > 58) { if (++this.good >= 4 && this.value < this.max) { this.set(this.value + 0.25); this.good = 0; } }
    else this.good = 0;
  }

  set(v) {
    this.value = Math.min(this.max, Math.max(this.min, v));
    this.onChange?.(this.value);
  }
}
