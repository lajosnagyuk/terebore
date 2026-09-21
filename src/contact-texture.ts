import * as THREE from "three";

export function contactTexture() {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      const edge = 1 - THREE.MathUtils.smoothstep(r, 0.7, 1);
      data[i + 3] = Math.round(Math.exp(-r * r * 3.8) * edge * 255);
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
