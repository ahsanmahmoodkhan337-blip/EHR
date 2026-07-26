import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 3000, host: true, allowedHosts: true },
  plugins: [
        tsConfigPaths({ projects: ["./tsconfig.json"] }),
    viteReact(),
  ],
});
