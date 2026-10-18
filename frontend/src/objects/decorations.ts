import * as THREE from "three";
import { COLORS, roundedBox, matte } from "./tiles";
import { ToyModel } from "./toys";
import { woodMaterial } from "./materials";

export function gear(radius = 0.42) {
  const group = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.65, radius * 0.23, 5, 14), matte(COLORS.yellow));
  disk.rotation.x = Math.PI / 2; group.add(disk);
  for (let i = 0; i < 10; i++) { const angle = i * Math.PI / 5; const tooth = roundedBox(radius * 0.35, 0.12, radius * 0.28, COLORS.yellow, 0.01);
    tooth.position.set(Math.cos(angle) * radius * 0.8, 0, Math.sin(angle) * radius * 0.8); tooth.rotation.y = -angle; group.add(tooth); }
  return group;
}
function rod(a: number[], b: number[], radius: number, color: number) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), matte(color));
  mesh.position.copy(start).add(end).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); mesh.castShadow = true; return mesh;
}
export function deskLamp() {
  const group = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.13, 20), matte(COLORS.teal)); foot.position.y = 0.065; group.add(foot);
  group.add(rod([0, 0.1, 0], [0.1, 1.5, -0.2], 0.055, COLORS.teal), rod([0.1, 1.5, -0.2], [0.6, 2.1, 0.15], 0.055, COLORS.teal));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.48, 20, 1, true), matte(COLORS.yellow, { side: THREE.DoubleSide })); shade.position.set(0.65, 1.95, 0.15); shade.rotation.z = -0.35; group.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), matte(COLORS.cream, { emissive: COLORS.yellow, emissiveIntensity: 0.7 })); bulb.position.set(0.62, 1.75, 0.15); group.add(bulb);
  const light = new THREE.PointLight(0xffce8e, 4, 7, 2); light.position.copy(bulb.position); group.add(light); return group;
}
function spareBox() {
  const group = new THREE.Group();
  const base = roundedBox(1.45, 0.16, 1.05, 0xbc8062); base.position.y = 0.08; group.add(base);
  for (const z of [-0.49, 0.49]) { const side = roundedBox(1.45, 0.5, 0.09, 0xca9470); side.position.set(0, 0.3, z); group.add(side); }
  for (const x of [-0.68, 0.68]) { const side = roundedBox(0.09, 0.5, 1.05, 0xca9470); side.position.set(x, 0.3, 0); group.add(side); }
  const label = roundedBox(0.65, 0.23, 0.012, COLORS.cream, 0.01); label.position.set(0, 0.31, 0.54); group.add(label);
  for (let i = 0; i < 3; i++) { const part = gear(0.18); part.position.set((i - 1) * 0.35, 0.2 + i * 0.05, 0); group.add(part); }
  return group;
}
export function createWorkbench(rows = 4, cols = 10, home = false, props = true) {
  const group = new THREE.Group(), width = home ? 13 : cols + 4.4, depth = home ? 6.8 : rows + 4.2;
  const edge = roundedBox(width, 0.5, depth, 0xb98660, 0.1); edge.position.y = -0.83; group.add(edge);
  for (let i = 0; i < 6; i++) { const plank = roundedBox(width / 6 - 0.025, 0.16, depth - 0.06, i % 2 ? 0xcd9e74 : 0xd7ab7e, 0.025);
    plank.material.dispose(); plank.material = woodMaterial(i % 2 ? 0xd3b382 : 0xd9bc91);
    plank.position.set(-width / 2 + (i + 0.5) * width / 6, -0.5, 0); group.add(plank); }
  const mat = roundedBox(home ? 8.5 : cols + 1.5, 0.07, home ? 4.5 : rows + 1.2, 0x558785, 0.03); mat.position.y = -0.37; group.add(mat);
  // Vạch đo mảnh trên tấm lót cắt.
  const points: THREE.Vector3[] = [];
  const mw = home ? 8.5 : cols + 1.5, md = home ? 4.5 : rows + 1.2;
  for (let x = -mw / 2 + 0.5; x < mw / 2; x += 0.5) points.push(new THREE.Vector3(x, -0.33, -md / 2), new THREE.Vector3(x, -0.33, md / 2));
  for (let z = -md / 2 + 0.5; z < md / 2; z += 0.5) points.push(new THREE.Vector3(-mw / 2, -0.33, z), new THREE.Vector3(mw / 2, -0.33, z));
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x9cb6a0, transparent: true, opacity: 0.17 })));
  if (home) for (const x of [-5, 5]) for (const z of [-2.5, 2.5]) { const leg = roundedBox(0.4, 2.7, 0.4, 0x94684f); leg.position.set(x, -2.2, z); group.add(leg); }
  if (!props) return group;
  const lamp = deskLamp(); lamp.position.set(-width / 2 + 1.15, -0.42, -depth / 2 + 1.2); group.add(lamp);
  const box = spareBox(); box.position.set(width / 2 - 1.0, -0.42, -depth / 2 + 1.1); group.add(box);
  const cog = gear(); cog.position.set(-width / 2 + 1.0, -0.32, depth / 2 - 1.0); group.add(cog);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.8, 6), matte(COLORS.coral));
  pencil.rotation.z = Math.PI / 2; pencil.rotation.y = -0.2; pencil.position.set(width / 2 - 2.1, -0.32, depth / 2 - 0.7); group.add(pencil);
  for (let i = 0; i < 3; i++) { const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 8), matte(0x94a4a7, { metalness: 0.3 }));
    screw.rotation.z = Math.PI / 2; screw.rotation.y = i * 0.6; screw.position.set(width / 2 - 0.8 - i * 0.35, -0.33, depth / 2 - 1.1); group.add(screw); }
  return group;
}
export function createWorkshopRoom() {
  const group = createWorkbench(4, 10, true);
  const pegboard = roundedBox(12, 4.8, 0.2, 0xb68159, 0.07); pegboard.position.set(0, 2.15, -3.3); group.add(pegboard);
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 8), new THREE.MeshBasicMaterial({ color: 0x906443 }), 108);
  const dummy = new THREE.Object3D(); let index = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 18; c++) { dummy.position.set(-5.5 + c * 0.65, 0.6 + r * 0.62, -3.185); dummy.updateMatrix(); holes.setMatrixAt(index++, dummy.matrix); }
  group.add(holes);
  for (const x of [-4.8, -3.9, -3.0]) {
    const handle = roundedBox(0.23, 1.2, 0.18, x === -3.9 ? COLORS.coral : COLORS.teal); handle.position.set(x, 2.7, -3.05); group.add(handle);
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.075, 6, 12, Math.PI * 1.65), matte(0xb4c3be)); top.position.set(x, 3.3, -3.05); group.add(top);
  }
  for (const y of [1.7, 3.3]) { const shelf = roundedBox(4.7, 0.16, 1.0, 0x835e47); shelf.position.set(3.1, y, -2.9); group.add(shelf); }
  const tinyTrain = new ToyModel("train"); tinyTrain.group.scale.setScalar(0.46); tinyTrain.group.position.set(2.7, 1.78, -2.85); group.add(tinyTrain.group);
  const tinyClock = new ToyModel("clock"); tinyClock.group.scale.setScalar(0.45); tinyClock.group.position.set(4.0, 3.38, -2.85); group.add(tinyClock.group);
  const spare = spareBox(); spare.position.set(1.5, 3.38, -2.8); group.add(spare);
  const windowFrame = roundedBox(2.0, 2.35, 0.12, COLORS.cream); windowFrame.position.set(-0.4, 2.8, -3.1); group.add(windowFrame);
  const windowPane = roundedBox(1.75, 2.1, 0.08, 0xa8c9d0); windowPane.position.set(-0.4, 2.8, -3.0); group.add(windowPane);
  const mullion = roundedBox(0.07, 2.2, 0.1, COLORS.cream); mullion.position.set(-0.4, 2.8, -2.93); group.add(mullion);
  const crossbar = roundedBox(1.85, 0.07, 0.1, COLORS.cream); crossbar.position.set(-0.4, 2.8, -2.93); group.add(crossbar);
  return group;
}
export function createToyShelf() {
  const group = new THREE.Group();
  const back = roundedBox(17.5, 5.4, 0.22, 0x477577, 0.1); back.position.set(0, 1.7, -1.3); group.add(back);
  for (const y of [-0.25, 3.8]) { const shelf = roundedBox(18, 0.35, 3.4, 0xb8835e, 0.07); shelf.position.set(0, y, 0); group.add(shelf); }
  for (const x of [-8.7, -4.4, 0, 4.4, 8.7]) { const divider = roundedBox(0.2, 4.0, 2.5, 0x986d50); divider.position.set(x, 1.8, -0.15); group.add(divider); }
  return group;
}
