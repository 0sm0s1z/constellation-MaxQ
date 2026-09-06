import { defineConfig } from "vite";
export default defineConfig({
  root: ".",
  publicDir: "public",
  build: { outDir: "dist", emptyOutDir: true },
  // Local verification from the Playwright container reaches the host preview via this name.
  preview: { allowedHosts: ["host.docker.internal"] },
  server: { allowedHosts: ["host.docker.internal"] }
});
