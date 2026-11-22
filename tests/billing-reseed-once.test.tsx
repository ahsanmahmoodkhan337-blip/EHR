/**
 * Billing — the claim is seeded once per patient + encounter, never in a loop.
 *
 * Owner report, 2026-11-22: the Billing screen threw **React error #185
 * ("Maximum update depth exceeded")** on a chart carrying saved state from
 * before Phase 1, while a fresh browser never reproduced it. The mechanism:
 * `BillingLedger`'s re-seeding effect asked the store to write the claim, the
 * store refused it (`store/pipelineStore.tsx` — `scopingRefusal` on
 * `no-patient` / `no-encounter` returns the previous state), so the claim never
 * changed and the next render seeded again — for as long as anything kept
 * re-rendering.
 *
 * This test mounts the real component, inside the real providers, against a
 * saved chart whose patient is on screen but whose record the store will not
 * scope a claim to. It counts every call the screen makes to `setClaimForm`
 * and fails if the count grows past the first pass — the definition of the
 * loop — and it fails if the mount throws.
 *
 * Inspiration: Epic Resolute's claim build — the encounter owns the claim, and
 * a screen never re-mints one it cannot attribute.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// ── A DOM, before React DOM is imported ────────────────────────────
const win = new Window({ url: "http://localhost/billing" });
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = win;
globals.document = win.document;
globals.navigator = win.navigator;
globals.HTMLElement = win.HTMLElement;
globals.Node = win.Node;
globals.Element = win.Element;
globals.Event = win.Event;
globals.MouseEvent = win.MouseEvent;
globals.KeyboardEvent = win.KeyboardEvent;
globals.localStorage = win.localStorage;
globals.getComputedStyle = win.getComputedStyle.bind(win);
globals.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number;
globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
globals.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PipelineProvider, PipelineContext, usePipeline } = await import("../src/store/pipelineStore");
const { PatientProvider } = await import("../src/store/patientStore");
const { BillingLedger } = await import("../src/components/BillingLedger/BillingLedger");
const { useEhrStore } = await import("../src/store/ehrStore");
const { saveUserData } = await import("../src/store/persistence");
const { createEncounter, encounterKey } = await import("../src/store/pipelineEncounter");

const PHONE = "+920000000001";

/** Every `setClaimForm` call the mounted screen makes. */
let seedAttempts = 0;
/** The live pipeline context, so the test can force a provider re-render. */
let pipeline: { setDemoFillMissingBoxes: (on: boolean) => void } | null = null;

/** Wraps the screen in a context whose `setClaimForm` is counted. */
function Counted({ children }: { children: React.ReactNode }) {
  const ctx = usePipeline();
  pipeline = ctx;
  const value = React.useMemo(
    () => ({
      ...ctx,
      setClaimForm: (form: unknown) => {
        seedAttempts += 1;
        (ctx.setClaimForm as (f: unknown) => void)(form);
      },
    }),
    [ctx],
  );
  return React.createElement(PipelineContext.Provider, { value }, children);
}

function seedChart(opts: {
  activePatientId: string | null;
  encounterKeyName: string;
  encounterPatientId: string | null;
  claimForm?: unknown;
}) {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  const encounter = createEncounter(opts.encounterPatientId);
  saveUserData(PHONE, {
    pipeline: {
      activePatientId: opts.activePatientId,
      encounters: {
        [opts.encounterKeyName]: { ...encounter, claimForm: opts.claimForm ?? null },
      },
      currentRole: "biller",
      demoFillMissingBoxes: true,
    } as never,
    currentRole: "biller",
  });
  // The central chart store knows no encounter for this patient, so the pipeline
  // store cannot scope a claim to them: this is the refused write.
  useEhrStore.setState(
    (s) => ({ ...s, user: { ...s.user, context: {}, encounters: [] } }) as never,
  );
}

async function mount() {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(
      React.createElement(
        PatientProvider,
        null,
        React.createElement(
          PipelineProvider,
          null,
          React.createElement(Counted, null, React.createElement(BillingLedger)),
        ),
      ),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
  return {
    async rerender(times: number) {
      // Any unrelated pipeline write re-renders the provider, which hands the
      // screen a new `setClaimForm` — exactly what re-fired the old effect.
      for (let i = 0; i < times; i += 1) {
        await act(async () => {
          pipeline?.setDemoFillMissingBoxes(i % 2 === 0);
        });
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("Billing — the claim is seeded once, not on every render", () => {
  beforeEach(() => {
    seedAttempts = 0;
    pipeline = null;
  });

  test("a patient with no encounter on file does not re-seed on every render", async () => {
    // The unassigned bucket carries the patient, the store's active patient is
    // null and the chart store knows no encounter: the write is refused.
    seedChart({
      activePatientId: null,
      encounterKeyName: "__unassigned",
      encounterPatientId: "P001",
    });
    const screen = await mount();
    const afterMount = seedAttempts;
    expect(afterMount).toBeLessThanOrEqual(1);

    // Six unrelated pipeline writes. Before the ref key this seeded six more
    // times; a real browser re-rendering for any other reason looped until #185.
    await screen.rerender(6);
    expect(seedAttempts).toBe(afterMount);
    await screen.unmount();
  });

  test("a saved chart with an old-shape claim record seeds once and repairs it", async () => {
    // A claim saved before Phase 1: no identity seed key, invented member/group
    // IDs, and a service-line array that is not a service-line array.
    seedChart({
      activePatientId: "P001",
      encounterKeyName: encounterKey("P001"),
      encounterPatientId: "P001",
      claimForm: {
        claimType: "professional",
        insuredId: "INS-0001",
        insuredPolicyGroup: "GRP-0001",
        serviceLines: "not-an-array",
        totalCharge: 0,
      },
    });
    const screen = await mount();
    const afterMount = seedAttempts;
    expect(afterMount).toBeGreaterThanOrEqual(1);
    expect(afterMount).toBeLessThanOrEqual(1);

    await screen.rerender(4);
    expect(seedAttempts).toBe(afterMount);
    await screen.unmount();
  });
});
