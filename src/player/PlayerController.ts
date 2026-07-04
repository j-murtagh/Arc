import { Scene, UniversalCamera, Vector3, Engine } from "@babylonjs/core";
import { heightAt } from "../world/Terrain";

const EYE_HEIGHT = 1.75;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.6;
const JUMP_SPEED = 6.5;
const GRAVITY = -18;
const MOUSE_SENSITIVITY = 0.0022;

const STAMINA_MAX = 100;
const STAMINA_DRAIN_PER_SEC = 24;
const STAMINA_REGEN_PER_SEC = 16;
const STAMINA_REGEN_DELAY = 0.6; // seconds after sprint stops before regen kicks in
const STAMINA_RESUME_THRESHOLD = 20; // must regen back to this much before sprint is allowed again

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
  private stamina = STAMINA_MAX;
  private canSprint = true;
  private staminaRegenCooldown = 0;
  private inputEnabled = true;

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
      if (!this.pointerLocked || !this.inputEnabled) return;
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

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Normalized 0..1 for HUD display. */
  getStamina(): number {
    return this.stamina / STAMINA_MAX;
  }

  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    if (!enabled) this.keys.clear();
  }

  teleport(position: Vector3) {
    this.camera.position.copyFrom(position);
    this.verticalVelocity = 0;
    this.grounded = true;
  }

  private update() {
    if (this.engine.getDeltaTime() <= 0) return;
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    this.camera.rotation.set(this.pitch, this.yaw, 0);

    if (!this.inputEnabled) return;

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(forward.z, 0, -forward.x);

    let move = Vector3.Zero();
    if (this.keys.has("KeyW")) move = move.add(forward);
    if (this.keys.has("KeyS")) move = move.subtract(forward);
    if (this.keys.has("KeyD")) move = move.add(right);
    if (this.keys.has("KeyA")) move = move.subtract(right);

    const wantsSprint = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && move.lengthSquared() > 0;

    if (!this.canSprint && this.stamina >= STAMINA_RESUME_THRESHOLD) this.canSprint = true;
    const sprinting = wantsSprint && this.canSprint;

    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_PER_SEC * dt);
      this.staminaRegenCooldown = STAMINA_REGEN_DELAY;
      if (this.stamina <= 0) this.canSprint = false;
    } else if (this.staminaRegenCooldown > 0) {
      this.staminaRegenCooldown -= dt;
    } else {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN_PER_SEC * dt);
    }

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
