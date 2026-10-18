import { TOYS, type ToyId } from "../app/catalog";
import type { SaveData } from "../app/progress";
import { icon } from "../ui/icons";
import { componentArt } from "../ui/component-art";
export function componentsScreen(save: SaveData, selected: ToyId) {
  return `<section class="components-screen"><header class="screen-top"><button class="back-button" data-action="home">${icon("back", 20)} Cửa tiệm</button><h1>Linh kiện</h1><button class="icon-button" data-action="settings" aria-label="Cài đặt" title="Cài đặt">${icon("gear", 22)}</button></header><div id="scene-slot" class="components-stage" aria-label="Quầy linh kiện 3D trong xưởng"></div><div class="component-menu" role="group" aria-label="Chọn nhóm linh kiện">${TOYS.map((toy) => {
    const done = toy.maps.filter((id) => save.completed[id]).length;
    return `<button class="component-option" data-action="component" data-id="${toy.id}" aria-label="${toy.name}, ${done}/${toy.maps.length} map hoàn thành" ${toy.id === selected ? 'aria-current="true"' : ""}>${componentArt(toy.id)}<span><strong>${toy.name}</strong><span class="component-part">${toy.part}</span><span class="component-progress">${done}/${toy.maps.length} map hoàn thành</span></span>${icon("arrow", 18)}</button>`;
  }).join("")}</div><footer class="components-footer"><span>Chọn một nhóm để xem các map.</span><button class="text-button" data-action="lab">${icon("book", 21)} Sổ kỹ thuật</button></footer></section>`;
}
