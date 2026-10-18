import type { GameMap } from "../api/client";
import type { SaveData } from "../app/progress";
import { icon, escapeHtml } from "../ui/icons";
import { cameraTools } from "./maps";

export function gameplayScreen(map: GameMap, save: SaveData, number: number, group = "Bloxorz") {
  const record = save.completed[map.id];
  return `<section class="game-shell"><header class="game-hud"><button class="hud-back" data-action="pause" title="Tạm dừng (Esc)" aria-label="Tạm dừng">${icon("pause", 22)}</button><div class="hud-mission"><span>${escapeHtml(group)} · Map ${String(number).padStart(2, "0")}</span><h1>${escapeHtml(map.name)}</h1></div><div class="hud-moves"><span>Nước đi</span><strong id="move-count">0</strong>${record ? `<small>Kỷ lục ${record.bestMoves}</small>` : ""}</div><button class="icon-button" data-action="restart" title="Chơi lại map" aria-label="Chơi lại map">${icon("restart", 22)}</button></header>
    <div class="game-view"><div class="game-camera-bar">${cameraTools()}</div><div id="scene-slot" class="game-stage" aria-label="Bàn cờ Bloxorz 3D"></div></div>
    <footer class="game-bottom"><div class="dpad" id="dpad" aria-label="Điều khiển khối"><button data-a="UP" aria-label="Lên">↑</button><button data-a="LEFT" aria-label="Trái">←</button><button data-a="DOWN" aria-label="Xuống">↓</button><button data-a="RIGHT" aria-label="Phải">→</button></div><p class="keyboard-note ${save.settings.showHelp ? "" : "hidden"}">WASD / phím mũi tên để di chuyển</p><p class="game-objective">Đưa khối đứng vào ô viền vàng.</p><button class="text-button hint-button" data-action="hint" title="Xem mục tiêu và luật của map">${icon("hint", 20)} Gợi ý</button></footer><div id="game-hint" class="game-hint hidden" role="status"><p></p><button data-action="close-hint" aria-label="Đóng gợi ý">×</button></div></section>`;
}
