import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 2259, height: 1271 },
    deviceScaleFactor: 1.7,
  });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    const pending = [],
      samples = [];
    let gl, ext;
    window.__lightingTiming = { samples, supported: false };
    window.requestAnimationFrame = (callback) =>
      raf((now) => {
        gl ||= document.querySelector("canvas")?.getContext("webgl2");
        ext ||= gl?.getExtension("EXT_disjoint_timer_query_webgl2");
        window.__lightingTiming.supported = !!ext;
        if (!ext) {
          callback(now);
          return;
        }
        while (
          pending.length &&
          gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)
        ) {
          const query = pending.shift();
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT))
            samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(query);
        }
        const query = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        try {
          callback(now);
        } finally {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push(query);
        }
      });
  });
  await page.goto("http://localhost:5173");
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    window.__lightingTiming.samples.length = 0;
  });
  await page.waitForTimeout(6000);
  console.log(
    JSON.stringify(
      await page.evaluate(() => {
        const { samples, supported } = window.__lightingTiming;
        samples.sort((a, b) => a - b);
        return {
          supported,
          samples: samples.length,
          medianGpuMs: samples[Math.floor(samples.length * 0.5)],
          p95GpuMs: samples[Math.floor(samples.length * 0.95)],
          rendering: window.__terebore.rendering,
        };
      }),
    ),
  );
} finally {
  await browser.close();
}
