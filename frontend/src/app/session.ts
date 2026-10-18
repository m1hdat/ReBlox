import { api, type ActionName, type GameMap, type GameState } from "../api/client";
import { sleep } from "../game/animation";
import type { WorkshopScene } from "../game/scene";
export class GameSession {
  map: GameMap | null = null;
  state!: GameState;
  initial!: GameState;
  path: ActionName[] = [];
  busy = false;
  replaying = false;
  finished = false;
  paused = false;
  active = false;
  mode: "play" | "lab" = "play";
  private scene!: WorkshopScene;
  constructor(private changed: () => void, private won: () => void, private message: (text: string) => void) {}
  attachScene(scene: WorkshopScene) { this.scene = scene; }
  get locked() { return this.busy || this.replaying || this.paused || !this.active; }
  get moves() { return this.path.length; }
  async load(id: string, mode: "play" | "lab", savedPath: ActionName[] = []) {
    this.busy = true; this.active = false; this.changed();
    try {
      const [map, response] = await Promise.all([api.map(id), api.initial(id)]);
      let state = response.state;
      // Checkpoint lưu chuỗi thao tác, không tin một search state tự khai từ localStorage.
      for (const action of savedPath) {
        const next = await api.step(id, state, action);
        if (!next.valid || next.reached_goal) throw new Error("Tiến độ lưu không khớp map hiện tại. Hãy mở lại nhiệm vụ từ đầu.");
        state = next.state;
      }
      this.scene.loadMap(map); this.scene.setBlock(state);
      await this.scene.setBridges(state.open_bridges, false);
      this.map = map; this.initial = response.state; this.state = state;
      this.mode = mode; this.path = [...savedPath]; this.finished = false; this.paused = false; this.active = true;
    } finally { this.busy = false; this.changed(); }
  }
  async move(action: ActionName, replay = false): Promise<boolean> {
    if (!this.map || !this.active || this.busy || this.paused || this.finished || (this.replaying && !replay)) return false;
    this.busy = true; this.changed();
    try {
      const result = await api.step(this.map.id, this.state, action);
      if (result.reason === "unsupported_action" || result.reason === "already_goal" || result.reason === "occupied_cube") return false;
      if (!result.valid) {
        if (result.attempted) await this.scene.roll(this.state, action, result.attempted);
        await this.scene.fall(result.attempted);
        this.state = this.initial; this.path = []; this.scene.resetPlayer(this.state);
        await this.scene.setBridges(this.state.open_bridges, false);
        this.message("Ối, trượt mất rồi. Linh kiện đã về vị trí ban đầu."); return false;
      }
      await this.scene.roll(this.state, action, result.state);
      const bridgeChanged = result.state.open_bridges.join() !== this.state.open_bridges.join();
      this.state = result.state; this.path.push(action);
      await this.scene.pressSwitchesUnder(this.state);
      if (bridgeChanged) await this.scene.setBridges(this.state.open_bridges, true);
      if (result.reached_goal) {
        this.finished = true; await this.scene.victory();
        if (this.mode === "play" && !this.replaying) this.won();
      }
      return true;
    } catch (error) { this.message(`Chưa thực hiện được nước đi: ${(error as Error).message}`); return false; }
    finally { this.busy = false; this.changed(); }
  }
  async restart() { if (this.map && !this.busy && !this.replaying) await this.load(this.map.id, this.mode); }
  async replay(path: string[]) {
    if (!this.map || this.busy || this.replaying) throw new Error("Bàn chơi đang bận.");
    if (!path.length) throw new Error("Đường đi rỗng.");
    this.replaying = true; this.changed();
    try {
      const validation = await api.validatePath(this.map.id, path);
      if (!validation.valid) throw new Error(`Đường đi không hợp lệ: ${validation.reason}`);
      await this.load(this.map.id, "lab");
      for (const action of path) {
        if (!(await this.move(action as ActionName, true))) throw new Error("Phát lại bị gián đoạn.");
        if (!this.finished) await sleep(90);
      }
    } finally { this.replaying = false; this.changed(); }
  }
  leave() { this.active = false; this.paused = false; }
}
