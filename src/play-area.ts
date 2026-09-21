export const clearCornerPoints = 25;

type Position = { x: number; z: number };
/** Room-local ball centres behind the rail; airborne balls still occupy the area. */
export function insideTriangle(position: Position): boolean {
  return (
    position.x >= -3.04 && position.z >= -3.04 && position.x + position.z <= -1
  );
}
/** Only removing the last occupants earns a bonus, not another clear outside an empty tray. */
export function clearsTriangle(
  removed: Position[],
  remaining: Position[],
): boolean {
  return removed.some(insideTriangle) && !remaining.some(insideTriangle);
}
