import * as THREE from "three";
import { roundedBox, matte, COLORS } from "./tiles";
import type { ToyId } from "../app/catalog";
import { settings } from "../game/animation";
import { woodMaterial, metalMaterial, paintedMaterial } from "./materials";

/** Đồ chơi procedural: cùng một asset được dùng ở xưởng, kệ, bàn chơi và màn sửa xong. */
export class ToyModel {
  readonly group = new THREE.Group();
  private animated: THREE.Object3D[] = [];
  private eyes: THREE.Mesh[] = [];
  private time = 0;
  private repaired = false;
  private idleBlink = false;
  constructor(readonly kind: ToyId, private finish: "wood" | "plastic" = "wood") {
    if (kind === "robot") this.robot();
    if (kind === "music-box") this.musicBox();
    if (kind === "train") this.train();
    if (kind === "clock") this.clock();
    this.setRepaired(false);
  }
  private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Group = this.group) {
    const mesh = roundedBox(w, h, d, color, 0.045);
    mesh.material.dispose();
    mesh.material = this.kind === "robot" || this.finish === "plastic" ? paintedMaterial(color) : woodMaterial(color);
    if (this.finish === "plastic") mesh.material.roughness = .32;
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  private cylinder(radius: number, height: number, color: number, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), matte(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; this.group.add(mesh); return mesh;
  }
  private robot() {
    this.box(1.25, 1.25, 0.82, COLORS.teal, 0, 1.05, 0);
    this.box(1.3, 0.95, 0.98, COLORS.cream, 0, 2.14, 0);
    this.box(1.05, 0.58, 0.04, 0x556f73, 0, 2.16, 0.5);
    for (const x of [-0.25, 0.25]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), matte(COLORS.yellow));
      eye.position.set(x, 2.19, 0.54); this.group.add(eye); this.eyes.push(eye);
      this.box(0.38, 0.37, 0.65, COLORS.blue, x * 1.5, 0.19, 0.12);
    }
    this.box(0.48, 0.45, 0.06, COLORS.coral, 0, 1.15, 0.44);
    this.box(0.24, 0.05, 0.02, COLORS.cream, 0, 1.15, 0.48);
    this.box(0.05, 0.24, 0.02, COLORS.cream, 0, 1.15, 0.48);
    for (const sign of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sign * 0.85, 1.5, 0);
      this.box(0.26, 0.75, 0.36, COLORS.blue, 0, -0.3, 0, arm);
      this.box(0.34, 0.28, 0.4, COLORS.cream, 0, -0.72, 0, arm);
      this.group.add(arm); this.animated.push(arm);
    }
    const antenna = this.cylinder(0.025, 0.3, COLORS.walnut, 0, 2.77, 0);
    (antenna.material as THREE.Material).dispose(); antenna.material = metalMaterial();
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), matte(COLORS.coral));
    tip.position.y = antenna.position.y + 0.2; this.group.add(tip);
  }
  private musicBox() {
    this.box(2.05, 0.8, 1.55, COLORS.coral, 0, 0.53, 0);
    this.box(2.14, 0.15, 1.64, COLORS.yellow, 0, 0.12, 0);
    this.box(1.78, 0.08, 1.3, COLORS.cream, 0, 0.95, 0);
    const lid = new THREE.Group(); lid.position.set(0, 0.98, -0.76);
    this.box(2.1, 0.16, 1.6, COLORS.coral, 0, 0, 0.76, lid); this.group.add(lid); this.animated.push(lid);
    const dancer = new THREE.Group(); dancer.position.y = 1.02;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 10), matte(COLORS.blue)); skirt.position.y = 0.25; dancer.add(skirt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), matte(COLORS.cream)); head.position.y = 0.6; dancer.add(head);
    this.group.add(dancer); this.animated.push(dancer);
    this.box(0.3, 0.18, 0.08, COLORS.yellow, 0, 0.6, 0.81);
  }
  private train() {
    this.box(2.3, 0.28, 1.0, COLORS.coral, 0, 0.42, 0);
    this.box(1.15, 0.65, 0.9, COLORS.blue, 0.45, 0.84, 0);
    this.box(0.85, 1.2, 0.92, COLORS.teal, -0.7, 1.13, 0);
    this.box(0.44, 0.5, 0.035, COLORS.cream, -0.7, 1.36, 0.48);
    this.box(1.1, 0.16, 1.17, COLORS.yellow, -0.7, 1.81, 0);
    this.cylinder(0.16, 0.47, COLORS.walnut, 0.75, 1.4, 0);
    for (const x of [-0.8, 0, 0.8]) for (const sign of [-1, 1]) {
      const wheel = new THREE.Group(); wheel.position.set(x, 0.3, sign * 0.54);
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 16), matte(COLORS.walnut));
      disk.rotation.x = Math.PI / 2; wheel.add(disk);
      this.box(0.36, 0.04, 0.14, COLORS.yellow, 0, 0, 0, wheel);
      this.group.add(wheel); this.animated.push(wheel);
    }
  }
  private clock() {
    this.box(1.7, 2.0, 0.68, COLORS.yellow, 0, 1.2, 0);
    this.box(1.92, 0.2, 0.84, COLORS.coral, 0, 0.16, 0);
    this.box(1.9, 0.2, 0.82, COLORS.coral, 0, 2.26, 0);
    const face = this.cylinder(0.63, 0.06, COLORS.cream, 0, 1.58, 0.38); face.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const tick = this.box(0.035, 0.1, 0.02, COLORS.walnut, Math.sin(angle) * 0.5, 1.58 + Math.cos(angle) * 0.5, 0.42);
      tick.rotation.z = -angle;
    }
    for (const length of [0.29, 0.43]) {
      const hand = new THREE.Group(); hand.position.set(0, 1.58, 0.46);
      this.box(0.045, length, 0.025, COLORS.teal, 0, length / 2 - 0.03, 0, hand);
      this.group.add(hand); this.animated.push(hand);
    }
    const pendulum = new THREE.Group(); pendulum.position.set(0, 0.9, 0.39);
    this.box(0.04, 0.45, 0.04, COLORS.walnut, 0, -0.17, 0, pendulum);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), matte(COLORS.coral)); bob.position.y = -0.4; pendulum.add(bob);
    this.group.add(pendulum); this.animated.push(pendulum);
  }
  setRepaired(value: boolean) {
    this.repaired = value; this.time = 0; this.group.rotation.z = 0;
    this.eyes.forEach((eye) => eye.scale.y = value ? 1 : 0.15);
    if (this.kind === "music-box") { this.animated[0].rotation.x = value ? -1.1 : -0.08; this.animated[1].visible = value; }
    if (this.kind === "robot") this.animated.forEach((arm, index) => arm.rotation.z = (index ? 1 : -1) * 0.13);
    if (this.kind === "clock") { this.animated[0].rotation.z = -0.6; this.animated[1].rotation.z = 1.2; }
  }
  setIdleBlink(value: boolean) { this.idleBlink = value; }
  update(dt: number) {
    this.time += dt;
    if (settings.reducedMotion) {
      if (this.idleBlink) this.eyes.forEach((eye) => eye.scale.y = 0.65);
      return;
    }
    if (this.idleBlink) {
      const blink = Math.abs((this.time % 5.6) - 4.7) < 0.1;
      this.eyes.forEach((eye) => eye.scale.y = blink ? 0.08 : 0.65);
    }
    if (!this.repaired) return;
    if (this.kind === "robot") {
      this.animated.forEach((arm, index) => arm.rotation.z = (index ? 1 : -1) * (0.35 + Math.sin(this.time * 3) * 0.2));
    }
    if (this.kind === "music-box") this.animated[1].rotation.y += dt * 0.8;
    if (this.kind === "train") this.animated.forEach((wheel) => wheel.rotation.z -= dt * 1.8);
    if (this.kind === "clock") {
      this.animated[0].rotation.z -= dt * 0.15; this.animated[1].rotation.z -= dt * 0.6;
      this.animated[2].rotation.z = Math.sin(this.time * 2.5) * 0.28;
    }
  }
}
