import "./style.css";
import { Game } from "./core/Game";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLElement;

new Game(canvas, hud);
