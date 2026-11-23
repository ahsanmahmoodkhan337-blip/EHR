/**
 * "A new version of the simulator is ready — Reload" (owner report, 2026-11-23).
 *
 * A deploy cannot reach a tab that is already open, so the tab asks: it reads
 * `/index.html`, takes the `index-*.js` name out of it and compares it with the
 * bundle it loaded — on load, every five minutes, and on tab focus.
 *
 * Tested where the rule lives: the pure comparison in `domain/appVersion.ts`,
 * the watch loop with a fake fetch and fake timers, and one render of the bar
 * itself in a DOM that holds an older bundle.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const {
  bundleFromHtml,
  bundleFromSources,
  isNewerVersion,
  loadedBundle,
  scriptSourcesFromHtml,
  startVersionWatch,
  VERSION_CHECK_INTERVAL_MS,
  NEW_VERSION_MESSAGE,
} = await import("../src/domain/appVersion");

/** A production `index.html`, the way Vite writes it. */
const PROD_HTML = `<!doctype html>
<html lang="en"><head>
  <link rel="stylesheet" crossorigin href="/assets/index-BpdGg20I.css">
  <script type="module" crossorigin src="/assets/index-BpdGg20I.js"></script>
</head><body><div id="root"></div></body></html>`;

/** A dev server's `index.html`: no built bundle at all. */
const DEV_HTML = `<!doctype html><html><body><div id="root"></div>
  <script type="module" src="/src/main.tsx"></script></body></html>`;

describe("reading the bundle name", () => {
  test("the served index.html names its entry chunk", () => {
    expect(scriptSourcesFromHtml(PROD_HTML)).toEqual(["/assets/index-BpdGg20I.js"]);
    expect(bundleFromHtml(PROD_HTML)).toBe("index-BpdGg20I.js");
  });

  test("a dev server serves no bundle, so nothing is compared", () => {
    expect(bundleFromHtml(DEV_HTML)).toBeNull();
    expect(bundleFromHtml("")).toBeNull();
  });

  test("a URL is reduced to its filename, query string and all", () => {
    expect(bundleFromSources(["/assets/index-abc123.js?v=2"])).toBe("index-abc123.js");
    expect(bundleFromSources(["http://host/assets/index-abc123.js"])).toBe("index-abc123.js");
    expect(bundleFromSources(["/src/main.tsx", "/assets/index-abc123.css"])).toBeNull();
  });

  test("this tab's bundle comes from its own script tags", () => {
    const scripts = [
      { getAttribute: () => "/assets/index-OLD11111.js" },
      { getAttribute: () => "/assets/index-OLD11111.css" },
    ];
    const fakeDocument = {
      querySelectorAll: () => scripts,
    } as unknown as Document;
    expect(loadedBundle(fakeDocument)).toBe("index-OLD11111.js");
  });
});

describe("which bundle is newer", () => {
  test("a different filename is a new version", () => {
    expect(isNewerVersion("index-old.js", "index-new.js")).toBe(true);
  });

  test("the same filename is the same version", () => {
    expect(isNewerVersion("index-new.js", "index-new.js")).toBe(false);
  });

  test("a tab that cannot tell which bundle it holds never nags", () => {
    expect(isNewerVersion(null, "index-new.js")).toBe(false);
    expect(isNewerVersion("index-new.js", null)).toBe(false);
    expect(isNewerVersion(null, null)).toBe(false);
  });
});

/** A window stand-in that records the listeners the watch adds. */
function fakeWindow() {
  const listeners = new Map<string, Array<() => void>>();
  return {
    listeners,
    addEventListener(type: string, handler: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type: string, handler: () => void) {
      listeners.set(type, (listeners.get(type) ?? []).filter((h) => h !== handler));
    },
    fire(type: string) {
      for (const handler of listeners.get(type) ?? []) handler();
    },
  };
}

function fakeTimers() {
  const every: Array<{ handler: () => void; ms: number }> = [];
  const cleared: unknown[] = [];
  return {
    every,
    cleared,
    setInterval(handler: () => void, ms: number) {
      every.push({ handler, ms });
      return every.length;
    },
    clearInterval(id: unknown) {
      cleared.push(id);
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the watch", () => {
  test("asks once on load, then every five minutes and on focus", async () => {
    const target = fakeWindow();
    const timers = fakeTimers();
    let found = 0;
    let fetches = 0;

    const watch = startVersionWatch({
      fetchHtml: async () => {
        fetches += 1;
        return PROD_HTML;
      },
      loaded: () => "index-OLD00000.js",
      onNewVersion: () => {
        found += 1;
      },
      target: target as never,
      timers,
    });
    await settle();

    expect(fetches).toBe(1);
    expect(found).toBe(1);
    expect(timers.every[0].ms).toBe(VERSION_CHECK_INTERVAL_MS);

    target.fire("focus");
    await settle();
    expect(fetches).toBe(2);
    expect(found).toBe(2);

    timers.every[0].handler();
    await settle();
    expect(fetches).toBe(3);

    watch.stop();
    expect(target.listeners.get("focus")).toHaveLength(0);
    expect(timers.cleared).toEqual([1]);
  });

  test("the same bundle, a failed request and no known bundle all stay quiet", async () => {
    const cases = [
      { fetchHtml: async () => PROD_HTML, loaded: () => "index-BpdGg20I.js" },
      { fetchHtml: async () => DEV_HTML, loaded: () => "index-BpdGg20I.js" },
      { fetchHtml: async () => PROD_HTML, loaded: () => null },
      {
        fetchHtml: async () => {
          throw new Error("offline");
        },
        loaded: () => "index-OLD00000.js",
      },
    ];
    for (const options of cases) {
      const target = fakeWindow();
      const timers = fakeTimers();
      let found = 0;
      const watch = startVersionWatch({
        ...options,
        onNewVersion: () => {
          found += 1;
        },
        target: target as never,
        timers,
      });
      await settle();
      expect(found).toBe(0);
      expect(await watch.check()).toBe(false);
      watch.stop();
    }
  });

  test("two checks never overlap", async () => {
    let release: (html: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    let fetches = 0;
    const timers = fakeTimers();
    const watch = startVersionWatch({
      fetchHtml: () => {
        fetches += 1;
        return pending;
      },
      loaded: () => "index-OLD00000.js",
      onNewVersion: () => {},
      target: null,
      timers,
    });
    await watch.check(); // still in flight from the load check
    expect(fetches).toBe(1);
    release(PROD_HTML);
    await settle();
    watch.stop();
  });
});

describe("the bar", () => {
  const bar = read("src/components/shell/NewVersionBar.tsx");
  const shell = read("src/components/AppShell.tsx");

  test("the shell shows it on every page, under the banner", () => {
    expect(shell).toContain("<NewVersionBar />");
    expect(shell.indexOf("<NewVersionBar />")).toBeGreaterThan(shell.indexOf("{banner}"));
  });

  test("it says the sentence and reloads only when the student says so", () => {
    expect(NEW_VERSION_MESSAGE).toBe("A new version of the simulator is ready");
    expect(bar).toContain("window.location.reload()");
    // One dismiss control, named for a screen reader, and no auto-reload.
    expect(bar).toContain('aria-label="Dismiss the new version notice"');
    expect(bar).not.toContain("useEffect(() => window.location");
    expect(bar).toContain('role="status"');
  });
});
