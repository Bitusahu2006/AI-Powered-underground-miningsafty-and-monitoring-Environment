import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const droneDashboardPath = fileURLToPath(new URL("../smart_mining_drone.html", import.meta.url));

function standaloneDroneDashboard() {
  const fileName = "smart_mining_drone.html";
  const route = `/${fileName}`;

  return {
    name: "standalone-drone-dashboard",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== route) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(readFileSync(droneDashboardPath));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName,
        source: readFileSync(droneDashboardPath),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), standaloneDroneDashboard()],
  server: { port: 5173 },
});
