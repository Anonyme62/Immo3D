import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "node:url";

const cesiumBaseUrl = "cesium";

const cesiumSource = normalizePath(
  fileURLToPath(new URL("./node_modules/cesium/Build/Cesium", import.meta.url))
);

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/Workers/**/*`, dest: `${cesiumBaseUrl}/Workers` },
        { src: `${cesiumSource}/ThirdParty/**/*`, dest: `${cesiumBaseUrl}/ThirdParty` },
        { src: `${cesiumSource}/Assets/**/*`, dest: `${cesiumBaseUrl}/Assets` },
        { src: `${cesiumSource}/Widgets/**/*`, dest: `${cesiumBaseUrl}/Widgets` },
      ],
    }),
  ],

  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
});