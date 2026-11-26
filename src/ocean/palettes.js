// Time-of-day presets for the stylized ocean.
// pal: navy, deep, mid, shallow, bright, foam, cloud, glitter, sparkle, sky
// fx:  sparkle, light shafts, night glow, sun/moon disc
// ambient: particles: petals (dawn/sunset), specks (night), glints (lights rising off the water)
export const TIMES = [
  { name: 'Dawn',   light: 0.85, fx: [0.4, 0.3, 0.0, 0.7],  ambient: { petals: 1.0,  specks: 0.0, glints: 0.3 },
    pal: ['#4a4f9e','#5f6fc0','#7f9be0','#a9c3f0','#f2c6dc','#fff4f6','#fbd9e6','#ffe1c4','#ffffff','#f6d9e4'] },
  { name: 'Day',    light: 1.0,  fx: [0.2, 0.6, 0.0, 0.55], ambient: { petals: 0.15, specks: 0.0, glints: 0.1 },
    pal: ['#163f96','#1e5cc0','#1590d0','#1cbfdc','#5be3e8','#f2ffff','#d9f2f6','#f6ffff','#ffffff','#d8f1f3'] },
  { name: 'Sunset', light: 0.8,  fx: [0.6, 0.8, 0.0, 1.0],  ambient: { petals: 0.9,  specks: 0.0, glints: 0.4 },
    pal: ['#32226e','#53359a','#9c4fa6','#e06e9c','#ffa576','#fff2d8','#ffc7b4','#ffd060','#fff7c4','#f7c9a8'] },
  { name: 'Dusk',   light: 0.55, fx: [0.8, 0.1, 0.35, 0.6], ambient: { petals: 0.2,  specks: 0.4, glints: 0.8 },
    pal: ['#1b1a55','#2a2a7a','#43409e','#6a5fc2','#a78ae0','#e8dcff','#b5a8ec','#f0c8ff','#ffffff','#9b8fd1'] },
  { name: 'Night',  light: 0.3,  fx: [1.0, 0.0, 1.0, 0.9],  ambient: { petals: 0.0,  specks: 1.0, glints: 1.0 },
    pal: ['#04071f','#081039','#0f1d55','#123a75','#1667a0','#86f7ff','#26336f','#d8ecff','#b0fff6','#1c2350'] },
];

// Button tint for each preset in the UI.
export const CHIP_COLORS = ['#f6d9e4', '#bfe9f0', '#f7c9a8', '#b5a8ec', '#1c2350'];
