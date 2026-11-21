/**
 * hooks-before-early-return.test.ts — the encounter page must not crash on load.
 *
 * On 2026-11-21 the encounter route (`/encounter/:encounterId/:stage`) rendered
 * "Something went wrong!" with React error #310 in the browser. The cause was in
 * `src/routes/index.tsx`: `Home` returns early while `checkingAuth` is true and
 * again when the student is not logged in, and `useActiveTrack()` /
 * `useInboxItems()` were called *after* those returns. The first render skipped
 * them and the second called them, so React saw a different number of hooks
 * between renders and tore the whole page down.
 *
 * The acceptance test walks straight into that page, so this is a hard rule:
 * every hook in `Home` is called before its first `return`. This test reads the
 * source rather than rendering, because the bug only shows up across two renders
 * and a browser is the only other place it appears.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(import.meta.dir, "..", "src", "routes", "index.tsx"), "utf8");

/** The `Home` component's own body, from its declaration to the next top-level export. */
function homeBody(): string {
  const start = SOURCE.indexOf("export function Home(");
  expect(start).toBeGreaterThan(-1);
  const next = SOURCE.indexOf("\nexport ", start + 1);
  const end = next === -1 ? SOURCE.length : next;
  expect(end).toBeGreaterThan(start);
  // Comments are stripped so a hook name mentioned in prose is not a call.
  return SOURCE.slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** A call to a hook, at the start of a statement: `const x = useThing(` / `useThing(`. */
const HOOK_CALL = /\buse[A-Z][A-Za-z0-9]*\s*\(/g;

describe("the encounter page calls every hook before it returns early", () => {
  it("the two shared-state hooks sit above the auth early returns", () => {
    const body = homeBody();
    const firstGate = body.indexOf("if (checkingAuth)");
    expect(firstGate).toBeGreaterThan(-1);

    const beforeGate = body.slice(0, firstGate);
    expect(beforeGate).toContain("useActiveTrack()");
    expect(beforeGate).toContain("useInboxItems()");
  });

  it("no hook is called after the first early return", () => {
    const body = homeBody();
    const firstGate = body.indexOf("if (checkingAuth)");
    expect(firstGate).toBeGreaterThan(-1);

    const afterGate = [...body.slice(firstGate).matchAll(HOOK_CALL)].map((m) => m[0].trim());
    expect(afterGate).toEqual([]);
  });
});
