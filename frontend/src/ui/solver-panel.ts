import { api, type SolveResponse, type SolverMetrics } from "../api/client";
import { escapeHtml } from "./icons";
const ALGOS = [["BFS", "BFS", "Chiều rộng"], ["DFS", "DFS", "Chiều sâu"], ["UCS", "UCS", "Chi phí"], ["ASTAR", "A*", "Ước lượng"]];
export interface SolverPanelHooks { getMapId: () => string; replay: (path: string[]) => Promise<void>; isBusy: () => boolean; onBusyChange: (busy: boolean) => void; }
export function initSolverPanel(root: HTMLElement, hooks: SolverPanelHooks) {
  root.innerHTML = `<div class="algorithm-grid">${ALGOS.map(([id, title, desc]) => `<button data-algo="${id}"><strong>${title}</strong><small>${desc}</small></button>`).join("")}</div>
    <label for="cost-model">Hàm chi phí</label><select id="cost-model"><option value="uniform">Đồng nhất · mỗi nước = 1</option><option value="orientation_weighted">Theo tư thế · từ đứng = 2</option></select>
    <button id="btn-mock" class="mock-button">▷ Phát lời giải tham chiếu <b>MOCK</b></button><p class="mock-note">Đường đi có sẵn trong map. Không đo thuật toán.</p>
    <div id="solver-status" class="solver-status" role="status" aria-live="polite"></div><details class="metrics" id="metrics-details" open><summary>Số đo từ backend</summary><div id="solver-metrics"></div></details>
    <details class="metrics comparison"><summary>So sánh các lần chạy</summary><div id="solver-comparison"><p>Chưa có phép đo thực.</p></div></details>`;
  const status = root.querySelector<HTMLElement>("#solver-status")!, metrics = root.querySelector<HTMLElement>("#solver-metrics")!;
  const cost = root.querySelector<HTMLSelectElement>("#cost-model")!;
  const history: { algorithm: string; cost: string; map: string; result: SolverMetrics }[] = [];
  const setStatus = (message: string, kind = "") => { status.textContent = message; status.className = `solver-status ${kind}`; };
  const clearMetrics = () => { metrics.textContent = "Chỉ hiển thị số liệu khi solver trả kết quả thực."; };
  function showMetrics(result: SolverMetrics, algorithm: string) {
    const rows = [["Thời gian tìm kiếm", `${(result.search_time_s * 1000).toFixed(2)} ms`], ["Bộ nhớ cao nhất", `${(result.peak_memory_bytes / 1024).toFixed(1)} KiB`],
      ["Nút đã mở rộng", result.expanded_nodes], ["Độ dài lời giải", result.solution_length ?? "—"], ["Nút đã tạo", result.generated_nodes],
      ["Chi phí lời giải", result.solution_cost ?? "—"], ["Biên tìm kiếm lớn nhất", result.max_frontier_size ?? "—"]];
    const table = document.createElement("table"); table.createCaption().textContent = `${algorithm} · ${cost.value}`;
    const body = table.createTBody(); rows.forEach(([label, value]) => { const row = body.insertRow(); row.insertCell().textContent = String(label); row.insertCell().textContent = String(value); }); metrics.replaceChildren(table);
    history.push({ algorithm, cost: cost.value, map: hooks.getMapId(), result });
    root.querySelector("#solver-comparison")!.innerHTML = `<table><caption>Cùng map và hàm chi phí · ms / KiB / nodes / bước</caption><thead><tr><th>Algo</th><th>ms</th><th>KiB</th><th>Nodes</th><th>Bước</th></tr></thead><tbody>${history.filter((entry) => entry.map === hooks.getMapId() && entry.cost === cost.value).map((entry) => `<tr><td>${escapeHtml(entry.algorithm)}</td><td>${(entry.result.search_time_s * 1000).toFixed(2)}</td><td>${(entry.result.peak_memory_bytes / 1024).toFixed(1)}</td><td>${entry.result.expanded_nodes}</td><td>${entry.result.solution_length ?? "—"}</td></tr>`).join("")}</tbody></table>`;
  }
  async function handle(response: SolveResponse) {
    clearMetrics();
    if (response.status === "not_implemented") {
      const button = root.querySelector<HTMLButtonElement>(`[data-algo="${response.algorithm}"]`);
      if (button) { button.querySelector("small")!.textContent = "Chưa cài đặt"; button.classList.add("unavailable"); }
      return setStatus(`${response.algorithm}: chưa được cài đặt. Nút có thể thử lại sau khi teammate tích hợp solver.`, "warn");
    }
    if (response.status === "no_reference") return setStatus("Map này chưa có lời giải tham chiếu.", "warn");
    if (response.status === "invalid_path") return setStatus("Đường đi từ solver không qua kiểm tra luật chơi. Không phát lại.", "warn");
    if (response.status === "mock") { setStatus("MOCK · đang phát lời giải có sẵn, không đo metrics."); await hooks.replay(response.path ?? []); setStatus("MOCK · đã phát xong. Không cộng tiến độ hoặc kỷ lục chơi tay."); return; }
    if (!response.result) throw new Error("Backend không có kết quả đo.");
    showMetrics(response.result, response.algorithm ?? response.result.algorithm);
    if (response.status === "unsolved") setStatus(`Không tìm thấy nghiệm. ${response.result.note ?? ""}`);
    else { setStatus("Đã kiểm chứng đường đi. Đang phát lại…"); await hooks.replay(response.result.path); setStatus("Đã phát xong đường đi của solver."); }
  }
  const setBusy = (busy: boolean) => { root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => button.disabled = busy); cost.disabled = busy; };
  async function run(mock: boolean, algorithm = "BFS") {
    if (hooks.isBusy()) return;
    hooks.onBusyChange(true); setBusy(true); clearMetrics(); setStatus(mock ? "Đang lấy đường đi tham chiếu…" : `Đang gọi ${algorithm}…`);
    try { await handle(mock ? await api.mockDemo(hooks.getMapId()) : await api.solve(hooks.getMapId(), algorithm, cost.value)); }
    catch (error) { setStatus((error as Error).message, "warn"); }
    finally { hooks.onBusyChange(false); }
  }
  root.querySelectorAll<HTMLButtonElement>("[data-algo]").forEach((button) => button.addEventListener("click", () => void run(false, button.dataset.algo)));
  root.querySelector("#btn-mock")!.addEventListener("click", () => void run(true));
  const reset = () => { setStatus("Chưa có kết quả. Solver chưa cài sẽ trả trạng thái “Chưa cài đặt”; không tạo số liệu thay thế."); clearMetrics(); };
  cost.addEventListener("change", () => {
    reset(); root.querySelector("#solver-comparison")!.textContent = "Chạy thuật toán để so sánh với cùng hàm chi phí đang chọn.";
  });
  reset(); return { reset, setBusy };
}
