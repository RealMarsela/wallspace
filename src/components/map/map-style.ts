import type { Theme } from "@/components/ui/theme";

// OpenFreeMap: keyless OpenStreetMap vector tiles.
export const basemap = (t: Theme) =>
  t === "dark" ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron";

export const ATLANTA: [number, number] = [-84.39, 33.765];

// Heat ramp, transparent at zero so the basemap shows through.
export const heatRamp = (t: Theme) =>
  t === "dark"
    ? ["rgba(0,0,0,0)", "rgba(110,55,10,0.35)", "rgba(190,90,15,0.55)", "rgba(240,122,18,0.72)", "rgba(255,170,90,0.85)", "rgba(255,226,170,0.92)"]
    : ["rgba(255,255,255,0)", "rgba(246,217,182,0.45)", "rgba(244,178,110,0.6)", "rgba(238,116,16,0.68)", "rgba(190,80,10,0.76)", "rgba(140,50,5,0.82)"];

// MapLibre 6's own relative worker URL breaks under the bundler, and a third-party CDN worker is blocked by some
// browsers (Brave Shields), so the worker is served same-origin from public/vendor. Must match the installed version;
// src/components/map/worker.test.ts fails if it drifts. Refresh with:
//   cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/vendor/maplibre-gl-worker-<version>.js
export const MAPLIBRE_VERSION = "6.16.0";
export const WORKER_URL = `/vendor/maplibre-gl-worker-${MAPLIBRE_VERSION}.js`;
