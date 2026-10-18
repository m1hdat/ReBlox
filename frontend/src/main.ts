import "./styles/main.css";
import "./styles/maps.css";
import "./styles/workshop-preview.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import { api, type MapInfo, type GameMap, type ActionName } from "./api/client";
import { WorkshopScene, type StorefrontLayout } from "./game/scene";
import { settings } from "./game/animation";
import { bindKeyboard } from "./game/input";
import { GameSession } from "./app/session";
import { readSave, writeSave, completeMission } from "./app/progress";
import { TOYS, toyById, groupForMap, mapsForGroup, nextGroupMap, type ToyId } from "./app/catalog";
import { componentsScreen } from "./screens/components";
import { homeScreen } from "./screens/home";
import { mapsScreen, mapPreviewInfo, mapPlayActions } from "./screens/maps";
import { gameplayScreen } from "./screens/gameplay";
import { victoryScreen } from "./screens/victory";
import { labScreen } from "./screens/lab";
import { settingsScreen, pauseScreen } from "./screens/settings";
import { helpScreen, mapRule } from "./screens/help";
import { initSolverPanel } from "./ui/solver-panel";

type View = "home" | "components" | "maps" | "play" | "complete" | "lab";
type Modal = "settings" | "pause" | "help";
const app = document.getElementById("app")!, screen = document.getElementById("screen")!, modal = document.getElementById("modal")!;
const world = document.getElementById("world")!, canvas = document.getElementById("stage") as HTMLCanvasElement;
const loading = document.getElementById("scene-loading")!, notice = document.getElementById("service-notice")!;
const save = readSave(); Object.assign(settings, { reducedMotion: save.settings.reducedMotion, speed: save.settings.speed });
document.body.dataset.reducedMotion = String(settings.reducedMotion);
let view: View = "home", selectedMapId = save.lastMapId ?? save.checkpoint?.mapId ?? "easy_01";
let selectedGroupId: ToyId = TOYS.find((toy) => toy.id === save.lastGroupId)?.id ?? groupForMap(selectedMapId)?.id ?? "robot";
let maps: MapInfo[] = [], boards = new Map<string, GameMap>(), ready = false;
let scene: WorkshopScene | null = null, solver: ReturnType<typeof initSolverPanel> | null = null;
let solving = false, loadingData = false, labMapId = "easy_01", completedMoves = 0;
let toastTimer = 0, storageWarned = false, roomAnimation: Animation | null = null;
let focusBeforeModal: HTMLElement | null = null, modalKind: Modal | null = null, modalParent: Modal | null = null;
let drag: { x: number; y: number; originX: number; originY: number; moved: boolean; id: number } | null = null, suppressDoorClick = false;
const working = () => session.busy || session.replaying || solving || loadingData;
const context = () => ({ save, maps, ready });
const visibleMaps = () => mapsForGroup(selectedGroupId, maps);
const mapContext = () => ({ save, maps: visibleMaps(), boards, selected: selectedMapId, group: toyById(selectedGroupId) });
function chooseGroup(id: string) {
  const group = TOYS.find((group) => group.id === id); if (!group) return;
  selectedGroupId = group.id;
  const last = save.lastMapByGroup[group.id];
  selectedMapId = group.maps.includes(last) ? last : group.maps.includes(selectedMapId) ? selectedMapId : group.maps[0];
  save.lastGroupId = group.id; persist(); render("maps");
}
function rememberMap(id: string) {
  const group = groupForMap(id); if (!group) return;
  selectedGroupId = group.id; save.lastGroupId = group.id; save.lastMapByGroup[group.id] = id;
}
function orbitUsed() { if (!save.seenOrbit) { save.seenOrbit = true; persist(); document.querySelector(".orbit-help")?.classList.remove("first-visit"); } }
function cameraState(state: { preset: string; zoom: number }) {
  screen.querySelectorAll<HTMLElement>('[data-action="camera-top"]').forEach((button) => button.setAttribute("aria-pressed", String(state.preset === "top")));
  screen.querySelectorAll<HTMLElement>('[data-action="camera-reset"]').forEach((button) => button.setAttribute("aria-pressed", String(state.preset === "default")));
}
function toast(text: string) { const element = document.getElementById("toast")!; element.textContent = text; element.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => element.classList.add("hidden"), 4500); }
function persist() { if (!writeSave(save) && !storageWarned) { toast("Trình duyệt đang chặn lưu trữ. Tiến độ chỉ giữ trong phiên này."); storageWarned = true; } }
function placeStorefrontLabels(layout: StorefrontLayout) {
  const title = document.getElementById("shop-title"), entry = document.getElementById("shop-entry"), open = document.getElementById("shop-open");
  if (title) Object.assign(title.style, { left: `${layout.title.x}px`, top: `${layout.title.y}px`, width: `${layout.title.width}px`, fontSize: `${Math.min(layout.title.height * .64, layout.title.width / 10.8)}px` });
  if (entry) Object.assign(entry.style, { left: `${layout.entry.x}px`, top: `${Math.min(layout.entry.y, canvas.clientHeight - 55)}px` });
  if (open) { Object.assign(open.style, { left: `${layout.open.x}px`, top: `${layout.open.y}px` }); open.style.setProperty("--open-scale", String(layout.open.scale)); }
}
function attachWorld() {
  const slot = document.getElementById("scene-slot");
  world.classList.toggle("in-slot", !!slot);
  if (slot) slot.append(world); else app.prepend(world);
  scene?.resize();
}
function enterRoom() { roomAnimation?.cancel(); if (!settings.reducedMotion && typeof world.animate === "function") roomAnimation = world.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" }); }
function refresh() {
  document.getElementById("move-count")?.replaceChildren(document.createTextNode(String(session.moves)));
  document.getElementById("lab-moves")?.replaceChildren(document.createTextNode(`${session.moves} nước`));
  screen.querySelectorAll<HTMLButtonElement>("button[data-a]").forEach((button) => button.disabled = session.locked || session.finished);
  const switchCube = document.getElementById("switch-cube");
  if (switchCube) switchCube.hidden = !session.state?.split;
  const splitStatus = document.getElementById("split-status");
  if (splitStatus) splitStatus.textContent = session.state?.split ? `Đang điều khiển khối ${session.state.split.active + 1} · Space để đổi` : "";
  screen.querySelectorAll<HTMLButtonElement>('[data-action="restart"], [data-action="pause"]').forEach((button) => button.disabled = working());
  const select = document.getElementById("lab-level") as HTMLSelectElement | null; if (select) select.disabled = working();
  solver?.setBusy(!session.active || working()); screen.setAttribute("aria-busy", String(working()));
  if (view === "play" && session.active && !session.busy && !session.finished && session.map) { save.checkpoint = { mapId: session.map.id, path: [...session.path] }; persist(); }
}
const session = new GameSession(refresh, () => {
  if (!session.map || view !== "play") return;
  selectedMapId = session.map.id; completedMoves = session.moves; completeMission(save, selectedMapId, completedMoves); persist(); render("complete");
}, toast);
function closeModal(force = false) {
  if (!force && modalParent) { const parent = modalParent; modalParent = null; openModal(parent); return; }
  modalKind = null; modalParent = null; modal.classList.add("hidden"); modal.replaceChildren(); session.paused = false;
  screen.removeAttribute("inert"); world.removeAttribute("inert");
  if (view !== "play" && focusBeforeModal?.isConnected) focusBeforeModal.focus(); else screen.focus(); refresh();
}
function openModal(kind: Modal, parent: Modal | null = null) {
  if (working()) return;
  if (!modalKind) focusBeforeModal = document.activeElement as HTMLElement;
  modalKind = kind; modalParent = parent; if (session.active) session.paused = true;
  modal.innerHTML = kind === "settings" ? settingsScreen(save) : kind === "help" && session.map ? helpScreen(session.map) : pauseScreen();
  modal.classList.remove("hidden"); screen.setAttribute("inert", ""); world.setAttribute("inert", "");
  (modal.querySelector("button, input") as HTMLElement)?.focus(); refresh();
}
function render(next: View) {
  const changed = view !== next;
  if (modalKind) closeModal(true);
  // Giữ canvas và renderer khi thay nội dung màn hình.
  app.prepend(world);
  if (next !== "play" && next !== "lab") session.leave();
  view = next; solver = null; document.body.dataset.screen = view; history.replaceState({ view }, "", `#${view}`);
  if (view === "home") { screen.innerHTML = homeScreen(context()); attachWorld(); scene?.showStorefront(); }
  if (view === "components") { screen.innerHTML = componentsScreen(save, selectedGroupId); attachWorld(); scene?.showCounter(Object.keys(save.completed), undefined, selectedGroupId); }
  if (view === "maps") { screen.innerHTML = mapsScreen(mapContext()); attachWorld(); const map = boards.get(selectedMapId); if (map) scene?.previewMap(map); }
  if (view === "complete" && session.map) { screen.innerHTML = victoryScreen(session.map, save, completedMoves, maps); attachWorld(); }
  if (changed) enterRoom(); screen.focus(); refresh();
}
function selectMap(id: string, focus = false) {
  if (view !== "maps" || !visibleMaps().some((map) => map.id === id)) return;
  selectedMapId = id;
  save.lastMapByGroup[selectedGroupId] = id; persist();
  screen.querySelectorAll<HTMLElement>(".map-option").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.id === id)));
  document.getElementById("map-preview-info")!.innerHTML = mapPreviewInfo(mapContext());
  document.getElementById("map-play-actions")!.innerHTML = mapPlayActions(mapContext());
  const map = boards.get(id); if (map) scene?.previewMap(map);
  document.getElementById("map-announcement")!.textContent = `Đã chọn ${maps.find((map) => map.id === id)!.name}.`;
  if (focus) { const button = [...screen.querySelectorAll<HTMLButtonElement>(".map-option")].find((button) => button.dataset.id === id); button?.focus({ preventScroll: true }); button?.scrollIntoView?.({ block: "nearest" }); }
}
async function beginLevel(id: string, mode: "play" | "lab" = "play", checkpoint: ActionName[] = []) {
  if (working()) return;
  if (!scene) { toast("WebGL chưa khởi tạo được. Hãy bật tăng tốc phần cứng rồi tải lại trang."); return; }
  if (!maps.some((map) => map.id === id && map.playable)) { toast("Cơ chế trong map này chưa được backend hỗ trợ."); return; }
  if (mode === "play" && !groupForMap(id)) { toast("Map thử nghiệm này nằm trong Sổ kỹ thuật."); return; }
  const map = boards.get(id); if (!map) { toast("Chưa tải được dữ liệu map. Hãy thử lại."); return; }
  session.leave(); if (modalKind) closeModal(true); app.prepend(world);
  view = mode; document.body.dataset.screen = mode; solver = null;
  if (mode === "play") { selectedMapId = id; rememberMap(id); } else labMapId = id;
  screen.innerHTML = mode === "play" ? gameplayScreen(map, save, visibleMaps().findIndex((entry) => entry.id === id) + 1, toyById(selectedGroupId).name) : labScreen(context(), id);
  attachWorld();
  if (mode === "lab") solver = initSolverPanel(document.getElementById("solver-panel")!, { getMapId: () => session.map?.id ?? id, replay: (path) => session.replay(path), isBusy: () => working() || !session.active, onBusyChange: (value) => { solving = value; refresh(); } });
  history.replaceState({ view }, "", `#${mode}/${id}`); loading.classList.remove("hidden");
  let loaded = false;
  try { await session.load(id, mode, checkpoint); loaded = true; enterRoom(); screen.focus(); if (mode === "play") { save.lastMapId = id; if (!save.playedMapIds.includes(id)) save.playedMapIds.push(id); persist(); } }
  catch (error) { toast((error as Error).message); render("maps"); }
  finally { loading.classList.add("hidden"); refresh(); }
  if (loaded && mode === "play" && !save.seenHelp.includes(id)) { save.seenHelp.push(id); persist(); openModal("help"); }
}
async function fetchMaps() {
  loadingData = true;
  try {
    maps = await api.maps();
    const results = await Promise.allSettled(maps.map((map) => api.map(map.id)));
    boards = new Map(results.flatMap((result, i) => result.status === "fulfilled" ? [[maps[i].id, result.value] as const] : []));
    if (!visibleMaps().some((map) => map.id === selectedMapId)) selectedMapId = save.lastMapByGroup[selectedGroupId] ?? visibleMaps()[0]?.id ?? "";
    ready = true; notice.classList.add("hidden");
    if (boards.size !== maps.length) toast("Một số hình xem trước chưa tải được. Bạn có thể thử kết nối lại.");
  } catch { ready = false; notice.innerHTML = 'Chưa kết nối được backend cổng 8000. <button data-action="retry">Thử kết nối lại</button>'; notice.classList.remove("hidden"); }
  finally { loadingData = false; if (view === "home" || view === "maps" || view === "components") render(view); }
}
async function action(name: string, id?: string) {
  if (name === "close-modal") { closeModal(); return; }
  if (name === "close-hint") { document.getElementById("game-hint")?.classList.add("hidden"); return; }
  if (working()) return;
  if (name === "home") render("home");
  if (name === "components" || name === "play") render("components");
  if (name === "component" && id) chooseGroup(id);
  if (name === "maps") { if (view === "play" || view === "complete") { selectedMapId = session.map?.id ?? selectedMapId; rememberMap(selectedMapId); } render("maps"); }
  if (name === "select-map" && id) selectMap(id);
  if (name === "play-map") await beginLevel(selectedMapId);
  if (name === "continue" && save.checkpoint) await beginLevel(save.checkpoint.mapId, "play", [...save.checkpoint.path]);
  if (name === "lab") { const id = maps.find((map) => map.id === selectedMapId && map.playable)?.id ?? maps.find((map) => map.playable)?.id; if (id) await beginLevel(id, "lab"); }
  if (name === "restart") { if (modalKind) closeModal(true); await session.restart(); screen.focus(); }
  if (name === "pause") openModal("pause");
  if (name === "settings") openModal("settings", modalKind === "pause" ? "pause" : null);
  if (name === "help" && session.map) openModal("help", modalKind === "pause" ? "pause" : null);
  if (name === "hint" && session.map) { const hint = document.getElementById("game-hint")!; hint.querySelector("p")!.textContent = mapRule(session.map); hint.classList.remove("hidden"); }
  if (name === "replay-level" && session.map) await beginLevel(session.map.id);
  if (name === "next") { const next = nextGroupMap(selectedMapId, maps); if (next) await beginLevel(next); else render("components"); }
  if (name === "camera-left") scene?.rotateMapCamera(-Math.PI / 4);
  if (name === "camera-right") scene?.rotateMapCamera(Math.PI / 4);
  if (name === "camera-top") scene?.topMapCamera();
  if (name === "camera-reset") scene?.resetMapCamera();
  if (name === "camera-zoom-in") scene?.zoomMapCamera(1.12);
  if (name === "camera-zoom-out") scene?.zoomMapCamera(1 / 1.12);
  if (name.startsWith("camera-")) orbitUsed();
  if (name === "retry") await fetchMaps();
}
app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement, direction = target.closest<HTMLButtonElement>("button[data-a]");
  if (direction && !direction.disabled && view === "play" && !modalKind) { void session.move(direction.dataset.a as ActionName); screen.focus({ preventScroll: true }); return; }
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (button && !button.disabled) void action(button.dataset.action!, button.dataset.id).catch((error) => toast((error as Error).message));
});
document.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "lab-level") void beginLevel(target.value, "lab");
  if (target.id === "setting-motion") { save.settings.reducedMotion = settings.reducedMotion = target.checked; document.body.dataset.reducedMotion = String(target.checked); if (target.checked) roomAnimation?.cancel(); persist(); }
  if (target.id === "setting-help") { save.settings.showHelp = target.checked; screen.querySelector(".keyboard-note")?.classList.toggle("hidden", !target.checked); persist(); }
});
document.addEventListener("input", (event) => { const target = event.target as HTMLInputElement; if (target.id === "setting-speed") { save.settings.speed = settings.speed = Number(target.value); document.getElementById("speed-output")!.textContent = `${target.value}×`; persist(); } });
document.addEventListener("keydown", (event) => {
  const option = (event.target as HTMLElement).closest<HTMLElement>(".map-option");
  if (option && view === "maps" && !modalKind && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); const items = visibleMaps(), index = items.findIndex((map) => map.id === option.dataset.id), next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; selectMap(items[next].id, true); return; }
  if (event.key === "Escape") { event.preventDefault(); if (modalKind) closeModal(); else if (view === "play") openModal("pause"); }
  if (event.key === "Tab" && modalKind) { const focusable = [...modal.querySelectorAll<HTMLElement>("button:not(:disabled), input, select")], first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
});
bindKeyboard((direction) => { if ((view === "play" || view === "lab") && !modalKind && !solving) void session.move(direction); });
const localPointer = (event: MouseEvent) => { const rectangle = canvas.getBoundingClientRect(); return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top }; };
canvas.addEventListener("pointerdown", (event) => { if (!["maps", "play", "complete", "lab"].includes(view) || modalKind || working() || event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, moved: false, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener("pointermove", (event) => {
  if (drag && drag.id === event.pointerId) { const dx = event.clientX - drag.x, dy = event.clientY - drag.y; if (Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) >= 5) drag.moved = true; if (drag.moved) { scene?.orbitMapCamera(dx, dy); orbitUsed(); document.getElementById("preview-tooltip")?.classList.add("hidden"); } drag.x = event.clientX; drag.y = event.clientY; return; }
  if (view === "maps" && !modalKind) { const point = localPointer(event), text = scene?.specialAt(point.x, point.y), tip = document.getElementById("preview-tooltip"); if (tip) { tip.classList.toggle("hidden", !text); if (text) { tip.textContent = text; Object.assign(tip.style, { left: `${Math.max(8, Math.min(point.x + 12, canvas.clientWidth - 270))}px`, top: `${Math.max(8, Math.min(point.y + 12, canvas.clientHeight - 95))}px` }); } } return; }
  if (view === "components") { const point = localPointer(event), id = scene?.toyAt(point.x, point.y); scene?.setCounterHover(id ?? null); canvas.style.cursor = id ? "pointer" : ""; return; }
  if (view !== "home" || modalKind) { canvas.style.cursor = ""; return; }
  const point = localPointer(event), inside = !!scene?.doorAt(point.x, point.y); scene?.setDoorHovered(inside); canvas.style.cursor = inside ? "pointer" : "";
});
const stopDrag = (event: PointerEvent) => { if (drag?.id === event.pointerId) { suppressDoorClick = event.type === "pointerup" && drag.moved; drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } };
canvas.addEventListener("pointerup", stopDrag); canvas.addEventListener("pointercancel", stopDrag);
canvas.addEventListener("pointerleave", () => { scene?.setDoorHovered(false); document.getElementById("preview-tooltip")?.classList.add("hidden"); canvas.style.cursor = ""; });
canvas.addEventListener("wheel", (event) => { if (view !== "maps" || modalKind || working()) return; event.preventDefault(); scene?.zoomMapCamera(Math.exp(-event.deltaY * .001)); orbitUsed(); }, { passive: false });
canvas.addEventListener("click", (event) => { if (suppressDoorClick) { suppressDoorClick = false; return; } if (!ready || working() || modalKind) return; const point = localPointer(event); if (view === "components") { const id = scene?.toyAt(point.x, point.y); if (id) chooseGroup(id); return; } if (view === "home" && scene?.doorAt(point.x, point.y)) void action("components"); });
for (const [event, value] of [["pointerover", true], ["pointerout", false], ["focusin", true], ["focusout", false]] as const) screen.addEventListener(event, (event) => { if ((event.target as HTMLElement).closest("#shop-entry")) scene?.setDoorHovered(value); });
try { scene = new WorkshopScene(canvas); scene.onLayout = placeStorefrontLabels; scene.onCameraChange = cameraState; session.attachScene(scene); }
catch (error) { toast(`Không khởi tạo được WebGL: ${(error as Error).message}`); }
render("home"); void fetchMaps();
window.addEventListener("pagehide", (event) => { persist(); if (!event.persisted) scene?.dispose(); });
