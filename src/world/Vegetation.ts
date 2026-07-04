import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Matrix,
  Vector3,
  Quaternion,
  Color3,
} from "@babylonjs/core";
import { Noise2D, smoothstep } from "./noise";
import { heightAt, normalAt, TERRAIN_SIZE } from "./Terrain";
import { generateProceduralSurface, rockRamp, barkRamp } from "./textures";
import type { ShadowGenerator } from "@babylonjs/core";

const placementNoise = new Noise2D(9001);

function makeRockTemplate(scene: Scene): Mesh {
  const rock = MeshBuilder.CreatePolyhedron("rockTemplate", { type: 1, size: 1 }, scene);
  const surface = generateProceduralSurface(scene, {
    seed: 314,
    scale: 4,
    colorRamp: rockRamp,
    bumpStrength: 2.5,
    tiling: 1,
  });
  const mat = new PBRMaterial("rockMat", scene);
  mat.albedoTexture = surface.albedo;
  mat.bumpTexture = surface.normal;
  mat.roughness = 0.95;
  mat.metallic = 0;
  rock.material = mat;
  rock.isVisible = true;
  rock.position.set(0, -9999, 0);
  rock.alwaysSelectAsActiveMesh = true;
  return rock;
}

function makeTreeTemplates(scene: Scene): { trunk: Mesh; foliage: Mesh } {
  const barkSurface = generateProceduralSurface(scene, {
    seed: 512,
    scale: 5,
    colorRamp: barkRamp,
    bumpStrength: 2.0,
    tiling: 2,
  });
  const barkMat = new PBRMaterial("barkMat", scene);
  barkMat.albedoTexture = barkSurface.albedo;
  barkMat.bumpTexture = barkSurface.normal;
  barkMat.roughness = 0.9;
  barkMat.metallic = 0;

  const trunk = MeshBuilder.CreateCylinder(
    "trunkTemplate",
    { height: 4, diameterTop: 0.35, diameterBottom: 0.6, tessellation: 7 },
    scene,
  );
  trunk.material = barkMat;
  trunk.position.set(0, -9999, 0);
  trunk.alwaysSelectAsActiveMesh = true;

  const foliageMat = new PBRMaterial("foliageMat", scene);
  foliageMat.albedoColor = new Color3(0.09, 0.24, 0.1);
  foliageMat.roughness = 0.85;
  foliageMat.metallic = 0;
  foliageMat.backFaceCulling = false;

  const c1 = MeshBuilder.CreateCylinder("c1", { height: 3.2, diameterTop: 0, diameterBottom: 3.6, tessellation: 8 }, scene);
  c1.position.y = 3.6;
  const c2 = MeshBuilder.CreateCylinder("c2", { height: 2.6, diameterTop: 0, diameterBottom: 2.7, tessellation: 8 }, scene);
  c2.position.y = 5.3;
  const c3 = MeshBuilder.CreateCylinder("c3", { height: 2.0, diameterTop: 0, diameterBottom: 1.8, tessellation: 8 }, scene);
  c3.position.y = 6.7;

  const foliage = Mesh.MergeMeshes([c1, c2, c3], true, true, undefined, false, true)!;
  foliage.name = "foliageTemplate";
  foliage.material = foliageMat;
  foliage.position.set(0, -9999, 0);
  foliage.alwaysSelectAsActiveMesh = true;

  return { trunk, foliage };
}

interface Placement {
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

function scatterPoints(cellSize: number, jitter: number, densityFn: (x: number, z: number) => number): Placement[] {
  const points: Placement[] = [];
  const half = TERRAIN_SIZE / 2 - 6;
  for (let gx = -half; gx < half; gx += cellSize) {
    for (let gz = -half; gz < half; gz += cellSize) {
      const x = gx + (Math.random() - 0.5) * jitter;
      const z = gz + (Math.random() - 0.5) * jitter;
      const density = densityFn(x, z);
      if (Math.random() < density) {
        points.push({ x, z, scale: 0.8 + Math.random() * 0.6, rotation: Math.random() * Math.PI * 2 });
      }
    }
  }
  return points;
}

export function scatterVegetation(scene: Scene, shadowGenerator: ShadowGenerator) {
  const rock = makeRockTemplate(scene);
  const { trunk, foliage } = makeTreeTemplates(scene);

  const treePoints = scatterPoints(7, 5, (x, z) => {
    const slope = 1 - normalAt(x, z).y;
    if (slope > 0.35) return 0;
    const forestMask = placementNoise.fbm(x * 0.006, z * 0.006, 3);
    return smoothstep(0.0, 0.35, forestMask);
  });

  const rockPoints = scatterPoints(9, 6, (x, z) => {
    const slope = 1 - normalAt(x, z).y;
    const rockMask = placementNoise.fbm(x * 0.02 + 500, z * 0.02 + 500, 3);
    return smoothstep(0.04, 0.18, slope) * 0.55 + smoothstep(0.15, 0.4, rockMask) * 0.35;
  });

  for (const p of treePoints) {
    const y = heightAt(p.x, p.z);
    const trunkMatrix = Matrix.Compose(
      new Vector3(p.scale, p.scale * (0.9 + Math.random() * 0.2), p.scale),
      Quaternion.RotationAxis(Vector3.Up(), p.rotation),
      new Vector3(p.x, y, p.z),
    );
    trunk.thinInstanceAdd(trunkMatrix);
    foliage.thinInstanceAdd(trunkMatrix);
  }

  for (const p of rockPoints) {
    const y = heightAt(p.x, p.z) - 0.3 * p.scale;
    const n = normalAt(p.x, p.z);
    const up = Vector3.Up();
    const axis = Vector3.Cross(up, n);
    const angle = Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(up, n))));
    const alignQuat = axis.length() > 0.001
      ? Quaternion.RotationAxis(axis.normalize(), angle)
      : Quaternion.Identity();
    const spin = Quaternion.RotationAxis(Vector3.Up(), p.rotation);
    const matrix = Matrix.Compose(
      new Vector3(p.scale, p.scale * (0.7 + Math.random() * 0.5), p.scale),
      spin.multiply(alignQuat),
      new Vector3(p.x, y, p.z),
    );
    rock.thinInstanceAdd(matrix);
  }

  trunk.thinInstanceRefreshBoundingInfo(true);
  foliage.thinInstanceRefreshBoundingInfo(true);
  rock.thinInstanceRefreshBoundingInfo(true);

  shadowGenerator.addShadowCaster(trunk);
  shadowGenerator.addShadowCaster(foliage);
  shadowGenerator.addShadowCaster(rock);
  trunk.receiveShadows = true;
  foliage.receiveShadows = true;
  rock.receiveShadows = true;
}
