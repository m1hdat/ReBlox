import * as THREE from "three";

/** Vân gỗ mảnh theo thớ; không dùng lớp nhiễu/ố phủ lên cảnh. */
export function woodMaterial(color: number) {
  const width = 128, height = 64, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const grain = Math.sin(y * 1.7 + Math.sin(x * .045) * .65) * 5 + Math.sin(y * .43) * 3;
    const offset = (y * width + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 244 + grain;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: .64, metalness: 0 });
}
export const metalMaterial = (color = 0xa6b6b9) => new THREE.MeshStandardMaterial({ color, metalness: .72, roughness: .34 });
export const paintedMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, metalness: .06, roughness: .5 });
