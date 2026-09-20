import { Quaternion, Vector3 } from "three";

// A gentle five-and-a-half-degree incline: enough to gather loose marbles without pulling a throw off course.
export const floorSlope = 0.068;
export const roomRotation = new Quaternion().setFromUnitVectors(
  new Vector3(0, 1, 0),
  new Vector3(-floorSlope, 1, -floorSlope).normalize(),
);
const corner = new Vector3(-3, 0, -3);
export const roomOffset = corner
  .clone()
  .sub(corner.clone().applyQuaternion(roomRotation));
// Simulate in room coordinates, with real vertical gravity expressed in that frame.
export const roomGravity = new Vector3(0, -10, 0).applyQuaternion(
  roomRotation.clone().invert(),
);
export const throwOrigin = new Vector3(4, 3.05, 5);
