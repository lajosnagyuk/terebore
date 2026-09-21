import * as THREE from "three";
import { palette } from "./palette";
import { contactTexture } from "./contact-texture";

interface ShadowBall {
  color: number;
  body: { id: number };
  mesh: { position: THREE.Vector3 };
}
/** One cached draw for layered contact shadows and nearby reflected colour. */
export class ContactShadows {
  mesh: THREE.InstancedMesh;
  private opacity!: THREE.InstancedBufferAttribute;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly positions = new Map<number, THREE.Vector3>();
  private readonly transform = new THREE.Object3D();
  private readonly shadowColor = new THREE.Color("#42483f");
  private readonly bounceColors = palette.map((p) =>
    new THREE.Color(p.color).lerp(new THREE.Color("#fff2dc"), 0.55),
  );
  constructor(
    private readonly parent: THREE.Object3D,
    private readonly radius: number,
  ) {
    this.material = new THREE.MeshBasicMaterial({
      map: contactTexture(),
      color: "#ffffff",
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float contactOpacity; varying float vContactOpacity;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvContactOpacity = contactOpacity;",
        );
      shader.fragmentShader =
        "varying float vContactOpacity;\n" +
        shader.fragmentShader.replace(
          "#include <alphamap_fragment>",
          "#include <alphamap_fragment>\ndiffuseColor.a *= vContactOpacity;",
        );
    };

    this.mesh = this.createBatch(192);
    parent.add(this.mesh);
  }
  private createBatch(capacity: number) {
    // A new geometry owns the new attribute; dispose the old geometry on growth.
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.opacity = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity),
      1,
    );
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("contactOpacity", this.opacity);
    const mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    mesh.count = 0;
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, this.shadowColor);
    mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }
  private stamp(
    index: number,
    size: number,
    opacity: number,
    color: THREE.Color,
  ) {
    this.transform.scale.set(size, size, 1);
    this.transform.updateMatrix();
    this.opacity.setX(index, opacity);
    this.mesh.setMatrixAt(index, this.transform.matrix);
    this.mesh.setColorAt(index, color);
  }
  forget(id: number) {
    this.positions.delete(id);
  }
  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    this.material.map!.dispose();
    this.material.dispose();
    this.positions.clear();
  }
  update(balls: readonly ShadowBall[]) {
    let contacts = this.mesh;
    let changed = contacts.count !== balls.length * 9;
    for (const b of balls) {
      const previous = this.positions.get(b.body.id);
      if (
        !previous ||
        previous.distanceToSquared(b.mesh.position) > 0.00000001
      ) {
        changed = true;
        if (previous) previous.copy(b.mesh.position);
        else this.positions.set(b.body.id, b.mesh.position.clone());
      }
    }
    if (!changed) return;
    const needed = balls.length * 9;
    if (needed > contacts.instanceMatrix.count) {
      const old = contacts;
      contacts = this.createBatch(needed * 2);
      this.mesh = contacts;
      this.parent.remove(old);
      old.dispose();
      old.geometry.dispose();
      this.parent.add(contacts);
    }
    let index = 0;
    for (const b of balls) {
      const p = b.mesh.position;
      const height = Math.max(0, p.y - this.radius);
      const bounce = this.bounceColors[b.color];
      this.transform.rotation.set(-Math.PI / 2, 0, 0);
      // Directional penumbra grows and softens as a ball lifts off the floor.
      this.transform.position.set(
        p.x + height * 0.45,
        0.018,
        p.z - height * 0.3,
      );
      this.stamp(
        index++,
        1.34 + height * 0.55,
        0.414 / (1 + height * 1.6),
        this.shadowColor,
      );
      this.transform.position.set(p.x, 0.019, p.z);
      this.stamp(
        index++,
        0.72 + height * 0.16,
        0.69 / (1 + height * 14),
        this.shadowColor,
      );
      this.transform.position.set(p.x - 0.12, 0.02, p.z + 0.08);
      this.stamp(index++, 1.9 + height * 0.2, 0.11 / (1 + height * 5), bounce);
      for (let side = 0; side < 2; side++) {
        const distance = Math.max(
          0,
          (side === 0 ? p.x : p.z) + 3.04 - this.radius,
        );
        const strength = Math.max(0, 1 - distance / 2.0);
        this.transform.rotation.set(0, side === 0 ? Math.PI / 2 : 0, 0);
        this.transform.position.set(
          side === 0 ? -3.025 : p.x,
          p.y - distance * 0.55,
          side === 0 ? p.z : -3.025,
        );
        this.stamp(
          index++,
          1.15 + distance * 0.5,
          0.2875 * strength * strength,
          this.shadowColor,
        );
        this.transform.position.y = p.y;
        this.stamp(
          index++,
          0.7,
          (0.414 / (1 + distance * 16)) * strength,
          this.shadowColor,
        );
        this.stamp(index++, 1.75, 0.1 * strength * strength, bounce);
      }
    }
    contacts.instanceColor!.needsUpdate = true;
    this.opacity.needsUpdate = true;
    contacts.count = index;
    contacts.instanceMatrix.needsUpdate = true;
  }
}
