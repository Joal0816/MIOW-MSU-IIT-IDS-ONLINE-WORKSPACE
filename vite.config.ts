import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths(),
    tanstackStart({
      srcDirectory: "src",
      router: { entry: "router.tsx" },
      server: { entry: "server.ts" },
    }),
    viteReact(),
    nitro(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
