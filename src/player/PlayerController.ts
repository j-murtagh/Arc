import { Scene, UniversalCamera, Vector3, Engine } from "@babylonjs/core";
import { heightAt } from "../world/Terrain";

const EYE_HEIGHT = 1.75;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.6;
const JUMP_SPEED = 6.5;
const GRAVITY = -18;
const MOUSE_SENSITIVITY = 0.0022;

export class PlayerController {
  readonly camera: UniversalCamera;

  private keys = new Set<string>();
  private yaw = Math.PI;
  private pitch = -0.05;
  private verticalVelocity = 0;
  private grounded = true;
  private pointerLocked = false;
  private lockListeners = new Set<(locked: boolean) => void>();
  private engine: Engine;
  private canvas: HTMLCanvasElement;

  constructor(scene: Scene, engine: Engine, canvas: HTMLCanvasElement, spawn: Vector3) {
    this.engine = engine;
    this.canvas = canvas;
    this.camera = new UniversalCamera("playerCamera", spawn, scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 2000;
    this.camera.fov = 1.05;
    this.camera.inputs.clear(); // fully custom movement/look, no built-in camera inputs

    this.setupPointerLock();
    this.setupKeyboard();

    scene.onBeforeRenderObservable.add(() => this.update());
  }

  private setupPointerLock() {
    this.canvas.addEventListener("click", () => {
      if (!this.pointerLocked) this.canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      for (const cb of this.lockListeners) cb(this.pointerLocked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.yaw += e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      const limit = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });
  }

  private setupKeyboard() {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  onLockChange(cb: (locked: boolean) => void) {
    this.lockListeners.add(cb);
  }

  private update() {
    if (this.engine.getDeltaTime() <= 0) return;
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    this.camera.rotation.set(this.pitch, this.yaw, 0);

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(forward.z, 0, -forward.x);

    let move = Vector3.Zero();
    if (this.keys.has("KeyW")) move = move.add(forward);
    if (this.keys.has("KeyS")) move = move.subtract(forward);
    if (this.keys.has("KeyD")) move = move.add(right);
    if (this.keys.has("KeyA")) move = move.subtract(right);

    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;

    if (move.lengthSquared() > 0) {
      move = move.normalize().scale(speed * dt);
      this.camera.position.x += move.x;
      this.camera.position.z += move.z;
    }

    const groundY = heightAt(this.camera.position.x, this.camera.position.z) + EYE_HEIGHT;

    if (this.grounded && this.keys.has("Space")) {
      this.verticalVelocity = JUMP_SPEED;
      this.grounded = false;
    }

    this.verticalVelocity += GRAVITY * dt;
    this.camera.position.y += this.verticalVelocity * dt;

    if (this.camera.position.y <= groundY) {
      this.camera.position.y = groundY;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
  }
}
