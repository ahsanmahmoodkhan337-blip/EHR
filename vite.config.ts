import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// The platform injects Supabase credentials as SUPABASE_URL / SUPABASE_ANON_KEY
// (no VITE_ prefix). Vite only exposes VITE_-prefixed vars to the client, so we
// map them explicitly here. We deliberately do NOT expose SUPABASE_SERVICE_ROLE_KEY.
export default defineConfig({
  server: { port: 3000, host: true, allowedHosts: true },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.SUPABASE_URL ?? "",
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      process.env.SUPABASE_ANON_KEY ?? "",
    ),
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    viteReact(),
  ],
});
