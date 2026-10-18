import * as THREE from "three";
import { COLORS, roundedBox, matte } from "./tiles";
import { woodMaterial, metalMaterial } from "./materials";

function box(group: THREE.Group, w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
  const mesh = roundedBox(w, h, d, color, 0.04); mesh.position.set(x, y, z); group.add(mesh); return mesh;
}
function wood(group: THREE.Group, w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
  const mesh = box(group, w, h, d, color, x, y, z); mesh.material.dispose(); mesh.material = woodMaterial(color); return mesh;
}
function roomWalls(width: number, backZ: number) {
  const group = new THREE.Group();
  box(group, width, 7.3, 0.2, 0xf0f2e9, 0, 2.2, backZ);
  box(group, width, 0.7, 0.25, 0x91aaa1, 0, -0.8, backZ + 0.08);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), matte(0xd8e2dc));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9; floor.receiveShadow = true; group.add(floor);
  return group;
}
export function createReceivingCounter() {
  const group = roomWalls(24, -3.15);
  wood(group, 15, 0.36, 3.8, 0xb89164, 0, -0.2, 0);
  for (let i = 0; i < 5; i++) wood(group, 2.99, 0.07, 3.7, i % 2 ? 0xd8b683 : 0xd1ad7b, -6 + i * 3, 0.015, 0);
  box(group, 14.4, 1.45, 3.3, 0x53786f, 0, -1.08, -0.05);
  wood(group, 14.5, 0.14, 3.4, 0xa3835e, 0, -1.78, -0.05);
  for (const x of [-4.7, 0, 4.7]) {
    const drawer = wood(group, 4.35, 0.7, 0.12, 0xc2a275, x, -0.7, 1.69 + (x < 0 ? 0.08 : 0));
    if (x < 0) drawer.rotation.z = -0.015;
    const handle = box(group, 0.52, 0.09, 0.13, 0x9aa7a7, x, -0.7, 1.8 + (x < 0 ? 0.08 : 0));
    handle.material.dispose(); handle.material = metalMaterial();
  }
  // Một vết cốc và một phiếu có nét bút, không rải đồ quanh tất cả các góc.
  const stain = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.016, 5, 32), matte(0x896941, { transparent: true, opacity: 0.28 }));
  stain.rotation.x = -Math.PI / 2; stain.position.set(-6.45, 0.058, 0.95); group.add(stain);
  const paper = box(group, 1.05, 0.012, 0.72, COLORS.cream, 5.85, 0.061, 0.95); paper.rotation.y = 0.18;
  for (let i = 0; i < 3; i++) {
    const ink = box(group, 0.44 + i * 0.07, 0.004, 0.012, 0x667967, 5.8, 0.07, 0.8 + i * 0.14); ink.rotation.y = 0.18;
  }
  box(group, 3.3, 1.8, 0.15, 0x98764f, -4.3, 3.0, -2.95);
  for (let i = 0; i < 3; i++) {
    box(group, 0.65, 0.9, 0.012, i % 2 ? 0xf3f3e5 : 0xe9eee6, -5.35 + i * 1.0, 3.02, -2.85);
  }
  box(group, 2.6, 2.5, 0.14, 0xf8f9ef, 4.0, 3.2, -2.95);
  const pane = box(group, 2.35, 2.25, 0.04, 0xc3dfe4, 4.0, 3.2, -2.85);
  pane.material.emissive.setHex(0xc3dfe4); pane.material.emissiveIntensity = .12;
  box(group, 0.06, 2.3, 0.06, 0xf8f9ef, 4.0, 3.2, -2.81);
  box(group, 2.4, 0.06, 0.06, 0xf8f9ef, 4.0, 3.2, -2.81);
  wood(group, 4.0, 0.12, 0.8, 0xb09269, 0.1, 3.6, -2.8);
  wood(group, 1.4, .52, .6, 0xc0a074, .8, 3.92, -2.75);
  for (let i = 0; i < 3; i++) {
    const shaft = box(group, .055, .85, .055, 0xa6b6b9, -1.1 + i * .65, 2.55, -2.9);
    shaft.material.dispose(); shaft.material = metalMaterial();
    box(group, .18, .45, .16, i === 1 ? COLORS.coral : COLORS.teal, -1.1 + i * .65, 2.2, -2.87);
  }
  return group;
}
export function createRepairBackdrop(rows: number, cols: number) {
  const group = roomWalls(cols + 20, -rows / 2 - 4.4);
  box(group, cols + 9, 0.16, 0.8, 0x8a7353, 0, 2.5, -rows / 2 - 4.08);
  const frameX = -cols / 2 + 0.2;
  box(group, 2.2, 2.0, 0.1, 0xd4c8a6, frameX, 3.3, -rows / 2 - 4.1);
  box(group, 1.95, 1.75, 0.08, 0xc3d0bf, frameX, 3.3, -rows / 2 - 4.0);
  box(group, 0.06, 1.8, 0.08, 0xd4c8a6, frameX, 3.3, -rows / 2 - 3.94);
  return group;
}
export function createRepairedDisplay() {
  const group = roomWalls(22, -2.6);
  box(group, 13.7, 5.5, 0.15, 0x789b8d, 0, 1.65, -2.3);
  for (const y of [-0.18, 3.6]) {
    wood(group, 14.0, 0.26, 3.1, 0xc6a274, 0, y, -0.55);
    box(group, 13.95, 0.09, 0.09, 0xbea078, 0, y + 0.13, 1.0);
  }
  for (const x of [-6.7, 6.7]) box(group, 0.22, 5.6, 2.8, 0x846647, x, 1.65, -0.7);
  return group;
}
