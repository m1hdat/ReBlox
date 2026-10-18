import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLORS } from "./tiles";

export interface RenderBlock { row: number; col: number; orientation: string; }
export function occupiedCells(s: RenderBlock): [number, number][] {
  if (s.orientation === "STANDING") return [[s.row, s.col]];
  if (s.orientation === "HORIZONTAL") return [[s.row, s.col], [s.row, s.col + 1]];
  return [[s.row, s.col], [s.row + 1, s.col]];
}
export interface Box3D { cx: number; cz: number; w: number; d: number; h: number; minX: number; maxX: number; minZ: number; maxZ: number; }
export function blockBox(s: RenderBlock): Box3D {
  const cells = occupiedCells(s);
  const rs = cells.map((c) => c[0]), cs = cells.map((c) => c[1]);
  const minR = Math.min(...rs), maxR = Math.max(...rs), minC = Math.min(...cs), maxC = Math.max(...cs);
  const w = maxC - minC + 1, d = maxR - minR + 1, h = s.orientation === "STANDING" ? 2 : 1;
  return { cx: (minC + maxC) / 2, cz: (minR + maxR) / 2, w, d, h,
    minX: minC - 0.5, maxX: maxC + 0.5, minZ: minR - 0.5, maxZ: maxR + 0.5 };
}

/** Linh kiện sửa đồ chơi. Mọi chi tiết nằm trong hộp 1×2×1, xoay cùng một rigid body. */
export class Player {
  readonly group = new THREE.Group();
  private materials: THREE.MeshStandardMaterial[] = [];
  private socketPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor() {
    const material = (color: number, glow = false) => {
      const value = new THREE.MeshStandardMaterial({ color, roughness: 0.91,
        emissive: glow ? COLORS.yellow : 0x000000, emissiveIntensity: glow ? 0.18 : 0 });
      this.materials.push(value); return value;
    };
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.96, 1.96, 0.96, 3, 0.085), material(COLORS.peach));
    body.castShadow = true; body.receiveShadow = true; this.group.add(body);
    for (const y of [-0.67, 0.67]) {
      const band = new THREE.Mesh(new RoundedBoxGeometry(0.965, 0.045, 0.965, 2, 0.02), material(0xb98f78));
      band.position.y = y; this.group.add(band);
    }
    const sticker = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.74, 0.014, 2, 0.04), material(COLORS.cream));
    sticker.position.set(0, 0.04, 0.48); this.group.add(sticker);
    const ink = material(COLORS.teal);
    for (const [w, h] of [[0.2, 0.035], [0.035, 0.2]]) {
      const plus = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.008), ink);
      plus.position.set(0, 0.15, 0.492); this.group.add(plus);
    }
    const minus = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.008), ink);
    minus.position.set(0, -0.17, 0.492); this.group.add(minus);
    const contact = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.025, 0.3, 2, 0.01), material(COLORS.yellow));
    contact.position.y = 0.982; this.group.add(contact);
  }

  setColor(color: number) { this.materials[0].color.setHex(color); }

  setBlock(s: RenderBlock) {
    this.group.rotation.set(s.orientation === "VERTICAL" ? Math.PI / 2 : 0, 0,
      s.orientation === "HORIZONTAL" ? -Math.PI / 2 : 0);
    this.group.scale.set(1, 1, 1); this.group.visible = true;
    this.setSocketClipping(false); this.snapPosition(s);
  }
  snapPosition(s: RenderBlock) {
    const b = blockBox(s); this.group.position.set(b.cx, b.h / 2, b.cz);
  }
  setSocketClipping(on: boolean) {
    this.materials.forEach((material) => {
      material.clippingPlanes = on ? [this.socketPlane] : [];
      material.clipShadows = on; material.needsUpdate = true;
    });
  }
}
