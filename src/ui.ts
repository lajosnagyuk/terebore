import markup from "./ui.html?raw";

export const icons = {
  sound:
    '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/>',
};
export const svg = (s: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${s}</svg>`;

/** The static interface is mounted once before game setup. */
export function mountUI() {
  $("#app").innerHTML = markup;
}
export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing interface element: ${selector}`);
  return element;
}
