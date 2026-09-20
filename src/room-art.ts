import * as THREE from "three";

/** Painted daylight: fixed world-space lighting without shadow maps or postprocessing. */
export function roomMaterial(color: string) {
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 vRoomPosition;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRoomPosition=(modelMatrix*vec4(transformed,1.0)).xyz;",
      );
    shader.fragmentShader =
      "varying vec3 vRoomPosition;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
   float u = vRoomPosition.x * .8 + vRoomPosition.z * .6;
   float v = vRoomPosition.z * .8 - vRoomPosition.x * .6;
   float pool = smoothstep(-3.2,-.8,u)*(1.0-smoothstep(4.1,6.5,u))*smoothstep(-3.3,-1.5,v)*(1.0-smoothstep(2.0,4.0,v));
   float shade = .90 + .10 * smoothstep(0.0,6.0,distance(vRoomPosition.xz,vec2(-3.0)));
   diffuseColor.rgb *= shade;
   diffuseColor.rgb = mix(diffuseColor.rgb,vec3(1.0,.94,.79),pool*.11);
  `,
      );
  };
  return material;
}
