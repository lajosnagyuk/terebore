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
