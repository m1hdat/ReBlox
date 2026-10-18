import * as THREE from "three";
import type { GameMap } from "../api/client";
import { toyForMap } from "../app/catalog";

/** Chỉ cấu hình trình bày: không đổi ô, tọa độ, trạng thái hay luật backend. */
export function presentationFor(map: GameMap) {
  const points: [number, number][] = [];
  map.grid.forEach((row, r) => [...row].forEach((tile, c) => { if (tile !== ".") points.push([r, c]); }));
  map.bridges.forEach((bridge) => points.push(...bridge.cells));
  points.push(map.start, map.goal);
  const rows = points.map(([r]) => r), cols = points.map(([, c]) => c);
  const minX = Math.min(...cols) - (map.cols - 1) / 2, maxX = Math.max(...cols) - (map.cols - 1) / 2;
  const minZ = Math.min(...rows) - (map.rows - 1) / 2, maxZ = Math.max(...rows) - (map.rows - 1) / 2;
  const ratio = (maxX - minX + 1) / (maxZ - minZ + 1);
  return { toy: toyForMap(map.id).id, ratio,
    bounds: new THREE.Box3(new THREE.Vector3(minX - 1.05, -1.7, minZ - 1.05), new THREE.Vector3(maxX + 1.05, 2.8, maxZ + 1.05)),
    yaw: (portrait: boolean) => ratio > 1.8 ? portrait ? 1.22 : .28 : ratio < .7 ? portrait ? .28 : 1.12 : .65,
    pitch: .9,
    toyPosition: new THREE.Vector3((minX + maxX) / 2, -.31, minZ - 1.45),
    partsPosition: new THREE.Vector3(maxX + 1.15, -.3, maxZ + .7),
  };
}
