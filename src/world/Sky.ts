import {
  Scene,
  Vector3,
  MeshBuilder,
  Mesh,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  Color3,
} from "@babylonjs/core";
import { SkyMaterial } from "@babylonjs/materials";

export interface EnvironmentResult {
  sun: DirectionalLight;
  shadowGenerator: ShadowGenerator;
}

/** Golden-hour outdoor lighting: procedural sky, warm sun, soft ambient fill, cascading fog for depth. */
export function buildEnvironment(scene: Scene): EnvironmentResult {
  const sunDirection = new Vector3(-0.35, -0.55, 0.65).normalize();

  // A sphere (rendered from the inside) avoids the visible seams a cube's face
  // edges produce with SkyMaterial's view-direction-based atmospheric scattering.
  const skybox = MeshBuilder.CreateSphere("sky", { diameter: 4000, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyMaterial = new SkyMaterial("skyMat", scene);
  skyMaterial.backFaceCulling = true;
  skyMaterial.turbidity = 6;
  skyMaterial.luminance = 0.85;
  skyMaterial.rayleigh = 1.8;
  skyMaterial.mieDirectionalG = 0.82;
  skyMaterial.mieCoefficient = 0.0075;
  skyMaterial.useSunPosition = true;
  skyMaterial.sunPosition = sunDirection.scale(-1);
  skybox.material = skyMaterial;
  skybox.infiniteDistance = true;
  skybox.applyFog = false;

  const sun = new DirectionalLight("sun", sunDirection, scene);
  sun.position = sunDirection.scale(-200);
  sun.intensity = 3.2;
  sun.diffuse = new Color3(1.0, 0.95, 0.85);
  sun.autoUpdateExtends = true;

  const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.85;
  fill.diffuse = new Color3(0.75, 0.82, 1.0);
  fill.groundColor = new Color3(0.32, 0.3, 0.24);

  const shadowGenerator = new ShadowGenerator(2048, sun);
  shadowGenerator.useContactHardeningShadow = true;
  shadowGenerator.contactHardeningLightSizeUVRatio = 0.06;
  shadowGenerator.bias = 0.0015;
  shadowGenerator.normalBias = 0.02;
  shadowGenerator.setDarkness(0.4);

  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0032;
  scene.fogColor = new Color3(0.72, 0.78, 0.82);

  scene.ambientColor = new Color3(0.3, 0.3, 0.32);
  scene.environmentIntensity = 1.0;

  return { sun, shadowGenerator };
}
