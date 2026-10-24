/** Real browser + API: solver metrics, replay, split and unchanged manual progress. */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.FRONTEND_TEST_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "msedge", headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1366, height: 768 } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  const idle = () => page.waitForFunction(() =>
    document.querySelector("#screen")?.getAttribute("aria-busy") === "false" &&
    document.querySelector("#scene-loading")?.classList.contains("hidden"));
  await page.goto(base);
  await page.locator("#shop-entry").click(); await idle();
  await page.locator('[data-action="component"][data-id="robot"]').click(); await idle();
  await page.locator('[data-action="lab"]').click(); await idle();
  const save = () => page.evaluate(() => localStorage.getItem("little-repair-shop.save.v1"));
  const before = await save();
  let checked = 0;
  for (const cost of ["uniform", "orientation_weighted"]) {
    for (const map of ["easy_01", "advanced_01", "split_01", "unsolvable_01"]) {
      await page.locator("#lab-level").selectOption(map); await idle();
      await page.locator("#cost-model").selectOption(cost);
      for (const algorithm of ["BFS", "DFS", "UCS", "ASTAR"]) {
        const response = page.waitForResponse(r => r.url().endsWith("/api/solve") && r.request().method() === "POST");
        await page.locator(`[data-algo="${algorithm}"]`).click();
        const payload = await (await response).json();
        await idle();
        const solved = map !== "unsolvable_01";
        assert.equal(payload.status, solved ? "solved" : "unsolved");
        assert.equal(payload.mock, false);
        assert.equal(payload.result.replay_valid, solved);
        assert.equal(await page.locator("#solver-status").textContent(), solved
          ? "Đã phát xong đường đi của solver." : `Không tìm thấy nghiệm. ${payload.result.note ?? ""}`);
        assert.match(await page.locator("#solver-metrics").textContent(), new RegExp(`${algorithm} · ${cost}`));
        assert.equal(await save(), before);
        checked++;
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${checked} real solver runs; metrics, replay (including split), unsolvable results and manual progress verified in Edge.`);
} finally {
  await browser.close();
}
