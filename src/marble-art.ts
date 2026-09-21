import * as THREE from "three";

// Bake soft studio reflections once. Sorted front surfaces transmit the actual
// scene behind them, with thickness-dependent opacity and no extra render pass.
function studioMatcap() {
  const size = 256,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1,
        ny = (y / (size - 1)) * 2 - 1;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const key = Math.max(0, -nx * 0.38 + ny * 0.58 + nz * 0.72);
      const bounce = Math.max(0, -ny) * 0.12;
      const shade = Math.min(
        1,
        0.25 +
          THREE.MathUtils.smoothstep(key, 0, 0.52) * 0.25 +
          THREE.MathUtils.smoothstep(key, 0.48, 0.96) * 0.36 +
          bounce,
      );
      const highlight = Math.exp(
        -(((nx + 0.32) / 0.3) ** 2 + ((ny - 0.43) / 0.4) ** 2) * 2,
      );
      const softbox =
        Math.exp(-((nx + 0.4) ** 2 / 0.1 + (ny - 0.42) ** 2 / 0.15)) * 0.1;
      const i = (y * size + x) * 4;
      data[i] =
        data[i + 1] =
        data[i + 2] =
          Math.round(Math.pow(shade, 1 / 2.2) * 255);
      data[i + 3] = Math.round(
        Math.min(1, highlight * 0.18 + softbox * 0.7) * 255,
      );
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
function pigmentClouds() {
  const size = 256,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2,
        v = (y / size) * Math.PI;
      const wave = Math.sin(u * 2 + Math.sin(v * 3 + Math.sin(u)) * 1.1);
      // Soft pigment flow in moulded plastic; no mineral veins.
      const cloud = wave * Math.sin(v) ** 2;
      const value = Math.round(
        Math.min(
          255,
          236 + cloud * 17 + Math.sin(u * 3 + v * 2) * Math.sin(v) * 4,
        ),
      );
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
const matcap = studioMatcap(),
  map = pigmentClouds();
export function createMarbleMaterial(color: string, variant = Math.random()) {
  const tint = new THREE.Color(color);
  tint.offsetHSL(
    (variant - 0.5) * 0.012,
    (variant - 0.5) * 0.035,
    (variant - 0.5) * 0.025,
  );
  const material = new THREE.MeshMatcapMaterial({
    color: tint,
    matcap,
    map,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
  });
  const glow = { value: 0 };
  material.userData.glow = glow;
  const compression = { value: 0 };
  const impactNormal = { value: new THREE.Vector3(0, 1, 0) };
  material.userData.compression = compression;
  material.userData.impactNormal = impactNormal;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCelebration = glow;
    shader.uniforms.uCompression = compression;
    shader.uniforms.uImpactNormal = impactNormal;
    shader.vertexShader =
      "uniform float uCompression; uniform vec3 uImpactNormal;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed = transformed * (1.0 + uCompression * .5) - uImpactNormal * dot(transformed, uImpactNormal) * uCompression * 1.5;",
      );
    shader.fragmentShader =
      "uniform float uCelebration;\n" + shader.fragmentShader;
    // A thick shell has its longest optical path just inside the silhouette.
    // Keep a narrow ink edge; the soft inner crescent gives a sense of depth.
    shader.fragmentShader = shader.fragmentShader.replace(
      "vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;",
      `
      float facing = clamp(abs(dot(normal, viewDir)), 0.0, 1.0);
      float shell = exp(-pow((facing - 0.40) / 0.22, 2.0));
      float innerWall = exp(-pow((facing - 0.61) / 0.15, 2.0));
      float lowerLight = (1.0 - smoothstep(-0.65, 0.30, normal.y));
      vec3 pigment = diffuseColor.rgb;
      vec3 cloudyTint = mix(pigment, vec3(1.0, 0.95, 0.82), 0.20);
      vec3 outgoingLight = pigment * matcapColor.rgb;
      // Milkiness in the cavity, rich colour through the thicker shoulder.
      outgoingLight = mix(outgoingLight, cloudyTint, facing * facing * (0.22 + (1.0 - sampledDiffuseColor.r) * 0.24));
      outgoingLight *= 1.0 - shell * 0.08;
      outgoingLight = mix(outgoingLight, cloudyTint, (1.0 - facing) * 0.10);
      outgoingLight += cloudyTint * innerWall * (0.025 + lowerLight * 0.10);
      // Light carried around the shell makes a coloured halo beneath the rim.
      float halo = exp(-pow((facing - 0.24) / 0.13, 2.0));
      outgoingLight += mix(pigment, vec3(1.0, 0.94, 0.78), 0.34)
        * halo * (0.06 + lowerLight * 0.18);
      outgoingLight = mix(outgoingLight, vec3(1.0, 0.98, 0.94), matcapColor.a);
      float edge = smoothstep(0.065, 0.18, facing);
      outgoingLight = mix(pigment * 0.21, outgoingLight, edge);
      outgoingLight = mix(outgoingLight, vec3(1.0,.91,.67), uCelebration*.28);
      // Visual shell walls occupy 38.4% of the outer radius.
      // Optical thickness is independent of collision geometry.
      // Beer–Lambert absorption preserves a dense rim and a translucent centre.
      float innerChord = sqrt(max(0.0, facing * facing - (1.0 - .616 * .616)));
      float shellDistance = 2.0 * (facing - innerChord);
      float cloud = sampledDiffuseColor.r;
      // Face-on transmission increases 20%; grazing views stay milky.
      // Cap transmission so stacked shells rapidly hide distant room detail.
      float window = smoothstep(0.30, 1.0, facing);
      float transmission = min(0.28, 1.3 * exp(-max(shellDistance, 0.768) * 1.2 * (2.1 + (1.0 - cloud) * 2.0))
        * mix(0.25, 1.20, window * window));
      transmission *= smoothstep(0.10, 0.36, facing);
      // Surface reflections and match flashes remain on the front of the shell.
      transmission *= 1.0 - matcapColor.a;
      transmission *= 1.0 - uCelebration * .8;
      diffuseColor.a = 1.0 - transmission;

      `,
    );
  };
  return material;
}
