import type { ScreenContext } from "./types";
import { icon, escapeHtml } from "../ui/icons";
export function labScreen(context: ScreenContext, selected: string) {
  return `<section class="lab-screen"><header class="screen-top"><button class="back-button" data-action="maps">${icon("back")} Quay lại</button><span class="overline">Sổ kỹ thuật</span><button class="icon-button" data-action="settings" aria-label="Cài đặt">${icon("gear")}</button></header>
    <aside class="lab-sheet"><h1>Thử thuật toán</h1><label for="lab-level">Bản đồ thử nghiệm</label><select id="lab-level">${context.maps.map((map) => `<option value="${escapeHtml(map.id)}" ${map.id === selected ? "selected" : ""} ${!map.playable ? "disabled" : ""}>${escapeHtml(map.name)}${!map.playable ? " · Chưa hỗ trợ" : map.id === "unsolvable_01" ? " · Vô nghiệm" : ""}</option>`).join("")}</select>
      <div id="solver-panel"></div><p class="lab-note">Backend hiện chưa cung cấp trace từng node. Bàn 3D phát lại đường đi đã kiểm chứng; không mô phỏng quá trình tìm kiếm.</p></aside>
    <div class="lab-board-caption"><span id="lab-moves">0 nước</span><button class="small-button" data-action="restart">${icon("restart", 16)} Đặt lại</button><span>Thử nghiệm · Không lưu tiến độ</span></div>
  </section>`;
}
