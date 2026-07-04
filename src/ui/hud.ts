import type { PlayerController } from "../player/PlayerController";

export type ExtractionPromptState = "hidden" | "available" | "extracting";

export class Hud {
  private staminaFill: HTMLDivElement;
  private extractPrompt: HTMLDivElement;
  private extractProgress: HTMLDivElement;
  private extractLabel: HTMLDivElement;
  private completeOverlay: HTMLDivElement;
  private lockPrompt: HTMLDivElement;
  private isPointerLocked = false;
  private extractionComplete = false;

  constructor(root: HTMLElement, player: PlayerController, onRedeploy: () => void) {
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
          transition: width 0.1s linear;
        }
        .bar-fill.health {
          width: 100%;
          background: linear-gradient(90deg, #7a1f1f, #d94a3f);
        }
        .bar-fill.stamina {
          width: 100%;
          background: linear-gradient(90deg, #1f5c7a, #4fb3d9);
        }
        .extract-prompt {
          position: absolute;
          left: 50%;
          bottom: 130px;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.15s ease;
        }
        .extract-prompt.visible {
          opacity: 1;
        }
        .extract-label {
          font-size: 14px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }
        .extract-track {
          width: 200px;
          height: 6px;
          border-radius: 3px;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.15);
          overflow: hidden;
        }
        .extract-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #2fb8a1, #6ee7d4);
        }
        .complete-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 16px;
          background: rgba(4, 10, 8, 0.75);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }
        .complete-overlay.visible {
          opacity: 1;
          pointer-events: auto;
        }
        .complete-overlay h1 {
          font-size: 36px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6ee7d4;
        }
        .redeploy-button {
          pointer-events: auto;
          cursor: pointer;
          font-size: 15px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 10px 28px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.08);
          color: #e8e8e8;
        }
        .redeploy-button:hover {
          background: rgba(255, 255, 255, 0.18);
        }
      </style>
      <div class="crosshair"></div>
      <div class="stat-bars">
        <div class="bar-track"><div class="bar-fill health"></div></div>
        <div class="bar-track"><div class="bar-fill stamina"></div></div>
      </div>
      <div class="extract-prompt" id="extract-prompt">
        <div class="extract-label" id="extract-label">Hold [E] to Extract</div>
        <div class="extract-track"><div class="extract-fill" id="extract-fill"></div></div>
      </div>
      <div class="prompt" id="lock-prompt">
        <h1>Click to Deploy</h1>
        <p>WASD to move &middot; Mouse to look &middot; Shift to sprint &middot; Space to jump &middot; E to extract</p>
      </div>
      <div class="complete-overlay" id="complete-overlay">
        <h1>Extracted</h1>
        <button class="redeploy-button" id="redeploy-button">Redeploy</button>
      </div>
    `;

    this.lockPrompt = root.querySelector<HTMLDivElement>("#lock-prompt")!;
    player.onLockChange((locked) => {
      this.isPointerLocked = locked;
      this.refreshLockPrompt();
    });

    this.staminaFill = root.querySelector<HTMLDivElement>(".bar-fill.stamina")!;
    this.extractPrompt = root.querySelector<HTMLDivElement>("#extract-prompt")!;
    this.extractProgress = root.querySelector<HTMLDivElement>("#extract-fill")!;
    this.extractLabel = root.querySelector<HTMLDivElement>("#extract-label")!;
    this.completeOverlay = root.querySelector<HTMLDivElement>("#complete-overlay")!;

    root.querySelector<HTMLButtonElement>("#redeploy-button")!.addEventListener("click", onRedeploy);
  }

  private refreshLockPrompt() {
    this.lockPrompt.classList.toggle("hidden", this.isPointerLocked || this.extractionComplete);
  }

  setStamina(fraction: number) {
    this.staminaFill.style.width = `${Math.round(fraction * 100)}%`;
  }

  setExtractionPrompt(state: ExtractionPromptState, progress: number) {
    this.extractPrompt.classList.toggle("visible", state !== "hidden");
    this.extractProgress.style.width = `${Math.round(progress * 100)}%`;
    this.extractLabel.textContent = state === "extracting" ? "Extracting..." : "Hold [E] to Extract";
  }

  showExtractionComplete() {
    this.completeOverlay.classList.add("visible");
    this.extractPrompt.classList.remove("visible");
    this.extractionComplete = true;
    this.refreshLockPrompt();
  }

  hideExtractionComplete() {
    this.completeOverlay.classList.remove("visible");
    this.extractionComplete = false;
    this.refreshLockPrompt();
  }
}
