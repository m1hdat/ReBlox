import * as THREE from "three";
import { gear } from "./decorations";
import { COLORS, matte, roundedBox } from "./tiles";
import type { ToyId } from "../app/catalog";

/** Một nhóm linh kiện thấp ngoài lưới; không thêm ô tương tác hoặc sửa luật. */
export function repairParts(kind: ToyId) {
  const group = new THREE.Group();
  if (kind === "clock" || kind === "music-box") {
    const cog = gear(.24); cog.scale.y = .65; group.add(cog);
    if (kind === "music-box") { const spring = new THREE.Mesh(new THREE.TorusGeometry(.18, .018, 6, 24, Math.PI * 1.8), matte(0x879b9a)); spring.rotation.x = -Math.PI / 2; spring.position.set(.55, .04, 0); group.add(spring); }
  } else if (kind === "robot") {
    for (const x of [-.23, .23]) { const cell = roundedBox(.23, .18, .55, 0x72958b); cell.position.set(x, .06, 0); group.add(cell); const contact = roundedBox(.15, .025, .04, COLORS.yellow); contact.position.set(x, .16, .2); group.add(contact); }
  } else {
    for (const x of [-.22, .22]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .1, 16), matte(COLORS.walnut)); wheel.position.set(x, .05, 0); group.add(wheel); }
  }
  return group;
}
