import { copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Project site path. Must match the GitHub repo name. */
export const BASE_PATH = "/Materials-Tracking/";

function githubPagesSpa(): Plugin {
  return {
    name: "github-pages-spa",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(rootDir, "dist");
      copyFileSync(path.join(outDir, "index.html"), path.join(outDir, "404.html"));
      writeFileSync(path.join(outDir, ".nojekyll"), "");
    },
  };
}

function redirectRootToBase(): Plugin {
  const redirect = (url: string | undefined) => url === "/" || url === "";
  const handler = (
    req: { url?: string },
    res: { writeHead: (code: number, headers: Record<string, string>) => void; end: () => void },
    next: () => void,
  ) => {
    if (redirect(req.url)) {
      res.writeHead(302, { Location: BASE_PATH });
      res.end();
      return;
    }
    next();
  };

  return {
    name: "redirect-root-to-base",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss(), githubPagesSpa(), redirectRootToBase()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
