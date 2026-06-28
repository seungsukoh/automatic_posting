import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectDir = fileURLToPath(new URL(".", import.meta.url));

const workerApiOrigin = process.env.VITE_WORKER_API_ORIGIN || "http://127.0.0.1:8787";
const workerProxy = {
  "/api": {
    target: workerApiOrigin,
    changeOrigin: true,
  },
  "/cdn-cgi": {
    target: workerApiOrigin,
    changeOrigin: true,
  },
};

export default defineConfig({
  root: "public",
  server: {
    proxy: workerProxy,
  },
  preview: {
    proxy: workerProxy,
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    cssMinify: false,
    rollupOptions: {
      input: {
        index: resolve(projectDir, "public/index.html"),
        privacy: resolve(projectDir, "public/privacy.html"),
        terms: resolve(projectDir, "public/terms.html"),
        "data-deletion": resolve(projectDir, "public/data-deletion.html"),
      },
    },
  },
});
