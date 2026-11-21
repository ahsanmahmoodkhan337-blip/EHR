/**
 * /encounter/$encounterId — the encounter's own address, its stage below it
 *
 * Inspired by: Epic Hyperspace's Chart activity, where the patient's encounter is
 * the address you are in and each activity inside it is a screen of that
 * encounter — refreshing the page keeps you in the same patient's encounter.
 *
 * Owner's audit, 2026-11-20, item 2: "a real route per encounter and stage,
 * `/encounter/:encounterId/:stage`, so refresh and deep links work."
 *
 * This file is the frame only, and it draws its child: the stage route
 * (`encounter.$encounterId.$stage.tsx`) holds the workspace, so the encounter is
 * one address with one stage in it rather than a page per screen. The address is
 * read by the workspace itself through `domain/encounterRoute.ts`.
 *
 * The parent must render its child — a layout that forgets `<Outlet />` matches
 * the address and draws nothing, which reads as a missing page.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/encounter/$encounterId")({
  component: EncounterLayout,
});

function EncounterLayout() {
  return <Outlet />;
}
