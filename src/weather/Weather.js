// Weather: presets, a slowly changing automatic mode, and real local weather.
//
//   const wx = new Weather();
//   wx.setMode('auto' | 'local' | 'manual');
//   wx.setPreset('rain');               // manual: Clear, Cloudy, Rain, Storm, Fog
//   wx.update(dt);                      // every frame
//   wx.cur → { storm, foam, clouds, rain, fog, thunder, wind } (smoothed, 0 … 1)
//   wx.flash (0 … 1 lightning), wx.rainbow (0 … 1), wx.windDir (unit [x, z])
//
// Values glide toward their targets: quickly when you pick a preset, slowly
// (tens of seconds) when the weather changes by itself.

export const PRESETS = {
  clear:  { name: 'Clear',  storm: 0.2,  foam: 0.3,  clouds: 0.08, rain: 0,   fog: 0,    thunder: 0, wind: 0.3 },
  cloudy: { name: 'Cloudy', storm: 0.35, foam: 0.35, clouds: 0.7,  rain: 0,   fog: 0,    thunder: 0, wind: 0.45 },
  rain:   { name: 'Rain',   storm: 0.45, foam: 0.4,  clouds: 0.85, rain: 0.8, fog: 0.15, thunder: 0, wind: 0.5 },
  storm:  { name: 'Storm',  storm: 0.92, foam: 0.7,  clouds: 1.0,  rain: 1.0, fog: 0.1,  thunder: 1, wind: 1.0 },
  fog:    { name: 'Fog',    storm: 0.12, foam: 0.2,  clouds: 0.45, rain: 0,   fog: 0.85, thunder: 0, wind: 0.12 },
};
export const PRESET_IDS = Object.keys(PRESETS);

// automatic mode: gentle states only (no thunder), each lasting a few minutes
const AUTO = {
  clear:    { name: 'Clear',        base: 'clear',  next: [['clear', 1], ['cloudy', 2], ['breezy', 2]], min: 4, max: 7 },
  breezy:   { name: 'Breezy',       base: 'clear',  set: { storm: 0.55, foam: 0.5, clouds: 0.3, wind: 0.75 }, next: [['clear', 1], ['cloudy', 2]], min: 3, max: 5 },
  cloudy:   { name: 'Cloudy',       base: 'cloudy', next: [['shower', 3], ['clear', 1], ['breezy', 1]], min: 3, max: 6 },
  shower:   { name: 'Rain shower',  base: 'rain',   set: { rain: 0.6 }, next: [['clearing', 1]], min: 2, max: 4 },
  clearing: { name: 'Clearing up',  base: 'clear',  set: { clouds: 0.35, foam: 0.35 }, next: [['clear', 2], ['cloudy', 1]], min: 3, max: 5 },
};

const KEYS = ['storm', 'foam', 'clouds', 'rain', 'fog', 'thunder', 'wind'];
const pick = list => { let r = Math.random() * list.reduce((s, [, w]) => s + w, 0); for (const [id, w] of list) if ((r -= w) <= 0) return id; return list[0][0]; };

export class Weather {
  constructor() {
    this.mode = 'auto';             // 'auto' | 'local' | 'manual'
    this.preset = 'clear';          // manual preset, or 'custom' after slider tweaks
    this.target = { ...PRESETS.clear };
    this.cur = { ...PRESETS.clear };
    this.name = 'Clear';
    this.status = '';               // short status line for the panel (local weather)
    this.flash = 0; this.rainbow = 0;
    this.windAngle = Math.atan2(0.35, 1); // radians in the x/z plane (toward +x, a little south)
    this._windTarget = this.windAngle;
    this.windDir = [Math.cos(this.windAngle), Math.sin(this.windAngle)];
    this._autoState = 'clear'; this._autoLeft = 0; this._first = true;   // automatic mode opens on a clear spell
    this._boltIn = 6; this._flashes = [];
    this._rainPeak = 0; this._rainbowLeft = 0;
    this._local = null; this._localTimer = null;
    this.onThunder = null;          // (delaySeconds, strength, near) → play thunder; place the strike
    this.onChange = null;           // name / status changed (for the panel)
  }

  get rate() { return this.mode === 'manual' ? 1 / 2.5 : 1 / 25; }   // 1 / seconds to settle

  setMode(mode) {
    this.mode = mode;
    clearInterval(this._localTimer); this._localTimer = null;
    if (mode === 'auto') { this._autoLeft = 0; this.status = 'Changes by itself every few minutes'; }
    else if (mode === 'local') this._startLocal();
    else { this.status = 'Pick a weather above'; if (this.preset !== 'custom') this.setPreset(this.preset); }
    this.onChange?.();
  }

  setPreset(id) {
    this.preset = id; this.mode = 'manual';
    clearInterval(this._localTimer); this._localTimer = null;
    if (PRESETS[id]) { Object.assign(this.target, PRESETS[id]); this.name = PRESETS[id].name; }
    this.status = 'Fine-tune with the sliders below';
    this.onChange?.();
  }

  /** A slider moved: switch to manual with the current look, then apply it. */
  tweak(key, v) {
    if (this.mode !== 'manual') { Object.assign(this.target, this.cur); this.mode = 'manual'; }
    this.preset = 'custom'; this.name = 'Custom';
    this.target[key] = v; this.cur[key] = v;   // sliders respond immediately
    this.status = 'Fine-tune with the sliders below';
    this.onChange?.();
  }

  update(dt) {
    if (this.mode === 'auto') this._auto(dt);

    // glide toward the target
    const k = 1 - Math.exp(-dt * this.rate);
    for (const key of KEYS) this.cur[key] += (this.target[key] - this.cur[key]) * k;

    // wind direction turns slowly (the whole sea pattern follows it)
    let d = Math.atan2(Math.sin(this._windTarget - this.windAngle), Math.cos(this._windTarget - this.windAngle));
    this.windAngle += Math.sign(d) * Math.min(Math.abs(d), dt * 0.004);
    this.windDir[0] = Math.cos(this.windAngle); this.windDir[1] = Math.sin(this.windAngle);

    // lightning: a strike flickers in 2-4 return strokes a fraction of a second
    // apart; close strikes are bright and the thunder cracks almost at once,
    // distant ones are dim sheet-lightning glows with a late, low rumble
    if (this.cur.thunder > 0.3) {
      if ((this._boltIn -= dt) <= 0) {
        this._boltIn = 3 + Math.random() * 9;
        const near = Math.random() < 0.35, s = near ? 0.85 + Math.random() * 0.15 : 0.25 + Math.random() * 0.3;
        let at = 0;
        const strokes = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < strokes; i++) { this._flashes.push([at, s * (i ? 0.55 + Math.random() * 0.4 : 1)]); at += 0.05 + Math.random() * 0.12; }
        const delay = near ? 0.15 + Math.random() * 0.5 : 2 + Math.random() * 4;   // sound travels ~1 km in 3 s
        this.onThunder?.(delay, s, near);
      }
    }
    this.flash *= Math.exp(-dt * 14);
    this._flashes = this._flashes.filter(f => { f[0] -= dt; if (f[0] <= 0) { this.flash = Math.max(this.flash, f[1]); return false; } return true; });

    // rainbow after rain: once a good shower eases off
    this._rainPeak = Math.max(this._rainPeak * Math.exp(-dt / 120), this.cur.rain);
    if (this._rainPeak > 0.35 && this.cur.rain < 0.12 && this.cur.clouds < 0.75 && this.cur.fog < 0.3 && this._rainbowLeft <= 0) { this._rainbowLeft = 110; this._rainPeak = 0; }
    this._rainbowLeft = Math.max(0, this._rainbowLeft - dt);
    const want = this._rainbowLeft > 0 ? Math.min(1, this._rainbowLeft / 20) : 0;
    this.rainbow += (want - this.rainbow) * Math.min(1, dt * 0.3);
  }

  _auto(dt) {
    if ((this._autoLeft -= dt) > 0) return;
    const prev = AUTO[this._autoState];
    const id = this._first ? 'clear' : pick(prev.next);
    this._first = false;
    const S = AUTO[id];
    this._autoState = id;
    this._autoLeft = (S.min + Math.random() * (S.max - S.min)) * 60;
    Object.assign(this.target, PRESETS[S.base], S.set || {});
    this._windTarget = this.windAngle + (Math.random() - 0.5) * 1.2;   // wind veers a little
    this.name = S.name;
    this.status = this._failMsg || 'Changes by itself every few minutes';
    this._failMsg = null;
    this.onChange?.();
  }

  // --- real local weather (Open-Meteo, no key) --------------------------------
  _startLocal() {
    this.status = 'Finding your location…'; this.onChange?.();
    if (!navigator.geolocation) return this._localFail('Location is not available on this device');
    navigator.geolocation.getCurrentPosition(pos => {
      // rounded to ~1 km: enough for the weather, not an exact location
      this._local = { lat: pos.coords.latitude.toFixed(2), lon: pos.coords.longitude.toFixed(2) };
      this._fetchLocal();
      this._localTimer = setInterval(() => this._fetchLocal(), 15 * 60 * 1000);
    }, () => this._localFail('Location permission was not given'), { maximumAge: 30 * 60 * 1000, timeout: 15000 });
  }

  async _fetchLocal() {
    if (this.mode !== 'local' || !this._local) return;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this._local.lat}&longitude=${this._local.lon}` +
        '&current=weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation&wind_speed_unit=kmh';
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const c = (await res.json()).current;
      if (this.mode !== 'local') return;
      this._applyLocal(c);
    } catch { this._localFail('Could not reach the weather service'); }
  }

  _applyLocal(c) {
    const code = c.weather_code, wind = c.wind_speed_10m ?? 10;
    let id = 'clear', label = 'Clear';
    if (code === 2) { id = 'cloudy'; label = 'Partly cloudy'; }
    else if (code === 3) { id = 'cloudy'; label = 'Overcast'; }
    else if (code === 45 || code === 48) { id = 'fog'; label = 'Fog'; }
    else if (code >= 51 && code <= 57) { id = 'rain'; label = 'Drizzle'; }
    else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) { id = 'rain'; label = code === 65 || code === 82 ? 'Heavy rain' : 'Rain'; }
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) { id = 'cloudy'; label = 'Snow (shown as cloudy)'; }
    else if (code >= 95) { id = 'storm'; label = 'Thunderstorm'; }
    const t = { ...PRESETS[id] };
    t.clouds = Math.max(id === 'clear' ? 0 : 0.4, (c.cloud_cover ?? 30) / 100);
    if (id === 'rain') t.rain = code >= 51 && code <= 57 ? 0.4 : code === 65 || code === 82 ? 1 : 0.75;
    t.wind = Math.min(1, wind / 45);
    t.storm = Math.max(t.storm * 0.6, Math.min(1, 0.1 + wind / 55));
    t.foam = 0.25 + t.storm * 0.4;
    Object.assign(this.target, t);
    // meteorological direction is where the wind comes FROM, clockwise from north;
    // the sea is north-up (−z), east = +x
    const to = THREE_DEG * ((c.wind_direction_10m ?? 250) + 180);
    this._windTarget = Math.atan2(-Math.cos(to), Math.sin(to));
    this.name = label;
    this.status = `Weather near you · wind ${Math.round(wind)} km/h`;
    this.onChange?.();
  }

  _localFail(msg) {
    this.mode = 'auto'; this._autoLeft = 0;
    this.status = this._failMsg = msg + ' · showing changing weather';
    this.onChange?.('local-failed');
  }
}

const THREE_DEG = Math.PI / 180;
