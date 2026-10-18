/** DOM + API thật + geometry; kiểm tra hình ảnh/browser riêng bằng test:browser. */
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { checkGeometry } from "./check-geometry.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = process.env.FRONTEND_TEST_URL ?? "http://127.0.0.1:5173", realFetch = globalThis.fetch, traffic = [];
const health = await realFetch(`${apiBase}/api/health`).catch(() => null);
assert(health?.ok, "Cần backend 8000 và Vite 5173");
const maps = await (await realFetch(`${apiBase}/api/maps`)).json();
const boards = new Map(await Promise.all(maps.map(async (map) => [map.id, await (await realFetch(`${apiBase}/api/maps/${map.id}`)).json()])));
globalThis.fetch = async (url, options) => { traffic.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null }); return realFetch(new URL(url, apiBase), options); };
const dom = new JSDOM(await readFile(resolve(root, "index.html"), "utf8"), { url: apiBase });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, history: dom.window.history, HTMLElement: dom.window.HTMLElement, matchMedia: () => ({ matches: true }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, ResizeObserver: class { observe() {} disconnect() {} } });
Object.defineProperties(dom.window.HTMLCanvasElement.prototype, { clientWidth: { get: () => 1200 }, clientHeight: { get: () => 800 } });
const cache = resolve(root, "node_modules/.cache/workshop-check"); await mkdir(cache, { recursive: true });
const outfile = resolve(cache, "app.mjs");
await build({ stdin: { contents: `export * as THREE from 'three'; export { WorkshopScene } from './src/game/scene'; export { settings } from './src/game/animation'; export { createCamera, fitCamera } from './src/game/camera'; export { readSave, freshSave } from './src/app/progress'; export { GameSession } from './src/app/session'; export { ToyModel } from './src/objects/toys'; import './src/main';`, resolveDir: root, loader: "ts" }, outfile, bundle: true, platform: "node", format: "esm", loader: { ".css": "empty" }, plugins: [{ name: "webgl-stub", setup(builder) { builder.onLoad({ filter: /src[\\/]game[\\/]renderer\.ts$/ }, () => ({ contents: "export function createRenderer(){return {shadowMap:{},setSize(){},render(){},dispose(){}}}", loader: "ts" })); } }] });
const exports = await import(pathToFileURL(outfile).href), $ = (selector) => document.querySelector(selector);
async function until(predicate, label) { const end = Date.now() + 15000; while (!predicate()) { if (Date.now() > end) throw Error(`Timeout: ${label}`); await new Promise((done) => setTimeout(done, 5)); } }
const idle = () => until(() => $("#screen").getAttribute("aria-busy") === "false" && $("#scene-loading").classList.contains("hidden"), "API/animation");
async function click(selector) { assert($(selector), `Có ${selector}`); assert(!$(selector).disabled, `${selector} dùng được`); $(selector).click(); await idle(); }
const key = (value, target = document.body) => target.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: value, bubbles: true }));
const move = async (value) => { key(value); await idle(); };
const closeHelp = async () => { if ($(".help-paper")) await click('.help-paper [data-action=close-modal]'); };
const select = async (id) => click(`[data-action=select-map][data-id="${id}"]`);
async function play(id) { await select(id); await click('[data-action=play-map]'); await closeHelp(); assert.equal(document.body.dataset.screen, "play"); }
async function backToMaps() { key("Escape"); await click('#modal [data-action=maps]'); assert.equal(document.body.dataset.screen, "maps"); }
async function solve(id) { const keys = { UP: "ArrowUp", DOWN: "ArrowDown", LEFT: "ArrowLeft", RIGHT: "ArrowRight", SWITCH_CUBE: " " }; for (const action of boards.get(id).reference_solution) await move(keys[action]); assert.equal(document.body.dataset.screen, "complete"); }


const groups = {robot: ["easy_01", "bridge_01", "heavy_01", "split_01"], "music-box": ["easy_02", "permanent_01"], train: ["medium_01", "toggle_01"], clock: ["fragile_01", "advanced_01"]};
async function openGroup(id) {
  if (document.body.dataset.screen === "maps") await click('[data-action=components]');
  assert.equal(document.body.dataset.screen, "components");
  await click(`[data-action=component][data-id="${id}"]`);
  assert.deepEqual([...document.querySelectorAll('.map-option')].map((el) => el.dataset.id), groups[id]);
}
await until(() => $("#shop-entry") && !$("#shop-entry").disabled, "bootstrap");
await click('#shop-entry'); assert.equal(document.body.dataset.screen, "components");
assert.equal(document.querySelectorAll('.component-option').length, 4);
for (const [id, ids] of Object.entries(groups)) {
  await openGroup(id);
  for (const mapId of ids) {
    await select(mapId); const board=boards.get(mapId);
    assert.equal($('#preview-name').textContent, board.name);
    assert.equal(Number($(`[data-id="${mapId}"] .map-thumbnail`).dataset.cols), board.cols);
    assert.equal($('[data-action=play-map]').disabled, false);
  }
  assert.equal($('[data-id="unsolvable_01"]'), null);
  assert.equal($('[data-id="split_pending_01"]'), null);
  await click('[data-action=components]');
}
console.log('PASS: four original groups and exact map memberships; no automatic start or invented grouping');
await openGroup('robot'); await play('easy_01'); await solve('easy_01');
assert($('[data-action=next]')); await click('[data-action=next]'); await closeHelp();
assert.equal(exports.readSave().lastMapId, 'bridge_01'); await solve('bridge_01');
for (const id of ['heavy_01','split_01']) { await click('[data-action=next]'); await closeHelp(); await solve(id); }
assert.equal($('.result-panel .primary').dataset.action, 'components');
await click('.result-panel .primary');
assert.match($('[data-id="robot"] .component-progress').textContent, /4\/4/);
await openGroup('robot'); assert.equal($('.map-option[aria-pressed=true]').dataset.id, 'split_01');
await select('bridge_01'); await click('[data-action=play-map]'); await closeHelp(); await solve('bridge_01');
await click('[data-action=maps]'); assert.equal($('.map-option[aria-pressed=true]').dataset.id, 'bridge_01');
console.log('PASS: next stays in robot group; final map returns to menu; result/back preserves selection and real progress');
for (const [id, mapId] of [['music-box','easy_02'],['train','medium_01'],['clock','fragile_01']]) {
  await openGroup(id); await play(mapId); await solve(mapId);
  await click('[data-action=next]'); await closeHelp(); await solve(groups[id][1]);
  assert.equal($('.result-panel .primary').dataset.action, 'components'); await click('.result-panel .primary');
  assert.match($(`[data-id="${id}"] .component-progress`).textContent, /2\/2/);
}
await openGroup('train'); await play('medium_01'); await move('ArrowDown');
key('Escape'); const count=traffic.length; key('ArrowRight'); assert.equal(traffic.length,count);
await click('#modal [data-action=help]'); await click('.help-paper [data-action=close-modal]'); assert($('.pause-paper'));
await click('#modal [data-action=settings]'); await click('#modal [data-action=close-modal]'); assert($('.pause-paper'));
await click('#modal [data-action=maps]'); assert.equal($('.map-option[aria-pressed=true]').dataset.id,'medium_01');
assert.equal(document.querySelectorAll('.map-option').length,2);
await click('[data-action=continue]'); await closeHelp(); assert.equal($('#move-count').textContent,'1');
await click('[data-action=restart]'); assert.equal($('#move-count').textContent,'0'); assert.equal($('.help-paper'),null);
await click('[data-action=hint]'); assert(!$('#game-hint').classList.contains('hidden')); await click('[data-action=close-hint]');
await backToMaps(); await click('[data-action=components]'); await openGroup('robot');
assert.equal($('.map-option[aria-pressed=true]').dataset.id,'bridge_01');
console.log('PASS: expanded groups return to menu after the final map; per-group selection, resume, pause/help/settings and hints preserved');
const beforeLab=JSON.stringify(exports.readSave()); await click('[data-action=lab]');
assert.equal(document.querySelectorAll('#lab-level option').length,maps.length);
for(const algo of ['BFS','DFS','UCS','ASTAR']) { await click(`[data-algo=${algo}]`); assert.match($('#solver-status').textContent,/ch\u01b0a/); }
await click('#btn-mock'); assert.match($('#solver-status').textContent,/MOCK/); assert.equal(JSON.stringify(exports.readSave()),beforeLab);
assert($('#lab-level option[value="split_pending_01"]').disabled);
await click('[data-action=maps]'); assert.deepEqual([...document.querySelectorAll('.map-option')].map(el=>el.dataset.id),groups.robot);
console.log('PASS: Lab retains all twelve maps without assigning experimental maps to a component or changing progress');
const geometry=new exports.WorkshopScene($('#stage'));
for(const map of boards.values()) {
  geometry.previewMap(map); geometry.resetMapCamera();
  assert(geometry.workshop); assert.equal(geometry.currentMap.id,map.id);
  assert.equal(geometry.bridges.size,map.bridges.length);
  let instances=0; geometry.environment.traverse(obj=>{if(obj.isInstancedMesh) instances++;}); assert(instances>=3,'repeated studs/holes use instancing');
  const before=geometry.camera.position.clone(); geometry.rotateMapCamera(Math.PI/4); assert(before.distanceTo(geometry.camera.position)>1);
  assert(geometry.workshop.group.visible,'studio remains real geometry while orbiting');
  geometry.topMapCamera(); geometry.resetMapCamera();
  geometry.camera.updateMatrixWorld(true);
  for(const x of [geometry.bounds.min.x,geometry.bounds.max.x]) for(const y of [geometry.bounds.min.y,geometry.bounds.max.y]) for(const z of [geometry.bounds.min.z,geometry.bounds.max.z]) {
    const pt=new exports.THREE.Vector3(x,y,z).project(geometry.camera); assert(Math.abs(pt.x)<=1.001 && Math.abs(pt.y)<=1.001,`${map.id}: fit standing block and tray`);
    const screenY=(1-pt.y)*400, screenX=(pt.x+1)*600;
    assert(screenY>=56-.01 && screenY<=768+.01 && screenX>=20-.01 && screenX<=1180+.01,`${map.id}: board fits camera safe area`);
  }
  const sourceCount=[...map.grid.join('')].filter(tile=>tile!=='.').length;
  assert.equal(geometry.boardRoot.children.filter(object=>object.userData.cell).length,sourceCount);
  assert.equal(geometry.workshop.assembly.getObjectByName('LEGO tray floor').position.y,-.325);
  for (const yaw of [.12,.65,1.25]) {
    geometry.resetMapCamera(); geometry.rotateMapCamera(yaw-geometry.cameraYaw); geometry.orbitMapCamera(0,-1000);
    assert(geometry.workshop.backWall.visible && geometry.workshop.sideWall.visible,'LEGO walls stay visible at every permitted yaw');
    assert(geometry.camera.position.z>geometry.bounds.getCenter(new exports.THREE.Vector3()).z,'camera stays in front of the workshop');
    geometry.scene.updateMatrixWorld(true);
    map.grid.forEach((row,r)=>[...row].forEach((tile,c)=>{
      if(tile==='.') return;
      const target=new exports.THREE.Vector3(c-(map.cols-1)/2,.03,r-(map.rows-1)/2), delta=target.clone().sub(geometry.camera.position);
      const ray=new exports.THREE.Raycaster(geometry.camera.position,delta.clone().normalize(),0,delta.length()-.08);
      const blockers=ray.intersectObject(geometry.environment,true).filter(hit=>{
        for(let object=hit.object;object;object=object.parent) if(!object.visible) return false;
        return true;
      });
      assert.equal(blockers.length,0,`${map.id}: decor must not obscure cell ${r},${c} at yaw ${yaw}`);
    }));
  }
}
geometry.rotateMapCamera(1000); assert.equal(geometry.targetYaw,1.25);
geometry.orbitMapCamera(-100000,100000); assert.equal(geometry.targetYaw,.12); assert.equal(geometry.targetPitch,Math.PI/2-.001);
assert(geometry.workshop.backWall.visible,'drag-to-top keeps the wall present');
geometry.orbitMapCamera(100000,-100000); assert.equal(geometry.targetYaw,1.25); assert.equal(geometry.targetPitch,.65);
geometry.rotateMapCamera(-1000); assert.equal(geometry.targetYaw,.12);
geometry.previewMap(boards.get('easy_01')); geometry.rotateMapCamera(.7); geometry.zoomMapCamera(1.12);
const pose=[geometry.cameraYaw,geometry.cameraPitch,geometry.mapZoom]; geometry.previewMap(boards.get('bridge_01'));
assert.deepEqual([geometry.cameraYaw,geometry.cameraPitch,geometry.mapZoom],pose,'user camera survives map change');
geometry.zoomMapCamera(100); assert.equal(geometry.targetZoom,1.22); geometry.zoomMapCamera(.001); assert.equal(geometry.targetZoom,.82);
geometry.resetMapCamera();
const bridge=boards.get('bridge_01').bridges[0];
const closed=geometry.bridges.get(bridge.id).ghosts[0];
assert(closed.visible && closed.position.y > -.3075 && closed.children.length === 1,'closed bridge marking stays above the LEGO tray floor with an X');
const [r,c]=bridge.cells[0], point=new exports.THREE.Vector3(c-(boards.get('bridge_01').cols-1)/2,0,r-(boards.get('bridge_01').rows-1)/2).project(geometry.camera);
assert.match(geometry.specialAt((point.x+1)*600,(1-point.y)*400),/C\u1ea7u/);
Object.defineProperty(document,'hidden',{configurable:true,value:false}); exports.settings.reducedMotion=false;
const setSize=geometry.renderer.setSize; let bufferResizes=0;
geometry.renderer.setSize=(...args)=>{bufferResizes++;return setSize.apply(geometry.renderer,args);};
const startYaw=geometry.cameraYaw; geometry.rotateMapCamera(.7);
assert.equal(geometry.cameraYaw,startYaw,'orbit starts smoothly'); geometry.last=performance.now()-16; geometry.loop();
assert(geometry.cameraYaw>startYaw && geometry.cameraYaw<geometry.targetYaw,'damping moves partway toward requested angle');
for(let frame=0;frame<100;frame++) {geometry.last=performance.now()-16; geometry.loop();}
const settledYaw=geometry.cameraYaw;
for(let frame=0;frame<10;frame++) {geometry.last=performance.now()-16; geometry.loop();}
assert.equal(geometry.cameraYaw,settledYaw,'camera stays still after settling');
geometry.resetMapCamera();
for(let frame=0;frame<100;frame++) {geometry.last=performance.now()-16; geometry.loop();}
const previousRoom=geometry.workshop, previousPosition=geometry.camera.position.clone();
geometry.previewMap(boards.get('easy_01'));
assert.equal(geometry.workshop,previousRoom); assert(geometry.previewTransition,'framing interpolates without resetting the room');
assert(geometry.camera.position.distanceTo(previousPosition)<.0001,'transition starts from the existing camera');
assert.equal(geometry.boardRoot.position.y,0); assert.equal(geometry.environment.position.y,0,'board and room never bob on map changes');
for(let frame=0;frame<20;frame++) {geometry.last=performance.now()-16; geometry.loop();}
assert.equal(geometry.previewTransition,null);
assert.equal(bufferResizes,0,'camera and framing updates do not resize an unchanged drawing buffer'); geometry.renderer.setSize=setSize;
exports.settings.reducedMotion=true; delete document.hidden;
const studio=geometry.workshop, room=studio.backWall;
const oldInstances=[]; studio.assembly.traverse(obj=>{if(obj.isInstancedMesh){ const info={count:0}; obj.addEventListener('dispose',()=>info.count++);oldInstances.push(info); }});
geometry.previewMap(boards.get('easy_02')); assert(oldInstances.every(info=>info.count===1));
assert.equal(geometry.workshop,studio,'map change keeps the shared workshop'); assert.equal(geometry.workshop.backWall,room);
assert(studio.backWall.visible && studio.sideWall.visible);
const refreshed=structuredClone(boards.get('easy_02')); geometry.previewMap(refreshed);
assert.equal(geometry.currentMap,refreshed,'fresh API data for the same map ID replaces the previous board');
assert.equal(geometry.renderer.shadowMap.autoUpdate,false,'static preview shadows can be cached');
for (const map of boards.values()) {
  const sharedWorkshop=geometry.workshop; geometry.loadMap(map);
  assert.equal(geometry.workshop,sharedWorkshop,'gameplay reuses the same LEGO environment as preview');
  assert.equal(geometry.renderer.shadowMap.autoUpdate,true,'gameplay shadows follow moving blocks');
  geometry.setBlock({row:map.start[0],col:map.start[1],orientation:'STANDING'});
  const assertCompanion = () => {
    geometry.scene.updateMatrixWorld(true);
    for (const item of [geometry.workshop.group,geometry.workshop.backWall,geometry.workshop.sideWall,geometry.mapDecor,geometry.toy.group]) {
      for(let parent=item;parent;parent=parent.parent) assert(parent.visible,`${map.id}: workshop and companion must remain visible`);
    }
    const box=new exports.THREE.Box3().setFromObject(geometry.toy.group);
    for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
      const point=new exports.THREE.Vector3(x,y,z).project(geometry.camera); assert(Math.abs(point.x)<=1.001&&Math.abs(point.y)<=1.001,`${map.id}: companion remains inside frame`);
    }
  };
  for(const [dx,dy] of [[10000,-10000],[-20000,0],[10000,20000]]) {
    geometry.orbitMapCamera(dx,dy); assert(geometry.cameraYaw>=.12&&geometry.cameraYaw<=1.25); assertCompanion();
  }
  geometry.resetPlayer({row:map.start[0],col:map.start[1],orientation:'STANDING'}); assertCompanion();
}
geometry.dispose();
console.log('PASS: shared LEGO preview/gameplay, companion and walls visible/framed through orbit/top/reset on all maps, dynamic shadows, smooth framing and cleanup');
await checkGeometry(exports,$('#stage'),realFetch,apiBase);
const stored=localStorage.getItem('little-repair-shop.save.v1'); localStorage.setItem('little-repair-shop.save.v1','{broken');assert.deepEqual(exports.readSave().completed,{}); localStorage.setItem('little-repair-shop.save.v1',stored);
assert.equal(exports.readSave().lastMapByGroup.robot,'bridge_01'); assert.equal(exports.readSave().lastMapByGroup.train,'medium_01');
console.log('DONE: grouped flow + API + real geometry passed. Browser images are checked separately.');dom.window.close();
