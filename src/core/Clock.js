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

/** The 2-hour cycle: Dawn → Day → Sunset → Dusk → Night → Dawn in 120 minutes,
 *  24 minutes for each time of day (time-of-day units per second). */
export const CYCLE_MINUTES = 120;
export const CYCLE_RATE = 5 / (CYCLE_MINUTES * 60);

/** Weather order inside each time of day in the 2-hour cycle (4.8 minutes each). */
export const CYCLE_WEATHER = ['clear', 'cloudy', 'rain', 'storm', 'fog'];

/** Ocean colours in the order the automatic choice uses them. */
export const AUTO_STYLES = ['deep', 'tropical', 'nordic', 'pastel'];

/**
 * The 2-hour cycle's ocean colour at time of day `tod`: it moves on one step with each weather and
 * each time of day ((time of day + weather) mod 4), so in every 2-hour cycle each colour meets each
 * weather (and each time of day).
 */
export function cycleStyle(tod) {
  const seg = (((tod + 0.5) % 5) + 5) % 5, t = Math.floor(seg) % 5;
  const w = CYCLE_WEATHER.indexOf(cycleWeather(tod));
  return AUTO_STYLES[(t + w) % AUTO_STYLES.length];
}

/**
 * Real time (or a time you picked) with automatic ocean colour: the colour that suits the time of
 * day and the weather. kind: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog'; tod 0 … 5.
 */
export function suitedStyle(kind, tod) {
  const t = Math.round((((tod % 5) + 5) % 5)) % 5;                  // 0 dawn, 1 day, 2 sunset, 3 dusk, 4 night
  if (kind === 'storm') return 'nordic';
  if (kind === 'rain') return 'deep';
  if (kind === 'fog') return t === 4 ? 'nordic' : 'pastel';
  if (kind === 'cloudy') return t === 0 || t === 3 ? 'pastel' : 'deep';
  return ['pastel', 'tropical', 'tropical', 'pastel', 'deep'][t];   // clear
}

/**
 * Which weather the 2-hour cycle has at time of day `tod` (0 … 5). Each time of
 * day is the stretch centred on its whole number (Day = 0.5 … 1.5), and that
 * stretch is split into equal parts, one per weather.
 */
export function cycleWeather(tod) {
  const seg = (((tod + 0.5) % 5) + 5) % 5;              // 0 … 5, whole numbers = start of a time of day
  return CYCLE_WEATHER[Math.min(CYCLE_WEATHER.length - 1, Math.floor((seg - Math.floor(seg)) * CYCLE_WEATHER.length))];
}
