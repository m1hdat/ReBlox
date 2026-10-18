/** Preview CPU giản lược để kiểm tra bố cục mesh. Không phải screenshot WebGL hay kiểm tra CSS. */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { Resvg } from "@resvg/resvg-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), width = 1200, height = 800;
const dom = new JSDOM('<canvas></canvas>');
Object.assign(globalThis, { document: dom.window.document, window: dom.window, matchMedia: () => ({ matches: true }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, ResizeObserver: class { observe(){} disconnect(){} } });
Object.defineProperties(dom.window.HTMLCanvasElement.prototype, { clientWidth: { get: () => width }, clientHeight: { get: () => height } });
const cache = resolve(root, "node_modules/.cache/preview"); await mkdir(cache, { recursive: true });
const file = resolve(cache, "scene.mjs");
await build({ stdin: { contents: `export * as THREE from 'three'; export { WorkshopScene } from './src/game/scene'; export { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';`, resolveDir: root }, outfile: file, platform: "node", format: "esm", bundle: true,
 plugins: [{ name: "no-webgl", setup(builder) { builder.onLoad({filter:/src[\\/]game[\\/]renderer\.ts$/},()=>({contents:'export function createRenderer(){return {setSize(){},render(){},dispose(){}}}',loader:'ts'})); } }] });
const { THREE, WorkshopScene, SVGRenderer } = await import(pathToFileURL(file).href);
const world = new WorkshopScene(document.querySelector('canvas'));
const mode = process.argv[2] ?? "home";
if (mode === "game") { const map = JSON.parse(await readFile(resolve(root, '../maps/easy_01.json'), 'utf8')); world.loadMap(map); world.setBlock({row:0,col:0,orientation:'STANDING'}); }
else if (mode === "collection") world.showCounter(); else world.showStorefront();
const scene = world.scene.clone(true), remove = [], instances = [];
scene.traverse((object) => { if (object.isLight) remove.push(object); if (object.isInstancedMesh) instances.push(object); });
remove.forEach((object) => object.removeFromParent());
scene.add(new THREE.AmbientLight(0xffffff, .65)); const light = new THREE.DirectionalLight(0xfff1d8, .8); light.position.set(-5,12,7); scene.add(light);
for (const instance of instances) {
 const group = new THREE.Group(); group.position.copy(instance.position); group.quaternion.copy(instance.quaternion); group.scale.copy(instance.scale);
 for(let i=0;i<instance.count;i++){const mesh=new THREE.Mesh(instance.geometry,instance.material);instance.getMatrixAt(i,mesh.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);group.add(mesh);}
 instance.parent.add(group); instance.removeFromParent();
}
// Bỏ bevel trong preview để SVGRenderer không tạo hàng chục nghìn path. Bản WebGL giữ nguyên.
scene.traverse((object) => {
 if (object.isMesh && object.geometry.type === 'BoxGeometry' && object.geometry.attributes.position.count > 36) {
   object.geometry.computeBoundingBox(); const size=object.geometry.boundingBox.getSize(new THREE.Vector3()); object.geometry=new THREE.BoxGeometry(size.x,size.y,size.z);
 }
});
const renderer = new SVGRenderer(); renderer.setSize(width,height); renderer.setPrecision(2); renderer.render(scene,world.camera);
renderer.domElement.setAttribute('xmlns','http://www.w3.org/2000/svg');
const output=resolve(root,'../artifacts');await mkdir(output,{recursive:true});
await writeFile(resolve(output,`workshop-${mode}-preview.png`),new Resvg(renderer.domElement.outerHTML,{background:'#bcb6a0'}).render().asPng());
console.log(`Saved workshop-${mode}-preview.png (CPU proxy geometry only)`);world.dispose();dom.window.close();
