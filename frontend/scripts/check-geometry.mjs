import assert from 'node:assert/strict';
export async function checkGeometry({ THREE, WorkshopScene, settings, createCamera, fitCamera }, canvas, originalFetch, apiBase) {
const $ = () => canvas;
// Chạy geometry thật; chỉ WebGLRenderer được thay bằng stub ở bước bundle.
const scene = new WorkshopScene($("#stage"));
const fragileMap = await (await originalFetch(`${apiBase}/api/maps/fragile_01`)).json();
scene.loadMap(fragileMap);
scene.rotateMapCamera(.4);
assert(scene.mapDecor.visible && scene.toy.group.visible,'gameplay camera must keep the backdrop and companion visible');
scene.resetMapCamera();
const transitions = [
  ["STANDING", "UP", 3, 5, "VERTICAL"], ["STANDING", "DOWN", 6, 5, "VERTICAL"],
  ["STANDING", "LEFT", 5, 3, "HORIZONTAL"], ["STANDING", "RIGHT", 5, 6, "HORIZONTAL"],
  ["HORIZONTAL", "UP", 4, 5, "HORIZONTAL"], ["HORIZONTAL", "DOWN", 6, 5, "HORIZONTAL"],
  ["HORIZONTAL", "LEFT", 5, 4, "STANDING"], ["HORIZONTAL", "RIGHT", 5, 7, "STANDING"],
  ["VERTICAL", "UP", 4, 5, "STANDING"], ["VERTICAL", "DOWN", 7, 5, "STANDING"],
  ["VERTICAL", "LEFT", 5, 4, "VERTICAL"], ["VERTICAL", "RIGHT", 5, 6, "VERTICAL"],
];
for (const [orientation, action, row, col, nextOrientation] of transitions) {
  const from = { row: 5, col: 5, orientation };
  const to = { row, col, orientation: nextOrientation };
  scene.setBlock(from);
  const group = scene.player.group;
  const previous = group.quaternion.clone();
  await scene.roll(from, action, to);
  const axis = new THREE.Vector3(action === "UP" || action === "DOWN" ? 1 : 0, 0, action === "LEFT" || action === "RIGHT" ? 1 : 0);
  const angle = action === "UP" || action === "RIGHT" ? -Math.PI / 2 : Math.PI / 2;
  const expected = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(previous);
  assert(Math.abs(group.quaternion.dot(expected)) > 1 - 1e-8, `${orientation}/${action}: xoay rigid body`);
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  const dimensions = nextOrientation === "STANDING" ? [1, 2, 1] : nextOrientation === "HORIZONTAL" ? [2, 1, 1] : [1, 1, 2];
  [size.x, size.y, size.z].forEach((value, i) => assert(Math.abs(value - dimensions[i]) < 0.065, `${orientation}/${action}: kích thước mesh`));
  assert(Math.abs(group.position.x - (col + (nextOrientation === "HORIZONTAL" ? 0.5 : 0))) < 1e-8);
  assert(Math.abs(group.position.z - (row + (nextOrientation === "VERTICAL" ? 0.5 : 0))) < 1e-8);
  assert(Math.abs(group.position.y - (nextOrientation === "STANDING" ? 1 : 0.5)) < 1e-8);
}
console.log("PASS: 12 phép lăn, quaternion liên tục, kích thước và tâm mesh khớp state");

// Đồng hồ RAF xác định để kiểm tra cả đường chuyển động, không chỉ reduced-motion.
const savedPerformance = Object.getOwnPropertyDescriptor(globalThis, "performance");
let animationTime = 0;
const samples = [];
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => animationTime } });
globalThis.requestAnimationFrame = (callback) => {
  queueMicrotask(() => {
    animationTime += 1000 / 60; callback(animationTime);
    samples.push(scene.player.group.getWorldPosition(new THREE.Vector3()));
  });
  return 0;
};
settings.reducedMotion = false;
settings.speed = 1;
scene.setBlock({ row: 0, col: 0, orientation: "STANDING" });
await scene.roll({ row: 0, col: 0, orientation: "STANDING" }, "RIGHT", { row: 0, col: 1, orientation: "HORIZONTAL" });
assert(samples.length >= 18, "lăn phải đi qua nhiều frame");
assert(samples.every((point) => point.y >= 0.48), "khối không xuyên mặt bàn khi lăn");
assert(samples.slice(1).every((point, i) => point.x >= samples[i].x - 1e-8), "không giật lùi theo trục lăn");
assert(animationTime >= 340 && animationTime < 390, "lăn + đáp khoảng 340ms ở tốc độ 1×");
settings.reducedMotion = true;
globalThis.requestAnimationFrame = () => 0;
Object.defineProperty(globalThis, "performance", savedPerformance);
console.log("PASS: animation nhiều frame, không xuyên sàn/giật lùi, lăn + đáp khoảng 340ms");

const broken = scene.fragile.get("1,4");
await scene.fall({ row: 1, col: 4, orientation: "HORIZONTAL" });
assert.equal(broken.group.visible, true, "nằm trên fragile không làm vỡ tile");
await scene.fall({ row: 1, col: 4, orientation: "STANDING" });
assert.equal(broken.group.visible, false);
scene.resetPlayer({ row: 0, col: 0, orientation: "STANDING" });
assert.equal(broken.group.visible, true);
assert(broken.shards.every((shard) => shard.position.y === 0));
console.log("PASS: fragile chỉ vỡ khi attempted đứng; reset phục hồi đủ mesh");

const bridgeMap = await (await originalFetch(`${apiBase}/api/maps/bridge_01`)).json();
const reusedBody = scene.player.group.children[0];
scene.loadMap(bridgeMap); assert.equal(scene.player.group.children[0], reusedBody, "không tạo lại mesh player khi đổi map");
await scene.setBridges([], false);
assert(scene.bridges.get("bridge_a").planks.every((plank) => !plank.visible));
await scene.setBridges(["bridge_a"]);
assert(scene.bridges.get("bridge_a").planks.every((plank) => plank.visible && plank.position.y === 0 && plank.scale.x === 1));
await scene.setBridges([]);
assert(scene.bridges.get("bridge_a").planks.every((plank) => !plank.visible));
await scene.victory(); assert.equal(scene.player.group.visible, false);
assert(scene.player.materials.every((material) => material.clippingPlanes.length === 1));
scene.resetPlayer({ row: 0, col: 0, orientation: "STANDING" });
assert.equal(scene.player.group.visible, true);
assert(scene.player.materials.every((material) => material.clippingPlanes.length === 0));
console.log("PASS: cầu mở/thu, goal nuốt khối bằng clipping, restart khôi phục player");

for (const [width, height] of [[1400, 700], [600, 600], [320, 260], [250, 700]]) {
  const camera = createCamera(); fitCamera(camera, width, height, scene.bounds);
  for (const x of [scene.bounds.min.x, scene.bounds.max.x]) {
    for (const y of [scene.bounds.min.y, scene.bounds.max.y]) {
      for (const z of [scene.bounds.min.z, scene.bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        assert(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1, `${width}×${height}: toàn đế phải trong khung`);
      }
    }
  }
}
assert.equal(settings.reducedMotion, true);
console.log("PASS: camera fit desktop/vuông/mobile/dọc; reduced motion vẫn đạt trạng thái cuối");

scene.loadMap({ ...bridgeMap, rows: 1, cols: 4, grid: ["sh#G"], start: [0, 0], goal: [0, 3],
  bridges: [], switches: [{ pos: [0, 0], kind: "soft", targets: [], effect: "open" },
    { pos: [0, 1], kind: "heavy", targets: [], effect: "open" }] });
const heavy = scene.buttons.get("0,1");
let heavyY = heavy.cap.position.y, heavyWrites = 0;
Object.defineProperty(heavy.cap.position, "y", {
  get: () => heavyY, set: (value) => { heavyY = value; heavyWrites++; }, configurable: true,
});
await scene.pressSwitchesUnder({ row: 0, col: 0, orientation: "HORIZONTAL" });
assert.equal(heavyWrites, 0, "heavy không lún khi khối nằm");
await scene.pressSwitchesUnder({ row: 0, col: 1, orientation: "STANDING" });
assert(heavyWrites > 0); assert.equal(heavyY, heavy.restY);
const disposed = new Set(), oldResources = new Set();
const watchResources = (object) => {
  for (const resource of [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material])]) {
    if (!resource || oldResources.has(resource)) continue;
    oldResources.add(resource); resource.addEventListener("dispose", () => disposed.add(resource));
  }
};
scene.boardRoot.children.filter((child) => child !== scene.player.group)
  .forEach((child) => child.traverse(watchResources));
scene.environment.traverse(watchResources);
scene.loadMap(bridgeMap);
assert(oldResources.size > 0); assert.equal(disposed.size, oldResources.size);
assert.equal(scene.player.group.children[0], reusedBody);
console.log("PASS: heavy chỉ diễn hoạt khi đứng; đổi map dispose toàn bộ tài nguyên cũ và giữ player");

scene.dispose();
}
