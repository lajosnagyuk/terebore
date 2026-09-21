import * as THREE from "three";
import { contactTexture } from "./contact-texture";

interface ShadowBall {
  body: { id: number };
  mesh: { position: THREE.Vector3 };
}
/** One cached draw for floor/wall contacts; owns and releases its GPU buffers. */
export class ContactShadows {
  mesh: THREE.InstancedMesh;
  private opacity!: THREE.InstancedBufferAttribute;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly positions = new Map<number, THREE.Vector3>();
  private readonly transform = new THREE.Object3D();
  constructor(
    private readonly parent: THREE.Object3D,
    private readonly radius: number,
  ) {
    this.material = new THREE.MeshBasicMaterial({
      map: contactTexture(),
      color: "#514b39",
      transparent: true,
      opacity: 0.43,
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
    return mesh;
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
    let changed = contacts.count !== balls.length * 3;
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
    const needed = balls.length * 3;
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
      const spread = 1.22 + height * 0.42;
      this.transform.position.set(
        p.x + height * 0.12,
        0.018,
        p.z - height * 0.06,
      );
      this.transform.rotation.set(-Math.PI / 2, 0, 0);
      this.transform.scale.set(spread, spread, 1);
      this.transform.updateMatrix();
      this.opacity.setX(index, 1 / (1 + height * 1.8));
      contacts.setMatrixAt(index++, this.transform.matrix);
      for (let side = 0; side < 2; side++) {
        const distance = (side === 0 ? p.x : p.z) + 3.04;
        const size =
          distance < 1.1
            ? 1.05 * (1 - Math.max(0, distance - this.radius) / 0.8)
            : 0;
        this.transform.position.set(
          side === 0 ? -3.025 : p.x,
          p.y,
          side === 0 ? p.z : -3.025,
        );
        this.transform.rotation.set(0, side === 0 ? Math.PI / 2 : 0, 0);
        this.transform.scale.set(Math.max(0, size), Math.max(0, size), 1);
        this.transform.updateMatrix();
        this.opacity.setX(
          index,
          Math.pow(Math.max(0, 1 - distance / 1.1), 1.5),
        );
        contacts.setMatrixAt(index++, this.transform.matrix);
      }
    }
    this.opacity.needsUpdate = true;
    contacts.count = index;
    contacts.instanceMatrix.needsUpdate = true;
  }
}
