import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

// Normalize VITE_API_URL: add https:// if the env var is set but missing a protocol.
// This handles the case where the host (e.g. Vercel) has the var set to
// "workspaceapi-server-production-1c35.up.railway.app" without a scheme,
// which would cause every fetch to resolve as a relative URL on the frontend origin.
const rawApiUrl = process.env.VITE_API_URL?.replace(/\/+$/, "") ?? "";
const normalizedApiUrl =
  rawApiUrl && !rawApiUrl.match(/^https?:\/\//)
    ? `https://${rawApiUrl}`
    : rawApiUrl;

export default defineConfig({
  base: basePath,
  define: {
    // Replace import.meta.env.VITE_API_URL at build time with the normalised value.
    "import.meta.env.VITE_API_URL": JSON.stringify(normalizedApiUrl),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
