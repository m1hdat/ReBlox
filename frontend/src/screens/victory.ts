import type { GameMap, MapInfo } from "../api/client";
import type { SaveData } from "../app/progress";
import { icon, escapeHtml } from "../ui/icons";
import { nextGroupMap } from "../app/catalog";

export function victoryScreen(map: GameMap, save: SaveData, moves: number, maps: MapInfo[]) {
  const next = nextGroupMap(map.id, maps);
  return `<section class="result-screen"><div id="scene-slot" class="result-stage" aria-label="Bàn cờ vừa hoàn thành"></div><aside class="result-panel"><span class="completion-stamp">${icon("check", 22)} Hoàn thành map</span><h1>${escapeHtml(map.name)}</h1><div class="result-metrics"><div><span>Nước đi</span><strong>${moves}</strong></div><div><span>Kỷ lục của bạn</span><strong>${save.completed[map.id]?.bestMoves ?? moves}</strong></div></div><button class="button primary" data-action="${next ? "next" : "components"}">${next ? "Map tiếp theo" : "Về menu linh kiện"} ${icon("arrow", 19)}</button><button class="button secondary" data-action="replay-level">${icon("restart", 19)} Chơi lại</button><button class="text-button" data-action="maps">${icon("back", 19)} Chọn map</button></aside></section>`;
}
