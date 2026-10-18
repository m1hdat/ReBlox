import type { MapInfo } from "../api/client";
export type ToyId = "robot" | "music-box" | "train" | "clock";
export interface Toy { id: ToyId; name: string; nickname: string; story: string; color: string; maps: string[]; part: string; customer: string; request: string; }
export const TOYS: Toy[] = [
  { id: "robot", name: "Robot Bíp", nickname: "Robot nhỏ", story: "Kiểm tra viên pin và nối lại mạch khởi động cho Bíp.", color: "teal", maps: ["easy_01", "bridge_01"], part: "Viên pin & mạch khởi động", customer: "An", request: "Bíp không bật lên nữa. Bạn kiểm tra giúp mình nhé." },
  { id: "music-box", name: "Hộp nhạc", nickname: "Hộp nhạc lên dây cót", story: "Lắp lại chốt để dây cót truyền lực đến hộp nhạc.", color: "coral", maps: ["easy_02"], part: "Chốt lên dây cót", customer: "Mai", request: "Vặn dây cót rồi mà vẫn không nghe tiếng." },
  { id: "train", name: "Tàu gỗ", nickname: "Đầu tàu gỗ", story: "Kiểm tra khớp truyền động để bánh xe quay trở lại.", color: "blue", maps: ["medium_01"], part: "Khớp truyền động", customer: "Nam", request: "Một bánh xe bị kẹt." },
  { id: "clock", name: "Đồng hồ", nickname: "Đồng hồ để bàn", story: "Lắp lại bánh răng nhịp. Chú ý các phiến mỏng khi đưa linh kiện qua.", color: "yellow", maps: ["fragile_01"], part: "Bánh răng nhịp", customer: "Cô Tâm", request: "Đồng hồ cứ chạy được một lúc rồi dừng." },
];
export const toyById = (id: string) => TOYS.find((toy) => toy.id === id) ?? TOYS[0];
export const toyForMap = (id: string) => TOYS.find((toy) => toy.maps.includes(id)) ?? TOYS[0];
/** Quan hệ nhóm gốc. Không dùng fallback của art để gán map thử nghiệm vào robot. */
export const groupForMap = (id: string) => TOYS.find((toy) => toy.maps.includes(id));
export const mapsForGroup = (id: ToyId, maps: MapInfo[]) => toyById(id).maps.flatMap((mapId) => maps.filter((map) => map.id === mapId));
export const nextGroupMap = (id: string, maps: MapInfo[]) => {
  const group = groupForMap(id); if (!group) return null;
  return group.maps.slice(group.maps.indexOf(id) + 1).find((mapId) => maps.some((map) => map.id === mapId && map.playable)) ?? null;
};
export function missionTitle(id: string, fallback = id) {
  return ({ easy_01: "Một viên pin cho Bíp", bridge_01: "Nối lại mạch khởi động", easy_02: "Giai điệu bị thất lạc", medium_01: "Chuyến tàu đầu tiên", fragile_01: "Đánh thức kim đồng hồ" } as Record<string, string>)[id] ?? fallback;
}
export const difficultyLabel = (map?: MapInfo) => map?.difficulty === "easy" ? "Nhẹ nhàng" : "Cần một chút khéo léo";
