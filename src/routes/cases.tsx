/**
 * /cases — the layout every case address sits inside
 *
 * Inspired by: Epic's Chart activity, where the module is a frame and the
 * record you opened is drawn inside it. This route owns no screen of its own: it
 * is the parent of both `/cases` (the list, `cases.index.tsx`) and
 * `/cases/$track/$caseId/$stage` (one case stage).
 *
 * A parent route must render its child. Without this `<Outlet />` the child
 * route never drew, so every `/cases/...` deep link — a bookmark, a refresh, a
 * shared link — showed the case list instead of the case. Verified in a browser
 * on `/cases/medical/MCASE-001/claim` and `/cases/dental/DCASE-001/claim`
 * before the fix.
 *
 * The list and the case runner each draw their own `AppShell`, so this frame
 * adds nothing around them — no second shell, no padding of its own.
 */

import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cases")({
  component: CasesLayout,
});

function CasesLayout() {
  return <Outlet />;
}
