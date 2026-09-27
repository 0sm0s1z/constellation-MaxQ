import { readFile } from "node:fs/promises";
import { marked } from "marked";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";

function staticMdxHtml(): Plugin {
  return {
    name: "maxq-static-mdx-html",
    enforce: "pre",
    async load(id) {
      const [filename, query = ""] = id.split("?", 2);
      if (!filename.endsWith(".mdx") || !new URLSearchParams(query).has("html")) return null;

      this.addWatchFile(filename);
      const source = await readFile(filename, "utf8");
      const html = String(await marked.parse(source, { gfm: true }));
      return `export default ${JSON.stringify(html)};`;
    },
  };
}

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
    staticMdxHtml(),
    {
      name: "mov-as-mp4",
      configureServer: movAsMp4,
      configurePreviewServer: movAsMp4,
    },
  ],
});
