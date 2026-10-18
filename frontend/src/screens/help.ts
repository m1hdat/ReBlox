import type { GameMap } from "../api/client";
import { escapeHtml } from "../ui/icons";

export function mapRule(map: GameMap) {
  const rules = [];
  if (map.grid.some((row) => row.includes("F"))) rules.push("Ô nứt chỉ chịu khối nằm; đứng lên sẽ làm ô vỡ.");
  if (map.switches.length) rules.push("Nút tròn nhận khối nằm hoặc đứng. Nút vuông cần khối đứng để điều khiển cầu.");
  return rules.join(" ") || "Khi khối đang đứng, một lần lăn sẽ chiếm hai ô phía trước. Ô trống không đỡ được khối.";
}
export function helpScreen(map: GameMap) {
  return `<div class="modal-paper help-paper" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="Đóng">×</button><span class="overline">Hướng dẫn map</span><h1 id="modal-title">${escapeHtml(map.name)}</h1><dl><dt>Mục tiêu</dt><dd>Đưa khối đứng thẳng vào ô viền vàng.</dd><dt>Điều khiển</dt><dd>Dùng WASD, phím mũi tên hoặc D-pad trên màn hình cảm ứng. Các hướng luôn theo bàn cờ, kể cả khi xoay camera.</dd><dt>Luật cần nhớ</dt><dd>${mapRule(map)}</dd></dl><button class="button primary" data-action="close-modal">Đã hiểu</button></div>`;
}
