import {
  Mesh,
  MeshBuilder,
  Scene,
  Vector3,
  VertexData,
  VertexBuffer,
  RawTexture,
  Texture,
  Constants,
} from "@babylonjs/core";
import { TerrainMaterial } from "@babylonjs/materials";
import { Noise2D, smoothstep } from "./noise";
import {
  generateProceduralSurface,
  grassRamp,
  rockRamp,
  dirtRamp,
} from "./textures";

export const TERRAIN_SIZE = 480;
const SUBDIVISIONS = 240; // ~2m grid resolution
const MIXMAP_RES = 512;

const heightNoise = new Noise2D(2024);
const detailNoise = new Noise2D(5150);

/** World-space height field used for both mesh generation and gameplay (player/prop placement). */
export function heightAt(x: number, z: number): number {
  const hills = heightNoise.fbm(x * 0.008, z * 0.008, 5, 2.1, 0.52) * 10;
  const detail = detailNoise.fbm(x * 0.03, z * 0.03, 4, 2.0, 0.5) * 2.2;
  // Rocky outcrops only form in patches (masked by broad low-frequency noise), keeping most
  // of the map as gentle rolling hills while still producing real cliffs/slopes here and there.
  const outcropMask = smoothstep(0.05, 0.22, heightNoise.fbm(x * 0.006 + 900, z * 0.006 + 900, 3));
  const ridge = heightNoise.ridged(x * 0.045, z * 0.045, 4, 2.1, 0.55) * 7 * outcropMask;
  return hills + detail + ridge;
}

/** Approximate normal via finite differences, used for slope-based texture blending & prop alignment. */
export function normalAt(x: number, z: number, eps = 0.75): Vector3 {
  const hL = heightAt(x - eps, z);
  const hR = heightAt(x + eps, z);
  const hD = heightAt(x, z - eps);
  const hU = heightAt(x, z + eps);
  const n = new Vector3(hL - hR, 2 * eps, hD - hU);
  return n.normalize();
}

export interface TerrainResult {
  mesh: Mesh;
}

export function buildTerrain(scene: Scene): TerrainResult {
  const ground = MeshBuilder.CreateGround(
    "terrain",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind)! as Float32Array;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    positions[i + 1] = heightAt(x, z);
  }
  ground.updateVerticesData("position", positions);

  const normals: number[] = [];
  const indices = ground.getIndices()!;
  VertexData.ComputeNormals(positions, indices, normals);
  ground.updateVerticesData("normal", normals);

  ground.receiveShadows = true;

  const grass = generateProceduralSurface(scene, {
    seed: 11,
    scale: 5,
    colorRamp: grassRamp,
    bumpStrength: 1.6,
    tiling: 48,
  });
  const rock = generateProceduralSurface(scene, {
    seed: 77,
    scale: 7,
    colorRamp: rockRamp,
    bumpStrength: 3.2,
    tiling: 30,
  });
  const dirt = generateProceduralSurface(scene, {
    seed: 33,
    scale: 6,
    colorRamp: dirtRamp,
    bumpStrength: 1.8,
    tiling: 36,
  });

  const mixTexture = buildMixMap(scene);

  const material = new TerrainMaterial("terrainMat", scene);
  material.specularPower = 64;
  material.maxSimultaneousLights = 4;
  material.mixTexture = mixTexture;

  material.diffuseTexture1 = grass.albedo;
  material.bumpTexture1 = grass.normal;
  material.diffuseTexture2 = rock.albedo;
  material.bumpTexture2 = rock.normal;
  material.diffuseTexture3 = dirt.albedo;
  material.bumpTexture3 = dirt.normal;

  material.diffuseTexture1.uScale = material.diffuseTexture1.vScale = 60;
  material.diffuseTexture2.uScale = material.diffuseTexture2.vScale = 40;
  material.diffuseTexture3.uScale = material.diffuseTexture3.vScale = 50;

  material.specularColor.set(0.05, 0.05, 0.05);

  ground.material = material;
  ground.isPickable = true;
  ground.checkCollisions = false; // gameplay collision uses heightAt() directly, see PlayerController

  return { mesh: ground };
}

/**
 * Low-res RGB weight map (R=grass, G=rock, B=dirt) painted from slope + height,
 * consumed by TerrainMaterial to blend the three procedural surfaces.
 */
function buildMixMap(scene: Scene): RawTexture {
  const data = new Uint8Array(MIXMAP_RES * MIXMAP_RES * 4);

  for (let y = 0; y < MIXMAP_RES; y++) {
    for (let x = 0; x < MIXMAP_RES; x++) {
      const wx = (x / MIXMAP_RES - 0.5) * TERRAIN_SIZE;
      const wz = (y / MIXMAP_RES - 0.5) * TERRAIN_SIZE;
      const n = normalAt(wx, wz);
      const h = heightAt(wx, wz);
      const slope = 1 - n.y; // 0 = flat, 1 = vertical

      const rockWeight = smoothstep(0.05, 0.2, slope);
      const dirtWeight = (1 - rockWeight) * smoothstep(0.5, -3, h) * 0.6;
      const grassWeight = Math.max(0, 1 - rockWeight - dirtWeight);

      const total = grassWeight + rockWeight + dirtWeight || 1;
      const idx = (y * MIXMAP_RES + x) * 4;
      data[idx] = (grassWeight / total) * 255;
      data[idx + 1] = (rockWeight / total) * 255;
      data[idx + 2] = (dirtWeight / total) * 255;
      data[idx + 3] = 255;
    }
  }

  const tex = RawTexture.CreateRGBATexture(
    data,
    MIXMAP_RES,
    MIXMAP_RES,
    scene,
    false,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
  );
  return tex;
}
