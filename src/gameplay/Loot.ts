import { Scene, Vector3, MeshBuilder, InstancedMesh, PBRMaterial, Color3 } from "@babylonjs/core";
import { heightAt } from "../world/Terrain";

const LOOT_COUNT = 36;
const PICKUP_RADIUS = 2.2;
const MAP_HALF = 215;

interface LootItem {
  mesh: InstancedMesh;
  x: number;
  z: number;
  baseY: number;
  collected: boolean;
  bobOffset: number;
}

export interface AvoidZone {
  x: number;
  z: number;
  radius: number;
}

/** Glowing pickups scattered across the map; carry them to an extraction zone to bank them. */
export class LootField {
  private items: LootItem[] = [];
  private time = 0;

  constructor(scene: Scene, avoid: AvoidZone[]) {
    const template = MeshBuilder.CreatePolyhedron("lootTemplate", { type: 1, size: 0.32 }, scene);
    const mat = new PBRMaterial("lootMat", scene);
    mat.emissiveColor = new Color3(1.0, 0.72, 0.15);
    mat.albedoColor = Color3.Black();
    mat.disableLighting = true;
    template.material = mat;
    template.isVisible = false;
    template.position.y = -9999;

    let placed = 0;
    let attempts = 0;
    while (placed < LOOT_COUNT && attempts < LOOT_COUNT * 30) {
      attempts++;
      const x = (Math.random() * 2 - 1) * MAP_HALF;
      const z = (Math.random() * 2 - 1) * MAP_HALF;
      if (avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.radius)) continue;

      const baseY = heightAt(x, z) + 0.7;
      const instance = template.createInstance(`loot_${placed}`);
      instance.position.set(x, baseY, z);
      this.items.push({ mesh: instance, x, z, baseY, collected: false, bobOffset: Math.random() * Math.PI * 2 });
      placed++;
    }
  }

  update(dt: number) {
    this.time += dt;
    for (const item of this.items) {
      if (item.collected) continue;
      item.mesh.rotation.y += dt * 1.4;
      item.mesh.position.y = item.baseY + Math.sin(this.time * 2 + item.bobOffset) * 0.15;
    }
  }

  /** Checks proximity to the given point and collects anything in range. Returns how many items were picked up. */
  collect(point: Vector3): number {
    let count = 0;
    for (const item of this.items) {
      if (item.collected) continue;
      if (Math.hypot(point.x - item.x, point.z - item.z) <= PICKUP_RADIUS) {
        item.collected = true;
        item.mesh.setEnabled(false);
        count++;
      }
    }
    return count;
  }

  get remaining(): number {
    return this.items.reduce((n, i) => n + (i.collected ? 0 : 1), 0);
  }

  get total(): number {
    return this.items.length;
  }
}
