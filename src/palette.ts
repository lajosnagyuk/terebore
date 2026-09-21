export const primaryColorCount = 5;
export const lightColor = 5;
export const clayColor = 6;
export type BallFinish = "normal" | "light" | "clay";
// Five primary families and two rare playtest pieces.
export const palette: {
  name: string;
  color: string;
  dark: string;
  finish?: BallFinish;
}[] = [
  { name: "Cherry blossom", color: "#ee4776", dark: "#982747" },
  { name: "Clear ocean", color: "#008dce", dark: "#00527c" },
  { name: "Wild plum", color: "#924bc8", dark: "#512c78" },
  { name: "Sunlight", color: "#ffca1e", dark: "#aa730c" },
  { name: "Amazon green", color: "#4eb83e", dark: "#2a6727" },
  { name: "Light", color: "#f4f1df", dark: "#b8b5a5", finish: "light" },
  { name: "Clay", color: "#858680", dark: "#50534f", finish: "clay" },
];
