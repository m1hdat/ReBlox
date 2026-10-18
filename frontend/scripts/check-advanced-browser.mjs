/** Edge + API thật: từng map Advanced phải chơi thắng bằng đường đi đã kiểm chứng. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.FRONTEND_TEST_URL ?? 'http://127.0.0.1:5173';
const output = resolve('../artifacts/advanced-review');
await mkdir(output, { recursive: true });
const cases = [['robot','heavy_01'], ['train','toggle_01'], ['music-box','permanent_01'], ['clock','advanced_01'], ['robot','split_01']];
const browser = await chromium.launch({ channel:'msedge', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [name, width, height] of [['desktop',1366,768], ['mobile',320,740]]) {
    const context = await browser.newContext({ viewport:{width,height}, reducedMotion:'reduce', isMobile:width<900, hasTouch:width<900 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(30000);
    const idle = () => page.waitForFunction(() => document.querySelector('#screen')?.getAttribute('aria-busy') === 'false' && document.querySelector('#scene-loading')?.classList.contains('hidden'));
    const click = async selector => { await page.locator(selector).first().click(); await idle(); };
    const help = async () => { if (await page.locator('.help-paper').count()) await click('.help-paper [data-action=close-modal]'); };
    const action = async a => {
      if (width<900) await click(`[data-a="${a}"]`);
      else { await page.locator('#screen').focus(); await page.keyboard.press({UP:'ArrowUp',DOWN:'ArrowDown',LEFT:'ArrowLeft',RIGHT:'ArrowRight',SWITCH_CUBE:'Space'}[a]); await idle(); }
    };
    for (const [group,id] of cases) {
      const map = await (await context.request.get(`${base}/api/maps/${id}`)).json();
      await page.goto(base); await page.waitForFunction(() => !document.querySelector('#shop-entry')?.disabled);
      await click('#shop-entry'); await click(`[data-action=component][data-id="${group}"]`);
      await click(`[data-action=select-map][data-id="${id}"]`); await click('[data-action=play-map]'); await help();
      assert.equal(await page.locator('#switch-cube').isVisible(),false);
      let splitSaved = false;
      for (let i=0;i<map.reference_solution.length;i++) {
        const a=map.reference_solution[i];
        await action(a);
        if (id==='split_01' && i===1) {
          assert(await page.locator('#switch-cube').isVisible());
          assert.equal(await page.locator('#switch-cube').textContent(),'Đổi khối');
          const bounds = await page.locator('#switch-cube').boundingBox();
          assert(bounds.x>=0 && bounds.x+bounds.width<=width && bounds.y+bounds.height<=height);
          assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
          await page.screenshot({path:resolve(output,`${name}-split-two-cubes.png`)});
        }
        if (a==='SWITCH_CUBE' && !splitSaved) {
          splitSaved=true;
          const moves=await page.locator('#move-count').textContent();
          await click('[data-action=pause]'); await click('#modal [data-action=maps]');
          await click('[data-action=continue]'); await help();
          assert.equal(await page.locator('#move-count').textContent(),moves);
          assert(await page.locator('#switch-cube').isVisible());
          await page.screenshot({path:resolve(output,`${name}-split-resumed.png`)});
        }
      }
      await page.locator('.result-panel').waitFor();
      const save=await page.evaluate(() => JSON.parse(localStorage.getItem('little-repair-shop.save.v1')));
      assert.equal(save.completed[id].bestMoves,map.reference_solution.length);
      assert.equal(await page.locator('canvas').count(),1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:resolve(output,`${name}-${id}-won.png`)});
      results.push({viewport:name,map:id,actions:map.reference_solution.length,won:true,splitResume:splitSaved});
      console.log(`PASS ${name}: ${id}, ${map.reference_solution.length} actions, won${splitSaved?', split saved/resumed':''}`);
    }
    assert.deepEqual(errors,[]);
    await context.close();
  }
  await writeFile(resolve(output,'checks.json'),JSON.stringify(results,null,2));
} finally { await browser.close(); }
