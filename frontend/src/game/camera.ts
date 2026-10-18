import * as THREE from "three";

/** Góc 3/4 cố định; tọa độ lưới vẫn là x=col, z=row. */
export function createCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  cam.position.set(12, 15, 12);
  cam.lookAt(0, 0, 0);
  return cam;
}

export interface CameraInsets { top: number; right: number; bottom: number; left: number; }
/** Fit into the usable canvas area; preview controls reserve pixels without covering the board. */
export function fitCamera(cam: THREE.OrthographicCamera, w: number, h: number, bounds: THREE.Box3, insets: CameraInsets = { top: 0, right: 0, bottom: 0, left: 0 }) {
  cam.updateMatrixWorld(true);
  const projected = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse));
      }
    }
  }
  const usableWidth = Math.max(1, w - insets.left - insets.right), usableHeight = Math.max(1, h - insets.top - insets.bottom);
  const aspect = usableWidth / usableHeight;
  const center = projected.getCenter(new THREE.Vector3());
  const size = projected.getSize(new THREE.Vector3());
  const half = Math.max(size.y / 2, size.x / (2 * aspect)) * 1.025;
  const unit = half * 2 / usableHeight;
  cam.left = center.x - (insets.left + usableWidth / 2) * unit; cam.right = cam.left + w * unit;
  cam.top = center.y + (insets.top + usableHeight / 2) * unit; cam.bottom = cam.top - h * unit;
  cam.updateProjectionMatrix();
}
