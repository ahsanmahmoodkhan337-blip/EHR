import handler from "./dist/server/server.js";

const app = handler.default || handler;
const req = new Request("http://localhost:3000/");
const r = await app.fetch(req);
const html = await r.text();
import { writeFileSync } from "node:fs";
writeFileSync("dist/client/index.html", html);
console.log("OK", html.length);