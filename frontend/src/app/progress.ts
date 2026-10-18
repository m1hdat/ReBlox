import type { ActionName } from "../api/client";
const KEY = "little-repair-shop.save.v1";
const DIRECTIONS = new Set(["UP", "DOWN", "LEFT", "RIGHT"]);
export interface Checkpoint { mapId: string; path: ActionName[]; }
export interface SaveData { version: 1; completed: Record<string, { bestMoves: number; completedAt: string }>; checkpoint: Checkpoint | null; lastMapId: string | null; lastGroupId: string | null; lastMapByGroup: Record<string, string>; seenOrbit: boolean; playedMapIds: string[]; seenHelp: string[]; settings: { reducedMotion: boolean; speed: number; showHelp: boolean }; }
export const freshSave = (): SaveData => ({ version: 1, completed: {}, checkpoint: null, lastMapId: null, lastGroupId: null, lastMapByGroup: {}, seenOrbit: false, playedMapIds: [], seenHelp: [],
  settings: { reducedMotion: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, speed: 1, showHelp: true } });
export function readSave(): SaveData {
  const save = freshSave();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw?.version !== 1) return save;
    for (const [id, value] of Object.entries(raw.completed ?? {})) {
      const result = value as { bestMoves?: number; completedAt?: string };
      if (Number.isInteger(result?.bestMoves) && result.bestMoves! > 0 && result.bestMoves! < 100000 && validId(id))
        save.completed[id] = { bestMoves: result.bestMoves!, completedAt: String(result.completedAt ?? "") };
    }
    const checkpoint = raw.checkpoint;
    if (checkpoint && validId(checkpoint.mapId) && Array.isArray(checkpoint.path) && checkpoint.path.length <= 2000 && checkpoint.path.every((action: string) => DIRECTIONS.has(action)))
      save.checkpoint = { mapId: checkpoint.mapId, path: [...checkpoint.path] };
    save.lastMapId = validId(raw.lastMapId) ? raw.lastMapId : save.checkpoint?.mapId ?? null;
    save.lastGroupId = validId(raw.lastGroupId) ? raw.lastGroupId : null;
    for (const [id, mapId] of Object.entries(raw.lastMapByGroup ?? {})) if (validId(id) && validId(mapId)) save.lastMapByGroup[id] = mapId;
    save.seenOrbit = raw.seenOrbit === true;
    if (Array.isArray(raw.playedMapIds)) save.playedMapIds = [...new Set<string>(raw.playedMapIds.filter(validId))];
    if (Array.isArray(raw.seenHelp)) save.seenHelp = [...new Set<string>(raw.seenHelp.filter(validId))];
    if (typeof raw.settings?.reducedMotion === "boolean") save.settings.reducedMotion = raw.settings.reducedMotion;
    if ([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(raw.settings?.speed)) save.settings.speed = raw.settings.speed;
    if (typeof raw.settings?.showHelp === "boolean") save.settings.showHelp = raw.settings.showHelp;
  } catch { /* Dữ liệu hỏng/quyền lưu trữ bị chặn: vẫn mở được game. */ }
  return save;
}
export function writeSave(save: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; } }
const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{1,128}$/.test(id);
export function completeMission(save: SaveData, mapId: string, moves: number) {
  if (!Number.isInteger(moves) || moves < 1) return;
  const previous = save.completed[mapId];
  save.completed[mapId] = { bestMoves: Math.min(previous?.bestMoves ?? Infinity, moves), completedAt: new Date().toISOString() };
  save.checkpoint = null;
}
