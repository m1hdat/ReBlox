import type { GameMap, MapInfo } from "../api/client";
import type { SaveData } from "../app/progress";
import { icon, escapeHtml } from "../ui/icons";
import type { Toy } from "../app/catalog";

export interface MapScreenContext { maps: MapInfo[]; boards: Map<string, GameMap>; selected: string; save: SaveData; group: Toy; }
export const mapStatus = (id: string, save: SaveData) => save.completed[id] ? "Đã hoàn thành" : save.checkpoint?.mapId === id ? "Đang chơi" : save.playedMapIds.includes(id) ? "Chưa hoàn thành" : "Chưa chơi";

/** Hình thu nhỏ lấy trực tiếp từng ô và cầu trong JSON; không dùng ảnh minh họa thay map. */
export function mapThumbnail(map: GameMap) {
  const size = 16, cells: string[] = [];
  map.grid.forEach((row, r) => [...row].forEach((tile, c) => {
    if (tile === ".") return;
    const x = c * size, y = r * size;
    const fill = tile === "G" ? "#d9b455" : tile === "F" ? "#c5dbe0" : tile === "X" ? "#b8a7c7" : "#b7c6bc";
    cells.push(`<rect x="${x + 1}" y="${y + 1}" width="14" height="14" rx="2" fill="${fill}" stroke="#627f78" stroke-width=".6"/>`);
    if (tile === "s") cells.push(`<circle cx="${x + 8}" cy="${y + 8}" r="3" fill="#d7ae59"/>`);
    if (tile === "h") cells.push(`<rect x="${x + 5}" y="${y + 5}" width="6" height="6" fill="#b65b42"/>`);
    if (tile === "F") cells.push(`<path d="m${x + 4} ${y + 3} 4 5-2 2 5 3" stroke="#638996" fill="none"/>`);
    if (tile === "G") cells.push(`<rect x="${x + 4}" y="${y + 4}" width="8" height="8" fill="#3e6261"/>`);
    if (tile === "X") cells.push(`<path d="M${x+6} ${y+4}q-4 4 0 8m4-8q4 4 0 8" stroke="#665376" stroke-width="1.4" fill="none"/>`);
  }));
  for (const bridge of map.bridges) for (const [r, c] of bridge.cells) cells.push(`<rect x="${c * size + 1}" y="${r * size + 1}" width="14" height="14" rx="2" fill="${bridge.initially_open ? "#c6a476" : "#edf2eb"}" stroke="#967a53" stroke-width="1.3"/>`);
  cells.push(`<rect x="${map.start[1] * size + 4}" y="${map.start[0] * size + 3}" width="8" height="10" rx="1" fill="#235f61"/>`);
  return `<svg class="map-thumbnail" viewBox="-3 -3 ${map.cols * size + 6} ${map.rows * size + 6}" role="img" aria-label="Hình bàn cờ ${escapeHtml(map.name)}" data-rows="${map.rows}" data-cols="${map.cols}">${cells.join("")}</svg>`;
}
export function cameraTools(zoom = false) {
  const tools = [["camera-left", "rotate-left", "Xoay trái"], ["camera-right", "rotate-right", "Xoay phải"], ["camera-top", "top", "Nhìn từ trên"], ["camera-reset", "view", "Đặt lại góc nhìn"]];
  if (zoom) tools[3][2] = "Toàn bộ map";
  if (zoom) tools.push(["camera-zoom-in", "plus", "Phóng to"], ["camera-zoom-out", "minus", "Thu nhỏ"]);
  return `<div class="camera-tools" role="group" aria-label="Góc nhìn bàn cờ">${tools.map(([action, image, title]) => `<button class="icon-button" data-action="${action}" title="${title}" aria-label="${title}" ${action === "camera-top" || action === "camera-reset" ? `aria-pressed="${action === "camera-reset"}"` : ""}>${icon(image, zoom ? 17 : 20)}${zoom && action === "camera-reset" ? '<span>Toàn bộ map</span>' : ""}</button>`).join("")}</div>`;
}
export function mapPreviewInfo(context: MapScreenContext) {
  const map = context.boards.get(context.selected), info = context.maps.find((map) => map.id === context.selected);
  if (!info || !map) return `<h2>Chưa tải được bản đồ</h2><button class="text-button" data-action="retry">Thử lại</button>`;
  return `<div><span class="overline">Map ${String(context.maps.indexOf(info) + 1).padStart(2, "0")} · ${map.rows} × ${map.cols}</span><h2 id="preview-name">${escapeHtml(map.name)}</h2></div><p>${escapeHtml(map.description ?? "Đưa khối đứng thẳng vào ô đích.")}</p>${map.bridges.some(bridge => !bridge.initially_open) ? '<p class="bridge-preview-note">Cầu đóng: viền vàng có dấu ×.</p>' : ""}${!info.playable ? `<p class="map-support-note">${escapeHtml(info.pending_reason ?? "Cơ chế trong map này chưa được backend hỗ trợ.")}</p>` : map.solvable === false ? '<p class="map-support-note">Map thử nghiệm vô nghiệm. Bạn vẫn có thể vào chơi.</p>' : ""}`;
}
export function mapPlayActions(context: MapScreenContext) {
  const info = context.maps.find((map) => map.id === context.selected), board = context.boards.get(context.selected);
  const resume = context.save.checkpoint?.mapId === context.selected;
  return `<span class="play-action-name">${escapeHtml(info?.name ?? "Chọn một map")}</span><button class="button primary" data-action="play-map" ${!info?.playable || !board ? "disabled" : ""}>${icon("play", 19)} Chơi map này</button>${resume && info?.playable ? '<button class="text-button" data-action="continue">Tiếp tục ván đã lưu</button>' : ""}`;
}
export function mapsScreen(context: MapScreenContext) {
  return `<section class="map-screen"><header class="screen-top"><button class="back-button" data-action="components">${icon("back", 20)} Menu linh kiện</button><h1>Chọn map</h1><button class="icon-button" data-action="settings" title="Cài đặt" aria-label="Cài đặt">${icon("gear", 22)}</button></header>
    <div class="map-browser"><aside class="map-library"><div class="map-library-heading"><h2>${escapeHtml(context.group.name)}</h2><span>${context.maps.length} map</span></div><div class="map-list" role="group" aria-label="Các map của ${escapeHtml(context.group.name)}">${context.maps.map((info, index) => {
      const map = context.boards.get(info.id), result = context.save.completed[info.id];
      return `<button class="map-option" data-action="select-map" data-id="${escapeHtml(info.id)}" aria-pressed="${info.id === context.selected}" aria-controls="map-preview-info"><span class="map-tray">${map ? mapThumbnail(map) : icon("view", 32)}</span><span class="map-option-copy"><span class="map-number">Map ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(info.name)}</strong><span class="map-state">${mapStatus(info.id, context.save)}${result ? ` · Kỷ lục ${result.bestMoves} nước` : ""}</span>${!info.playable ? '<span class="map-pending">Chưa hỗ trợ cơ chế</span>' : ""}</span><span class="map-check" aria-hidden="true">${icon("check", 17)}</span></button>`;
    }).join("")}</div><button class="technical-book" data-action="lab">${icon("book", 22)} Sổ kỹ thuật ${icon("arrow", 18)}</button></aside>
    <div class="map-preview"><div class="preview-header"><div id="map-preview-info" class="map-preview-info">${mapPreviewInfo(context)}</div></div><div id="scene-slot" class="map-preview-stage" aria-label="Góc bàn lắp ráp 3D"><div class="preview-toolbar">${cameraTools(true)}</div><span class="orbit-help ${context.save.seenOrbit ? "" : "first-visit"}">Kéo xuống để nhìn từ trên</span><div id="preview-tooltip" class="preview-tooltip hidden" role="tooltip"></div></div><div id="map-play-actions" class="map-play-actions">${mapPlayActions(context)}</div></div></div><p id="map-announcement" class="sr-only" role="status" aria-live="polite"></p></section>`;
}
