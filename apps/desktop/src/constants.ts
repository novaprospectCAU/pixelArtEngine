import type { PixelConfig } from "@pixel/core";

export const defaultPixelConfig: PixelConfig = {
  grid: 32,
  palette: 64,
  dither: "bayer",
  trim: false,
  alphaThreshold: 8,
  outline: false,
  scale: 2,
  fps: 24,
  outputFormat: "png",
  alphaMask: false,
  spritesheet: false
};
