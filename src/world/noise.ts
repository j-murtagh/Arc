// Deterministic 2D gradient (Perlin-style) noise with fractal Brownian motion.
// Self-contained so the terrain/texture generators need no external asset or npm noise package.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class Noise2D {
  private perm: Uint8Array;
  private gradX: Float32Array;
  private gradY: Float32Array;

  constructor(seed = 1337) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    this.gradX = new Float32Array(512);
    this.gradY = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      const angle = (this.perm[i] / 255) * Math.PI * 2;
      this.gradX[i] = Math.cos(angle);
      this.gradY[i] = Math.sin(angle);
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number) {
    return a + t * (b - a);
  }

  /** Raw gradient noise in roughly [-1, 1]. */
  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const dot = (ix: number, iy: number, dx: number, dy: number) => {
      const idx = this.perm[ix + this.perm[iy]];
      return this.gradX[idx] * dx + this.gradY[idx] * dy;
    };

    const n00 = dot(xi, yi, xf, yf);
    const n10 = dot(xi + 1, yi, xf - 1, yf);
    const n01 = dot(xi, yi + 1, xf, yf - 1);
    const n11 = dot(xi + 1, yi + 1, xf - 1, yf - 1);

    const u = this.fade(xf);
    const v = this.fade(yf);

    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), v);
  }

  /** Fractal Brownian motion: layered octaves for natural-looking terrain. */
  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * frequency, y * frequency) * amplitude;
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged fbm for sharper ridgelines, useful for rocky outcrops. */
  ridged(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amplitude = 0.5;
    let frequency = 1;
    let sum = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise(x * frequency, y * frequency));
      sum += n * n * amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum;
  }
}

/**
 * Gradient noise whose lattice repeats every `period` units, so sampling a
 * texture over exactly one period (or any integer multiple, which is what
 * fbm's power-of-two octaves produce) tiles with zero seam — unlike trying to
 * fake tiling by projecting 2D noise onto a torus, which correlates the two
 * axes and shows up as diagonal banding.
 */
export class TileablePerlin2D {
  private perm: Uint8Array;
  private gradX: Float32Array;
  private gradY: Float32Array;
  private period: number;

  constructor(period: number, seed = 1337) {
    this.period = period;
    const rand = mulberry32(seed);
    const p = new Uint8Array(period);
    for (let i = 0; i < period; i++) p[i] = i;
    for (let i = period - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const tableSize = period * 2;
    this.perm = new Uint8Array(tableSize);
    this.gradX = new Float32Array(tableSize);
    this.gradY = new Float32Array(tableSize);
    for (let i = 0; i < tableSize; i++) {
      this.perm[i] = p[i % period];
      const angle = (this.perm[i] / period) * Math.PI * 2;
      this.gradX[i] = Math.cos(angle);
      this.gradY[i] = Math.sin(angle);
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number) {
    return a + t * (b - a);
  }

  noise(x: number, y: number): number {
    const p = this.period;
    const xi = (((Math.floor(x) % p) + p) % p);
    const yi = (((Math.floor(y) % p) + p) % p);
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const dot = (ix: number, iy: number, dx: number, dy: number) => {
      const idx = this.perm[ix + this.perm[iy]];
      return this.gradX[idx] * dx + this.gradY[idx] * dy;
    };

    const n00 = dot(xi, yi, xf, yf);
    const n10 = dot(xi + 1, yi, xf - 1, yf);
    const n01 = dot(xi, yi + 1, xf, yf - 1);
    const n11 = dot(xi + 1, yi + 1, xf - 1, yf - 1);

    const u = this.fade(xf);
    const v = this.fade(yf);

    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), v);
  }

  /** Same octave structure as Noise2D.fbm; stays seamless because every octave frequency is a power-of-two multiple of the base period. */
  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * frequency, y * frequency) * amplitude;
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / norm;
  }
}
