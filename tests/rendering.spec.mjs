import { test, expect, openGame } from "./fixtures.mjs";

test("shadow growth releases GPU buffers and repeated reuse stays bounded", async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { ContactShadows } = await import("/src/contact-shadows.ts");
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(64, 64);
    const gl = renderer.getContext();
    const buffers = new Set();
    const create = gl.createBuffer.bind(gl),
      remove = gl.deleteBuffer.bind(gl);
    gl.createBuffer = () => {
      const buffer = create();
      buffers.add(buffer);
      return buffer;
    };
    gl.deleteBuffer = (buffer) => {
      buffers.delete(buffer);
      remove(buffer);
    };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    const shadows = new ContactShadows(scene, 0.36);
    const live = [];
    for (const count of [8, 65, 131, 8, 65, 131, 8]) {
      const balls = Array.from({ length: count }, (_, id) => ({
        body: { id },
        color: id % 5,
        mesh: { position: new THREE.Vector3(-2, 0.36, -2) },
      }));
      shadows.update(balls);
      renderer.render(scene, camera);
      live.push(buffers.size);
      for (const ball of balls) shadows.forget(ball.body.id);
    }
    shadows.dispose();
    renderer.render(scene, camera);
    const remaining = {
      buffers: buffers.size,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };
    renderer.dispose();
    return { live, remaining };
  });
  expect(new Set(result.live).size).toBe(1);
  expect(result.live[0]).toBeGreaterThan(0);
  expect(result.remaining).toEqual({ buffers: 0, geometries: 0, textures: 0 });
});

test("score cards merge, recover during dismissal, and cancel their timers", async ({
  page,
}) => {
  await openGame(page);
  await page.clock.install();
  await page.evaluate(async () => {
    const { ScoreToken } = await import("/src/score-token.ts");
    window.testToken = new ScoreToken(
      document.querySelector(".toast"),
      document.querySelector("#points"),
      document.querySelector("#message"),
      document.querySelector("header"),
    );
    window.testToken.show(30, 3, false, { x: 0, y: 0 }, 1);
  });
  await page.clock.fastForward(4250);
  await page.evaluate(() =>
    window.testToken.show(45, 3, true, { x: 0, y: 0 }, 2),
  );
  await expect(page.locator("#points")).toHaveText("+75");
  await expect(page.locator("#message")).toHaveText("6 TOGETHER · WALL BONUS");
  await expect(page.locator(".toast")).toHaveClass(/show/);
  await page.clock.fastForward(4250);
  await expect(page.locator(".toast")).not.toHaveClass(/show/);
  await page.evaluate(() => {
    window.testToken.show(40, 3, false, { x: 0, y: 0 }, 2);
    window.testToken.dismiss();
  });
  await page.clock.fastForward(5000);
  await expect(page.locator(".toast")).not.toHaveClass(/show/);
});

test("audio voices disconnect after playing and muted audio allocates none", async ({
  page,
}) => {
  await openGame(page);
  const result = await page.evaluate(async () => {
    const { GameAudio } = await import("/src/audio.ts");
    const create = AudioContext.prototype.createOscillator;
    const nodes = new Set();
    let created = 0;
    AudioContext.prototype.createOscillator = function () {
      const node = create.call(this),
        disconnect = node.disconnect.bind(node);
      nodes.add(node);
      created++;
      node.disconnect = () => {
        nodes.delete(node);
        disconnect();
      };
      return node;
    };
    try {
      const audio = new GameAudio();
      audio.tone(440);
      audio.impact(2, 0, true, 0.01);
      const mutedVoices = created;
      audio.muted = false;
      audio.tone(440, 0.01, 0.03);
      audio.impact(2, 0, true, 0.01);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { mutedVoices, created, remaining: nodes.size };
    } finally {
      AudioContext.prototype.createOscillator = create;
    }
  });
  expect(result).toEqual({ mutedVoices: 0, created: 4, remaining: 0 });
});

test("consecutive corner bonuses remain accurate in a merged score card", async ({
  page,
}) => {
  await openGame(page);
  await page.evaluate(async () => {
    const { ScoreToken } = await import("/src/score-token.ts");
    const token = new ScoreToken(
      document.querySelector(".toast"),
      document.querySelector("#points"),
      document.querySelector("#message"),
      document.querySelector("header"),
    );
    token.show(55, 3, false, { x: 0, y: 0 }, 1, true);
    token.show(55, 3, false, { x: 0, y: 0 }, 1, true);
  });
  await expect(page.locator("#points")).toHaveText("+110");
  await expect(page.locator("#message")).toHaveText("CLEAR CORNER · +50 BONUS");
});

test("room corners darken and contact shadows fade as balls lift, with visible colour spill", async ({
  page,
}) => {
  await openGame(page);
  const pixels = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { ContactShadows } = await import("/src/contact-shadows.ts");
    const { roomMaterial } = await import("/src/room-art.ts");
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    renderer.setSize(256, 256);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 20);
    camera.position.set(0, 8, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      roomMaterial("#cccccc"),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const gl = renderer.getContext();
    const sample = (x, z) => {
      const point = new THREE.Vector3(x, 0, z).project(camera);
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.floor((point.x + 1) * 128),
        Math.floor((point.y + 1) * 128),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return [...pixel].slice(0, 3);
    };
    renderer.render(scene, camera);
    const corner = sample(-2.85, -2.85),
      open = sample(1, 1);
    floor.material.dispose();
    floor.material = new THREE.MeshBasicMaterial({ color: "#cccccc" });
    const shadows = new ContactShadows(scene, 0.36);
    const ball = {
      body: { id: 1 },
      color: 0,
      mesh: { position: new THREE.Vector3(0, 0.36, 0) },
    };
    shadows.update([ball]);
    renderer.render(scene, camera);
    const grounded = sample(0, 0),
      red = sample(-0.48, 0.08);
    ball.mesh.position.y = 2;
    shadows.update([ball]);
    renderer.render(scene, camera);
    const airborne = sample(0, 0);
    shadows.forget(1);
    ball.color = 1;
    ball.mesh.position.y = 0.36;
    shadows.update([ball]);
    renderer.render(scene, camera);
    const blue = sample(-0.48, 0.08);
    shadows.dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    renderer.dispose();
    return { corner, open, grounded, airborne, red, blue };
  });
  const brightness = (rgb) => rgb.reduce((a, b) => a + b, 0);
  expect(brightness(pixels.corner)).toBeLessThan(
    brightness(pixels.open) * 0.96,
  );
  expect(brightness(pixels.grounded)).toBeLessThan(
    brightness(pixels.airborne) * 0.85,
  );
  expect(pixels.red[0]).toBeGreaterThan(pixels.blue[0]);
  expect(pixels.blue[2]).toBeGreaterThan(pixels.red[2]);
});
