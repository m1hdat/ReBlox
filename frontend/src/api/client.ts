// Lớp mỏng gọi REST backend. Mọi luật chơi nằm ở Python; frontend KHÔNG tự tính nước đi.
export type Orientation = "STANDING" | "HORIZONTAL" | "VERTICAL";
export type ActionName = "UP" | "DOWN" | "LEFT" | "RIGHT" | "SWITCH_CUBE";

export interface SplitState { cubes: [[number, number], [number, number]]; active: number; }
export interface GameState { row: number; col: number; orientation: Orientation; open_bridges: string[]; split?: SplitState; }
export interface MapInfo { id: string; name: string; playable: boolean; status: string; difficulty?: string; pending_reason?: string; }
export interface SwitchDef { pos: [number, number]; kind: "soft" | "heavy"; targets: string[]; effect: string; }
export interface BridgeDef { id: string; cells: [number, number][]; initially_open: boolean; }
export interface GameMap {
  id: string; name: string; description?: string; rows: number; cols: number; grid: string[];
  start: [number, number]; goal: [number, number]; switches: SwitchDef[]; bridges: BridgeDef[];
  splitters?: { pos: [number, number]; destinations: [[number, number], [number, number]] }[];
  theme: { object?: string; palette?: string }; solvable?: boolean;
}
export interface StepResponse {
  valid: boolean; reason: string; reached_goal: boolean; state: GameState;
  attempted: { row: number; col: number; orientation: Orientation } | null;
}
export interface SolverMetrics {
  algorithm: string; solved: boolean; path: string[]; expanded_nodes: number; generated_nodes: number;
  solution_length: number | null; solution_cost: number | null; max_frontier_size: number | null;
  search_time_s: number; peak_memory_bytes: number; replay_valid: boolean; verified_cost: number | null; note?: string;
}
export interface SolveResponse {
  status: "not_implemented" | "solved" | "unsolved" | "invalid_path" | "mock" | "no_reference";
  mock: boolean; algorithm?: string; result?: SolverMetrics; path?: string[]; label?: string; message?: string;
}
export interface PathValidation { valid: boolean; steps_executed: number; reason: string; }

async function req<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  maps: () => req<MapInfo[]>("/api/maps"),
  map: (id: string) => req<GameMap>(`/api/maps/${id}`),
  initial: (map_id: string) => req<{ state: GameState }>("/api/game/initial", { map_id }),
  step: (map_id: string, state: GameState, action: ActionName) => req<StepResponse>("/api/game/step", { map_id, state, action }),
  validatePath: (map_id: string, path: string[]) => req<PathValidation>("/api/game/validate-path", { map_id, path }),
  solve: (map_id: string, algorithm: string, cost_model = "uniform") => req<SolveResponse>("/api/solve", { map_id, algorithm, cost_model }),
  mockDemo: (map_id: string) => req<SolveResponse>("/api/solve/mock-demo", { map_id, algorithm: "BFS" }),
};
