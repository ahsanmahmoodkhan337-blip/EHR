/**
 * The claim papers must not overflow their own box.
 *
 * Owner report (2026-11-22): "cms 1500 form page in billing is trembling".
 * Measured cause: the box-24 table on both papers gave every cell a percentage
 * width that already summed to 100 % (`width: ${col.width * 100}%`,
 * `width: "12%"`, …) and then added 2 px gaps between the cells plus a fixed
 * remove-line button. Measured in the browser at 1280 px: the header row and
 * every service-line row measured `scrollWidth` 798 against `clientWidth` 764 —
 * 34 px wider than the paper. Inside a vertically scrolling panel that extra
 * width brings a horizontal scrollbar in and out as the panel's own width
 * changes, which is the shake the owner saw.
 *
 * The fix is the cause: a cell is sized by `flexGrow` (the printed proportion)
 * with `flexBasis: 0` and `min-w-0`, so the cells share what is left after the
 * gaps instead of each claiming its full share on top of them. A row can then
 * never be wider than the box it is drawn in, whatever the width of the screen.
 *
 * These assertions read the components' own source, because the overflow is a
 * layout property of the markup: no test renderer can measure it without a
 * browser, and the defect is exactly a percentage width reappearing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CMS1500_LINE_COLUMNS } from "../src/data/claims/cms1500Layout";
import { UB04_LINE_COLUMNS } from "../src/data/claims/ub04Layout";

const src = (name: string) =>
  readFileSync(join(import.meta.dir, "..", "src", "components", "BillingLedger", name), "utf8");

describe("claim papers: the box-24/48 table never exceeds its box", () => {
  for (const file of ["CMS1500Form.tsx", "Ub04Form.tsx"]) {
    test(`${file} sizes every table cell with flexGrow + flexBasis 0`, () => {
      const code = src(file);
      // The bug: a percentage width on a cell that sits beside gaps and a button.
      expect(code).not.toMatch(/style=\{\{\s*width:\s*[`"']/);
      expect(code).not.toMatch(/width:\s*`\$\{[a-zA-Z_.[\]]+\]\s*\*\s*100\}%`/);
      // The fix: proportion as growth from a zero basis, allowed to shrink.
      expect(code).toMatch(/flexGrow:/);
      expect(code).toMatch(/flexBasis:\s*0/);
      expect(code).toMatch(/min-w-0/);
    });
  }

  test("the printed proportions leave the gaps and the remove button their room", () => {
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const cms = round(CMS1500_LINE_COLUMNS.reduce((sum, col) => sum + col.width, 0));
    const ub = round(UB04_LINE_COLUMNS.reduce((sum, col) => sum + col.width, 0));
    // Never more than the whole row: that was the overflow.
    expect(cms).toBeLessThanOrEqual(1);
    expect(ub).toBeLessThanOrEqual(1);
    // And the CMS-1500 still uses the whole sheet.
    expect(cms).toBe(1);
  });
});
