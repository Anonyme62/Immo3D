import fs from "node:fs";
import { defineConfig, loadEnv, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "node:url";

const cesiumBaseUrl = "cesium";

const cesiumSource = normalizePath(
  fileURLToPath(new URL("./node_modules/cesium/Build/Cesium", import.meta.url))
);

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const httpsConfig = command === "serve" ? resolveHttpsConfig(env) : undefined;
  const apiProxyTarget = env.VITE_DEV_API_TARGET || "http://127.0.0.1:8000";

  return {
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

    server: {
      host: env.VITE_DEV_HOST || undefined,
      port: parseOptionalPort(env.VITE_DEV_PORT),
      https: httpsConfig,
      proxy: {
        "/auth": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/biens": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/notes": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/markers": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/blacklist": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/billing": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/health": { target: apiProxyTarget, changeOrigin: false, secure: false },
        "/geocoding": { target: apiProxyTarget, changeOrigin: false, secure: false },
      },
    },

    preview: {
      host: env.VITE_PREVIEW_HOST || env.VITE_DEV_HOST || undefined,
      port: parseOptionalPort(env.VITE_PREVIEW_PORT),
      https: httpsConfig,
    },
  };
});

function parseOptionalPort(value) {
  if (!value) {
    return undefined;
  }

  const port = Number(value);
  return Number.isFinite(port) ? port : undefined;
}

function resolveHttpsConfig(env) {
  const keyFile = env.VITE_HTTPS_KEY_FILE;
  const certFile = env.VITE_HTTPS_CERT_FILE;

  if (!keyFile && !certFile) {
    return undefined;
  }

  if (!keyFile || !certFile) {
    throw new Error(
      "VITE_HTTPS_KEY_FILE and VITE_HTTPS_CERT_FILE must both be set to enable local HTTPS."
    );
  }

  if (!fs.existsSync(keyFile)) {
    throw new Error(`Missing HTTPS key file: ${keyFile}`);
  }

  if (!fs.existsSync(certFile)) {
    throw new Error(`Missing HTTPS certificate file: ${certFile}`);
  }

  return {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile),
  };
}
