import { defineConfig, type PreviewServer, type ViteDevServer } from "vite";

function movAsMp4(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((req, res, next) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path.endsWith(".mov")) res.setHeader("Content-Type", "video/mp4");
    next();
  });
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: { outDir: "dist", emptyOutDir: true },
  // Local verification from the Playwright container reaches the host preview via this name.
  preview: { allowedHosts: ["host.docker.internal"] },
  server: { allowedHosts: ["host.docker.internal"] },
  plugins: [
    {
      name: "mov-as-mp4",
      configureServer: movAsMp4,
      configurePreviewServer: movAsMp4,
    },
  ],
});
