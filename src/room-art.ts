import * as THREE from "three";

/** Room-local daylight and baked-style occlusion, evaluated in the existing surface pass. */
export function roomMaterial(color: string, worldToRoom = new THREE.Matrix4()) {
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWorldToRoom = { value: worldToRoom };
    shader.vertexShader =
      "uniform mat4 uWorldToRoom; varying vec3 vRoomPosition; varying vec3 vRoomNormal;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRoomPosition=(uWorldToRoom*modelMatrix*vec4(transformed,1.0)).xyz; vRoomNormal=mat3(uWorldToRoom*modelMatrix)*normal;",
      );
    shader.fragmentShader =
      "varying vec3 vRoomPosition; varying vec3 vRoomNormal;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
   vec3 n = normalize(vRoomNormal) * (gl_FrontFacing ? 1.0 : -1.0);
   vec3 gap = max(vec3(vRoomPosition.x + 3.04, vRoomPosition.y, vRoomPosition.z + 3.04), vec3(0.0));
   vec3 adjacent = vec3(1.0) - abs(n);
   float broadOcclusion = dot(exp(-gap * 1.65), adjacent);
   float contactOcclusion = dot(exp(-gap * 14.0), adjacent);
   float daylight = .87 + .15 * max(0.0, dot(n, normalize(vec3(-.45, 1.0, .65))));
   diffuseColor.rgb *= daylight * (1.0 - min(.34, broadOcclusion * .14 + contactOcclusion * .05));
   float u = vRoomPosition.x * .8 + vRoomPosition.z * .6;
   float v = vRoomPosition.z * .8 - vRoomPosition.x * .6;
   float pool = smoothstep(-3.2,-.8,u)*(1.0-smoothstep(4.1,6.5,u))*smoothstep(-3.3,-1.5,v)*(1.0-smoothstep(2.0,4.0,v));
   diffuseColor.rgb = mix(diffuseColor.rgb,vec3(1.0,.94,.79),pool*.07);
   // Very quiet plaster variation, strongest near the viewer and filtered in the distance.
   float grain = sin(dot(vRoomPosition,vec3(73.0,51.0,67.0))) * sin(dot(vRoomPosition,vec3(37.0,83.0,43.0)));
   float grainFade = 1.0 - smoothstep(.015,.055,length(fwidth(vRoomPosition)));
   diffuseColor.rgb *= 1.0 + grain * .006 * grainFade;
  `,
      );
  };
  return material;
}

/** Room ink belongs behind translucent shells, regardless of an edge's sort centre. */
export function roomOutline(
  geometry: THREE.BufferGeometry,
  color: string,
  opacity: number,
) {
  const line = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  // Opaque room first, then ink, contact shadows (-1), and sorted shells (0).
  line.renderOrder = -2;
  return line;
}
