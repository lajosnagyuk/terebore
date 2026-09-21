import { clearsTriangle, clearCornerPoints } from "./play-area";
import { ScoreToken } from "./score-token";
import { ContactShadows } from "./contact-shadows";
import { GameAudio } from "./audio";
import { mountUI, $, icons, svg } from "./ui";
import * as THREE from "three";
import { MatchMist } from "./smoke";
import * as CANNON from "cannon-es";
import { createMarbleMaterial } from "./marble-art";
import { AdaptiveQuality } from "./quality";
import { findMatches } from "./matches";
import { MatchLifecycle } from "./match-lifecycle";
import { loadBest, saveBest } from "./persistence";
import { pointerAim } from "./input";
import "./style.css";
import { roomMaterial, roomOutline } from "./room-art";
import { throwReadiness, clearScore, nextChain } from "./cadence";
import { palette } from "./palette";
import { pickTarget, solveThrow, ThrowPreview, type AimTarget } from "./aiming";
import {
  roomRotation,
  roomOffset,
  roomGravity,
  throwOrigin,
} from "./room-feel";

mountUI();
if (matchMedia("(hover: none)").matches)
  $("#hint").textContent = "Drag to aim · release to throw";
let score = 0;
let best = loadBest(() => localStorage);
$("#best").textContent = String(best);
const scene = new THREE.Scene();
const room = new THREE.Group();
room.quaternion.copy(roomRotation);
room.position.copy(roomOffset);
scene.add(room);
scene.background = new THREE.Color("#eeeae2");
scene.fog = new THREE.Fog("#eeeae2", 18, 43);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
const quality = new AdaptiveQuality(innerWidth, innerHeight, devicePixelRatio);
renderer.setPixelRatio(quality.ratio);
renderer.info.autoReset = false;
renderer.setClearColor("#eeeae2");
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
$("#world").appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(
  40,
  innerWidth / innerHeight,
  0.1,
  70,
);
camera.position.set(8, 8.1, 10);
camera.lookAt(
  new THREE.Vector3(-0.5, 0.55, -0.5)
    .applyQuaternion(roomRotation)
    .add(roomOffset),
);
const world = new CANNON.World({
  gravity: new CANNON.Vec3(roomGravity.x, roomGravity.y, roomGravity.z),
  allowSleep: true,
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver = new CANNON.GSSolver();
(world.solver as CANNON.GSSolver).iterations = 12;
const marblePhysics = new CANNON.Material("marble"),
  roomPhysics = new CANNON.Material("room");
world.addContactMaterial(
  new CANNON.ContactMaterial(marblePhysics, roomPhysics, {
    friction: 0.22,
    restitution: 0.56,
  }),
);
world.addContactMaterial(
  new CANNON.ContactMaterial(marblePhysics, marblePhysics, {
    friction: 0.12,
    restitution: 0.221,
  }),
);
const wallBodies = new Set<number>();
function box(
  size: number[],
  pos: number[],
  color: string,
  physical = true,
  rotation = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...(size as [number, number, number])),
    roomMaterial(color),
  );
  mesh.position.set(...(pos as [number, number, number]));
  mesh.rotation.y = rotation;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const edges = roomOutline(
    new THREE.EdgesGeometry(mesh.geometry),
    "#625c4c",
    0.48,
  );
  mesh.add(edges);
  room.add(mesh);
  if (physical) {
    const body = new CANNON.Body({
      mass: 0,
      material: roomPhysics,
      shape: new CANNON.Box(
        new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2),
      ),
    });
    body.position.set(...(pos as [number, number, number]));
    body.quaternion.setFromEuler(0, rotation, 0);
    // SAP sorts static AABBs: refresh bounds after placing the room collider.
    body.updateAABB();
    world.addBody(body);
    if (size[1] > 10) wallBodies.add(body.id);
  }
  return mesh;
}
box([50, 0.3, 50], [10, -0.15, 10], "#e5d3b3");
box([0.22, 18, 35], [-3.15, 9, 14.3], "#b8c7bd");
box([35, 18, 0.22], [14.3, 9, -3.15], "#f1e3cb");
box([0.09, 0.16, 28], [-3, 0.08, 11], "#8c9c8b");
box([28, 0.16, 0.09], [11, 0.08, -3], "#c8b392");
// A low diagonal rail closes the two walls into a triangular collecting tray.
box([7.1, 0.25, 0.18], [-0.5, 0.125, -0.5], "#936741", true, Math.PI / 4);
box([7.1, 0.035, 0.22], [-0.5, 0.264, -0.5], "#d0a56c", false, Math.PI / 4);
const trayShape = new THREE.Shape();
trayShape.moveTo(-2.99, -2.99);
trayShape.lineTo(-2.99, 1.97);
trayShape.lineTo(1.97, -2.99);
trayShape.closePath();
const tray = new THREE.Mesh(
  new THREE.ShapeGeometry(trayShape),
  new THREE.MeshBasicMaterial({
    color: "#adbf99",
    toneMapped: false,
    side: THREE.DoubleSide,
  }),
);
tray.rotation.x = Math.PI / 2;
tray.scale.y = 1;
tray.position.y = 0.006;
tray.receiveShadow = true;
room.add(tray);
const seamGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-3.025, 0, -3.025),
  new THREE.Vector3(-3.025, 18, -3.025),
]);
room.add(roomOutline(seamGeometry, "#777464", 0.6));
const radius = 0.36,
  geometry = new THREE.SphereGeometry(radius, 32, 20);
function marbleMaterial(color: number) {
  return createMarbleMaterial(palette[color].color);
}

const contacts = new ContactShadows(room, radius);
type Ball = {
  body: CANNON.Body;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshMatcapMaterial>;
  color: number;
  born: number;
  impact: number;
  impactNormal: THREE.Vector3;
  launched: boolean;
  reachedPile: boolean;
  banked: boolean;
  clearingAt: number;
};
let balls: Ball[] = [];
let elapsed = 0,
  lastThrow = -10;
let current = 0,
  next = 1;
let aim = 0,
  power = 0.5;
let target: AimTarget = {
  point: new THREE.Vector3(0.1, 0, 0.2),
  normal: new THREE.Vector3(0, 1, 0),
  surface: "floor",
};
let hasTarget = true,
  aiming = false,
  aimDirty = false;
let pointerPosition = { x: innerWidth * 0.5, y: innerHeight * 0.58 };
const raycaster = new THREE.Raycaster();
const inverseRoom = new THREE.Matrix4();
const audio = new GameAudio();
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(
  35,
  innerWidth / innerHeight,
  0.1,
  10,
);
handCamera.position.z = 5;
const hand = new THREE.Mesh(geometry, marbleMaterial(0));
handScene.add(hand);
function updateHand() {
  hand.material.dispose();
  hand.material = marbleMaterial(current);
  const p = palette[next];
  $(".pocket-ball").style.setProperty("--ball", p.color);
  $(".pocket-ball").style.setProperty("--dark", p.dark);
  $("#next-name").textContent = p.name;
}
let lastSound = 0;
let hintTimer: ReturnType<typeof setTimeout> | undefined;
let chordTimer: ReturnType<typeof setTimeout> | undefined;
function addBall(color: number, position: THREE.Vector3) {
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius),
    material: marblePhysics,
    linearDamping: 0.18,
    angularDamping: 0.48,
    sleepSpeedLimit: 0.16,
    sleepTimeLimit: 0.8,
  });
  body.position.set(position.x, position.y, position.z);
  body.updateAABB();
  world.addBody(body);
  const mesh = new THREE.Mesh(geometry, marbleMaterial(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.copy(position);
  room.add(mesh);
  const ball = {
    body,
    mesh,
    color,
    born: elapsed,
    impact: -10,
    impactNormal: new THREE.Vector3(0, 1, 0),
    launched: false,
    reachedPile: false,
    banked: false,
    clearingAt: -1,
  };
  balls.push(ball);
  aimDirty = true;
  body.addEventListener(
    "collide",
    (e: { contact: CANNON.ContactEquation; body: CANNON.Body }) => {
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (ball.launched && !ball.reachedPile) {
        if (
          wallBodies.has(e.body.id) &&
          elapsed - ball.born < 2.2 &&
          impact > 1
        )
          ball.banked = true;
        if (e.body.mass > 0) ball.reachedPile = true;
      }
      if (impact > 1.2) {
        ball.impact = elapsed;
        ball.impactNormal.set(e.contact.ni.x, e.contact.ni.y, e.contact.ni.z);
      }
      if (impact > 0.6 && elapsed - lastSound > 0.07) {
        const volume = Math.min(0.045, impact * 0.007);
        audio.impact(impact, color, e.body.mass > 0, volume);
        lastSound = elapsed;
      }
    },
  );
  return ball;
}
function removeBall(ball: Ball) {
  aimDirty = true;
  contacts.forget(ball.body.id);
  if (activeThrow === ball) activeThrow = null;
  world.removeBody(ball.body);
  room.remove(ball.mesh);
  ball.mesh.material.dispose();
  balls = balls.filter((b) => b !== ball);
}
function seed() {
  const positions = [
    [-2.53, -2.49, 2],
    [-1.8, -2.5, 3],
    [-2.5, -1.75, 1],
    [-1.78, -1.74, 4],
    [-1.05, -2.48, 2],
    [-2.49, -1.01, 0],
    [-1.05, -1.75, 1],
    [-1.77, -1.01, 0],
  ];
  for (const [x, z, c] of positions) addBall(c, new THREE.Vector3(x, 0.38, z));
}
function chooseColor() {
  if (balls.length && Math.random() < 0.8)
    return balls[Math.floor(Math.random() * balls.length)].color;
  return Math.floor(Math.random() * palette.length);
}
function trajectory() {
  return solveThrow(target);
}
let activeThrow: Ball | null = null;
let readySince = -10;
function readyToThrow() {
  return (
    !activeThrow ||
    throwReadiness(
      elapsed - lastThrow,
      activeThrow.reachedPile,
      activeThrow.body.velocity.length(),
    )
  );
}
function throwBall() {
  if (!readyToThrow() || dialogOpen() || !hasTarget) return;
  const { origin, velocity } = trajectory();
  const b = addBall(current, origin);
  b.launched = true;
  shotSerial++;
  activeThrow = b;
  readySince = -1;
  b.body.velocity.set(velocity.x, velocity.y, velocity.z);
  b.body.angularVelocity.set(-5, 1.5, 4);
  lastThrow = elapsed;
  document.body.classList.add("playing");
  current = next;
  next = chooseColor();
  updateHand();
  audio.tone(330, 0.018, 0.15);
  aimDirty = true;
  $("#hint").textContent = "A little bounce. A little breath.";
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    $("#hint").textContent = aiming
      ? `Click to bounce · ${target.surface}`
      : lastPointerType === "touch"
        ? "Drag to aim · release to throw"
        : "Point to aim · click to throw";
  }, 1800);
}
const dotGeometry = new THREE.SphereGeometry(0.052, 12, 8);
const dotMaterial = new THREE.MeshMatcapMaterial({
  color: "#fffaf0",
  toneMapped: false,
});
const guideHandCircle = { value: new THREE.Vector3() };
const guideBufferHeight = { value: 1 };
const guideHandScreen = new THREE.Vector3();
const guideMaskDeclarations =
  "uniform vec3 uHandCircle; uniform float uBufferHeight;\n";
const guideMask =
  "diffuseColor.a *= smoothstep(uHandCircle.z, uHandCircle.z + .012, length(gl_FragCoord.xy / uBufferHeight - uHandCircle.xy));\n";
dotMaterial.transparent = true;
dotMaterial.depthWrite = false;
dotMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uHandCircle = guideHandCircle;
  shader.uniforms.uBufferHeight = guideBufferHeight;
  shader.vertexShader =
    "attribute float guideOpacity; varying float vGuideOpacity;\n" +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGuideOpacity = guideOpacity;",
    );
  shader.fragmentShader =
    guideMaskDeclarations +
    "varying float vGuideOpacity;\n" +
    shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "diffuseColor.a *= vGuideOpacity;\n" +
        guideMask +
        "#include <opaque_fragment>",
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    "vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;",
    "float rim = smoothstep(0.38, 0.50, abs(dot(normal, viewDir))); vec3 outgoingLight = mix(vec3(0.105,0.12,0.085), diffuseColor.rgb, rim);",
  );
};
const dotOpacity = new THREE.InstancedBufferAttribute(new Float32Array(64), 1);
dotOpacity.setUsage(THREE.DynamicDrawUsage);
dotGeometry.setAttribute("guideOpacity", dotOpacity);
const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, 64);
dots.visible = false;
dots.frustumCulled = false;
dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
room.add(dots);
const aimTransform = new THREE.Object3D();
const preview = new ThrowPreview();
const targetMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.12, 0.17, 32),
  new THREE.MeshBasicMaterial({
    color: "#515d45",
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,
  }),
);
targetMarker.material.transparent = true;
// A flat two-sided guide needs only one transparent draw.
targetMarker.material.forceSinglePass = true;
targetMarker.material.onBeforeCompile = (shader) => {
  shader.uniforms.uHandCircle = guideHandCircle;
  shader.uniforms.uBufferHeight = guideBufferHeight;
  shader.fragmentShader =
    guideMaskDeclarations +
    shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      guideMask + "#include <opaque_fragment>",
    );
};
room.add(targetMarker);
targetMarker.visible = false;
function drawAim(show: boolean) {
  aiming = show && hasTarget;
  dots.visible = aiming;
  targetMarker.visible = aiming;
  if (aiming) aimDirty = true;
}
function refreshAim() {
  const points = preview.trace(
    target,
    balls.map((b) => b.body),
  );
  dots.count = points.length;
  points.forEach((point, i) => {
    aimTransform.position.copy(point);
    const progress = i / Math.max(1, points.length - 1);
    aimTransform.scale.setScalar(1 - progress * 0.62);
    dotOpacity.setX(i, 0.95 * Math.pow(1 - progress, 0.7));
    aimTransform.updateMatrix();
    dots.setMatrixAt(i, aimTransform.matrix);
  });
  dots.instanceMatrix.needsUpdate = true;
  dotOpacity.needsUpdate = true;
  targetMarker.position
    .copy(target.point)
    .addScaledVector(target.normal, 0.022);
  targetMarker.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    target.normal,
  );
  aimDirty = false;
}
function aimAt(x: number, y: number) {
  pointerPosition = { x, y };
  if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) {
    hasTarget = false;
    drawAim(false);
    return;
  }
  camera.updateMatrixWorld();
  room.updateMatrixWorld(true);
  raycaster.setFromCamera(
    new THREE.Vector2((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2),
    camera,
  );
  inverseRoom.copy(room.matrixWorld).invert();
  const hit = pickTarget(raycaster.ray.clone().applyMatrix4(inverseRoom));
  hasTarget = !!hit;
  if (hit) {
    target = hit;
    aim = THREE.MathUtils.clamp((x / innerWidth - 0.5) * 2, -1, 1);
    power = THREE.MathUtils.clamp(trajectory().velocity.length() / 18, 0, 1);
    $("#hint").textContent =
      lastPointerType === "touch"
        ? "Release to throw"
        : `Click to bounce · ${hit.surface}`;
  }
  drawAim(!!hit);
}
const smokeCanvas = document.createElement("canvas");
smokeCanvas.width = 64;
smokeCanvas.height = 64;
const ctx = smokeCanvas.getContext("2d")!;
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, "#ffffffe6");
gradient.addColorStop(0.45, "#ffffff88");
gradient.addColorStop(1, "#ffffff00");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
const mist = new MatchMist(smokeTexture);
room.add(mist.mesh);
const mistRotation = room.quaternion
  .clone()
  .invert()
  .multiply(camera.quaternion);
function puff(ball: Ball) {
  mist.emit(ball.mesh.position, palette[ball.color].color);
}
const scoreToken = new ScoreToken(
  $(".toast"),
  $("#points"),
  $("#message"),
  $("header"),
);
const matchLifecycle = new MatchLifecycle();
let lastClear = -10,
  chain = 0;
let shotSerial = 0,
  lastClearShot = -1;
type Ripple = {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
};
const rippleGeometry = new THREE.RingGeometry(0.86, 1, 48);
let ripples: Ripple[] = [];
function clearGroup(matched: Ball[], originatingShot: number) {
  if (matched.length < 3) {
    for (const ball of matched) ball.clearingAt = -1;
    return;
  }
  chain = nextChain(
    chain,
    elapsed - lastClear,
    originatingShot === lastClearShot,
  );
  lastClearShot = originatingShot;
  lastClear = elapsed;
  const banked = matched.some((b) => b.banked);
  const centre = new THREE.Vector3();
  for (const b of matched) centre.add(b.mesh.position);
  centre.divideScalar(matched.length);
  const ring = new THREE.Mesh(
    rippleGeometry,
    new THREE.MeshBasicMaterial({
      color: palette[matched[0].color].color,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(centre.x, 0.026, centre.z);
  room.add(ring);
  ripples.push({ mesh: ring, age: 0 });
  const screen = room
    .localToWorld(centre.clone().add(new THREE.Vector3(0, 1.1, 0)))
    .project(camera);
  const clearedCorner = clearsTriangle(
    matched.map((ball) => ball.body.position),
    balls
      .filter((ball) => !matched.includes(ball))
      .map((ball) => ball.body.position),
  );
  const points =
    clearScore(matched.length, banked, chain) +
    (clearedCorner ? clearCornerPoints : 0);

  score += points;
  $("#score").textContent = String(score);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $("#score").animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.16)" },
        { transform: "scale(1)" },
      ],
      { duration: 280 },
    );
  }
  if (score > best) {
    best = score;
    $("#best").textContent = String(best);
    saveBest(best, () => localStorage);
  }
  for (const b of matched) {
    puff(b);
    removeBall(b);
  }
  // Removing supports must wake the pile so suspended marbles fall.
  for (const remaining of balls) remaining.body.wakeUp();
  audio.tone(523, 0.045, 0.6);
  clearTimeout(chordTimer);
  chordTimer = setTimeout(() => audio.tone(784, 0.025, 0.7), 100);
  scoreToken.show(points, matched.length, banked, screen, chain, clearedCorner);
}
function checkMatches() {
  const groups = findMatches(
    balls
      .filter((b) => elapsed - b.born > 0.35 && b.clearingAt < 0)
      .map((b) => ({
        id: b.body.id,
        color: b.color,
        x: b.body.position.x,
        y: b.body.position.y,
        z: b.body.position.z,
      })),
    radius * 2,
  );
  for (const group of matchLifecycle.observe(groups, elapsed, shotSerial)) {
    for (const ball of balls)
      if (group.ids.includes(ball.body.id)) ball.clearingAt = elapsed;
    audio.tone(660, 0.025, 0.22);
  }
}

function dialogOpen() {
  return !!document.querySelector("dialog[open]");
}
let drag: { id: number; width: number; height: number } | null = null;
let lastPointerType = "mouse";
const surface = $("#world");
// Claim gameplay touches before an embedded browser treats a drag as scrolling.
// Keep native touch behaviour on dialogs and buttons outside the play surface.
for (const type of ["touchstart", "touchmove"] as const) {
  surface.addEventListener(
    type,
    (event) => {
      if (!dialogOpen() && event.cancelable) event.preventDefault();
    },
    { passive: false },
  );
}

// Touch aims above the fingertip; the same mapping is used on release.
const touchFeedback = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "svg",
);
touchFeedback.classList.add("touch-aim");
touchFeedback.setAttribute("aria-hidden", "true");
touchFeedback.innerHTML =
  '<line class="touch-aim-link"/><circle class="touch-aim-ring" r="10"/>';
document.body.appendChild(touchFeedback);
const touchLink = touchFeedback.querySelector("line")!;
const touchRing = touchFeedback.querySelector("circle")!;
const touchTargetScreen = new THREE.Vector3();
function aimFromPointer(e: PointerEvent) {
  const touch = e.pointerType === "touch";
  const point = pointerAim(
    e.clientX,
    e.clientY,
    touch,
    innerWidth,
    innerHeight,
  );
  if (!point) {
    hasTarget = false;
    cancelDrag();
    return;
  }
  aimAt(point.x, point.y);
  touchFeedback.classList.toggle("visible", touch && hasTarget);
  if (!touch || !hasTarget) return;
  touchTargetScreen
    .copy(target.point)
    .applyMatrix4(room.matrixWorld)
    .project(camera);
  const x = ((touchTargetScreen.x + 1) * innerWidth) / 2;
  const y = ((1 - touchTargetScreen.y) * innerHeight) / 2;
  const dx = x - e.clientX,
    dy = y - e.clientY;
  const distance = Math.hypot(dx, dy);
  const start = Math.min(24 / Math.max(1, distance), 1);
  const end = Math.max(0, 1 - 14 / Math.max(1, distance));
  touchLink.setAttribute("x1", String(e.clientX + dx * start));
  touchLink.setAttribute("y1", String(e.clientY + dy * start));
  touchLink.setAttribute("x2", String(e.clientX + dx * end));
  touchLink.setAttribute("y2", String(e.clientY + dy * end));
  touchLink.style.opacity = distance > 40 ? "1" : "0";
  touchRing.setAttribute("cx", String(x));
  touchRing.setAttribute("cy", String(y));
}

surface.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !e.isPrimary || drag || dialogOpen()) return;
  lastPointerType = e.pointerType;
  surface.focus({ preventScroll: true });
  drag = { id: e.pointerId, width: innerWidth, height: innerHeight };
  $(".hand-label").style.opacity = "0";
  surface.setPointerCapture(e.pointerId);
  aimFromPointer(e);
});
surface.addEventListener("pointermove", (e) => {
  if (dialogOpen() || !e.isPrimary || (drag && drag.id !== e.pointerId)) return;
  lastPointerType = e.pointerType;
  if (e.pointerType === "mouse" || drag) aimFromPointer(e);
});
function cancelDrag() {
  touchFeedback.classList.remove("visible");
  drag = null;
  $(".hand-label").style.opacity = "";
  drawAim(false);
}
surface.addEventListener("pointerup", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  // A resize event may arrive after pointerup during rotation or viewport changes.
  if (drag.width !== innerWidth || drag.height !== innerHeight) {
    cancelDrag();
    return;
  }
  aimFromPointer(e);
  drag = null;
  $(".hand-label").style.opacity = "";
  if (hasTarget) throwBall();
  touchFeedback.classList.remove("visible");
  if (e.pointerType !== "mouse") drawAim(false);
});
surface.addEventListener("pointerleave", () => {
  if (!drag) drawAim(false);
});
surface.addEventListener("pointercancel", (e) => {
  if (drag?.id === e.pointerId) cancelDrag();
});
surface.addEventListener("lostpointercapture", (e) => {
  if (drag?.id === e.pointerId) cancelDrag();
});
window.addEventListener("blur", cancelDrag);
window.addEventListener("keydown", (e) => {
  if (dialogOpen() || e.target instanceof HTMLButtonElement) return;
  if (e.code === "Escape") {
    cancelDrag();
    return;
  }
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(
      e.code,
    )
  ) {
    e.preventDefault();
    if (e.code === "Space") {
      if (e.repeat) return;
      throwBall();
      drawAim(true);
    } else {
      lastPointerType = "keyboard";
      aimAt(
        THREE.MathUtils.clamp(
          pointerPosition.x +
            (e.code === "ArrowLeft" ? -18 : e.code === "ArrowRight" ? 18 : 0),
          0,
          innerWidth,
        ),
        THREE.MathUtils.clamp(
          pointerPosition.y +
            (e.code === "ArrowUp" ? -18 : e.code === "ArrowDown" ? 18 : 0),
          0,
          innerHeight,
        ),
      );
    }
  }
});
$("#sound").onclick = () => {
  audio.muted = !audio.muted;
  $("#sound").innerHTML = svg(audio.muted ? icons.mute : icons.sound);
  $("#sound").setAttribute("aria-pressed", String(!audio.muted));
  $("#sound").setAttribute(
    "aria-label",
    audio.muted ? "Turn sound on" : "Turn sound off",
  );
  $("#sound").title = audio.muted ? "Turn sound on" : "Turn sound off";
  audio.tone(440, 0.03, 0.4);
};
$("#help").onclick = () => {
  $<HTMLDialogElement>("#help-dialog").showModal();
  cancelDrag();
};
$("#close-help").onclick = () => $<HTMLDialogElement>("#help-dialog").close();
$("#reset").onclick = () => {
  $<HTMLDialogElement>("#reset-dialog").showModal();
  cancelDrag();
};
$("#cancel-reset").onclick = () =>
  $<HTMLDialogElement>("#reset-dialog").close();
$("#confirm-reset").onclick = () => {
  for (const b of balls) removeBall(b);
  mist.clear();
  document.body.classList.remove("playing");
  matchLifecycle.reset();
  clearTimeout(hintTimer);
  clearTimeout(chordTimer);
  $("#hint").textContent =
    lastPointerType === "touch"
      ? "Drag to aim · release to throw"
      : "Point to aim · click to throw";
  lastClear = -10;
  chain = 0;
  shotSerial = 0;
  lastClearShot = -1;
  activeThrow = null;
  readySince = -10;
  for (const r of ripples) {
    room.remove(r.mesh);
    r.mesh.material.dispose();
  }
  ripples = [];
  score = 0;
  $("#score").textContent = "0";
  current = 0;
  next = 1;
  aim = 0;
  power = 0.5;
  target = {
    point: new THREE.Vector3(0.1, 0, 0.2),
    normal: new THREE.Vector3(0, 1, 0),
    surface: "floor",
  };
  hasTarget = true;
  cancelDrag();
  lastThrow = -10;
  scoreToken.dismiss();
  seed();
  updateHand();
  $<HTMLDialogElement>("#reset-dialog").close();
};
let handRestY = 0;
let handRestX = 0;
let handLift = 0;
let handBaseScale = 0.38;
let handAvailability = 1;
function resize() {
  if (drag) cancelDrag();
  scoreToken.dismiss();
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < 640 ? 53 : 40;
  camera.updateProjectionMatrix();
  quality.resize(innerWidth, innerHeight, devicePixelRatio);
  renderer.setPixelRatio(quality.ratio);
  renderer.setSize(innerWidth, innerHeight);
  if (aiming) aimAt(pointerPosition.x, pointerPosition.y);
  handCamera.aspect = camera.aspect;
  handCamera.updateProjectionMatrix();
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(35 / 2)) * 5;
  // Keep the resting hand below the release point, leaving the pile visible.
  // This presentation offset does not change the physical launch or aiming.
  camera.updateMatrixWorld();
  room.updateMatrixWorld(true);
  const releaseWorld = room.localToWorld(throwOrigin.clone());
  const releaseScreen = releaseWorld.clone().project(camera);
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(
    camera.matrixWorld,
    0,
  );
  const edgeScreen = releaseWorld
    .clone()
    .addScaledVector(cameraRight, radius)
    .project(camera);
  const pixelRadius =
    (Math.abs(edgeScreen.x - releaseScreen.x) * innerWidth) / 2;
  const compact = innerWidth < 640;
  const heldRadius = pixelRadius * (compact ? 0.78 : 0.84);
  const releaseY = ((1 - releaseScreen.y) * innerHeight) / 2;
  const heldY = Math.min(
    releaseY + pixelRadius * (compact ? 1.5 : 1.1),
    innerHeight - heldRadius - 110,
  );
  handRestX = (releaseScreen.x * visibleHeight * camera.aspect) / 2;
  handRestY = (0.5 - heldY / innerHeight) * visibleHeight;
  handLift = (8 * visibleHeight) / innerHeight;
  hand.position.set(handRestX, handRestY, 0);
  handBaseScale = (heldRadius * visibleHeight) / (innerHeight * radius);
  const label = $(".hand-label");
  label.style.left = `${((releaseScreen.x + 1) * innerWidth) / 2}px`;
  label.style.top = `${heldY + heldRadius + 17}px`;
  label.style.bottom = "auto";
  hand.scale.setScalar(handBaseScale);
}
window.addEventListener("resize", resize);
resize();
seed();
updateHand();
// Advance simulation time faster without adding energy to collisions.
const gameplaySpeed = 1.2;
let previous = performance.now();
const handLabel = $(".hand-label");
const instructionDetail = $(".instructions p");
let displayedReady: boolean | undefined;
let checkClock = 0;
let lastPreview = -10;
const impactRotation = new THREE.Quaternion();
function frame(now: number) {
  requestAnimationFrame(frame);
  const frameMs = now - previous;
  const dt = Math.min(frameMs / 1000, 0.05) * gameplaySpeed;
  previous = now;
  if (document.hidden) return;
  const paused = dialogOpen();
  if (!paused && quality.sample(frameMs)) {
    renderer.setPixelRatio(quality.ratio);
  }
  if (!paused) {
    elapsed += dt;
    world.step(1 / 90, dt, 6);
    for (const celebration of matchLifecycle.takeReady(elapsed)) {
      clearGroup(
        balls.filter((b) => celebration.ids.includes(b.body.id)),
        celebration.shot,
      );
    }
    for (const r of ripples) {
      r.age += dt;
      r.mesh.scale.setScalar(0.35 + r.age * 2.5);
      r.mesh.material.opacity = Math.max(0, 0.24 * (1 - r.age / 0.8));
      if (r.age > 0.8) {
        room.remove(r.mesh);
        r.mesh.material.dispose();
        ripples = ripples.filter((x) => x !== r);
      }
    }
    for (const b of balls) {
      b.mesh.position.copy(b.body.interpolatedPosition);
      b.mesh.quaternion.copy(b.body.interpolatedQuaternion);
      const charge =
        b.clearingAt < 0
          ? 0
          : Math.sin(Math.min(1, (elapsed - b.clearingAt) / 0.3) * Math.PI);
      b.mesh.material.userData.glow.value = charge;
      const impactAge = elapsed - b.impact;
      const compression =
        impactAge < 0.12 ? Math.sin((impactAge / 0.12) * Math.PI) * 0.025 : 0;
      b.mesh.material.userData.compression.value = compression;
      b.mesh.material.userData.impactNormal.value
        .copy(b.impactNormal)
        .applyQuaternion(impactRotation.copy(b.mesh.quaternion).invert());
      b.mesh.scale.setScalar(1 + charge * 0.085);
      if (
        b.body.position.x > 12 ||
        b.body.position.z > 14 ||
        b.body.position.y < -2
      ) {
        puff(b);
        removeBall(b);
      }
    }
    checkClock += dt;
    if (checkClock > 0.07) {
      checkMatches();
      checkClock = 0;
    }
    mist.update(dt, mistRotation);
  }
  const ready = readyToThrow();
  if (ready && readySince < 0) readySince = elapsed;
  handAvailability = THREE.MathUtils.lerp(
    handAvailability,
    ready ? 1 : 0.72,
    1 - Math.exp(-dt * 10),
  );
  if (ready !== displayedReady) {
    handLabel.textContent = ready ? "IN YOUR HAND" : "LET IT LAND";
    instructionDetail.textContent = ready
      ? "A little guidance. Throw to find out."
      : "Watch this one settle. You can aim the next.";
    displayedReady = ready;
  }
  const handEase = 1 - Math.exp(-dt * 22);
  hand.position.x +=
    (handRestX + (drag ? aim * handLift : 0) - hand.position.x) * handEase;
  hand.position.y +=
    (handRestY -
      (1 - handAvailability) * 0.12 +
      (drag ? power * handLift : 0) -
      hand.position.y) *
    handEase;
  hand.rotation.y += dt * (drag ? 0.7 : 0.12);
  const reveal = THREE.MathUtils.clamp(
    (elapsed - lastThrow - 0.06) / 0.22,
    0,
    1,
  );
  hand.visible = reveal > 0;
  const spring =
    1 - Math.pow(1 - reveal, 3) + Math.sin(reveal * Math.PI) * 0.12;
  const grip = drag ? power * 0.055 : 0;
  const readyPulse = ready
    ? 1 +
      0.035 *
        Math.sin(
          THREE.MathUtils.clamp((elapsed - readySince) / 0.24, 0, 1) * Math.PI,
        )
    : 1;
  const scale = handBaseScale * spring * readyPulse * handAvailability;
  hand.scale.set(scale * (1 + grip), scale * (1 - grip), scale);
  if (
    aiming &&
    !paused &&
    (aimDirty ||
      (elapsed - lastPreview > 0.25 &&
        balls.some((b) => b.body.sleepState !== CANNON.Body.SLEEPING)))
  ) {
    refreshAim();
    lastPreview = elapsed;
  }
  handCamera.updateMatrixWorld();
  guideHandScreen.copy(hand.position).project(handCamera);
  guideHandCircle.value.set(
    (guideHandScreen.x + 1) * camera.aspect * 0.5,
    (guideHandScreen.y + 1) * 0.5,
    hand.visible
      ? (radius * hand.scale.x) /
          (10 * Math.tan(THREE.MathUtils.degToRad(17.5)))
      : 0,
  );
  guideBufferHeight.value = renderer.domElement.height;
  contacts.update(balls);
  renderer.info.reset();
  renderer.autoClear = true;
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(handScene, handCamera);
}
document.addEventListener("visibilitychange", () => {
  previous = performance.now();
  quality.reset();
  cancelDrag();
});
const stats = new URLSearchParams(location.search).has("stats")
  ? document.createElement("output")
  : null;
if (stats) {
  stats.className = "performance";
  stats.setAttribute("aria-label", "Rendering performance");
  document.body.appendChild(stats);
  setInterval(() => {
    stats.textContent = `${quality.frameMs ? Math.round(1000 / quality.frameMs) : 0} fps · ${renderer.domElement.width} × ${renderer.domElement.height}`;
  }, 1000);
}
requestAnimationFrame(frame);
// Read-only diagnostics make physics and long-session checks reproducible in development.
if (import.meta.env.DEV)
  Object.defineProperty(window, "__terebore", {
    get: () => ({
      score,
      balls: balls.map((b) => ({
        color: b.color,
        position: {
          x: b.body.position.x,
          y: b.body.position.y,
          z: b.body.position.z,
        },
        sleep: b.body.sleepState,
        banked: b.banked,
        clearing: b.clearingAt >= 0,
      })),
      current,
      next,
      elapsed,
      cadence: { ready: readyToThrow(), age: elapsed - lastThrow },
      celebrations: matchLifecycle.size,
      palette: palette.map((p) => ({ name: p.name, color: p.color })),
      release: { position: throwOrigin.toArray() },
      targeting: {
        pointer: [pointerPosition.x, pointerPosition.y],
        surface: target.surface,
        point: target.point.toArray(),
        visible: aiming,
        dots: dots.count,
      },
      rendering: {
        fps: quality.frameMs ? Math.round(1000 / quality.frameMs) : 0,
        pixelRatio: quality.ratio,
        width: renderer.domElement.width,
        height: renderer.domElement.height,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        programs: renderer.info.programs?.length ?? 0,
        bodies: world.bodies.length,
        shadowCapacity: contacts.mesh.instanceMatrix.count,
      },
    }),
  });
