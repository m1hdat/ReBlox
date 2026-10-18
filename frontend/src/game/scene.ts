import * as THREE from "three";
import type { ActionName, GameMap, GameState } from "../api/client";
import { ease, tween, settings } from "./animation";
import { createCamera, fitCamera } from "./camera";
import { createRenderer } from "./renderer";
import { presentationFor } from "./map-presentation";
import { repairParts } from "../objects/repair-parts";
import { LegoWorkshop } from "../objects/lego-workshop";
import { Storefront } from "../objects/storefront";
import { createReceivingCounter, createRepairedDisplay } from "../objects/interior";
import { ToyModel } from "../objects/toys";
import { TOYS, toyForMap, type ToyId } from "../app/catalog";
import { Player, createUnitCube, blockBox, occupiedCells, type RenderBlock } from "../objects/player";
import { disposeTree } from "../objects/resources";
import {
  COLORS, matte, createBridge, createFloorTile, createFragileTile, createGoalSocket,
  createSplitMachineTile, createSwitchTile, type BridgeParts, type ButtonParts,
  type FragileParts, type GoalParts,
} from "../objects/tiles";

export interface StorefrontLayout {
  title: { x: number; y: number; width: number; height: number };
  entry: { x: number; y: number };
  open: { x: number; y: number; scale: number };
}
export interface CounterTarget { id: ToyId; x: number; y: number; width: number; height: number; }
const MAP_CAMERA = { minYaw: .12, maxYaw: 1.25, minPitch: .65, maxPitch: Math.PI / 2 - .001, pitch: .78 };

/** Chỉ trình diễn state backend. Không suy ra nước hợp lệ hoặc tự kích hoạt cầu. */
export class WorkshopScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = createCamera();
  readonly scene = new THREE.Scene();
  private boardRoot = new THREE.Group();
  private environment = new THREE.Group();
  private player = new Player();
  private cubes = [createUnitCube(), createUnitCube()];
  private renderState: RenderBlock | null = null;
  private toy: ToyModel | null = null;
  private cable: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial> | null = null;
  private models: ToyModel[] = [];
  private mode: "storefront" | "counter" | "game" | "preview" | "complete" = "storefront";
  private presentation: ReturnType<typeof presentationFor> | null = null;
  private mapDecor: THREE.Group | null = null;
  private cameraYaw = .65;
  private cameraPitch = .9;
  private manualCamera = false;
  private targetYaw = .65;
  private targetPitch = .9;
  private mapZoom = 1;
  private targetZoom = 1;
  private workshop: LegoWorkshop | null = null;
  private currentMap: GameMap | null = null;
  private previewTransition: { elapsed: number; position: THREE.Vector3; center: THREE.Vector3; frame: THREE.Vector4 } | null = null;
  private resettingCamera = false;
  private ambient: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  onCameraChange: ((state: { preset: string; zoom: number }) => void) | null = null;
  private storefront: Storefront | null = null;
  private counterSelected = false;
  private counterChoice: ToyId = "robot";
  private counterHover: ToyId | null = null;
  private selectionRing: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  onLayout: ((layout: StorefrontLayout) => void) | null = null;
  onCounterLayout: ((targets: CounterTarget[]) => void) | null = null;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private bridges = new Map<string, BridgeParts>();
  private buttons = new Map<string, ButtonParts>();
  private fragile = new Map<string, FragileParts>();
  private goal: GoalParts | null = null;
  private bounds = new THREE.Box3(new THREE.Vector3(-7, -1, -5), new THREE.Vector3(7, 2, 5));
  private last = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.ambient = new THREE.HemisphereLight(0xeaf3ff, 0x8295a5, 2.1); this.scene.add(this.ambient);
    const sun = new THREE.DirectionalLight(0xfff5e8, 3.0);
    this.keyLight = sun;
    this.fillLight = new THREE.DirectionalLight(0xfffdf6, 0); this.fillLight.position.set(6, 7, 10); this.scene.add(this.fillLight);
    sun.position.set(-5, 12, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 45 });
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
    this.scene.add(sun, this.environment, this.boardRoot);
    this.boardRoot.add(this.player.group);
    this.boardRoot.add(...this.cubes);
    // Canvas đổi kích thước theo CSS grid, không chỉ khi window phát resize.
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(() => this.loop());
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    if (w !== this.viewportWidth || h !== this.viewportHeight) {
      this.renderer.setSize(w, h, false); this.viewportWidth = w; this.viewportHeight = h;
    }
    if (this.presentation) this.positionMapCamera();
    const mobileCounter = this.mode === "counter" && window.innerWidth <= 900;
    if (this.mode === "counter") this.models.forEach((model, index) => {
      model.group.visible = !mobileCounter || this.counterSelected || model.kind === this.counterChoice;
      model.group.position.x = mobileCounter ? 0 : this.counterSelected ? 3.3 : -4.65 + index * 3.1;
    });
    fitCamera(this.camera, w, h, mobileCounter ? new THREE.Box3(new THREE.Vector3(-3.2, -1.8, -3.2), new THREE.Vector3(3.2, 4.5, 2.2)) : this.bounds,
      this.mode === "preview" ? { top: w <= 900 ? 64 : 56, right: 20, bottom: 32, left: 20 } : undefined);
    if (this.previewTransition) {
      const transition = this.previewTransition, t = ease.inOut(Math.min(1, transition.elapsed / .22));
      this.camera.position.lerpVectors(transition.position, this.camera.position.clone(), t);
      this.camera.lookAt(transition.center.clone().lerp(this.bounds.getCenter(new THREE.Vector3()), t));
      const frame = transition.frame.clone().lerp(new THREE.Vector4(this.camera.left, this.camera.right, this.camera.top, this.camera.bottom), t);
      [this.camera.left, this.camera.right, this.camera.top, this.camera.bottom] = frame.toArray();
    }
    this.camera.zoom = this.presentation ? this.mapZoom : 1; this.camera.updateProjectionMatrix();
    this.emitCameraState();
    const layout = this.getStorefrontLayout();
    if (layout) this.onLayout?.(layout);
    if (this.mode === "counter") { this.positionSelectionRing(); this.onCounterLayout?.(this.getCounterTargets()); }
  }

  private loop() {
    if (this.disposed) return;
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!document.hidden) {
      if (this.presentation && this.manualCamera && (Math.abs(this.cameraYaw - this.targetYaw) + Math.abs(this.cameraPitch - this.targetPitch) + Math.abs(this.mapZoom - this.targetZoom) > .0001)) {
        this.cameraYaw = settings.reducedMotion ? this.targetYaw : THREE.MathUtils.damp(this.cameraYaw, this.targetYaw, 14, dt);
        this.cameraPitch = settings.reducedMotion ? this.targetPitch : THREE.MathUtils.damp(this.cameraPitch, this.targetPitch, 14, dt);
        this.mapZoom = settings.reducedMotion ? this.targetZoom : THREE.MathUtils.damp(this.mapZoom, this.targetZoom, 14, dt);
        this.resize();
      }
      else if (this.resettingCamera) { this.resettingCamera = false; this.manualCamera = false; this.resize(); }
      if (this.previewTransition) {
        this.previewTransition.elapsed = settings.reducedMotion ? .22 : this.previewTransition.elapsed + dt;
        if (this.previewTransition.elapsed >= .22) this.previewTransition = null;
        this.resize();
      }
      this.models.forEach((model) => {
        if (this.mode !== "counter" || this.counterSelected || model.kind === this.counterChoice) model.update(dt);
        if (this.mode === "counter" && !this.counterSelected) {
          const selected = model.kind === this.counterChoice;
          const target = 0.06 + (selected ? 0.09 : 0);
          model.group.position.y = settings.reducedMotion ? target : THREE.MathUtils.damp(model.group.position.y, target, 14, dt);
          const scale = 0.92 * (model.kind === this.counterHover ? 1.035 : 1);
          model.group.scale.setScalar(settings.reducedMotion ? scale : THREE.MathUtils.damp(model.group.scale.x, scale, 14, dt));
          if (model.kind === "robot") model.group.rotation.y = settings.reducedMotion ? selected ? 0.12 : 0 : THREE.MathUtils.damp(model.group.rotation.y, selected ? 0.12 : 0, 8, dt);
        }
      }); this.storefront?.update(dt);
      this.renderer.render(this.scene, this.camera);
    }
    this.frame = requestAnimationFrame(() => this.loop());
  }

  private clearWorld(preserveWorkshop = false) {
    for (const child of [...this.boardRoot.children]) {
      if (child === this.player.group || this.cubes.includes(child as THREE.Group)) continue;
      this.boardRoot.remove(child); disposeTree(child);
    }
    if (preserveWorkshop) {
      if (this.mapDecor) { this.environment.remove(this.mapDecor); disposeTree(this.mapDecor); }
      if (this.cable) { this.environment.remove(this.cable); disposeTree(this.cable); }
    } else {
      this.scene.remove(this.environment); disposeTree(this.environment);
      this.environment = new THREE.Group(); this.scene.add(this.environment); this.workshop = null;
    }
    this.bridges.clear(); this.buttons.clear(); this.fragile.clear(); this.goal = null;
    this.models = []; this.toy = null; this.cable = null; this.storefront = null;
    this.presentation = null; this.mapDecor = null; this.currentMap = null; this.manualCamera = false; this.resettingCamera = false; this.previewTransition = null;
    this.mapZoom = this.targetZoom = 1; this.camera.zoom = 1; this.boardRoot.position.y = 0;
    if (!preserveWorkshop) {
      this.scene.background = null; this.ambient.intensity = 2.1; this.keyLight.intensity = 3; this.keyLight.position.set(-5, 12, 7); this.keyLight.shadow.intensity = 1;
      this.ambient.color.setHex(0xeaf3ff); this.ambient.groundColor.setHex(0x8295a5); this.fillLight.intensity = 0;
      if (this.renderer.shadowMap) this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.keyLight.shadow.mapSize.set(1024, 1024);
    }
    if (this.renderer.shadowMap) { this.renderer.shadowMap.autoUpdate = !preserveWorkshop; this.renderer.shadowMap.needsUpdate = true; }
    this.counterSelected = false; this.selectionRing = null; this.counterHover = null; this.player.group.visible = false;
    this.cubes.forEach(cube => { cube.visible = false; }); this.renderState = null;
  }

  showStorefront() {
    this.clearWorld(); this.mode = "storefront";
    this.storefront = new Storefront(); this.environment.add(this.storefront.group);
    this.models.push(this.storefront.robot);
    this.camera.position.set(0, 5.0, 22); this.camera.lookAt(0, 3.1, 0);
    this.bounds.set(new THREE.Vector3(-7.4, -1.1, -2.5), new THREE.Vector3(7.4, 7.3, 2.3)); this.resize();
  }

  showCounter(completed: string[] = [], selected?: ToyId, choice: ToyId = "robot") {
    this.clearWorld(); this.mode = "counter"; this.counterSelected = !!selected;
    this.counterChoice = choice;
    this.environment.add(createReceivingCounter());
    (selected ? TOYS.filter((toy) => toy.id === selected) : TOYS).forEach((toy, index) => {
      const model = new ToyModel(toy.id, "plastic"); model.setRepaired(toy.maps.every((id) => completed.includes(id)));
      model.group.position.set(selected ? 3.3 : -4.65 + index * 3.1, 0.06, 0.05);
      model.group.scale.setScalar(selected ? 1.12 : 0.92);
      model.setIdleBlink(toy.id === "robot");
      this.environment.add(model.group); this.models.push(model);
    });
    if (!selected) {
      this.selectionRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.035, 8, 48), matte(0x246667));
      this.selectionRing.rotation.x = -Math.PI / 2; this.environment.add(this.selectionRing);
    }
    this.camera.position.set(3, 9, 19); this.camera.lookAt(0, 1.0, 0);
    this.bounds.set(new THREE.Vector3(-7.4, -1.8, -3.2), new THREE.Vector3(7.4, 4.5, 2.2)); this.resize();
  }

  private positionSelectionRing() {
    const model = this.models.find((model) => model.kind === this.counterChoice);
    if (this.selectionRing && model) this.selectionRing.position.set(model.group.position.x, 0.065, model.group.position.z);
  }
  setCounterSelection(id: ToyId) {
    if (this.mode !== "counter" || this.counterSelected) return;
    this.counterChoice = id; this.resize();
  }
  setCounterHover(id: ToyId | null) { this.counterHover = id; }
  getCounterTargets(): CounterTarget[] {
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    return this.models.map((model) => {
      const bounds = new THREE.Box3().setFromObject(model.group);
      const screen = new THREE.Box2();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(this.camera);
        screen.expandByPoint(new THREE.Vector2((point.x + 1) * width / 2, (1 - point.y) * height / 2));
      }
      return { id: model.kind, x: screen.min.x - 10, y: screen.min.y - 14, width: screen.max.x - screen.min.x + 20, height: screen.max.y - screen.min.y + 28 };
    });
  }
  toyAt(x: number, y: number): ToyId | null {
    if (this.mode !== "counter" || this.counterSelected) return null;
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.canvas.clientWidth * 2 - 1, -(y / this.canvas.clientHeight) * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObjects(this.models.filter((model) => model.group.visible).map((model) => model.group), true)[0];
    return this.models.find((model) => { let object: THREE.Object3D | null = hit?.object ?? null; while (object) { if (object === model.group) return true; object = object.parent; } return false; })?.kind ?? null;
  }

  showRepaired(kind: ToyId, completed: string[]) {
    this.clearWorld(); this.mode = "complete"; this.environment.add(createRepairedDisplay());
    const hero = new ToyModel(kind); hero.setRepaired(true); hero.group.position.set(2.1, -0.04, 0.3);
    hero.group.scale.setScalar(1.08); this.environment.add(hero.group); this.models.push(hero);
    TOYS.filter((toy) => toy.id !== kind && toy.maps.every((id) => completed.includes(id))).forEach((toy, index) => {
      const model = new ToyModel(toy.id); model.setRepaired(true); model.group.scale.setScalar(0.5);
      model.group.position.set(-4.5 + index * 2.6, 3.73, -0.6); this.environment.add(model.group); this.models.push(model);
    });
    this.camera.position.set(4, 7, 18); this.camera.lookAt(0, 1.4, 0);
    this.bounds.set(new THREE.Vector3(-7.2, -1.0, -2.8), new THREE.Vector3(7.2, 5.4, 2)); this.resize();
  }

  getStorefrontLayout(): StorefrontLayout | null {
    if (!this.storefront) return null;
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    const project = (point: THREE.Vector3) => {
      const projected = point.clone().project(this.camera);
      return { x: (projected.x + 1) * w / 2, y: (1 - projected.y) * h / 2 };
    };
    const anchor = this.storefront.titleAnchor;
    const a = project(anchor.clone().add(new THREE.Vector3(-5.1, 0.44, 0)));
    const b = project(anchor.clone().add(new THREE.Vector3(5.1, -0.44, 0)));
    return { title: { ...project(anchor), width: b.x - a.x, height: b.y - a.y }, entry: project(this.storefront.entryAnchor), open: { ...project(this.storefront.openAnchor), scale: Math.max(0.55, Math.min(1.4, (b.x - a.x) / 700)) } };
  }

  doorAt(x: number, y: number) {
    if (!this.storefront) return false;
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.canvas.clientWidth * 2 - 1, -(y / this.canvas.clientHeight) * 2 + 1), this.camera);
    return this.raycaster.intersectObject(this.storefront.doorZone).length > 0;
  }
  setDoorHovered(value: boolean) { this.storefront?.setHovered(value); }

  private positionMapCamera() {
    if (!this.presentation) return;
    if (!this.manualCamera) {
      const yaw = this.presentation.yaw(this.canvas.clientHeight > this.canvas.clientWidth);
      this.cameraYaw = this.targetYaw = THREE.MathUtils.clamp(yaw, MAP_CAMERA.minYaw, MAP_CAMERA.maxYaw);
      this.cameraPitch = this.targetPitch = MAP_CAMERA.pitch;
    }
    const center = this.bounds.getCenter(new THREE.Vector3());
    this.camera.position.set(Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch), Math.sin(this.cameraPitch), Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)).multiplyScalar(28).add(center);
    this.camera.up.set(0, 1, 0); this.camera.lookAt(center);
    // The workshop and companion stay visible throughout the front-facing camera arc.
  }
  private emitCameraState() { if (this.presentation) this.onCameraChange?.({ preset: !this.manualCamera || this.resettingCamera ? "default" : this.targetPitch > 1.5 ? "top" : "orbit", zoom: this.targetZoom }); }
  private setCameraTarget() { if (settings.reducedMotion) { this.cameraYaw = this.targetYaw; this.cameraPitch = this.targetPitch; this.mapZoom = this.targetZoom; } this.resize(); }
  private turnMapCamera(angle: number) {
    this.targetYaw = THREE.MathUtils.clamp(this.targetYaw + angle, MAP_CAMERA.minYaw, MAP_CAMERA.maxYaw);
  }
  orbitMapCamera(dx: number, dy: number) {
    if (!this.presentation) return;
    this.manualCamera = true; this.resettingCamera = false; this.previewTransition = null;
    this.turnMapCamera(dx * .008);
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * .006, MAP_CAMERA.minPitch, MAP_CAMERA.maxPitch); this.setCameraTarget();
  }
  rotateMapCamera(angle: number) { if (!this.presentation) return; this.manualCamera = true; this.resettingCamera = false; this.previewTransition = null; this.turnMapCamera(angle); this.setCameraTarget(); }
  topMapCamera() { if (!this.presentation) return; this.manualCamera = true; this.resettingCamera = false; this.previewTransition = null; this.targetPitch = Math.PI / 2 - .001; this.setCameraTarget(); }
  resetMapCamera() {
    if (!this.presentation) return; this.previewTransition = null; this.resettingCamera = false;
    if (settings.reducedMotion) { this.manualCamera = false; this.mapZoom = this.targetZoom = 1; this.resize(); return; }
    const yaw = THREE.MathUtils.clamp(this.presentation.yaw(this.canvas.clientHeight > this.canvas.clientWidth), MAP_CAMERA.minYaw, MAP_CAMERA.maxYaw);
    this.targetYaw = this.cameraYaw + Math.atan2(Math.sin(yaw - this.cameraYaw), Math.cos(yaw - this.cameraYaw));
    this.targetPitch = MAP_CAMERA.pitch; this.targetZoom = 1; this.manualCamera = this.resettingCamera = true; this.setCameraTarget();
  }
  zoomMapCamera(factor: number) { if (!this.presentation) return; this.manualCamera = true; this.resettingCamera = false; this.previewTransition = null; this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * factor, .82, 1.22); this.setCameraTarget(); }
  specialAt(x: number, y: number): string | null {
    if (this.mode !== "preview" || !this.currentMap) return null;
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.canvas.clientWidth * 2 - 1, 1 - y / this.canvas.clientHeight * 2), this.camera);
    const point = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()); if (!point) return null;
    const map = this.currentMap, row = Math.round(point.z + (map.rows - 1) / 2), col = Math.round(point.x + (map.cols - 1) / 2);
    const labels: Record<string, string> = { F: "Ô dễ vỡ: khối nằm hoặc cube đơn có thể đi qua.", G: "Ô đích: đưa khối đứng thẳng vào đây.", s: "Công tắc mềm: cả cube đơn cũng kích hoạt được.", h: "Công tắc nặng: chỉ khối nguyên đứng thẳng mới kích hoạt.", X: map.splitters?.length ? "Ô tách ( ): đứng lên để dịch chuyển thành hai cube. Space để đổi khối." : "Ô tách chưa được khai báo đích dịch chuyển." };
    const bridge = map.bridges.find((bridge) => bridge.cells.some(([r, c]) => r === row && c === col));
    if (bridge) return this.bridges.get(bridge.id)?.planks.some((plank) => plank.visible) ? "Cầu đang mở: có thể đi qua." : "Cầu đang đóng: kích hoạt công tắc để mở.";
    return labels[map.grid[row]?.[col]] ?? null;
  }
  previewMap(map: GameMap) {
    if (this.mode === "preview" && this.currentMap === map) return;
    const manual = this.mode === "preview" && this.manualCamera, yaw = this.cameraYaw, pitch = this.cameraPitch, zoom = this.mapZoom;
    const transition = this.mode === "preview" && !settings.reducedMotion ? { elapsed: 0, position: this.camera.position.clone(), center: this.bounds.getCenter(new THREE.Vector3()), frame: new THREE.Vector4(this.camera.left, this.camera.right, this.camera.top, this.camera.bottom) } : null;
    this.loadMap(map, true);
    if (manual) { this.manualCamera = true; this.cameraYaw = this.targetYaw = yaw; this.cameraPitch = this.targetPitch = pitch; this.mapZoom = this.targetZoom = zoom; }
    this.setBlock({ row: map.start[0], col: map.start[1], orientation: "STANDING", open_bridges: map.bridges.filter((bridge) => bridge.initially_open).map((bridge) => bridge.id) });
    void this.setBridges(map.bridges.filter((bridge) => bridge.initially_open).map((bridge) => bridge.id), false);
    this.previewTransition = transition; this.resize();
  }

  loadMap(map: GameMap, preview = false) {
    this.clearWorld(this.workshop !== null); this.mode = preview ? "preview" : "game"; this.currentMap = map;
    this.presentation = presentationFor(map);
    this.player.setColor(({ robot: COLORS.peach, "music-box": COLORS.coral, train: COLORS.blue, clock: COLORS.yellow })[toyForMap(map.id).id]);
    this.mapDecor = new THREE.Group();
    if (!this.workshop) { this.workshop = new LegoWorkshop(map); this.environment.add(this.workshop.group); }
    else this.workshop.configure(map);
    this.environment.add(this.mapDecor);
    this.scene.background = new THREE.Color(0xf0f1e9); this.ambient.intensity = 2.3; this.keyLight.intensity = 2.5; this.keyLight.position.set(-7, 14, -3);
    this.ambient.color.setHex(0xfffcf6); this.ambient.groundColor.setHex(0xbdceca); this.fillLight.intensity = 1.0;
    this.keyLight.shadow.intensity = .55;
    this.keyLight.shadow.mapSize.set(512, 512); this.keyLight.shadow.blurSamples = 6; this.keyLight.shadow.radius = 4;
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.type = THREE.VSMShadowMap;
      this.renderer.shadowMap.autoUpdate = !preview; this.renderer.shadowMap.needsUpdate = true;
    }
    this.toy = new ToyModel(toyForMap(map.id).id, "plastic");
    this.toy.group.name = `Workshop companion: ${this.toy.kind}`;
    this.toy.group.scale.setScalar(.72); this.toy.group.position.copy(this.presentation.toyPosition);
    this.workshop.placeCompanion(this.presentation.toyPosition);
    this.toy.setIdleBlink(this.toy.kind === "robot");
    const parts = repairParts(this.presentation.toy); parts.position.copy(this.presentation.partsPosition);
    this.mapDecor.add(this.toy.group, parts); this.models.push(this.toy);
    const gx = map.goal[1] - (map.cols - 1) / 2, gz = map.goal[0] - (map.rows - 1) / 2;
    const wireEdge = map.cols / 2 + 1.0, toyPosition = this.presentation.toyPosition;
    const route = new THREE.CatmullRomCurve3([
      new THREE.Vector3(gx, -0.4, gz), new THREE.Vector3(wireEdge, -0.4, gz),
      new THREE.Vector3(wireEdge, -0.29, toyPosition.z),
      new THREE.Vector3(toyPosition.x + .5, -0.29, toyPosition.z), new THREE.Vector3(toyPosition.x, -0.2, toyPosition.z),
    ], false, "centripetal");
    this.cable = new THREE.Mesh(new THREE.TubeGeometry(route, 32, 0.025, 5, false), new THREE.MeshStandardMaterial({ color: COLORS.yellow, roughness: 0.8, emissive: COLORS.yellow, emissiveIntensity: 0 }));
    this.environment.add(this.cable);
    this.boardRoot.position.set(-(map.cols - 1) / 2, 0, -(map.rows - 1) / 2);
    let floorTemplate: THREE.Group | null = null;
    map.grid.forEach((line, r) => [...line].forEach((ch, c) => {
      let tile: THREE.Group | null = null;
      const floor = 0xd8e5ef;
      if (ch === "#") {
        if (!floorTemplate) { floorTemplate = createFloorTile(floor); (floorTemplate.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.color.setHex(0x395f78); tile = floorTemplate; } else tile = floorTemplate.clone(true);
      }
      else if (ch === "F") {
        const parts = createFragileTile(); this.fragile.set(`${r},${c}`, parts); tile = parts.group;
      } else if (ch === "G") { this.goal = createGoalSocket(); tile = this.goal.group; }
      else if (ch === "s" || ch === "h") {
        const parts = createSwitchTile(ch === "s" ? "soft" : "heavy", floor);
        this.buttons.set(`${r},${c}`, parts); tile = parts.group;
      } else if (ch === "X") tile = createSplitMachineTile();
      if (tile) { tile.traverse((object) => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) { object.material.roughness = .48; object.material.metalness = 0; } }); tile.position.set(c, 0, r); tile.userData.cell = [r, c, ch]; this.boardRoot.add(tile); }
    }));
    for (const bridge of map.bridges) {
      const parts = createBridge(bridge.cells);
      for (const ghost of parts.ghosts) {
        // Inactive bridges are markings above the tray, never extra walkable tiles.
        ghost.position.y = -.29;
        const material = ghost.material as THREE.LineBasicMaterial;
        material.color.setHex(0xc18a1c); material.opacity = .95;
        const cross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-.29, .008, -.29), new THREE.Vector3(.29, .008, .29),
          new THREE.Vector3(-.29, .008, .29), new THREE.Vector3(.29, .008, -.29),
        ]), material);
        ghost.add(cross);
      }
      this.bridges.set(bridge.id, parts); this.boardRoot.add(parts.group);
    }
    this.bounds.copy(this.presentation.bounds);
    this.bounds.min.add(new THREE.Vector3(.35, 0, .35)); this.bounds.max.sub(new THREE.Vector3(.35, 0, .35));
    this.bounds.min.y = -.85; this.bounds.max.y = 2.8;
    this.bounds.min.z = Math.min(this.bounds.min.z, this.toy.group.position.z - .65);
    this.resize();
  }

  setBridges(open: string[], animate = true): Promise<void> {
    const active = new Set(open), jobs: Promise<void>[] = [];
    this.bridges.forEach((parts, id) => {
      const show = active.has(id);
      parts.ghosts.forEach((ghost) => ghost.visible = !show);
      parts.planks.forEach((plank, i) => {
        const restX = parts.ghosts[i].position.x;
        const from = (plank.userData.extension as number | undefined) ?? 0;
        const to = show ? 1 : 0;
        const update = (t: number) => {
          const extension = from + (to - from) * t;
          plank.userData.extension = extension;
          plank.scale.x = 0.04 + 0.96 * extension;
          plank.position.x = restX - 0.35 * (1 - extension);
          plank.position.y = -0.6 * (1 - extension);
        };
        plank.visible = true;
        if (!animate || from === to) { update(1); plank.visible = show; return; }
        jobs.push(tween(280 + i * 28, update).then(() => { plank.visible = show; }));
      });
    });
    return Promise.all(jobs).then(() => undefined);
  }

  setBlock(state: RenderBlock | GameState) {
    this.renderState = state;
    this.cubes.forEach((cube, i) => {
      cube.visible = !!state.split;
      cube.scale.setScalar(1);
      if (state.split) {
        const [r, c] = state.split.cubes[i]; cube.position.set(c, .5, r);
        cube.getObjectByName("active-cube")!.visible = i === state.split.active;
      }
    });
    if (state.split) this.player.group.visible = false;
    else this.player.setBlock(state);
  }

  /** Pivot ở cạnh đáy. attach giữ quaternion thật, không dựng lại mesh khi đáp. */
  async roll(from: RenderBlock, action: ActionName, to: RenderBlock) {
    if (from.split || to.split || action === "SWITCH_CUBE") {
      this.setBlock(from);
      if (from.split && to.split) {
        const starts = this.cubes.map(cube => cube.position.clone());
        const remaining = to.split.cubes.map(([r, c]) => new THREE.Vector3(c, .5, r));
        const destinations = starts.map(start => remaining.find(v => v.equals(start)) ?? null);
        const available = remaining.filter(v => !destinations.includes(v));
        destinations.forEach((v, i) => { if (!v) destinations[i] = available.shift()!; });
        await tween(200, t => this.cubes.forEach((cube, i) => cube.position.lerpVectors(starts[i], destinations[i]!, t)));
      } else if (to.split) {
        await tween(120, t => this.player.group.scale.setScalar(1 - .65 * t));
        this.setBlock(to);
        await tween(170, t => this.cubes.forEach(cube => cube.scale.setScalar(.35 + .65 * t)));
      } else {
        const starts = this.cubes.map(cube => cube.position.clone()), box = blockBox(to);
        const center = new THREE.Vector3(box.cx, .5, box.cz);
        await tween(180, t => this.cubes.forEach((cube, i) => cube.position.lerpVectors(starts[i], center, t)));
      }
      this.setBlock(to); return;
    }
    const b = blockBox(from);
    const axis = action === "LEFT" || action === "RIGHT" ? "z" : "x";
    const angle = action === "RIGHT" || action === "UP" ? -Math.PI / 2 : Math.PI / 2;
    const px = action === "RIGHT" ? b.maxX : action === "LEFT" ? b.minX : b.cx;
    const pz = action === "DOWN" ? b.maxZ : action === "UP" ? b.minZ : b.cz;
    const pivot = new THREE.Group(); pivot.position.set(px, 0, pz);
    this.boardRoot.add(pivot); this.boardRoot.updateMatrixWorld(true);
    const group = this.player.group;
    pivot.attach(group);
    await tween(290, (t) => { pivot.rotation[axis] = angle * t; });
    this.boardRoot.updateMatrixWorld(true);
    this.boardRoot.attach(group); this.boardRoot.remove(pivot);
    this.player.snapPosition(to);
    // Chỉ hạ nhẹ trọng tâm: không scale local Y (sẽ sai trục khi khối đang nằm).
    const y = group.position.y;
    await tween(50, (t) => { group.position.y = y - 0.014 * Math.sin(t * Math.PI); }, ease.linear);
    group.position.y = y;
    this.renderState = to;
  }

  /** Chỉ gọi sau khi backend từ chối nước đi; nhận attempted để chọn hiệu ứng vỡ. */
  async fall(attempted: RenderBlock | null) {
    const broken = attempted?.orientation === "STANDING"
      ? this.fragile.get(`${attempted.row},${attempted.col}`) : undefined;
    const fracture = broken ? tween(380, (t) => {
      broken.shards.forEach((shard, i) => {
        const x = i < 2 ? -0.24 : 0.24, z = i % 2 ? 0.24 : -0.24;
        shard.position.set(x * (1 + t * 0.7), -t * t * 1.2, z * (1 + t * 0.7));
        shard.rotation.set(t * (i % 2 ? 0.4 : -0.4), 0, t * (i < 2 ? 0.3 : -0.3));
      });
      if (t > 0.65) broken.group.visible = false;
    }) : Promise.resolve();
    const group = this.renderState?.split ? this.cubes[this.renderState.split.active] : this.player.group, y = group.position.y;
    this.player.setSocketClipping(true);
    await Promise.all([fracture, tween(420, (t) => { group.position.y = y - 3 * t; }, ease.in)]);
  }

  resetPlayer(start: GameState) {
    this.setBlock(start); this.setGoalGlow(0.06); this.toy?.setRepaired(false);
    if (this.cable) this.cable.material.emissiveIntensity = 0;
    this.fragile.forEach(({ group, shards }) => {
      group.visible = true;
      shards.forEach((shard, i) => {
        shard.position.set(i < 2 ? -0.24 : 0.24, 0, i % 2 ? 0.24 : -0.24);
        shard.rotation.set(0, 0, 0);
      });
    });
    this.goal?.petals.forEach((petal) => petal.visible = false);
  }

  private setGoalGlow(value: number) {
    if (this.goal) (this.goal.glow.material as THREE.MeshStandardMaterial).emissiveIntensity = value;
  }

  async pressSwitchesUnder(state: GameState) {
    const jobs: Promise<void>[] = [];
    for (const [r, c] of occupiedCells(state)) {
      const button = this.buttons.get(`${r},${c}`);
      if (!button || (button.kind === "heavy" && (state.split || state.orientation !== "STANDING"))) continue;
      jobs.push(tween(180, (t) => {
        button.cap.position.y = button.restY - 0.035 * Math.sin(t * Math.PI);
      }, ease.linear).then(() => { button.cap.position.y = button.restY; }));
    }
    await Promise.all(jobs);
  }

  async victory() {
    const group = this.player.group, y = group.position.y;
    this.player.setSocketClipping(true);
    await tween(520, (t) => { group.position.y = y - 2.05 * t; this.setGoalGlow(0.06 + t * 0.35); });
    group.visible = false;
    this.toy?.setRepaired(true);
    if (this.cable) this.cable.material.emissiveIntensity = 0.15;
    const petals = this.goal?.petals ?? [];
    petals.forEach((petal) => petal.visible = true);
    await tween(650, (t) => {
      petals.forEach((petal, i) => {
        const angle = i * Math.PI / 4;
        const radius = 0.58 + t * 0.45;
        petal.position.set(Math.cos(angle) * radius, 0.2 + Math.sin(t * Math.PI) * 0.5, Math.sin(angle) * radius);
        petal.scale.setScalar(Math.sin(t * Math.PI));
      });
    }, ease.linear);
    petals.forEach((petal) => petal.visible = false);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.keyLight.shadow.dispose();
    disposeTree(this.scene); this.renderer.dispose();
  }
}
