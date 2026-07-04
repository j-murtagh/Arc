import { RawTexture, Scene, Texture, Constants } from "@babylonjs/core";
import { TileablePerlin2D } from "./noise";

export interface ProceduralSurface {
  albedo: RawTexture;
  normal: RawTexture;
}

interface SurfaceOptions {
  size?: number;
  seed?: number;
  scale?: number;
  octaves?: number;
  /** Maps a 0..1 noise sample to a linear RGB base color. */
  colorRamp: (n: number) => [number, number, number];
  /** Strength of the generated bump, higher = more pronounced normal map. */
  bumpStrength?: number;
  tiling?: number;
}

/**
 * Builds a tileable albedo + normal map pair entirely from noise, so the
 * environment needs no downloaded art assets to look detailed up close.
 */
export function generateProceduralSurface(
  scene: Scene,
  opts: SurfaceOptions,
): ProceduralSurface {
  const size = opts.size ?? 512;
  const period = Math.max(1, Math.round(opts.scale ?? 6));
  const octaves = opts.octaves ?? 5;
  const bumpStrength = opts.bumpStrength ?? 2.2;
  const noise = new TileablePerlin2D(period, opts.seed ?? 42);

  // Sampling exactly one lattice period across the texture (with every fbm
  // octave a power-of-two multiple of it) makes the tile wrap with zero seam.
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const h = noise.fbm(u, v, octaves);
      height[y * size + x] = h * 0.5 + 0.5;
    }
  }

  const albedoData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);

  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const h = at(x, y);

      const [r, g, b] = opts.colorRamp(h);
      albedoData[idx] = r;
      albedoData[idx + 1] = g;
      albedoData[idx + 2] = b;
      albedoData[idx + 3] = 255;

      // Sobel-style finite difference for the normal map.
      const l = at(x - 1, y);
      const rgt = at(x + 1, y);
      const u2 = at(x, y - 1);
      const d = at(x, y + 1);
      const dx = (rgt - l) * bumpStrength;
      const dy = (d - u2) * bumpStrength;
      const nrm = [-dx, -dy, 1];
      const len = Math.hypot(nrm[0], nrm[1], nrm[2]);
      normalData[idx] = ((nrm[0] / len) * 0.5 + 0.5) * 255;
      normalData[idx + 1] = ((nrm[1] / len) * 0.5 + 0.5) * 255;
      normalData[idx + 2] = ((nrm[2] / len) * 0.5 + 0.5) * 255;
      normalData[idx + 3] = 255;
    }
  }

  const albedo = RawTexture.CreateRGBATexture(
    albedoData,
    size,
    size,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
  );
  const normal = RawTexture.CreateRGBATexture(
    normalData,
    size,
    size,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
  );

  const tiling = opts.tiling ?? 40;
  albedo.wrapU = albedo.wrapV = Texture.WRAP_ADDRESSMODE;
  normal.wrapU = normal.wrapV = Texture.WRAP_ADDRESSMODE;
  albedo.uScale = albedo.vScale = tiling;
  normal.uScale = normal.vScale = tiling;
  albedo.anisotropicFilteringLevel = 8;
  normal.anisotropicFilteringLevel = 8;

  return { albedo, normal };
}

export function grassRamp(n: number): [number, number, number] {
  const dry: [number, number, number] = [92, 88, 46];
  const lush: [number, number, number] = [45, 74, 30];
  const t = Math.pow(n, 1.3);
  return [
    dry[0] + (lush[0] - dry[0]) * t,
    dry[1] + (lush[1] - dry[1]) * t,
    dry[2] + (lush[2] - dry[2]) * t,
  ];
}

export function rockRamp(n: number): [number, number, number] {
  const dark: [number, number, number] = [58, 56, 54];
  const light: [number, number, number] = [128, 122, 112];
  const t = Math.pow(n, 0.9);
  return [
    dark[0] + (light[0] - dark[0]) * t,
    dark[1] + (light[1] - dark[1]) * t,
    dark[2] + (light[2] - dark[2]) * t,
  ];
}

export function dirtRamp(n: number): [number, number, number] {
  const dark: [number, number, number] = [61, 46, 32];
  const light: [number, number, number] = [107, 82, 55];
  const t = Math.pow(n, 1.1);
  return [
    dark[0] + (light[0] - dark[0]) * t,
    dark[1] + (light[1] - dark[1]) * t,
    dark[2] + (light[2] - dark[2]) * t,
  ];
}

export function barkRamp(n: number): [number, number, number] {
  const dark: [number, number, number] = [38, 28, 20];
  const light: [number, number, number] = [72, 54, 38];
  const t = Math.pow(n, 1.0);
  return [
    dark[0] + (light[0] - dark[0]) * t,
    dark[1] + (light[1] - dark[1]) * t,
    dark[2] + (light[2] - dark[2]) * t,
  ];
}
