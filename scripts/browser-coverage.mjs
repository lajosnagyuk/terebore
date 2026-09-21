import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import v8ToIstanbul from "v8-to-istanbul";
import coverage from "istanbul-lib-coverage";
import reporting from "istanbul-lib-report";
import reports from "istanbul-reports";

async function* coverageFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* coverageFiles(path);
    else if (entry.name === "browser-coverage.json") yield path;
  }
}
const map = coverage.createCoverageMap({});
let scenarios = 0;
for await (const path of coverageFiles("test-results")) {
  scenarios++;
  for (const entry of JSON.parse(await readFile(path, "utf8"))) {
    // A replaced starting pile no longer matches Vite's original source map.
    // Other scenarios cover the real main.ts; retain its dependencies here.
    if (
      entry.source.includes("test-only starting pile") ||
      entry.source.includes("addBall(0,new THREE.Vector3")
    )
      continue;
    const sourcePath = resolve(`.${new URL(entry.url).pathname}`);
    const converter = v8ToIstanbul(sourcePath, 0, { source: entry.source });
    await converter.load();
    converter.applyCoverage(entry.functions);
    map.merge(converter.toIstanbul());
  }
}
await mkdir("coverage", { recursive: true });
await writeFile("coverage/browser.json", JSON.stringify(map.toJSON()));
const context = reporting.createContext({
  dir: "coverage/browser",
  coverageMap: map,
});
console.log(
  `\nBrowser coverage (${scenarios} scenarios; source-mapped TypeScript):`,
);
for (const format of ["text", "html", "lcovonly"])
  reports.create(format).execute(context);
const unseen = (await readdir("src")).filter(
  (name) =>
    name.endsWith(".ts") &&
    !name.endsWith(".test.ts") &&
    !name.endsWith(".d.ts") &&
    !map.files().includes(resolve("src", name)),
);
console.log(
  "Runtime modules not observed:",
  unseen.length ? unseen.join(", ") : "none",
);
const summary = map.getCoverageSummary().toJSON();
for (const [metric, minimum] of Object.entries({
  lines: 90,
  branches: 85,
  functions: 90,
})) {
  if (summary[metric].pct < minimum)
    throw new Error(
      `Browser ${metric} coverage ${summary[metric].pct}% is below ${minimum}%`,
    );
}
if (unseen.length)
  throw new Error(
    `Runtime modules missing from browser coverage: ${unseen.join(", ")}`,
  );
