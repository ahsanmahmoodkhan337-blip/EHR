import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("every sonner toast has somewhere to appear", () => {
  test("the root route mounts the one Toaster when any screen calls toast()", () => {
    const users = files(join(root, "src")).filter((f) => readFileSync(f, "utf8").includes('from "sonner"'));
    expect(users.length).toBeGreaterThan(0);
    const rootRoute = readFileSync(join(root, "src/routes/__root.tsx"), "utf8");
    expect(rootRoute).toContain('import { Toaster } from "sonner"');
    expect(rootRoute).toContain("<Toaster");
  });
});
