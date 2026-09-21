export const primaryColorCount = 5;
export const lightColor = 5;
export const clayColor = 6;
export type BallFinish = "normal" | "light" | "clay" | "perfect";
// Five primary families and two rare playtest pieces.
export const palette: {
  name: string;
  color: string;
  dark: string;
  finish?: BallFinish;
}[] = [
  { name: "Cherry blossom", color: "#ff2d68", dark: "#982747" },
  { name: "Clear ocean", color: "#0089c8", dark: "#00527c" },
  { name: "Wild plum", color: "#9038d3", dark: "#512c78" },
  { name: "Sunlight", color: "#ffc815", dark: "#aa730c" },
  { name: "Amazon green", color: "#43be30", dark: "#2a6727" },
  { name: "Light", color: "#f6f3dd", dark: "#b8b5a5", finish: "light" },
  { name: "Clay", color: "#82837b", dark: "#50534f", finish: "clay" },
];
