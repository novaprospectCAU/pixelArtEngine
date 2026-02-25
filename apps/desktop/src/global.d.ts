import type { PixelBridge } from "./ipc";

declare global {
  interface Window {
    pixel: PixelBridge;
  }
}

export {};
