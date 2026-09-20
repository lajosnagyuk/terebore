export const touchAimOffset = 84;
/** Reject off-screen releases before applying the fingertip offset. */
export function pointerAim(
  x: number,
  y: number,
  touch: boolean,
  width: number,
  height: number,
) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x > width ||
    y > height
  )
    return null;
  return {
    x,
    y: touch ? Math.max(Math.min(20, height), y - touchAimOffset) : y,
  };
}
