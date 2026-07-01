// Vercel serverless function — runs the TanStack Start SSR handler
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");

export default async function handler(req, res) {
  try {
    const ssrPath = join(root, "dist/server/server.js");
    if (!existsSync(ssrPath)) {
      return res.status(500).end("SSR handler not built");
    }
    
    const server = await import(ssrPath);
    const app = server.default || server;
    
    if (typeof app.fetch !== "function") {
      return res.status(500).end("Invalid SSR handler");
    }
    
    const response = await app.fetch(req);
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const body = await response.text();
    res.end(body);
  } catch (e) {
    res.status(500).end(`Error: ${e.message}`);
  }
}