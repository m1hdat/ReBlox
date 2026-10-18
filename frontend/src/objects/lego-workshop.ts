import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { GameMap } from "../api/client";
import { disposeTree } from "./resources";

const BLUE = 0x254f75, DARK = 0x183448, WHITE = 0xe8edf0, YELLOW = 0xe7bd43, RED = 0xb84c3e;

/** One LEGO workshop shared by map selection and gameplay. */
export class LegoWorkshop {
  readonly group = new THREE.Group();
  readonly backWall = new THREE.Group();
  readonly sideWall = new THREE.Group();
  readonly assembly = new THREE.Group();
  private companionStand = new THREE.Group();
  private shell = new THREE.Group();
  private dimensions = "";
  constructor(map: GameMap) {
    this.group.name = "LEGO assembly workshop"; this.backWall.name = "Window and tool wall";
    this.sideWall.name = "Side shelf"; this.assembly.name = "Studded LEGO tray"; this.companionStand.name = "Companion display plate";
    this.group.add(this.shell); this.configure(map);
  }
  configure(map: GameMap) {
    const { rows, cols } = map, dimensions = `${rows}:${cols}`;
    if (this.dimensions === dimensions) return;
    this.dimensions = dimensions;
    disposeTree(this.shell); this.shell.clear(); this.backWall.clear(); this.sideWall.clear(); this.assembly.clear(); this.companionStand.clear();
    this.shell.add(this.assembly, this.backWall, this.sideWall, this.companionStand);
    const geometries = new Map<string, THREE.BufferGeometry>(), materials = new Map<number, THREE.MeshStandardMaterial>();
    const studs = new Map<THREE.Group, Map<number, THREE.Vector3[]>>();
    const material = (color: number) => {
      if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: color === WHITE ? .42 : .34, metalness: .025 }));
      return materials.get(color)!;
    };
    const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent = this.shell, radius = .035) => {
      const key = `${w}:${h}:${d}:${radius}`;
      if (!geometries.has(key)) geometries.set(key, new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, h / 3, w / 3, d / 3)));
      const mesh = new THREE.Mesh(geometries.get(key), material(color)); mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const instance = (geometry: THREE.BufferGeometry, color: number, positions: THREE.Vector3[], parent: THREE.Group) => {
      const mesh = new THREE.InstancedMesh(geometry, material(color), positions.length), matrix = new THREE.Matrix4();
      positions.forEach((point, index) => { matrix.makeTranslation(point.x, point.y, point.z); mesh.setMatrixAt(index, matrix); });
      mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    };
    const stud = (color: number, x: number, y: number, z: number, parent = this.assembly) => {
      const colors = studs.get(parent) ?? new Map<number, THREE.Vector3[]>(), positions = colors.get(color) ?? [];
      positions.push(new THREE.Vector3(x, y, z)); colors.set(color, positions); studs.set(parent, colors);
    };
    const width = cols + 4.6, depth = rows + 4.4, back = -rows / 2 - 2;
    box(width, .48, depth, BLUE, 0, -.94, 0);
    box(width - .08, .16, depth - .08, WHITE, 0, -.62, 0);
    // A small mounting plate grounds the companion at the same height as its cable.
    box(1.96, .16, 1.25, BLUE, 0, -.46, 0, this.companionStand);
    box(1.82, .07, 1.12, WHITE, 0, -.345, 0, this.companionStand);
    for (let x = -width / 2 + 2; x < width / 2; x += 2) box(.016, .006, depth - .12, 0xaab8c2, x, -.536, 0, this.shell, .001);
    box(cols + 1.15, .17, rows + 1.15, DARK, 0, -.43, 0, this.assembly);
    box(cols + .9, .035, rows + .9, 0x657f8e, 0, -.325, 0, this.assembly).name = "LEGO tray floor";
    // Studs belong to the rim, never to extra walkable cells.
    for (const z of [-rows / 2 - .48, rows / 2 + .48]) {
      box(cols + 1.3, .18, .3, BLUE, 0, -.2, z, this.assembly);
      for (let x = -cols / 2; x <= cols / 2; x += .5) stud(BLUE, x, -.065, z);
    }
    for (const x of [-cols / 2 - .48, cols / 2 + .48]) {
      box(.3, .18, rows + .65, BLUE, x, -.2, 0, this.assembly);
      for (let z = -rows / 2; z <= rows / 2; z += .5) stud(BLUE, x, -.065, z);
      box(.36, .2, .8, YELLOW, x, -.18, rows / 2 + .1, this.assembly);
    }
    for (let row = 0; row < 2; row++) for (let i = 0; i < Math.ceil(width / 2); i++) box(1.96, .38, .5, row ? WHITE : BLUE, -width / 2 + 1 + i * 2, -.3 + row * .4, back, this.backWall);
    for (const x of [-width / 2 + .3, .3, width / 2 - .3]) box(.55, 3.5, .58, WHITE, x, 1.5, back, this.backWall);
    box(width, .42, .65, BLUE, 0, 3.35, back, this.backWall);
    for (let x = -width / 2 + .3; x < width / 2; x += .5) stud(BLUE, x, 3.61, back, this.backWall);
    const windowX = -width / 4;
    box(width / 2 - 1, 2.2, .13, 0xa4d2e5, windowX, 1.75, back + .12, this.backWall);
    box(.08, 2.3, .18, WHITE, windowX, 1.75, back + .22, this.backWall);
    box(width / 2 - .9, .08, .18, WHITE, windowX, 1.75, back + .22, this.backWall);
    box(width / 2 - .8, .14, .85, YELLOW, windowX, .55, back + .22, this.backWall);
    const pegX = width / 4;
    box(width / 2 - 1, 2.25, .18, 0x436783, pegX, 1.7, back + .12, this.backWall);
    const holes: THREE.Vector3[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) holes.push(new THREE.Vector3(pegX - 1.05 + c * .35, 1 + r * .42, back + .23));
    instance(new THREE.CircleGeometry(.032, 8), DARK, holes, this.backWall);
    for (let i = 0; i < 3; i++) {
      const x = pegX - .65 + i * .65;
      box(.07, .85, .07, 0xaabfca, x, 1.85, back + .3, this.backWall);
      box(.2, .5, .17, i === 1 ? RED : YELLOW, x, 1.38, back + .33, this.backWall);
    }
    const sideX = -width / 2 + .12;
    box(.35, 2.7, 3.6, 0x587c96, sideX, .8, back + 1.8, this.sideWall);
    box(1, .18, 3.55, WHITE, sideX + .25, 1.5, back + 1.8, this.sideWall);
    for (let i = 0; i < 2; i++) {
      box(.75, .5, .7, i ? RED : YELLOW, sideX + .25, 1.85, back + .85 + i * 1.2, this.sideWall);
      stud(i ? RED : YELLOW, sideX + .25, 2.14, back + .85 + i * 1.2, this.sideWall);
    }
    const trayX = cols / 2 + 1.35, trayZ = rows / 2 + .65;
    box(1.05, .12, 1.65, DARK, trayX, -.48, trayZ);
    for (const x of [trayX - .5, trayX + .5]) box(.08, .18, 1.65, YELLOW, x, -.35, trayZ);
    for (const z of [trayZ - .8, trayZ + .8]) box(1.05, .18, .08, YELLOW, trayX, -.35, z);
    box(.15, .16, .8, RED, trayX - .16, -.32, trayZ);
    box(.05, .05, .65, 0xb2c4cc, trayX + .17, -.28, trayZ);
    box(width, .24, .28, DARK, 0, -.82, depth / 2 - .1);
    for (let x = -width / 2 + .6; x < width / 2; x += 2) box(.6, .12, .3, YELLOW, x, -.8, depth / 2 + .06);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: 0xdfe5e6, roughness: .9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.25; floor.receiveShadow = true; this.shell.add(floor);
    const studGeometry = new THREE.CylinderGeometry(.105, .115, .09, 12);
    studs.forEach((colors, parent) => colors.forEach((positions, color) => instance(studGeometry, color, positions, parent)));
  }
  placeCompanion(position: THREE.Vector3) { this.companionStand.position.set(position.x, 0, position.z); }
}
