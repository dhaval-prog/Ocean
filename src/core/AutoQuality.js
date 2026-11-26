// Adjusts the render pixel ratio to keep the frame rate smooth.
// Steps down when the frame rate drops, and back up slowly.
// If a step down does not actually speed things up (e.g. a phone in battery
// saver mode capped at 30 fps), it is undone and no further steps are taken,
// so a capped screen keeps full sharpness instead of going blurry for nothing.
export class AutoQuality {
  constructor({ min = 1, max = 2, start = max, onChange, enabled = true } = {}) {
    Object.assign(this, { min, max, value: start, onChange, enabled });
    this.frames = 0; this.time = 0; this.good = 0; this.bad = 0; this.warmup = 2.5;
    this.pending = null; // { from, fps } while checking whether the last step down helped
    this.capped = false;
  }

  tick(dt) {
    if (!this.enabled) return;
    if (this.warmup > 0) { this.warmup -= dt; return; }
    this.frames++; this.time += dt;
    if (this.time < 1.5) return;
    const fps = this.frames / this.time;
    this.frames = 0; this.time = 0;

    if (this.pending) {
      const { from, fps: before } = this.pending;
      this.pending = null;
      if (fps < before * 1.12) { this.capped = true; this.set(from); return; } // no gain: frame rate is capped, not GPU-bound
    }
    if (fps < 40) {
      // two slow windows in a row before giving up sharpness (ignores one-off hitches like model loading)
      if (++this.bad >= 2 && !this.capped && this.value > this.min) {
        this.pending = { from: this.value, fps };
        this.set(this.value - 0.25);
        this.bad = 0;
      }
      this.good = 0;
    } else if (fps > 55) {
      this.bad = 0;
      if (++this.good >= 4 && this.value < this.max) { this.set(this.value + 0.25); this.good = 0; }
    } else { this.good = 0; this.bad = 0; }
  }

  set(v) {
    this.value = Math.min(this.max, Math.max(this.min, v));
    this.onChange?.(this.value);
  }
}
