/** Edge thật: menu gốc, preview LEGO 3 góc, camera, viewport và kết quả theo nhóm. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
const baseURL = process.env.FRONTEND_TEST_URL ?? "http://127.0.0.1:5173";
const output = resolve("../artifacts/lego-gameplay-review"); await mkdir(output, { recursive: true });
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
const interactionOnly = process.argv.includes('--interaction-only');
const groups = { robot: ["easy_01", "bridge_01", "heavy_01", "split_01"], "music-box": ["easy_02", "permanent_01"], train: ["medium_01", "toggle_01"], clock: ["fragile_01", "advanced_01"] };
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = [];
try {
  for (const [name, width, height] of [["desktop", 1366, 768], ["large-desktop", 1920, 1080], ["mobile", 390, 844], ["landscape", 844, 390], ["small-mobile", 320, 740]]) {
    if (interactionOnly && name !== 'desktop') continue;
    if (only && !only.includes(name)) continue;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: interactionOnly ? 'no-preference' : "reduce", isMobile: width <= 900, hasTouch: width <= 900 });
    const page = await context.newPage(), errors = [], steps = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.url().endsWith("/api/game/step")) steps.push(request.postDataJSON()); });
    page.setDefaultTimeout(25000);
    const idle = () => page.waitForFunction(() => document.querySelector("#screen").getAttribute("aria-busy") === "false" && document.querySelector("#scene-loading").classList.contains("hidden"));
    const click = async (selector) => { await page.locator(selector).first().click(); await idle(); };
    const closeHelp = async () => { if (await page.locator(".help-paper").count()) await click('.help-paper [data-action=close-modal]'); };
    const screenshot = async (label) => page.screenshot({ path: resolve(output, `${name}-${label}.png`), fullPage: true });
    const previewShot = async (label) => { await page.locator('#scene-slot').scrollIntoViewIfNeeded(); await page.locator('#scene-slot').screenshot({ path: resolve(output, `${name}-${label}.png`) }); };
    const select = async (id) => click(`[data-action=select-map][data-id="${id}"]`);
    const menu = async () => { const view = await page.locator('body').getAttribute('data-screen'); if (view === 'play') { await click('[data-action=pause]'); await click('#modal [data-action=maps]'); } if (await page.locator('body').getAttribute('data-screen') === 'maps') await click('[data-action=components]'); };
    const openGroup = async (id) => { await menu(); await click(`[data-action=component][data-id="${id}"]`); assert.deepEqual(await page.locator('.map-option').evaluateAll((els) => els.map((el) => el.dataset.id)), groups[id]); };
    const play = async () => { await click('[data-action=play-map]'); await closeHelp(); };
    const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('little-repair-shop.save.v1')));
    const solve = async (id) => { const map = await (await context.request.get(`${baseURL}/api/maps/${id}`)).json(), keys = { UP:'ArrowUp', DOWN:'ArrowDown', LEFT:'ArrowLeft', RIGHT:'ArrowRight', SWITCH_CUBE:' ' }; for (const action of map.reference_solution) { await page.locator('#screen').focus(); await page.keyboard.press(keys[action]); await idle(); } await page.locator('.result-panel').waitFor(); };
    await page.goto(baseURL); await page.waitForFunction(() => !document.querySelector('#shop-entry').disabled);
    await click('#shop-entry'); assert.equal(await page.locator('body').getAttribute('data-screen'),'components'); assert.equal(await page.locator('.component-option').count(),4);
    await screenshot('component-menu'); await openGroup('train');
    assert.equal(await page.locator('.map-option').count(),2);
    const layout = await page.evaluate(() => {
      const canvas=document.querySelector('canvas').getBoundingClientRect(), library=document.querySelector('.map-library').getBoundingClientRect(), play=document.querySelector('[data-action=play-map]').getBoundingClientRect();
      const toolbar=document.querySelector('.preview-toolbar').getBoundingClientRect(), header=document.querySelector('.preview-header').getBoundingClientRect();
      return { canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height,bottom:canvas.bottom}, library:{x:library.x,width:library.width}, play:{top:play.top,bottom:play.bottom}, toolbar:{left:toolbar.left,right:toolbar.right,top:toolbar.top,bottom:toolbar.bottom}, headerHeight:header.height, scrollWidth:document.documentElement.scrollWidth, viewport:innerWidth, pixelRatio:document.querySelector('canvas').width/canvas.width };
    });
    assert(layout.scrollWidth<=width+1, `${name}: no horizontal UI overflow`); assert(layout.pixelRatio<=1.61);
    assert(layout.toolbar.left>=layout.canvas.x && layout.toolbar.right<=width,`${name}: compact camera toolbar fits viewport`);
    assert(layout.canvas.bottom<=layout.play.top,`${name}: play action has its own space below the 3D viewport`);
    assert.equal(await page.locator('[data-action=camera-reset]').getAttribute('aria-label'),'To\u00e0n b\u1ed9 map');
    if(width>900) assert(layout.canvas.x>=layout.library.x+layout.library.width-1); else assert(layout.play.top>=0 && layout.play.bottom<=height+1);
    if(interactionOnly) {
      await page.waitForTimeout(250); await previewShot('front-default');
      const x=layout.canvas.x+layout.canvas.width/2, y=layout.canvas.y+layout.canvas.height/2;
      await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+2,y+1); await page.mouse.up();
      assert.equal(await page.locator('[data-action=camera-reset]').getAttribute('aria-pressed'),'true','click jitter does not orbit');
      await page.mouse.move(x,y); await page.mouse.down();
      // Deliver one-pixel steps synchronously to catch a per-event threshold bug.
      await page.evaluate(({x,y})=>{ const canvas=document.querySelector('canvas'); for(let step=1;step<=12;step++) canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x+step,clientY:y,bubbles:true})); },{x,y});
      await page.mouse.up();
      assert.equal(await page.locator('[data-action=camera-reset]').getAttribute('aria-pressed'),'false','a slow cumulative drag orbits');
      await page.waitForTimeout(350); await previewShot('slow-drag');
      assert.equal(await page.locator('body').getAttribute('data-screen'),'maps'); assert.equal(steps.length,0);
      await click('[data-action=camera-reset]'); await page.waitForTimeout(650);
      const drag = async (dx,dy) => {
        await page.mouse.move(x,y); await page.mouse.down();
        await page.evaluate(({x,y,dx,dy})=>{const canvas=document.querySelector('canvas');for(let step=1;step<=20;step++)canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x+dx*step/20,clientY:y+dy*step/20,bubbles:true}));},{x,y,dx,dy});
        await page.mouse.up(); await page.waitForTimeout(650);
      };
      await drag(2000,0); await previewShot('front-right-limit');
      await drag(-4000,0); await previewShot('front-left-limit');
      await drag(0,1000); assert.equal(await page.locator('[data-action=camera-top]').getAttribute('aria-pressed'),'true'); await previewShot('drag-to-top');
      assert.equal(steps.length,0); await click('[data-action=camera-reset]'); await page.waitForTimeout(650);
      await openGroup('robot'); await select('bridge_01');
      assert.equal(await page.locator('canvas').count(),1); assert.equal(steps.length,0); assert.equal((await save()).checkpoint,null);
      await select('easy_01'); await previewShot('robot-map-preview'); await play();
      await previewShot('robot-game-default');
      await click('[data-action=camera-right]'); await page.waitForTimeout(650); await previewShot('robot-game-rotated');
      await click('[data-action=camera-top]'); await page.waitForTimeout(650); await previewShot('robot-game-top');
      await click('[data-action=camera-reset]'); await page.waitForTimeout(650);
      const robotMap=await (await context.request.get(`${baseURL}/api/maps/easy_01`)).json();
      const direction={UP:'ArrowUp',DOWN:'ArrowDown',LEFT:'ArrowLeft',RIGHT:'ArrowRight'}[robotMap.reference_solution[0]];
      await page.locator('#screen').focus(); await page.keyboard.press(direction); await idle();
      assert.equal(await page.locator('#move-count').textContent(),'1'); assert.equal(steps.length,1); await previewShot('robot-game-after-move');
      await click('[data-action=restart]'); assert.equal(await page.locator('#move-count').textContent(),'0'); await previewShot('robot-game-restarted');
      assert.deepEqual(errors,[]);
      await writeFile(resolve(output,'interaction-checks.json'),JSON.stringify({slowDrag:true,clickJitter:true,frontLimits:true,dragToTop:true,legoGameplay:true,robotPersistsAfterOrbitAndMove:true,restart:true,reducedMotion:false,singleCanvas:true,gameSteps:steps.length,errors},null,2));
      await context.close(); console.log('PASS focused pointer/camera: slow drag, front limits, drag-to-top, reduced motion off, smooth map switch, LEGO gameplay, robot after camera/move/restart'); continue;
    }
    await screenshot('map-selection');
    await previewShot('preview-three-quarter');
    const beforeOrbit=steps.length; await click('[data-action=camera-right]'); await click('[data-action=camera-right]'); await previewShot('preview-front-right');
    await click('[data-action=camera-top]'); assert.equal(await page.locator('[data-action=camera-top]').getAttribute('aria-pressed'),'true'); await previewShot('preview-top');
    assert.equal(steps.length,beforeOrbit,'camera does not create moves');
    await click('[data-action=camera-zoom-in]'); await click('[data-action=camera-zoom-out]'); await click('[data-action=camera-reset]');
    if(name==='desktop') {
      await page.setViewportSize({width:1024,height:720}); await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); await screenshot('resized-preview');
      await page.setViewportSize({width,height}); await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    }
    await openGroup('clock'); await click('[data-action=camera-reset]'); await previewShot('wide-default');
    await click('[data-action=camera-right]'); await click('[data-action=camera-right]'); await previewShot('wide-front-right');
    await click('[data-action=camera-top]'); await previewShot('wide-top');
    await openGroup('robot'); assert.equal(await page.locator('.map-option').count(),4);
    await click('[data-action=camera-top]'); await select('bridge_01'); assert.equal(await page.locator('[data-action=camera-top]').getAttribute('aria-pressed'),'true','map change preserves user camera');
    await previewShot('closed-bridge-top'); await click('[data-action=camera-reset]');
    await previewShot('closed-bridge-default'); await click('[data-action=camera-right]'); await click('[data-action=camera-right]'); await previewShot('closed-bridge-front-right');
    // Existing free-play rule is retained: bridge is available before easy is complete.
    assert(await page.locator('[data-action=play-map]').isEnabled());
    await openGroup('train'); await play();
    const game=await page.evaluate(() => {
      const rect=(s)=>{const r=document.querySelector(s).getBoundingClientRect();return {y:r.y,bottom:r.bottom,width:r.width,height:r.height};};
      return {pageHeight:document.documentElement.scrollHeight,pageWidth:document.documentElement.scrollWidth,header:rect('.game-hud'),canvas:rect('canvas'),controls:rect('.game-bottom'),dpad:rect('#dpad')};
    });
    assert(game.pageHeight<=height+1 && game.pageWidth<=width+1,`${name}: gameplay fits viewport`); assert(game.controls.bottom<=height+1); assert(game.canvas.height>100);
    if(width>900) {assert(game.header.height<=76); assert.equal(game.dpad.height,0);} else assert(game.dpad.height>=88);
    await screenshot('gameplay'); await click('[data-action=hint]'); assert(await page.locator('#game-hint').isVisible()); await click('[data-action=close-hint]');
    await page.locator('#screen').focus(); await page.keyboard.press('ArrowDown'); await idle(); assert.equal(await page.locator('#move-count').textContent(),'1');
    await click('[data-action=pause]'); await click('#modal [data-action=settings]'); await click('#modal [data-action=close-modal]'); assert(await page.locator('.pause-paper').isVisible());
    await click('#modal [data-action=maps]'); assert.equal(await page.locator('.map-option[aria-pressed=true]').getAttribute('data-id'),'medium_01');
    await click('[data-action=continue]'); await closeHelp(); assert.equal(await page.locator('#move-count').textContent(),'1'); await click('[data-action=restart]'); assert.equal(await page.locator('.help-paper').count(),0);
    await solve('medium_01'); await click('[data-action=next]'); await closeHelp(); await solve('toggle_01'); assert.equal(await page.locator('.result-panel .primary').getAttribute('data-action'),'components'); await screenshot('result');
    await click('.result-panel .primary'); assert.match(await page.locator('[data-id=train] .component-progress').textContent(),/2\/2/);
    await openGroup('robot'); await select('easy_01'); await previewShot('robot-map-preview'); await play();
    await previewShot('robot-game-default'); await click('[data-action=camera-right]'); await previewShot('robot-game-rotated');
    await click('[data-action=camera-top]'); await previewShot('robot-game-top'); await click('[data-action=camera-reset]');
    const robotBoard=await (await context.request.get(`${baseURL}/api/maps/easy_01`)).json();
    await page.locator('#screen').focus(); await page.keyboard.press({UP:'ArrowUp',DOWN:'ArrowDown',LEFT:'ArrowLeft',RIGHT:'ArrowRight'}[robotBoard.reference_solution[0]]); await idle();
    assert.equal(await page.locator('#move-count').textContent(),'1'); await previewShot('robot-game-after-move');
    await click('[data-action=restart]'); await solve('easy_01');
    assert.equal(await page.locator('.result-panel .primary').getAttribute('data-action'),'next'); await click('[data-action=next]'); await closeHelp();
    assert.equal((await save()).lastMapId,'bridge_01'); await menu(); await openGroup('robot'); assert.equal(await page.locator('.map-option[aria-pressed=true]').getAttribute('data-id'),'bridge_01');
    await page.reload(); await page.waitForFunction(()=>!document.querySelector('#shop-entry').disabled); await click('#shop-entry'); await openGroup('robot'); assert.equal(await page.locator('.map-option[aria-pressed=true]').getAttribute('data-id'),'bridge_01');
    const badText=await page.evaluate(()=>[...document.querySelectorAll('h1,h2,.map-option strong,.component-option strong,.map-play-actions button')].filter(el=>el.getBoundingClientRect().width>0&&el.scrollWidth>el.clientWidth+2).map(el=>el.textContent)); assert.deepEqual(badText,[]);
    assert.deepEqual(errors,[]);
    results.push({name,width,height,layout,game,errors});
    await writeFile(resolve(output,only ? `checks-${results.map(result=>result.name).join('-')}.json`:'checks.json'),JSON.stringify(results,null,2));
    await context.close(); console.log(`PASS ${name} ${width}x${height}: original groups, three real views, orbit/zoom, grouped next/results, progress/resume, viewport`);
  }
} finally { await browser.close(); }
