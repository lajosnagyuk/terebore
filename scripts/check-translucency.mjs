import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://localhost:5173");
  const result = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { createMarbleMaterial } = await import("/src/marble-art.ts");
    const { palette } = await import("/src/palette.ts");
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(256, 256);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e5d3b3");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.z = 5;
    const geometry = new THREE.SphereGeometry(1, 48, 32);
    const front = new THREE.Mesh(
      geometry,
      createMarbleMaterial(palette[0].color, 0.5),
    );
    const back = new THREE.Mesh(geometry, createMarbleMaterial(palette[1].color, 0.5));
    // Touching, partially overlapping spheres viewed from the front.
    back.position.set(0.6, 0, -Math.sqrt(4 - 0.36));
    scene.add(back, front);
    const gl = renderer.getContext();
    function sample(x, y) {
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel].slice(0, 3);
    }
    renderer.render(scene, camera);
    const blue = sample(143, 128),
      edgeBlue = sample(210, 128);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(renderer.domElement, 0, 0);
    back.material.dispose();
    back.material = createMarbleMaterial(palette[3].color, 0.5);
    renderer.render(scene, camera);
    const yellow = sample(143, 128),
      edgeYellow = sample(210, 128);
    ctx.drawImage(renderer.domElement, 256, 0);
    const image = canvas.toDataURL();
    geometry.dispose();
    front.material.dispose();
    back.material.dispose();
    renderer.dispose();
    return { blue, yellow, edgeBlue, edgeYellow, image };
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    "/tmp/terebore-translucency.png",
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  delete result.image;
  const difference = result.blue.reduce(
    (sum, v, i) => sum + Math.abs(v - result.yellow[i]),
    0,
  );
  // Thick shell walls leave subtle transmission. Require
  // a colour change above RGB quantization noise, without requiring a specific material contrast.
  assert.ok(
    difference > 6,
    `Rear ball colour must show through front ball: ${difference}`,
  );
  assert.deepEqual(errors, []);
  console.log({ ...result, rearColourDifference: difference, errors });
} finally {
  await browser.close();
}
