import {
  Scene,
  Vector3,
  MeshBuilder,
  Mesh,
  PBRMaterial,
  Color3,
  TransformNode,
} from "@babylonjs/core";

const RADIUS = 5;
const BEAM_HEIGHT = 50;

export class ExtractionZone {
  readonly position: Vector3;
  readonly radius = RADIUS;

  private root: TransformNode;
  private ring: Mesh;
  private beam: Mesh;
  private time = 0;

  constructor(scene: Scene, position: Vector3) {
    this.position = position.clone();
    this.root = new TransformNode("extractionZone", scene);
    this.root.position.copyFrom(position);

    const glowColor = new Color3(0.25, 0.95, 0.85);

    this.ring = MeshBuilder.CreateTorus("extractionRing", { diameter: RADIUS * 2, thickness: 0.35, tessellation: 48 }, scene);
    this.ring.parent = this.root;
    this.ring.position.y = 0.15;
    const ringMat = new PBRMaterial("extractionRingMat", scene);
    ringMat.emissiveColor = glowColor;
    ringMat.albedoColor = Color3.Black();
    ringMat.metallic = 0;
    ringMat.roughness = 1;
    ringMat.disableLighting = true;
    this.ring.material = ringMat;

    this.beam = MeshBuilder.CreateCylinder("extractionBeam", { height: BEAM_HEIGHT, diameterTop: 1.2, diameterBottom: 2.4, tessellation: 24 }, scene);
    this.beam.parent = this.root;
    this.beam.position.y = BEAM_HEIGHT / 2;
    const beamMat = new PBRMaterial("extractionBeamMat", scene);
    beamMat.emissiveColor = glowColor;
    beamMat.albedoColor = Color3.Black();
    beamMat.alpha = 0.16;
    beamMat.disableLighting = true;
    beamMat.backFaceCulling = false;
    this.beam.material = beamMat;
    this.beam.isPickable = false;
  }

  /** Distance from a world-space point to the zone center, ignoring height. */
  distanceXZ(point: Vector3): number {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    return Math.hypot(dx, dz);
  }

  isInside(point: Vector3): boolean {
    return this.distanceXZ(point) <= this.radius;
  }

  update(dt: number) {
    this.time += dt;
    this.beam.rotation.y = this.time * 0.3;
    const pulse = 0.8 + Math.sin(this.time * 2.2) * 0.2;
    (this.ring.material as PBRMaterial).emissiveColor = new Color3(0.25 * pulse, 0.95 * pulse, 0.85 * pulse);
  }
}
