import type { ScreenContext } from "./types";
import { icon } from "../ui/icons";
export function homeScreen(context: ScreenContext) {
  return `<section class="home-screen storefront-home" aria-label="Mặt tiền tiệm sửa đồ chơi">
    <h1 id="shop-title" class="facade-title"><span>Little</span> <span>Repair Shop</span></h1>
    <span id="shop-open" class="shop-open-tag" aria-hidden="true">Mở cửa</span>
    <button id="shop-entry" class="button primary shop-entry" data-action="components" ${!context.ready ? "disabled" : ""}>Vào xưởng ${icon("arrow", 18)}</button>
    <button class="icon-button storefront-settings" data-action="settings" aria-label="Cài đặt">${icon("gear", 21)}</button>
  </section>`;
}
