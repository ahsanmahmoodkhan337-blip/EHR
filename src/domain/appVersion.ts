/**
 * appVersion.ts — is this tab running the build the server is serving?
 *
 * Inspired by: Epic Hyperspace's "a newer version is available — reload" strip
 * and the update banner in eCW's web client. Neither reloads a chart out from
 * under the student; both say so in one line and leave the click to them.
 *
 * Why it exists (owner report, 2026-11-23 — *"the Tutorial coding and SOAP part
 * is not updated"*): the new note and the new codes were live on the server and
 * a tab opened before the deploy still ran the old bundle. A deploy cannot reach
 * into a tab that is already open, so the tab asks: it reads `/index.html`, takes
 * the `index-*.js` name out of it, and compares it with the bundle this tab
 * loaded — on load, every five minutes, and whenever the tab is brought back
 * into focus.
 *
 * The rule is one comparison and nothing else: a different filename means a
 * different build. No version numbers to keep in step, no build stamp to
 * remember to bump, and nothing to get wrong in a dev server that serves no
 * bundle at all (`/src/main.tsx`) — that case reads as "no bundle", and a tab
 * that does not know which bundle it loaded never shows the bar.
 */

/** How often an open tab re-asks. Five minutes: a deploy is never far behind. */
export const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** The sentence in the bar. The Reload button completes it. */
export const NEW_VERSION_MESSAGE = "A new version of the simulator is ready";

/** The bar's id, so a test and a screen reader name the same thing. */
export const NEW_VERSION_BAR_ID = "new-version-bar";

/** Vite names its entry chunk `index-<hash>.js`; nothing else is a bundle. */
const BUNDLE_FILE = /^index-[A-Za-z0-9_-]+\.js$/;

/** The `src` of every script the page loads, in document order. */
export function scriptSourcesFromHtml(html: string): string[] {
  const sources: string[] = [];
  if (!html) return sources;
  const pattern = /<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match = pattern.exec(html);
  while (match) {
    sources.push(match[1]);
    match = pattern.exec(html);
  }
  return sources;
}

/**
 * The bundle name among these script sources, or null.
 *
 * A source is a URL: `/assets/index-BpdGg20I.js`, `http://host/assets/index-…js`,
 * `…/index-…js?v=2`. Only the last path segment is the filename.
 */
export function bundleFromSources(sources: readonly string[]): string | null {
  for (const source of sources) {
    if (!source) continue;
    const path = source.split(/[?#]/)[0];
    const name = path.split("/").pop() ?? "";
    if (BUNDLE_FILE.test(name)) return name;
  }
  return null;
}

/** The bundle name in a served `index.html`. */
export function bundleFromHtml(html: string): string | null {
  return bundleFromSources(scriptSourcesFromHtml(html));
}

/**
 * The bundle this tab is running, or null when it cannot be told (a dev server,
 * a test process). The page's own script tags come first; `import.meta.url` is
 * the fallback for a tab whose markup a wrapper rewrote.
 */
export function loadedBundle(doc?: Document | null): string | null {
  const sources: string[] = [];
  const page = doc === undefined ? (typeof document === "undefined" ? null : document) : doc;
  if (page) {
    for (const script of Array.from(page.querySelectorAll("script[src]"))) {
      sources.push(script.getAttribute("src") ?? "");
    }
  }
  if (typeof import.meta !== "undefined" && typeof import.meta.url === "string") {
    sources.push(import.meta.url);
  }
  return bundleFromSources(sources);
}

/** A different bundle on the server is a new version. Nothing else is. */
export function isNewerVersion(loaded: string | null, served: string | null): boolean {
  return Boolean(loaded && served && loaded !== served);
}

export interface VersionWatchOptions {
  /** Read the served page. Defaults to `fetch("/index.html", { cache: "no-store" })`. */
  fetchHtml?: () => Promise<string>;
  /** The bundle this tab loaded. Defaults to `loadedBundle()`. */
  loaded?: () => string | null;
  /** Called once per check that finds a different bundle. */
  onNewVersion: (served: string) => void;
  intervalMs?: number;
  /** Where the focus listener sits — the browser's window unless a test passes one. */
  target?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  timers?: {
    setInterval: (handler: () => void, ms: number) => unknown;
    clearInterval: (id: unknown) => void;
  };
}

export interface VersionWatch {
  /** Ask once, now. Resolves true when a new version was found. */
  check: () => Promise<boolean>;
  /** Stop the timer and the focus listener. */
  stop: () => void;
}

function fetchServedHtml(): Promise<string> {
  if (typeof fetch !== "function") return Promise.reject(new Error("no fetch in this environment"));
  return fetch("/index.html", { cache: "no-store" }).then((response) =>
    response.ok ? response.text() : Promise.reject(new Error(`index.html answered ${response.status}`)),
  );
}

/**
 * Start asking. One check on load, one every `intervalMs`, one on tab focus.
 *
 * A failed check (offline, a dev server, a blocked request) is silent: there is
 * nothing the student can do about it and no bar to show. Two checks never run
 * at once — a slow request and a focus event must not both answer.
 */
export function startVersionWatch(options: VersionWatchOptions): VersionWatch {
  const intervalMs = options.intervalMs ?? VERSION_CHECK_INTERVAL_MS;
  const fetchHtml = options.fetchHtml ?? fetchServedHtml;
  const getLoaded = options.loaded ?? (() => loadedBundle());
  const target =
    options.target === undefined ? (typeof window === "undefined" ? null : window) : options.target;
  const timers = options.timers ?? {
    setInterval: (handler: () => void, ms: number) => setInterval(handler, ms),
    clearInterval: (id: unknown) => clearInterval(id as ReturnType<typeof setInterval>),
  };

  let inFlight = false;
  let stopped = false;

  const check = async (): Promise<boolean> => {
    if (stopped || inFlight) return false;
    inFlight = true;
    try {
      const served = bundleFromHtml(await fetchHtml());
      if (!isNewerVersion(getLoaded(), served)) return false;
      options.onNewVersion(served as string);
      return true;
    } catch {
      return false;
    } finally {
      inFlight = false;
    }
  };

  const onFocus = () => {
    void check();
  };

  target?.addEventListener("focus", onFocus);
  const timer = timers.setInterval(onFocus, intervalMs);
  void check();

  return {
    check,
    stop() {
      stopped = true;
      target?.removeEventListener("focus", onFocus);
      timers.clearInterval(timer);
    },
  };
}
