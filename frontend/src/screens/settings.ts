import type { SaveData } from "../app/progress";
import { icon } from "../ui/icons";
export function settingsScreen(save: SaveData) {
  return `<div class="modal-paper" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="paper-tape"></span><button class="modal-close" data-action="close-modal" aria-label="Đóng">×</button><span class="overline">THEO NHỊP CỦA BẠN</span><h1 id="modal-title">Một chút tùy chỉnh.</h1>
    <label class="setting-toggle"><span><strong>Giảm chuyển động</strong><small>Bỏ chuyển cảnh lăn, rơi và chuyển động nền.</small></span><input id="setting-motion" type="checkbox" ${save.settings.reducedMotion ? "checked" : ""} /></label>
    <label class="setting-speed" for="setting-speed">Tốc độ linh kiện <output id="speed-output">${save.settings.speed}×</output></label><input type="range" id="setting-speed" min="0.5" max="2" step="0.25" value="${save.settings.speed}" />
    <label class="setting-toggle"><span><strong>Hướng dẫn bàn phím</strong><small>Hiện gợi ý WASD và mũi tên khi chơi.</small></span><input id="setting-help" type="checkbox" ${save.settings.showHelp ? "checked" : ""} /></label>
    <p class="settings-footnote">Tùy chọn và tiến độ lưu trong trình duyệt này.</p><button class="button secondary" data-action="close-modal">${icon("check", 18)} Xong rồi</button></div>`;
}
export function pauseScreen() {
  return `<div class="modal-paper pause-paper" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h1 id="modal-title">Tạm dừng</h1><button class="button primary" data-action="close-modal">${icon("play", 18)} Tiếp tục</button><button class="button secondary" data-action="restart">${icon("restart", 18)} Chơi lại</button><div class="pause-menu"><button data-action="help">${icon("hint", 19)} Hướng dẫn</button><button data-action="settings">${icon("gear", 19)} Cài đặt</button><button data-action="maps">${icon("view", 19)} Chọn map</button><button data-action="home">${icon("back", 19)} Cửa tiệm</button></div></div>`;
}
