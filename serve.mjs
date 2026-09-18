// Static server for the built SPA.
// Serves dist/ with Cache-Control: no-store so mobile browsers (incl. WhatsApp's
// in-app browser) never hold a stale bundle. Falls back to index.html for
// client-side routes so /login, /admin, /access etc. still work.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL(".", import.meta.url)), "dist");
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

const NO_STORE = "no-store, no-cache, must-revalidate, max-age=0";

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    let filePath = normalize(join(DIST, pathname));
    if (filePath !== DIST && !filePath.startsWith(DIST + "/")) {
      res.writeHead(403, { "Cache-Control": NO_STORE });
      res.end("Forbidden");
      return;
    }

    let st = null;
    try {
      st = await stat(filePath);
    } catch {
      st = null;
    }

    if (st && st.isFile()) {
      const data = await readFile(filePath);
      const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": NO_STORE });
      res.end(data);
      return;
    }

    // SPA fallback
    const index = await readFile(join(DIST, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": NO_STORE,
    });
    res.end(index);
  } catch {
    res.writeHead(500, { "Cache-Control": NO_STORE });
    res.end("Server error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`static server listening on http://0.0.0.0:${PORT}`);
});
