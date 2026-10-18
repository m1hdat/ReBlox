import * as THREE from "three";
import { COLORS, roundedBox, matte } from "./tiles";
import { ToyModel } from "./toys";
import { settings } from "../game/animation";

/** Mặt tiền nhìn chính diện. Chữ biển hiệu dùng DOM được neo bằng phép chiếu camera. */
export class Storefront {
  readonly group = new THREE.Group();
  readonly robot = new ToyModel("robot");
  readonly doorZone: THREE.Mesh;
  readonly titleAnchor = new THREE.Vector3(0, 6.18, 0.73);
  readonly entryAnchor = new THREE.Vector3(2.65, -0.7, 2.2);
  readonly openAnchor = new THREE.Vector3(2.65, 3.25, 0.84);
  private light: THREE.PointLight;
  private glass: THREE.MeshStandardMaterial;
  private hovered = false;
  private warmth = 0;

  constructor() {
    const wall = 0xeef0e6, moss = 0x426f63, darkWood = 0x836344, oldWood = 0xc2a074;
    const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, radius = 0.04) => {
      const mesh = roundedBox(w, h, d, color, radius); mesh.position.set(x, y, z); this.group.add(mesh); return mesh;
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), matte(0xd8e2dc));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.03; ground.receiveShadow = true; this.group.add(ground);
    box(16, 0.16, 5.0, 0xbebca9, 0, -0.88, 1.45);
    // Khe lát vỉa hè là hình khối thật, chỉ đặt trước cửa tiệm.
    for (let i = 0; i < 10; i++) box(0.012, 0.004, 5.0, 0xaaa995, -7.2 + i * 1.6, -0.794, 1.45, 0.001);
    box(12.1, 0.48, 3.5, darkWood, 0, -0.46, -0.7);
    box(11.7, 6.65, 0.26, 0xd7dfd5, 0, 3.1, -2.4);
    box(0.32, 6.7, 3.4, wall, -5.7, 3.1, -0.7);
    box(0.32, 6.7, 3.4, wall, 5.7, 3.1, -0.7);
    box(11.8, 1.35, 0.7, wall, 0, 5.98, 0.28);
    box(11.8, 0.65, 0.64, moss, 0, 0.13, 0.28);
    // Chừa khoảng mở cho cửa kính để nhìn thấy nội thất bên trong.
    for (const x of [-5.55, 0.62, 4.58, 5.55]) box(x === 5.55 || x === -5.55 ? 0.38 : 0.24, 5.25, 0.52, moss, x, 2.68, 0.45);
    box(1.0, 5.35, 0.5, wall, 5.08, 2.65, 0.22);
    box(5.95, 0.44, 0.5, moss, -2.45, 0.8, 0.48);
    // Nội thất: quầy gỗ, ngăn kéo hé, đèn và vài hộp linh kiện.
    box(5.4, 0.94, 1.4, oldWood, -2.1, 0.55, -0.8);
    box(5.7, 0.14, 1.65, 0xc09a71, -2.1, 1.09, -0.7);
    const drawer = box(2.1, 0.48, 0.12, 0xa9825d, -3.25, 0.65, 0.0); drawer.rotation.z = -0.025;
    box(0.43, 0.065, 0.11, 0xd5bc8c, -3.25, 0.65, 0.1);
    this.robot.setIdleBlink(true); this.robot.group.scale.setScalar(0.73);
    this.robot.group.position.set(-1.8, 1.16, -0.68); this.group.add(this.robot.group);
    box(3.8, 0.12, 0.85, darkWood, -2.65, 4.03, -1.85);
    for (let i = 0; i < 3; i++) box(0.5, 0.55 + i * 0.12, 0.5, [0xc7a66f, 0xa5b5a0, 0xc68f70][i], -3.8 + i * 0.8, 4.35, -1.82);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 20, 1, true), matte(0xe9c37b, { side: THREE.DoubleSide }));
    lampShade.position.set(1.45, 4.55, -0.85); this.group.add(lampShade);
    box(0.025, 1.05, 0.025, darkWood, 1.45, 5.2, -0.85, 0.005);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), matte(COLORS.cream, { emissive: 0xffcb79, emissiveIntensity: 0.6 }));
    bulb.position.set(1.45, 4.34, -0.85); this.group.add(bulb);
    this.light = new THREE.PointLight(0xffd4a0, 7, 13, 2); this.light.position.set(0.6, 3.4, -0.6); this.group.add(this.light);
    this.glass = matte(0xd8e8e7, { transparent: true, opacity: 0.07, roughness: 0.22, emissive: 0xeeb05c, emissiveIntensity: 0.06, depthWrite: false });
    const window = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 3.95), this.glass);
    window.position.set(-2.42, 2.92, 0.68); this.group.add(window);
    box(0.08, 4.0, 0.13, oldWood, -3.6, 2.92, 0.72);
    box(5.75, 0.08, 0.13, oldWood, -2.42, 2.5, 0.72);
    // Hai vệt phản chiếu nhỏ, tránh che mặt robot.
    const reflection = matte(0xfff9df, { transparent: true, opacity: 0.2, depthWrite: false });
    for (const x of [-4.65, -4.31]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.8), reflection); strip.position.set(x, 3.15, 0.7); strip.rotation.z = -0.3; this.group.add(strip);
    }
    for (const x of [1.17, 4.13]) box(0.14, 4.9, 0.2, moss, x, 2.58, 0.58);
    for (const y of [0.2, 4.96]) box(3.1, 0.14, 0.2, moss, 2.65, y, 0.58);
    const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.7), this.glass); doorGlass.position.set(2.65, 2.95, 0.7); this.group.add(doorGlass);
    box(2.5, 0.64, 0.08, 0x49644e, 2.65, 0.9, 0.72);
    box(0.11, 0.52, 0.1, 0xc4a36d, 3.65, 2.15, 0.82);
    box(3.55, 0.2, 1.7, 0xb2a88d, 2.65, -0.48, 1.05);
    box(4.0, 0.16, 2.25, 0xc5baa0, 2.65, -0.67, 1.25);
    // Mái hiên vải sọc có mép bo mềm.
    for (let i = 0; i < 12; i++) {
      const strip = box(0.96, 0.07, 1.9, i % 2 ? 0xe5d4ad : 0x6f8060, -5.3 + i * 0.96, 5.0, 1.0, 0.02); strip.rotation.x = 0.16;
      box(0.96, 0.25, 0.12, i % 2 ? 0xe5d4ad : 0x6f8060, -5.3 + i * 0.96, 4.74, 1.95, 0.05);
    }
    box(10.8, 1.16, 0.24, 0x78553d, 0, 6.18, 0.56, 0.055);
    for (const y of [5.66, 6.7]) box(10.7, 0.055, 0.035, 0xb18b5c, 0, y, 0.7, 0.01);
    for (const x of [-5.08, 5.08]) for (const y of [5.8, 6.57]) {
      const nail = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), matte(0xc8ba94)); nail.position.set(x, y, 0.705); this.group.add(nail);
    }
    const roof = box(12.6, 0.28, 4.0, 0x4d5c4a, 0, 6.98, -0.7, 0.08); roof.rotation.z = 0.012;
    for (let i = 0; i < 9; i++) box(0.02, 0.005, 3.8, 0x76816a, -5.6 + i * 1.4, 7.135, -0.7, 0.001);
    // Vết sử dụng tập trung ở chân cửa và một chỗ sơn vá trên cột.
    for (let i = 0; i < 3; i++) box(0.3 + i * 0.1, 0.014, 0.008, 0x9a9473, 2.0 + i * 0.28, 0.63 + i * 0.055, 0.77, 0.002);
    box(0.16, 0.32, 0.012, 0x9caa83, -5.55, 1.25, 0.72, 0.01);
    this.doorZone = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.doorZone.position.set(2.65, 2.58, 0.9); this.group.add(this.doorZone);
  }
  setHovered(value: boolean) { this.hovered = value; }
  update(dt: number) {
    const target = this.hovered ? 1 : 0;
    this.warmth = settings.reducedMotion ? target : THREE.MathUtils.damp(this.warmth, target, 5, dt);
    this.light.intensity = 7 + this.warmth * 11;
    this.glass.emissiveIntensity = 0.14 + this.warmth * 0.3;
  }
}
