// Maps the local clock to the ocean's time-of-day scale
// (0 Dawn, 1 Day, 2 Sunset, 3 Dusk, 4 Night; fractions blend, 5 wraps to Dawn).
// Each key is [hour, tod]; tod values keep rising so the blends always run
// forward (Night 4 → Dawn 5 = 0). Between keys the look blends smoothly.
const KEYS = [
  [0, 4],      // night
  [4.5, 4],    // still night
  [6.5, 5],    // dawn
  [8.5, 6],    // day
  [16.5, 6],   // still day
  [18.5, 7],   // sunset
  [19.75, 8],  // dusk
  [21, 9],     // night
  [24, 9],
];

/** Time of day (0 … 5) for a Date, using the device's local time. */
export function todFromClock(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  for (let i = 1; i < KEYS.length; i++) {
    const [h1, v1] = KEYS[i], [h0, v0] = KEYS[i - 1];
    if (h <= h1) return (v0 + (v1 - v0) * (h - h0) / (h1 - h0)) % 5;
  }
  return 4;
}

/** "14:05" in the device's locale. */
export const clockLabel = (date = new Date()) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** A full Dawn → Night → Dawn cycle in one hour: time-of-day units per second. */
export const HOUR_CYCLE_RATE = 5 / 3600;
