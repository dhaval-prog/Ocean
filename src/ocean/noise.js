import * as THREE from 'three';

// Pre-baked, seamlessly tiling noise texture. The water shader reads this
// instead of computing noise per pixel, which is far cheaper on phones.
//
// Channels (each rank-normalised so values are spread evenly over 0..1,
// which makes a threshold of e.g. 0.4 mean "40% of the area"):
//   R  big shapes        G  medium detail / warp
//   B  round blobs (foam) A  fine detail

const smooth = t => t * t * (3 - 2 * t);

export function makeNoiseTexture(size = 256, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;

  const noise = (g, period, x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const x0 = xi % period, y0 = yi % period, x1 = (xi + 1) % period, y1 = (yi + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };

  const channel = periods => {
    const grids = periods.map(p => Float32Array.from({ length: p * p }, rnd));
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0, w = 0, amp = 1;
      periods.forEach((p, k) => { v += amp * noise(grids[k], p, (x / size) * p, (y / size) * p); w += amp; amp *= 0.5; });
      out[y * size + x] = v / w;
    }
    // rank-normalise → uniform distribution
    const order = Uint32Array.from({ length: out.length }, (_, i) => i).sort((i, j) => out[i] - out[j]);
    const ranked = new Float32Array(out.length);
    order.forEach((idx, r) => { ranked[idx] = r / (out.length - 1); });
    return ranked;
  };

  const chans = [channel([4, 8, 16, 32]), channel([8, 16, 32, 64]), channel([5, 10]), channel([16, 32, 64])];
  // Half-float (not 8-bit) so smooth gradients have no flat steps: the shader's
  // anti-aliasing and ink lines rely on clean derivatives.
  const data = new Uint16Array(size * size * 4);
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = THREE.DataUtils.toHalfFloat(chans[c][i]);

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
