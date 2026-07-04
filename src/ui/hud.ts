import type { PlayerController } from "../player/PlayerController";

export function buildHud(root: HTMLElement, player: PlayerController) {
  root.innerHTML = `
    <style>
      .crosshair {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
      }
      .prompt {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        background: rgba(5, 8, 6, 0.55);
        transition: opacity 0.25s ease;
        pointer-events: none;
      }
      .prompt h1 {
        font-size: 28px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .prompt p {
        opacity: 0.75;
        font-size: 14px;
      }
      .prompt.hidden {
        opacity: 0;
      }
      .stat-bars {
        position: absolute;
        left: 24px;
        bottom: 24px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 220px;
      }
      .bar-track {
        height: 10px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.15);
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 3px;
      }
      .bar-fill.health {
        width: 100%;
        background: linear-gradient(90deg, #7a1f1f, #d94a3f);
      }
      .bar-fill.stamina {
        width: 100%;
        background: linear-gradient(90deg, #1f5c7a, #4fb3d9);
      }
    </style>
    <div class="crosshair"></div>
    <div class="stat-bars">
      <div class="bar-track"><div class="bar-fill health"></div></div>
      <div class="bar-track"><div class="bar-fill stamina"></div></div>
    </div>
    <div class="prompt" id="lock-prompt">
      <h1>Click to Deploy</h1>
      <p>WASD to move &middot; Mouse to look &middot; Shift to sprint &middot; Space to jump</p>
    </div>
  `;

  const prompt = root.querySelector<HTMLDivElement>("#lock-prompt")!;
  player.onLockChange((locked) => prompt.classList.toggle("hidden", locked));
}
