import type { SaveData } from "../app/progress";
import type { MapInfo } from "../api/client";
export interface ScreenContext { save: SaveData; maps: MapInfo[]; ready: boolean; }
