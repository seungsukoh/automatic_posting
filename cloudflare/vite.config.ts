import { defineConfig } from "vite";

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
  },
});
