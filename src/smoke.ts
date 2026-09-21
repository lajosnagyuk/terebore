import * as THREE from "three";

/** Reusable, single-draw mist: colour left behind by a match. */
export class MatchMist {
  private readonly capacity = 256;
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly opacity = new THREE.InstancedBufferAttribute(
    new Float32Array(this.capacity),
    1,
  );
  private readonly material: THREE.MeshBasicMaterial;
  readonly mesh: THREE.InstancedMesh;
  private readonly particles = Array.from({ length: this.capacity }, () => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    color: new THREE.Color(),
    age: 2,
  }));
  private readonly transform = new THREE.Object3D();
  private cursor = 0;
  private active = false;
  constructor(texture: THREE.Texture) {
    this.geometry.setAttribute("mistOpacity", this.opacity);
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    this.material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float mistOpacity; varying float vMistOpacity;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvMistOpacity = mistOpacity;",
        );
      shader.fragmentShader =
        "varying float vMistOpacity;\n" +
        shader.fragmentShader.replace(
          "#include <alphamap_fragment>",
          "#include <alphamap_fragment>\ndiffuseColor.a *= vMistOpacity;",
        );
    };
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      this.capacity,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }
  emit(position: THREE.Vector3, color: string) {
    this.active = true;
    for (let i = 0; i < 5; i++) {
      const p = this.particles[this.cursor++ % this.capacity];
      p.position.copy(position);
      p.velocity.set(
        (Math.random() - 0.5) * 0.75,
        0.22 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.75,
      );
      p.color.set(color);
      p.age = 0;
    }
  }
  clear() {
    this.active = false;
    for (const p of this.particles) p.age = 2;
    this.mesh.count = 0;
  }
  update(dt: number, cameraRotation: THREE.Quaternion) {
    if (!this.active) return;
    this.transform.quaternion.copy(cameraRotation);
    let count = 0;
    for (const p of this.particles) {
      if (p.age >= 1.1) continue;
      p.age += dt;
      if (p.age >= 1.1) continue;
      p.position.addScaledVector(p.velocity, dt);
      this.transform.position.copy(p.position);
      this.transform.scale.setScalar(0.3 + p.age * 0.65);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(count, this.transform.matrix);
      this.mesh.setColorAt(count, p.color);
      this.opacity.setX(count, 0.34 * Math.pow(1 - p.age / 1.1, 1.4));
      count++;
    }
    this.mesh.count = count;
    this.active = count > 0;
    if (count) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor!.needsUpdate = true;
      this.opacity.needsUpdate = true;
    }
  }
}
