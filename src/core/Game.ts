import {
  Engine,
  Scene,
  Vector3,
  Color4,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
} from "@babylonjs/core";
import { buildEnvironment } from "../world/Sky";
import { buildTerrain, heightAt } from "../world/Terrain";
import { scatterVegetation } from "../world/Vegetation";
import { PlayerController } from "../player/PlayerController";
import { buildHud } from "../ui/hud";

export class Game {
  private engine: Engine;
  private scene: Scene;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.engine = new Engine(canvas, true, {
      antialias: true,
      stencil: true,
      powerPreference: "high-performance",
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.55, 0.65, 0.75, 1);

    const { shadowGenerator } = buildEnvironment(this.scene);
    buildTerrain(this.scene);
    scatterVegetation(this.scene, shadowGenerator);

    const spawnX = 0;
    const spawnZ = 0;
    const spawn = new Vector3(spawnX, heightAt(spawnX, spawnZ) + 1.75, spawnZ);
    const player = new PlayerController(this.scene, this.engine, canvas, spawn);
    this.scene.activeCamera = player.camera;

    this.setupPostProcessing(player);
    buildHud(hudRoot, player);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__debug = { scene: this.scene, engine: this.engine, player };
    }

    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  private setupPostProcessing(player: PlayerController) {
    const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, this.scene, [player.camera]);
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;

    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.75;
    pipeline.bloomWeight = 0.35;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 1; // ACES
    pipeline.imageProcessing.exposure = 1.15;
    pipeline.imageProcessing.contrast = 1.1;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.2;
    pipeline.imageProcessing.vignetteStretch = 0.4;

    pipeline.sharpenEnabled = true;
    pipeline.sharpen.edgeAmount = 0.2;

    if (SSAO2RenderingPipeline.IsSupported) {
      const ssao = new SSAO2RenderingPipeline("ssao", this.scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [player.camera]);
      ssao.totalStrength = 1.1;
      ssao.radius = 2.2;
      ssao.base = 0.05;
      ssao.maxZ = 60;
    }
  }
}
