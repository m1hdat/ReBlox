import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
export const COLORS = { cream: 0xf7f7ee, peach: 0xe4b596, sage: 0x89a68c, blue: 0x79acb8,
  teal: 0x367479, coral: 0xb65b42, yellow: 0xd7ae59, lavender: 0xb8a7c7, walnut: 0x655347,
  tile: 0xb7c6bc, fragile: 0xc5dbe0, bridge: 0xc6a476 };
export const PALETTES: Record<string, number> = { cream: 0xc6c9b5, peach: 0xd4b19a, blue: 0xa8c2c6,
  lavender: 0xbdb6ca, yellow: 0xd2c39c, sage: 0xadc2ae };
export const matte = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
export function roundedBox(w: number, h: number, d: number, color: number, radius = 0.04) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), matte(color));
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
export function createFloorTile(color: number): THREE.Group {
  const group = new THREE.Group();
  const frame = roundedBox(0.97, 0.12, 0.97, 0x63867f); frame.position.y = -0.25; group.add(frame);
  const face = roundedBox(0.94, 0.2, 0.94, color, 0.05); face.position.y = -0.1; group.add(face);
  return group;
}
export interface FragileParts { group: THREE.Group; shards: THREE.Group[]; }
export function createFragileTile(): FragileParts {
  const group = new THREE.Group(), shards: THREE.Group[] = [];
  for (const x of [-0.24, 0.24]) for (const z of [-0.24, 0.24]) {
    const shard = new THREE.Group(); const piece = roundedBox(0.473, 0.09, 0.473, COLORS.fragile, 0.018);
    piece.position.y = -0.045; shard.position.set(x, 0, z); shard.add(piece); group.add(shard); shards.push(shard);
  }
  const crack = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.36, 0.004, -0.34), new THREE.Vector3(-0.13, 0.004, -0.08),
    new THREE.Vector3(0.07, 0.004, -0.12), new THREE.Vector3(0.16, 0.004, 0.1), new THREE.Vector3(0.37, 0.004, 0.34),
  ]), new THREE.LineBasicMaterial({ color: 0x6b929f })); group.add(crack); return { group, shards };
}
export interface GoalParts { group: THREE.Group; glow: THREE.Mesh; petals: THREE.Mesh[]; }
export function createGoalSocket(): GoalParts {
  const group = new THREE.Group(), shape = new THREE.Shape();
  shape.moveTo(-0.56, -0.56); shape.lineTo(0.56, -0.56); shape.lineTo(0.56, 0.56); shape.lineTo(-0.56, 0.56); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.5, -0.5); hole.lineTo(-0.5, 0.5); hole.lineTo(0.5, 0.5); hole.lineTo(0.5, -0.5); hole.closePath(); shape.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.27, bevelEnabled: false }),
    matte(COLORS.yellow, { emissive: COLORS.yellow, emissiveIntensity: 0.06 }));
  frame.rotation.x = -Math.PI / 2; frame.position.y = -0.25; frame.castShadow = true; group.add(frame);
  const well = roundedBox(0.99, 0.035, 0.99, 0x394f53, 0.01); well.position.y = -0.4; group.add(well);
  for (const x of [-0.3, 0.3]) { const contact = roundedBox(0.12, 0.03, 0.66, 0xb5a86c); contact.position.set(x, -0.35, 0); group.add(contact); }
  const petals: THREE.Mesh[] = []; // Tia sáng nhỏ bằng geometry, không phải confetti màn hình.
  for (let i = 0; i < 8; i++) { const spark = roundedBox(0.035, 0.12, 0.035, COLORS.yellow, 0.01); spark.visible = false; group.add(spark); petals.push(spark); }
  return { group, glow: frame, petals };
}
export interface ButtonParts { group: THREE.Group; cap: THREE.Group; restY: number; kind: "soft" | "heavy"; }
export function createSwitchTile(kind: "soft" | "heavy", color: number): ButtonParts {
  const group = createFloorTile(color), cap = new THREE.Group(), heavy = kind === "heavy";
  const base = heavy ? roundedBox(0.66, 0.05, 0.66, 0x6c8080) : new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.05, 20), matte(COLORS.walnut));
  base.position.y = 0.025; group.add(base);
  const button = heavy ? roundedBox(0.5, 0.07, 0.5, COLORS.coral, 0.05)
    : new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 20), matte(COLORS.yellow));
  cap.add(button); cap.position.y = 0.075; group.add(cap);
  if (heavy) for (const angle of [-Math.PI / 4, Math.PI / 4]) {
    const mark = roundedBox(0.25, 0.015, 0.03, COLORS.cream, 0.005); mark.position.y = 0.043; mark.rotation.y = angle; cap.add(mark);
  } else { const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 12), matte(COLORS.walnut)); dot.position.y = 0.044; cap.add(dot); }
  return { group, cap, restY: 0.075, kind };
}
export function createSplitMachineTile() {
  const group = createFloorTile(COLORS.lavender);
  for (const direction of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.TorusGeometry(.24, .035, 6, 16, Math.PI), matte(0x594477));
    bracket.position.set(direction * .07, .04, 0);
    bracket.rotation.set(-Math.PI / 2, 0, direction === -1 ? Math.PI / 2 : -Math.PI / 2);
    group.add(bracket);
  }
  return group;
}
export interface BridgeParts { group: THREE.Group; planks: THREE.Group[]; ghosts: THREE.LineSegments[]; }
export function createBridge(cells: [number, number][]): BridgeParts {
  const group = new THREE.Group(), planks: THREE.Group[] = [], ghosts: THREE.LineSegments[] = [];
  for (const [r, c] of cells) {
    const plank = new THREE.Group(); const slab = roundedBox(0.94, 0.23, 0.94, COLORS.bridge); slab.position.y = -0.115; plank.add(slab);
    for (const x of [-0.3, 0.3]) { const rail = roundedBox(0.035, 0.008, 0.72, 0x8d735f, 0.003); rail.position.set(x, 0.002, 0); plank.add(rail); }
    plank.position.set(c, 0, r); group.add(plank); planks.push(plank);
    const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.008, 0.86)), new THREE.LineBasicMaterial({ color: 0xc9d8bc, transparent: true, opacity: 0.35 }));
    ghost.position.set(c, -0.43, r); group.add(ghost); ghosts.push(ghost);
  }
  return { group, planks, ghosts };
}
